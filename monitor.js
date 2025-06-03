const { spawn } = require('child_process');
const fs = require('fs');
const axios = require('axios'); // Para requisições HTTP de keep-alive
const net = require('net'); // Para verificar conexão de rede

console.log("🔄 Monitor do Akira Bot iniciado!");

let botProcess = null;
let restartCount = 0;
const MAX_RESTARTS = 10;
const RESTART_DELAY = 5000; // 5 segundos
const KEEP_ALIVE_INTERVAL = 2 * 60 * 1000; // 2 minutos (mais frequente para Replit)
const STABILITY_TIMEOUT = 10 * 60 * 1000; // 10 minutos para resetar contador
const HEALTH_CHECK_URL = 'https://httpstat.us/200'; // URL para verificar conexão

function isInternetConnected() {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(5000); // Timeout de 5 segundos
        socket.connect(80, 'google.com', () => {
            socket.destroy();
            resolve(true);
        });
        socket.on('error', () => {
            socket.destroy();
            resolve(false);
        });
        socket.on('timeout', () => {
            socket.destroy();
            resolve(false);
        });
    });
}

function startBot() {
    console.log(`[${new Date().toISOString()}] 🚀 Iniciando bot (tentativa ${restartCount + 1})...`);
    
    botProcess = spawn('node', ['bot.js'], {
        stdio: 'inherit',
        cwd: process.cwd(),
        env: { ...process.env, NODE_ENV: 'production' } // Define ambiente
    });

    botProcess.on('close', async (code) => {
        console.log(`[${new Date().toISOString()}] ⚠️ Bot parou com código: ${code}`);
        
        if (restartCount < MAX_RESTARTS) {
            restartCount++;
            console.log(`[${new Date().toISOString()}] 🔄 Reiniciando em ${RESTART_DELAY/1000}s... (${restartCount}/${MAX_RESTARTS})`);
            
            const isConnected = await isInternetConnected();
            if (!isConnected) {
                console.log(`[${new Date().toISOString()}] ⚠️ Sem conexão com a internet. Tentando novamente...`);
            }

            setTimeout(() => {
                startBot();
            }, RESTART_DELAY);
        } else {
            console.log(`[${new Date().toISOString()}] ❌ Máximo de restarts atingido. Parando monitor.`);
            process.exit(1);
        }
    });

    botProcess.on('error', (error) => {
        console.error(`[${new Date().toISOString()}] ❌ Erro no processo: ${error.message}`);
        if (restartCount < MAX_RESTARTS) {
            restartCount++;
            console.log(`[${new Date().toISOString()}] 🔄 Reiniciando após erro em ${RESTART_DELAY/1000}s... (${restartCount}/${MAX_RESTARTS})`);
            setTimeout(startBot, RESTART_DELAY);
        }
    });

    // Reset counter quando bot roda por mais de 10 minutos
    setTimeout(() => {
        if (botProcess && !botProcess.killed && restartCount > 0) {
            console.log(`[${new Date().toISOString()}] ✅ Bot estável - resetando contador de restarts`);
            restartCount = 0;
        }
    }, STABILITY_TIMEOUT);
}

// Função de Keep-Alive mais robusta
async function keepAlive() {
    try {
        const now = new Date().toISOString();
        console.log(`[${now}] 💓 Monitor ativo - Bot rodando há ${process.uptime().toFixed(0)}s`);

        // Faz uma requisição HTTP para manter o Replit ativo
        await axios.get(HEALTH_CHECK_URL, { timeout: 5000 });
        console.log(`[${now}] ✅ Keep-alive bem-sucedido com ${HEALTH_CHECK_URL}`);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] ⚠️ Erro no keep-alive: ${error.message}`);
        // Reinicia o bot se o keep-alive falhar (ex.: perda de conexão)
        if (botProcess && !botProcess.killed) {
            botProcess.kill('SIGTERM');
        }
    }
}

// Capturar sinais de término
process.on('SIGINT', () => {
    console.log(`[${new Date().toISOString()}] 🛑 Monitor interrompido pelo usuário`);
    if (botProcess) {
        botProcess.kill('SIGTERM');
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log(`[${new Date().toISOString()}] 🛑 Monitor terminado`);
    if (botProcess) {
        botProcess.kill('SIGTERM');
    }
    process.exit(0);
});

// Iniciar o bot e o keep-alive
startBot();
setInterval(keepAlive, KEEP_ALIVE_INTERVAL);

// Verificar conexão inicial
isInternetConnected().then(connected => {
    if (!connected) {
        console.log(`[${new Date().toISOString()}] ⚠️ Sem conexão com a internet na inicialização. Tentando de qualquer forma...`);
    }
});
