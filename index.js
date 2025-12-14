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
const { Innertube } = require('youtubei.js');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
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

// Configurar caminho do FFmpeg com validações extras no Windows
(function ensureFfmpegPath() {
  try {
    if (ffmpegStatic && typeof ffmpegStatic === 'string' && ffmpegStatic.length > 0) {
      ffmpeg.setFfmpegPath(ffmpegStatic);
      console.log('🔧 ffmpeg-static configurado.');
    }
  } catch (_) {}
  try {
    const { execSync } = require('child_process');
    const ver = execSync('ffmpeg -version', { encoding: 'utf8', stdio: 'pipe', shell: true });
    if (ver && /ffmpeg version/i.test(ver)) {
      console.log('🔎 FFmpeg (PATH) detectado:', (ver.split('\n')[0] || '').trim());
    } else {
      console.log('ℹ️ FFmpeg global não encontrado. Usando binário estático.');
    }
  } catch (e) {
    console.log('ℹ️ FFmpeg global não encontrado no PATH. Usando ffmpeg-static.');
  }
})();

// Binário do FFmpeg a ser usado em chamadas diretas (fallback para nome se não houver estático)
const FFMPEG_BIN = (ffmpegStatic && typeof ffmpegStatic === 'string' && ffmpegStatic.length > 0) ? ffmpegStatic : 'ffmpeg';

// ═══════════════════════════════════════════════════════════════════════
// CONFIGURAÇÕES E CONSTANTES
// ═══════════════════════════════════════════════════════════════════════
const PORT = process.env.PORT || 3000;
const API_URL = process.env.API_URL || 'https://akra35567-AKIRA-SOFTEDGE.hf.space/api/akira';
const BOT_NUMERO_REAL = '40755431264474';
const PREFIXO = '#'; // Prefixo para comandos extras
const TEMP_FOLDER = './temp';
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// Configuração Deepgram STT (GRATUITO - 200h/mês)
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || '2700019dc80925c32932ab0aba44d881d20d39f7';
const DEEPGRAM_API_URL = 'https://api.deepgram.com/v1/listen';

// USUÁRIOS COM PERMISSÃO DE DONO (APENAS ISAAC QUARENTA)
const DONO_USERS = [
  { numero: '244937035662', nomeExato: 'Isaac Quarenta' },
  { numero: '244978787009', nomeExato: 'Isaac Quarenta' }
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
  fs.mkdirSync(TEMP_FOLDER, { recursive: true });
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
  // Dificuldade exponencial branda
  return Math.floor(100 + level * 150 + Math.pow(level, 2) * 20);
}

// Sistema de patentes (adaptado do projeto referência)
function getPatente(nivelAtual) {
  let patt = 'Bronze I🥉';
  
  if (nivelAtual === 1) patt = 'Bronze I🥉';
  else if (nivelAtual === 2) patt = 'Bronze II🥉';
  else if (nivelAtual === 3) patt = 'Bronze III🥉';
  else if (nivelAtual === 4) patt = 'Bronze IV🥉';
  else if (nivelAtual === 5) patt = 'Bronze V🥉';
  else if (nivelAtual === 6) patt = 'Prata I🥈';
  else if (nivelAtual === 7) patt = 'Prata II🥈';
  else if (nivelAtual === 8) patt = 'Prata III🥈';
  else if (nivelAtual === 9) patt = 'Prata IV🥈';
  else if (nivelAtual === 10) patt = 'Prata V🥈';
  else if (nivelAtual === 11) patt = 'Ouro I🥇';
  else if (nivelAtual === 12) patt = 'Ouro II🥇';
  else if (nivelAtual === 13) patt = 'Ouro III🥇';
  else if (nivelAtual === 14) patt = 'Ouro IV🥇';
  else if (nivelAtual === 15) patt = 'Ouro V🥇';
  else if (nivelAtual === 16) patt = 'Campeão I🏆';
  else if (nivelAtual === 17) patt = 'Campeão II🏆';
  else if (nivelAtual === 18) patt = 'Campeão III🏆';
  else if (nivelAtual === 19) patt = 'Campeão IV🏆';
  else if (nivelAtual === 20) patt = 'Campeão V🏆';
  else if (nivelAtual === 21) patt = 'Diamante I💎';
  else if (nivelAtual === 22) patt = 'Diamante II💎';
  else if (nivelAtual === 23) patt = 'Diamante III💎';
  else if (nivelAtual === 24) patt = 'Diamante IV💎';
  else if (nivelAtual === 25) patt = 'Diamante V💎';
  else if (nivelAtual === 26) patt = 'Mestre I🐂';
  else if (nivelAtual === 27) patt = 'Mestre II🐂';
  else if (nivelAtual === 28) patt = 'Mestre III🐂';
  else if (nivelAtual === 29) patt = 'Mestre IV🐂';
  else if (nivelAtual === 30) patt = 'Mestre V🐂';
  else if (nivelAtual === 31) patt = 'Mítico I🔮';
  else if (nivelAtual === 32) patt = 'Mítico II🔮';
  else if (nivelAtual === 33) patt = 'Mítico III🔮';
  else if (nivelAtual === 34) patt = 'Mítico IV🔮';
  else if (nivelAtual === 35) patt = 'Mítico V🔮';
  else if (nivelAtual === 36) patt = 'God I🕴';
  else if (nivelAtual === 37) patt = 'God II🕴';
  else if (nivelAtual === 38) patt = 'God III🕴';
  else if (nivelAtual === 39) patt = 'God IV🕴';
  else if (nivelAtual === 40) patt = 'God V🕴';
  else if (nivelAtual >= 41) patt = '🛐Grande Mestre🛐';
  
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
  const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|(bit\.ly\/[^\s]+)|(t\.me\/[^\s]+)|(wa\.me\/[^\s]+)|(chat\.whatsapp\.com\/[^\s]+)/gi;
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

// FUNÇÃO MELHORADA PARA EXTRAIR REPLY INFO
function extrairReplyInfo(m) {
  try {
    const context = m.message?.extendedTextMessage?.contextInfo;
    if (!context || !context.quotedMessage) return null;
    
    const quoted = context.quotedMessage;
    const tipo = getContentType(quoted);
    
    let textoReply = '';
    let tipoMidia = 'texto';
    
    if (tipo === 'conversation') {
      textoReply = quoted.conversation || '';
      tipoMidia = 'texto';
    } else if (tipo === 'extendedTextMessage') {
      textoReply = quoted.extendedTextMessage?.text || '';
      tipoMidia = 'texto';
    } else if (tipo === 'imageMessage') {
      textoReply = quoted.imageMessage?.caption || '[imagem]';
      tipoMidia = 'imagem';
    } else if (tipo === 'videoMessage') {
      textoReply = quoted.videoMessage?.caption || '[vídeo]';
      tipoMidia = 'video';
    } else if (tipo === 'audioMessage') {
      textoReply = '[áudio]';
      tipoMidia = 'audio';
    } else if (tipo === 'stickerMessage') {
      textoReply = '[figurinha]';
      tipoMidia = 'sticker';
    } else if (tipo === 'documentMessage') {
      textoReply = quoted.documentMessage?.caption || quoted.documentMessage?.fileName || '[documento]';
      tipoMidia = 'documento';
    } else {
      textoReply = '[conteúdo]';
      tipoMidia = 'outro';
    }
    
    const participantJid = context.participant || null;
    const ehRespostaAoBot = ehOBot(participantJid);
    
    let usuarioCitadoNome = 'desconhecido';
    let usuarioCitadoNumero = 'desconhecido';
    
    if (participantJid) {
      try {
        const usuario = store?.contacts?.[participantJid] || {};
        usuarioCitadoNome = usuario.name || usuario.notify || participantJid.split('@')[0] || 'desconhecido';
        usuarioCitadoNumero = participantJid.split('@')[0] || 'desconhecido';
      } catch (e) {
        console.error('Erro ao obter info usuário citado:', e);
      }
    }
    
    const quemFalaJid = m.key.participant || m.key.remoteJid;
    let quemFalaNome = m.pushName || 'desconhecido';
    let quemFalaNumero = extrairNumeroReal(m);
    
    return {
      texto: textoReply,
      textoCompleto: textoReply,
      tipoMidia: tipoMidia,
      participantJid: participantJid,
      ehRespostaAoBot: ehRespostaAoBot,
      usuarioCitadoNome: usuarioCitadoNome,
      usuarioCitadoNumero: usuarioCitadoNumero,
      quemFalaJid: quemFalaJid,
      quemFalaNome: quemFalaNome,
      quemFalaNumero: quemFalaNumero,
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

function cleanupFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (e) {
    console.error('Erro ao limpar arquivo:', e);
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
    '--ffmpeg-location', ffmpegStatic || FFMPEG_BIN,
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

// Função para criar EXIF metadata para stickers usando node-webpmux
async function addStickerMetadata(webpBuffer, packName = "Akira Bot", author = "Isaac Quarenta") {
  try {
    const img = new Webpmux.Image();
    await img.load(webpBuffer);

    // WhatsApp-friendly minimal EXIF JSON
    const json = {
      "sticker-pack-id": crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2, 10)),
      "sticker-pack-name": String(packName || 'Akira').slice(0, 30),
      "sticker-pack-publisher": String(author || 'Akira').slice(0, 30)
    };

    // Standard EXIF header used broadly for WA stickers
    const exifAttr = Buffer.from([
      0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00,
      0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x16, 0x00, 0x00, 0x00
    ]);

    const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8');
    const exif = Buffer.concat([exifAttr, jsonBuffer]);
    img.exif = exif;

    const result = await img.save(null);
    return result;
  } catch (e) {
    console.error('Erro ao adicionar metadados:', e);
    return webpBuffer;
  }
}

// Função para criar sticker com metadados usando node-webpmux
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

    // Validação inicial da imagem para evitar processamento de arquivos inválidos
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

    // Caminho 1: Sharp (mais confiável para estático). Se indisponível, cai para FFmpeg.
    if (sharp) {
      console.log('[STICKER GEN] 🎨 Tentando conversão com Sharp...');
      try {
        console.log('[STICKER GEN] 📏 Redimensionando para 512x512...');
        const webpBuf = await sharp(imageBuffer)
          .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
          .webp({ quality: 75, effort: 6 })
          .toBuffer();
        console.log(`[STICKER GEN] ✅ Conversão Sharp concluída: ${webpBuf.length} bytes`);

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
        console.warn('[STICKER GEN] ❌ Sharp falhou, usando FFmpeg como fallback:', errSharp?.message || errSharp);
      }
    } else {
      console.log('[STICKER GEN] ⏭️ Sharp indisponível, pulando para FFmpeg');
    }

    // Caminho 2: FFmpeg
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
          '-q:v 70',
          '-compression_level 6',
          '-lossless 0',
          "-vf scale=512:-2:flags=lanczos:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000,setsar=1"
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
      console.log('[STICKER GEN] 🎯 Tentativa de encode direto...');
      await encodeWebp(inputPath);
    } catch (err) {
      console.warn('[STICKER GEN] ⚠️ FFmpeg encode direto falhou, tentando normalização:', err?.message || err);
      const normPath = generateRandomFilename('png');
      let normalizedOk = false;

      // 1) Tentar normalizar com sharp (mais robusto para imagens estáticas)
      if (sharp) {
        console.log('[STICKER GEN] 🔧 Tentando normalização com Sharp...');
        try {
          const pngBuf = await sharp(fs.readFileSync(inputPath))
            .png({ progressive: true })
            .toBuffer();
          fs.writeFileSync(normPath, pngBuf);
          console.log(`[STICKER GEN] ✅ Normalização Sharp: ${pngBuf.length} bytes`);
          normalizedOk = true;
        } catch (e) {
          console.warn('[STICKER GEN] ❌ Normalização Sharp falhou:', e?.message || e);
        }
      }

      // 2) Fallback: normalizar com FFmpeg (opções melhoradas para imagens)
      if (!normalizedOk) {
        console.log('[STICKER GEN] 🔧 Tentando normalização com FFmpeg...');
        try {
          await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
              .outputOptions([
                '-y',
                '-v error',
                '-vf format=rgb24', // Melhor para imagens estáticas
                '-f image2' // Formato de imagem
              ])
              .on('end', () => {
                console.log('[STICKER GEN] ✅ Normalização FFmpeg concluída');
                resolve();
              })
              .on('error', (err) => {
                console.error('[STICKER GEN] ❌ Normalização FFmpeg falhou:', err.message);
                reject(err);
              })
              .save(normPath);
          });
          normalizedOk = true;
        } catch (ffmpegErr) {
          console.error('[STICKER GEN] ❌ FFmpeg normalização falhou:', ffmpegErr.message);
          cleanupFile(inputPath);
          return null; // Retornar null se normalização falhar
        }
      }

      // Re-encode para WEBP após normalização
      if (normalizedOk) {
        console.log('[STICKER GEN] 🔄 Re-encodando para WEBP após normalização...');
        await encodeWebp(normPath);
        cleanupFile(normPath);
      } else {
        // Se não conseguiu normalizar, tentar encode direto novamente (pode falhar)
        console.log('[STICKER GEN] 🔄 Tentando encode direto novamente...');
        await encodeWebp(inputPath);
      }
    }

    // Validar arquivo de saída antes de prosseguir
    if (!fs.existsSync(outputPath)) {
      cleanupFile(inputPath);
      console.error('[STICKER GEN] ❌ Conversão falhou: arquivo de saída não existe');
      return null;
    }
    const outStats = fs.statSync(outputPath);
    if (!outStats || outStats.size === 0) {
      cleanupFile(inputPath);
      cleanupFile(outputPath);
      console.error('[STICKER GEN] ❌ Conversão falhou: arquivo de saída vazio');
      return null;
    }
    console.log(`[STICKER GEN] ✅ Arquivo WEBP gerado: ${outStats.size} bytes`);

    let webpBuffer = fs.readFileSync(outputPath);
    console.log('[STICKER GEN] 🏷️ Adicionando metadados EXIF ao WEBP...');
    try {
      webpBuffer = await addStickerMetadata(webpBuffer, packName, author);
      console.log(`[STICKER GEN] ✅ Sticker (FFmpeg) criado com metadados: ${webpBuffer.length} bytes`);
    } catch (metadataError) {
      console.warn('[STICKER GEN] ⚠️ Falha ao adicionar metadados, usando sem EXIF:', metadataError.message);
    }

    cleanupFile(inputPath);
    cleanupFile(outputPath);
    console.log('[STICKER GEN] 🧹 Arquivos temporários limpos');

    console.log('[STICKER GEN] 🎉 Processo de criação de sticker concluído com sucesso');
    return webpBuffer;
  } catch (e) {
    console.error('[STICKER GEN] 💥 Erro geral ao criar sticker:', e.message);
    console.error('[STICKER GEN] 📋 Stack trace:', e.stack);
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
// FUNÇÃO PARA DOWNLOAD DE ÁUDIO DO YOUTUBE - USANDO YOUTUBEI.JS
// ════════════════════════════════════════════════��══════════════════════
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
    
    // MÉTODO 1: YouTubeI.js (API oficial - MAIS CONFIÁVEL)
    try {
      console.log('🔄 Método 1: YouTubeI.js (API oficial)...');
      
      const youtube = await Innertube.create();
      const info = await youtube.getInfo(videoId);
      
      // Verificar duração
      const duration = info.basic_info.duration;
      if (duration > 1200) {
        return { error: `Vídeo muito longo (${Math.floor(duration/60)} minutos). Máximo 20 minutos.` };
      }
      
      // Obter melhor formato de áudio
      const format = info.chooseFormat({ type: 'audio', quality: 'best' });
      
      if (!format) {
        throw new Error('Nenhum formato de áudio disponível');
      }
      
      console.log(`✅ Formato selecionado: ${format.mime_type}`);
      
      // Baixar áudio
      const stream = await info.download({ type: 'audio', quality: 'best' });
      const writeStream = fs.createWriteStream(outputPath);
      
      for await (const chunk of stream) {
        writeStream.write(chunk);
      }
      
      writeStream.end();
      
      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
      
      // Verificar tamanho
      const stats = fs.statSync(outputPath);
      
      if (stats.size === 0) {
        cleanupFile(outputPath);
        throw new Error('Arquivo vazio');
      }
      
      if (stats.size > 25 * 1024 * 1024) {
        cleanupFile(outputPath);
        return { error: 'Arquivo muito grande (>25MB). Tente um vídeo mais curto.' };
      }
      
      console.log(`📦 Arquivo baixado: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
      
      const audioBuffer = fs.readFileSync(outputPath);
      cleanupFile(outputPath);
      
      const title = info.basic_info.title || 'Música do YouTube';
      const author = info.basic_info.author || 'Desconhecido';
      
      console.log('✅ Download concluído via YouTubeI.js!');
      return { 
        buffer: audioBuffer, 
        title: title,
        duration: duration,
        author: author
      };
      
    } catch (youtubeIError) {
      console.error('❌ YouTubeI.js falhou:', youtubeIError.message);
      cleanupFile(outputPath);
    }
    
    // MÉTODO 2: yt-dlp (fallback)
    {
      const fullUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const ytRes = await downloadWithYtDlp(fullUrl);
      if (!ytRes.error) {
        return ytRes;
      } else {
        console.error('❌ yt-dlp falhou:', ytRes.error);
      }
    }
    
    // Se todos os métodos falharem
    console.log('❌ Todos os métodos de download falharam');
    return { error: 'Não foi possível baixar o áudio. O YouTube pode estar bloqueando downloads. Tente outro vídeo ou aguarde alguns minutos.' };
    
  } catch (e) {
    console.error('❌ Erro geral:', e);
    return { error: 'Erro ao processar: ' + e.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// FUNÇÃO PARA TEXT TO SPEECH (MANTIDA)
// ═══════════════════════════════════════════════════════════════════════
async function textToSpeech(text, lang = 'pt') {
  try {
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
    
    if (ehGrupo) {
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
    }
    
    if (!foiAtivada) {
      return;
    }
    
    if (temAudio && foiAtivada) {
      await sock.readMessages([m.key]);
      console.log('▶️ [REPRODUZIDO] Áudio marcado como reproduzido (✓✓)');
    } else if (foiAtivada) {
      await sock.readMessages([m.key]);
      console.log('✓✓ [LIDO] Mensagem marcada como lida (azul)');
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
      }, { quoted: m });
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
              text: '📸 Como usar:\n- Envie uma imagem com legenda `#sticker`\n- OU responda uma imagem/sticker com `#sticker`\n\n⚠️ Para animados a partir de vídeo, use `#gif`.'
            }, { quoted: m });
            return true;
          }

          const packName = 'Akira Bot';
          const author = 'Isaac Quarenta';

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
    
    // Mostrar que está tentando diferentes métodos
    await sendProgressMessage(sock, m.key.remoteJid, '🔄 Tentando diferentes métodos de download...', m, userId);
    
    const ytResult = await downloadYTAudio(urlFinal);
    
    if (ytResult.error) {
      await sendProgressMessage(sock, m.key.remoteJid, `❌ ${ytResult.error}\n\n💡 *Dicas:*\n• Tente vídeos mais curtos\n• Use links diretos do YouTube\n• Verifique se o vídeo não está bloqueado`, m, userId);
      return true;
    }
    
    const finalTitle = title || ytResult.title || 'Música do YouTube';
    
    if (userId && m.key.id) {
      const key = `${userId}_${m.key.id}`;
      progressMessages.delete(key);
    }
    
    await sendProgressMessage(sock, m.key.remoteJid, `✅ Download concluído!\n🎵 Enviando: *${finalTitle}*`, m, userId);
    
    await sock.sendMessage(m.key.remoteJid, { 
      audio: ytResult.buffer,
      mimetype: 'audio/mpeg',
      ptt: false,
      fileName: `${finalTitle.substring(0, 50).replace(/[^\w\s]/gi, '')}.mp3`
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
          const author = 'Isaac Quarenta';

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

          const txt = `��� LEVEL (por grupo)
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
          const t0 = Date.now();
          const sent = await sock.sendMessage(m.key.remoteJid, { text: 'Pinging...' }, { quoted: m });
          const dt = Date.now() - t0;
          await sock.sendMessage(m.key.remoteJid, { text: `Pong! ${dt}ms` }, { quoted: sent });
        } catch (e) {
          await sock.sendMessage(m.key.remoteJid, { text: 'Ping falhou.' }, { quoted: m });
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
      
      // === MENU ATUALIZADO ===
      // === DONATE / APOIO ===
      case 'donate':
      case 'doar':
      case 'apoia':
        try {
          const donateText = `❤️ APOIE O PROJETO AKIRA ❤️\n\nSe este bot te ajuda, considere contribuir:\n\n• PIX (e-mail): akira.bot.dev@gmail.com\n• Ko-fi: https://ko-fi.com/isaacquarenta\n\nQualquer valor ajuda a manter os servidores e novas funções. Obrigado!`;
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

      case 'tagall':
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
          const msg = args.length ? args.join(' ') : '📢 Atenção a todos!';
          await sock.sendMessage(m.key.remoteJid, { text: msg, contextInfo: { mentionedJid: all } }, { quoted: m });
        } catch (e) {
          await sock.sendMessage(m.key.remoteJid, { text: '��� Erro ao mencionar todos.' }, { quoted: m });
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

      case 'help':
      case 'menu':
      case 'comandos':
      case 'ajuda':
        const helpText = `🤖 *MENU DE COMANDOS AKIRA V21* 🤖

*📱 PREFIXO:* \`${PREFIXO}\`

*🎨 MÍDIA (Todos):*
\`#sticker\` - Criar sticker de imagem/vídeo (com nome personalizado)
\`#take Nome|Autor\` - Personalizar sticker com metadados (responda sticker)
\`#toimg\` - Converter sticker para imagem
\`#tts <idioma> <texto>\` - Texto para voz
\`#play <nome/link>\` - Baixar música do YouTube
\`#ytmp4 <link>\` - Baixar vídeo do YouTube

*🎵 EFEITOS DE ÁUDIO (Responda a um áudio):*
\`#nightcore\` - Efeito nightcore
\`#slow\` - Áudio lento
\`#fast\` - Áudio rápido
\`#bass\` - Aumentar graves
\`#earrape\` - Áudio estourado
\`#esquilo\` - Efeito esquilo
\`#gemuk\` - Efeito gordo

*🎮 SISTEMA DE LEVEL:*
\`#registrar Nome|Idade\` - Registrar no sistema
\`#level\` - Ver seu nível e XP
\`#perfil\` - Ver informações do perfil

*💰 SISTEMA DE ECONOMIA:*
\`#daily\` - Receber dinheiro diário
\`#balance\` - Ver seu saldo
\`#roubar @usuário\` - Roubar dinheiro (50% chance)

*🎲 JOGOS E DIVERSÃO:*
\`#apostar <valor>\` - Apostar no jogo do dado
\`#cassino <valor>\` - Jogar na roleta
\`#loteria <números>\` - Jogar na loteria
\`#roletarussa\` - Roleta russa (cuidado!)
\`#dado\` - Lançar um dado
\`#moeda\` - Cara ou coroa

*👑 COMANDOS DE DONO (Apenas Isaac Quarenta):*
\`#add <número>\` - Adicionar membro ao grupo
\`#remove @membro\` - Remover membro (ou use reply)
\`#ban @membro\` - Alias para remover
\`#promote @membro\` - Dar admin (ou use reply)
\`#demote @membro\` - Remover admin (ou use reply)
\`#mute @usuário\` - Mutar por 5 minutos (ou use reply)
\`#desmute @usuário\` - Desmutar (ou use reply)
\`#antilink on/off\` - Ativar/desativar anti-link
\`#antilink status\` - Ver status anti-link
\`#apagar\` - Apagar mensagem (responda a mensagem)
\`#clearchat\` - Limpar todas as mensagens
\`#bc <mensagem>\` - Transmissão para todos os chats

*💬 CONVERSA NORMAL:*
Apenas mencione "Akira" ou responda minhas mensagens para conversar normalmente!

*🎤 RESPOSTA A ÁUDIO:*
- Envie um áudio mencionando "Akira" em grupos
- Em PV, envie qualquer áudio que eu respondo
- Eu transcrevo seu áudio e respondo com minha voz
- NUNCA mostro transcrições no chat

*⚠️ COMANDOS DE GRUPO APENAS PARA ISAAC QUARENTA!*`;
        
        await sock.sendMessage(m.key.remoteJid, { text: helpText }, { quoted: m });
        return true;
      
      // === COMANDOS DE GRUPO (APENAS ISAAC QUARENTA) ===
      case 'add':
      case 'remove':
      case 'ban':
      case 'promote':
      case 'demote':
      case 'mute':
      case 'desmute':
      case 'antilink':
      case 'apagar':
        // Estes comandos já estão implementados na sua versão original
        // Eles verificam permissão de Isaac Quarenta
        break;
      
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
📈 Subiu para o nível ${rec.level}!
🏅 Nova patente: ${patente}

✨ Parabéns! Continue interagindo para subir mais!`;
      await sock.sendMessage(m.key.remoteJid, { text: levelUpText, contextInfo: { mentionedJid: [sender] } }, { quoted: m });
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
        console.log('🎮 Sistema de Level: Ativo');
        console.log('💰 Sistema de Economia: Ativo');
        console.log('📝 Sistema de Registro: Ativo');
        console.log('🛡️ Sistema de Banimento: Ativo');
        console.log('👑 Sistema Premium: Ativo');
        console.log('🛡️ Anti-spam: Ativo (3 segundos)');
        console.log('🎤 STT: Deepgram API (200h/mês GRATUITO)');
        console.log('🎤 TTS: Google TTS (funcional)');
        console.log('🎤 Resposta a voz: Ativada');
        console.log('🎨 Stickers personalizados: Com metadados');
        console.log('🎵 Download YouTube: Sistema corrigido');
        console.log('🎵 Efeitos de áudio: 10 efeitos disponíveis');
        console.log('🧹 Clearchat: Disponível para dono');
        console.log('📡 Broadcast: Disponível para dono');
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
            console.log(`🔇 [MUTE] Usuário ${nome} tentou falar durante mute.`);
            
            try {
              await sock.groupParticipantsUpdate(groupId, [userId], 'remove');
              await sock.sendMessage(groupId, { 
                text: `🚫 *${nome} foi removido por enviar mensagem durante período de mute!*` 
              });
              
              unmuteUser(groupId, userId);
              
            } catch (e) {
              console.error('Erro ao remover usuário mutado:', e);
            }
            
            return;
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
        
        if (temAudio) {
          console.log(`🎤 [ÁUDIO RECEBIDO] de ${nome}`);
          
          await simularGravacaoAudio(sock, m.key.remoteJid, 1500);
          
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
        
        // === FORMATAR MENSAGEM CITADA PARA API ===
        let mensagemCitadaFormatada = '';
        if (replyInfo) {
          if (replyInfo.ehRespostaAoBot) {
            mensagemCitadaFormatada = `[${nome} está respondendo à Akira: "${replyInfo.textoCompleto}"]`;
          } else {
            mensagemCitadaFormatada = `[${nome} mencionou algo que ${replyInfo.usuarioCitadoNome} disse: "${replyInfo.textoCompleto}"]`;
          }
        }
        
        // === PAYLOAD PARA API ===
        const payloadBase = {
          usuario: nome,
          numero: numeroReal,
          mensagem: textoParaAPI,
          mensagem_citada: mensagemCitadaFormatada,
          tipo_conversa: ehGrupo ? 'grupo' : 'pv',
          tipo_mensagem: temAudio ? 'audio' : 'texto'
        };
        
        if (replyInfo) {
          payloadBase.reply_info = {
            quem_fala_nome: nome,
            quem_fala_numero: numeroReal,
            reply_to_bot: replyInfo.ehRespostaAoBot,
            usuario_citado_nome: replyInfo.usuarioCitadoNome,
            usuario_citado_numero: replyInfo.usuarioCitadoNumero,
            texto_citado_completo: replyInfo.textoCompleto,
            tipo_midia: replyInfo.tipoMidia || 'texto'
          };
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
        
        // SE A MENSAGEM ORIGINAL FOI ÁUDIO, RESPONDE APENAS COM ÁUDIO
        if (temAudio) {
          console.log('🎤 Convertendo resposta para áudio...');
          
          await simularGravacaoAudio(sock, m.key.remoteJid, 2500);
          
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
  res.send(`<html><head><meta http-equiv="refresh" content="5"></head>
    <body style="background:#000;color:#fff;text-align:center;padding:40px">
      <h1>📱 ESCANEIE O QR</h1><img src="${img}" style="border:12px solid #0f0;border-radius:20px">
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
