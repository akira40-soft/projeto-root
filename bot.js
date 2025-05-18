console.log("🟢 O script bot.js iniciou a execução com Baileys!");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    getAggregateVotesInPollMessage
} = require('baileys');
const axios = require('axios');
const fs = require('fs');
// REMOVEMOS o require('qrcode') - Não vamos gerar a imagem aqui
const express = require('express');

let API_URL;
try {
    const config = require('./config');
    API_URL = config.API_URL || "https://flask-fzw0.onrender.com";
    console.log(`🔗 API_URL configurada: ${API_URL}`);
} catch (error) {
    console.error("❌ Erro: Arquivo 'config.js' não encontrado ou inválido:", error.message);
    process.exit(1);
}

// Cache para mensagens recentes
const messageCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos
const MAX_CACHE_SIZE = 100;
const PRIVILEGED_NUMBER = "244937035662";

// Timeout e configuração de retry otimizada para Render
const REQUEST_TIMEOUT = 60000; // 60 segundos
const HEALTH_CHECK_TIMEOUT = 30000; // 30 segundos para verificação de saúde
const MAX_RETRIES = 5; // Aumentado para 5 tentativas para maior resiliência
const RETRY_DELAY = 3000; // Atraso de 3 segundos entre tentativas

// Keep-alive e monitoramento
const KEEP_ALIVE_INTERVAL = 5 * 60 * 1000; // 5 minutos para ping ao WhatsApp
let isKeepAliveRunning = false;

// Limpeza periódica do cache
function cleanCache() {
    const now = Date.now();
    for (const [messageId, { timestamp }] of messageCache.entries()) {
        if (now - timestamp > CACHE_DURATION) {
            messageCache.delete(messageId);
        }
    }
    while (messageCache.size > MAX_CACHE_SIZE) {
        // Remove o mais antigo (Map itera na ordem de inserção)
        const oldestKey = messageCache.keys().next().value;
        messageCache.delete(oldestKey);
    }
    console.log(`🧹 Cache limpo. Tamanho atual: ${messageCache.size}`);
}
setInterval(cleanCache, 60000); // Limpa a cada minuto

class Bot {
    constructor() {
        this.sock = null;
        this.botNumber = null;
        // REMOVEMOS this.qrCodePath
        this.qrCodeString = null; // Adicionamos para armazenar a string do QR Code
        this.isConnected = false;
    }

    async iniciar() {
        console.log("🚀 Iniciando Baileys...");
        try {
            const { version } = await fetchLatestBaileysVersion();
            console.log(`🔄 Usando Baileys versão: ${version.join('.')}`);

            const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info');
            this.sock = makeWASocket({
                version,
                auth: state,
                printQRInTerminal: false, // Mantemos falso para não imprimir no terminal
                syncFullHistory: false,
                markOnlineOnConnect: false,
            });

            // Capturar o QR code string
            this.sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;
                console.log(`🔄 Estado da conexão: ${connection}`);

                if (qr) {
                    console.log("🔑 QR Code recebido como string.");
                    this.qrCodeString = qr; // Armazena a string do QR Code
                    // REMOVEMOS a geração e salvamento da imagem
                    console.log(`🔗 Acesse o endpoint /get-qr-string para obter o código QR.`);
                } else {
                     // Se não há QR, limpa a string armazenada (útil após conectar)
                    this.qrCodeString = null;
                }


                if (connection === 'close') {
                    this.isConnected = false;
                    this.qrCodeString = null; // Limpa a string do QR Code se a conexão fechar
                    const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                    if (shouldReconnect) {
                        console.error('❌ Conexão fechada, reconectando...');
                        setTimeout(() => this.iniciar(), 3000); // Reconexão mais rápida
                    } else {
                        console.error('❌ Deslogado. Reinicie e obtenha o código QR novamente.');
                         // Talvez limpar credenciais ou instruir o usuário
                         // fs.unlinkSync('baileys_auth_info/creds.json'); // Cuidado: isso apaga as credenciais!
                        process.exit(1);
                    }
                } else if (connection === 'open') {
                    console.log('✅ Bot conectado ao WhatsApp!');
                    this.botNumber = this.sock.user.id.split(':')[0];
                    console.log(`🔢 Número do bot: ${this.botNumber}`);
                    this.isConnected = true;
                    this.qrCodeString = null; // Limpa a string do QR Code ao conectar
                    this.startKeepAlive(); // Inicia o keep-alive após conexão
                }
            });

            this.sock.ev.on('creds.update', saveCreds);

            await new Promise(resolve => setTimeout(resolve, 5000));
            this.sock.ev.on('messages.upsert', (m) => this.processarMensagem(m));
        } catch (error) {
            console.error("❌ Erro ao iniciar Baileys:", error.message);
            setTimeout(() => this.iniciar(), 3000);
        }
    }

    startKeepAlive() {
        if (isKeepAliveRunning) return;
        isKeepAliveRunning = true;
        console.log("⏳ Iniciando keep-alive a cada 5 minutos...");
        setInterval(async () => {
            if (this.isConnected && this.sock) {
                try {
                    await this.sock.sendPresenceUpdate('available');
                    console.log("🔋 Keep-alive enviado ao WhatsApp.");
                    const isHealthy = await this.checkConnectionHealth();
                    if (!isHealthy) {
                        console.warn("⚠️ Conexão com WhatsApp instável, reiniciando...");
                        this.iniciar();
                    }
                } catch (error) {
                    console.error("❌ Erro no keep-alive:", error.message);
                    this.iniciar();
                }
            }
        }, KEEP_ALIVE_INTERVAL);
    }

    async checkConnectionHealth() {
        // Tenta enviar uma mensagem para si mesmo como teste de saúde
        try {
            // Enviando para o próprio número para não spammar
            const result = await this.sock.sendMessage(this.sock.user.id, { text: `Health check - ${new Date().toISOString()}` });
            // Verifica se a mensagem foi enviada com sucesso (retornou um resultado)
            return !!result;
        } catch (error) {
            console.error("❌ Falha na verificação de saúde da conexão:", error.message);
            return false;
        }
    }


    async simularDigitacao(chatId, minDelay = 700, maxDelay = 2000) {
        try {
            const typingDelay = Math.floor(Math.random() * (maxDelay - minDelay)) + minDelay;
            await this.sock.sendPresenceUpdate('composing', chatId);
            console.log(`⌨️ Simulando digitação por ${typingDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, typingDelay));
            await this.sock.sendPresenceUpdate('paused', chatId);
        } catch (error) {
            console.error("❌ Erro ao simular digitação:", error.message);
             // Adiciona um pequeno atraso mesmo em caso de erro para evitar floods
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    async isAuthorizedAdminCommand(senderNumber, command) {
        const isAuthorized = senderNumber === PRIVILEGED_NUMBER;
        console.log(`🔐 Verificando autorização: ${senderNumber} -> ${isAuthorized ? 'Autorizado' : 'Não autorizado'}`);
        return isAuthorized;
    }

    async adicionarReacao(chatId, messageId, reaction) {
        try {
            await this.sock.sendMessage(chatId, {
                react: {
                    text: reaction,
                    key: { id: messageId, remoteJid: chatId, fromMe: false } // Use fromMe: false para reagir a mensagens de outros
                }
            });
            console.log(`✅ Reação ${reaction} adicionada`);
        } catch (error) {
            console.error(`❌ Erro ao adicionar reação ${reaction}:`, error.message);
        }
    }

     // Método para obter o QR Code string
    getQrCodeString() {
        return this.qrCodeString;
    }


    detectarTomMensagem(body) {
        if (!body || typeof body !== 'string') return null;
        const lowerBody = body.toLowerCase();
        const funnyKeywords = ["kkk", "haha", "zoeira", "engraçado", "😂", "🤣", "lol", "😆"];
        const aggressiveKeywords = ["puta", "caralho", "fdp", "burro", "merda", "😡", "🤬", "👊"];
        const romanticKeywords = ["te amo", "gosto de ti", "😘", "lindo", "linda", "💕", "❤️", "💘"];

        const isFunny = funnyKeywords.some(keyword => lowerBody.includes(keyword));
        const isAggressive = aggressiveKeywords.some(keyword => lowerBody.includes(keyword));
        const isRomantic = romanticKeywords.some(keyword => lowerBody.includes(keyword));

        let jokeCount = 0;
        for (const { body: cachedBody } of messageCache.values()) {
            if (cachedBody && funnyKeywords.some(k => cachedBody.toLowerCase().includes(k))) {
                jokeCount++;
            }
        }
        const isConstantJokes = jokeCount > 2;

        if (isConstantJokes || isFunny) return "riso";
        if (isAggressive) return "raiva";
        if (isRomantic) return "romantico";
        return null;
    }

    async checkRenderHealth() {
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                console.log(`🔍 Verificando saúde do Render (${attempt}/${MAX_RETRIES})...`);
                const response = await axios.get(`${API_URL}/health`, { timeout: HEALTH_CHECK_TIMEOUT });
                if (response.status === 200 && response.data.status === "healthy") {
                    console.log("✅ Render está ativo e saudável!");
                    return true;
                }
                console.warn(`⚠️ Render não está saudável: ${JSON.stringify(response.data)}`);
            } catch (error) {
                console.error(`❌ Falha na verificação de saúde (${attempt}/${MAX_RETRIES}):`, {
                    message: error.message,
                    code: error.code,
                    response: error.response ? { status: error.response.status, data: error.response.data } : 'Nenhuma resposta'
                });
            }
            if (attempt < MAX_RETRIES) {
                console.log(`⏳ Aguardando ${RETRY_DELAY / 1000}s antes de tentar novamente...`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            }
        }
        console.error("❌ Render não está disponível após todas as tentativas.");
        return false;
    }

    async makeRequestWithRetry(url, data, timeout, method = 'POST') {
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                console.log(`📡 Enviando requisição ${method} para ${url} (${attempt}/${MAX_RETRIES})...`);
                const response = await axios({
                    method,
                    url,
                    data: method === 'POST' ? data : undefined,
                    timeout
                });
                console.log(`📥 Resposta recebida:`, response.data);
                return response;
            } catch (error) {
                console.error(`❌ Falha na requisição (${attempt}/${MAX_RETRIES}):`, {
                    message: error.message,
                    code: error.code,
                    response: error.response ? { status: error.response.status, data: error.response.data } : 'Nenhuma resposta'
                });
                if (attempt < MAX_RETRIES) {
                    console.log(`⏳ Aguardando ${RETRY_DELAY / 1000}s antes de tentar novamente...`);
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                }
            }
        }
        throw new Error('Todas as tentativas de requisição falharam.');
    }

    async processarMensagem(m) {
        try {
            const message = m.messages[0];
             // Adicionado verificação para ensure message.message exists
            if (!message || !message.message || message.key.fromMe) {
                 // Ignora mensagens vazias ou enviadas pelo próprio bot
                 return;
            }

            // Verifica se a mensagem é um tipo que queremos processar
            const messageContent = message.message.conversation || message.message.extendedTextMessage?.text || message.message.imageMessage || message.message.audioMessage || message.message.stickerMessage;
             if (!messageContent) {
                 console.log("🤷 Mensagem sem conteúdo processável.");
                 return;
             }


            const chatId = message.key.remoteJid;
            const sender = message.key.participant || message.key.remoteJid;
            const senderNumber = sender.split('@')[0];
            const senderName = message.pushName || senderNumber || 'Usuário';
            const isGroup = chatId.includes('@g.us');
             // Melhoria na detecção de menção ou chamada pelo nome
            const bodyText = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
            const lowerBody = bodyText.toLowerCase();
            const mentionedAkira = message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.includes(this.sock.user.id) || lowerBody.includes('akira') || lowerBody.startsWith('akira,') || lowerBody.startsWith('akira ');

            const isReply = !!message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const rawQuotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const quotedAuthor = message.message?.extendedTextMessage?.contextInfo?.participant;
            const isReplyToAkira = isReply && quotedAuthor && quotedAuthor.includes(this.botNumber);


            console.log(`[📩 MSG] ${senderName}: ${bodyText || '[mídia/outro]'} (${message.message?.type || 'unknown'})`);

             // Cache a mensagem original (texto ou outro identificador se possível)
            if (message.key.id && bodyText) { // Apenas cacheia se tiver ID e texto (para simplificar)
                messageCache.set(message.key.id, { body: bodyText, timestamp: Date.now() });
                console.log(`📥 Cache atualizado: ID=${message.key.id}, Body=${bodyText.slice(0, 50)}...`);
            }


            const body = bodyText; // Usamos bodyText agora

            if (body.startsWith('/')) {
                const [comando, ...args] = body.trim().split(' ');
                const adminCommands = ["/reset", "/remover", "/apagarmsg", "/adicionar"];
                if (adminCommands.includes(comando.toLowerCase())) {
                    const isAuthorized = await this.isAuthorizedAdminCommand(senderNumber, comando);
                    if (!isAuthorized) {
                        await this.simularDigitacao(chatId);
                        await this.sock.sendMessage(chatId, { text: "⚠ Apenas Isaac Quarenta pode executar comandos administrativos." });
                        await this.adicionarReacao(chatId, message.key.id, "❌");
                        return;
                    }

                    await this.simularDigitacao(chatId);

                    switch (comando.toLowerCase()) {
                        case "/reset":
                            if (!(await this.checkRenderHealth())) {
                                await this.sock.sendMessage(chatId, { text: "⚠ O servidor está indisponível no momento. Tente novamente mais tarde." });
                                return;
                            }
                            try {
                                const response = await this.makeRequestWithRetry(
                                    `${API_URL}/bot/reset`,
                                    {
                                        sender_number: senderNumber,
                                        group_id: isGroup ? chatId.split('@')[0] : null
                                    },
                                    REQUEST_TIMEOUT
                                );
                                await this.sock.sendMessage(chatId, { text: response?.data?.reply || "⚠ Erro ao resetar o contexto." });
                            } catch (error) {
                                await this.sock.sendMessage(chatId, { text: "⚠ Falha ao resetar o contexto. Tente novamente." });
                            }
                            break;
                        case "/remover":
                             if (!isGroup) {
                                 await this.sock.sendMessage(chatId, { text: "⚠ Este comando só pode ser usado em grupos." });
                                 return;
                             }
                             // Melhoria na extração do número
                            let participantArg = args[0] || '';
                            if (!participantArg) {
                                await this.sock.sendMessage(chatId, { text: "⚠ Informe o número ou menção (/remover @NUMERO)." });
                                return;
                            }
                            let participant = participantArg.replace(/[@\+]/g, '').replace(/[^0-9]/g, '');
                            if (!participant || participant.length < 8) { // Considera um mínimo de 8 dígitos para números locais sem DDI
                                await this.sock.sendMessage(chatId, { text: "⚠ Número inválido." });
                                return;
                            }
                            // Assume DDI 244 se não tiver '+'
                            if (!participantArg.startsWith('+')) {
                                // Tenta adivinhar se é um número angolano (9 digitos geralmente)
                                if (participant.length === 9) {
                                    participant = '244' + participant;
                                } else {
                                     await this.sock.sendMessage(chatId, { text: "⚠ Formato do número inválido. Use +DDI_DDD_NUMERO ou apenas o número (ex: 937035662, +244937035662)." });
                                     return;
                                }
                            }


                            participant += '@s.whatsapp.net';
                            const groupMetadata = await this.sock.groupMetadata(chatId);
                            const botIsAdmin = groupMetadata.participants.find(p => p.id.includes(this.botNumber))?.admin;
                            if (!botIsAdmin) {
                                await this.sock.sendMessage(chatId, { text: "⚠ Eu preciso ser administrador." });
                                return;
                            }
                             // Verifica se o participante a remover não é o próprio administrador principal
                             if (participant.split('@')[0] === PRIVILEGED_NUMBER) {
                                 await this.sock.sendMessage(chatId, { text: "🚫 Não posso remover meu próprio administrador." });
                                 return;
                             }

                             // Verifica se o participante está no grupo
                             const participantIsInGroup = groupMetadata.participants.some(p => p.id === participant);
                             if (!participantIsInGroup) {
                                 await this.sock.sendMessage(chatId, { text: `⚠ O número ${args[0]} não parece estar neste grupo.` });
                                 return;
                             }


                            await this.sock.groupParticipantsUpdate(chatId, [participant], 'remove')
                                .then(() => this.sock.sendMessage(chatId, { text: `✅ Membro (${args[0]}) removido!` }))
                                .catch(err => {
                                     console.error("Erro ao remover membro:", err);
                                     this.sock.sendMessage(chatId, { text: `⚠ Erro ao tentar remover (${args[0]}): ${err.message}` });
                                });
                            break;
                        case "/apagarmsg":
                            if (!isReply || !message.message?.extendedTextMessage?.contextInfo?.stanzaId) {
                                await this.sock.sendMessage(chatId, { text: "⚠ Responda à mensagem com /apagarmsg." });
                                return;
                            }
                            const messageKeyToDelete = {
                                remoteJid: chatId,
                                id: message.message.extendedTextMessage.contextInfo.stanzaId,
                                fromMe: false // Assumindo que a mensagem a ser apagada não é a do bot
                                 // participant: message.message.extendedTextMessage.contextInfo.participant // Pode ser necessário em grupos
                            };

                             // Se for um grupo, adicione o participant (quem enviou a msg original citada)
                             if (isGroup && message.message.extendedTextMessage.contextInfo.participant) {
                                 messageKeyToDelete.participant = message.message.extendedTextMessage.contextInfo.participant;
                             }

                             try {
                                  // Use deleteMessage em vez de chatModify clear para apagar mensagens específicas
                                 await this.sock.deleteMessage(chatId, messageKeyToDelete);
                                 await this.sock.sendMessage(chatId, { text: "✅ Mensagem apagada!" });
                             } catch (err) {
                                  console.error("Erro ao apagar mensagem:", err);
                                  await this.sock.sendMessage(chatId, { text: `⚠ Erro ao apagar mensagem: ${err.message}` });
                             }
                            break;
                        case "/adicionar":
                            if (!isGroup) {
                                await this.sock.sendMessage(chatId, { text: "⚠ Este comando só pode ser usado em grupos." });
                                return;
                            }
                            if (!args.length) {
                                await this.sock.sendMessage(chatId, { text: "⚠ Informe o número (/adicionar NUMERO)." });
                                return;
                            }
                             // Melhoria na extração do número (mesma lógica do remover)
                            let newParticipantArg = args[0] || '';
                             if (!newParticipantArg) {
                                 await this.sock.sendMessage(chatId, { text: "⚠ Informe o número (/adicionar NUMERO)." });
                                 return;
                             }
                            let newParticipantNumber = newParticipantArg.replace(/[@\+]/g, '').replace(/[^0-9]/g, '');
                            if (!newParticipantNumber || newParticipantNumber.length < 8) {
                                await this.sock.sendMessage(chatId, { text: "⚠ Número inválido." });
                                return;
                            }
                             if (!newParticipantArg.startsWith('+')) {
                                if (newParticipantNumber.length === 9) {
                                    newParticipantNumber = '244' + newParticipantNumber;
                                } else {
                                     await this.sock.sendMessage(chatId, { text: "⚠ Formato do número inválido. Use +DDI_DDD_NUMERO ou apenas o número (ex: 937035662, +244937035662)." });
                                     return;
                                }
                             }
                             let newParticipantJid = newParticipantNumber + '@s.whatsapp.net';

                            const groupChat = await this.sock.groupMetadata(chatId);
                            if (!groupChat.participants.find(p => p.id.includes(this.botNumber))?.admin) {
                                await this.sock.sendMessage(chatId, { text: "⚠ Eu preciso ser administrador." });
                                return;
                            }

                             // Verifica se o participante já está no grupo
                             const participantAlreadyInGroup = groupChat.participants.some(p => p.id === newParticipantJid);
                             if (participantAlreadyInGroup) {
                                 await this.sock.sendMessage(chatId, { text: `⚠ O número ${args[0]} já está neste grupo.` });
                                 return;
                             }

                            await this.sock.groupParticipantsUpdate(chatId, [newParticipantJid], 'add')
                                .then(() => this.sock.sendMessage(chatId, { text: `✅ Membro (${args[0]}) adicionado!` }))
                                .catch(err => {
                                     console.error("Erro ao adicionar membro:", err);
                                     this.sock.sendMessage(chatId, { text: `⚠ Erro ao tentar adicionar (${args[0]}): ${err.message}. Certifique-se de que o número é válido e não tem configurações de privacidade impedindo a adição.` });
                                });
                            break;
                    }
                    return; // Comando administrativo processado
                }
            }

             // Lógica para responder apenas em PV, menções ou replies
            if (isGroup && !mentionedAkira && !isReplyToAkira) {
                console.log("📵 Mensagem em grupo ignorada (sem menção ou reply).");
                return;
            }

            if (!senderNumber) {
                console.error("❌ SenderNumber inválido.");
                await this.sock.sendMessage(chatId, { text: '⚠ Erro: Número inválido.' });
                return;
            }

            let quotedMsg = null;
            if (isReply && rawQuotedMsg) {
                const quotedMsgId = message.message?.extendedTextMessage?.contextInfo?.stanzaId || 'unknown';
                // Tenta obter o corpo da mensagem citada do cache primeiro
                let quotedMsgBody = messageCache.has(quotedMsgId) ? messageCache.get(quotedMsgId).body : null;

                 // Se não achou no cache, tenta obter do quotedMessage (pode vir vazio às vezes)
                 if (!quotedMsgBody) {
                     quotedMsgBody = message.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation ||
                                     message.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text ||
                                     '[Mensagem citada - tipo não suportado ou não cacheado]';
                 }

                quotedMsg = { id: quotedMsgId, body: quotedMsgBody, author: quotedAuthor };
                console.log(`🔍 Quoted_msg: ID=${quotedMsgId}, Body=${quotedMsgBody.slice(0, 50)}..., Author=${quotedAuthor}`);
            }

            await this.simularDigitacao(chatId);

            try {
                let botReply;
                // Respostas pré-definidas para interações específicas
                if (isReply && quotedMsg) {
                    const currentLower = body.toLowerCase();
                    const quotedLower = quotedMsg.body.toLowerCase();

                    if (currentLower.includes("sobre o quê") && (quotedLower.includes("não entendi") || quotedLower.includes("nem entendi"))) {
                        // Lógica para encontrar a mensagem anterior no cache
                        let previousMsg = null;
                        let foundQuoted = false;
                        // Iterar sobre as chaves do cache para encontrar a mensagem anterior
                        const cachedMessageKeys = Array.from(messageCache.keys());
                        const quotedIndex = cachedMessageKeys.indexOf(quotedMsg.id);

                        if (quotedIndex > 0) {
                             // A mensagem anterior no cache é a que está no índice quotedIndex - 1
                             const previousMsgKey = cachedMessageKeys[quotedIndex - 1];
                             previousMsg = messageCache.get(previousMsgKey)?.body;
                        }


                        botReply = previousMsg ?
                            `Mano ${senderName}, tava falando sobre "${previousMsg}". Não pegou? Posso mandar de novo de outro jeito!` :
                            `Mano ${senderName}, não achei o que tava rolando antes no cache. Me dá uma luz do que tu não entendeu?`; // Melhorar a msg caso não encontre
                    } else if (currentLower.includes("não entendi") || currentLower.includes("nem entendi")) {
                        botReply = `Desculpa aí, ${senderName}! Tô vendo que tu não entendeu "${quotedMsg.body}". Quer que eu explique de outra forma?`;
                    } else if (currentLower.includes("tem mais ideias?") || currentLower.includes("mais ideias?")) {
                         // Simulação de gerar mais ideias baseado na citada
                        const ideas = quotedMsg.body.split(' ').filter(word => word.length > 3).join(' '); // Exemplo simples
                        botReply = `Claro, ${senderName}! Além de "${quotedMsg.body}", pensando na vibe de "${ideas}", que tal "AkiraPro" ou "AkiVibe"? Qual tu curte mais?`;
                    }
                }

                 // Se não houve resposta pré-definida, chama a API
                if (!botReply) {
                    if (!(await this.checkRenderHealth())) {
                        await this.sock.sendMessage(chatId, { text: "⚠ O servidor está indisponível no momento. Tente novamente mais tarde." });
                        return;
                    }

                    const response = await this.makeRequestWithRetry(
                        `${API_URL}/bot`,
                        {
                            message: body,
                            sender: senderName,
                            sender_number: senderNumber,
                            is_group: isGroup,
                            mentioned: mentionedAkira,
                            replied_to_akira: isReplyToAkira,
                            quoted_msg: quotedMsg ? JSON.stringify(quotedMsg) : null // Envia quoted_msg como string JSON
                        },
                        REQUEST_TIMEOUT
                    );
                     // Garante que a resposta tem um texto antes de enviar
                    botReply = response.data?.reply || '⚠ Não consegui processar sua mensagem. Tenta de novo!';
                }

                 // Envia a resposta
                const sentMessage = (isGroup || isReply) ?
                    await this.sock.sendMessage(chatId, { text: botReply }, { quoted: message }) : // Responde citando a mensagem original se for grupo ou reply
                    await this.sock.sendMessage(chatId, { text: botReply }); // Envia mensagem direta em PV sem citar por padrão

                 // Salvar WhatsApp ID da mensagem enviada pelo bot (opcional)
                if (sentMessage?.key?.id && botReply && botReply !== '⚠ Não consegui processar sua mensagem. Tenta de novo!') { // Apenas salva respostas bem-sucedidas
                     if (!(await this.checkRenderHealth())) {
                         console.warn("⚠️ Servidor indisponível para salvar WhatsApp ID. Pulando...");
                     } else {
                         try {
                             await this.makeRequestWithRetry(
                                 `${API_URL}/bot/save-whatsapp-id`,
                                 {
                                     whatsapp_id: sentMessage.key.id,
                                     message: body, // Mensagem original do usuário
                                     reply: botReply, // Resposta do bot
                                     sender_number: senderNumber // Número do usuário que iniciou a interação
                                 },
                                 REQUEST_TIMEOUT
                             );
                         } catch (error) {
                             console.error("❌ Erro ao salvar WhatsApp ID:", error.message);
                         }
                     }
                 }


                 // Reação automática com base no tom (opcional)
                const tom = this.detectarTomMensagem(body);
                if (tom && message.key.id) { // Garante que a mensagem tem um ID para reagir
                    const reactions = {
                        riso: ["😂", "🤣", "😆"],
                        raiva: ["🤬", "👊", "😡"],
                        romantico: ["💕", "❤️", "💘"]
                    };
                    const reaction = reactions[tom][Math.floor(Math.random() * reactions[tom].length)];
                    await this.adicionarReacao(chatId, message.key.id, reaction);
                }

            } catch (error) {
                console.error("❌ Falha na API ou ao enviar mensagem:", error.message);
                 // Envia uma mensagem de erro mais amigável para o usuário
                await this.sock.sendMessage(chatId, { text: '⚠ Ops! Tive um problema ao processar sua solicitação. Tente novamente mais tarde.' });
            }
        } catch (errogeral) {
            console.error('❌ Falha geral no processamento da mensagem:', {
                message: errogeral.message,
                stack: errogeral.stack
            });
             // Pode enviar uma mensagem de erro genérica para o usuário se o erro for crítico antes de tentar responder
            const chatId = errogeral.messages?.[0]?.key?.remoteJid;
            if(chatId) {
                 await this.sock.sendMessage(chatId, { text: '⚠ Ocorreu um erro inesperado. A equipe técnica foi notificada.' });
            }
        }
    }
}

async function startBot() {
    try {
        const bot = new Bot();
        await bot.iniciar();
        return bot;
    } catch (error) {
        console.error('❌ Erro ao criar bot:', {
            message: error.message,
            stack: error.stack
        });
        throw error;
    }
}

const app = express();
let botInstance;

// Adicionando a rota /healthz
app.get('/healthz', (req, res) => {
    if (botInstance && botInstance.isConnected) {
        res.status(200).send('Healthy');
    } else {
        res.status(503).send('Service Unavailable');
    }
});

// NOVA ROTA para obter a string do QR Code
app.get('/get-qr-string', (req, res) => {
    if (botInstance && botInstance.getQrCodeString()) {
         // Retorna a string do QR code em um formato JSON
        res.status(200).json({ qrCode: botInstance.getQrCodeString() });
    } else if (botInstance && botInstance.isConnected) {
         // Se estiver conectado, não há QR code mais
        res.status(200).json({ status: 'connected', message: 'Bot já conectado. QR Code não disponível.' });
    }
    else {
        // QR code ainda não disponível ou erro
        res.status(404).json({ status: 'not_available', message: 'QR Code não gerado ou expirou. Aguarde alguns segundos e tente novamente, ou verifique os logs.' });
    }
});

// REMOVEMOS a rota /qrcode que servia a imagem

// Atualiza a rota principal para instruir o usuário
app.get('/', (req, res) => {
    const status = botInstance ? (botInstance.isConnected ? 'Conectado' : 'Aguardando QR Code') : 'Iniciando...';
    const qrInstructions = botInstance && botInstance.qrCodeString ?
        '<p>Obtenha a string do QR Code acessando o endpoint: <a href="/get-qr-string">/get-qr-string</a></p><p>Use essa string para escanear o QR Code em seu aplicativo ou ferramenta de escaneamento.</p>' :
        '<p>Aguarde a geração do QR Code. Pode levar alguns segundos após a inicialização.</p>';

    res.send(`
        <h1>Status do Akira Bot</h1>
        <p>Status atual: ${status}</p>
        ${qrInstructions}
        <p>Verifique os logs para mais detalhes.</p>
        <p>Para verificar a saúde do serviço: <a href="/healthz">/healthz</a></p>
    `);
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 Servidor Express rodando na porta ${PORT}.`);
    console.log(`🩺 Endpoint de saúde: http://localhost:${PORT}/healthz`);
    console.log(`🔑 Endpoint do QR Code string: http://localhost:${PORT}/get-qr-string`);
    console.log(`📄 Página inicial: http://localhost:${PORT}/`);
});

if (require.main === module) {
    startBot().then(bot => {
        botInstance = bot;
    }).catch(error => {
        console.error('❌ Falha ao iniciar o bot principal:', {
            message: error.message,
            stack: error.stack
        });
        process.exit(1);
    });
}

module.exports = { startBot };
