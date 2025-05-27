
const { spawn } = require('child_process');
const fs = require('fs');

console.log("🔄 Monitor do Akira Bot iniciado!");

let botProcess = null;
let restartCount = 0;
const MAX_RESTARTS = 10;
const RESTART_DELAY = 5000; // 5 segundos

function startBot() {
    console.log(`[${new Date().toISOString()}] 🚀 Iniciando bot (tentativa ${restartCount + 1})...`);
    
    botProcess = spawn('node', ['bot.js'], {
        stdio: 'inherit',
        cwd: process.cwd()
    });

    botProcess.on('close', (code) => {
        console.log(`[${new Date().toISOString()}] ⚠️ Bot parou com código: ${code}`);
        
        if (restartCount < MAX_RESTARTS) {
            restartCount++;
            console.log(`[${new Date().toISOString()}] 🔄 Reiniciando em ${RESTART_DELAY/1000}s... (${restartCount}/${MAX_RESTARTS})`);
            
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
    });

    // Reset counter quando bot roda por mais de 10 minutos
    setTimeout(() => {
        if (restartCount > 0) {
            console.log(`[${new Date().toISOString()}] ✅ Bot estável - resetando contador de restarts`);
            restartCount = 0;
        }
    }, 10 * 60 * 1000); // 10 minutos
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

// Iniciar o bot
startBot();

// Keep-alive para manter o Repl ativo
setInterval(() => {
    const now = new Date().toISOString();
    console.log(`[${now}] 💓 Monitor ativo - Bot rodando há ${process.uptime().toFixed(0)}s`);
}, 5 * 60 * 1000); // Log a cada 5 minutos
