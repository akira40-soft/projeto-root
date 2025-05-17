console.log("🟢 O script venom_bot.js iniciou a execução!");
const venom = require('venom-bot');
const axios = require('axios');
const fs = require('fs');

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

// Timeout e configuração de retry para lidar com o "sleep" do Render
const REQUEST_TIMEOUT = 90000; // 90 segundos para cobrir o delay do Render
const HEALTH_CHECK_TIMEOUT = 60000; // 60 segundos para verificar o health
const MAX_RETRIES = 3; // Número máximo de tentativas
const RETRY_DELAY = 5000; // Atraso de 5 segundos entre tentativas

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
    console.log(`🧹 Cache limpo. Tamanho atual: ${messageCache.size}`);
}
setInterval(cleanCache, 60000); // Limpa a cada minuto

class Bot {
    constructor() {
        this.client = null;
        this.botNumber = null;
    }

    async iniciar() {
        console.log("🚀 Iniciando Venom-Bot...");
        try {
            this.client = await venom.create({
                session: 'akira-bot',
                multidevice: true,
                headless: 'new',
                browserArgs: ['--no-sandbox', '--disable-setuid-sandbox'],
                executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
                puppeteerOptions: { timeout: 120000, waitUntil: "networkidle2" },
                logQR: true,
                autoClose: 60000,
            });

            console.log("✅ Akira está online!");

            const botInfo = await this.client.getHostDevice();
            this.botNumber = botInfo?.id?._serialized?.split('@')[0] || null;

            if (!this.botNumber) {
                console.error("⚠️ Erro ao obter número do bot.");
            } else {
                console.log(`🔢 Número do bot: ${this.botNumber}`);
            }

            this.client.onStateChange((state) => {
                console.log(`🔄 Estado da conexão: ${state}`);
                if (state === 'DISCONNECTED') {
                    console.error('❌ Bot desconectado, reconectando...');
                    setTimeout(() => this.iniciar(), 5000);
                } else if (state === 'CONNECTED') {
                    console.log('✅ Bot conectado ao WhatsApp!');
                }
            });

            await new Promise(resolve => setTimeout(resolve, 15000)); // 15 segundos de espera
            this.client.onMessage((message) => this.processarMensagem(message));
        } catch (error) {
            console.error("❌ Erro ao iniciar o Venom-Bot:", error.message);
            setTimeout(() => this.iniciar(), 5000);
        }
    }

    async simularDigitacao(chatId, minDelay = 700, maxDelay = 2000) {
        try {
            const typingDelay = Math.floor(Math.random() * (maxDelay - minDelay)) + minDelay;
            if (typeof this.client.startTyping === 'function') {
                await this.client.startTyping(chatId);
                console.log(`⌨️ Simulando digitação por ${typingDelay}ms...`);
                await new Promise(resolve => setTimeout(resolve, typingDelay));
                if (typeof this.client.stopTyping === 'function') {
                    await this.client.stopTyping(chatId);
                }
            } else {
                console.warn("⚠️ Método startTyping indisponível. Usando atraso simples.");
                await new Promise(resolve => setTimeout(resolve, typingDelay));
            }
        } catch (error) {
            console.error("❌ Erro ao simular digitação:", error.message);
        }
    }

    async isAuthorizedAdminCommand(senderNumber, command) {
        const isAuthorized = senderNumber === PRIVILEGED_NUMBER;
        console.log(`🔐 Verificando autorização: ${senderNumber} -> ${isAuthorized ? 'Autorizado' : 'Não autorizado'}`);
        return isAuthorized;
    }

    async adicionarReacao(chatId, messageId, reaction) {
        try {
            if (typeof this.client.sendMessageReaction === 'function') {
                await this.client.sendMessageReaction(chatId, messageId, reaction);
                console.log(`✅ Reação ${reaction} adicionada com sendMessageReaction`);
            } else if (typeof this.client.react === 'function') {
                await this.client.react(chatId, messageId, reaction);
                console.log(`✅ Reação ${reaction} adicionada com react`);
            } else {
                console.warn("⚠️ Métodos de reação indisponíveis.");
            }
        } catch (error) {
            console.error(`❌ Erro ao adicionar reação ${reaction}:`, error.message);
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

    // Função para verificar se o Flask no Render está ativo
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

    // Função para executar requisições com retry
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

    async processarMensagem(message) {
        try {
            console.log(`[📩 MSG] ${message.sender?.pushname || message.from}: ${message.body || '[mídia]'} (${message.type})`);

            if (!message.body && !message.isMedia) {
                console.warn("⚠️ Mensagem sem corpo ou mídia:", {
                    type: message.type,
                    isMedia: message.isMedia,
                    from: message.from,
                    sender: message.sender
                });
                return;
            }

            const senderNumber = message.isGroupMsg && message.author ? message.author.split('@')[0] :
                               message.from?.split('@')[0] || message.sender?.id?.split('@')[0] || '';
            const senderName = message.sender?.pushname || message.sender?.formattedName || senderNumber || 'Usuário';
            const isGroup = message.isGroupMsg;
            const mentionedAkira = message.body && message.body.toLowerCase().includes('akira');
            const isMentioned = message.mentionedJidList?.length > 0;
            const mentionedAkiraWithAt = isMentioned && this.botNumber && message.mentionedJidList.some(jid => jid.includes(this.botNumber));
            const isReply = !!message.quotedMsg;
            const quotedAuthor = message.quotedMsg?.author || message.quotedParticipant;
            const isReplyToAkira = isReply && quotedAuthor && this.botNumber && quotedAuthor.includes(this.botNumber);

            let targetChatId = message.from;
            if (!targetChatId.includes('@c.us') && !targetChatId.includes('@g.us')) {
                targetChatId = isGroup ? `${targetChatId}@g.us` : `${targetChatId}@c.us`;
            }

            if (message.id && message.body) {
                messageCache.set(message.id, { body: message.body, timestamp: Date.now() });
                console.log(`📥 Cache atualizado: ID=${message.id}, Body=${message.body.slice(0, 50)}...`);
            }

            if (message.body?.startsWith('/')) {
                const [comando, ...args] = message.body.trim().split(' ');
                const adminCommands = ["/reset", "/remover", "/apagarmsg", "/adicionar"];
                if (adminCommands.includes(comando.toLowerCase())) {
                    const isAuthorized = await this.isAuthorizedAdminCommand(senderNumber, comando);
                    if (!isAuthorized) {
                        await this.simularDigitacao(targetChatId);
                        await this.client.sendText(targetChatId, "⚠ Apenas Isaac Quarenta pode executar comandos administrativos.");
                        await this.adicionarReacao(targetChatId, message.id, "❌");
                        return;
                    }

                    await this.simularDigitacao(targetChatId);

                    switch (comando.toLowerCase()) {
                        case "/reset":
                            // Verificar saúde do Render antes de enviar
                            if (!(await this.checkRenderHealth())) {
                                await this.client.sendText(targetChatId, "⚠ O servidor está indisponível no momento. Tente novamente mais tarde.");
                                return;
                            }
                            try {
                                const response = await this.makeRequestWithRetry(
                                    `${API_URL}/bot/reset`,
                                    {
                                        sender_number: senderNumber,
                                        group_id: isGroup ? message.from.split('@')[0] : null
                                    },
                                    REQUEST_TIMEOUT
                                );
                                await this.client.sendText(targetChatId, response?.data?.reply || "⚠ Erro ao resetar o contexto.");
                            } catch (error) {
                                await this.client.sendText(targetChatId, "⚠ Falha ao resetar o contexto. Tente novamente.");
                            }
                            break;
                        case "/remover":
                            if (!isGroup) {
                                await this.client.sendText(targetChatId, "⚠ Este comando só pode ser usado em grupos.");
                                return;
                            }
                            if (!args.length) {
                                await this.client.sendText(targetChatId, "⚠ Informe o número ou menção (/remover @NUMERO).");
                                return;
                            }
                            let participant = args[0].replace(/[@\+]/g, '').replace(/[^0-9]/g, '');
                            if (!participant || participant.length < 9) {
                                await this.client.sendText(targetChatId, "⚠ Número inválido.");
                                return;
                            }
                            participant += '@c.us';
                            const chat = await this.client.getChatById(targetChatId);
                            const participants = chat?.participants || [];
                            const botParticipant = participants.find(p => p.id._serialized.includes(this.botNumber));
                            if (!botParticipant?.isAdmin) {
                                await this.client.sendText(targetChatId, "⚠ Eu preciso ser administrador.");
                                return;
                            }
                            await this.client.removeParticipant(targetChatId, participant)
                                .then(() => this.client.sendText(targetChatId, `✅ Membro (${args[0]}) removido!`))
                                .catch(err => this.client.sendText(targetChatId, `⚠ Erro: ${err.message}`));
                            break;
                        case "/apagarmsg":
                            if (!isReply || !message.quotedMsg?.id) {
                                await this.client.sendText(targetChatId, "⚠ Responda à mensagem com /apagarmsg.");
                                return;
                            }
                            const messageIdToDelete = message.quotedMsg.id;
                            await this.client.deleteMessage(targetChatId, messageIdToDelete, isGroup)
                                .then(() => this.client.sendText(targetChatId, "✅ Mensagem apagada!"))
                                .catch(err => this.client.sendText(targetChatId, `⚠ Erro: ${err.message}`));
                            break;
                        case "/adicionar":
                            if (!isGroup) {
                                await this.client.sendText(targetChatId, "⚠ Este comando só pode ser usado em grupos.");
                                return;
                            }
                            if (!args.length) {
                                await this.client.sendText(targetChatId, "⚠ Informe o número (/adicionar NUMERO).");
                                return;
                            }
                            let newParticipant = args[0].replace(/[@\+]/g, '').replace(/[^0-9]/g, '') + '@c.us';
                            const groupChat = await this.client.getChatById(targetChatId);
                            if (!groupChat?.participants.find(p => p.id._serialized.includes(this.botNumber))?.isAdmin) {
                                await this.client.sendText(targetChatId, "⚠ Eu preciso ser administrador.");
                                return;
                            }
                            await this.client.addParticipant(targetChatId, newParticipant)
                                .then(() => this.client.sendText(targetChatId, `✅ Membro (${args[0]}) adicionado!`))
                                .catch(err => this.client.sendText(targetChatId, `⚠ Erro: ${err.message}`));
                            break;
                    }
                    return;
                }
            }

            if (message.isMedia || ["image", "audio", "sticker"].includes(message.type)) {
                if (isGroup && !mentionedAkiraWithAt && !mentionedAkira && !isReplyToAkira) {
                    console.log("📵 Mídia em grupo ignorada.");
                    return;
                }

                await this.simularDigitacao(targetChatId);

                // Verificar saúde do Render antes de enviar
                if (!(await this.checkRenderHealth())) {
                    await this.client.sendText(targetChatId, "⚠ O servidor está indisponível no momento. Tente novamente mais tarde.");
                    return;
                }

                try {
                    let response;
                    if (message.type === "image") {
                        const base64Image = await this.client.decryptFile(message);
                        response = await this.makeRequestWithRetry(
                            `${API_URL}/bot`,
                            {
                                media_type: "imagem",
                                base64: base64Image.toString('base64'),
                                sender: senderName,
                                sender_number: senderNumber,
                                is_group: isGroup
                            },
                            REQUEST_TIMEOUT
                        );
                        console.log(`📥 Resposta da API (imagem):`, response.data);
                    } else if (message.type === "audio") {
                        const base64Audio = await this.client.decryptFile(message);
                        response = await this.makeRequestWithRetry(
                            `${API_URL}/bot`,
                            {
                                media_type: "audio",
                                base64: base64Audio.toString('base64'),
                                sender: senderName,
                                sender_number: senderNumber,
                                is_group: isGroup
                            },
                            REQUEST_TIMEOUT
                        );
                        console.log(`📥 Resposta da API (audio):`, response.data);
                    } else if (message.type === "sticker") {
                        response = await this.makeRequestWithRetry(
                            `${API_URL}/bot`,
                            {
                                media_type: "sticker",
                                info: { category: message.ack ? "enviado" : "recebido", fileLength: message.fileLength },
                                sender: senderName,
                                sender_number: senderNumber,
                                is_group: isGroup
                            },
                            REQUEST_TIMEOUT
                        );
                        console.log(`📥 Resposta da API (sticker):`, response.data);
                    }
                    await this.client.sendText(targetChatId, response?.data?.reply || "(Sem resposta)");
                } catch (error) {
                    console.error("❌ Erro ao processar mídia:", error.message);
                    await this.client.sendText(targetChatId, '⚠ Erro ao processar mídia. Tenta de novo, mano!');
                    return;
                }
                return;
            }

            if (isGroup && !mentionedAkiraWithAt && !mentionedAkira && !isReplyToAkira) {
                console.log("📵 Mensagem em grupo ignorada.");
                return;
            }

            if (!senderNumber) {
                console.error("❌ SenderNumber inválido.");
                await this.client.sendText(targetChatId, '⚠ Erro: Número inválido.');
                return;
            }

            let quotedMsg = null;
            if (isReply && message.quotedMsg) {
                const quotedMsgId = message.quotedMsg.id || 'unknown';
                let quotedMsgBody = message.quotedMsg.body || '';
                if (!quotedMsgBody && messageCache.has(quotedMsgId)) {
                    quotedMsgBody = messageCache.get(quotedMsgId).body || 'Mensagem citada não disponível.';
                }
                quotedMsg = { id: quotedMsgId, body: quotedMsgBody, author: quotedAuthor };
                console.log(`🔍 Quoted_msg: ID=${quotedMsgId}, Body=${quotedMsgBody.slice(0, 50)}..., Author=${quotedAuthor}`);
            }

            await this.simularDigitacao(targetChatId);

            try {
                let botReply;
                if (isReply && quotedMsg) {
                    const currentLower = message.body.toLowerCase();
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
                            `Mano ${senderName}, tava falando sobre "${previousMsg}". Não pegou? Posso mandar de novo de outro jeito!` :
                            `Mano ${senderName}, não achei o que tava rolando antes. Me dá uma luz do que tu não entendeu?`;
                    } else if (currentLower.includes("não entendi") || currentLower.includes("nem entendi")) {
                        botReply = `Desculpa aí, ${senderName}! Tô vendo que tu não entendeu "${quotedMsg.body}". Quer que eu explique de outra forma?`;
                    } else if (currentLower.includes("temais ideias?") || currentLower.includes("mais ideias?")) {
                        botReply = `Claro, ${senderName}! Além de "${quotedMsg.body}", que tal "AkiraPro" ou "AkiVibe"? Qual tu curte mais?`;
                    }
                }

                if (!botReply) {
                    // Verificar saúde do Render antes de enviar
                    if (!(await this.checkRenderHealth())) {
                        await this.client.sendText(targetChatId, "⚠ O servidor está indisponível no momento. Tente novamente mais tarde.");
                        return;
                    }

                    const response = await this.makeRequestWithRetry(
                        `${API_URL}/bot`,
                        {
                            message: message.body,
                            sender: senderName,
                            sender_number: senderNumber,
                            is_group: isGroup,
                            mentioned: mentionedAkiraWithAt || mentionedAkira,
                            replied_to_akira: isReplyToAkira,
                            quoted_msg: quotedMsg ? JSON.stringify(quotedMsg) : null
                        },
                        REQUEST_TIMEOUT
                    );
                    botReply = response.data?.reply || '⚠ Erro na resposta.';
                }

                const sentMessage = (isGroup || isReply) ?
                    await this.client.reply(targetChatId, botReply, message.id).catch(() =>
                        this.client.sendText(targetChatId, botReply)) :
                    await this.client.sendText(targetChatId, botReply);

                if (sentMessage?.id) {
                    // Verificar saúde antes de salvar o ID
                    if (!(await this.checkRenderHealth())) {
                        console.warn("⚠️ Servidor indisponível para salvar WhatsApp ID. Pulando...");
                    } else {
                        try {
                            await this.makeRequestWithRetry(
                                `${API_URL}/bot/save-whatsapp-id`,
                                {
                                    whatsapp_id: sentMessage.id,
                                    message: message.body,
                                    reply: botReply,
                                    sender_number: senderNumber
                                },
                                REQUEST_TIMEOUT
                            );
                        } catch (error) {
                            console.error("❌ Erro ao salvar WhatsApp ID:", error.message);
                        }
                    }
                }

                const tom = this.detectarTomMensagem(message.body);
                if (tom) {
                    const reactions = {
                        riso: ["😂", "🤣", "😆"],
                        raiva: ["🤬", "👊", "😡"],
                        romantico: ["💕", "❤️", "💘"]
                    };
                    const reaction = reactions[tom][Math.floor(Math.random() * reactions[tom].length)];
                    await this.adicionarReacao(targetChatId, message.id, reaction);
                }
            } catch (error) {
                console.error("❌ Falha na API:", error.message);
                await this.client.sendText(targetChatId, '⚠ Erro ao processar. Tenta de novo, mano!');
            }
        } catch (errogeral) {
            console.error('❌ Falha geral:', {
                message: errogeral.message,
                stack: errogeral.stack
            });
        }
    }
}

async function newBot() {
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

if (require.main === module) {
    newBot().catch(error => {
        console.error('❌ Falha ao iniciar:', {
            message: error.message,
            stack: error.stack
        });
        process.exit(1);
    });
}

module.exports = { newBot };
