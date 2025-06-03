console.log("🟢 Iniciando o script corrected_bot.js com Baileys...");

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    isJidGroup,
    jidNormalizedUser
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const { Boom } = require("@hapi/boom");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const qrcodeTerminal = require("qrcode-terminal");

// --- Configurações Essenciais ---
const BOT_NAME_TRIGGER = "akira"; // Palavra-chave para ativar o bot em grupos (case-insensitive)
const RENDER_API_URL = process.env.RENDER_API_URL || "https://flask-ybtc.onrender.com/bot"; // URL correta do Render
const AUTH_DIR = "baileys_auth_info_corrected"; // Diretório para guardar informações de autenticação
const REQUEST_TIMEOUT = 120000; // Timeout para a API do Render (2 minutos)
const MAX_RETRIES = 2; // Tentativas de envio para a API
const RETRY_DELAY = 5000; // Delay entre tentativas (5 segundos)
// -------------------------------

const logger = pino({ level: process.env.LOG_LEVEL || "info" }); // Use 'debug' para mais detalhes

let sock = null;
let botJid = null;
let botLid = null; // Para armazenar o LID do bot, se disponível

async function connectToWhatsApp() {
    logger.info("Iniciando conexão com o WhatsApp...");
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    logger.info(`Usando Baileys v${version.join(".")}, é a mais recente: ${isLatest}`);

    sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: false, // Geraremos manualmente para melhor visualização
        auth: state,
        browser: ["Akira (Manus)", "Chrome", "1.0.0"], // Define um nome de browser personalizado
        syncFullHistory: false, // Sincroniza apenas o necessário
        markOnlineOnConnect: true, // Marca como online ao conectar
    });

    // --- Tratamento de Eventos da Conexão ---
    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;
        logger.info(`Atualização da conexão: ${connection}`);

        if (qr) {
            logger.info("QR Code recebido. Escaneie abaixo ou use o código:");
            qrcodeTerminal.generate(qr, { small: true });
            logger.info(`Código QR (para inserir manualmente): ${qr}`);
        }

        if (connection === "close") {
            const statusCode = (lastDisconnect?.error instanceof Boom) ? lastDisconnect.error.output.statusCode : 500;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            logger.error(`Conexão fechada! Razão: ${statusCode} - ${lastDisconnect?.error?.message}. Reconectando: ${shouldReconnect}`);
            
            // Limpar JID do bot ao desconectar
            botJid = null;
            botLid = null;

            if (shouldReconnect) {
                setTimeout(connectToWhatsApp, 5000); // Tenta reconectar após 5s
            } else {
                logger.error("Desconectado permanentemente (logout). Remova a pasta de autenticação e reinicie.");
                process.exit(1); // Encerra se for logout
            }
        } else if (connection === "open") {
            logger.info("Conexão com WhatsApp estabelecida!");
            botJid = jidNormalizedUser(sock.user.id);
            botLid = sock.user.lid; // Pode ser undefined
            logger.info(`Bot JID: ${botJid}`);
            if (botLid) logger.info(`Bot LID: ${botLid}`);
        }
    });

    // Salvar credenciais
    sock.ev.on("creds.update", saveCreds);

    // --- Tratamento de Novas Mensagens ---
    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];

        // Ignorar notificações e mensagens sem conteúdo real
        if (!msg.message || msg.key.remoteJid === 'status@broadcast') {
            return;
        }

        // Ignorar mensagens enviadas pelo próprio bot
        if (msg.key.fromMe) {
            return;
        }

        try {
            await processMessage(msg);
        } catch (error) {
            logger.error({ err: error, msgKey: msg.key }, "Erro ao processar mensagem");
        }
    });

    return sock;
}

// --- Função Principal de Processamento de Mensagem ---
async function processMessage(msg) {
    const chatId = msg.key.remoteJid;
    const isGroup = isJidGroup(chatId);
    const messageTimestamp = typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp : (msg.messageTimestamp?.low || Date.now() / 1000);

    // --- Extração de Informações do Remetente ---
    let senderJid = msg.key.participant || msg.key.remoteJid;
    senderJid = jidNormalizedUser(senderJid);
    const senderName = msg.pushName || senderJid.split('@')[0];
    const senderNumber = senderJid.split('@')[0];

    // --- Extração do Texto da Mensagem ---
    let messageText = '';
    const messageType = Object.keys(msg.message)[0];

    if (messageType === 'conversation') {
        messageText = msg.message.conversation;
    } else if (messageType === 'extendedTextMessage') {
        messageText = msg.message.extendedTextMessage.text;
    } else if (msg.message.imageMessage?.caption) {
        messageText = msg.message.imageMessage.caption;
    } else if (msg.message.videoMessage?.caption) {
        messageText = msg.message.videoMessage.caption;
    } else if (msg.message.documentMessage?.caption) {
        messageText = msg.message.documentMessage.caption;
    }
    messageText = messageText?.trim() || '';

    // Ignorar reações
    if (messageType === 'reactionMessage') {
        logger.info(`Reação de ${senderName} (${senderNumber}) ignorada.`);
        return;
    }

    logger.info(`Mensagem recebida de ${senderName} (${senderNumber}) em ${isGroup ? 'grupo' : 'privado'} (${chatId}): "${messageText.slice(0, 50)}..." (Tipo: ${messageType})`);

    // --- Lógica de Ativação (Principalmente para Grupos) ---
    let shouldProcess = false;
    let activationReason = '';
    let groupMetadata = null;
    let groupName = null;
    let quotedMsgText = null;
    let repliedMessageSenderJid = null;

    const contextInfo = msg.message.extendedTextMessage?.contextInfo;

    // 1. Verificar se é Reply
    const isReply = !!contextInfo?.quotedMessage;
    let isReplyToBot = false;
    if (isReply && botJid) {
        const quotedParticipant = contextInfo.participant ? jidNormalizedUser(contextInfo.participant) : null;
        isReplyToBot = quotedParticipant === botJid || (botLid && quotedParticipant === botLid);
        
        if (isReplyToBot) {
            const quotedMsg = contextInfo.quotedMessage;
            if (quotedMsg?.conversation) {
                quotedMsgText = quotedMsg.conversation;
            } else if (quotedMsg?.extendedTextMessage?.text) {
                quotedMsgText = quotedMsg.extendedTextMessage.text;
            }
            quotedMsgText = quotedMsgText?.trim() || null;
            repliedMessageSenderJid = quotedParticipant;
        }
    }

    // 2. Verificar se foi chamado pelo nome
    const isCalledByName = messageText.toLowerCase().includes(BOT_NAME_TRIGGER);

    // 3. Verificar se foi mencionado (@)
    let isMentioned = false;
    if (contextInfo?.mentionedJid && botJid) {
        isMentioned = contextInfo.mentionedJid.some(jid => {
            const normalizedMention = jidNormalizedUser(jid);
            return normalizedMention === botJid || (botLid && normalizedMention === botLid);
        });
    }

    // --- Decisão de Processamento ---
    if (!isGroup) {
        shouldProcess = true;
        activationReason = 'Mensagem Privada';
    } else {
        if (isCalledByName) {
            shouldProcess = true;
            activationReason = `Chamado pelo nome ('${BOT_NAME_TRIGGER}')`;
        } else if (isMentioned) {
            shouldProcess = true;
            activationReason = 'Mencionado (@)';
        } else if (isReplyToBot) {
            shouldProcess = true;
            activationReason = 'Resposta a mensagem do Bot';
        }
        
        if (shouldProcess) {
            try {
                groupMetadata = await sock.groupMetadata(chatId);
                groupName = groupMetadata?.subject || chatId;
            } catch (err) {
                logger.warn({ err, chatId }, "Erro ao obter metadados do grupo");
                groupName = chatId;
            }
        }
    }

    // --- Envio para a API (se deve processar) ---
    if (shouldProcess) {
        logger.info(`Ativação: ${activationReason}. Preparando para enviar para a API...`);

        // Construir Payload mapeado para o formato esperado pelo endpoint /bot
        const payload = {
            sender_number: senderNumber,
            message: messageText || null,
            sender: senderName,
            quoted_msg: quotedMsgText,
            is_group: isGroup,
            group_id: isGroup ? chatId : null,
            mentioned: isMentioned,
            replied_to_akira: isReplyToBot
        };

        logger.debug({ payload }, "Payload a ser enviado para a API");

        try {
            const response = await makeRequestWithRetry(RENDER_API_URL, payload, REQUEST_TIMEOUT);
            logger.info(`Resposta da API recebida (Status: ${response.status})`);

            if (response.data && response.data.reply) {
                const replyText = response.data.reply;
                logger.info(`API solicitou resposta: "${replyText.slice(0, 50)}..."`);
                await sock.presenceSubscribe(chatId);
                await sock.sendPresenceUpdate('composing', chatId);
                await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
                await sock.sendMessage(chatId, { text: replyText });
                await sock.sendPresenceUpdate('paused', chatId);
                logger.info(`Resposta enviada para ${chatId}`);
            } else {
                logger.info("API não solicitou resposta.");
            }
        } catch (error) {
            logger.error({ err: error, apiUrl: RENDER_API_URL }, "Falha ao enviar dados para a API após retentativas");
        }
    } else if (isGroup) {
        logger.info(`Mensagem no grupo ${chatId} ignorada (não ativou o bot).`);
    }
}

// --- Função Auxiliar para Requisições com Retentativa ---
async function makeRequestWithRetry(url, data, timeout, method = 'POST') {
    for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
        try {
            logger.info(`Enviando requisição ${method} para ${url} (Tentativa ${attempt}/${MAX_RETRIES + 1}) - Timeout: ${timeout / 1000}s`);
            const startTime = Date.now();
            const response = await axios({
                method,
                url,
                data: method === 'POST' ? data : undefined,
                timeout,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Akira-Baileys-Bot/1.0'
                }
            });
            const duration = Date.now() - startTime;
            logger.info(`✅ Resposta da API (${response.status}) recebida em ${duration}ms.`);
            return response;
        } catch (error) {
            const errorType = error.code === 'ECONNABORTED' ? 'TIMEOUT' :
                error.response?.status ? `HTTP_${error.response.status}` : 'NETWORK_ERROR';
            logger.warn(`Falha na tentativa ${attempt}: ${errorType} - ${error.message}`);
            if (attempt <= MAX_RETRIES) {
                logger.info(`Aguardando ${RETRY_DELAY / 1000}s antes de tentar novamente...`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            } else {
                logger.error("Todas as tentativas de requisição falharam.");
                throw error;
            }
        }
    }
}

// --- Inicialização ---
connectToWhatsApp().catch(err => {
    logger.fatal({ err }, "Erro fatal ao iniciar a conexão com o WhatsApp");
    process.exit(1);
});

// --- Tratamento de Encerramento Graceful ---
process.on('SIGINT', async () => {
    logger.info("Recebido SIGINT. Desconectando...");
    if (sock) {
        await sock.logout();
        logger.info("Logout realizado.");
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info("Recebido SIGTERM. Desconectando...");
    if (sock) {
        await sock.logout();
        logger.info("Logout realizado.");
    }
    process.exit(0);
});

logger.info("Script corrected_bot.js carregado. Aguardando conexão...");
