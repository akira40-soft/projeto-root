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
const HEALTH_CHECK_TIMEOUT = 30000; // 30 segundos
const MAX_RETRIES = 5; // 5 tentativas
const RETRY_DELAY = 3000; // 3 segundos

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
    console.log(`🧹 Cache limpo. Tamanho atual: ${messageCache.size}`);
}
setInterval(cleanCache, 60000); // Limpa a cada minuto

class Bot {
    constructor() {
        this.sock = null;
        this.botNumber = null;
        this.qrCodePath = null;
        this.qrCodeString = null; // Para armazenar a string do QR Code
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
                printQRInTerminal: false,
                syncFullHistory: false,
                markOnlineOnConnect: false,
            });

            // Gerar e exibir o QR Code otimizado e a string
            this.sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;
                console.log(`🔄 Estado da conexão: ${connection}`);

                if (qr) {
                    this.qrCodeString = qr; // Armazena a string do QR Code
                    console.log("📸 Gerando QR Code para escaneamento...");
                    qrcodeTerminal.generate(qr, {
                        small: true,
                        white: " ",
                        black: "█",
                        scale: 0.8
                    });
                    console.log("\n🔍 Escaneie o QR Code acima com seu telefone ou use o código abaixo manualmente:");
                    console.log(`📝 Código do QR Code (para entrada manual): ${qr}`);
                    console.log("📌 Instruções: No WhatsApp, vá para 'Configurações' > 'Dispositivos Vinculados' > 'Vincular com Número' e insira o código acima.");
                    console.log("📌 Dica: Ajuste o zoom no seu telefone para escanear o QR Code, se preferir.");

                    this.qrCodePath = path.join(__dirname, 'qr_code.png');
                    await qrcode.toFile(this.qrCodePath, qr, {
                        width: 300,
                        height: 300,
                        margin: 1,
                        color: { dark: '#000000', light: '#FFFFFF' }
                    })
                        .then(() => console.log(`💾 QR Code salvo em: ${this.qrCodePath}. Escaneie com seu telefone ou use o código!`))
                        .catch(err => console.error("❌ Erro ao salvar QR Code:", err));
                }

                if (connection === 'close') {
                    this.isConnected = false;
                    const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                    if (shouldReconnect) {
                        console.error('❌ Conexão fechada, reconectando...');
                        setTimeout(() => this.iniciar(), 3000);
                    } else {
                        console.error('❌ Deslogado. Reinicie e escaneie o QR code ou insira o código novamente.');
                        process.exit(1);
                    }
                } else if (connection === 'open') {
                    console.log('✅ Bot conectado ao WhatsApp!');
                    this.botNumber = this.sock.user.id.split(':')[0];
                    console.log(`🔢 Número do bot: ${this.botNumber}`);
                    this.isConnected = true;
                    this.startKeepAlive();
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
        try {
            const result = await this.sock.sendMessage(this.sock.user.id, { text: 'Ping' });
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
            await new Promise(resolve => setTimeout(resolve, typingDelay));
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
                    key: { id: messageId, remoteJid: chatId, fromMe: false }
                }
            });
            console.log(`✅ Reação ${reaction} adicionada`);
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
            if (!message.key.fromMe && (message.message?.conversation || message.message?.extendedTextMessage || message.message?.imageMessage || message.message?.audioMessage || message.message?.stickerMessage)) {
                const chatId = message.key.remoteJid;
                const sender = message.key.participant || message.key.remoteJid;
                const senderNumber = sender.split('@')[0];
                const senderName = message.pushName || senderNumber || 'Usuário';
                const isGroup = chatId.includes('@g.us');
                const mentionedAkira = message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.includes(this.sock.user.id) || (message.message?.conversation?.toLowerCase().includes('akira'));
                const isReply = !!message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                const rawQuotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                const quotedAuthor = message.message?.extendedTextMessage?.contextInfo?.participant;
                const isReplyToAkira = isReply && quotedAuthor && quotedAuthor.includes(this.botNumber);

                console.log(`[📩 MSG] ${senderName}: ${message.message?.conversation || '[mídia]'} (${message.message?.type || 'unknown'})`);

                if (message.key.id) {
                    messageCache.set(message.key.id, { body: message.message?.conversation || '', timestamp: Date.now() });
                    console.log(`📥 Cache atualizado: ID=${message.key.id}, Body=${(message.message?.conversation || '').slice(0, 50)}...`);
                }

                const body = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
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
                                if (!args.length) {
                                    await this.sock.sendMessage(chatId, { text: "⚠ Informe o número ou menção (/remover @NUMERO)." });
                                    return;
                                }
                                let participant = args[0].replace(/[@\+]/g, '').replace(/[^0-9]/g, '');
                                if (!participant || participant.length < 9) {
                                    await this.sock.sendMessage(chatId, { text: "⚠ Número inválido." });
                                    return;
                                }
                                participant += '@s.whatsapp.net';
                                const groupMetadata = await this.sock.groupMetadata(chatId);
                                const botIsAdmin = groupMetadata.participants.find(p => p.id.includes(this.botNumber))?.admin;
                                if (!botIsAdmin) {
                                    await this.sock.sendMessage(chatId, { text: "⚠ Eu preciso ser administrador." });
                                    return;
                                }
                                await this.sock.groupParticipantsUpdate(chatId, [participant], 'remove')
                                    .then(() => this.sock.sendMessage(chatId, { text: `✅ Membro (${args[0]}) removido!` }))
                                    .catch(err => this.sock.sendMessage(chatId, { text: `⚠ Erro: ${err.message}` }));
                                break;
                            case "/apagarmsg":
                                if (!isReply || !message.message?.extendedTextMessage?.contextInfo?.stanzaId) {
                                    await this.sock.sendMessage(chatId, { text: "⚠ Responda à mensagem com /apagarmsg." });
                                    return;
                                }
                                const messageIdToDelete = message.message.extendedTextMessage.contextInfo.stanzaId;
                                await this.sock.chatModify({ clear: { messages: [{ id: messageIdToDelete, fromMe: false }] } }, chatId)
                                    .then(() => this.sock.sendMessage(chatId, { text: "✅ Mensagem apagada!" }))
                                    .catch(err => this.sock.sendMessage(chatId, { text: `⚠ Erro: ${err.message}` }));
                                break;
                            case "/adicionar":
                                if (!isGroup) {
                                    await this.sock.sendMessage(chatId, { text: "⚠ Este comando só pode ser usado em grupos." });
                                    return;
                                }
                                if (!args.length) {
                                    await this.sock.sendMessage(chatId, { text: "⚠
