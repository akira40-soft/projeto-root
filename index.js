/**
 * ═══════════════════════════════════════════════════════════════════════
 * AKIRA BOT V21 — COM TODAS FUNCIONALIDADES ADICIONADAS
 * ═══════════════════════════════════════════════════════════════════════
 * ✅ Mantém toda a lógica original (STT, TTS, comandos)
 * ✅ Adiciona sistema de níveis/patentes
 * ✅ Adiciona sistema de XP e leveling
 * ✅ Adiciona sistema de banimento
 * ✅ Adiciona sistema premium
 * ✅ Adiciona sistema de registro
 * ✅ Adiciona sistema de economia
 * ✅ Adiciona comandos de diversão
 * ✅ Adiciona stickers personalizados com metadados
 * ✅ Adiciona download de músicas/vídeos do YouTube aprimorado
 * ✅ Adiciona funções de áudio (nightcore, slow, bass, etc.)
 * ✅ Adiciona funções de imagem (efeitos)
 * ✅ Comandos de grupo para Isaac Quarenta apenas
 * ═══════════════════════════════════════════════════════════════════════
 */
// @ts-nocheck
// Importações existentes
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
  delay,
  getContentType,
  downloadContentFromMessage,
  generateWAMessageFromContent,
  proto
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');
const express = require('express');
const QRCode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');
const ytdl = require('@distube/ytdl-core');
const yts = require('yt-search');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { exec, spawn, execSync, execFile } = require('child_process');
const util = require('util');
const googleTTS = require('google-tts-api');
const FormData = require('form-data');
const Webpmux = require('node-webpmux');
// Tentar usar Sharp para pipeline estática (mais estável que FFmpeg para imagens)
let sharp = null;
try { sharp = require('sharp'); } catch (_) { sharp = null; }
// Importações adicionais do projeto referência
const moment = require('moment-timezone');
const crypto = require('crypto');
const cheerio = require('cheerio');
const chalk = require('chalk');
const ms = require('parse-ms');
const toMs = require('ms');


// ...

// ===== CORREÇÃO DEFINITIVA DO FFMPEG (PARA WINDOWS E TODOS OS OS) =====
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

console.log('✅ FFmpeg carregado com sucesso:', ffmpegInstaller.path);
console.log('✅ FFprobe carregado com sucesso:', ffprobeInstaller.path);

const FFMPEG_BIN = ffmpegInstaller.path;
// ================================================================


// ================================================================

// ═══════════════════════════════════════════════════════════════════════
// CONFIGURAÇÕES E CONSTANTES
// ═══════════════════════════════════════════════════════════════════════
const PORT = process.env.PORT || 3000;
const API_URL = process.env.API_URL || 'https://akra35567-akira-softedge.hf.space/api/akira';
const BOT_NUMERO_REAL = '37839265886398';
const PREFIXO = '#'; // Prefixo para comandos extras
const TEMP_FOLDER = './temp';
const BOT_NAME = 'Akira'; // Nome do bot
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
// Configuração Deepgram STT (GRATUITO - 200h/mês)
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || '2700019dc80925c32932ab0aba44d881d20d39f7';
const DEEPGRAM_API_URL = 'https://api.deepgram.com/v1/listen';
// ... (o resto do código continua exatamente como você mandou, sem mais alterações)

// USUÁRIOS COM PERMISSÃO DE DONO (APENAS ISAAC QUARENTA)
const DONO_USERS = [
  { numero: '244937035662', nomeExato: 'Isaac Quarenta' },
  { numero: '244978787009', nomeExato: 'Isaac Quarenta' },
  { numero: '24478787009', nomeExato: 'Isaac Quarenta' },
  { numero: '202391978787009', nomeExato: 'Isaac Quarenta' }
];
// Função para converter duração em segundos para formato legível
function formatDuration(seconds) {
  if (!seconds) return 'Desconhecida';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
 
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
// Sistema de mute melhorado
const mutedUsers = new Map();
const antiLinkGroups = new Set();
const muteCounts = new Map();
// Paths para arquivos JSON (sistema do projeto referência)
const DATABASE_PATH = './database';
const JSON_PATHS = {
  nsfw: `${DATABASE_PATH}/data/nsfw.json`,
  welkom: `${DATABASE_PATH}/data/welkom.json`,
  leveling: `${DATABASE_PATH}/data/leveling.json`,
  antilink: `${DATABASE_PATH}/data/antilink.json`,
  simi: `${DATABASE_PATH}/data/simi.json`,
  bad: `${DATABASE_PATH}/data/bad.json`,
  badword: `${DATABASE_PATH}/data/badword.json`,
  antifake: `${DATABASE_PATH}/data/antifake.json`,
  x9: `${DATABASE_PATH}/data/x9.json`,
  atsticker: `${DATABASE_PATH}/data/atsticker.json`,
  blacklist: `${DATABASE_PATH}/data/blacklist.json`,
  // Data user
  level: `${DATABASE_PATH}/datauser/level.json`,
  registered: `${DATABASE_PATH}/datauser/registered.json`,
  uang: `${DATABASE_PATH}/datauser/uang.json`,
  premium: `${DATABASE_PATH}/datauser/premium.json`,
  banned: `${DATABASE_PATH}/datauser/banned.json`,
  // Outros
  daily: `${DATABASE_PATH}/data/diario.json`,
  dailiy: `${DATABASE_PATH}/data/limitem.json`,
  sotoy: `${DATABASE_PATH}/data/sotoy.json`,
  totalcmd: `${DATABASE_PATH}/data/totalcmd.json`,
  settings: `${DATABASE_PATH}/data/settings.json`
};
// Criar pastas se não existirem
if (!fs.existsSync(DATABASE_PATH)) {
  fs.mkdirSync(DATABASE_PATH, { recursive: true });
  fs.mkdirSync(`${DATABASE_PATH}/data`, { recursive: true });
  fs.mkdirSync(`${DATABASE_PATH}/datauser`, { recursive: true });
}
// Criar arquivos JSON padrão se não existirem
Object.entries(JSON_PATHS).forEach(([key, path]) => {
  if (!fs.existsSync(path)) {
    // blacklist precisa ser um array, mesmo estando em /data
    const isBlacklist = /[\\\/]data[\\\/]blacklist\.json$/.test(path);
    if (isBlacklist) {
      fs.writeFileSync(path, JSON.stringify([], null, 2));
    } else {
      fs.writeFileSync(path, JSON.stringify(path.includes('datauser') ? [] : { default: true }, null, 2));
    }
  }
});
// Criar pasta temp se não existir
if (!fs.existsSync(TEMP_FOLDER)) {
  fs.mkdirSync(TEMP_FOLDER, { recursive: false });
}
// ═══════════════════════════════════════════════════════════════════════
// FUNÇÕES AUXILIARES DO PROJETO REFERÊNCIA (ADAPTADAS)
// ═══════════════════════════════════════════════════════════════════════
// Função para carregar JSON
function loadJSON(path) {
  try {
    const raw = fs.readFileSync(path, 'utf8');
    const data = (raw || '').trim();
    if (!data) {
      const fallback = path.includes('datauser') ? [] : {};
      try { fs.writeFileSync(path, JSON.stringify(fallback, null, 2)); } catch (_) {}
      return fallback;
    }
    return JSON.parse(data);
  } catch (e) {
    const fallback = path.includes('datauser') ? [] : {};
    try { fs.writeFileSync(path, JSON.stringify(fallback, null, 2)); } catch (_) {}
    return fallback;
  }
}
// Função para salvar JSON
function saveJSON(path, data) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
}
// Rate limiting para comandos
const rateLimitMap = new Map();
const RATE_LIMIT = { windowSec: 8, maxCalls: 6 };

function checkRateLimit(userJid) {
  const now = Date.now();
  const rec = rateLimitMap.get(userJid) || [];
  const filtered = rec.filter(t => (now - t) < RATE_LIMIT.windowSec * 1000);
  filtered.push(now);
  rateLimitMap.set(userJid, filtered);
  return filtered.length <= RATE_LIMIT.maxCalls;
}
// Sistema de registro (adaptado)
function checkRegisteredUser(sender) {
  const registered = loadJSON(JSON_PATHS.registered);
  return registered.find(u => u.id === sender);
}
function addRegisteredUser(sender, name, age, time, serial) {
  const registered = loadJSON(JSON_PATHS.registered);
  registered.push({
    id: sender,
    name: name,
    age: age,
    time: time,
    serial: serial,
    registeredAt: Date.now()
  });
  saveJSON(JSON_PATHS.registered, registered);
}
function getRegisterName(sender) {
  const registered = loadJSON(JSON_PATHS.registered);
  const user = registered.find(u => u.id === sender);
  return user ? user.name : 'Não registrado';
}
function getRegisterAge(sender) {
  const registered = loadJSON(JSON_PATHS.registered);
  const user = registered.find(u => u.id === sender);
  return user ? user.age : 'Não registrado';
}
function getRegisterTime(sender) {
  const registered = loadJSON(JSON_PATHS.registered);
  const user = registered.find(u => u.id === sender);
  return user ? user.time : 'Não registrado';
}
function getRegisterSerial(sender) {
  const registered = loadJSON(JSON_PATHS.registered);
  const user = registered.find(u => u.id === sender);
  return user ? user.serial : 'Não registrado';
}
function createSerial(length = 20) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
// Sistema de leveling (adaptado)
function getLevelingLevel(sender) {
  const level = loadJSON(JSON_PATHS.level);
  const user = level.find(u => u.id === sender);
  return user ? user.level : 0;
}
function getLevelingXp(sender) {
  const level = loadJSON(JSON_PATHS.level);
  const user = level.find(u => u.id === sender);
  return user ? user.xp : 0;
}
function getLevelingId(sender) {
  const level = loadJSON(JSON_PATHS.level);
  const user = level.find(u => u.id === sender);
  return user ? user.id : null;
}
function addLevelingId(sender) {
  const level = loadJSON(JSON_PATHS.level);
  if (!level.find(u => u.id === sender)) {
    level.push({ id: sender, level: 0, xp: 0 });
    saveJSON(JSON_PATHS.level, level);
  }
}
function addLevelingXp(sender, xp) {
  const level = loadJSON(JSON_PATHS.level);
  const userIndex = level.findIndex(u => u.id === sender);
 
  if (userIndex !== -1) {
    level[userIndex].xp += xp;
    saveJSON(JSON_PATHS.level, level);
  }
}
function addLevelingLevel(sender, levelAdd = 1) {
  const level = loadJSON(JSON_PATHS.level);
  const userIndex = level.findIndex(u => u.id === sender);
 
  if (userIndex !== -1) {
    level[userIndex].level += levelAdd;
    saveJSON(JSON_PATHS.level, level);
  }
}
// Level por grupo — novas funções
function loadGroupLevels() { try { return loadJSON(JSON_PATHS.level); } catch (e) { return []; } }
function saveGroupLevels(arr) { try { saveJSON(JSON_PATHS.level, arr); } catch (_) {} }
function getGroupLevelRecord(gid, uid, createIfMissing=false) {
  const data = loadGroupLevels();
  let rec = data.find(r => r && r.gid === gid && r.uid === uid);
  if (!rec && createIfMissing) { rec = { gid, uid, level: 0, xp: 0 }; data.push(rec); saveGroupLevels(data); }
  return rec || { gid, uid, level: 0, xp: 0 };
}
function saveGroupLevelRecord(rec) {
  const data = loadGroupLevels();
  const i = data.findIndex(r => r && r.gid === rec.gid && r.uid === rec.uid);
  if (i === -1) data.push(rec); else data[i] = rec;
  saveGroupLevels(data);
}
function getRequiredGroupXp(level) {
  // ═══════════════════════════════════════════════════════════════════════
  // NOVO SISTEMA: Dificuldade Exponencial 12x
  // Cada nível é 12x mais difícil que o anterior
  // ═══════════════════════════════════════════════════════════════════════
  const MAX_LEVEL = 100;
  if (level >= MAX_LEVEL) return Infinity; // Nível máximo atingido
  if (level === 0) return 100; // Base para nível 1
  // Fórmula: 100 * (12^level) — crescimento exponencial com base 12
  return Math.floor(100 * Math.pow(12, level));
}

// ═══════════════════════════════════════════════════════════════════════
// NOVO SISTEMA: AUTO-ADM POR MAX LEVEL EM 3 DIAS
// ═══════════════════════════════════════════════════════════════════════
const LEVEL_SYSTEM_CONFIG = {
  maxLevel: 100,
  windowDays: 3,
  topUsersForADM: 3,
  enableAutoAdmCommand: 'leveladm'
};

// Arquivo para controle de auto-ADM por grupo
const LEVEL_ADM_JSON = 'database/datauser/level_adm_config.json';
const LEVEL_ADM_PROMOTION = 'database/datauser/level_adm_promotion.json';

function loadLevelADMConfig() {
  try {
    return loadJSON(LEVEL_ADM_JSON) || {};
  } catch (_) {
    return {};
  }
}

function saveLevelADMConfig(config) {
  try {
    saveJSON(LEVEL_ADM_JSON, config);
  } catch (e) {
    console.error('Erro ao salvar configuração de ADM por Level:', e);
  }
}

function loadLevelADMPromotion() {
  try {
    return loadJSON(LEVEL_ADM_PROMOTION) || {};
  } catch (_) {
    return {};
  }
}

function saveLevelADMPromotion(promo) {
  try {
    saveJSON(LEVEL_ADM_PROMOTION, promo);
  } catch (e) {
    console.error('Erro ao salvar promoção de ADM:', e);
  }
}

// Registra quando usuário atinge max level
async function registerMaxLevelUser(gid, uid, userName, sock) {
  const promo = loadLevelADMPromotion();
  
  // Inicializa janela de 3 dias para este grupo se não existir
  if (!promo[gid]) {
    promo[gid] = {
      windowStart: Date.now(),
      windowEnd: Date.now() + (3 * 24 * 60 * 60 * 1000), // 3 dias
      maxLevelUsers: [],
      promotedToADM: [],
      failedUsers: []
    };
  }
  
  const window = promo[gid];
  
  // Limpa janela se expirou
  if (Date.now() > window.windowEnd) {
    promo[gid] = {
      windowStart: Date.now(),
      windowEnd: Date.now() + (3 * 24 * 60 * 60 * 1000),
      maxLevelUsers: [],
      promotedToADM: [],
      failedUsers: []
    };
  }
  
  // Se usuário já falhou nesta janela, não permite novo tentativa
  if (window.failedUsers.includes(uid)) {
    return {
      success: false,
      message: `❌ Você já tentou e falhou nesta janela de ${LEVEL_SYSTEM_CONFIG.windowDays} dias. Tente na próxima!`
    };
  }
  
  // Se já promovido, não adiciona novamente
  if (window.promotedToADM.includes(uid)) {
    return {
      success: false,
      message: `✨ Você já foi promovido a ADM nesta janela!`
    };
  }
  
  // Adiciona à lista de max level
  if (!window.maxLevelUsers.find(u => u.uid === uid)) {
    window.maxLevelUsers.push({
      uid,
      userName,
      timestamp: Date.now(),
      position: window.maxLevelUsers.length + 1
    });
  }
  
  // Verifica se é um dos top 3 E se auto-ADM está habilitado
  const config = loadLevelADMConfig();
  const isAutoADMEnabled = config[gid]?.autoADMEnabled === true;
  
  if (isAutoADMEnabled && window.maxLevelUsers.length <= LEVEL_SYSTEM_CONFIG.topUsersForADM) {
    const position = window.maxLevelUsers.findIndex(u => u.uid === uid) + 1;
    
    if (position <= LEVEL_SYSTEM_CONFIG.topUsersForADM) {
      try {
        // Promove a ADM
        window.promotedToADM.push(uid);
        saveLevelADMPromotion(promo);
        
        // Envia mensagem de promoção
        await sock.groupUpdateDescription(gid, `Akira Bot - ADM: ${userName} (Nível ${LEVEL_SYSTEM_CONFIG.maxLevel} - Top ${position}/3)`);
        
        return {
          success: true,
          promoted: true,
          position,
          message: `🎊 PARABÉNS ${userName}! Você foi promovido a ADM (Top ${position}/3 em ${LEVEL_SYSTEM_CONFIG.windowDays} dias)!`
        };
      } catch (e) {
        console.error('Erro ao promover ADM:', e);
        return {
          success: false,
          message: `⚠️ Erro ao promover ADM. Tente novamente mais tarde.`
        };
      }
    }
  }
  
  saveLevelADMPromotion(promo);
  return {
    success: true,
    promoted: false,
    message: `✅ Max Level atingido! Você está na posição ${window.maxLevelUsers.length}/${LEVEL_SYSTEM_CONFIG.topUsersForADM} para ADM.`
  };
}

// Marca usuário como falhado na janela de max level
function markMaxLevelFailed(gid, uid) {
  const promo = loadLevelADMPromotion();
  
  if (!promo[gid]) {
    promo[gid] = {
      windowStart: Date.now(),
      windowEnd: Date.now() + (3 * 24 * 60 * 60 * 1000),
      maxLevelUsers: [],
      promotedToADM: [],
      failedUsers: [uid]
    };
  } else {
    if (!promo[gid].failedUsers.includes(uid)) {
      promo[gid].failedUsers.push(uid);
    }
  }
  
  saveLevelADMPromotion(promo);
}

// Reseta sistema de ADM para um grupo (apenas Isaac)
function resetMaxLevelSystem(gid) {
  const promo = loadLevelADMPromotion();
  promo[gid] = {
    windowStart: Date.now(),
    windowEnd: Date.now() + (3 * 24 * 60 * 60 * 1000),
    maxLevelUsers: [],
    promotedToADM: [],
    failedUsers: []
  };
  saveLevelADMPromotion(promo);
  return '✅ Sistema de max level resetado para este grupo!';
}

// Alterna auto-ADM para um grupo (apenas Isaac)
function toggleMaxLevelAutoADM(gid, enable) {
  const config = loadLevelADMConfig();
  if (!config[gid]) {
    config[gid] = {};
  }
  config[gid].autoADMEnabled = enable === true;
  saveLevelADMConfig(config);
  return `✅ Auto-ADM no max level ${enable ? 'ativado' : 'desativado'} para este grupo!`;
}

// Obtém status do sistema de max level para um grupo
function getMaxLevelStatus(gid) {
  const promo = loadLevelADMPromotion();
  const config = loadLevelADMConfig();
  const window = promo[gid];
  
  if (!window) {
    return {
      isActive: false,
      status: 'Nenhuma janela de max level ativa'
    };
  }
  
  const daysRemaining = Math.max(0, Math.ceil((window.windowEnd - Date.now()) / (24 * 60 * 60 * 1000)));
  
  return {
    isActive: true,
    daysRemaining,
    maxLevelUsers: window.maxLevelUsers,
    promotedToADM: window.promotedToADM,
    failedUsers: window.failedUsers,
    autoADMEnabled: config[gid]?.autoADMEnabled === true,
    status: `${window.maxLevelUsers.length}/${LEVEL_SYSTEM_CONFIG.topUsersForADM} usuários no max level (${daysRemaining} dias restantes)`
  };
}

// Sistema de patentes (adaptado do projeto referência)
function getPatente(nivelAtual) {
    let patt = 'Recruta 🔰';
    if (nivelAtual >= 61) patt = 'A Lenda  легенда 🛐';
    else if (nivelAtual >= 60) patt = 'Transcendente V ✨';
    else if (nivelAtual >= 59) patt = 'Transcendente IV ✨';
    else if (nivelAtual >= 58) patt = 'Transcendente III ✨';
    else if (nivelAtual >= 57) patt = 'Transcendente II ✨';
    else if (nivelAtual >= 56) patt = 'Transcendente I ✨';
    else if (nivelAtual >= 55) patt = 'Divino V 💠';
    else if (nivelAtual >= 54) patt = 'Divino IV 💠';
    else if (nivelAtual >= 53) patt = 'Divino III 💠';
    else if (nivelAtual >= 52) patt = 'Divino II 💠';
    else if (nivelAtual >= 51) patt = 'Divino I 💠';
    else if (nivelAtual >= 50) patt = 'Imortal V ⚡';
    else if (nivelAtual >= 49) patt = 'Imortal IV ⚡';
    else if (nivelAtual >= 48) patt = 'Imortal III ⚡';
    else if (nivelAtual >= 47) patt = 'Imortal II ⚡';
    else if (nivelAtual >= 46) patt = 'Imortal I ⚡';
    else if (nivelAtual >= 45) patt = 'Lendário V 🎖️';
    else if (nivelAtual >= 44) patt = 'Lendário IV 🎖️';
    else if (nivelAtual >= 43) patt = 'Lendário III 🎖️';
    else if (nivelAtual >= 42) patt = 'Lendário II 🎖️';
    else if (nivelAtual >= 41) patt = 'Lendário I 🎖️';
    else if (nivelAtual >= 40) patt = 'God V 🕴️';
    else if (nivelAtual >= 39) patt = 'God IV 🕴️';
    else if (nivelAtual >= 38) patt = 'God III 🕴️';
    else if (nivelAtual >= 37) patt = 'God II 🕴️';
    else if (nivelAtual >= 36) patt = 'God I 🕴️';
    else if (nivelAtual >= 35) patt = 'Mítico V 🔮';
    else if (nivelAtual >= 34) patt = 'Mítico IV 🔮';
    else if (nivelAtual >= 33) patt = 'Mítico III 🔮';
    else if (nivelAtual >= 32) patt = 'Mítico II 🔮';
    else if (nivelAtual >= 31) patt = 'Mítico I 🔮';
    else if (nivelAtual >= 30) patt = 'Mestre V 🐂';
    else if (nivelAtual >= 29) patt = 'Mestre IV 🐂';
    else if (nivelAtual >= 28) patt = 'Mestre III 🐂';
    else if (nivelAtual >= 27) patt = 'Mestre II 🐂';
    else if (nivelAtual >= 26) patt = 'Mestre I 🐂';
    else if (nivelAtual >= 25) patt = 'Diamante V 💎';
    else if (nivelAtual >= 24) patt = 'Diamante IV 💎';
    else if (nivelAtual >= 23) patt = 'Diamante III 💎';
    else if (nivelAtual >= 22) patt = 'Diamante II 💎';
    else if (nivelAtual >= 21) patt = 'Diamante I 💎';
    else if (nivelAtual >= 20) patt = 'Campeão V 🏆';
    else if (nivelAtual >= 19) patt = 'Campeão IV 🏆';
    else if (nivelAtual >= 18) patt = 'Campeão III 🏆';
    else if (nivelAtual >= 17) patt = 'Campeão II 🏆';
    else if (nivelAtual >= 16) patt = 'Campeão I 🏆';
    else if (nivelAtual >= 15) patt = 'Ouro V 🥇';
    else if (nivelAtual >= 14) patt = 'Ouro IV 🥇';
    else if (nivelAtual >= 13) patt = 'Ouro III 🥇';
    else if (nivelAtual >= 12) patt = 'Ouro II 🥇';
    else if (nivelAtual >= 11) patt = 'Ouro I 🥇';
    else if (nivelAtual >= 10) patt = 'Prata V 🥈';
    else if (nivelAtual >= 9) patt = 'Prata IV 🥈';
    else if (nivelAtual >= 8) patt = 'Prata III 🥈';
    else if (nivelAtual >= 7) patt = 'Prata II 🥈';
    else if (nivelAtual >= 6) patt = 'Prata I 🥈';
    else if (nivelAtual >= 5) patt = 'Bronze V 🥉';
    else if (nivelAtual >= 4) patt = 'Bronze IV 🥉';
    else if (nivelAtual >= 3) patt = 'Bronze III 🥉';
    else if (nivelAtual >= 2) patt = 'Bronze II 🥉';
    else if (nivelAtual >= 1) patt = 'Bronze I 🥉';
    return patt;
}
// Sistema de economia (dinheiro) - adaptado
function checkATMuser(sender) {
  const uang = loadJSON(JSON_PATHS.uang);
  return uang.find(u => u.id === sender);
}
function addATM(sender) {
  const uang = loadJSON(JSON_PATHS.uang);
  if (!uang.find(u => u.id === sender)) {
    uang.push({ id: sender, money: 0 });
    saveJSON(JSON_PATHS.uang, uang);
  }
}
function addKoinUser(sender, amount) {
  const uang = loadJSON(JSON_PATHS.uang);
  const userIndex = uang.findIndex(u => u.id === sender);
 
  if (userIndex !== -1) {
    uang[userIndex].money += amount;
    saveJSON(JSON_PATHS.uang, uang);
  }
}
// Sistema de banimento - adaptado
function cekBannedUser(sender, banList = null) {
  if (!banList) banList = loadJSON(JSON_PATHS.banned);
  const user = banList.find(u => u.id === sender);
  if (!user) return false;
 
  if (user.expired === 'PERMANENT') return true;
  if (Date.now() > user.expired) {
    unBanned(sender, banList);
    return false;
  }
  return true;
}
function addBanned(sender, time, banList = null) {
  if (!banList) banList = loadJSON(JSON_PATHS.banned);
 
  let expired = 'PERMANENT';
  if (time) {
    const msTime = toMs(time);
    if (msTime) expired = Date.now() + msTime;
  }
 
  banList.push({ id: sender, expired: expired });
  saveJSON(JSON_PATHS.banned, banList);
}
function unBanned(sender, banList = null) {
  if (!banList) banList = loadJSON(JSON_PATHS.banned);
  const index = banList.findIndex(u => u.id === sender);
  if (index !== -1) {
    banList.splice(index, 1);
    saveJSON(JSON_PATHS.banned, banList);
  }
}
// Sistema premium - adaptado
function checkPremiumUser(sender, premiumList = null) {
  if (!premiumList) premiumList = loadJSON(JSON_PATHS.premium);
  const user = premiumList.find(u => u.id === sender);
  if (!user) return false;
 
  if (user.expired === 'PERMANENT') return true;
  if (Date.now() > user.expired) {
    dellprem(sender, premiumList);
    return false;
  }
  return true;
}
function addPremiumUser(sender, time, premiumList = null) {
  if (!premiumList) premiumList = loadJSON(JSON_PATHS.premium);
 
  let expired = 'PERMANENT';
  if (time) {
    const msTime = toMs(time);
    if (msTime) expired = Date.now() + msTime;
  }
 
  premiumList.push({ id: sender, expired: expired });
  saveJSON(JSON_PATHS.premium, premiumList);
}
function dellprem(sender, premiumList = null) {
  if (!premiumList) premiumList = loadJSON(JSON_PATHS.premium);
  const index = premiumList.findIndex(u => u.id === sender);
  if (index !== -1) {
    premiumList.splice(index, 1);
    saveJSON(JSON_PATHS.premium, premiumList);
  }
}
// Sistema anti-spam - adaptado
let antispam = new Map();
// Anti-flood e blacklist
const HOURLY_LIMIT = 300;
const HOURLY_WINDOW_MS = 60 * 60 * 1000;
const OVERLIMIT_ATTEMPTS_BLACKLIST = 12;
const userRate = new Map(); // key: jid -> { windowStart, count, blockedUntil, warningSent, overAttempts }
function loadBlacklist() {
  try {
    const data = loadJSON(JSON_PATHS.blacklist);
    if (Array.isArray(data)) return data;
    // se veio malformado (ex.: {}), reescreve para []
    saveJSON(JSON_PATHS.blacklist, []);
    return [];
  } catch (_) {
    try { saveJSON(JSON_PATHS.blacklist, []); } catch (__) {}
    return [];
  }
}
function saveBlacklist(list) {
  try { saveJSON(JSON_PATHS.blacklist, Array.isArray(list) ? list : []); } catch (_) {}
}
function isBlacklisted(jid) {
  const list = loadBlacklist();
  if (!Array.isArray(list)) return false;
  return !!list.find(x => x && x.id === jid);
}
function addToBlacklist(jid, reason = 'limit') {
  const list = loadBlacklist();
  const arr = Array.isArray(list) ? list : [];
  if (!arr.find(x => x && x.id === jid)) {
    arr.push({ id: jid, reason, addedAt: Date.now() });
    saveBlacklist(arr);
  }
}
function removeFromBlacklist(jid) {
  const list = loadBlacklist();
  const arr = Array.isArray(list) ? list : [];
  const i = arr.findIndex(x => x && x.id === jid);
  if (i !== -1) { arr.splice(i,1); saveBlacklist(arr); }
}
function checkAndUpdateHourlyLimit(jid) {
  const now = Date.now();
  const rec = userRate.get(jid) || { windowStart: now, count: 0, blockedUntil: 0, warningSent: false, overAttempts: 0 };
  if (now - rec.windowStart >= HOURLY_WINDOW_MS) {
    rec.windowStart = now; rec.count = 0; rec.blockedUntil = 0; rec.warningSent = false; rec.overAttempts = 0;
  }
  if (rec.blockedUntil && now < rec.blockedUntil) {
    rec.overAttempts++;
    if (rec.overAttempts >= OVERLIMIT_ATTEMPTS_BLACKLIST) {
      addToBlacklist(jid, 'abuse');
    }
    userRate.set(jid, rec);
    return { allowed: false, sendWarning: false };
  }
  rec.count++;
  userRate.set(jid, rec);
  if (rec.count > HOURLY_LIMIT) {
    rec.blockedUntil = now + HOURLY_WINDOW_MS;
    userRate.set(jid, rec);
    if (!rec.warningSent) { rec.warningSent = true; userRate.set(jid, rec); return { allowed: false, sendWarning: true }; }
    return { allowed: false, sendWarning: false };
  }
  return { allowed: true, sendWarning: false };
}
function isFiltered(from) {
  const now = Date.now();
  const userData = antispam.get(from) || [];
 
  // Limpa entradas antigas (3 segundos)
  const filtered = userData.filter(t => (now - t) < 3000);
 
  if (filtered.length > 0) {
    return true;
  }
 
  filtered.push(now);
  antispam.set(from, filtered);
  return false;
}
function addFilter(from) {
  const now = Date.now();
  const userData = antispam.get(from) || [];
  userData.push(now);
  antispam.set(from, userData);
}
// Funções auxiliares do projeto referência
function getRandom(ext = '') {
  const timestamp = new Date().getTime();
  const random = Math.floor(Math.random() * 1000);
  return `${timestamp}${random}${ext}`;
}
function h2k(number) {
  const units = ['', 'K', 'M', 'B', 'T'];
  let unitIndex = 0;
  let num = number;
 
  while (num >= 1000 && unitIndex < units.length - 1) {
    num /= 1000;
    unitIndex++;
  }
 
  return num.toFixed(1).replace(/\.0$/, '') + units[unitIndex];
}
function generateMessageID() {
  return `AKIRA_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
function getGroupAdmins(participants) {
  return participants.filter(p => p.admin).map(p => p.id);
}
// ═══════════════════════════════════════════════════════════════════════
// FUNÇÕES ORIGINAIS DO CÓDIGO BASE (MANTIDAS)
// ═══════════════════════════════════════════════════════════════════════
let sock = null;
let BOT_JID = null;
let BOT_JID_ALTERNATIVO = null;
let currentQR = null;
let lastProcessedTime = 0;
const processadas = new Set();

function verificarPermissaoDono(numero, nome) {
  try {
    const numeroLimpo = String(numero).trim();
    const nomeLimpo = String(nome).trim();
   
    return DONO_USERS.some(dono =>
      numeroLimpo === dono.numero && nomeLimpo === dono.nomeExato
    );
  } catch (e) {
    return false;
  }
}
function isUserMuted(groupId, userId) {
  const key = `${groupId}_${userId}`;
  const muteData = mutedUsers.get(key);
 
  if (!muteData) return false;
 
  if (Date.now() > muteData.expires) {
    mutedUsers.delete(key);
    return false;
  }
 
  return true;
}
function getMuteCount(groupId, userId) {
  const key = `${groupId}_${userId}`;
  const today = new Date().toDateString();
  const countData = muteCounts.get(key);
 
  if (!countData || countData.lastMuteDate !== today) {
    return 0;
  }
 
  return countData.count || 0;
}
function incrementMuteCount(groupId, userId) {
  const key = `${groupId}_${userId}`;
  const today = new Date().toDateString();
  const countData = muteCounts.get(key) || { count: 0, lastMuteDate: today };
 
  if (countData.lastMuteDate !== today) {
    countData.count = 0;
    countData.lastMuteDate = today;
  }
 
  countData.count += 1;
  muteCounts.set(key, countData);
 
  return countData.count;
}
function muteUser(groupId, userId, minutes = 5) {
  const key = `${groupId}_${userId}`;
 
  const muteCount = incrementMuteCount(groupId, userId);
 
  let muteMinutes = minutes;
  if (muteCount > 1) {
    muteMinutes = minutes * Math.pow(2, muteCount - 1);
    console.log(`⚠️ [MUTE INTENSIFICADO] Usuário ${userId} muteado ${muteCount}x hoje. Tempo: ${muteMinutes} minutos`);
  }
 
  const expires = Date.now() + (muteMinutes * 60 * 1000);
  mutedUsers.set(key, {
    expires,
    mutedAt: Date.now(),
    minutes: muteMinutes,
    muteCount: muteCount
  });
 
  return { expires, muteMinutes, muteCount };
}
function unmuteUser(groupId, userId) {
  const key = `${groupId}_${userId}`;
  return mutedUsers.delete(key);
}
function toggleAntiLink(groupId, enable = true) {
  if (enable) {
    antiLinkGroups.add(groupId);
  } else {
    antiLinkGroups.delete(groupId);
  }
  return enable;
}
function isAntiLinkActive(groupId) {
  return antiLinkGroups.has(groupId);
}
function containsLink(text) {
  if (!text) return false;
  // Regex mais robusto para detectar links: URLs completas, www., IPs com portas, e domínios com TLDs
  const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|(\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?\b)|([a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*)/gi;
  return urlRegex.test(text);
}
// STORE
const baileys = require('@whiskeysockets/baileys');
let store;
if (typeof baileys.makeInMemoryStore === 'function') {
  try {
    store = baileys.makeInMemoryStore({ logger });
  } catch (e) {
    store = null;
  }
}
if (!store) {
  const _map = new Map();
  store = {
    bind: () => {},
    async loadMessage(jid, id) {
      return _map.get(`${jid}|${id}`) || undefined;
    },
    saveMessage(jid, id, msg) {
      _map.set(`${jid}|${id}`, msg);
    }
  };
}
// FUNÇÕES AUXILIARES MELHORADAS
function extrairNumeroReal(m) {
  try {
    const key = m.key || {};
    const message = m.message || {};
   
    if (key.remoteJid && !String(key.remoteJid).endsWith('@g.us')) {
      return String(key.remoteJid).split('@')[0];
    }
   
    if (key.participant) {
      const participant = String(key.participant);
      if (participant.includes('@s.whatsapp.net')) {
        return participant.split('@')[0];
      }
      if (participant.includes('@lid')) {
        const limpo = participant.split(':')[0];
        const digitos = limpo.replace(/\D/g, '');
        if (digitos.length >= 9) {
          return '244' + digitos.slice(-9);
        }
      }
    }
   
    return 'desconhecido';
   
  } catch (e) {
    logger.error({ e }, 'Erro ao extrair número');
    return 'desconhecido';
  }
}
function obterParticipanteGrupo(m) {
  try {
    const key = m.key || {};
   
    if (key.participant) {
      return key.participant;
    }
   
    const context = m.message?.extendedTextMessage?.contextInfo;
    if (context?.participant) {
      return context.participant;
    }
   
    return null;
   
  } catch (e) {
    return null;
  }
}
function converterLidParaNumero(lid) {
  if (!lid) return null;
  try {
    const limpo = String(lid).split('@')[0].split(':')[0];
    const digitos = limpo.replace(/\D/g, '');
    if (digitos.length >= 9) {
      return '244' + digitos.slice(-9);
    }
    return null;
  } catch (e) {
    return null;
  }
}
function ehOBot(jid) {
  if (!jid) return false;
  const jidStr = String(jid).toLowerCase();
  const jidNumero = jidStr.split('@')[0].split(':')[0];
 
  if (BOT_JID) {
    const botNumero = String(BOT_JID).toLowerCase().split('@')[0].split(':')[0];
    if (jidNumero === botNumero || jidStr.includes(botNumero)) {
      return true;
    }
  }
 
  if (BOT_JID_ALTERNATIVO) {
    const altNumero = String(BOT_JID_ALTERNATIVO).toLowerCase().split('@')[0].split(':')[0];
    if (jidNumero === altNumero || jidStr.includes(altNumero)) {
      return true;
    }
  }
 
  if (jidNumero === BOT_NUMERO_REAL || jidStr.includes(BOT_NUMERO_REAL)) {
    return true;
  }
 
  return false;
}
function extrairTexto(m) {
  try {
    const tipo = getContentType(m.message);
    if (!tipo) return '';
   
    if (tipo === 'conversation') {
      return m.message.conversation || '';
    }
    if (tipo === 'extendedTextMessage') {
      return m.message.extendedTextMessage?.text || '';
    }
    if (tipo === 'imageMessage') {
      return m.message.imageMessage?.caption || '';
    }
    if (tipo === 'videoMessage') {
      return m.message.videoMessage?.caption || '';
    }
    if (tipo === 'audioMessage') {
      return '[mensagem de voz]';
    }
    if (tipo === 'stickerMessage') {
      return '[figurinha]';
    }
   
    return '';
  } catch (e) {
    return '';
  }
}
// ═══════════════════════════════════════════════════════════════════════
// FUNÇÃO CRÍTICA CORRIGIDA: EXTRAIR REPLY INFO COM CONTEXTO SUPER CLARO
// ═══════════════════════════════════════════════════════════════════════
function extrairReplyInfo(m) {
  try {
    const context = m.message?.extendedTextMessage?.contextInfo;
    if (!context || !context.quotedMessage) return null;
    
    const quoted = context.quotedMessage;
    const tipo = getContentType(quoted);
    
    // === EXTRAI TEXTO DA MENSAGEM CITADA ===
    let textoMensagemCitada = '';
    let tipoMidia = 'texto';
    
    if (tipo === 'conversation') {
      textoMensagemCitada = quoted.conversation || '';
      tipoMidia = 'texto';
    } else if (tipo === 'extendedTextMessage') {
      textoMensagemCitada = quoted.extendedTextMessage?.text || '';
      tipoMidia = 'texto';
    } else if (tipo === 'imageMessage') {
      textoMensagemCitada = quoted.imageMessage?.caption || '[imagem]';
      tipoMidia = 'imagem';
    } else if (tipo === 'videoMessage') {
      textoMensagemCitada = quoted.videoMessage?.caption || '[vídeo]';
      tipoMidia = 'video';
    } else if (tipo === 'audioMessage') {
      textoMensagemCitada = '[áudio]';
      tipoMidia = 'audio';
    } else if (tipo === 'stickerMessage') {
      textoMensagemCitada = '[figurinha]';
      tipoMidia = 'sticker';
    } else {
      textoMensagemCitada = '[conteúdo]';
      tipoMidia = 'outro';
    }
    
    // === IDENTIFICA QUEM ESCREVEU A MENSAGEM CITADA ===
    const participantJidCitado = context.participant || null;
    const ehRespostaAoBot = ehOBot(participantJidCitado);
    
    // Informações de quem escreveu a mensagem citada
    let nomeQuemEscreveuCitacao = 'desconhecido';
    let numeroQuemEscreveuCitacao = 'desconhecido';
    
    if (participantJidCitado) {
      try {
        const usuario = store?.contacts?.[participantJidCitado] || {};
        nomeQuemEscreveuCitacao = usuario.name || usuario.notify || participantJidCitado.split('@')[0] || 'desconhecido';
        numeroQuemEscreveuCitacao = participantJidCitado.split('@')[0] || 'desconhecido';
      } catch (e) {
        console.error('Erro ao obter info de quem escreveu citação:', e);
      }
    }
    
    // === IDENTIFICA QUEM ESTÁ FALANDO AGORA (A MENSAGEM ATUAL) ===
    const quemFalaAgoraJid = m.key.participant || m.key.remoteJid;
    let nomeQuemFalaAgora = m.pushName || 'desconhecido';
    let numeroQuemFalaAgora = extrairNumeroReal(m);
    
    // ===  CORREÇÃO CRÍTICA: MARCA EXPLICITAMENTE SE É REPLY À AKIRA ===
    let contextoClaro = '';
    if (ehRespostaAoBot) {
      // Se está respondendo ao bot, a mensagem citada é DA AKIRA
      contextoClaro = `CONTEXTO: ${nomeQuemFalaAgora} está respondendo à mensagem anterior DA AKIRA que dizia: "${textoMensagemCitada}"`;
    } else {
      // Se está respondendo a outra pessoa
      contextoClaro = `CONTEXTO: ${nomeQuemFalaAgora} está comentando sobre algo que ${nomeQuemEscreveuCitacao} disse: "${textoMensagemCitada}"`;
    }
    
    return {
      // === QUEM ESTÁ FALANDO AGORA (PRIORIDADE MÁXIMA) ===
      quemFalaAgoraJid: quemFalaAgoraJid,
      quemFalaAgoraNome: nomeQuemFalaAgora,
      quemFalaAgoraNumero: numeroQuemFalaAgora,
      
      // === INFORMAÇÕES DA MENSAGEM CITADA ===
      textoMensagemCitada: textoMensagemCitada,
      tipoMidiaCitada: tipoMidia,
      
      // === QUEM ESCREVEU A MENSAGEM CITADA (PODE SER AKIRA OU OUTRO) ===
      quemEscreveuCitacaoJid: participantJidCitado,
      quemEscreveuCitacaoNome: nomeQuemEscreveuCitacao,
      quemEscreveuCitacaoNumero: numeroQuemEscreveuCitacao,
      
      // === FLAGS IMPORTANTES ===
      ehRespostaAoBot: ehRespostaAoBot, // TRUE se a mensagem citada é DA AKIRA
      
      // === CONTEXTO SUPER CLARO PARA API ===
      contextoClaro: contextoClaro,
      
      // === FLAGS DE TIPO ===
      ehSticker: tipo === 'stickerMessage',
      ehAudio: tipo === 'audioMessage',
      ehImagem: tipo === 'imageMessage',
      ehVideo: tipo === 'videoMessage'
    };
    
  } catch (e) {
    console.error('Erro ao extrair reply info:', e);
    return null;
  }
}
async function deveResponder(m, ehGrupo, texto, replyInfo, temAudio = false) {
  const textoLower = String(texto).toLowerCase();
  const context = m.message?.extendedTextMessage?.contextInfo;
 
  if (temAudio) {
    if (!ehGrupo) {
      console.log('✅ [ATIVAÇÃO ÁUDIO] PV - Sempre responde');
      return true;
    }
   
    if (replyInfo && replyInfo.ehRespostaAoBot) {
      console.log('✅ [ATIVAÇÃO ÁUDIO] Reply ao bot detectado');
      return true;
    }
   
    if (textoLower.includes('akira')) {
      console.log('✅ [ATIVAÇÃO ÁUDIO] Menção "akira" detectada');
      return true;
    }
   
    const mentions = context?.mentionedJid || [];
    const botMencionado = mentions.some(jid => ehOBot(jid));
   
    if (botMencionado) {
      console.log('✅ [ATIVAÇÃO ÁUDIO] @mention do bot');
      return true;
    }
   
    if (BOT_JID_ALTERNATIVO) {
      const jidAltNumero = String(BOT_JID_ALTERNATIVO).split('@')[0].split(':')[0];
      if (textoLower.includes(jidAltNumero)) {
        console.log('✅ [ATIVAÇÃO ÁUDIO] Menção ao JID alternativo');
        return true;
      }
    }
   
    console.log('❌ [IGNORADO] Grupo sem menção/reply ao bot em áudio');
    return false;
  }
 
  if (replyInfo && replyInfo.ehRespostaAoBot) {
    console.log('✅ [ATIVAÇÃO TEXTO] Reply ao bot detectado');
    return true;
  }
 
  if (ehGrupo) {
    if (textoLower.includes('akira')) {
      console.log('✅ [ATIVAÇÃO TEXTO] Menção "akira" detectada');
      return true;
    }
   
    const mentions = context?.mentionedJid || [];
    const botMencionado = mentions.some(jid => ehOBot(jid));
   
    if (botMencionado) {
      console.log('✅ [ATIVAÇÃO TEXTO] @mention do bot');
      return true;
    }
   
    if (BOT_JID_ALTERNATIVO) {
      const jidAltNumero = String(BOT_JID_ALTERNATIVO).split('@')[0].split(':')[0];
      if (textoLower.includes(jidAltNumero)) {
        console.log('✅ [ATIVAÇÃO TEXTO] Menção ao JID alternativo');
        return true;
      }
    }
   
    console.log('❌ [IGNORADO] Grupo sem menção/reply ao bot');
    return false;
  }
 
  return true;
}
// FUNÇÃO PARA MENSAGEM EDITÁVEL
let progressMessages = new Map();
async function sendProgressMessage(sock, jid, text, originalMsg = null, userId = null) {
  try {
    if (originalMsg && userId) {
      const key = `${userId}_${originalMsg.key.id}`;
      const progressData = progressMessages.get(key);
     
      if (progressData && progressData.key) {
        try {
          await sock.sendMessage(jid, {
            text: text,
            edit: progressData.key
          });
          console.log('✏️ Mensagem de progresso atualizada');
          return progressData.key;
        } catch (e) {
          console.log('⚠️ Não foi possível editar mensagem, enviando nova...');
        }
      }
    }
   
    const sentMsg = await sock.sendMessage(jid, { text: text });
   
    if (originalMsg && userId && sentMsg.key) {
      const key = `${userId}_${originalMsg.key.id}`;
      progressMessages.set(key, {
        key: sentMsg.key,
        timestamp: Date.now()
      });
     
      setTimeout(() => {
        progressMessages.delete(key);
      }, 10 * 60 * 1000);
    }
   
    return sentMsg.key;
  } catch (e) {
    console.error('Erro ao enviar mensagem de progresso:', e);
    return null;
  }
}
// ═══════════════════════════════════════════════════════════════════════
// FUNÇÕES PARA STT (SPEECH TO TEXT) - DEEPGRAM API (MANTIDAS)
// ═══════════════════════════════════════════════════════════════════════
async function transcreverAudioParaTexto(audioBuffer) {
  try {
    console.log('🔊 Iniciando transcrição REAL de áudio (Deepgram)...');
   
    const audioPath = path.join(TEMP_FOLDER, `audio_${Date.now()}.ogg`);
    fs.writeFileSync(audioPath, audioBuffer);
   
    const convertedPath = path.join(TEMP_FOLDER, `audio_${Date.now()}.mp3`);
   
    await new Promise((resolve, reject) => {
      ffmpeg(audioPath)
        .toFormat('mp3')
        .audioCodec('libmp3lame')
        .on('end', resolve)
        .on('error', reject)
        .save(convertedPath);
    });
   
    const convertedBuffer = fs.readFileSync(convertedPath);
   
    if (!DEEPGRAM_API_KEY || DEEPGRAM_API_KEY === 'seu_token_aqui') {
      console.log('⚠️ API Key do Deepgram não configurada.');
     
      try {
        fs.unlinkSync(audioPath);
        fs.unlinkSync(convertedPath);
      } catch (e) {}
     
      return {
        texto: "Olá! Recebi seu áudio mas preciso que configure o token do Deepgram para transcrição real.",
        sucesso: false
      };
    }
   
    console.log('📤 Enviando para Deepgram API...');
   
    const response = await axios.post(
      DEEPGRAM_API_URL,
      convertedBuffer,
      {
        headers: {
          'Authorization': `Token ${DEEPGRAM_API_KEY}`,
          'Content-Type': 'audio/mpeg'
        },
        params: {
          model: 'nova-2',
          language: 'pt',
          smart_format: true,
          punctuate: true
        },
        timeout: 30000
      }
    );
   
    let textoTranscrito = '';
    if (response.data && response.data.results && response.data.results.channels) {
      const transcription = response.data.results.channels[0].alternatives[0].transcript;
      textoTranscrito = transcription || '';
    }
   
    textoTranscrito = textoTranscrito.trim();
   
    if (!textoTranscrito || textoTranscrito.length < 2) {
      textoTranscrito = "[Não consegui entender o áudio claramente]";
    }
   
    try {
      fs.unlinkSync(audioPath);
      fs.unlinkSync(convertedPath);
    } catch (e) {
      console.error('Erro ao limpar arquivos temporários:', e);
    }
   
    console.log(`📝 Transcrição REAL: ${textoTranscrito.substring(0, 100)}...`);
   
    return {
      texto: textoTranscrito,
      sucesso: true
    };
   
  } catch (error) {
    console.error('❌ Erro na transcrição REAL:', error.message);
   
    return {
      texto: "Recebi seu áudio mas houve um erro na transcrição.",
      sucesso: false
    };
  }
}
// ═══════════════════════════════════════════════════════════════════════
// FUNÇÕES PARA DOWNLOAD DE MÍDIA (MANTIDAS)
// ═══════════════════════════════════════════════════════════════════════
async function downloadMediaMessage(message) {
  try {
    const mimeMap = {
      'imageMessage': 'image',
      'videoMessage': 'video',
      'audioMessage': 'audio',
      'stickerMessage': 'sticker',
      'documentMessage': 'document'
    };
   
    const type = Object.keys(message)[0];
    const mimeType = mimeMap[type] || 'document';
   
    const stream = await downloadContentFromMessage(message[type], mimeType);
    let buffer = Buffer.from([]);
   
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }
   
    return buffer;
  } catch (e) {
    console.error('Erro ao baixar mídia:', e);
    return null;
  }
}
function generateRandomFilename(ext = '') {
  return path.join(TEMP_FOLDER, Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8) + (ext ? '.' + ext : ''));
}
// Versão assíncrona melhorada para evitar EBUSY errors
const unlinkAsync = util.promisify(fs.unlink);

async function cleanupFile(filePath, retries = 3) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return;
    
    // Primeiro tenta com promisify (não-bloqueante)
    try {
      await unlinkAsync(filePath);
      return; // Sucesso
    } catch (firstError) {
      // Se falhar com EBUSY, tenta com retry
      if (firstError.code !== 'EBUSY' || retries <= 0) {
        console.error(`⚠️ Erro ao limpar ${path.basename(filePath)}: ${firstError.code}`);
        return;
      }
    }
    
    // Retry com delay exponencial para evitar EBUSY
    for (let i = 0; i < retries; i++) {
      const delayMs = 100 * Math.pow(2, i); // 100ms, 200ms, 400ms
      await delay(delayMs);
      
      try {
        await unlinkAsync(filePath);
        console.log(`✅ Arquivo limpo após ${i + 1} tentativa(s)`);
        return;
      } catch (retryError) {
        if (i === retries - 1) {
          console.warn(`⚠️ Não foi possível limpar ${path.basename(filePath)} após ${retries} tentativas`);
        }
      }
    }
  } catch (e) {
    console.error('Erro ao limpar arquivo:', e.message);
  }
}

// Wrapper para manter compatibilidade com chamadas síncronas
function cleanupFileSync(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (e) {
    console.warn(`⚠️ Erro ao limpar ${path.basename(filePath)}: ${e.code}`);
  }
}
// Helper: localizar yt-dlp (bin local ou PATH)
function findYtDlp() {
  try {
    const binName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
    const localPath = path.resolve(__dirname, 'bin', binName);
    if (fs.existsSync(localPath)) {
      return { mode: 'exe', cmd: localPath };
    }
    try {
      // verifica no PATH
      execSync(`${binName} --version`, { stdio: 'pipe', shell: true });
      return { mode: 'exe', cmd: binName };
    } catch (_) {}
    // Tenta via Python module (Windows Store Python normalmente tem 'py')
    try {
      execSync(`py -m yt_dlp --version`, { stdio: 'pipe', shell: true });
      return { mode: 'py', cmd: 'py' };
    } catch (_) {}
    // Tenta via 'python'
    try {
      execSync(`python -m yt_dlp --version`, { stdio: 'pipe', shell: true });
      return { mode: 'python', cmd: 'python' };
    } catch (_) {}
    return null;
  } catch (e) {
    return null;
  }
}
// Fallback robusto: baixar áudio com yt-dlp (mp3)
async function downloadWithYtDlp(url) {
  console.log('🔄 Método 2: yt-dlp (fallback)...');
  const tool = findYtDlp();
  if (!tool) {
    return { error: 'Dependência ausente: yt-dlp não encontrado. Instale com "pip install yt-dlp" ou coloque o executável em akira-js/bin/yt-dlp.exe' };
  }
  const outputPath = generateRandomFilename('mp3');
  const baseArgs = [
  '-f', 'bestaudio/best',
  '--extract-audio', '--audio-format', 'mp3', '--audio-quality', '0',
  '--no-playlist', '--no-continue', '--no-part',
  '--match-filter', 'duration < 1200',
  '--max-filesize', '25M',
  '--ffmpeg-location', FFMPEG_BIN,
  '-o', outputPath,
  url
];


  const spawnArgs = tool.mode === 'exe' ? baseArgs : ['-m', 'yt_dlp', ...baseArgs];
  const spawnCmd = tool.cmd;
  return await new Promise((resolve) => {
    let stderr = '';
    const proc = spawn(spawnCmd, spawnArgs, { shell: false });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        try {
          const stats = fs.statSync(outputPath);
          if (!stats || stats.size === 0) {
            cleanupFile(outputPath);
            return resolve({ error: 'Arquivo vazio' });
          }
          const buffer = fs.readFileSync(outputPath);
          cleanupFile(outputPath);
          let title = 'Música do YouTube';
          let duration = null;
          let author = 'Desconhecido';
          try {
            const metaArgs = ['--print', '%(title)s|%(duration)s|%(uploader)s', '--no-playlist', url];
            const metaCmd = tool.mode === 'exe'
              ? `${tool.cmd} ${metaArgs.map(a => (a.includes(' ') ? '"' + a + '"' : a)).join(' ')}`
              : `${tool.cmd} -m yt_dlp ${metaArgs.map(a => (a.includes(' ') ? '"' + a + '"' : a)).join(' ')}`;
            const metaOut = execSync(metaCmd, { encoding: 'utf8', shell: true });
            const parts = (metaOut || '').trim().split('|');
            if (parts[0]) title = parts[0];
            if (parts[1]) duration = parseInt(parts[1], 10) || null;
            if (parts[2]) author = parts[2];
          } catch (_) {}
          console.log('✅ Download concluído via yt-dlp!');
          return resolve({ buffer, title, duration, author });
        } catch (e) {
          return resolve({ error: e.message });
        }
      }
      // Mapear erros comuns
      if (/does not pass filter/i.test(stderr)) {
        return resolve({ error: 'Vídeo muito longo (máximo 20 minutos).' });
      }
      if (/File is larger than max-filesize/i.test(stderr)) {
        return resolve({ error: 'Arquivo muito grande (>25MB). Tente um vídeo mais curto.' });
      }
      if (/HTTP Error 403|403 Forbidden/i.test(stderr)) {
        return resolve({ error: 'Acesso negado pelo YouTube (403). Tente outro vídeo.' });
      }
      return resolve({ error: 'Falha no yt-dlp: ' + (stderr.split('\n').slice(-3).join(' ').trim() || 'desconhecida') });
    });
  });
}
// ═══════════════════════════════════════════════════════════════════════
// FUNÇÕES PARA STICKERS PERSONALIZADOS (COM METADADOS) - ADAPTADAS
// ═══════════════════════════════════════════════════════════════════════
// Função para escrever EXIF metadata (adaptada do código fornecido)
async function writeExif (media, metadata) {
    let wMedia = /webp/.test(media.mimetype) ? media.data : /image/.test(media.mimetype) ? await imageToWebp(media.data) : /video/.test(media.mimetype) ? await videoToWebp(media.data) : ""
    const tmpFileOut = path.join(TEMP_FOLDER, `${crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`)
    const tmpFileIn = path.join(TEMP_FOLDER, `${crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`)
    fs.writeFileSync(tmpFileIn, wMedia)

    if (metadata.packname || metadata.author) {
        const img = new webpmux.Image()
        const json = { "sticker-pack-name": metadata.packname, "sticker-pack-publisher": metadata.author, "emojis": metadata.categories ? metadata.categories : [""] }
        const exifAttr = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00])
        const jsonBuff = Buffer.from(JSON.stringify(json), "utf-8")
        const exif = Buffer.concat([exifAttr, jsonBuff])
        exif.writeUIntLE(jsonBuff.length, 14, 4)
        await img.load(tmpFileIn)
        fs.unlinkSync(tmpFileIn)
        img.exif = exif
        await img.save(tmpFileOut)
        return tmpFileOut
    }
}

// Função para converter WebP para MP4 (adaptada do código fornecido)
function webp2mp4File(source) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    let isUrl = typeof source === 'string' && /https?:\/\//.test(source);
    form.append('new-image-url', isUrl ? source : "");
    form.append('new-image', isUrl ? "" : source, Date.now() + "-image.webp");
    axios({
      method: 'post',
      url: 'https://s6.ezgif.com/webp-to-mp4',
      data: form,
      headers: {
        'Content-Type': `multipart/form-data; boundary=${form._boundary}`
      }
    }).then(({ data }) => {
      const $ = cheerio.load(data);
      const file = $('input[name="file"]').attr('value');
      const token = $('input[name="token"]').attr('value');
      const convert = $('input[name="file"]').attr('value');
      const bodyFormThen = new FormData();
      bodyFormThen.append('file', file);
      bodyFormThen.append('convert', "Convert WebP to MP4");
      axios({
        method: 'post',
        url: 'https://ezgif.com/webp-to-mp4/' + file,
        data: bodyFormThen,
        headers: {
          'Content-Type': `multipart/form-data; boundary=${bodyFormThen._boundary}`
        }
      }).then(({ data }) => {
        const $ = cheerio.load(data);
        const result = 'https:' + $('div#output > p.outfile > video > source').attr('src');
        resolve(result);
      }).catch(reject);
    }).catch(reject);
  });
}
// Função para adicionar metadados a stickers (idêntico ao writeExif, mas em buffer)
async function addStickerMetadata(webpBuffer, packName = 'Akira Bot', author = 'Isaac Quarenta') {
  try {
    const img = new Webpmux.Image();
    await img.load(webpBuffer);

    const json = {
      'sticker-pack-id': crypto.randomUUID
        ? crypto.randomUUID()
        : (Date.now().toString(36) + Math.random().toString(36).slice(2, 10)),
      'sticker-pack-name': String(packName || 'Akira').slice(0, 30),
      'sticker-pack-publisher': String(author || 'Akira').slice(0, 30),
      'emojis': ['']
    };

    const exifAttr = Buffer.from([
      0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00,
      0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x16, 0x00, 0x00, 0x00
    ]);

    const jsonBuff = Buffer.from(JSON.stringify(json), 'utf-8');
    const exif = Buffer.concat([exifAttr, jsonBuff]);

    // MESMA LINHA QUE O writeExif DO INDEX‑5 USA
    exif.writeUIntLE(jsonBuff.length, 14, 4);

    img.exif = exif;
    const result = await img.save(null);
    return result;
  } catch (e) {
    console.error('Erro ao adicionar metadados:', e);
    return webpBuffer;
  }
}

// Função para criar sticker com metadados usando node-webpmux
// Função para criar sticker com metadados usando node-webpmux (VERSÃO CORRIGIDA E ESTÁVEL)
async function createStickerWithMetadata(imageBuffer, packName = "Akira Bot", author = "Isaac Quarenta") {
  console.log('[STICKER GEN] 🚀 Iniciando criação de sticker estático');
  console.log(`[STICKER GEN] 📦 Buffer recebido: ${imageBuffer ? imageBuffer.length : 'null'} bytes`);
  console.log(`[STICKER GEN] 📝 Pack: "${packName}", Author: "${author}"`);
  try {
    // Verificar se o buffer é válido
    if (!imageBuffer || !Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
      console.error('[STICKER GEN] ❌ Buffer de imagem inválido ou vazio');
      return null;
    }
    console.log('[STICKER GEN] ✅ Buffer validado');

    // Validação inicial da imagem (Sharp)
    if (sharp) {
      try {
        console.log('[STICKER GEN] 🔍 Validando imagem com Sharp...');
        await sharp(imageBuffer).metadata();
        console.log('[STICKER GEN] ✅ Imagem validada com Sharp');
      } catch (validationError) {
        console.error('[STICKER GEN] ❌ Imagem inválida ou corrompida:', validationError.message);
        return null;
      }
    } else {
      console.log('[STICKER GEN] ⚠️ Sharp não disponível, pulando validação');
    }

   // Caminho 1: Sharp (prioridade máxima - mais rápido e estável)
if (sharp) {
  console.log('[STICKER GEN] 🎨 Tentando conversão com Sharp...');
  try {
    console.log('[STICKER GEN] 📏 Redimensionando para 512x512...');
    let webpBuf = await sharp(imageBuffer)
      .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .webp({ quality: 80, effort: 6 })
      .toBuffer();
    console.log(`[STICKER GEN] ✅ Conversão Sharp concluída: ${webpBuf.length} bytes`);

    // normalização extra do WebP pra evitar variantes que o WA mobile rejeita
    webpBuf = await sharp(webpBuf)
      .toFormat('webp', { quality: 80 })
      .toBuffer();

    console.log('[STICKER GEN] 🏷️ Adicionando metadados EXIF...');
    try {
      const withExif = await addStickerMetadata(webpBuf, packName, author);
      console.log(`[STICKER GEN] ✅ Sticker (Sharp) criado com metadados: ${withExif.length} bytes`);
      return withExif;
    } catch (exifError) {
      console.warn('[STICKER GEN] ⚠️ Falha ao adicionar EXIF, retornando sem metadados:', exifError.message);
      return webpBuf;
    }
  } catch (errSharp) {
    console.warn('[STICKER GEN] ❌ Sharp falhou, caindo para FFmpeg:', errSharp?.message || errSharp);
  }
} else {
  console.log('[STICKER GEN] ⏭️ Sharp indisponível, usando FFmpeg');
}


    // Caminho 2: FFmpeg (fallback seguro)
    console.log('[STICKER GEN] 🎬 Iniciando conversão com FFmpeg...');
    const ext = isWebpBuffer(imageBuffer) ? 'webp' : 'jpg';
    const inputPath = generateRandomFilename(ext);
    const outputPath = generateRandomFilename('webp');
    console.log(`[STICKER GEN] 💾 Salvando buffer temporário: ${inputPath}`);
    fs.writeFileSync(inputPath, imageBuffer);
    console.log(`[STICKER GEN] ✅ Arquivo temporário criado: ${fs.statSync(inputPath).size} bytes`);

    const encodeWebp = (srcPath) => new Promise((resolve, reject) => {
      console.log(`[STICKER GEN] 🔄 Executando FFmpeg encode: ${srcPath} -> ${outputPath}`);
      ffmpeg(srcPath)
        .outputOptions([
          '-y',
          '-v error',
          '-c:v libwebp',
          '-q:v 75',
          '-compression_level 6',
          '-lossless 0',
          // FILTRO CORRIGIDO: sem transparência total (evita "Invalid argument")
          "-vf scale=512:512:force_original_aspect_ratio=decrease:flags=lanczos,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=white@0.0,format=rgba,setsar=1"
        ])
        .on('end', () => {
          console.log('[STICKER GEN] ✅ FFmpeg encode concluído');
          resolve();
        })
        .on('error', (err) => {
          console.error('[STICKER GEN] ❌ Erro no FFmpeg encode:', err.message);
          reject(err);
        })
        .save(outputPath);
    });

    try {
      await encodeWebp(inputPath);
    } catch (err) {
      console.warn('[STICKER GEN] ⚠️ Encode direto falhou, tentando normalização:', err?.message || err);
      const normPath = generateRandomFilename('png');
      let normalizedOk = false;

      // Normalização com Sharp (se disponível)
      if (sharp) {
        try {
          const pngBuf = await sharp(imageBuffer).png().toBuffer();
          fs.writeFileSync(normPath, pngBuf);
          console.log(`[STICKER GEN] ✅ Normalização Sharp concluída: ${pngBuf.length} bytes`);
          normalizedOk = true;
        } catch (e) {
          console.warn('[STICKER GEN] ❌ Normalização Sharp falhou:', e?.message || e);
        }
      }

      // Normalização com FFmpeg se Sharp não salvou
      if (!normalizedOk) {
        try {
          await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
              .outputOptions(['-y', '-v error'])
              .output(normPath)
              .on('end', resolve)
              .on('error', reject)
              .run();
          });
          normalizedOk = true;
          console.log('[STICKER GEN] ✅ Normalização FFmpeg concluída');
        } catch (ffmpegErr) {
          console.error('[STICKER GEN] ❌ Normalização FFmpeg falhou:', ffmpegErr.message);
          cleanupFile(inputPath);
          return null;
        }
      }

      if (normalizedOk) {
        await encodeWebp(normPath);
        cleanupFile(normPath);
      }
    }

    // Validação final
    if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
      cleanupFile(inputPath);
      cleanupFile(outputPath);
      console.error('[STICKER GEN] ❌ Arquivo de saída vazio ou inexistente');
      return null;
    }

    console.log(`[STICKER GEN] ✅ WebP gerado: ${fs.statSync(outputPath).size} bytes`);
    let webpBuffer = fs.readFileSync(outputPath);

    // Adicionar metadados
    console.log('[STICKER GEN] 🏷️ Adicionando metadados EXIF...');
    try {
      webpBuffer = await addStickerMetadata(webpBuffer, packName, author);
      console.log(`[STICKER GEN] ✅ Sticker (FFmpeg) com metadados: ${webpBuffer.length} bytes`);
    } catch (metadataError) {
      console.warn('[STICKER GEN] ⚠️ Sem metadados (EXIF falhou):', metadataError.message);
    }

    cleanupFile(inputPath);
    cleanupFile(outputPath);
    console.log('[STICKER GEN] 🎉 Sticker estático criado com sucesso!');

    return webpBuffer;
  } catch (e) {
    console.error('[STICKER GEN] 💥 Erro crítico:', e.message);
    console.error('[STICKER GEN] Stack:', e.stack);
    return null;
  }
}
// Função para criar sticker animado com metadados usando node-webpmux
async function createAnimatedStickerWithMetadata(videoBuffer, packName = "Akira Bot", author = "Isaac Quarenta", duration = 8) {
  try {
    const inputPath = generateRandomFilename('mp4');
    const outputPath = generateRandomFilename('webp');
    fs.writeFileSync(inputPath, videoBuffer);
    // Criar WebP animado compatível (512x512, 15fps, loop infinito)
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          '-y',
          '-v error',
          '-an',
          '-vsync 0',
          '-pix_fmt yuv420p',
          '-vcodec libwebp',
          '-compression_level 6',
          '-lossless 0',
          '-q:v 65',
          '-loop 0',
          '-preset default',
          '-t', Math.max(1, Math.min(10, parseInt(duration)||8)).toString(),
          "-vf fps=15,scale=512:-2:flags=lanczos:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000,setsar=1"
        ])
        .on('end', resolve)
        .on('error', reject)
        .save(outputPath);
    });
    if (!fs.existsSync(outputPath)) {
      cleanupFile(inputPath);
      return null;
    }
    // Ler o WebP criado
    let webpBuffer = fs.readFileSync(outputPath);
    // Adicionar metadados usando node-webpmux (depois do encode)
    try {
      webpBuffer = await addStickerMetadata(webpBuffer, packName, author);
      console.log('✅ Sticker animado criado com metadados (512x512/15fps)');
    } catch (metadataError) {
      console.log('⚠️ Usando sticker animado sem metadados:', metadataError.message);
    }
    cleanupFile(inputPath);
    cleanupFile(outputPath);
    return webpBuffer;
  } catch (e) {
    console.error('Erro ao criar sticker animado:', e);
    return null;
  }
}
// Função para detectar se um sticker é animado
function isStickerAnimated(stickerBuffer) {
  try {
    if (stickerBuffer.length < 20) return false;
    const riff = stickerBuffer.slice(0, 4).toString('ascii') === 'RIFF';
    const webp = stickerBuffer.slice(8, 12).toString('ascii') === 'WEBP';
    if (!(riff && webp)) return false;
    const header = stickerBuffer.slice(12, 16).toString('ascii'); // VP8X / VP8 / VP8L
    if (header !== 'VP8X') return false;
    const bin = stickerBuffer.toString('binary');
    return bin.includes('ANIM') || bin.includes('ANMF');
  } catch (e) {
    return false;
  }
}
// Helper: detectar se um buffer é WEBP (estático ou animado)
function isWebpBuffer(buf) {
  try {
    if (!buf || buf.length < 12) return false;
    return buf.slice(0,4).toString('ascii') === 'RIFF' && buf.slice(8,12).toString('ascii') === 'WEBP';
  } catch (_) { return false; }
}
// Criar sticker a partir de sticker estático (injetando metadados do bot)
async function createStickerFromSticker(stickerWebpBuffer, m, packName = 'Akira Bot', author = 'Isaac Quarenta') {
  try {
    const result = await addStickerMetadata(stickerWebpBuffer, packName, author);
    return result;
  } catch (e) {
    console.error('Erro em createStickerFromSticker:', e);
    return null;
  }
}
// Criar sticker animado a partir de sticker animado (com fallback de re-encode)
async function createAnimatedStickerFromAnimatedSticker(animatedWebpBuffer, m, packName = 'Akira Bot', author = 'Isaac Quarenta') {
  try {
    // Tenta apenas injetar EXIF direto
    try {
      const withExif = await addStickerMetadata(animatedWebpBuffer, packName, author);
      return withExif;
    } catch (_) {}
    // Fallback: re-encode para 512x512/15fps e depois EXIF
    const inputPath = generateRandomFilename('webp');
    const outputPath = generateRandomFilename('webp');
    fs.writeFileSync(inputPath, animatedWebpBuffer);
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          '-y',
          '-v error',
          '-an',
          '-vsync 0',
          '-pix_fmt yuv420p',
          '-vcodec libwebp',
          '-compression_level 6',
          '-lossless 0',
          '-q:v 65',
          '-loop 0',
          '-preset default',
          "-vf fps=15,scale=512:-2:flags=lanczos:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000,setsar=1"
        ])
        .on('end', resolve)
        .on('error', reject)
        .save(outputPath);
    });
    let webpBuffer = fs.readFileSync(outputPath);
    webpBuffer = await addStickerMetadata(webpBuffer, packName, author);
    cleanupFile(inputPath);
    cleanupFile(outputPath);
    return webpBuffer;
  } catch (e) {
    console.error('Erro em createAnimatedStickerFromAnimatedSticker:', e);
    return null;
  }
}
// ═══════════════════════════════════════════════════════════════════════
// FUNÇÃO PARA DOWNLOAD DE ÁUDIO DO YOUTUBE - MÉTODO HÍBRIDO
// ═══════════════════════════════════════════════════════════════════════
async function downloadYTAudio(url) {
  try {
    console.log('🎵 Iniciando download de áudio do YouTube...');
   
    // Extrair ID do vídeo
    let videoId = '';
    if (url.includes('youtube.com/watch?v=')) {
      videoId = url.split('v=')[1]?.split('&')[0];
    } else if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1]?.split('?')[0];
    } else if (url.includes('youtube.com/shorts/')) {
      videoId = url.split('shorts/')[1]?.split('?')[0];
    }
   
    if (!videoId || videoId.length !== 11) {
      return { error: 'URL do YouTube inválida' };
    }
   
    console.log(`📹 Video ID: ${videoId}`);
    const outputPath = generateRandomFilename('mp3');
   

   
    // MÉTODO ÚNICO: yt-dlp (confiável)
    try {
      console.log('📤 Baixando áudio do YouTube...');
      
      const isWindows = process.platform === 'win32';
      const ytDlpPath = isWindows ? path.join(__dirname, 'bin', 'yt-dlp.exe') : 'yt-dlp';
      const tempDir = path.join(__dirname, 'temp');
      
      // Garantir que diretório temp existe
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Usar nome simples sem extensão (yt-dlp adiciona .mp3)
      const outputTemplate = path.join(tempDir, `audio_${Date.now()}`);
      
      // Comando com output template apropriado + opções para bypass YouTube 403
      const command = isWindows
        ? `"${ytDlpPath}" --extract-audio --audio-format mp3 --audio-quality 0 -o "${outputTemplate}" --no-playlist --max-filesize 25M --ffmpeg-location "${FFMPEG_BIN}" --no-warnings --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" --geo-bypass --no-check-certificates --referer "https://www.youtube.com/" "${url}"`
        : `${ytDlpPath} --extract-audio --audio-format mp3 --audio-quality 0 -o "${outputTemplate}" --no-playlist --max-filesize 25M --ffmpeg-location "${FFMPEG_BIN}" --no-warnings --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" --geo-bypass --no-check-certificates --referer "https://www.youtube.com/" "${url}"`;
      
      console.log('🔍 Executando:', ytDlpPath.split(path.sep).pop());
      
      await new Promise((resolve, reject) => {
        exec(command, { 
          cwd: __dirname, 
          timeout: 120000, 
          maxBuffer: 20 * 1024 * 1024,
          encoding: 'utf8'
        }, (error, stdout, stderr) => {
          // yt-dlp adiciona .mp3 automaticamente ao template
          const actualPath = outputTemplate + '.mp3';
          
          console.log(`📂 Procurando em: ${actualPath}`);
          
          if (fs.existsSync(actualPath)) {
            console.log('✅ Arquivo criado com sucesso');
            resolve({ path: actualPath, stdout });
          } else if (error) {
            console.error(`❌ Erro ao executar: ${error.message}`);
            if (stderr) console.error(`Stderr: ${stderr}`);
            reject(error);
          } else {
            reject(new Error(`Arquivo não foi criado em ${actualPath}`));
          }
        });
      });
      
      // Usar o caminho com extensão
      const actualOutputPath = outputTemplate + '.mp3';
      
      // Verificar se o arquivo foi criado
      if (!fs.existsSync(actualOutputPath)) {
        throw new Error(`Arquivo não encontrado em ${actualOutputPath}`);
      }
      
      // Verificar tamanho
      const stats = fs.statSync(actualOutputPath);
      
      if (stats.size === 0) {
        await cleanupFile(actualOutputPath);
        throw new Error('Arquivo vazio');
      }
      
      if (stats.size > 25 * 1024 * 1024) {
        await cleanupFile(actualOutputPath);
        return { error: 'Arquivo muito grande (>25MB). Tente um vídeo mais curto.' };
      }
      
      console.log(`📦 Arquivo baixado: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
      
      const audioBuffer = fs.readFileSync(actualOutputPath);
      await cleanupFile(actualOutputPath);
     
      // Tentar obter metadados completos
      let title = 'Música do YouTube';
      let author = 'Desconhecido';
      let duration = 0;
      let views = '0';
      let likes = '0';
      let uploadDate = 'Desconhecida';
     
      try {
        const infoCommand = `"${ytDlpPath}" --print "%(title)s|%(uploader)s|%(duration)s|%(view_count)s|%(like_count)s|%(upload_date)s" --no-playlist "${url}"`;
        const infoOutput = await new Promise((resolve, reject) => {
          exec(infoCommand, { cwd: __dirname, timeout: 30000 }, (error, stdout, stderr) => {
            if (error) {
              reject(error);
            } else {
              resolve(stdout.trim());
            }
          });
        });
       
        const [t, a, d, v, l, ud] = infoOutput.split('|');
        title = t || title;
        author = a || author;
        duration = parseInt(d) || duration;
        views = v && parseInt(v) > 0 ? (parseInt(v) / 1000000).toFixed(1) + 'M' : '0';
        likes = l && parseInt(l) > 0 ? (parseInt(l) / 1000).toFixed(0) + 'K' : '0';
        
        // Formatar data (YYYYMMDD para DD/MM/YYYY)
        if (ud && ud.length === 8) {
          uploadDate = `${ud.substring(6)}/12/${ud.substring(0, 4)}`;
        }
       
        if (duration > 1200) {
          return { error: `Vídeo muito longo (${Math.floor(duration/60)} minutos). Máximo 20 minutos.` };
        }
      } catch (infoError) {
        console.log('⚠️ Não foi possível obter metadados completos');
      }
     
      console.log('✅ Download concluído via yt-dlp!');
      return {
        buffer: audioBuffer,
        title: title,
        duration: duration,
        author: author,
        videoId: videoId,
        views: views,
        likes: likes,
        uploadDate: uploadDate
      };
     
    } catch (ytdlpError) {
      console.error('❌ yt-dlp falhou:', ytdlpError.message);
      
      // Se o arquivo foi criado apesar do erro, tenta usar
      if (fs.existsSync(outputPath)) {
        try {
          const stats = fs.statSync(outputPath);
          if (stats.size > 0 && stats.size < 25 * 1024 * 1024) {
            console.log('⚠️ yt-dlp teve erro mas criou arquivo válido, usando mesmo assim...');
            const audioBuffer = fs.readFileSync(outputPath);
            await cleanupFile(outputPath);
            return {
              buffer: audioBuffer,
              title: 'Música do YouTube',
              duration: 0,
              author: 'Desconhecido',
              videoId: videoId
            };
          }
        } catch (e) {
          console.error('Erro ao tentar usar arquivo criado:', e.message);
        }
      }
      
      // FALLBACK: Tentar com ytdl-core se yt-dlp falhar
      console.log('🔄 Tentando método alternativo: ytdl-core...');
      try {
        const info = await ytdl.getInfo(videoId, {
          requestOptions: {
            headers: {
              'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
              'Accept-Encoding': 'gzip, deflate, br',
              'Connection': 'keep-alive',
              'Upgrade-Insecure-Requests': '1',
              'Sec-Fetch-Dest': 'document',
              'Sec-Fetch-Mode': 'navigate',
              'Sec-Fetch-Site': 'none',
              'Sec-Fetch-User': '?1',
              'Cache-Control': 'max-age=0'
            }
          }
        });
        
        let audioFormat = ytdl.chooseFormat(info.formats, {
          quality: 'highestaudio',
          filter: 'audioonly'
        });
        
        if (!audioFormat) {
          throw new Error('Nenhum formato de áudio encontrado');
        }
        
        console.log(`✅ Format encontrado com ytdl-core: ${audioFormat.container}`);
        
        const tempOutputPath = path.join(TEMP_FOLDER, `ytdl_${Date.now()}.mp3`);
        const writeStream = fs.createWriteStream(tempOutputPath);
        const stream = ytdl.downloadFromInfo(info, { format: audioFormat });
        
        await new Promise((resolve, reject) => {
          stream.pipe(writeStream);
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
          stream.on('error', reject);
        });
        
        const stats = fs.statSync(tempOutputPath);
        if (stats.size > 0 && stats.size < 25 * 1024 * 1024) {
          console.log('✅ Fallback com ytdl-core funcionou!');
          const audioBuffer = fs.readFileSync(tempOutputPath);
          await cleanupFile(tempOutputPath);
          
          return {
            buffer: audioBuffer,
            title: info.videoDetails.title || 'Música do YouTube',
            duration: parseInt(info.videoDetails.lengthSeconds) || 0,
            author: info.videoDetails.author?.name || 'Desconhecido',
            videoId: videoId
          };
        }
      } catch (fallbackError) {
        console.error('❌ ytdl-core também falhou:', fallbackError.message);
      }
      
      await cleanupFile(outputPath);
      return { error: 'Falha ao baixar o áudio. O vídeo pode estar protegido ou bloqueado regionalmente. Tente outro vídeo.' };
    }
    
  } catch (e) {
    console.error('❌ Erro geral:', e);
    // Tenta limpar arquivo em caso de erro
    try {
      await cleanupFile(outputPath);
    } catch (cleanupErr) {
      console.warn('⚠️ Erro ao limpar arquivo após falha:', cleanupErr.message);
    }
    return { error: 'Erro ao processar: ' + e.message };
  }
}
// ═══════════════════════════════════════════════════════════════════════
// FUNÇÃO PARA TEXT TO SPEECH (MANTIDA + LIMITE DE 2000 CHARS)
// ═══════════════════════════════════════════════════════════════════════
const MAX_TTS_CHARS = 2000; // Limite máximo de caracteres para TTS

async function textToSpeech(text, lang = 'pt') {
  try {
    // Se o texto exceder 2000 caracteres, fragmentar em partes
    if (text.length > MAX_TTS_CHARS) {
      console.log(`⚠️ Texto muito longo (${text.length} chars). Fragmentando em ${Math.ceil(text.length / MAX_TTS_CHARS)} partes...`);
      
      // Fragmentar mantendo palavras inteiras
      const parts = [];
      let currentPart = '';
      const sentences = text.split(/([.!?])/);
      
      for (let i = 0; i < sentences.length; i++) {
        const segment = sentences[i];
        if ((currentPart + segment).length <= MAX_TTS_CHARS) {
          currentPart += segment;
        } else {
          if (currentPart) parts.push(currentPart.trim());
          currentPart = segment;
        }
      }
      if (currentPart) parts.push(currentPart.trim());
      
      // Gerar áudio para primeira parte e incluir informação de continuação
      const firstPart = parts[0];
      const url = googleTTS.getAudioUrl(firstPart, {
        lang: lang,
        slow: false,
        host: 'https://translate.google.com'
      });
      
      const outputPath = generateRandomFilename('mp3');
      const response = await axios({
        url,
        method: 'GET',
        responseType: 'arraybuffer'
      });
      
      fs.writeFileSync(outputPath, Buffer.from(response.data));
      const stats = fs.statSync(outputPath);
      
      if (stats.size === 0) {
        cleanupFile(outputPath);
        return { error: 'Áudio TTS vazio' };
      }
      
      const audioBuffer = fs.readFileSync(outputPath);
      cleanupFile(outputPath);
      
      return { 
        buffer: audioBuffer,
        fragmented: true,
        totalParts: parts.length,
        remainingText: parts.slice(1).join(' ')
      };
    }
    
    // Texto normal (menor que 2000 chars)
    const url = googleTTS.getAudioUrl(text, {
      lang: lang,
      slow: false,
      host: 'https://translate.google.com'
    });
   
    const outputPath = generateRandomFilename('mp3');
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'arraybuffer'
    });
   
    fs.writeFileSync(outputPath, Buffer.from(response.data));
   
    const stats = fs.statSync(outputPath);
    if (stats.size === 0) {
      cleanupFile(outputPath);
      return { error: 'Áudio TTS vazio' };
    }
   
    const audioBuffer = fs.readFileSync(outputPath);
    cleanupFile(outputPath);
   
    return { buffer: audioBuffer };
  } catch (e) {
    console.error('Erro TTS:', e);
    return { error: 'Erro ao gerar TTS' };
  }
}
// ═══════════════════════════════════════════════════════════════════════
// FUNÇÕES DE EFEITOS DE ÁUDIO (ADAPTADAS DO PROJETO REFERÊNCIA)
// ═══════════════════════════════════════════════════════════════════════
async function applyAudioEffect(audioBuffer, effect) {
  try {
    const inputPath = generateRandomFilename('mp3');
    const outputPath = generateRandomFilename('mp3');
    fs.writeFileSync(inputPath, audioBuffer);
    let audioFilter = '';
    switch (effect) {
      case 'nightcore':
        audioFilter = 'atempo=1.06,asetrate=44100*1.25';
        break;
      case 'slow':
        audioFilter = 'atempo=0.5,asetrate=44100';
        break;
      case 'esquilo':
        audioFilter = 'atempo=0.7,asetrate=65100';
        break;
      case 'gemuk':
        audioFilter = 'atempo=1.6,asetrate=22100';
        break;
      case 'fast':
        audioFilter = 'atempo=0.9,asetrate=95100';
        break;
      case 'bass':
        audioFilter = 'equalizer=f=30:width_type=o:width=2:g=15';
        break;
      case 'grave':
        audioFilter = 'equalizer=f=30:width_type=o:width=2:g=15';
        break;
      case 'earrape':
        audioFilter = 'equalizer=f=90:width_type=o:width=2:g=30';
        break;
      case 'estourar':
        audioFilter = 'equalizer=f=90:width_type=o:width=2:g=30';
        break;
      case 'imut':
        audioFilter = 'atempo=3/4,asetrate=44500*4/3';
        break;
      case 'hode':
        audioFilter = 'atempo=4/3,asetrate=44500*3/4';
        break;
      default:
        return { error: 'Efeito não suportado' };
    }
    // Executa ffmpeg diretamente usando o binário resolvido (corrige PATH no Windows)
    await new Promise((resolve, reject) => {
      const args = ['-y', '-i', inputPath];
      if (audioFilter && audioFilter.length) {
        args.push('-af', audioFilter);
      }
      args.push(outputPath);
      execFile(FFMPEG_BIN, args, { windowsHide: true }, (error, _stdout, stderr) => {
        if (error) {
          return reject(new Error((stderr || error.message).toString()))
        }
        resolve();
      });
    });
    const stats = fs.statSync(outputPath);
    if (!stats || stats.size === 0) {
      cleanupFile(inputPath);
      cleanupFile(outputPath);
      return { error: 'Áudio resultante vazio' };
    }
    const effectBuffer = fs.readFileSync(outputPath);
    cleanupFile(inputPath);
    cleanupFile(outputPath);
    return { buffer: effectBuffer };
  } catch (e) {
    console.error('Erro ao aplicar efeito de áudio:', e);
    return { error: 'Erro ao processar efeito: ' + (e && e.message ? e.message : e) };
  }
}
// ═══════════════════════════════════════════════════════════════════════
// FUNÇÕES DE SIMULAÇÃO (MANTIDAS)
// ═══════════════════════════════════════════════════════════════════════
async function simularDigitacao(sock, jid, tempoMs) {
  try {
    await sock.sendPresenceUpdate('available', jid);
    await delay(500);
   
    await sock.sendPresenceUpdate('composing', jid);
    console.log(`⌨️ [DIGITANDO] Akira está digitando por ${(tempoMs/1000).toFixed(1)}s...`);
   
    await delay(tempoMs);
   
    await sock.sendPresenceUpdate('paused', jid);
    await delay(300);
   
    console.log('✅ [PRONTO] Akira parou de digitar');
   
  } catch (e) {
    console.error('Erro na simulação:', e.message);
  }
}
async function simularGravacaoAudio(sock, jid, tempoMs) {
  try {
    console.log(`🎤 [GRAVANDO] Akira está preparando áudio por ${(tempoMs/1000).toFixed(1)}s...`);
   
    await sock.sendPresenceUpdate('recording', jid);
    await delay(tempoMs);
   
    await sock.sendPresenceUpdate('paused', jid);
   
    console.log('✅ [PRONTO] Áudio preparado');
  } catch (e) {
    console.error('Erro na simulação de gravação:', e.message);
  }
}
// ═══════════════════════════════════════════════════════════════════════
// FUNÇÕES DE MODERAÇÃO ADICIONAIS (DO PROJETO REFERÊNCIA)
// ═══════════════════════════════════════════════════════════════════════
async function marcarMensagem(sock, m, ehGrupo, foiAtivada, temAudio = false) {
  try {
    if (temAudio && foiAtivada) {
      try {
        await sock.readMessages([m.key]);
        console.log('▶️ [REPRODUZIDO] Áudio marcado como reproduzido');
      } catch (e) {
        console.error('Erro ao marcar áudio como reproduzido:', e.message);
      }
      return;
    }
   
    if (!ehGrupo) {
      await sock.readMessages([m.key]);
      console.log('✓✓ [LIDO] PV - Marcado como lido (azul)');
      return;
    }
   
    if (ehGrupo && foiAtivada) {
      await sock.readMessages([m.key]);
      console.log('✓✓ [LIDO] Grupo - Marcado como lido (Akira foi mencionada)');
      return;
    }
   
    if (ehGrupo && !foiAtivada) {
      try {
        await sock.sendReadReceipt(m.key.remoteJid, m.key.participant, [m.key.id]);
        console.log('✓ [ENTREGUE FORÇADO] Grupo - Marcado como entregue (check simples)');
      } catch (e) {
        try {
          await sock.sendReceipt(m.key.remoteJid, m.key.participant, [m.key.id]);
          console.log('✓ [ENTREGUE ALT] Grupo - Usando método alternativo');
        } catch (e2) {
          console.log('⚠️ Não foi possível marcar como entregue');
        }
      }
      return;
    }
   
  } catch (e) {
    console.error('Erro ao marcar mensagem:', e.message);
  }
}
async function simularStatusMensagem(sock, m, foiAtivada, temAudio = false) {
  try {
    const ehGrupo = String(m.key.remoteJid || '').endsWith('@g.us');
    
    // ═══════════════════════════════════════════════════════════════
    // SEMPRE MARCAR COMO ENTREGUE EM GRUPOS (LÓGICA DO DELIVERED)
    // ═══════════════════════════════════════════════════════════════
    if (ehGrupo) {
      // SEMPRE tenta marcar como entregue (single check)
      try {
        await sock.sendReadReceipt(m.key.remoteJid, m.key.participant, [m.key.id]);
        console.log('✓ [ENTREGUE] Grupo - Marcado como entregue (✓ check simples)');
      } catch (e) {
        // Fallback: tenta método alternativo
        try {
          await sock.sendReceipt(m.key.remoteJid, m.key.participant, [m.key.id]);
          console.log('✓ [ENTREGUE ALT] Grupo - Entregue via método alternativo');
        } catch (e2) {
          // Último recurso: ignorar silenciosamente
        }
      }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // LÓGICA DE LEITURA (azul) APENAS SE FOI ATIVADA
    // ═══════════════════════════════════════════════════════════════
    if (!foiAtivada) {
      // Mensagem não foi processada, não marca como lida
      return;
    }
    
    // Se foi ativada, marca como lida (double check/azul)
    if (temAudio && foiAtivada) {
      try {
        await sock.readMessages([m.key]);
        console.log('▶️ [REPRODUZIDO] Áudio marcado como reproduzido (✓✓ double check)');
      } catch (e) {}
    } else if (foiAtivada) {
      try {
        await sock.readMessages([m.key]);
        console.log('✓✓ [LIDO] Mensagem marcada como lida (azul/double check)');
      } catch (e) {}
    }
    
  } catch (e) {
    console.error('Erro ao simular status:', e.message);
  }
}
async function obterInfoGrupo(sock, groupId) {
  try {
    const groupMetadata = await sock.groupMetadata(groupId);
    return {
      id: groupId,
      subject: groupMetadata.subject || 'Grupo sem nome',
      participants: groupMetadata.participants || [],
      created: groupMetadata.creation || Date.now()
    };
  } catch (e) {
    console.error('Erro ao obter info do grupo:', e);
    return {
      id: groupId,
      subject: 'Grupo sem nome',
      participants: [],
      created: Date.now()
    };
  }
}
// ═══════════════════════════════════════════════════════════════════════
// HANDLER DE COMANDOS EXTRAS (ATUALIZADO COM NOVAS FUNCIONALIDADES)
// ═══════════════════════════════════════════════════════════════════════
async function handleComandosExtras(sock, m, texto, ehGrupo) {
  try {
    if (!texto.startsWith(PREFIXO)) return false;
   
    const sender = m.key.participant || m.key.remoteJid;
    if (!checkRateLimit(sender)) {
      await sock.sendMessage(m.key.remoteJid, { text: '⏰ Você está usando comandos muito rápido. Aguarde um pouco.' });
      return true;
    }
   
    if (isFiltered(sender)) {
      const ff = {
        text: `Sem flood @${sender.split('@')[0]}...\n\nAguarde 3 segundos antes de usar outro comando✅`,
        contextInfo: {
          mentionedJid: [sender]
        }
      };
      await sock.sendMessage(m.key.remoteJid, ff, { quoted: m });
      return true;
    }
   
    addFilter(sender);
   
    const args = texto.slice(PREFIXO.length).trim().split(/ +/);
    const comando = args.shift().toLowerCase();
    const textoCompleto = args.join(' ');
   
    console.log(`🔧 [COMANDO] ${comando} de ${sender}`);
   
    if (cekBannedUser(sender)) {
      await sock.sendMessage(m.key.remoteJid, {
        text: '🚫 Você está banido e não pode usar comandos.'
      });
      return true;
    }
   
    // COMANDOS DISPONÍVEIS
    switch (comando) {
     
      // === STICKER COM METADADOS PERSONALIZADOS ===
      case 'sticker':
      case 's':
      case 'fig':
      case 'stiker':
        try {
          let quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
          if (quoted?.viewOnceMessageV2?.message) quoted = quoted.viewOnceMessageV2.message;
          else if (quoted?.viewOnceMessageV2Extension?.message) quoted = quoted.viewOnceMessageV2Extension.message;
          else if (quoted?.viewOnceMessage?.message) quoted = quoted.viewOnceMessage.message;
          const hasImage = m.message?.imageMessage || quoted?.imageMessage;
          const hasVideo = m.message?.videoMessage || quoted?.videoMessage;
          const hasSticker = quoted?.stickerMessage;
          if (!hasImage && !hasVideo && !hasSticker) {
            await sock.sendMessage(m.key.remoteJid, {
              text: '📸 Como usar:\n- Envie uma imagem com legenda `#sticker`\n- OU responda uma imagem com `#sticker`\n\n⚠️ Para animados a partir de vídeo, use `#gif`.'
            }, { quoted: m });
            return true;
          }
          const packName = 'Akira-Bot';
          const userNameRequester = m.pushName ? m.pushName.split(' ')[0] : 'User';
          const author = userNameRequester;
          // 1) Sticker de sticker (estático ou animado)
          if (hasSticker) {
            const stickerMsg = quoted.stickerMessage;
            const stickerBuf = await downloadMediaMessage({ stickerMessage: stickerMsg });
            if (!stickerBuf) {
              await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao baixar sticker.' }, { quoted: m });
              return true;
            }
            const animated = isStickerAnimated(stickerBuf);
            const out = animated
              ? await createAnimatedStickerFromAnimatedSticker(stickerBuf, m, packName, author)
              : await createStickerFromSticker(stickerBuf, m, packName, author);
            if (!out) {
              await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao criar sticker.' }, { quoted: m });
              return true;
            }
            await sock.sendMessage(m.key.remoteJid, { sticker: out }, { quoted: m });
            return true;
          }
          // 2) Imagem -> sticker estático
          if (hasImage) {
            const mediaMessage = quoted?.imageMessage || m.message.imageMessage;
            const mediaBuffer = await downloadMediaMessage({ imageMessage: mediaMessage });
            if (!mediaBuffer) {
              await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao baixar imagem.' }, { quoted: m });
              return true;
            }
            const out = await createStickerWithMetadata(mediaBuffer, packName, author);
            if (!out) {
              await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao criar sticker.' }, { quoted: m });
              return true;
            }
            await sock.sendMessage(m.key.remoteJid, { sticker: out }, { quoted: m });
            return true;
          }
          // 3) Vídeo -> orientar usar #gif
          if (hasVideo) {
            await sock.sendMessage(m.key.remoteJid, { text: 'ℹ️ Para stickers animados de vídeo, use o comando `#gif`.' }, { quoted: m });
            return true;
          }
        } catch (e) {
          console.error('Erro no comando sticker:', e);
          await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao processar sticker.' }, { quoted: m });
        }
        return true;
     
      // === COMANDO TAKE (STICKER PERSONALIZADO COM NOME) ===
      case 'take':
        try {
          if (!textoCompleto.includes('|')) {
            await sock.sendMessage(m.key.remoteJid, {
              text: '🎨 *Como usar:* `#take Nome do Pack|Autor`\nExemplo: `#take Akira Pack|Isaac`\n\n*Responda a um sticker*'
            }, { quoted: m });
            return true;
          }
         
          const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
          const hasSticker = quoted?.stickerMessage;
         
          if (!hasSticker) {
            await sock.sendMessage(m.key.remoteJid, {
              text: '❌ Responda a um sticker para usar este comando.'
            }, { quoted: m });
            return true;
          }
         
          const [packName, author] = textoCompleto.split('|').map(s => s.trim());
         
          const stickerBuffer = await downloadMediaMessage({ stickerMessage: quoted.stickerMessage });
         
          if (!stickerBuffer) {
            await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao baixar sticker.' }, { quoted: m });
            return true;
          }
         
          const isAnimated = isStickerAnimated(stickerBuffer);
          let finalBuffer;
         
          if (isAnimated) {
            // Corrigido: usar pipeline para animados (re-encode + EXIF se necessário)
            finalBuffer = await createAnimatedStickerFromAnimatedSticker(stickerBuffer, m, packName, author);
          } else {
            // Para sticker estático já em WEBP, apenas injeta EXIF
            finalBuffer = await createStickerFromSticker(stickerBuffer, m, packName, author);
          }
         
          if (finalBuffer) {
            await sock.sendMessage(m.key.remoteJid, {
              sticker: finalBuffer
            }, { quoted: m });
          } else {
            await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao criar sticker personalizado.' }, { quoted: m });
          }
         
        } catch (e) {
          console.error('Erro no comando take:', e);
          await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao criar sticker personalizado.' }, { quoted: m });
        }
        return true;
     
      // === PLAY / YOUTUBE MP3 === (SISTEMA CORRIGIDO)
case 'play':
case 'tocar':
case 'music':
case 'ytmp3':
case 'yt':
case 'ytaudio':
  if (!textoCompleto) {
    await sock.sendMessage(m.key.remoteJid, {
      text: '🎵 *COMO USAR:* \n`#play https://youtube.com/...`\n`#play nome da música`\n`#ytmp3 https://youtube.com/...`\n\n*Limites:*\n- Máximo 25MB\n- Vídeos até 10 minutos recomendados'
    }, { quoted: m });
    return true;
  }
 
  try {
    let urlFinal = args[0] || textoCompleto;
    let title = '';
    const userId = extrairNumeroReal(m);
    let progressMsgKey = null;
   
    if (!urlFinal.startsWith('http')) {
      const searchQuery = textoCompleto;
      const initialText = `🔍 Buscando: "${searchQuery}" no YouTube...`;
      
      progressMsgKey = await sendProgressMessage(sock, m.key.remoteJid, initialText, m, userId);
     
      try {
        const searchResult = await yts(searchQuery);
        if (!searchResult || searchResult.videos.length === 0) {
          await sendProgressMessage(sock, m.key.remoteJid, '❌ Não encontrei resultados. Use o link direto do YouTube.', m, userId);
          return true;
        }
       
        const video = searchResult.videos[0];
        urlFinal = video.url;
        title = video.title;
       
        await sendProgressMessage(sock, m.key.remoteJid, `✅ Encontrei!\n📌 *${title}*\n⏰ Duração: ${video.timestamp}\n👁️ Visualizações: ${video.views}\n\n⏳ Processando...`, m, userId);
      } catch (searchError) {
        await sendProgressMessage(sock, m.key.remoteJid, '❌ Erro na busca. Use o link direto do YouTube.', m, userId);
        return true;
      }
    } else {
      progressMsgKey = await sendProgressMessage(sock, m.key.remoteJid, '🔍 Processando link do YouTube...', m, userId);
    }
   
    await sendProgressMessage(sock, m.key.remoteJid, '⏳ Baixando áudio do YouTube...\nIsso pode levar alguns minutos dependendo do tamanho do vídeo.', m, userId);
   
    const ytResult = await downloadYTAudio(urlFinal);
   
    if (ytResult.error) {
      await sendProgressMessage(sock, m.key.remoteJid, `❌ ${ytResult.error}\n\n💡 *Dicas:*\n• Tente vídeos mais curtos\n• Use links diretos do YouTube\n• Verifique se o vídeo não está bloqueado`, m, userId);
      return true;
    }
   
    const finalTitle = title || ytResult.title || 'Música do YouTube';
    const finalAuthor = ytResult.author || 'Desconhecido';
    const durationFormatted = ytResult.duration ? `${Math.floor(ytResult.duration / 60)}:${(ytResult.duration % 60).toString().padStart(2, '0')}` : 'Desconhecida';
    const thumbnailUrl = `https://img.youtube.com/vi/${ytResult.videoId}/maxresdefault.jpg`;
    const views = ytResult.views || '0';
    const likes = ytResult.likes || '0';
    const uploadDate = ytResult.uploadDate || 'Desconhecida';
   
    if (userId && m.key.id) {
      const key = `${userId}_${m.key.id}`;
      progressMessages.delete(key);
    }
   
    // Baixar thumbnail
    let thumbnailBuffer = null;
    try {
      const thumbnailResponse = await axios.get(thumbnailUrl, { responseType: 'arraybuffer' });
      thumbnailBuffer = Buffer.from(thumbnailResponse.data);
    } catch (thumbError) {
      console.log('⚠️ Não foi possível baixar thumbnail');
    }
   
    // Enviar thumbnail se disponível
    if (thumbnailBuffer) {
      await sock.sendMessage(m.key.remoteJid, {
        image: thumbnailBuffer,
        caption: `🎵 *${finalTitle}*\n👤 ${finalAuthor}\n⏱️ ${durationFormatted}`
      }, { quoted: m });
    }
   
    await sendProgressMessage(sock, m.key.remoteJid, `✅ Música pronta!\n🎵 Enviando: *${finalTitle}*`, m, userId);
   
    // Banner com todas as informações
    const bannerCaption = `🎵 *AKIRA MUSIC PLAYER* 🎵\n\n` +
      `📌 *Título:* ${finalTitle}\n` +
      `👤 *Artista/Canal:* ${finalAuthor}\n` +
      `⏱️ *Duração:* ${durationFormatted}\n` +
      `👁️ *Visualizações:* ${views}\n` +
      `❤️ *Likes:* ${likes}\n` +
      `📅 *Data de Lançamento:* ${uploadDate}\n` +
      `🎬 *Plataforma:* YouTube\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🤖 *Akira Bot v21*\n` +
      `💫 Música otimizada para você!\n` +
      `🎧 Aproveite a melhor qualidade!\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━`;
   
    await sock.sendMessage(m.key.remoteJid, {
      audio: ytResult.buffer,
      mimetype: 'audio/mpeg',
      ptt: false,
      fileName: `${finalTitle.substring(0, 50).replace(/[^\w\s]/gi, '')}.mp3`,
      caption: bannerCaption
    }, { quoted: m });
   
    console.log('✅ Música enviada com sucesso');
   
  } catch (e) {
    console.error('Erro no comando play/ytmp3:', e);
   
    // Mensagem de erro mais detalhada
    let errorMsg = '❌ Erro ao baixar música: ';
    if (e.message.includes('timeout')) {
      errorMsg += 'Timeout - O vídeo pode ser muito longo ou a conexão lenta.';
    } else if (e.message.includes('format')) {
      errorMsg += 'Formato não suportado - O vídeo pode ter restrições.';
    } else if (e.message.includes('private')) {
      errorMsg += 'Vídeo privado ou bloqueado - Não é possível baixar.';
    } else {
      errorMsg += e.message;
    }
   
    await sock.sendMessage(m.key.remoteJid, { text: errorMsg }, { quoted: m });
  }
  return true;
      // === STICKER ANIMADO A PARTIR DE VÍDEO OU STICKER ANIMADO ===
      case 'gif':
        try {
          let quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
          if (quoted?.viewOnceMessageV2?.message) quoted = quoted.viewOnceMessageV2.message;
          else if (quoted?.viewOnceMessageV2Extension?.message) quoted = quoted.viewOnceMessageV2Extension.message;
          else if (quoted?.viewOnceMessage?.message) quoted = quoted.viewOnceMessage.message;
          const hasVideo = m.message?.videoMessage || quoted?.videoMessage;
          const hasSticker = quoted?.stickerMessage;
          if (!hasVideo && !hasSticker) {
            await sock.sendMessage(m.key.remoteJid, {
              text: '🎥 Como usar:\n- Envie um vídeo com legenda `#gif`\n- OU responda um vídeo/sticker animado com `#gif`\n\n⚠️ Vídeos até 30s'
            }, { quoted: m });
            return true;
          }
          const packName = 'Akira Bot';
          const author = m.pushName || 'Akira Bot';
          let out = null;
          if (hasVideo) {
            const mediaMessage = quoted?.videoMessage || m.message.videoMessage;
            const mediaBuffer = await downloadMediaMessage({ videoMessage: mediaMessage });
            if (!mediaBuffer) {
              await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao baixar vídeo.' }, { quoted: m });
              return true;
            }
            const max = 30;
            const res = await createAnimatedStickerWithMetadata(mediaBuffer, packName, author, max);
            if (res) out = res; else {
              await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao criar sticker animado.' }, { quoted: m });
              return true;
            }
          } else if (hasSticker) {
            const stickerMsg = quoted.stickerMessage;
            const stickerBuf = await downloadMediaMessage({ stickerMessage: stickerMsg });
            if (!stickerBuf) {
              await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao baixar sticker.' }, { quoted: m });
              return true;
            }
            if (!isStickerAnimated(stickerBuf)) {
              await sock.sendMessage(m.key.remoteJid, { text: '❌ Este sticker não é animado. Use `#sticker`.' }, { quoted: m });
              return true;
            }
            out = await createAnimatedStickerFromAnimatedSticker(stickerBuf, m, packName, author);
            if (!out) {
              await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao criar sticker animado.' }, { quoted: m });
              return true;
            }
          }
          await sock.sendMessage(m.key.remoteJid, { sticker: out }, { quoted: m });
        } catch (e) {
          console.error('Erro no comando gif:', e);
          await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao processar sticker animado.' }, { quoted: m });
        }
        return true;
      // === YTMP4 (DOWNLOAD DE VÍDEO DO YOUTUBE) ===
      case 'ytmp4':
      case 'ytvideo':
        if (!textoCompleto) {
          await sock.sendMessage(m.key.remoteJid, {
            text: '🎬 *COMO USAR:* \n`#ytmp4 https://youtube.com/...`\n`#ytvideo https://youtube.com/...`'
          }, { quoted: m });
          return true;
        }
       
        try {
          const url = args[0] || textoCompleto;
         
          if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
            await sock.sendMessage(m.key.remoteJid, {
              text: '❌ URL do YouTube inválida.'
            }, { quoted: m });
            return true;
          }
         
          await sock.sendMessage(m.key.remoteJid, {
            text: '⏳ Baixando vídeo do YouTube... Isso pode levar alguns minutos.'
          }, { quoted: m });
         
          let videoId = '';
          if (url.includes('youtube.com/watch?v=')) {
            videoId = url.split('v=')[1]?.split('&')[0];
          } else if (url.includes('youtu.be/')) {
            videoId = url.split('youtu.be/')[1]?.split('?')[0];
          }
         
          if (!videoId) {
            await sock.sendMessage(m.key.remoteJid, {
              text: '❌ Não consegui extrair o ID do vídeo.'
            }, { quoted: m });
            return true;
          }
         
          const info = await ytdl.getInfo(videoId);
          const videoFormat = ytdl.chooseFormat(info.formats, {
            quality: 'highest',
            filter: 'videoandaudio'
          });
         
          if (!videoFormat) {
            await sock.sendMessage(m.key.remoteJid, {
              text: '❌ Não foi possível encontrar um formato adequado.'
            }, { quoted: m });
            return true;
          }
         
          const outputPath = generateRandomFilename('mp4');
          const writeStream = fs.createWriteStream(outputPath);
          const stream = ytdl.downloadFromInfo(info, { format: videoFormat });
         
          await new Promise((resolve, reject) => {
            stream.pipe(writeStream);
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
            stream.on('error', reject);
          });
         
          const videoBuffer = fs.readFileSync(outputPath);
          const stats = fs.statSync(outputPath);
         
          if (stats.size > 50 * 1024 * 1024) {
            cleanupFile(outputPath);
            await sock.sendMessage(m.key.remoteJid, {
              text: '❌ Vídeo muito grande (>50MB). Tente um vídeo mais curto.'
            }, { quoted: m });
            return true;
          }
         
          await sock.sendMessage(m.key.remoteJid, {
            video: videoBuffer,
            mimetype: 'video/mp4',
            caption: info.videoDetails.title || 'Vídeo do YouTube'
          }, { quoted: m });
         
          cleanupFile(outputPath);
          console.log('✅ Vídeo enviado com sucesso');
         
        } catch (e) {
          console.error('Erro no comando ytmp4:', e);
          await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao baixar vídeo: ' + e.message }, { quoted: m });
        }
        return true;
     
      // === LEVEL POR GRUPO ===
      case 'level':
      case 'nivel':
      case 'rank':
        try {
          const gid = String(m.key.remoteJid || '');
          const isGroup = gid.endsWith('@g.us');
          if (!isGroup) {
            await sock.sendMessage(m.key.remoteJid, { text: '📵 Sistema de level não funciona em PV.' }, { quoted: m });
            return true;
          }
          const toggles = loadJSON(JSON_PATHS.leveling) || {};
          const active = !!toggles[gid];
          const arg = (args[0]||'').toLowerCase();
          const num = extrairNumeroReal(m); const nm = m.pushName||'Usuário';
          const isOwner = verificarPermissaoDono(num, nm);
          if (arg === 'on' || arg === 'off' || arg === 'status') {
            if (!isOwner) { await sock.sendMessage(m.key.remoteJid, { text: '🚫 Dono apenas.' }, { quoted: m }); return true; }
            if (arg === 'on') { toggles[gid] = true; saveJSON(JSON_PATHS.leveling, toggles); await sock.sendMessage(m.key.remoteJid, { text: '✅ Level ativado neste grupo.' }, { quoted: m }); return true; }
            if (arg === 'off') { toggles[gid] = false; saveJSON(JSON_PATHS.leveling, toggles); await sock.sendMessage(m.key.remoteJid, { text: '🚫 Level desativado neste grupo.' }, { quoted: m }); return true; }
            await sock.sendMessage(m.key.remoteJid, { text: `ℹ️ Status do level: ${active ? 'Ativo' : 'Inativo'}` }, { quoted: m });
            return true;
          }
          if (!active) { await sock.sendMessage(m.key.remoteJid, { text: '🚫 O sistema de level está desativado neste grupo.' }, { quoted: m }); return true; }
          const uid = m.key.participant || m.key.remoteJid;
          const rec = getGroupLevelRecord(gid, uid, true);
          const requiredXp = getRequiredGroupXp(rec.level);
          const progressBarLength = 20;
          const progress = Math.min((rec.xp / requiredXp) * 100, 100);
          const filled = Math.round((progress / 100) * progressBarLength);
          const empty = progressBarLength - filled;
          const progressBar = '█'.repeat(filled) + '░'.repeat(empty);
          const patente = getPatente(rec.level);
          const txt = `🎉 LEVEL (por grupo)
👤 @${uid.split('@')[0]}
📊 Nível: ${rec.level}
⭐ XP: ${rec.xp}/${requiredXp}
🏅 Patente: ${patente}
${progressBar} ${progress.toFixed(1)}%`;
          await sock.sendMessage(m.key.remoteJid, { text: txt, contextInfo: { mentionedJid: [uid] } }, { quoted: m });
        } catch (e) { await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro no level.' }, { quoted: m }); }
        return true;
     
      // === COMANDO REGISTRAR (SISTEMA DE REGISTRO) ===
      case 'registrar':
      case 'register':
      case 'reg':
        try {
          const senderJid = m.key.participant || m.key.remoteJid;
         
          if (checkRegisteredUser(senderJid)) {
                      await sock.sendMessage(m.key.remoteJid, {
            text: '✅ Você já está registrado!'
          }, { quoted: m });
          return true;
        }

        if (!textoCompleto.includes('|')) {
          await sock.sendMessage(m.key.remoteJid, {
            text: '📝 *Como se registrar:*\n`#registrar Nome|Idade`\n\n*Exemplo:*\n`#registrar Isaac Quarenta|20`\n\n⚠️ *Idade mínima: 12 anos*\n⚠️ *Idade máxima: 40 anos*'
          }, { quoted: m });
          return true;
        }

        const [nome, idadeStr] = textoCompleto.split('|').map(s => s.trim());
        const idade = parseInt(idadeStr);

        if (!nome || !idade) {
          await sock.sendMessage(m.key.remoteJid, {
            text: '❌ Formato inválido. Use: `#registrar Nome|Idade`'
          }, { quoted: m });
          return true;
        }

        if (isNaN(idade)) {
          await sock.sendMessage(m.key.remoteJid, {
            text: '❌ Idade deve ser um número.'
          }, { quoted: m });
          return true;
        }

        if (idade < 12) {
          await sock.sendMessage(m.key.remoteJid, {
            text: '❌ Idade mínima é 12 anos.'
          }, { quoted: m });
          return true;
        }

        if (idade > 40) {
          await sock.sendMessage(m.key.remoteJid, {
            text: '❌ Idade máxima é 40 anos.'
          }, { quoted: m });
          return true;
        }

        if (nome.length > 60) {
          await sock.sendMessage(m.key.remoteJid, {
            text: '❌ Nome muito longo. Máximo 60 caracteres.'
          }, { quoted: m });
          return true;
        }

        const serial = createSerial(20);
        const time = moment().tz('America/Sao_Paulo').format('DD/MM/YYYY HH:mm:ss');

        addRegisteredUser(senderJid, nome, idade, time, serial);

        addLevelingId(senderJid);

        const registroText = `✅ *REGISTRO CONCLUÍDO!* ✅
👤 *Nome:* ${nome}
🎂 *Idade:* ${idade} anos
🆔 *Serial:* ${serial}
📅 *Registrado em:* ${time}
🎮 *Level inicial:* 0
⭐ *XP inicial:* 0
✨ Agora você pode usar todos os comandos do bot!
Use \`#menu\` para ver todos os comandos disponíveis.`;

        await sock.sendMessage(m.key.remoteJid, {
          text: registroText
        }, { quoted: m });

      } catch (e) {
        console.error('Erro no comando registrar:', e);
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao registrar.' }, { quoted: m });
      }
      return true;

    // === COMANDO PERFIL (INFORMAÇÕES DO USUÁRIO) ===
    case 'perfil':
    case 'profile':
    case 'info':
      try {
        const senderJid = m.key.participant || m.key.remoteJid;

        if (!checkRegisteredUser(senderJid)) {
          await sock.sendMessage(m.key.remoteJid, {
            text: '📝 Você ainda não está registrado!\nUse `#registrar Nome|Idade` para se registrar.'
          }, { quoted: m });
          return true;
        }

        const nome = getRegisterName(senderJid);
        const idade = getRegisterAge(senderJid);
        const time = getRegisterTime(senderJid);
        const serial = getRegisterSerial(senderJid);
        const level = getLevelingLevel(senderJid);
        const xp = getLevelingXp(senderJid);
        const patente = getPatente(level);
        const requiredXp = 5 * Math.pow(level, (5 / 2)) + 50 * level + 100;

        const perfilText = `👤 *PERFIL DO USUÁRIO* 👤
📛 *Nome:* ${nome}
🎂 *Idade:* ${idade} anos
🆔 *Serial:* ${serial}
📅 *Registrado em:* ${time}
🎮 *Sistema de Level:*
📊 Nível: ${level}
⭐ XP: ${xp}/${requiredXp}
🏅 Patente: ${patente}
🔗 *Seu link:* wa.me/${senderJid.split('@')[0]}
💬 *Continue interagindo para subir de nível!*`;

        await sock.sendMessage(m.key.remoteJid, {
          text: perfilText
        }, { quoted: m });

      } catch (e) {
        console.error('Erro no comando perfil:', e);
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao verificar perfil.' }, { quoted: m });
      }
      return true;

    // === PING ===
    case 'ping':
      try {
        const startTime = Date.now();
        
        // Envia mensagem inicial
        const pingMsg = await sock.sendMessage(m.key.remoteJid, { 
          text: '🏓 Ping iniciado...' 
        }, { quoted: m });
        
        const latency = Date.now() - startTime;
        const uptime = Math.floor(process.uptime());
        const uptimeStr = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${uptime % 60}s`;
        
        // Resposta detalhada
        const pingResponse = `
🏓 *PONG!*

⚡ *Latência:* ${latency}ms
📡 *Uptime:* ${uptimeStr}
🤖 *Bot:* Akira V21
📊 *Status:* Online e Operacional
🔗 *API:* Conectada
🎤 *STT/TTS:* Ativo

Sistema respondendo normalmente!`.trim();
        
        await sock.sendMessage(m.key.remoteJid, { 
          text: pingResponse 
        }, { quoted: pingMsg });
        
      } catch (e) {
        console.error('Erro no comando ping:', e);
        await sock.sendMessage(m.key.remoteJid, { 
          text: '❌ Ping falhou. Tente novamente.' 
        }, { quoted: m });
      }
      return true;

    // === REVEAL VIEW-ONCE (IMAGEM/VÍDEO/ÁUDIO) — DONO EM GRUPO ===
    case 'reveal':
    case 'revelar':
    case 'openvo':
    case 'abrirvo':
      try {
        const ehGrupo = String(m.key.remoteJid || '').endsWith('@g.us');
        const numeroUsuario = extrairNumeroReal(m);
        const nomeUsuario = m.pushName || 'Desconhecido';
        const ehDono = verificarPermissaoDono(numeroUsuario, nomeUsuario);
        if (!ehGrupo || !ehDono) {
          await sock.sendMessage(m.key.remoteJid, { text: '🚫 Comando restrito ao dono e apenas em grupos.' }, { quoted: m });
          return true;
        }
        let q = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!q) {
          await sock.sendMessage(m.key.remoteJid, { text: 'Responda a uma mensagem view-once.' }, { quoted: m });
          return true;
        }
        if (q?.viewOnceMessageV2?.message) q = q.viewOnceMessageV2.message;
        else if (q?.viewOnceMessageV2Extension?.message) q = q.viewOnceMessageV2Extension.message;
        else if (q?.viewOnceMessage?.message) q = q.viewOnceMessage.message;
        let content = null;
        if (q.imageMessage) {
          const buf = await downloadMediaMessage({ imageMessage: q.imageMessage });
          content = { image: buf, caption: '🔓 View-once revelada' };
        } else if (q.videoMessage) {
          const buf = await downloadMediaMessage({ videoMessage: q.videoMessage });
          content = { video: buf, caption: '🔓 View-once revelada' };
        } else if (q.audioMessage) {
          const buf = await downloadMediaMessage({ audioMessage: q.audioMessage });
          content = { audio: buf, mimetype: 'audio/mpeg', ptt: false };
        }
        if (!content) {
          await sock.sendMessage(m.key.remoteJid, { text: 'Tipo de view-once não suportado.' }, { quoted: m });
          return true;
        }
        await sock.sendMessage(m.key.remoteJid, content, { quoted: m });
      } catch (e) {
        await sock.sendMessage(m.key.remoteJid, { text: 'Falha ao revelar view-once.' }, { quoted: m });
      }
      return true;

    // === ADMIN GRUPO (Dono) ===
    case 'setppgc':
      try {
        if (!String(m.key.remoteJid).endsWith('@g.us')) { await sock.sendMessage(m.key.remoteJid, { text: '❌ Só em grupos.' }, { quoted: m }); return true; }
        const num = extrairNumeroReal(m); const nm = m.pushName||'Usuário';
        if (!verificarPermissaoDono(num, nm)) { await sock.sendMessage(m.key.remoteJid, { text: '🚫 Dono apenas.' }, { quoted: m }); return true; }
        const q = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const imgMsg = m.message?.imageMessage || q?.imageMessage;
        if (!imgMsg) { await sock.sendMessage(m.key.remoteJid, { text: 'Responda a uma imagem.' }, { quoted: m }); return true; }
        const buf = await downloadMediaMessage({ imageMessage: imgMsg });
        await sock.updateProfilePicture(m.key.remoteJid, buf);
        await sock.sendMessage(m.key.remoteJid, { text: '✅ Foto do grupo atualizada.' }, { quoted: m });
      } catch (e) { await sock.sendMessage(m.key.remoteJid, { text: '❌ Falha ao atualizar foto.' }, { quoted: m }); }
      return true;

    case 'setnamegp':
    case 'setname':
      try {
        if (!String(m.key.remoteJid).endsWith('@g.us')) { await sock.sendMessage(m.key.remoteJid, { text: '❌ Só em grupos.' }, { quoted: m }); return true; }
        const num = extrairNumeroReal(m); const nm = m.pushName||'Usuário';
        if (!verificarPermissaoDono(num, nm)) { await sock.sendMessage(m.key.remoteJid, { text: '🚫 Dono apenas.' }, { quoted: m }); return true; }
        const newName = args.join(' ').trim();
        if (!newName) { await sock.sendMessage(m.key.remoteJid, { text: 'Uso: #setname Novo nome' }, { quoted: m }); return true; }
        await sock.groupUpdateSubject(m.key.remoteJid, newName);
        await sock.sendMessage(m.key.remoteJid, { text: '✅ Nome do grupo atualizado.' }, { quoted: m });
      } catch (e) { await sock.sendMessage(m.key.remoteJid, { text: '❌ Falha ao mudar nome.' }, { quoted: m }); }
      return true;

    case 'setdesc':
      try {
        if (!String(m.key.remoteJid).endsWith('@g.us')) { await sock.sendMessage(m.key.remoteJid, { text: '❌ Só em grupos.' }, { quoted: m }); return true; }
        const num = extrairNumeroReal(m); const nm = m.pushName||'Usuário';
        if (!verificarPermissaoDono(num, nm)) { await sock.sendMessage(m.key.remoteJid, { text: '🚫 Dono apenas.' }, { quoted: m }); return true; }
        const newDesc = args.join(' ').trim();
        if (!newDesc) { await sock.sendMessage(m.key.remoteJid, { text: 'Uso: #setdesc Nova descrição' }, { quoted: m }); return true; }
        await sock.groupUpdateDescription(m.key.remoteJid, newDesc);
        await sock.sendMessage(m.key.remoteJid, { text: '✅ Descrição do grupo atualizada.' }, { quoted: m });
      } catch (e) { await sock.sendMessage(m.key.remoteJid, { text: '❌ Falha ao mudar descrição.' }, { quoted: m }); }
      return true;

    // === PESQUISA ===
    case 'pinterest':
    case 'pin':
    case 'image':
    case 'img':
      try {
        if (!args.length) { await sock.sendMessage(m.key.remoteJid, { text: 'Uso: #pinterest termo [qtd 1-5]' }, { quoted: m }); return true; }
        const q = args.join(' ');
        const parts = q.split('|');
        const query = parts[0].trim();
        let cnt = Math.min(Math.max(parseInt(parts[1]||'1',10)||1,1),5);
        const url = `https://api.fdci.se/sosmed/rep.php?gambar=${encodeURIComponent(query)}`;
        const res = await axios.get(url, { timeout: 15000 });
        const arr = Array.isArray(res.data) ? res.data.slice(0,cnt) : [];
        if (!arr.length) { await sock.sendMessage(m.key.remoteJid, { text: 'Nada encontrado.' }, { quoted: m }); return true; }
        for (const link of arr) {
          try {
            const img = await axios.get(link, { responseType: 'arraybuffer', timeout: 15000 });
            await sock.sendMessage(m.key.remoteJid, { image: Buffer.from(img.data), caption: `🔎 ${query}` }, { quoted: m });
            await delay(400);
          } catch (_) {}
        }
      } catch (e) { await sock.sendMessage(m.key.remoteJid, { text: 'Erro no pinterest.' }, { quoted: m }); }
      return true;

    case 'web':
      try {
        if (!args.length) { await sock.sendMessage(m.key.remoteJid, { text: 'Uso: #web termo de busca' }, { quoted: m }); return true; }
        const query = args.join(' ');
        const ddg = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const { data } = await axios.get(ddg, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(data);
        const results = [];
        $('a.result__a').each((i, el) => {
          if (i < 5) results.push({ title: $(el).text().trim(), href: $(el).attr('href') });
        });
        if (!results.length) { await sock.sendMessage(m.key.remoteJid, { text: 'Sem resultados.' }, { quoted: m }); return true; }
        const txt = results.map((r,i)=>`${i+1}. ${r.title}\n${r.href}`).join('\n\n');
        await sock.sendMessage(m.key.remoteJid, { text: `🔎 Resultados para: ${query}\n\n${txt}` }, { quoted: m });
      } catch (e) { await sock.sendMessage(m.key.remoteJid, { text: 'Erro na busca web.' }, { quoted: m }); }
      return true;

    // === EFEITOS DE ÁUDIO ===
    case 'nightcore':
    case 'slow':
    case 'esquilo':
    case 'gemuk':
    case 'fast':
    case 'bass':
    case 'grave':
    case 'earrape':
    case 'estourar':
    case 'imut':
    case 'hode':
      try {
        const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const hasAudio = quoted?.audioMessage;

        if (!hasAudio) {
          await sock.sendMessage(m.key.remoteJid, {
            text: `🎵 *Como usar:*\nResponda a um áudio com \`#${comando}\``
          }, { quoted: m });
          return true;
        }

        await sock.sendMessage(m.key.remoteJid, {
          text: `⏳ Aplicando efeito ${comando}...`
        }, { quoted: m });

        const audioBuffer = await downloadMediaMessage({ audioMessage: quoted.audioMessage });

        if (!audioBuffer) {
          await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao baixar áudio.' }, { quoted: m });
          return true;
        }

        const effectResult = await applyAudioEffect(audioBuffer, comando);

        if (effectResult.error) {
          await sock.sendMessage(m.key.remoteJid, {
            text: `❌ ${effectResult.error}`
          }, { quoted: m });
          return true;
        }

        await sock.sendMessage(m.key.remoteJid, {
          audio: effectResult.buffer,
          mimetype: 'audio/mpeg',
          ptt: false
        }, { quoted: m });

        console.log(`✅ Efeito ${comando} aplicado com sucesso`);

      } catch (e) {
        console.error(`Erro no comando ${comando}:`, e);
        await sock.sendMessage(m.key.remoteJid, { text: `❌ Erro ao aplicar efeito ${comando}.` }, { quoted: m });
      }
      return true;

    // === CLEARCHAT (LIMPAR TODAS AS MENSAGENS) ===
    case 'clearchat':
      try {
        const senderJid = m.key.participant || m.key.remoteJid;
        const numeroUsuario = extrairNumeroReal(m);
        const nomeUsuario = m.pushName || 'Desconhecido';
        const ehDono = verificarPermissaoDono(numeroUsuario, nomeUsuario);

        if (!ehDono) {
          console.log('❌ [BLOQUEADO] Comando #clearchat usado por não-dono:', numeroUsuario, nomeUsuario);
          await sock.sendMessage(m.key.remoteJid, {
            text: '🚫 *COMANDO RESTRITO!* Apenas Isaac Quarenta pode usar este comando.'
          }, { quoted: m });
          return true;
        }

        await sock.sendMessage(m.key.remoteJid, {
          text: '🧹 Limpando todas as mensagens...'
        }, { quoted: m });

        const chats = [];
        try {
          if (store && store.chats && typeof store.chats.all === 'function') {
            for (const c of store.chats.all()) {
              if (c?.id && c.id !== 'status@broadcast') chats.push({ id: c.id, messageTimestamp: c.conversationTimestamp || 0 });
            }
          } else {
            const groups = await sock.groupFetchAllParticipating();
            for (const id of Object.keys(groups || {})) chats.push({ id, messageTimestamp: 0 });
          }
        } catch (e) { console.error('clearchat: erro ao obter chats:', e.message); }

        for (const chat of chats) {
          try {
            await sock.chatModify({
              delete: true,
              lastMessages: [{ key: chat.id, messageTimestamp: chat.lastMessageTimestamp }]
            }, chat.id);
          } catch (e) {}
        }

        await sock.sendMessage(m.key.remoteJid, {
          text: '✅ Todas as mensagens foram limpas!'
        }, { quoted: m });

      } catch (e) {
        console.error('Erro no comando clearchat:', e);
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao limpar mensagens.' }, { quoted: m });
      }
      return true;

    // === BLACKLIST (DONO) ===
    case 'blacklist':
      try {
        const num = extrairNumeroReal(m); const nm = m.pushName||'Usuário';
        if (!verificarPermissaoDono(num, nm)) { await sock.sendMessage(m.key.remoteJid, { text: '🚫 Dono apenas.' }, { quoted: m }); return true; }
        const sub = (args[0]||'').toLowerCase();
        if (sub === 'add') {
          const ctx = m.message?.extendedTextMessage?.contextInfo; const menc = ctx?.mentionedJid||[];
          let targets = menc.length ? menc : [];
          if (!targets.length && ctx?.participant) targets = [ctx.participant];
          if (!targets.length && args[1]) targets = [args[1].replace(/[^0-9]/g,'') + '@s.whatsapp.net'];
          if (!targets.length) { await sock.sendMessage(m.key.remoteJid, { text: 'Uso: #blacklist add @usuario|numero' }, { quoted: m }); return true; }
          for (const t of targets) addToBlacklist(t, 'manual');
          await sock.sendMessage(m.key.remoteJid, { text: '✅ Adicionado(s) à blacklist.' }, { quoted: m });
        } else if (sub === 'remove' || sub === 'rm' || sub === 'del') {
          const ctx = m.message?.extendedTextMessage?.contextInfo; const menc = ctx?.mentionedJid||[];
          let targets = menc.length ? menc : [];
          if (!targets.length && ctx?.participant) targets = [ctx.participant];
          if (!targets.length && args[1]) targets = [args[1].replace(/[^0-9]/g,'') + '@s.whatsapp.net'];
          if (!targets.length) { await sock.sendMessage(m.key.remoteJid, { text: 'Uso: #blacklist remove @usuario|numero' }, { quoted: m }); return true; }
          for (const t of targets) removeFromBlacklist(t);
          await sock.sendMessage(m.key.remoteJid, { text: '✅ Removido(s) da blacklist.' }, { quoted: m });
        } else if (sub === 'list') {
          const list = loadBlacklist();
          if (!list.length) { await sock.sendMessage(m.key.remoteJid, { text: 'Lista vazia.' }, { quoted: m }); return true; }
          const txt = list.map((x,i)=>`${i+1}. @${String(x.id).split('@')[0]} — ${x.reason||'-'}`).join('\n');
          await sock.sendMessage(m.key.remoteJid, { text: `🛑 Blacklist:\n${txt}`, contextInfo: { mentionedJid: list.map(x=>x.id) } }, { quoted: m });
        } else {
          await sock.sendMessage(m.key.remoteJid, { text: 'Uso: #blacklist add|remove|list' }, { quoted: m });
        }
      } catch (e) { await sock.sendMessage(m.key.remoteJid, { text: 'Erro no blacklist.' }, { quoted: m }); }
      return true;

    // === BC (TRANSMISSÃO PARA TODOS OS CHATS) ===
    case 'bc':
    case 'broadcast':
    case 'transmitir':
      try {
        const senderJid = m.key.participant || m.key.remoteJid;
        const numeroUsuario = extrairNumeroReal(m);
        const nomeUsuario = m.pushName || 'Desconhecido';
        const ehDono = verificarPermissaoDono(numeroUsuario, nomeUsuario);

        if (!ehDono) {
          console.log('❌ [BLOQUEADO] Comando #bc usado por não-dono:', numeroUsuario, nomeUsuario);
          await sock.sendMessage(m.key.remoteJid, {
            text: '🚫 *COMANDO RESTRITO!* Apenas Isaac Quarenta pode usar este comando.'
          }, { quoted: m });
          return true;
        }

        if (!textoCompleto) {
          await sock.sendMessage(m.key.remoteJid, {
            text: '📢 *Como usar:*\n`#bc Sua mensagem aqui`\n\n*Exemplo:*\n`#bc Olá a todos! Nova atualização disponível.`'
          }, { quoted: m });
          return true;
        }

        await sock.sendMessage(m.key.remoteJid, {
          text: '📡 Iniciando transmissão para todos os chats...'
        }, { quoted: m });

        const chats = [];
        try {
          if (store && store.chats && typeof store.chats.all === 'function') {
            for (const c of store.chats.all()) {
              if (c?.id && c.id !== 'status@broadcast') chats.push({ id: c.id });
            }
          } else {
            const groups = await sock.groupFetchAllParticipating();
            for (const id of Object.keys(groups || {})) chats.push({ id });
          }
        } catch (e) { console.error('bc: erro ao obter chats:', e.message); }
        let successCount = 0;
        let failCount = 0;

        for (const chat of chats) {
          try {
            await sock.sendMessage(chat.id, {
              text: `📢 *TRANSMISSÃO DO BOT*\n\n${textoCompleto}\n\n_Esta é uma mensagem automática._`
            });
            successCount++;

            await delay(100);
          } catch (e) {
            failCount++;
          }
        }

        await sock.sendMessage(m.key.remoteJid, {
          text: `✅ Transmissão concluída!\n\n✅ Enviado para: ${successCount} chats\n❌ Falhas: ${failCount}`
        }, { quoted: m });

      } catch (e) {
        console.error('Erro no comando bc:', e);
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro na transmissão.' }, { quoted: m });
      }
      return true;

    // === COMANDOS DE GRUPO - TAGALL E HIDETAG ===
    case 'tagall':
    case 'marcartodos':
    case 'todos':
      if (!ehGrupo) {
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Este comando só funciona em grupos.' }, { quoted: m });
        return true;
      }
      
      try {
        const groupInfo = await obterInfoGrupo(sock, m.key.remoteJid);
        const participants = groupInfo.participants.map(p => p.id);
        const mentions = participants;
        const text = args.join(' ') || '📢 *MARCAÇÃO GERAL* 📢\n\nTodos foram marcados!';
        
        await sock.sendMessage(m.key.remoteJid, { text: text, mentions: mentions }, { quoted: m });
      } catch (e) {
        console.error('Erro no comando tagall:', e);
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao marcar todos.' }, { quoted: m });
      }
      return true;
      
    case 'hidetag':
    case 'ocultar':
      if (!ehGrupo) {
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Este comando só funciona em grupos.' }, { quoted: m });
        return true;
      }
      
      try {
        const groupInfo = await obterInfoGrupo(sock, m.key.remoteJid);
        const participants = groupInfo.participants.map(p => p.id);
        const mentions = participants;
        const text = args.join(' ') || 'Mensagem oculta';
        
        await sock.sendMessage(m.key.remoteJid, { text: text, mentions: mentions });
      } catch (e) {
        console.error('Erro no comando hidetag:', e);
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao enviar mensagem oculta.' }, { quoted: m });
      }
      return true;

    // === DONATE / APOIO ===
    case 'donate':
    case 'doar':
    case 'apoia':
    case 'doacao':
      try {
        const donateText = `╔════════════════════════════════════════════════════╗
║  ❤️ APOIE O PROJETO AKIRA BOT ❤️    ║
╚════════════════════════════════════════════════════╝

🙏 *Você gosta do Akira?*

Seu apoio nos ajuda a manter o bot:
✅ Online 24/7
✅ Com novas features
✅ Sem publicidades
✅ Gratuito para todos

╔════════════════════════════════════════════════════╗
║  💰 FORMAS DE APOIAR                  ║
╚════════════════════════════════════════════════════╝

🔑 *PIX (IMEDIATO):*
\`akira.bot.dev@gmail.com\`

☕ *COMPRE UM CAFÉ:*
https://ko-fi.com/isaacquarenta

💳 *PAYPAL:*
https://paypal.me/isaacquarenta

🎁 *QUALQUER VALOR AJUDA!*
Desde R$ 1 até quanto você quiser contribuir

╔════════════════════════════════════════════════════╗
║  🙏 AGRADECIMENTOS ESPECIAIS          ║
╚════════════════════════════════════════════════════╝

Todos que contribuem receberão:
✨ Meu sincero agradecimento
✨ Suporte prioritário
✨ Novas features primeiro
✨ Reconhecimento especial

═══════════════════════════════════════════════════════

*Desenvolvido com ❤️ por Isaac Quarenta*

_Obrigado por apoiar um projeto feito com paixão!_ 🚀`;
        await sock.sendMessage(m.key.remoteJid, { text: donateText }, { quoted: m });
      } catch (e) {
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao exibir opções de doação.' }, { quoted: m });
      }
      return true;

    // === JOGOS/UTILS ===
    case 'dado':
      try {
        const n = Math.floor(Math.random() * 6) + 1;
        await sock.sendMessage(m.key.remoteJid, { text: `🎲 Você tirou: ${n}` }, { quoted: m });
      } catch (e) {
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao rolar o dado.' }, { quoted: m });
      }
      return true;

    case 'moeda':
    case 'caracoroa':
      try {
        const res = Math.random() < 0.5 ? 'cara' : 'coroa';
        await sock.sendMessage(m.key.remoteJid, { text: `🪙 Resultado: ${res.toUpperCase()}` }, { quoted: m });
      } catch (e) {
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao lançar a moeda.' }, { quoted: m });
      }
      return true;

    case 'slot':
      try {
        const items = ['🍒','🍋','🍇','🍉','🍎','🍍','🥝','🍑'];
        const a = items[Math.floor(Math.random()*items.length)];
        const b = items[Math.floor(Math.random()*items.length)];
        const c = items[Math.floor(Math.random()*items.length)];
        const win = (a===b && b===c);
        const text = `🎰 SLOT\n[ ${a} | ${b} | ${c} ]\n\n${win ? '🎉 Você ganhou!' : '😔 Você perdeu...'}`;
        await sock.sendMessage(m.key.remoteJid, { text }, { quoted: m });
      } catch (e) {
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro no slot.' }, { quoted: m });
      }
      return true;

    case 'chance':
      try {
        if (!args.length) {
          await sock.sendMessage(m.key.remoteJid, { text: '📊 Uso: #chance <algo>\nEx.: #chance de chover hoje' }, { quoted: m });
          return true;
        }
        const percent = Math.floor(Math.random()*101);
        const txt = `📊 A chance ${args.join(' ')} é de ${percent}%`;
        await sock.sendMessage(m.key.remoteJid, { text: txt }, { quoted: m });
      } catch (e) {
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao calcular chance.' }, { quoted: m });
      }
      return true;

    case 'gay':
      try {
        const p = Math.floor(Math.random()*101);
        await sock.sendMessage(m.key.remoteJid, { text: `🏳️‍🌈 Você é ${p}% gay` }, { quoted: m });
      } catch (e) {
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro.' }, { quoted: m });
      }
      return true;

          case 'ship':
          try {
            const ctx = m.message?.extendedTextMessage?.contextInfo;
            const menc = ctx?.mentionedJid || [];
            if (menc.length < 2) {
              await sock.sendMessage(m.key.remoteJid, { text: '💞 Uso: #ship @pessoa1 @pessoa2' }, { quoted: m });
              return true;
            }
            const pct = Math.floor(Math.random()*101);
            const txt = `💞 Compatibilidade entre @${menc[0].split('@')[0]} e @${menc[1].split('@')[0]}: ${pct}%`;
            await sock.sendMessage(m.key.remoteJid, { text: txt, contextInfo: { mentionedJid: menc } }, { quoted: m });
          } catch (e) {
            await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro no ship.' }, { quoted: m });
          }
          return true;
    
        case 'welcome':
        case 'bemvindo':
          try {
            if (!ehGrupo) { await sock.sendMessage(m.key.remoteJid, { text: '❌ Este comando só funciona em grupos.' }, { quoted: m }); return true; }
            const num = extrairNumeroReal(m); const nm = m.pushName||'Usuário';
            if (!verificarPermissaoDono(num, nm)) { await sock.sendMessage(m.key.remoteJid, { text: '🚫 Dono apenas.' }, { quoted: m }); return true; }
    
            const arg = (args[0] || '').toLowerCase();
            const welcomeSettings = loadJSON(JSON_PATHS.welkom) || {};
            const groupId = m.key.remoteJid;
    
            if (arg === 'on') {
              welcomeSettings[groupId] = true;
              saveJSON(JSON_PATHS.welkom, welcomeSettings);
              await sock.sendMessage(m.key.remoteJid, { text: '✅ Sistema de boas-vindas ATIVADO para este grupo.' }, { quoted: m });
            } else if (arg === 'off') {
              delete welcomeSettings[groupId]; // or set to false
              saveJSON(JSON_PATHS.welkom, welcomeSettings);
              await sock.sendMessage(m.key.remoteJid, { text: '🚫 Sistema de boas-vindas DESATIVADO para este grupo.' }, { quoted: m });
            } else {
              const status = welcomeSettings[groupId] ? 'ATIVADO' : 'DESATIVADO';
              await sock.sendMessage(m.key.remoteJid, { text: `ℹ️ Status do sistema de boas-vindas: ${status}\n\nUse \`#welcome on\` ou \`#welcome off\`.` }, { quoted: m });
            }
          } catch (e) {
            console.error('Erro no comando welcome:', e);
            await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao configurar as boas-vindas.' }, { quoted: m });
          }
          return true;
    
        case 'tagall':      try {
        if (!String(m.key.remoteJid).endsWith('@g.us')) {
          await sock.sendMessage(m.key.remoteJid, { text: '❌ Este comando só funciona em grupos.' }, { quoted: m });
          return true;
        }
        const senderNum = extrairNumeroReal(m);
        const senderName = m.pushName || 'Desconhecido';
        const ehDono = verificarPermissaoDono(senderNum, senderName);
        if (!ehDono) {
          await sock.sendMessage(m.key.remoteJid, { text: '🚫 Comando restrito ao dono (Isaac Quarenta).' }, { quoted: m });
          return true;
        }
        const gm = await sock.groupMetadata(m.key.remoteJid);
        const all = gm.participants.map(p=>p.id);
        const msg = args.length ? args.join(' ') : '📢 Atenção a todos!';
        await sock.sendMessage(m.key.remoteJid, { text: msg, contextInfo: { mentionedJid: all } }, { quoted: m });
      } catch (e) {
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao mencionar todos.' }, { quoted: m });
      }
      return true;

    case 'hidetag':
      try {
        if (!String(m.key.remoteJid).endsWith('@g.us')) {
          await sock.sendMessage(m.key.remoteJid, { text: '❌ Este comando só funciona em grupos.' }, { quoted: m });
          return true;
        }
        const senderNum = extrairNumeroReal(m);
        const senderName = m.pushName || 'Desconhecido';
        const ehDono = verificarPermissaoDono(senderNum, senderName);
        if (!ehDono) {
          await sock.sendMessage(m.key.remoteJid, { text: '🚫 Comando restrito ao dono (Isaac Quarenta).' }, { quoted: m });
          return true;
        }
        const gm = await sock.groupMetadata(m.key.remoteJid);
        const all = gm.participants.map(p=>p.id);
        const msg = args.length ? args.join(' ') : '📢';
        await sock.sendMessage(m.key.remoteJid, { text: msg, contextInfo: { mentionedJid: all } }, { quoted: m });
      } catch (e) {
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro no hidetag.' }, { quoted: m });
      }
      return true;

    // ═══════════════════════════════════════════════════════════════════════
    // NOVOS COMANDOS: SISTEMA DE AUTO-ADM NO MAX LEVEL (APENAS ISAAC)
    // ═══════════════════════════════════════════════════════════════════════
    case 'leveladm':
    case 'levelautoadm':
      try {
        if (!String(m.key.remoteJid).endsWith('@g.us')) {
          await sock.sendMessage(m.key.remoteJid, { text: '❌ Este comando só funciona em grupos.' }, { quoted: m });
          return true;
        }
        const senderNum = extrairNumeroReal(m);
        const senderName = m.pushName || 'Desconhecido';
        const ehDono = verificarPermissaoDono(senderNum, senderName);
        if (!ehDono) {
          await sock.sendMessage(m.key.remoteJid, { text: '🚫 Comando restrito ao dono (Isaac Quarenta).' }, { quoted: m });
          return true;
        }
        
        const gid = m.key.remoteJid;
        const action = args[0]?.toLowerCase();
        
        let response = '';
        switch (action) {
          case 'on':
          case 'ativar':
            response = toggleMaxLevelAutoADM(gid, true);
            break;
          case 'off':
          case 'desativar':
            response = toggleMaxLevelAutoADM(gid, false);
            break;
          case 'reset':
          case 'zerar':
            response = resetMaxLevelSystem(gid);
            break;
          case 'status':
          case 'info':
            const status = getMaxLevelStatus(gid);
            if (status.isActive) {
              response = `📊 *STATUS DO SISTEMA DE MAX LEVEL*\n\n`;
              response += `🎯 Auto-ADM: ${status.autoADMEnabled ? '✅ Ativado' : '❌ Desativado'}\n`;
              response += `⏰ ${status.status}\n`;
              response += `👥 Usuários no max level: ${status.maxLevelUsers.length > 0 ? status.maxLevelUsers.map((u, i) => `${i+1}. ${u.userName}`).join(', ') : 'Nenhum'}\n`;
              response += `⭐ Promovidos a ADM: ${status.promotedToADM.length}\n`;
            } else {
              response = '❌ Nenhuma janela de max level ativa neste grupo.';
            }
            break;
          default:
            response = `⚙️ *CONTROLE DO SISTEMA DE MAX LEVEL*\n\n`;
            response += `\`#leveladm on\` - Ativar auto-ADM\n`;
            response += `\`#leveladm off\` - Desativar auto-ADM\n`;
            response += `\`#leveladm status\` - Ver status\n`;
            response += `\`#leveladm reset\` - Resetar sistema\n\n`;
            response += `ℹ️ Top 3 usuários a atingir nível ${LEVEL_SYSTEM_CONFIG.maxLevel} em ${LEVEL_SYSTEM_CONFIG.windowDays} dias → ADM automático`;
        }
        
        await sock.sendMessage(gid, { text: response }, { quoted: m });
      } catch (e) {
        console.error('Erro no leveladm:', e);
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro no comando leveladm.' }, { quoted: m });
      }
      return true;

    // ... (mantenha todo o código anterior até a linha 3127)

    case 'help':
    case 'menu':
    case 'comandos':
    case 'ajuda':
      const helpText = `🤖 *MENU COMPLETO - AKIRA BOT V21* 🤖
*📱 PREFIXO:* \`${PREFIXO}\`

╔════════════════════════════════════════════════════╗
║  🎨 MÍDIA & CRIATIVIDADE (Todos)  ║
╚════════════════════════════════════════════════════╝
\`#sticker\` - Criar sticker de imagem
\`#gif\` - Criar sticker ANIMADO (até 30s)
\`#toimg\` - Converter sticker para imagem
\`#tts <idioma> <texto>\` - Texto para voz (2000 caracteres)
\`#play <nome/link>\` - Baixar música do YouTube
\`#info\` - Info do bot
\`#ping\` - Testar latência

╔════════════════════════════════════════════════════╗
║  🎤 ÁUDIO INTELIGENTE (Novo)      ║
╚════════════════════════════════════════════════════╝
Respondo áudio automaticamente:
• *Grupos:* Mencione "Akira" ou responda ao áudio
• *PV:* Envie qualquer áudio
• Transcrição interna (NUNCA mostra no chat)
• Respondo em áudio automático

╔════════════════════════════════════════════════════╗
║  👑 MODERAÇÃO (Apenas Isaac)      ║
╚════════════════════════════════════════════════════╝
\`#add <número>\` - Adicionar membro
\`#remove @membro\` - Remover (ou reply)
\`#ban @membro\` - Banir (ou reply)
\`#promote @membro\` - Admin (ou reply)
\`#demote @membro\` - Desadmin (ou reply)
\`#mute @usuário\` - Mutar 5min (ou reply)
\`#desmute @usuário\` - Desmutar (ou reply)
\`#antilink on\` - Ativar anti-link
\`#antilink off\` - Desativar anti-link
\`#antilink status\` - Ver status
\`#apagar\` - Apagar msg (responda)
\`#tagall <msg>\` - Marcar todos os membros
\`#hidetag <msg>\` - Mensagem com menção oculta
\`#broadcast\` - Mensagem global
\`#setnamegp <nome>\` - Renomear grupo
\`#setdesc <descrição>\` - Mudar descrição

╔════════════════════════════════════════════════════╗
║  🏆️ SISTEMA DE NÍVEIS (Novo)     ║
╚════════════════════════════════════════════════════╝
\`#level\` - Ver seu nível e XP
\`#level on\` - Ativar sistema (Isaac)
\`#level off\` - Desativar (Isaac)
\`#leveladm on\` - Ativar auto-ADM max level
\`#leveladm off\` - Desativar auto-ADM
\`#leveladm status\` - Ver status ADM
\`#leveladm reset\` - Resetar sistema



╔════════════════════════════════════════════════════╗
║  💬 CONVERSA NORMAL                ║
╚════════════════════════════════════════════════════╝
Mencione "Akira" OU responda minhas mensagens

══════════════════════════════════════════════════════
*⚠️ Comandos de grupo requerem admin ou Isaac Quarenta ( não se borra)*
══════════════════════════════════════════════════════`;
      
      await sock.sendMessage(m.key.remoteJid, { text: helpText }, { quoted: m });
      return true;

    // === DONATE / APOIO ===
    case 'donate':
    case 'doar':
    case 'apoia':
    case 'doacao':
      try {
        const donateText = 
`╔════════════════════════════════════════════════════╗
 ║  ❤️ APOIE O PROJETO AKIRA BOT ❤️    ║
 ╚════════════════════════════════════════════════════╝

🙏 *Você gosta do Akira?*

Seu apoio nos ajuda a manter o bot:
✅ Online 24/7
✅ Com novas features
✅ Sem publicidades
✅ Gratuito para todos

╔════════════════════════════════════════════════════╗
║  💰 FORMAS DE APOIAR                  ║
╚════════════════════════════════════════════════════╝

🔑 *PIX (IMEDIATO):*
\`akira.bot.dev@gmail.com\`

☕ *COMPRE UM CAFÉ:*
https://ko-fi.com/isaacquarenta

💳 *PAYPAL:*
https://paypal.me/isaacquarenta

🎁 *QUALQUER VALOR AJUDA!*
Desde $ 5 ou 500kz até quanto você quiser contribuir

╔════════════════════════════════════════════════════╗
║  🙏 AGRADECIMENTOS ESPECIAIS          ║
╚════════════════════════════════════════════════════╝

Todos que contribuem receberão:
✨ Meu sincero agradecimento
✨ Suporte prioritário
✨ Novas features primeiro
✨ Reconhecimento especial
✨ usuario VIP no bot

═══════════════════════════════════════════════════════

*Desenvolvido com ❤️ por Isaac Quarenta*

_Obrigado por apoiar um projeto feito com paixão!_ 🚀`;
        await sock.sendMessage(m.key.remoteJid, { text: donateText }, { quoted: m });
      } catch (e) {
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao exibir opções de doação.' }, { quoted: m });
      }
      return true;

    // === COMANDOS DE GRUPO (APENAS ISAAC QUARENTA) ===
    case 'add':
      if (!ehGrupo) {
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Este comando só funciona em grupos.' }, { quoted: m });
        return true;
      }
      
      try {
        const numeroUsuario = m.key.participant ? m.key.participant.split('@')[0] : extrairNumeroReal(m);
        const nomeUsuario = m.pushName || 'Desconhecido';
        const ehDono = verificarPermissaoDono(numeroUsuario, nomeUsuario);
        
        if (!ehDono) {
          console.log('❌ [BLOQUEADO] Comando #add usado por não-dono:', numeroUsuario, nomeUsuario);
          
          const payload = { 
            usuario: nomeUsuario, 
            numero: numeroUsuario, 
            mensagem: '/reset',
            tentativa_comando: '#add'
          };
          
          try {
            await axios.post(API_URL, payload, { timeout: 120000 });
          } catch (e) {}
          
          await sock.sendMessage(m.key.remoteJid, { 
            text: '🚫 *COMANDO RESTRITO!* Apenas Isaac Quarenta pode usar comandos de grupo.' 
          }, { quoted: m });
          return true;
        }
        
        const numeroAdicionar = args[0];
        if (!numeroAdicionar) {
          await sock.sendMessage(m.key.remoteJid, { text: '❌ Uso: `#add 244123456789`' }, { quoted: m });
          return true;
        }
        
        const jidAdicionar = `${numeroAdicionar.replace(/\D/g, '')}@s.whatsapp.net`;
        await sock.groupParticipantsUpdate(m.key.remoteJid, [jidAdicionar], 'add');
        await sock.sendMessage(m.key.remoteJid, { text: `✅ ${numeroAdicionar} adicionado ao grupo.` }, { quoted: m });
      } catch (e) {
        console.error('Erro ao adicionar membro:', e);
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao adicionar membro. Verifique se sou admin.' }, { quoted: m });
      }
      return true;
      
    case 'remove':
    case 'kick':
    case 'ban':
      if (!ehGrupo) {
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Este comando só funciona em grupos.' }, { quoted: m });
        return true;
      }
      
      try {
        const numeroUsuario = m.key.participant ? m.key.participant.split('@')[0] : extrairNumeroReal(m);
        const nomeUsuario = m.pushName || 'Desconhecido';
        const ehDono = verificarPermissaoDono(numeroUsuario, nomeUsuario);
        
        if (!ehDono) {
          console.log('❌ [BLOQUEADO] Comando #remove/#ban usado por não-dono:', numeroUsuario, nomeUsuario);
          
          const payload = { 
            usuario: nomeUsuario, 
            numero: numeroUsuario, 
            mensagem: '/reset',
            tentativa_comando: '#remove/#ban'
          };
          
          try {
            await axios.post(API_URL, payload, { timeout: 120000 });
          } catch (e) {}
          
          await sock.sendMessage(m.key.remoteJid, { 
            text: '🚫 *COMANDO RESTRITO!* Apenas Isaac Quarenta pode usar comandos de grupo.' 
          }, { quoted: m });
          return true;
        }
        
        let targetUserIds = [];
        const mencionados = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const replyInfo = extrairReplyInfo(m);
        
        if (mencionados.length > 0) {
          targetUserIds = mencionados;
        } else if (replyInfo && replyInfo.quemEscreveuCitacaoJid) {
          targetUserIds = [replyInfo.quemEscreveuCitacaoJid];
        } else {
          await sock.sendMessage(m.key.remoteJid, { 
            text: '❌ Marque o membro com @ OU responda a mensagem dele com `#remove` ou `#ban`' 
          }, { quoted: m });
          return true;
        }
        
        await sock.groupParticipantsUpdate(m.key.remoteJid, targetUserIds, 'remove');
        await sock.sendMessage(m.key.remoteJid, { text: '✅ Membro(s) removido(s) do grupo.' }, { quoted: m });
      } catch (e) {
        console.error('Erro ao remover membro:', e);
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao remover membro. Verifique permissões.' }, { quoted: m });
      }
      return true;
      
    case 'promote':
      if (!ehGrupo) {
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Este comando só funciona em grupos.' }, { quoted: m });
        return true;
      }
      
      try {
        const numeroUsuario = m.key.participant ? m.key.participant.split('@')[0] : extrairNumeroReal(m);
        const nomeUsuario = m.pushName || 'Desconhecido';
        const ehDono = verificarPermissaoDono(numeroUsuario, nomeUsuario);
        
        if (!ehDono) {
          console.log('❌ [BLOQUEADO] Comando #promote usado por não-dono:', numeroUsuario, nomeUsuario);
          
          const payload = { 
            usuario: nomeUsuario, 
            numero: numeroUsuario, 
            mensagem: '/reset',
            tentativa_comando: '#promote'
          };
          
          try {
            await axios.post(API_URL, payload, { timeout: 120000 });
          } catch (e) {}
          
          await sock.sendMessage(m.key.remoteJid, { 
            text: '🚫 *COMANDO RESTRITO!* Apenas Isaac Quarenta pode usar comandos de grupo.' 
          }, { quoted: m });
          return true;
        }
        
        let targetUserIds = [];
        const mencionados = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const replyInfo = extrairReplyInfo(m);
        
        if (mencionados.length > 0) {
          targetUserIds = mencionados;
        } else if (replyInfo && replyInfo.quemEscreveuCitacaoJid) {
          targetUserIds = [replyInfo.quemEscreveuCitacaoJid];
        } else {
          await sock.sendMessage(m.key.remoteJid, { 
            text: '❌ Marque o membro com @ OU responda a mensagem dele com `#promote`' 
          }, { quoted: m });
          return true;
        }
        
        await sock.groupParticipantsUpdate(m.key.remoteJid, targetUserIds, 'promote');
        await sock.sendMessage(m.key.remoteJid, { text: '✅ Membro(s) promovido(s) a admin.' }, { quoted: m });
      } catch (e) {
        console.error('Erro ao promover:', e);
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao promover. Verifique permissões.' }, { quoted: m });
      }
      return true;
      
    case 'demote':
      if (!ehGrupo) {
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Este comando só funciona em grupos.' }, { quoted: m });
        return true;
      }
      
      try {
        const numeroUsuario = m.key.participant ? m.key.participant.split('@')[0] : extrairNumeroReal(m);
        const nomeUsuario = m.pushName || 'Desconhecido';
        const ehDono = verificarPermissaoDono(numeroUsuario, nomeUsuario);
        
        if (!ehDono) {
          console.log('❌ [BLOQUEADO] Comando #demote usado por não-dono:', numeroUsuario, nomeUsuario);
          
          const payload = { 
            usuario: nomeUsuario, 
            numero: numeroUsuario, 
            mensagem: '/reset',
            tentativa_comando: '#demote'
          };
          
          try {
            await axios.post(API_URL, payload, { timeout: 120000 });
          } catch (e) {}
          
          await sock.sendMessage(m.key.remoteJid, { 
            text: '🚫 *COMANDO RESTRITO!* Apenas Isaac Quarenta pode usar comandos de grupo.' 
          }, { quoted: m });
          return true;
        }
        
        let targetUserIds = [];
        const mencionados = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const replyInfo = extrairReplyInfo(m);
        
        if (mencionados.length > 0) {
          targetUserIds = mencionados;
        } else if (replyInfo && replyInfo.quemEscreveuCitacaoJid) {
          targetUserIds = [replyInfo.quemEscreveuCitacaoJid];
        } else {
          await sock.sendMessage(m.key.remoteJid, { 
            text: '❌ Marque o admin com @ OU responda a mensagem dele com `#demote`' 
          }, { quoted: m });
          return true;
        }
        
        await sock.groupParticipantsUpdate(m.key.remoteJid, targetUserIds, 'demote');
        await sock.sendMessage(m.key.remoteJid, { text: '✅ Admin(s) rebaixado(s).' }, { quoted: m });
      } catch (e) {
        console.error('Erro ao rebaixar admin:', e);
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao rebaixar admin. Verifique permissões.' }, { quoted: m });
      }
      return true;
      
    case 'mute':
      if (!ehGrupo) {
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Este comando só funciona em grupos.' }, { quoted: m });
        return true;
      }
      
      try {
        const numeroUsuario = m.key.participant ? m.key.participant.split('@')[0] : extrairNumeroReal(m);
        const nomeUsuario = m.pushName || 'Desconhecido';
        const ehDono = verificarPermissaoDono(numeroUsuario, nomeUsuario);
        
        if (!ehDono) {
          console.log('❌ [BLOQUEADO] Comando #mute usado por não-dono:', numeroUsuario, nomeUsuario);
          
          const payload = { 
            usuario: nomeUsuario, 
            numero: numeroUsuario, 
            mensagem: '/reset',
            tentativa_comando: '#mute'
          };
          
          try {
            await axios.post(API_URL, payload, { timeout: 120000 });
          } catch (e) {}
          
          await sock.sendMessage(m.key.remoteJid, { 
            text: '🚫 *COMANDO RESTRITO!* Apenas Isaac Quarenta pode usar comandos de grupo.' 
          }, { quoted: m });
          return true;
        }
        
        let targetUserId = null;
        const mencionados = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const replyInfo = extrairReplyInfo(m);
        
        if (mencionados.length > 0) {
          targetUserId = mencionados[0];
        } else if (replyInfo && replyInfo.quemEscreveuCitacaoJid) {
          targetUserId = replyInfo.quemEscreveuCitacaoJid;
        } else {
          await sock.sendMessage(m.key.remoteJid, { 
            text: '❌ Marque o usuário com @ OU responda a mensagem dele com `#mute`' 
          }, { quoted: m });
          return true;
        }
        
        const groupId = m.key.remoteJid;
        const userId = targetUserId;
        
        const muteResult = muteUser(groupId, userId, 5);
        
        const expiryTime = new Date(muteResult.expires).toLocaleTimeString('pt-BR', { 
          hour: '2-digit', 
          minute: '2-digit',
          second: '2-digit'
        });
        
        let mensagemExtra = '';
        if (muteResult.muteCount > 1) {
          mensagemExtra = `\n⚠️ *ATENÇÃO:* Este usuário já foi mutado ${muteResult.muteCount} vezes hoje! Tempo multiplicado para ${muteResult.muteMinutes} minutos.`;
        }
        
        await sock.sendMessage(m.key.remoteJid, { 
          text: `🔇 Usuário mutado por ${muteResult.muteMinutes} minutos.\n⏰ Expira às: ${expiryTime}${mensagemExtra}\n\n⚠️ Se enviar mensagem durante o mute, será automaticamente removido e a mensagem apagada!` 
        }, { quoted: m });
        
      } catch (e) {
        console.error('Erro no comando mute:', e);
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao mutar usuário.' }, { quoted: m });
      }
      return true;
      
    case 'desmute':
      if (!ehGrupo) {
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Este comando só funciona em grupos.' }, { quoted: m });
        return true;
      }
      
      try {
        const numeroUsuario = m.key.participant ? m.key.participant.split('@')[0] : extrairNumeroReal(m);
        const nomeUsuario = m.pushName || 'Desconhecido';
        const ehDono = verificarPermissaoDono(numeroUsuario, nomeUsuario);
        
        if (!ehDono) {
          console.log('❌ [BLOQUEADO] Comando #desmute usado por não-dono:', numeroUsuario, nomeUsuario);
          
          const payload = { 
            usuario: nomeUsuario, 
            numero: numeroUsuario, 
            mensagem: '/reset',
            tentativa_comando: '#desmute'
          };
          
          try {
            await axios.post(API_URL, payload, { timeout: 120000 });
          } catch (e) {}
          
          await sock.sendMessage(m.key.remoteJid, { 
            text: '🚫 *COMANDO RESTRITO!* Apenas Isaac Quarenta pode usar comandos de grupo.' 
          }, { quoted: m });
          return true;
        }
        
        let targetUserId = null;
        const mencionados = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const replyInfo = extrairReplyInfo(m);
        
        if (mencionados.length > 0) {
          targetUserId = mencionados[0];
        } else if (replyInfo && replyInfo.quemEscreveuCitacaoJid) {
          targetUserId = replyInfo.quemEscreveuCitacaoJid;
        } else {
          await sock.sendMessage(m.key.remoteJid, { 
            text: '❌ Marque o usuário com @ OU responda a mensagem dele com `#desmute`' 
          }, { quoted: m });
          return true;
        }
        
        const groupId = m.key.remoteJid;
        const userId = targetUserId;
        
        if (unmuteUser(groupId, userId)) {
          await sock.sendMessage(m.key.remoteJid, { 
            text: '🔊 Usuário desmutado com sucesso!' 
          }, { quoted: m });
        } else {
          await sock.sendMessage(m.key.remoteJid, { 
            text: 'ℹ️ Este usuário não estava mutado.' 
          }, { quoted: m });
        }
        
      } catch (e) {
        console.error('Erro no comando desmute:', e);
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao desmutar usuário.' }, { quoted: m });
      }
      return true;
      
    case 'antilink':
      if (!ehGrupo) {
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Este comando só funciona em grupos.' }, { quoted: m });
        return true;
      }
      
      try {
        const numeroUsuario = m.key.participant ? m.key.participant.split('@')[0] : extrairNumeroReal(m);
        const nomeUsuario = m.pushName || 'Desconhecido';
        const ehDono = verificarPermissaoDono(numeroUsuario, nomeUsuario);
        
        if (!ehDono) {
          console.log('❌ [BLOQUEADO] Comando #antilink usado por não-dono:', numeroUsuario, nomeUsuario);
          
          const payload = { 
            usuario: nomeUsuario, 
            numero: numeroUsuario, 
            mensagem: '/reset',
            tentativa_comando: '#antilink'
          };
          
          try {
            await axios.post(API_URL, payload, { timeout: 120000 });
          } catch (e) {}
          
          await sock.sendMessage(m.key.remoteJid, { 
            text: '🚫 *COMANDO RESTRITO!* Apenas Isaac Quarenta pode usar comandos de grupo.' 
          }, { quoted: m });
          return true;
        }
        
        const subcomando = args[0]?.toLowerCase();
        const groupId = m.key.remoteJid;
        
        if (subcomando === 'on') {
          toggleAntiLink(groupId, true);
          await sock.sendMessage(m.key.remoteJid, { 
            text: '🔒 *ANTI-LINK ATIVADO!*\n\n⚠️ Qualquer usuário que enviar links será automaticamente removido e a mensagem apagada!' 
          }, { quoted: m });
          
        } else if (subcomando === 'off') {
          toggleAntiLink(groupId, false);
          await sock.sendMessage(m.key.remoteJid, { 
            text: '🔓 *ANTI-LINK DESATIVADO!*\n\n✅ Usuários podem enviar links normalmente.' 
          }, { quoted: m });
          
        } else if (subcomando === 'status') {
          const status = isAntiLinkActive(groupId) ? '🟢 ATIVADO' : '🔴 DESATIVADO';
          await sock.sendMessage(m.key.remoteJid, { 
            text: `📊 *STATUS ANTI-LINK:* ${status}` 
          }, { quoted: m });
          
        } else {
          await sock.sendMessage(m.key.remoteJid, { 
            text: '🔗 *Como usar:*\n`#antilink on` - Ativa anti-link\n`#antilink off` - Desativa anti-link\n`#antilink status` - Ver status\n\n⚠️ Quando ativado, qualquer link enviado resulta em banimento automático e apagamento da mensagem!' 
          }, { quoted: m });
        }
        
      } catch (e) {
        console.error('Erro no comando antilink:', e);
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao configurar anti-link.' }, { quoted: m });
      }
      return true;
      
    case 'apagar':
    case 'delete':
    case 'del':
      try {
        const numeroUsuario = m.key.participant ? m.key.participant.split('@')[0] : extrairNumeroReal(m);
        const nomeUsuario = m.pushName || 'Desconhecido';
        const ehGrupoAtual = String(m.key.remoteJid || '').endsWith('@g.us');
        
        if (ehGrupoAtual) {
          const ehDono = verificarPermissaoDono(numeroUsuario, nomeUsuario);
          if (!ehDono) {
            console.log('❌ [BLOQUEADO] Comando #apagar usado por não-dono:', numeroUsuario, nomeUsuario);
            await sock.sendMessage(m.key.remoteJid, { 
              text: '🚫 *COMANDO RESTRITO!* Apenas Isaac Quarenta pode apagar mensagens em grupos.' 
            }, { quoted: m });
            return true;
          }
        }
        
        const context = m.message?.extendedTextMessage?.contextInfo;
        const quotedMsgId = context?.stanzaId;
        const quotedParticipant = context?.participant;
        
        if (quotedMsgId && m.key.remoteJid) {
          try {
            await sock.sendMessage(m.key.remoteJid, {
              delete: {
                id: quotedMsgId,
                remoteJid: m.key.remoteJid,
                fromMe: false,
                participant: quotedParticipant
              }
            });
            
            await sock.sendMessage(m.key.remoteJid, { 
              text: '✅ Mensagem apagada com sucesso!' 
            }, { quoted: m });
            
          } catch (deleteError) {
            console.error('Erro ao apagar mensagem:', deleteError);
            
            if (context && quotedParticipant && ehOBot(quotedParticipant)) {
              try {
                await sock.sendMessage(m.key.remoteJid, {
                  delete: {
                    id: quotedMsgId,
                    remoteJid: m.key.remoteJid,
                    fromMe: true
                  }
                });
                
                await sock.sendMessage(m.key.remoteJid, { 
                  text: '✅ Minha mensagem foi apagada!' 
                });
                
              } catch (e) {
                await sock.sendMessage(m.key.remoteJid, { 
                  text: '❌ Não tenho permissão para apagar esta mensagem.' 
                }, { quoted: m });
              }
            } else {
              await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Não tenho permissão para apagar esta mensagem.' 
              }, { quoted: m });
            }
          }
          
        } else {
          await sock.sendMessage(m.key.remoteJid, { 
            text: '🗑️ *Como apagar mensagens:*\n\n1. *Para apagar mensagem de membro:*\n   Responda a mensagem com `#apagar`\n   (Apenas Isaac Quarenta em grupos)\n\n2. *Para apagar minha mensagem:*\n   Responda minha mensagem com `#apagar`\n   (Funciona em PV e grupos)\n\n⚠️ *Nota:* Em grupos, apenas Isaac Quarenta pode apagar mensagens de outros membros.' 
          }, { quoted: m });
        }
        
      } catch (e) {
        console.error('Erro no comando apagar:', e);
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao apagar mensagem.' }, { quoted: m });
      }
      return true;

    default:
      return false;
  }

  return false;

} catch (e) {
  console.error('Erro no handler de comandos:', e);
  return false;
}
}
// ═══════════════════════════════════════════════════════════════════════
// SISTEMA DE XP AUTOMÁTICO (ADAPTADO DO PROJETO REFERÊNCIA)
// ═══════════════════════════════════════════════════════════════════════
async function handleAutoXP(sock, m, ehGrupo, sender) {
  try {
    if (m.key.fromMe) return;
    if (!ehGrupo) return;
    if (cekBannedUser(sender)) return;
    const gid = m.key.remoteJid;
    const toggles = loadJSON(JSON_PATHS.leveling) || {};
    if (!toggles[gid]) return; // desativado por padrão
    const rec = getGroupLevelRecord(gid, sender, true);
    const amountXp = Math.floor(Math.random() * (25 - 15 + 1)) + 15;
    rec.xp += amountXp;
    saveGroupLevelRecord(rec);
    const requiredXp = getRequiredGroupXp(rec.level);
    if (rec.xp >= requiredXp) {
      rec.level += 1; rec.xp = 0; saveGroupLevelRecord(rec);
      const patente = getPatente(rec.level);
      const levelUpText = `🎉 *LEVEL UP!* 🎉
👤 @${sender.split('@')[0]}
📈 você foi elevado ao nível ${rec.level}!
🏅 Nova patente: ${patente}
✨ Parabéns! Continue interagindo para subir mais!`;
      await sock.sendMessage(m.key.remoteJid, { text: levelUpText, contextInfo: { mentionedJid: [sender] } }, { quoted: m });
      
      // ═══════════════════════════════════════════════════════════════════════
      // NOVO: Verifica se atingiu max level e tenta promover a ADM
      // ═══════════════════════════════════════════════════════════════════════
      if (rec.level >= LEVEL_SYSTEM_CONFIG.maxLevel) {
        const senderName = m.pushName || 'Usuário';
        const maxLevelResult = await registerMaxLevelUser(gid, sender, senderName, sock);
        
        let maxLevelMessage = `✨ *MAX LEVEL ATINGIDO!* ✨\n`;
        maxLevelMessage += `👤 @${sender.split('@')[0]}\n`;
        maxLevelMessage += `🎖️ Nível ${LEVEL_SYSTEM_CONFIG.maxLevel} desbloqueado!\n`;
        
        if (maxLevelResult.success) {
          if (maxLevelResult.promoted) {
            maxLevelMessage += `\n🎊 ${maxLevelResult.message}`;
          } else {
            maxLevelMessage += `\n${maxLevelResult.message}`;
          }
        }
        
        await sock.sendMessage(gid, { text: maxLevelMessage, contextInfo: { mentionedJid: [sender] } });
      }
    }
  } catch (e) { console.error('Erro no sistema de XP:', e); }
}
// ═══════════════════════════════════════════════════════════════════════
// SISTEMA DE ECONOMIA (ADAPTADO)
// ═══════════════════════════════════════════════════════════════════════
async function handleEconomy(sock, m, texto, sender) {
  try {
    if (!texto.startsWith(PREFIXO)) return;

    if (cekBannedUser(sender)) return;

    addATM(sender);

    const amountMoney = Math.floor(Math.random() * (100 - 90 + 1)) + 90;
    addKoinUser(sender, amountMoney);

  } catch (e) {
    console.error('Erro no sistema de economia:', e);
  }
}
// ═══════════════════════════════════════════════════════════════════════
// CONEXÃO PRINCIPAL (ATUALIZADA)
// ═══════════════════════════════════════════════════════════════════════
async function conectar() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();

    if (sock && sock.ws) {
      try {
        console.log('🔄 Fechando socket anterior...');
        await sock.logout();
      } catch (e) {}
      sock = null;
    }

    sock = makeWASocket({
      version,
      auth: state,
      logger,
      browser: Browsers.macOS('AkiraBot'),
      markOnlineOnConnect: true,
      syncFullHistory: false,
      printQRInTerminal: false,
      connectTimeoutMs: 60000,
      getMessage: async (key) => {
        if (!key) return undefined;
        try {
          const msg = await store.loadMessage(key.remoteJid, key.id);
          return msg?.message;
        } catch (e) {
          return undefined;
        }
      }
    });

    try {
      if (store && typeof store.bind === 'function') {
        store.bind(sock.ev);
      }
    } catch (e) {}

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        currentQR = qr;
        try {
          qrcodeTerminal.generate(qr, { small: true });
        } catch (e) {}
        console.log('\n📱 ESCANEIE O QR PARA CONECTAR\n');
      }

      if (connection === 'open') {
        BOT_JID = sock.user?.id || null;
        lastProcessedTime = Date.now();

        const userJid = sock.user?.id || '';
        if (userJid.includes('@')) {
          BOT_JID_ALTERNATIVO = userJid;
        }

        console.log('\n' + '═'.repeat(70));
        console.log('✅ AKIRA BOT V21 ONLINE! (COM TODAS FUNCIONALIDADES)');
        console.log('═'.repeat(70));
        console.log('🤖 Bot JID:', BOT_JID);
        console.log('📱 Número:', BOT_NUMERO_REAL);
        console.log('🔗 API:', API_URL);
        console.log('⚙️ Prefixo comandos:', PREFIXO);
        console.log('🔐 Comandos restritos: Apenas Isaac Quarenta');
        console.log('✅ Digitação realista: Ativa');
        console.log('✅ IA conversacional: Ativa');
        console.log('✅ Figurinhas personalizadas: Com metadados');
        console.log('✅ Stickers animados até 30s: Suportado');
        console.log('✅ Sticker de sticker: Suportado');
        console.log('✅ Download de áudio do YouTube: Sistema corrigido');
        console.log('✅ Texto para voz (TTS): Funcional');
        console.log('✅ Resposta a mensagens de voz (STT + TTS): Ativada');
        console.log('✅ Sistema de moderação aprimorado: Ativo');
        console.log('✅ NUNCA mostra transcrições de áudio no chat: Confirmado');
        console.log('✅ Contexto de reply otimizado: SEM REPETIÇÕES mas COM CONTEÚDO');
        console.log('🎤 STT: Deepgram API (200h/mês GRATUITO)');
        console.log('🎤 TTS: Google TTS (funcional)');
        console.log('🛡️ Sistema de moderação: Ativo');
        console.log('═'.repeat(70) + '\n');

        currentQR = null;
      }

      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        console.log(`\n⚠️ Conexão perdida (${code}). Reconectando em 5s...\n`);
        setTimeout(() => conectar().catch(console.error), 5000);
      }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
      try {
        const m = messages[0];
        if (!m || !m.message || m.key.fromMe) return;
        // Unwrap view-once containers to access real media/text
        try {
          if (m.message?.viewOnceMessageV2?.message) {
            m.message = m.message.viewOnceMessageV2.message;
          } else if (m.message?.viewOnceMessageV2Extension?.message) {
            m.message = m.message.viewOnceMessageV2Extension.message;
          } else if (m.message?.viewOnceMessage?.message) {
            m.message = m.message.viewOnceMessage.message;
          }
        } catch (_) {}

        if (processadas.has(m.key.id)) return;
        processadas.add(m.key.id);
        setTimeout(() => processadas.delete(m.key.id), 30000);

        if (m.messageTimestamp && m.messageTimestamp * 1000 < lastProcessedTime - 10000) {
          return;
        }

        const ehGrupo = String(m.key.remoteJid || '').endsWith('@g.us');
        const sender = m.key.participant || m.key.remoteJid;
        // Anti-flood/blacklist
        if (isBlacklisted(sender)) {
          return;
        }
        const lim = checkAndUpdateHourlyLimit(sender);
        if (!lim.allowed) {
          if (lim.sendWarning) {
            try { await sock.sendMessage(m.key.remoteJid, { text: '⛔ Você atingiu o limite de 300 mensagens/h. Aguarde 1h.' }, { quoted: m }); } catch (_) {}
          }
          return;
        }
        const numeroReal = extrairNumeroReal(m);
        const nome = m.pushName || numeroReal;
        const texto = extrairTexto(m).trim();
        const replyInfo = extrairReplyInfo(m);

        // === VERIFICAÇÕES DE MODERAÇÃO ===
        if (ehGrupo && m.key.participant) {
          const groupId = m.key.remoteJid;
          const userId = m.key.participant;

          // 1. VERIFICA SE USUÁRIO ESTÁ MUTADO
          if (isUserMuted(groupId, userId)) {
            console.log(`🔇 [MUTE] Usuário ${nome} tentou falar durante mute. Apagando mensagem.`);

            try {
              // Apenas apaga a mensagem do usuário mutado
              await sock.sendMessage(groupId, { delete: m.key });
            } catch (e) {
              console.error('Erro ao apagar mensagem de usuário mutado:', e);
            }

            return; // Impede o processamento adicional da mensagem
          }

          // 2. VERIFICA ANTI-LINK
          if (isAntiLinkActive(groupId) && texto && containsLink(texto)) {
            console.log(`🔗 [ANTI-LINK] Usuário ${nome} enviou link. Banindo...`);

            try {
              await sock.groupParticipantsUpdate(groupId, [userId], 'remove');
              await sock.sendMessage(groupId, {
                text: `🚫 *${nome} foi removido por enviar link!*\n🔒 Anti-link está ativado neste grupo.`
              });

            } catch (e) {
              console.error('Erro ao banir usuário por link:', e);
            }

            return;
          }
        }

        // === SISTEMA DE XP AUTOMÁTICO ===
        await handleAutoXP(sock, m, ehGrupo, sender);

        // === SISTEMA DE ECONOMIA ===
        if (texto.startsWith(PREFIXO)) {
          await handleEconomy(sock, m, texto, sender);
        }

        // === PRIMEIRO: VERIFICA SE É COMANDO EXTRA ===
        if (texto) {
          const isComandoExtra = await handleComandosExtras(sock, m, texto, ehGrupo);

          if (isComandoExtra) {
            return;
          }
        }

        // === VERIFICA SE É MENSAGEM DE ÁUDIO ===
        const tipo = getContentType(m.message);
        const temAudio = tipo === 'audioMessage';
        let textoAudio = '';
        let processarComoAudio = false;

        // EM GRUPOS, SÓ TRANSCREVE ÁUDIO SE FOR UM REPLY (PARA ECONOMIZAR TOKENS)
        if (temAudio && (!ehGrupo || replyInfo)) {
          console.log(`🎤 [ÁUDIO RECEBIDO] de ${nome}. Verificando se deve transcrever...`);

          // A checagem final se é um reply *para o bot* será feita depois pela função deveResponder
          
          const audioBuffer = await downloadMediaMessage({ audioMessage: m.message.audioMessage });

          if (!audioBuffer) {
            console.error('❌ Erro ao baixar áudio');
            return;
          }

          const transcricao = await transcreverAudioParaTexto(audioBuffer);

          if (transcricao.sucesso) {
            textoAudio = transcricao.texto;
            console.log(`📝 [TRANSCRIÇÃO INTERNA] ${nome}: ${textoAudio.substring(0, 100)}...`);
            processarComoAudio = true;
          } else {
            textoAudio = transcricao.texto || "[Não foi possível transcrever]";
            // Em PV, mesmo com erro, envia uma resposta
            if (!ehGrupo) {
              processarComoAudio = true;
              textoAudio = "Olá! Recebi seu áudio mas houve um erro na transcrição.";
            }
          }
        }

        // === VERIFICA SE DEVE RESPONDER ===
        let ativar = false;
        let textoParaAPI = texto;

        if (temAudio && processarComoAudio) {
          ativar = await deveResponder(m, ehGrupo, textoAudio, replyInfo, true);
          textoParaAPI = textoAudio;
        } else if (!temAudio && texto) {
          ativar = await deveResponder(m, ehGrupo, texto, replyInfo, false);
        }

        if (!ativar) return;

        // Log
        if (temAudio) {
          console.log(`\n🎤 [PROCESSANDO ÁUDIO] ${nome}: ${textoAudio.substring(0, 60)}...`);
        } else {
          console.log(`\n🔥 [PROCESSANDO TEXTO] ${nome}: ${texto.substring(0, 60)}...`);
        }

        // ═══════════════════════════════════════════════════════════════
        // PAYLOAD PARA API COM CONTEXTO SUPER CLARO
        // ═══════════════════════════════════════════════════════════════
        const payloadBase = {
          usuario: nome,
          numero: numeroReal,
          mensagem: textoParaAPI,
          tipo_conversa: ehGrupo ? 'grupo' : 'pv',
          tipo_mensagem: temAudio ? 'audio' : 'texto'
        };
        
        // === ADICIONA CONTEXTO DE REPLY SUPER CLARO ===
        if (replyInfo) {
          // ADICIONA A MENSAGEM CITADA COMPLETA NO PAYLOAD
          payloadBase.mensagem_citada = replyInfo.textoMensagemCitada;
          
          // Informações METADATA sobre o reply
          payloadBase.reply_metadata = {
            // Informa SE É REPLY
            is_reply: true,
            
            // Indica se é reply AO BOT (flag simples)
            reply_to_bot: replyInfo.ehRespostaAoBot,
            
            // Informação sobre quem escreveu a mensagem citada
            quoted_author_name: replyInfo.quemEscreveuCitacaoNome,
            
            // TIPO de mídia citada
            quoted_type: replyInfo.tipoMidiaCitada,
            
            // Contexto breve
            context_hint: replyInfo.contextoParaAPI
          };
        } else {
          payloadBase.mensagem_citada = '';
          payloadBase.reply_metadata = {
            is_reply: false,
            reply_to_bot: false
          };
        }
        
        // Adiciona info de grupo
        if (ehGrupo) {
          try {
            const grupoInfo = await obterInfoGrupo(sock, m.key.remoteJid);
            payloadBase.grupo_id = m.key.remoteJid;
            payloadBase.grupo_nome = grupoInfo.subject;
          } catch (e) {
            payloadBase.grupo_id = m.key.remoteJid;
            payloadBase.grupo_nome = 'Grupo';
          }
        }

        console.log('📤 Enviando para API Akira V21...');

        let resposta = '...';
        try {
          const res = await axios.post(API_URL, payloadBase, {
            timeout: 120000,
            headers: { 'Content-Type': 'application/json' }
          });
          resposta = res.data?.resposta || '...';
        } catch (err) {
          console.error('⚠️ Erro na API:', err.message);
          resposta = 'Desculpe, houve um erro ao processar sua mensagem.';
        }

        console.log(`📥 [RESPOSTA AKIRA] ${resposta.substring(0, 100)}...`);

        // === DECIDE COMO RESPONDER ===
        let opcoes = {};

        if (ehGrupo) {
          opcoes = { quoted: m };
          console.log('📎 Reply em grupo (regra fixa)');
        } else {
          if (replyInfo && replyInfo.ehRespostaAoBot) {
            opcoes = { quoted: m };
            console.log('📎 Reply em PV (usuário respondeu ao bot)');
          }
        }

        // === LÓGICA DE RESPOSTA EM ÁUDIO ===
        // Grupos: só responde em áudio se for reply direto ao áudio de Akira
        // PV: sempre responde em áudio quando há áudio de entrada
        let deveResponderEmAudio = false;
        
        if (temAudio) {
          if (ehGrupo) {
            // Grupo: só responde em áudio se a mensagem é reply direto ao áudio de Akira
            if (replyInfo && replyInfo.ehRespostaAoBot && replyInfo.tipoMidiaCitada === 'áudio') {
              deveResponderEmAudio = true;
              console.log('🎤 [GRUPO] Reply direto ao áudio de Akira - respondendo em áudio');
            } else {
              deveResponderEmAudio = false;
              console.log('📝 [GRUPO] Áudio detectado mas não é reply ao bot - respondendo em texto');
            }
          } else {
            // PV: sempre responde em áudio
            deveResponderEmAudio = true;
            console.log('🎤 [PV] Áudio detectado - respondendo em áudio');
          }
        }

        // SE DEVE RESPONDER EM ÁUDIO
        if (deveResponderEmAudio) {
          console.log('🎤 Convertendo resposta para áudio...');

          const tempoGravacao = Math.min(8000, 500 + (resposta.length * 40)); // Delay realista
          await simularGravacaoAudio(sock, m.key.remoteJid, tempoGravacao);

          const ttsResult = await textToSpeech(resposta, 'pt');

          if (ttsResult.error) {
            console.error('❌ Erro ao gerar áudio TTS:', ttsResult.error);
            await sock.sendMessage(m.key.remoteJid, {
              text: resposta
            }, opcoes);
          } else {
            await sock.sendMessage(m.key.remoteJid, {
              audio: ttsResult.buffer,
              mimetype: 'audio/mpeg',
              ptt: false
            }, opcoes);
            console.log('✅ Áudio enviado com sucesso');
          }
        } else {
          // === SIMULAÇÃO DE DIGITAÇÃO PARA TEXTO ===
          let tempoDigitacao = Math.min(Math.max(resposta.length * 50, 3000), 10000);
          await simularDigitacao(sock, m.key.remoteJid, tempoDigitacao);

          // Resposta normal em texto
          try {
            await sock.sendMessage(m.key.remoteJid, { text: resposta }, opcoes);
            console.log('✅ [ENVIADO COM SUCESSO]\n');
          } catch (e) {
            console.error('❌ Erro ao enviar:', e.message);
          }
        }

        // Volta ao estado normal
        try {
          await delay(500);
          await sock.sendPresenceUpdate('available', m.key.remoteJid);
        } catch (e) {}

      } catch (err) {
        console.error('❌ Erro no handler:', err);
      }
    });

    sock.ev.on('group-participants.update', async (event) => {
      try {
        const groupId = event.id;
        const welcomeSettings = loadJSON(JSON_PATHS.welkom) || {};
        
        // Se o sistema de welcome não estiver ativo para este grupo, não faz nada
        if (!welcomeSettings[groupId]) {
          return;
        }

        const action = event.action;
        
        for (const participant of event.participants) {
          const userJid = participant;
          const userMention = `@${userJid.split('@')[0]}`;

          if (action === 'add') {
            console.log(`[BEM-VINDO] Usuário ${userJid} entrou no grupo ${groupId}`);
            const welcomeMessage = `*Seja bem-vindo(a) ao grupo, ${userMention}!* Espero que siga as regras. 😉`;
            await sock.sendMessage(groupId, { 
              text: welcomeMessage,
              contextInfo: { mentionedJid: [userJid] }
            });
          } else if (action === 'remove') {
            console.log(`[ADEUS] Usuário ${userJid} saiu do grupo ${groupId}`);
            const goodbyeMessage = `*Adeus, ${userMention}.* Não fez falta. 👋`;
             await sock.sendMessage(groupId, { 
              text: goodbyeMessage,
              contextInfo: { mentionedJid: [userJid] }
            });
          }
        }
      } catch (e) {
        console.error('Erro no handler de group-participants.update:', e);
      }
    });

    console.log('✅ Socket criado, aguardando mensagens...');

  } catch (err) {
    console.error('❌ Erro na conexão:', err);
    setTimeout(() => conectar().catch(console.error), 5000);
  }
}
// ═══════════════════════════════════════════════════════════════════════
// SERVIDOR EXPRESS
// ═══════════════════════════════════════════════════════════════════════
const app = express();
app.use(express.json());
app.get('/', (req, res) => res.send(`
  <html><body style="background:#000;color:#0f0;font-family:monospace;text-align:center;padding:50px">
    <h1>🤖 AKIRA BOT V21 ONLINE ✅</h1>
    <p>Status: ${BOT_JID ? 'Conectado' : 'Desconectado'}</p>
    <p>Versão: COM TODAS FUNCIONALIDADES</p>
    <p>Prefixo: ${PREFIXO}</p>
    <p>🔐 Comandos restritos: Apenas Isaac Quarenta</p>
    <p>🎮 Sistema de Level: Ativo</p>
    <p>💰 Sistema de Economia: Ativo</p>
    <p>📝 Sistema de Registro: Ativo</p>
    <p>🛡️ Sistema de Banimento: Ativo</p>
    <p>👑 Sistema Premium: Ativo</p>
    <p>🛡️ Anti-spam: Ativo (3 segundos)</p>
    <p>🎤 STT: Deepgram API (200h/mês GRATUITO)</p>
    <p>🎤 TTS: Google TTS (funcional)</p>
    <p>🎤 Resposta a voz: Ativada</p>
    <p>🎨 Stickers personalizados: Com metadados</p>
    <p>🎵 Download YouTube: Sistema corrigido</p>
    <p>🎵 Efeitos de áudio: 10 efeitos disponíveis</p>
    <p><a href="/qr" style="color:#0f0">Ver QR</a> | <a href="/health" style="color:#0f0">Health</a></p>
  </body></html>
`));
app.get('/qr', async (req, res) => {
  if (!currentQR) {
    return res.send(`<html><body style="background:#000;color:#0f0;text-align:center;padding:50px">
      <h1>✅ BOT CONECTADO!</h1><p><a href="/" style="color:#0f0">Voltar</a></p></body></html>`);
  }
  const img = await QRCode.toDataURL(currentQR, { errorCorrectionLevel: 'H', scale: 10 });
  res.send(`<html><head><meta http-equiv="refresh" content="5"/></head>
    <body style="background:#000;color:#fff;text-align:center;padding:40px">
      <h1>📱 ESCANEIE O QR</h1><img src="${img}" style="border:12px solid #0f0;border-radius:20px"/>
      <p style="color:#0f0">Atualiza em 5s</p></body></html>`);
});
app.get('/health', (req, res) => {
  res.json({
    status: BOT_JID ? 'online' : 'offline',
    bot_numero: BOT_NUMERO_REAL,
    bot_jid: BOT_JID || null,
    prefixo: PREFIXO,
    dono_autorizado: 'Isaac Quarenta',
    stt_configurado: DEEPGRAM_API_KEY && DEEPGRAM_API_KEY !== 'seu_token_aqui' ? 'Deepgram (200h/mês)' : 'Não configurado',
    sistemas_ativos: {
      leveling: 'Ativo',
      economia: 'Ativo',
      registro: 'Ativo',
      banimento: 'Ativo',
      premium: 'Ativo',
      anti_spam: 'Ativo',
      stickers_personalizados: 'Ativo (com metadados)',
      youtube_download: 'Ativo (áudio e vídeo)',
      efeitos_audio: '10 efeitos disponíveis'
    },
    grupos_com_antilink: Array.from(antiLinkGroups).length,
    usuarios_mutados: mutedUsers.size,
    uptime: process.uptime(),
    version: 'v21_com_todas_funcionalidades'
  });
});
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🌐 Servidor rodando na porta ${server.address().port}\n`);
});
conectar();
process.on('unhandledRejection', (err) => console.error('❌ REJECTION:', err));
process.on('uncaughtException', (err) => console.error('❌ EXCEPTION:', err));
