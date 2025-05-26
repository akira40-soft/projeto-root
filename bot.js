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
const qrcode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');
const express = require('express');
const path = require('path');

let API_URL;
try {
    const config = require('./config');
    API_URL = config.API_URL || "https://flask-ybtc.onrender.com";
    console.log("[INFO] API_URL configurada: " + API_URL);
} catch (error) {
    console.error("[ERRO] Arquivo 'config.js' não encontrado ou inválido: " + error.message);
    process.exit(1);
}

// Cache para mensagens recentes
const messageCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos
const MAX_CACHE_SIZE = 100;
const PRIVILEGED_NUMBER = "244937035662";

// Timeout e configuração de retry otimizada para Render
const REQUEST_TIMEOUT = 120000; // 2 minutos (Render pode ser lento na primeira requisição)
const HEALTH_CHECK_TIMEOUT = 60000; // 1 minuto
const MAX_RETRIES = 2; // 2 tentativas
const RETRY_DELAY = 5000; // 5 segundos

// Keep-alive e monitoramento
const KEEP_ALIVE_INTERVAL = 5 * 60 * 1000; // 5 minutos
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
        const oldestKey = messageCache.keys().next().value;
        messageCache.delete(oldestKey);
    }
    console.log("[INFO] Cache limpo. Tamanho atual: " + messageCache.size);
}
setInterval(cleanCache, 60000); // Limpa a cada minuto

class Bot {
    constructor() {
        this.sock = null;
        this.botNumber = null;
        this.qrCodePath = null;
        this.qrCodeString = null;
        this.isConnected = false;
    }

    async iniciar() {
        console.log("[INFO] Iniciando Baileys...");
        try {
            const { version } = await fetchLatestBaileysVersion();
            console.log("[INFO] Usando Baileys versão: " + version.join('.'));

            const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info');
            this.sock = makeWASocket({
                version,
                auth: state,
                printQRInTerminal: false,
                syncFullHistory: false,
                markOnlineOnConnect: false,
            });

            this.sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;
                console.log("[INFO] Estado da conexão: " + connection);

                if (qr && !this.isConnected) {
                    this.qrCodeString = qr;
                    console.log("[INFO] Gerando QR Code para escaneamento...");
                    qrcodeTerminal.generate(qr, {
                        small: true,
                        white: " ",
                        black: "█",
                        scale: 0.8
                    });
                    console.log("\n[INFO] Escaneie o QR Code acima com seu telefone ou use o código abaixo manualmente:");
                    console.log("[INFO] Código do QR Code (para entrada manual): " + qr);
                    console.log("[INFO] Instruções: No WhatsApp, vá para 'Configurações' > 'Dispositivos Vinculados' > 'Vincular com Número' e insira o código acima.");
                    console.log("[INFO] Dica: Ajuste o zoom no seu telefone para escanear o QR Code, se preferir.");

                    this.qrCodePath = path.join(__dirname, 'qr_code.png');
                    await qrcode.toFile(this.qrCodePath, qr, {
                        width: 300,
                        height: 300,
                        margin: 1,
                        color: { dark: '#000000', light: '#FFFFFF' }
                    })
                        .then(() => console.log("[INFO] QR Code salvo em: " + this.qrCodePath + ". Escaneie com seu telefone ou use o código!"))
                        .catch(err => console.error("[ERRO] Erro ao salvar QR Code: " + err));
                }

                if (connection === 'close') {
                    this.isConnected = false;
                    const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                    if (shouldReconnect) {
                        console.error('[ERRO] Conexão fechada, reconectando...');
                        setTimeout(() => this.iniciar(), 3000);
                    } else {
                        console.error('[ERRO] Deslogado. Reinicie e escaneie o QR code ou insira o código novamente.');
                        process.exit(1);
                    }
                } else if (connection === 'open') {
                    console.log('[INFO] Bot conectado ao WhatsApp!');
                    this.botNumber = this.sock.user.id.split(':')[0];
                    console.log("[INFO] Número do bot: " + this.botNumber);
                    this.isConnected = true;
                    
                    // Limpar QR Code após conexão estabelecida
                    this.qrCodeString = null;
                    if (this.qrCodePath && fs.existsSync(this.qrCodePath)) {
                        try {
                            fs.unlinkSync(this.qrCodePath);
                            console.log("[INFO] QR Code removido após autenticação bem-sucedida.");
                        } catch (error) {
                            console.error("[ERRO] Erro ao remover QR Code: " + error.message);
                        }
                    }
                    this.qrCodePath = null;
                    
                    this.startKeepAlive();
                }
            });

            this.sock.ev.on('creds.update', saveCreds);

            await new Promise(resolve => setTimeout(resolve, 5000));
            this.sock.ev.on('messages.upsert', (m) => this.processarMensagem(m));
        } catch (error) {
            console.error("[ERRO] Erro ao iniciar Baileys: " + error.message);
            console.error("[ERRO] Stack trace: " + error.stack);
            console.log("[INFO] Aguardando 5s antes de reconectar...");
            setTimeout(() => this.iniciar(), 5000);
        }
    }

    startKeepAlive() {
        if (isKeepAliveRunning) return;
        isKeepAliveRunning = true;
        console.log("[INFO] Iniciando keep-alive a cada 5 minutos...");
        setInterval(async () => {
            if (this.isConnected && this.sock) {
                try {
                    await this.sock.sendPresenceUpdate('available');
                    console.log("[INFO] Keep-alive enviado ao WhatsApp.");
                    const isHealthy = await this.checkConnectionHealth();
                    if (!isHealthy) {
                        console.warn("[AVISO] Conexão com WhatsApp instável, reiniciando...");
                        this.iniciar();
                    }
                } catch (error) {
                    console.error("[ERRO] Erro no keep-alive: " + error.message);
                    this.iniciar();
                }
            }
        }, KEEP_ALIVE_INTERVAL);
    }

    async checkConnectionHealth() {
        try {
            const result = await this.sock.sendMessage(this.sock.user.id, { text: 'Ping' });
            return !!result;
        } catch (error) {
            console.error("[ERRO] Falha na verificação de saúde da conexão: " + error.message);
            return false;
        }
    }

    async simularDigitacao(chatId, minDelay = 700, maxDelay = 2000) {
        try {
            const typingDelay = Math.floor(Math.random() * (maxDelay - minDelay)) + minDelay;
            await this.sock.sendPresenceUpdate('composing', chatId);
            console.log("[INFO] Simulando digitação por " + typingDelay + "ms...");
            await new Promise(resolve => setTimeout(resolve, typingDelay));
            await this.sock.sendPresenceUpdate('paused', chatId);
        } catch (error) {
            console.error("[ERRO] Erro ao simular digitação: " + error.message);
            await new Promise(resolve => setTimeout(resolve, typingDelay));
        }
    }

    async isAuthorizedAdminCommand(senderNumber, command) {
        const isAuthorized = senderNumber === PRIVILEGED_NUMBER;
        console.log("[INFO] Verificando autorização: " + senderNumber + " -> " + (isAuthorized ? 'Autorizado' : 'Não autorizado'));
        return isAuthorized;
    }

    async adicionarReacao(chatId, messageId, reaction) {
        try {
            await this.sock.sendMessage(chatId, {
                react: {
                    text: reaction,
                    key: { id: messageId, remoteJid: chatId, fromMe: false }
                }
            });
            console.log("[INFO] Reação " + reaction + " adicionada");
        } catch (error) {
            console.error("[ERRO] Erro ao adicionar reação " + reaction + ": " + error.message);
        }
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
        try {
            console.log("[INFO] Verificando saúde do servidor Render...");
            const response = await axios.get(API_URL + "/health", { 
                timeout: HEALTH_CHECK_TIMEOUT,
                headers: { 
                    'User-Agent': 'Akira-Bot-Health-Check',
                    'Accept': 'application/json, text/plain, */*'
                }
            });
            
            if (response.status === 200) {
                console.log("[INFO] ✅ Servidor Render está saudável! Resposta: " + JSON.stringify(response.data));
                return true;
            }
            console.warn("[AVISO] Servidor respondeu com status " + response.status + ": " + JSON.stringify(response.data));
            return false;
        } catch (error) {
            if (error.code === 'ECONNABORTED') {
                console.error("[ERRO] Timeout na verificação de saúde do Render (pode estar inicializando)");
            } else {
                console.error("[ERRO] Erro na verificação do Render: " + error.message);
            }
            return false;
        }
    }

    async makeRequestWithRetry(url, data, timeout, method = 'POST') {
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                console.log("[INFO] Enviando requisição " + method + " para " + url + " (" + attempt + "/" + MAX_RETRIES + ") - Timeout: " + (timeout/1000) + "s");
                const startTime = Date.now();
                const response = await axios({
                    method,
                    url,
                    data: method === 'POST' ? data : undefined,
                    timeout,
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'Akira-Bot/1.0'
                    }
                });
                const duration = Date.now() - startTime;
                console.log("[INFO] ✅ Resposta recebida em " + duration + "ms: " + JSON.stringify(response.data).slice(0, 100) + "...");
                return response;
            } catch (error) {
                const errorType = error.code === 'ECONNABORTED' ? 'TIMEOUT' : 
                                 error.response?.status ? 'HTTP_' + error.response.status : 'NETWORK';
                console.error("[ERRO] Falha " + errorType + " (" + attempt + "/" + MAX_RETRIES + "): " + error.message);
                if (attempt < MAX_RETRIES) {
                    console.log("[INFO] Aguardando " + (RETRY_DELAY / 1000) + "s antes de tentar novamente...");
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                }
            }
        }
        throw new Error('Todas as tentativas de requisição falharam.');
    }

    async processarMensagem(m) {
        try {
            const message = m.messages[0];
            if (!message.key.fromMe && message.message) {
                const chatId = message.key.remoteJid;
                const sender = message.key.participant || message.key.remoteJid;
                const senderNumber = sender.split('@')[0];
                const senderName = message.pushName || senderNumber || 'Usuário';
                const isGroup = chatId.includes('@g.us');
                
                // Extrair texto da mensagem (melhorar detecção para replies)
                const messageText = message.message?.conversation || 
                                  message.message?.extendedTextMessage?.text || 
                                  message.message?.imageMessage?.caption ||
                                  message.message?.videoMessage?.caption ||
                                  '';
                
                console.log("[DEBUG] Estrutura da mensagem:", {
                    conversation: !!message.message?.conversation,
                    extendedText: !!message.message?.extendedTextMessage,
                    imageMessage: !!message.message?.imageMessage,
                    videoMessage: !!message.message?.videoMessage,
                    messageText: messageText,
                    messageKeys: Object.keys(message.message || {})
                });
                
                // Verificar se Akira foi mencionado via @
                const mentionedJid = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                const isMentionedViaAt = mentionedJid.includes(this.sock.user.id);
                
                // Verificar se o nome "akira" foi citado no texto (case insensitive)
                const messageTextLower = messageText.toLowerCase();
                const isCalledByName = messageTextLower.includes('akira');
                
                // Combinar ambas as formas de menção
                const mentionedAkira = isMentionedViaAt || isCalledByName;
                
                // Verificar se é um reply
                const isReply = !!message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                const rawQuotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                const quotedAuthor = message.message?.extendedTextMessage?.contextInfo?.participant;
                
                // Verificar se é reply para uma mensagem do Akira
                const isReplyToAkira = isReply && quotedAuthor && quotedAuthor.includes(this.botNumber);
                
                console.log("[DEBUG] Análise de grupo:");
                console.log("  - É grupo:", isGroup);
                console.log("  - Mencionado via @:", isMentionedViaAt);
                console.log("  - Chamado por nome:", isCalledByName);
                console.log("  - É reply:", isReply);
                console.log("  - É reply para Akira:", isReplyToAkira);
                console.log("  - Deve responder:", !isGroup || mentionedAkira || isReplyToAkira);
                console.log("  - Texto extraído:", messageText);

                // Verificar se é uma mensagem de texto válida (melhor detecção)
                const isTextMessage = messageText && messageText.trim().length > 0;
                // Verificar mídia sem texto (só mídia pura)
                const isMediaOnly = !!(message.message?.imageMessage && !message.message.imageMessage.caption) || 
                                   !!(message.message?.audioMessage) || 
                                   !!(message.message?.stickerMessage) ||
                                   !!(message.message?.videoMessage && !message.message.videoMessage.caption) ||
                                   !!(message.message?.documentMessage);

                const groupInfo = isGroup ? ` [GRUPO]` : ` [PRIVADO]`;
                
                let messageType = 'desconhecido';
                if (isTextMessage) messageType = 'texto';
                else if (isMediaOnly) messageType = 'mídia_pura';
                else if (message.message?.imageMessage || message.message?.videoMessage) messageType = 'mídia_com_caption';
                
                console.log("[MSG]" + groupInfo + " " + senderName + ": " + (messageText || '[mídia sem texto]') + " (tipo: " + messageType + ")");

                // Ignorar apenas mídia SEM texto (mídia pura)
                if (isMediaOnly) {
                    console.log("[INFO] Mensagem de mídia pura ignorada (sem texto/caption).");
                    return;
                }
                
                // Se não tem texto válido, ignorar
                if (!isTextMessage) {
                    console.log("[INFO] Mensagem sem texto válido ignorada.");
                    return;
                }

                if (message.key.id) {
                    messageCache.set(message.key.id, { body: messageText, timestamp: Date.now() });
                    console.log("[INFO] Cache atualizado: ID=" + message.key.id + ", Body=" + messageText.slice(0, 50) + "...");
                }

                const body = messageText;
                if (body.startsWith('/')) {
                    const [comando, ...args] = body.trim().split(' ');
                    const adminCommands = ["/reset", "/remover", "/apagarmsg", "/adicionar"];
                    if (adminCommands.includes(comando.toLowerCase())) {
                        const isAuthorized = await this.isAuthorizedAdminCommand(senderNumber, comando);
                        if (!isAuthorized) {
                            await this.simularDigitacao(chatId);
                            await this.sock.sendMessage(chatId, { text: "[AVISO] Apenas Isaac Quarenta pode executar comandos administrativos." });
                            await this.adicionarReacao(chatId, message.key.id, "❌");
                            return;
                        }

                        await this.simularDigitacao(chatId);

                        switch (comando.toLowerCase()) {
                            case "/reset":
                                if (!(await this.checkRenderHealth())) {
                                    await this.sock.sendMessage(chatId, { text: "[AVISO] O servidor está indisponível no momento. Tente novamente mais tarde." });
                                    return;
                                }
                                try {
                                    const response = await this.makeRequestWithRetry(
                                        API_URL + "/bot/reset",
                                        {
                                            sender_number: senderNumber,
                                            group_id: isGroup ? chatId.split('@')[0] : null
                                        },
                                        REQUEST_TIMEOUT
                                    );
                                    await this.sock.sendMessage(chatId, { text: response?.data?.reply || "[AVISO] Erro ao resetar o contexto." });
                                } catch (error) {
                                    await this.sock.sendMessage(chatId, { text: "[AVISO] Falha ao resetar o contexto. Tente novamente." });
                                }
                                break;
                            case "/remover":
                                if (!isGroup) {
                                    await this.sock.sendMessage(chatId, { text: "[AVISO] Este comando só pode ser usado em grupos." });
                                    return;
                                }
                                if (!args.length) {
                                    await this.sock.sendMessage(chatId, { text: "[AVISO] Informe o número ou menção (/remover @NUMERO)." });
                                    return;
                                }
                                let participant = args[0].replace(/[@\+]/g, '').replace(/[^0-9]/g, '');
                                if (!participant || participant.length < 9) {
                                    await this.sock.sendMessage(chatId, { text: "[AVISO] Número inválido." });
                                    return;
                                }
                                participant += '@s.whatsapp.net';
                                const groupMetadata = await this.sock.groupMetadata(chatId);
                                const botIsAdmin = groupMetadata.participants.find(p => p.id.includes(this.botNumber))?.admin;
                                if (!botIsAdmin) {
                                    await this.sock.sendMessage(chatId, { text: "[AVISO] Eu preciso ser administrador." });
                                    return;
                                }
                                await this.sock.groupParticipantsUpdate(chatId, [participant], 'remove')
                                    .then(() => this.sock.sendMessage(chatId, { text: "[INFO] Membro (" + args[0] + ") removido!" }))
                                    .catch(err => this.sock.sendMessage(chatId, { text: "[AVISO] Erro: " + err.message }));
                                break;
                            case "/apagarmsg":
                                if (!isReply || !message.message?.extendedTextMessage?.contextInfo?.stanzaId) {
                                    await this.sock.sendMessage(chatId, { text: "[AVISO] Responda à mensagem com /apagarmsg." });
                                    return;
                                }
                                const messageIdToDelete = message.message.extendedTextMessage.contextInfo.stanzaId;
                                await this.sock.chatModify({ clear: { messages: [{ id: messageIdToDelete, fromMe: false }] } }, chatId)
                                    .then(() => this.sock.sendMessage(chatId, { text: "[INFO] Mensagem apagada!" }))
                                    .catch(err => this.sock.sendMessage(chatId, { text: "[AVISO] Erro: " + err.message }));
                                break;
                            case "/adicionar":
                                if (!isGroup) {
                                    await this.sock.sendMessage(chatId, { text: "[AVISO] Este comando só pode ser usado em grupos." });
                                    return;
                                }
                                if (!args.length) {
                                    await this.sock.sendMessage(chatId, { text: "[AVISO] Informe o número (/adicionar NUMERO)." });
                                    return;
                                }
                                let newParticipant = args[0].replace(/[@\+]/g, '').replace(/[^0-9]/g, '') + '@s.whatsapp.net';
                                const groupChat = await this.sock.groupMetadata(chatId);
                                if (!groupChat.participants.find(p => p.id.includes(this.botNumber))?.admin) {
                                    await this.sock.sendMessage(chatId, { text: "[AVISO] Eu preciso ser administrador." });
                                    return;
                                }
                                await this.sock.groupParticipantsUpdate(chatId, [newParticipant], 'add')
                                    .then(() => this.sock.sendMessage(chatId, { text: "[INFO] Membro (" + args[0] + ") adicionado!" }))
                                    .catch(err => this.sock.sendMessage(chatId, { text: "[AVISO] Erro: " + err.message }));
                                break;
                        }
                        return;
                    }
                }

                // Em grupos, só responder se foi mencionado, chamado pelo nome ou é reply para o Akira
                if (isGroup && !mentionedAkira && !isReplyToAkira) {
                    console.log("[INFO] Mensagem em grupo ignorada - não foi chamado/mencionado/reply.");
                    return;
                }
                
                // Se foi chamado/mencionado em grupo, informar que vai responder
                if (isGroup && (mentionedAkira || isReplyToAkira)) {
                    console.log("[INFO] Respondendo em grupo - foi " + 
                               (isMentionedViaAt ? "mencionado(@)" : "") +
                               (isCalledByName ? "chamado(nome)" : "") +
                               (isReplyToAkira ? "reply" : ""));
                }

                if (!senderNumber) {
                    console.error("[ERRO] SenderNumber inválido.");
                    await this.sock.sendMessage(chatId, { text: '[ERRO] Número inválido.' });
                    return;
                }

                let quotedMsg = null;
                if (isReply && rawQuotedMsg) {
                    const quotedMsgId = message.message?.extendedTextMessage?.contextInfo?.stanzaId || 'unknown';
                    let quotedMsgBody = message.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation || '';
                    if (!quotedMsgBody && messageCache.has(quotedMsgId)) {
                        quotedMsgBody = messageCache.get(quotedMsgId).body || 'Mensagem citada não disponível.';
                    }
                    quotedMsg = { id: quotedMsgId, body: quotedMsgBody, author: quotedAuthor };
                    console.log("[INFO] Quoted_msg: ID=" + quotedMsgId + ", Body=" + quotedMsgBody.slice(0, 50) + "..., Author=" + quotedAuthor);
                }

                await this.simularDigitacao(chatId);

                try {
                    let botReply;
                    if (isReply && quotedMsg) {
                        const currentLower = body.toLowerCase();
                        const quotedLower = quotedMsg.body.toLowerCase();

                        if (currentLower.includes("sobre o quê") && (quotedLower.includes("não entendi") || quotedLower.includes("nem entendi"))) {
                            let previousMsg = null;
                            let foundQuoted = false;
                            for (const [id, data] of messageCache.entries()) {
                                if (id === quotedMsg.id) {
                                    foundQuoted = true;
                                    continue;
                                }
                                if (foundQuoted) {
                                    previousMsg = data.body;
                                    break;
                                }
                            }
                            botReply = previousMsg ?
                                "Mano " + senderName + ", tava falando sobre \"" + previousMsg + "\". Não pegou? Posso mandar de novo de outro jeito!" :
                                "Mano " + senderName + ", não achei o que tava rolando antes. Me dá uma luz do que tu não entendeu?";
                        } else if (currentLower.includes("não entendi") || currentLower.includes("nem entendi")) {
                            botReply = "Desculpa aí, " + senderName + "! Tô vendo que tu não entendeu \"" + quotedMsg.body + "\". Quer que eu explique de outra forma?";
                        } else if (currentLower.includes("temais ideias?") || currentLower.includes("mais ideias?")) {
                            botReply = "Claro, " + senderName + "! Além de \"" + quotedMsg.body + "\", que tal \"AkiraPro\" ou \"AkiVibe\"? Qual tu curte mais?";
                        }
                    }

                    if (!botReply) {
                        // Implementar fallbacks locais para respostas básicas
                        const bodyLower = body.toLowerCase();
                        const basicResponses = {
                            'oi': "Orroh " + senderName + "! Tudo na paz? Em que posso ajudar?",
                            'oie': "Orroh " + senderName + "! Tudo na paz? Em que posso ajudar?",
                            'olá': "Eaí " + senderName + "! Como que tá? No que posso dar uma força?",
                            'ola': "Salve " + senderName + "! Beleza? Como posso ajudar?",
                            'como vai': "Aqui tô suave, " + senderName + "! E você, como tá?",
                            'tudo bem': "Tudo certo por aqui! E aí, " + senderName + ", como você tá?",
                            'sim': "Show, " + senderName + "! Em que mais posso te ajudar?",
                            'não': "Tranquilo, " + senderName + "! Se mudar de ideia, só chamar!",
                            'obrigado': "Tmj " + senderName + "! Sempre que precisar, só chamar!",
                            'obrigada': "Tmj " + senderName + "! Sempre que precisar, só chamar!",
                            'valeu': "Disponha, " + senderName + "! Tô aqui pra isso mesmo!",
                            'tchau': "Falou " + senderName + "! Até mais, mano!",
                            'bye': "Falou " + senderName + "! Até mais!",
                            'akira': "Opa " + senderName + "! Sou a Akira, sua assistente! Como posso ajudar?",
                            'akira como vai': "Tô firme e forte, " + senderName + "! Pronto pra ajudar no que precisar!",
                            'quem é você': "Eu sou a Akira, " + senderName + "! Sua assistente virtual. Posso te ajudar com várias coisas!",
                            'beleza': "Massa, " + senderName + "! Qual é a boa?",
                            'legal': "Show de bola, " + senderName + "! No que posso ajudar?",
                            'boa tarde': "Boa tarde, " + senderName + "! Como posso te ajudar hoje?",
                            'boa noite': "Boa noite, " + senderName + "! No que posso dar uma força?",
                            'bom dia': "Bom dia, " + senderName + "! Tudo certinho? Como posso ajudar?"
                        };

                        // Verificar respostas básicas primeiro
                        for (const [keyword, response] of Object.entries(basicResponses)) {
                            if (bodyLower.includes(keyword)) {
                                botReply = response;
                                break;
                            }
                        }

                        // Se não há resposta básica, tentar o servidor
                        if (!botReply) {
                            try {
                                console.log("[INFO] Enviando para servidor Flask (Render)...");
                                const response = await this.makeRequestWithRetry(
                                    API_URL + "/bot",
                                    {
                                        message: body,
                                        sender: senderName,
                                        sender_number: senderNumber,
                                        is_group: isGroup,
                                        mentioned: mentionedAkira,
                                        replied_to_akira: isReplyToAkira,
                                        quoted_msg: quotedMsg ? JSON.stringify(quotedMsg) : null
                                    },
                                    REQUEST_TIMEOUT
                                );
                                botReply = response.data?.reply || 'Desculpa, tive um problema para processar isso.';
                                console.log("[INFO] ✅ Resposta recebida do servidor Render com sucesso!");
                            } catch (requestError) {
                                console.error("[ERRO] Falha na requisição principal: " + requestError.message);
                                
                                // Verificar se o servidor está realmente down ou só lento
                                const isRenderHealthy = await this.checkRenderHealth();
                                if (isRenderHealthy) {
                                    botReply = "Opa " + senderName + "! Meu servidor tá meio sobrecarregado agora. Pode tentar de novo em alguns segundos?";
                                } else {
                                    // Fallback inteligente baseado no conteúdo
                                    if (bodyLower.includes('?')) {
                                        botReply = "Interessante pergunta, " + senderName + "! No momento tô com uns probleminhas técnicos, mas assim que voltar ao normal posso te ajudar melhor com isso!";
                                    } else if (bodyLower.includes('ajuda') || bodyLower.includes('help')) {
                                        botReply = "Claro que posso ajudar, " + senderName + "! Só que agora tô meio limitado por questões técnicas. Tenta mais tarde que te dou uma resposta mais completa!";
                                    } else if (bodyLower.includes('problema') || bodyLower.includes('erro')) {
                                        botReply = "Entendi que você tá com algum problema, " + senderName + ". Assim que meus sistemas voltarem 100%, posso te dar uma ajuda mais detalhada!";
                                    } else {
                                        botReply = "Opa " + senderName + "! Tô meio limitado agora por questões técnicas, mas tô aqui! Que tal reformular ou tentar novamente em alguns minutos?";
                                    }
                                }
                            }
                        }
                    }

                    const sentMessage = (isGroup || isReply) ?
                        await this.sock.sendMessage(chatId, { text: botReply }, { quoted: message }) :
                        await this.sock.sendMessage(chatId, { text: botReply });

                    if (sentMessage?.key?.id) {
                        if (!(await this.checkRenderHealth())) {
                            console.warn("[AVISO] Servidor indisponível para salvar WhatsApp ID. Pulando...");
                        } else {
                            try {
                                await this.makeRequestWithRetry(
                                    API_URL + "/bot/save-whatsapp-id",
                                    {
                                        whatsapp_id: sentMessage.key.id,
                                        message: body,
                                        reply: botReply,
                                        sender_number: senderNumber
                                    },
                                    REQUEST_TIMEOUT
                                );
                            } catch (error) {
                                console.error("[ERRO] Erro ao salvar WhatsApp ID: " + error.message);
                            }
                        }
                    }

                    const tom = this.detectarTomMensagem(body);
                    if (tom) {
                        const reactions = {
                            riso: ["😂", "🤣", "😆"],
                            raiva: ["🤬", "👊", "😡"],
                            romantico: ["💕", "❤️", "💘"]
                        };
                        const reaction = reactions[tom][Math.floor(Math.random() * reactions[tom].length)];
                        await this.adicionarReacao(chatId, message.key.id, reaction);
                    }
                } catch (error) {
                    console.error("[ERRO] Falha na API: " + error.message);
                    await this.sock.sendMessage(chatId, { text: '[ERRO] Erro ao processar. Tenta de novo, mano!' });
                }
            }
        } catch (errogeral) {
            console.error('[ERRO] Falha geral: ' + errogeral.message);
        }
    }
}

async function startBot() {
    try {
        const bot = new Bot();
        await bot.iniciar();
        return bot;
    } catch (error) {
        console.error('[ERRO] Erro ao criar bot: ' + error.message);
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

// Adicionando a rota /qrcode para servir o arquivo
app.get('/qrcode', (req, res) => {
    if (!botInstance || !botInstance.qrCodePath || !fs.existsSync(botInstance.qrCodePath)) {
        return res.status(404).send('QR Code não disponível. Aguarde a geração ou verifique os logs.');
    }
    res.sendFile(botInstance.qrCodePath, { root: '.' }, (err) => {
        if (err) {
            console.error('[ERRO] Erro ao enviar QR Code: ' + err.message);
            res.status(500).send('Erro ao carregar o QR Code.');
        }
    });
});

// Rota /bot com página HTML estática para QR Code
app.get('/bot', (req, res) => {
    if (botInstance && botInstance.isConnected) {
        return res.status(200).send(`
            <!DOCTYPE html>
            <html lang="pt">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Akira Bot - Status</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; background-color: #e8f5e8; }
                    .success { color: #2d5a2d; }
                    .status { font-size: 24px; margin: 20px 0; }
                </style>
            </head>
            <body>
                <h1 class="success">✅ Akira Bot Conectado!</h1>
                <p class="status">O bot está ativo e funcionando normalmente.</p>
                <p>Número do bot: <strong>${botInstance.botNumber || 'Carregando...'}</strong></p>
            </body>
            </html>
        `);
    }
    
    if (!botInstance || !botInstance.qrCodePath || !fs.existsSync(botInstance.qrCodePath)) {
        return res.status(503).send(`
            <!DOCTYPE html>
            <html lang="pt">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Akira Bot - Aguardando</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; background-color: #fff3cd; }
                    .warning { color: #856404; }
                </style>
                <script>
                    setTimeout(() => location.reload(), 5000);
                </script>
            </head>
            <body>
                <h1 class="warning">⏳ Aguardando QR Code...</h1>
                <p>O QR Code está sendo gerado. Esta página será atualizada automaticamente em 5 segundos.</p>
                <p>Verifique os logs do console para mais detalhes.</p>
            </body>
            </html>
        `);
    }
    
    const html = `
        <!DOCTYPE html>
        <html lang="pt">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Autenticação do Akira Bot</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; background-color: #f0f0f0; }
                img { max-width: 300px; max-height: 300px; border: 2px solid #000; border-radius: 10px; }
                p { color: #333; margin: 15px 0; }
                .code { background: #f5f5f5; padding: 10px; border-radius: 5px; word-break: break-all; }
                .refresh-btn { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin: 10px; }
            </style>
            <script>
                function refreshPage() { location.reload(); }
                // Auto-refresh a cada 30 segundos
                setTimeout(refreshPage, 30000);
            </script>
        </head>
        <body>
            <h1>🔗 Escaneie o QR Code para Autenticar o Akira Bot</h1>
            <img src="/qrcode" alt="QR Code para Autenticação" onerror="this.style.display='none'" />
            <p>Após escanear, o bot estará autenticado e esta página será atualizada.</p>
            ${botInstance.qrCodeString ? `<div class="code"><strong>Código manual:</strong><br>${botInstance.qrCodeString}</div>` : ''}
            <button class="refresh-btn" onclick="refreshPage()">🔄 Atualizar Página</button>
            <p><small>Página atualiza automaticamente a cada 30 segundos</small></p>
        </body>
        </html>
    `;
    res.send(html);
});

// Usar a porta fornecida pelo Render
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log("[INFO] Servidor Express rodando na porta " + PORT + ". Acesse /bot para ver o status e autenticação.");
});

if (require.main === module) {
    startBot().then(bot => {
        botInstance = bot;
    }).catch(error => {
        console.error('[ERRO] Falha ao iniciar: ' + error.message);
        process.exit(1);
    });
}

// Tratamento global de erros para máxima estabilidade
process.on('uncaughtException', (error) => {
    console.error('[ERRO CRÍTICO] Exceção não capturada: ' + error.message);
    console.error('[ERRO CRÍTICO] Stack: ' + error.stack);
    console.log('[INFO] Processo será reiniciado pelo monitor...');
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[ERRO CRÍTICO] Promise rejeitada não tratada:', reason);
    console.log('[INFO] Tentando continuar execução...');
});

module.exports = { startBot };

