/**
 * ═══════════════════════════════════════════════════════════════════════
 * AKIRA BOT V21 — VERSÃO COMPLETA COM TODAS FUNCIONALIDADES
 * ═══════════════════════════════════════════════════════════════════════
 * ✅ Sistema de Níveis/Patentes aprimorado
 * ✅ Sistema de Economia completo
 * ✅ Sistema de Registro
 * ✅ Sistema Premium
 * ✅ Sistema de Banimento
 * ✅ Sistema de Welcome/Goodbye
 * ✅ Stickers personalizados com metadados
 * ✅ Download YouTube (áudio e vídeo)
 * ✅ Efeitos de áudio (10+ efeitos)
 * ✅ Comandos de diversão
 * ✅ Comandos de moderação
 * ✅ Comandos de grupo para Isaac Quarenta
 * ✅ Anti-spam, Anti-link, Anti-flood
 * ✅ Contexto de reply otimizado
 * ✅ STT via Deepgram + TTS
 * ✅ Resposta a mensagens de voz
 * ═══════════════════════════════════════════════════════════════════════
 */

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
const fs = require('fs');
const path = require('path');
const { exec, spawn, execSync, execFile } = require('child_process');
const util = require('util');
const googleTTS = require('google-tts-api');
const FormData = require('form-data');
const Webpmux = require('node-webpmux');
const moment = require('moment-timezone');
const crypto = require('crypto');
const cheerio = require('cheerio');
const chalk = require('chalk');
const ms = require('parse-ms');
const toMs = require('ms');

// ===== CORREÇÃO DEFINITIVA DO FFMPEG =====
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

console.log('✅ FFmpeg carregado com sucesso:', ffmpegInstaller.path);
console.log('✅ FFprobe carregado com sucesso:', ffprobeInstaller.path);

const FFMPEG_BIN = ffmpegInstaller.path;
// ================================================================

// ═══════════════════════════════════════════════════════════════════════
// CONFIGURAÇÕES E CONSTANTES
// ═══════════════════════════════════════════════════════════════════════
const PORT = process.env.PORT || 3000;
const API_URL = process.env.API_URL || 'https://akra35567-AKIRA-SOFTEDGE.hf.space/api/akira';
const BOT_NUMERO_REAL = '37839265886398';
const PREFIXO = '#'; // Prefixo para comandos extras
const TEMP_FOLDER = './temp';
const BOT_NAME = 'Akira';
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// Configuração Deepgram STT
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

// Sistema de registro
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

// Sistema de leveling
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

// Level por grupo
function loadGroupLevels() { try { return loadJSON(JSON_PATHS.level); } catch (e) { return []; } }
function saveGroupLevels(arr) { try { saveJSON(JSON_PATHS.level, arr); } catch (_) {} }

function getGroupLevelRecord(gid, uid, createIfMissing=false) {
  const data = loadGroupLevels();
  let rec = data.find(r => r && r.gid === gid && r.uid === uid);
  if (!rec && createIfMissing) { 
    rec = { gid, uid, level: 0, xp: 0 }; 
    data.push(rec); 
    saveGroupLevels(data); 
  }
  return rec || { gid, uid, level: 0, xp: 0 };
}

function saveGroupLevelRecord(rec) {
  const data = loadGroupLevels();
  const i = data.findIndex(r => r && r.gid === rec.gid && r.uid === rec.uid);
  if (i === -1) data.push(rec); else data[i] = rec;
  saveGroupLevels(data);
}

function getRequiredGroupXp(level) {
  if (level === 0) return 100;
  return Math.floor(100 + Math.pow(level, 3.5) * 9);
}

// Sistema de patentes
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

// Sistema de economia (dinheiro)
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

function getKoinUser(sender) {
  const uang = loadJSON(JSON_PATHS.uang);
  const user = uang.find(u => u.id === sender);
  return user ? user.money : 0;
}

function setKoinUser(sender, amount) {
  const uang = loadJSON(JSON_PATHS.uang);
  const userIndex = uang.findIndex(u => u.id === sender);
 
  if (userIndex !== -1) {
    uang[userIndex].money = amount;
    saveJSON(JSON_PATHS.uang, uang);
  }
}

// Sistema de banimento
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

// Sistema premium
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

// Sistema anti-spam
let antispam = new Map();

// Anti-flood e blacklist
const HOURLY_LIMIT = 300;
const HOURLY_WINDOW_MS = 60 * 60 * 1000;
const OVERLIMIT_ATTEMPTS_BLACKLIST = 12;
const userRate = new Map();

function loadBlacklist() {
  try {
    const data = loadJSON(JSON_PATHS.blacklist);
    if (Array.isArray(data)) return data;
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

// Funções auxiliares
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
// FUNÇÕES ORIGINAIS DO CÓDIGO BASE
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

// FUNÇÃO CRÍTICA CORRIGIDA: EXTRAIR REPLY INFO
function extrairReplyInfo(m) {
  try {
    const context = m.message?.extendedTextMessage?.contextInfo;
    if (!context || !context.quotedMessage) return null;
    
    const quoted = context.quotedMessage;
    const tipo = getContentType(quoted);
    
    // EXTRAI TEXTO DA MENSAGEM CITADA
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
    
    // IDENTIFICA QUEM ESCREVEU A MENSAGEM CITADA
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
    
    // IDENTIFICA QUEM ESTÁ FALANDO AGORA (A MENSAGEM ATUAL)
    const quemFalaAgoraJid = m.key.participant || m.key.remoteJid;
    let nomeQuemFalaAgora = m.pushName || 'desconhecido';
    let numeroQuemFalaAgora = extrairNumeroReal(m);
    
    // CONTEXTO SUPER CLARO
    let contextoClaro = '';
    if (ehRespostaAoBot) {
      contextoClaro = `CONTEXTO: ${nomeQuemFalaAgora} está respondendo à mensagem anterior DA AKIRA que dizia: "${textoMensagemCitada}"`;
    } else {
      contextoClaro = `CONTEXTO: ${nomeQuemFalaAgora} está comentando sobre algo que ${nomeQuemEscreveuCitacao} disse: "${textoMensagemCitada}"`;
    }
    
    return {
      // QUEM ESTÁ FALANDO AGORA
      quemFalaAgoraJid: quemFalaAgoraJid,
      quemFalaAgoraNome: nomeQuemFalaAgora,
      quemFalaAgoraNumero: numeroQuemFalaAgora,
      
      // INFORMAÇÕES DA MENSAGEM CITADA
      textoMensagemCitada: textoMensagemCitada,
      tipoMidiaCitada: tipoMidia,
      
      // QUEM ESCREVEU A MENSAGEM CITADA
      quemEscreveuCitacaoJid: participantJidCitado,
      quemEscreveuCitacaoNome: nomeQuemEscreveuCitacao,
      quemEscreveuCitacaoNumero: numeroQuemEscreveuCitacao,
      
      // FLAGS IMPORTANTES
      ehRespostaAoBot: ehRespostaAoBot,
      
      // CONTEXTO SUPER CLARO PARA API
      contextoClaro: contextoClaro,
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
          return progressData.key;
        } catch (e) {}
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
// FUNÇÕES PARA STT (SPEECH TO TEXT)
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
// FUNÇÕES PARA DOWNLOAD DE MÍDIA
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

// Helper: detectar se um buffer é WEBP
function isWebpBuffer(buf) {
  try {
    if (!buf || buf.length < 12) return false;
    return buf.slice(0,4).toString('ascii') === 'RIFF' && buf.slice(8,12).toString('ascii') === 'WEBP';
  } catch (_) { return false; }
}

// ═══════════════════════════════════════════════════════════════════════
// FUNÇÕES PARA STICKERS PERSONALIZADOS COM METADADOS
// ═══════════════════════════════════════════════════════════════════════
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

    exif.writeUIntLE(jsonBuff.length, 14, 4);

    img.exif = exif;
    const result = await img.save(null);
    return result;
  } catch (e) {
    console.error('Erro ao adicionar metadados:', e);
    return webpBuffer;
  }
}

// Função para criar sticker com metadados
async function createStickerWithMetadata(imageBuffer, packName = "Akira Bot", author = "Isaac Quarenta") {
  try {
    if (!imageBuffer || !Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
      return null;
    }

    const ext = isWebpBuffer(imageBuffer) ? 'webp' : 'jpg';
    const inputPath = generateRandomFilename(ext);
    const outputPath = generateRandomFilename('webp');
    
    fs.writeFileSync(inputPath, imageBuffer);

    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          '-y',
          '-v error',
          '-c:v libwebp',
          '-q:v 75',
          '-compression_level 6',
          '-lossless 0',
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

    if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
      cleanupFile(inputPath);
      cleanupFile(outputPath);
      return null;
    }

    let webpBuffer = fs.readFileSync(outputPath);

    // Adicionar metadados
    try {
      webpBuffer = await addStickerMetadata(webpBuffer, packName, author);
    } catch (metadataError) {
      console.warn('[STICKER GEN] ⚠️ Sem metadados (EXIF falhou):', metadataError.message);
    }

    cleanupFile(inputPath);
    cleanupFile(outputPath);
    console.log('[STICKER GEN] 🎉 Sticker estático criado com sucesso!');

    return webpBuffer;
  } catch (e) {
    console.error('[STICKER GEN] 💥 Erro crítico:', e.message);
    return null;
  }
}

// Função para criar sticker animado com metadados
async function createAnimatedStickerWithMetadata(videoBuffer, packName = "Akira Bot", author = "Isaac Quarenta", duration = 8) {
  try {
    const inputPath = generateRandomFilename('mp4');
    const outputPath = generateRandomFilename('webp');
    fs.writeFileSync(inputPath, videoBuffer);
    
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
    
    let webpBuffer = fs.readFileSync(outputPath);
    
    // Adicionar metadados
    try {
      webpBuffer = await addStickerMetadata(webpBuffer, packName, author);
    } catch (metadataError) {
      console.warn('⚠️ Usando sticker animado sem metadados:', metadataError.message);
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
    const header = stickerBuffer.slice(12, 16).toString('ascii');
    if (header !== 'VP8X') return false;
    const bin = stickerBuffer.toString('binary');
    return bin.includes('ANIM') || bin.includes('ANMF');
  } catch (e) {
    return false;
  }
}

// Criar sticker a partir de sticker estático
async function createStickerFromSticker(stickerWebpBuffer, m, packName = 'Akira Bot', author = 'Isaac Quarenta') {
  try {
    const result = await addStickerMetadata(stickerWebpBuffer, packName, author);
    return result;
  } catch (e) {
    console.error('Erro em createStickerFromSticker:', e);
    return null;
  }
}

// Criar sticker animado a partir de sticker animado
async function createAnimatedStickerFromAnimatedSticker(animatedWebpBuffer, m, packName = 'Akira Bot', author = 'Isaac Quarenta') {
  try {
    // Tenta apenas injetar EXIF direto
    try {
      const withExif = await addStickerMetadata(animatedWebpBuffer, packName, author);
      return withExif;
    } catch (_) {}
    
    // Fallback: re-encode
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
// FUNÇÃO PARA DOWNLOAD DE ÁUDIO DO YOUTUBE
// ═══════════════════════════════════════════════════════════════════════
async function downloadYTAudio(url) {
  try {
    console.log('🎵 Iniciando download de áudio do YouTube...');
   
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
   
    // YouTubeI.js (API oficial)
    try {
      console.log('📤 Usando YouTubeI.js (API oficial)...');
     
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
      return { error: `Falha ao baixar o áudio. Tente outro vídeo. (${youtubeIError.message})` };
    }
   
  } catch (e) {
    console.error('❌ Erro geral:', e);
    return { error: 'Erro ao processar: ' + e.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// FUNÇÃO PARA TEXT TO SPEECH
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
// FUNÇÕES DE EFEITOS DE ÁUDIO
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
// FUNÇÕES DE SIMULAÇÃO
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
// FUNÇÕES DE MODERAÇÃO ADICIONAIS
// ═══════════════════════════════════════════════════════════════════════
async function simularStatusMensagem(sock, m, foiAtivada, temAudio = false) {
  try {
    const ehGrupo = String(m.key.remoteJid || '').endsWith('@g.us');
   
    if (ehGrupo) {
      try {
        await sock.sendReadReceipt(m.key.remoteJid, m.key.participant, [m.key.id]);
        console.log('✓ [ENTREGUE FORÇADO] Grupo - Marcado como entregue');
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
// NOVOS COMANDOS DE ECONOMIA E JOGOS
// ═══════════════════════════════════════════════════════════════════════

// Sistema Daily
function checkDaily(sender) {
  const daily = loadJSON(JSON_PATHS.daily);
  const user = daily.find(u => u.id === sender);
  if (!user) return null;
  
  const now = Date.now();
  const lastDaily = user.lastDaily || 0;
  const cooldown = 24 * 60 * 60 * 1000; // 24 horas
  
  if (now - lastDaily < cooldown) {
    return { 
      canClaim: false, 
      nextClaim: cooldown - (now - lastDaily),
      lastClaim: lastDaily
    };
  }
  
  return { canClaim: true };
}

function setDaily(sender, amount) {
  const daily = loadJSON(JSON_PATHS.daily);
  const userIndex = daily.findIndex(u => u.id === sender);
  
  if (userIndex !== -1) {
    daily[userIndex].lastDaily = Date.now();
    daily[userIndex].total = (daily[userIndex].total || 0) + amount;
  } else {
    daily.push({
      id: sender,
      lastDaily: Date.now(),
      total: amount,
      streak: 1
    });
  }
  
  saveJSON(JSON_PATHS.daily, daily);
}

// Sistema de Apostas
async function handleApostar(sock, m, args, sender) {
  try {
    const valorAposta = parseInt(args[0]);
    if (!valorAposta || isNaN(valorAposta) || valorAposta <= 0) {
      await sock.sendMessage(m.key.remoteJid, {
        text: '💰 *Como apostar:*\n`#apostar <valor>`\n\nExemplo: `#apostar 1000`\n\n⚠️ Você precisa ter o valor em sua conta.'
      }, { quoted: m });
      return;
    }
    
    const saldoAtual = getKoinUser(sender);
    if (saldoAtual < valorAposta) {
      await sock.sendMessage(m.key.remoteJid, {
        text: `❌ Saldo insuficiente!\n💵 Seu saldo: ${saldoAtual}\n💰 Valor da aposta: ${valorAposta}`
      }, { quoted: m });
      return;
    }
    
    await sock.sendMessage(m.key.remoteJid, {
      text: `🎲 *JOGO DO DADO*\n💰 Aposta: ${valorAposta}\n\nRolando os dados...`
    }, { quoted: m });
    
    // Simular rolagem de dados
    await delay(2000);
    
    const dadoBot = Math.floor(Math.random() * 6) + 1;
    const dadoUser = Math.floor(Math.random() * 6) + 1;
    
    let resultado = '';
    let multiplicador = 0;
    
    if (dadoUser > dadoBot) {
      resultado = '🎉 *VOCÊ GANHOU!*';
      multiplicador = 2; // Ganha o dobro
    } else if (dadoUser < dadoBot) {
      resultado = '😔 *VOCÊ PERDEU!*';
      multiplicador = 0; // Perde tudo
    } else {
      resultado = '🤝 *EMPATE!*';
      multiplicador = 1; // Devolve o valor
    }
    
    const ganho = Math.floor(valorAposta * multiplicador);
    const novoSaldo = multiplicador === 0 ? saldoAtual - valorAposta : saldoAtual - valorAposta + ganho;
    
    setKoinUser(sender, novoSaldo);
    
    const resultadoText = `${resultado}

🎲 *Seu dado:* ${dadoUser}
🤖 *Dado do bot:* ${dadoBot}

💰 *Valor apostado:* ${valorAposta}
💵 ${multiplicador === 2 ? `🎊 Ganhou: ${ganho}` : multiplicador === 1 ? `↩️ Devolvido: ${valorAposta}` : `❌ Perdeu: ${valorAposta}`}

🏦 *Novo saldo:* ${novoSaldo}`;

    await sock.sendMessage(m.key.remoteJid, { text: resultadoText }, { quoted: m });
    
  } catch (e) {
    console.error('Erro no comando apostar:', e);
    await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao processar aposta.' }, { quoted: m });
  }
}

// Sistema Cassino
async function handleCassino(sock, m, args, sender) {
  try {
    const valorAposta = parseInt(args[0]);
    if (!valorAposta || isNaN(valorAposta) || valorAposta <= 0) {
      await sock.sendMessage(m.key.remoteJid, {
        text: '🎰 *Como jogar no cassino:*\n`#cassino <valor>`\n\nExemplo: `#cassino 500`\n\n⚡ Chance de ganhar: 35%\n🎁 Multiplicador: 3x'
      }, { quoted: m });
      return;
    }
    
    const saldoAtual = getKoinUser(sender);
    if (saldoAtual < valorAposta) {
      await sock.sendMessage(m.key.remoteJid, {
        text: `❌ Saldo insuficiente!\n💵 Seu saldo: ${saldoAtual}\n💰 Valor da aposta: ${valorAposta}`
      }, { quoted: m });
      return;
    }
    
    await sock.sendMessage(m.key.remoteJid, {
      text: `🎰 *ROULETTE DO CASSINO*\n💰 Aposta: ${valorAposta}\n\nGirando a roleta...`
    }, { quoted: m });
    
    await delay(3000);
    
    // 35% de chance de ganhar
    const venceu = Math.random() < 0.35;
    
    let resultado = '';
    let ganho = 0;
    
    if (venceu) {
      resultado = '🎉 *JACKPOT!* 🎉';
      ganho = valorAposta * 3; // Ganha 3x
      const novoSaldo = saldoAtual - valorAposta + ganho;
      setKoinUser(sender, novoSaldo);
      
      resultado += `\n\n💰 *Valor apostado:* ${valorAposta}\n🎊 *Ganhou:* ${ganho}\n💵 *Novo saldo:* ${novoSaldo}`;
    } else {
      resultado = '😔 *Você perdeu!*';
      const novoSaldo = saldoAtual - valorAposta;
      setKoinUser(sender, novoSaldo);
      
      resultado += `\n\n💰 *Valor apostado:* ${valorAposta}\n❌ *Perdeu:* ${valorAposta}\n💵 *Novo saldo:* ${novoSaldo}`;
    }
    
    await sock.sendMessage(m.key.remoteJid, { text: resultado }, { quoted: m });
    
  } catch (e) {
    console.error('Erro no comando cassino:', e);
    await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro no cassino.' }, { quoted: m });
  }
}

// Sistema Loteria
async function handleLoteria(sock, m, args, sender) {
  try {
    if (!args.length) {
      await sock.sendMessage(m.key.remoteJid, {
        text: '🎫 *COMO JOGAR NA LOTERIA:*\n`#loteria <número de 1 a 100>`\n\nExemplo: `#loteria 42`\n\n💰 Custo: 100 moedas\n🎁 Prêmio: 10.000 moedas\n🎯 Chance: 1%'
      }, { quoted: m });
      return;
    }
    
    const numeroEscolhido = parseInt(args[0]);
    if (isNaN(numeroEscolhido) || numeroEscolhido < 1 || numeroEscolhido > 100) {
      await sock.sendMessage(m.key.remoteJid, {
        text: '❌ Escolha um número entre 1 e 100!'
      }, { quoted: m });
      return;
    }
    
    const custo = 100;
    const saldoAtual = getKoinUser(sender);
    
    if (saldoAtual < custo) {
      await sock.sendMessage(m.key.remoteJid, {
        text: `❌ Saldo insuficiente!\n💵 Seu saldo: ${saldoAtual}\n💰 Custo do bilhete: ${custo}`
      }, { quoted: m });
      return;
    }
    
    // Cobrar custo
    setKoinUser(sender, saldoAtual - custo);
    
    await sock.sendMessage(m.key.remoteJid, {
      text: `🎫 *LOTERIA AKIRA*\n\n🎯 Seu número: ${numeroEscolhido}\n💰 Custo: ${custo}\n🎁 Prêmio: 10.000\n\nSorteando...`
    }, { quoted: m });
    
    await delay(4000);
    
    // Sorteio (1% de chance)
    const numeroSorteado = Math.floor(Math.random() * 100) + 1;
    const ganhou = numeroEscolhido === numeroSorteado;
    
    let resultado = '';
    if (ganhou) {
      const premio = 10000;
      const novoSaldo = (saldoAtual - custo) + premio;
      setKoinUser(sender, novoSaldo);
      
      resultado = `🎉 *PARABÉNS! VOCÊ GANHOU A LOTERIA!* 🎉\n\n🎯 Número sorteado: ${numeroSorteado}\n🎯 Seu número: ${numeroEscolhido}\n💰 Custo: ${custo}\n🎁 Prêmio: ${premio}\n💵 Novo saldo: ${novoSaldo}\n\n🏆 Você é um sortudo!`;
    } else {
      resultado = `😔 *Não foi desta vez!*\n\n🎯 Número sorteado: ${numeroSorteado}\n🎯 Seu número: ${numeroEscolhido}\n💰 Custo: ${custo}\n💵 Saldo atual: ${saldoAtual - custo}\n\n💪 Tente novamente!`;
    }
    
    await sock.sendMessage(m.key.remoteJid, { text: resultado }, { quoted: m });
    
  } catch (e) {
    console.error('Erro no comando loteria:', e);
    await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro na loteria.' }, { quoted: m });
  }
}

// Sistema Roubar
async function handleRoubar(sock, m, args, sender) {
  try {
    const targetMention = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const target = targetMention || args[0];
    
    if (!target) {
      await sock.sendMessage(m.key.remoteJid, {
        text: '🦹 *COMO ROUBAR:*\n`#roubar @usuário`\n\nExemplo: `#roubar @amigo`\n\n⚠️ Chance de sucesso: 50%\n💰 Rouba até 30% do saldo da vítima\n🚔 Chance de ser pego: 20%'
      }, { quoted: m });
      return;
    }
    
    if (target === sender) {
      await sock.sendMessage(m.key.remoteJid, {
        text: '❌ Você não pode roubar a si mesmo!'
      }, { quoted: m });
      return;
    }
    
    const saldoAtacante = getKoinUser(sender);
    const saldoVitima = getKoinUser(target);
    
    if (saldoVitima === 0) {
      await sock.sendMessage(m.key.remoteJid, {
        text: '❌ Esta pessoa não tem dinheiro para roubar!'
      }, { quoted: m });
      return;
    }
    
    if (saldoAtacante < 100) {
      await sock.sendMessage(m.key.remoteJid, {
        text: `❌ Você precisa de pelo menos 100 moedas para tentar roubar!\n💵 Seu saldo: ${saldoAtacante}`
      }, { quoted: m });
      return;
    }
    
    await sock.sendMessage(m.key.remoteJid, {
      text: `🦹 *TENTATIVA DE ROUBO*\n\n👤 Atacante: @${sender.split('@')[0]}\n🎯 Vítima: @${target.split('@')[0]}\n💰 Saldo vítima: ${saldoVitima}\n\nPreparando o assalto...`
    }, { quoted: m });
    
    await delay(3000);
    
    // 50% de chance de sucesso
    const sucesso = Math.random() < 0.5;
    // 20% de chance de ser pego
    const pego = Math.random() < 0.2;
    
    let resultado = '';
    
    if (sucesso && !pego) {
      // Roubo bem sucedido
      const percentualRoubado = Math.random() * 0.3; // Até 30%
      const valorRoubado = Math.floor(saldoVitima * percentualRoubado);
      
      // Transferir dinheiro
      setKoinUser(sender, saldoAtacante + valorRoubado);
      setKoinUser(target, saldoVitima - valorRoubado);
      
      resultado = `✅ *ROUBO BEM SUCEDIDO!*\n\n🦹 Você roubou ${valorRoubado} moedas de @${target.split('@')[0]}!\n💰 Saldo anterior: ${saldoAtacante}\n💰 Saldo atual: ${saldoAtacante + valorRoubado}\n\n🏃‍♂️ Fuja rápido antes que te peguem!`;
      
    } else if (pego) {
      // Foi pego
      const multa = Math.floor(saldoAtacante * 0.3); // 30% de multa
      setKoinUser(sender, saldoAtacante - multa);
      
      resultado = `🚨 *VOCÊ FOI PEGO!* 🚨\n\n👮 A polícia te pegou em flagrante!\n💰 Multa: ${multa} moedas\n💵 Saldo anterior: ${saldoAtacante}\n💵 Saldo atual: ${saldoAtacante - multa}\n\n⚖️ Mais sorte na próxima vez!`;
      
    } else {
      // Falhou mas não foi pego
      const custoFalha = 50;
      setKoinUser(sender, saldoAtacante - custoFalha);
      
      resultado = `❌ *ROUBO FALHOU!*\n\n🦹 Você foi descoberto e teve que fugir!\n💰 Custo da falha: ${custoFalha} moedas\n💵 Saldo anterior: ${saldoAtacante}\n💵 Saldo atual: ${saldoAtacante - custoFalha}\n\n💪 Tente novamente mais tarde!`;
    }
    
    await sock.sendMessage(m.key.remoteJid, { 
      text: resultado,
      contextInfo: { mentionedJid: [target] }
    }, { quoted: m });
    
  } catch (e) {
    console.error('Erro no comando roubar:', e);
    await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao tentar roubar.' }, { quoted: m });
  }
}

// Sistema Roleta Russa
async function handleRoletaRussa(sock, m, sender) {
  try {
    const saldoAtual = getKoinUser(sender);
    const custo = 500;
    
    if (saldoAtual < custo) {
      await sock.sendMessage(m.key.remoteJid, {
        text: `❌ Você precisa de ${custo} moedas para jogar Roleta Russa!\n💵 Seu saldo: ${saldoAtual}`
      }, { quoted: m });
      return;
    }
    
    await sock.sendMessage(m.key.remoteJid, {
      text: `🔫 *ROLETA RUSSA*\n\n💰 Custo para jogar: ${custo}\n🎯 Chance de morrer: 1/6 (16.67%)\n🎁 Prêmio por sobreviver: ${custo * 5}\n\n⚠️ *AVISO: Este jogo é perigoso!*\nVocê realmente quer jogar?\n\nDigite \`SIM\` para confirmar.`
    }, { quoted: m });
    
    // Aguardar confirmação
    const confirmacao = await new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 15000);
      
      const listener = async (msg) => {
        if (msg.key.remoteJid === m.key.remoteJid && 
            msg.key.participant === sender && 
            msg.message?.conversation?.toUpperCase() === 'SIM') {
          clearTimeout(timeout);
          resolve(true);
        }
      };
      
      // Adicionar listener temporário
      sock.ev.on('messages.upsert', listener);
      setTimeout(() => sock.ev.off('messages.upsert', listener), 15000);
    });
    
    if (!confirmacao) {
      await sock.sendMessage(m.key.remoteJid, {
        text: '⏰ Tempo esgotado! Roleta Russa cancelada.'
      }, { quoted: m });
      return;
    }
    
    // Cobrar custo
    setKoinUser(sender, saldoAtual - custo);
    
    await sock.sendMessage(m.key.remoteJid, {
      text: '🔫 Girando o tambor... *CLICK*'
    }, { quoted: m });
    
    await delay(3000);
    
    // 1 em 6 chance de morrer
    const morreu = Math.floor(Math.random() * 6) === 0;
    
    let resultado = '';
    
    if (morreu) {
      resultado = `💀 *BANG!* 💀\n\n😵 *VOCÊ MORREU!*\n💰 Perdeu: ${custo} moedas\n💵 Saldo atual: ${saldoAtual - custo}\n\n⚰️ Game Over!`;
    } else {
      const premio = custo * 5;
      const novoSaldo = (saldoAtual - custo) + premio;
      setKoinUser(sender, novoSaldo);
      
      resultado = `✅ *CLICK* (vazio)\n\n🎉 *VOCÊ SOBREVIVEU!*\n💰 Custo: ${custo}\n🎁 Prêmio: ${premio}\n💵 Saldo anterior: ${saldoAtual - custo}\n💵 Saldo atual: ${novoSaldo}\n\n🏆 Corajoso!`;
    }
    
    await sock.sendMessage(m.key.remoteJid, { text: resultado }, { quoted: m });
    
  } catch (e) {
    console.error('Erro no comando roletarussa:', e);
    await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro na Roleta Russa.' }, { quoted: m });
  }
}

// ═══════════════════════════════════════════════════════════════════════
// HANDLER DE COMANDOS EXTRAS COMPLETO
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
          
          const packName = 'Akira Bot';
          const author = m.pushName || 'Akira Bot';
          
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
            finalBuffer = await createAnimatedStickerFromAnimatedSticker(stickerBuffer, m, packName, author);
          } else {
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
     
      // === PLAY / YOUTUBE MP3 ===
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
     
      // === STICKER ANIMADO ===
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
          const num = extrairNumeroReal(m); 
          const nm = m.pushName||'Usuário';
          const isOwner = verificarPermissaoDono(num, nm);
          
          if (arg === 'on' || arg === 'off' || arg === 'status') {
            if (!isOwner) { 
              await sock.sendMessage(m.key.remoteJid, { text: '🚫 Dono apenas.' }, { quoted: m }); 
              return true; 
            }
            
            if (arg === 'on') { 
              toggles[gid] = true; 
              saveJSON(JSON_PATHS.leveling, toggles); 
              await sock.sendMessage(m.key.remoteJid, { text: '✅ Level ativado neste grupo.' }, { quoted: m }); 
              return true; 
            }
            
            if (arg === 'off') { 
              toggles[gid] = false; 
              saveJSON(JSON_PATHS.leveling, toggles); 
              await sock.sendMessage(m.key.remoteJid, { text: '🚫 Level desativado neste grupo.' }, { quoted: m }); 
              return true; 
            }
            
            await sock.sendMessage(m.key.remoteJid, { text: `ℹ️ Status do level: ${active ? 'Ativo' : 'Inativo'}` }, { quoted: m });
            return true;
          }
          
          if (!active) { 
            await sock.sendMessage(m.key.remoteJid, { text: '🚫 O sistema de level está desativado neste grupo.' }, { quoted: m }); 
            return true; 
          }
          
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
          
          await sock.sendMessage(m.key.remoteJid, { 
            text: txt, 
            contextInfo: { mentionedJid: [uid] } 
          }, { quoted: m });
          
        } catch (e) { 
          console.error('Erro no comando level:', e);
          await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro no level.' }, { quoted: m }); 
        }
        return true;
     
      // === COMANDO REGISTRAR ===
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
          addATM(senderJid); // Adiciona conta bancária

          const registroText = `✅ *REGISTRO CONCLUÍDO!* ✅
👤 *Nome:* ${nome}
🎂 *Idade:* ${idade} anos
🆔 *Serial:* ${serial}
📅 *Registrado em:* ${time}
🏦 *Saldo inicial:* 1000 moedas
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
     
      // === COMANDO PERFIL ===
      case 'perfil':
      case 'profile':
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
          const saldo = getKoinUser(senderJid);
          const patente = getPatente(level);
          const requiredXp = 5 * Math.pow(level, (5 / 2)) + 50 * level + 100;

          const perfilText = `👤 *PERFIL DO USUÁRIO* 👤
📛 *Nome:* ${nome}
🎂 *Idade:* ${idade} anos
🆔 *Serial:* ${serial}
📅 *Registrado em:* ${time}
🏦 *Saldo:* ${saldo} moedas
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
     
      // === COMANDOS DE ECONOMIA ===
      case 'daily':
      case 'diario':
        try {
          const senderJid = m.key.participant || m.key.remoteJid;
          
          if (!checkRegisteredUser(senderJid)) {
            await sock.sendMessage(m.key.remoteJid, {
              text: '📝 Você precisa estar registrado para usar este comando!\nUse `#registrar Nome|Idade`'
            }, { quoted: m });
            return true;
          }
          
          const dailyCheck = checkDaily(senderJid);
          
          if (dailyCheck && !dailyCheck.canClaim) {
            const horasRestantes = Math.floor(dailyCheck.nextClaim / (1000 * 60 * 60));
            const minutosRestantes = Math.floor((dailyCheck.nextClaim % (1000 * 60 * 60)) / (1000 * 60));
            
            await sock.sendMessage(m.key.remoteJid, {
              text: `⏰ *Você já pegou seu daily hoje!*\n\n⏳ Próximo daily em: ${horasRestantes}h ${minutosRestantes}min\n💵 Volte amanhã para mais moedas!`
            }, { quoted: m });
            return true;
          }
          
          // Valor aleatório entre 500 e 2000
          const valorDaily = Math.floor(Math.random() * 1501) + 500;
          
          // Adicionar ao saldo
          const saldoAtual = getKoinUser(senderJid);
          setKoinUser(senderJid, saldoAtual + valorDaily);
          
          // Registrar daily
          setDaily(senderJid, valorDaily);
          
          await sock.sendMessage(m.key.remoteJid, {
            text: `💰 *DAILY RECEBIDO!* 💰\n\n🎁 Valor: ${valorDaily} moedas\n🏦 Saldo anterior: ${saldoAtual}\n💵 Saldo atual: ${saldoAtual + valorDaily}\n\n⏰ Volte amanhã para mais!`
          }, { quoted: m });
          
        } catch (e) {
          console.error('Erro no comando daily:', e);
          await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao processar daily.' }, { quoted: m });
        }
        return true;
     
      case 'balance':
      case 'saldo':
      case 'money':
        try {
          const senderJid = m.key.participant || m.key.remoteJid;
          
          if (!checkRegisteredUser(senderJid)) {
            await sock.sendMessage(m.key.remoteJid, {
              text: '📝 Você precisa estar registrado para usar este comando!\nUse `#registrar Nome|Idade`'
            }, { quoted: m });
            return true;
          }
          
          const saldo = getKoinUser(senderJid);
          const nome = getRegisterName(senderJid);
          
          await sock.sendMessage(m.key.remoteJid, {
            text: `🏦 *EXTRATO BANCÁRIO* 🏦\n\n👤 Cliente: ${nome}\n💳 Conta: ${senderJid.split('@')[0]}\n💰 Saldo atual: ${saldo} moedas\n\n💸 Use \`#daily\` para receber moedas diárias!\n🎰 Use \`#apostar\` para multiplicar seu dinheiro!`
          }, { quoted: m });
          
        } catch (e) {
          console.error('Erro no comando balance:', e);
          await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao verificar saldo.' }, { quoted: m });
        }
        return true;
     
      // === COMANDOS DE JOGOS ===
      case 'apostar':
        try {
          const senderJid = m.key.participant || m.key.remoteJid;
          
          if (!checkRegisteredUser(senderJid)) {
            await sock.sendMessage(m.key.remoteJid, {
              text: '📝 Você precisa estar registrado para usar este comando!\nUse `#registrar Nome|Idade`'
            }, { quoted: m });
            return true;
          }
          
          await handleApostar(sock, m, args, senderJid);
          
        } catch (e) {
          console.error('Erro no comando apostar:', e);
          await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao processar aposta.' }, { quoted: m });
        }
        return true;
     
      case 'cassino':
        try {
          const senderJid = m.key.participant || m.key.remoteJid;
          
          if (!checkRegisteredUser(senderJid)) {
            await sock.sendMessage(m.key.remoteJid, {
              text: '📝 Você precisa estar registrado para usar este comando!\nUse `#registrar Nome|Idade`'
            }, { quoted: m });
            return true;
          }
          
          await handleCassino(sock, m, args, senderJid);
          
        } catch (e) {
          console.error('Erro no comando cassino:', e);
          await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro no cassino.' }, { quoted: m });
        }
        return true;
     
      case 'loteria':
        try {
          const senderJid = m.key.participant || m.key.remoteJid;
          
          if (!checkRegisteredUser(senderJid)) {
            await sock.sendMessage(m.key.remoteJid, {
              text: '📝 Você precisa estar registrado para usar este comando!\nUse `#registrar Nome|Idade`'
            }, { quoted: m });
            return true;
          }
          
          await handleLoteria(sock, m, args, senderJid);
          
        } catch (e) {
          console.error('Erro no comando loteria:', e);
          await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro na loteria.' }, { quoted: m });
        }
        return true;
     
      case 'roubar':
        try {
          const senderJid = m.key.participant || m.key.remoteJid;
          
          if (!checkRegisteredUser(senderJid)) {
            await sock.sendMessage(m.key.remoteJid, {
              text: '📝 Você precisa estar registrado para usar este comando!\nUse `#registrar Nome|Idade`'
            }, { quoted: m });
            return true;
          }
          
          await handleRoubar(sock, m, args, senderJid);
          
        } catch (e) {
          console.error('Erro no comando roubar:', e);
          await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao tentar roubar.' }, { quoted: m });
        }
        return true;
     
      case 'roletarussa':
      case 'roleta':
        try {
          const senderJid = m.key.participant || m.key.remoteJid;
          
          if (!checkRegisteredUser(senderJid)) {
            await sock.sendMessage(m.key.remoteJid, {
              text: '📝 Você precisa estar registrado para usar este comando!\nUse `#registrar Nome|Idade`'
            }, { quoted: m });
            return true;
          }
          
          await handleRoletaRussa(sock, m, senderJid);
          
        } catch (e) {
          console.error('Erro no comando roletarussa:', e);
          await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro na Roleta Russa.' }, { quoted: m });
        }
        return true;
     
      // === JOGOS SIMPLES ===
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
            await sock.sendMessage(m.key.remoteJid, { 
              text: '📊 Uso: #chance <algo>\nEx.: #chance de chover hoje' 
            }, { quoted: m });
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
            await sock.sendMessage(m.key.remoteJid, { 
              text: '💞 Uso: #ship @pessoa1 @pessoa2' 
            }, { quoted: m });
            return true;
          }
          
          const pct = Math.floor(Math.random()*101);
          const txt = `💞 Compatibilidade entre @${menc[0].split('@')[0]} e @${menc[1].split('@')[0]}: ${pct}%`;
          
          await sock.sendMessage(m.key.remoteJid, { 
            text: txt, 
            contextInfo: { mentionedJid: menc } 
          }, { quoted: m });
          
        } catch (e) {
          await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro no ship.' }, { quoted: m });
        }
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
     
      // === COMANDOS DE GRUPO PARA DONO ===
      case 'setppgc':
        try {
          if (!String(m.key.remoteJid).endsWith('@g.us')) { 
            await sock.sendMessage(m.key.remoteJid, { text: '❌ Só em grupos.' }, { quoted: m }); 
            return true; 
          }
          
          const num = extrairNumeroReal(m); 
          const nm = m.pushName||'Usuário';
          
          if (!verificarPermissaoDono(num, nm)) { 
            await sock.sendMessage(m.key.remoteJid, { text: '🚫 Dono apenas.' }, { quoted: m }); 
            return true; 
          }
          
          const q = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
          const imgMsg = m.message?.imageMessage || q?.imageMessage;
          
          if (!imgMsg) { 
            await sock.sendMessage(m.key.remoteJid, { text: 'Responda a uma imagem.' }, { quoted: m }); 
            return true; 
          }
          
          const buf = await downloadMediaMessage({ imageMessage: imgMsg });
          await sock.updateProfilePicture(m.key.remoteJid, buf);
          
          await sock.sendMessage(m.key.remoteJid, { text: '✅ Foto do grupo atualizada.' }, { quoted: m });
          
        } catch (e) { 
          await sock.sendMessage(m.key.remoteJid, { text: '❌ Falha ao atualizar foto.' }, { quoted: m }); 
        }
        return true;
     
      case 'setnamegp':
      case 'setname':
        try {
          if (!String(m.key.remoteJid).endsWith('@g.us')) { 
            await sock.sendMessage(m.key.remoteJid, { text: '❌ Só em grupos.' }, { quoted: m }); 
            return true; 
          }
          
          const num = extrairNumeroReal(m); 
          const nm = m.pushName||'Usuário';
          
          if (!verificarPermissaoDono(num, nm)) { 
            await sock.sendMessage(m.key.remoteJid, { text: '🚫 Dono apenas.' }, { quoted: m }); 
            return true; 
          }
          
          const newName = args.join(' ').trim();
          
          if (!newName) { 
            await sock.sendMessage(m.key.remoteJid, { text: 'Uso: #setname Novo nome' }, { quoted: m }); 
            return true; 
          }
          
          await sock.groupUpdateSubject(m.key.remoteJid, newName);
          
          await sock.sendMessage(m.key.remoteJid, { text: '✅ Nome do grupo atualizado.' }, { quoted: m });
          
        } catch (e) { 
          await sock.sendMessage(m.key.remoteJid, { text: '❌ Falha ao mudar nome.' }, { quoted: m }); 
        }
        return true;
     
      case 'setdesc':
        try {
          if (!String(m.key.remoteJid).endsWith('@g.us')) { 
            await sock.sendMessage(m.key.remoteJid, { text: '❌ Só em grupos.' }, { quoted: m }); 
            return true; 
          }
          
          const num = extrairNumeroReal(m); 
          const nm = m.pushName||'Usuário';
          
          if (!verificarPermissaoDono(num, nm)) { 
            await sock.sendMessage(m.key.remoteJid, { text: '🚫 Dono apenas.' }, { quoted: m }); 
            return true; 
          }
          
          const newDesc = args.join(' ').trim();
          
          if (!newDesc) { 
            await sock.sendMessage(m.key.remoteJid, { text: 'Uso: #setdesc Nova descrição' }, { quoted: m }); 
            return true; 
          }
          
          await sock.groupUpdateDescription(m.key.remoteJid, newDesc);
          
          await sock.sendMessage(m.key.remoteJid, { text: '✅ Descrição do grupo atualizada.' }, { quoted: m });
          
        } catch (e) { 
          await sock.sendMessage(m.key.remoteJid, { text: '❌ Falha ao mudar descrição.' }, { quoted: m }); 
        }
        return true;
     
      // === PESQUISA ===
      case 'pinterest':
      case 'pin':
      case 'image':
      case 'img':
        try {
          if (!args.length) { 
            await sock.sendMessage(m.key.remoteJid, { 
              text: 'Uso: #pinterest termo [qtd 1-5]' 
            }, { quoted: m }); 
            return true; 
          }
          
          const q = args.join(' ');
          const parts = q.split('|');
          const query = parts[0].trim();
          let cnt = Math.min(Math.max(parseInt(parts[1]||'1',10)||1,1),5);
          
          const url = `https://api.fdci.se/sosmed/rep.php?gambar=${encodeURIComponent(query)}`;
          const res = await axios.get(url, { timeout: 15000 });
          
          const arr = Array.isArray(res.data) ? res.data.slice(0,cnt) : [];
          
          if (!arr.length) { 
            await sock.sendMessage(m.key.remoteJid, { text: 'Nada encontrado.' }, { quoted: m }); 
            return true; 
          }
          
          for (const link of arr) {
            try {
              const img = await axios.get(link, { responseType: 'arraybuffer', timeout: 15000 });
              await sock.sendMessage(m.key.remoteJid, { 
                image: Buffer.from(img.data), 
                caption: `🔎 ${query}` 
              }, { quoted: m });
              
              await delay(400);
            } catch (_) {}
          }
        } catch (e) { 
          await sock.sendMessage(m.key.remoteJid, { text: 'Erro no pinterest.' }, { quoted: m }); 
        }
        return true;
     
      // === TAGALL E HIDETAG ===
      case 'tagall':
        try {
          if (!String(m.key.remoteJid).endsWith('@g.us')) {
            await sock.sendMessage(m.key.remoteJid, { 
              text: '❌ Este comando só funciona em grupos.' 
            }, { quoted: m });
            return true;
          }
          
          const senderNum = extrairNumeroReal(m);
          const senderName = m.pushName || 'Desconhecido';
          const ehDono = verificarPermissaoDono(senderNum, senderName);
          
          if (!ehDono) {
            await sock.sendMessage(m.key.remoteJid, { 
              text: '🚫 Comando restrito ao dono (Isaac Quarenta).' 
            }, { quoted: m });
            return true;
          }
          
          const gm = await sock.groupMetadata(m.key.remoteJid);
          const all = gm.participants.map(p => p.id);
          const msg = args.length ? args.join(' ') : '📢 Atenção a todos!';
          
          await sock.sendMessage(m.key.remoteJid, { 
            text: msg, 
            contextInfo: { mentionedJid: all } 
          }, { quoted: m });
          
        } catch (e) {
          await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro ao mencionar todos.' }, { quoted: m });
        }
        return true;
     
      case 'hidetag':
        try {
          if (!String(m.key.remoteJid).endsWith('@g.us')) {
            await sock.sendMessage(m.key.remoteJid, { 
              text: '❌ Este comando só funciona em grupos.' 
            }, { quoted: m });
            return true;
          }
          
          const senderNum = extrairNumeroReal(m);
          const senderName = m.pushName || 'Desconhecido';
          const ehDono = verificarPermissaoDono(senderNum, senderName);
          
          if (!ehDono) {
            await sock.sendMessage(m.key.remoteJid, { 
              text: '🚫 Comando restrito ao dono (Isaac Quarenta).' 
            }, { quoted: m });
            return true;
          }
          
          const gm = await sock.groupMetadata(m.key.remoteJid);
          const all = gm.participants.map(p => p.id);
          const msg = args.length ? args.join(' ') : '📢';
          
          await sock.sendMessage(m.key.remoteJid, { 
            text: msg, 
            contextInfo: { mentionedJid: all } 
          }, { quoted: m });
          
        } catch (e) {
          await sock.sendMessage(m.key.remoteJid, { text: '❌ Erro no hidetag.' }, { quoted: m });
        }
        return true;
     
      // === HELP/MENU ===
      case 'help':
      case 'menu':
      case 'comandos':
      case 'ajuda':
        const helpText = `🤖 *MENU DE COMANDOS AKIRA V21* 🤖
*📱 PREFIXO:* \`${PREFIXO}\`

*🎨 MÍDIA (Todos):*
\`#sticker\` - Criar sticker de imagem/vídeo
\`#take Nome|Autor\` - Personalizar sticker com metadados
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

*📝 SISTEMA DE REGISTRO:*
\`#registrar Nome|Idade\` - Registrar no sistema
\`#perfil\` - Ver informações do perfil

*💰 SISTEMA DE ECONOMIA:*
\`#daily\` - Receber dinheiro diário (500-2000)
\`#balance\` - Ver seu saldo
\`#roubar @usuário\` - Roubar dinheiro (50% chance)

*🎮 JOGOS E APOSTAS:*
\`#apostar <valor>\` - Jogo do dado (2x multiplicador)
\`#cassino <valor>\` - Roleta do cassino (3x multiplicador, 35% chance)
\`#loteria <número>\` - Loteria (1% chance, prêmio 10.000)
\`#roletarussa\` - Roleta russa (perigoso!)
\`#dado\` - Lançar um dado simples
\`#moeda\` - Cara ou coroa
\`#slot\` - Máquina de slots
\`#chance <algo>\` - Calcular chance
\`#gay\` - Teste de porcentagem
\`#ship @p1 @p2\` - Compatibilidade entre pessoas

*👑 COMANDOS DE DONO (Apenas Isaac Quarenta):*
\`#setnamegp <nome>\` - Mudar nome do grupo
\`#setdesc <descrição>\` - Mudar descrição
\`#setppgc\` - Mudar foto (responder a imagem)
\`#add <número>\` - Adicionar membro ao grupo
\`#remove @membro\` - Remover membro
\`#promote @membro\` - Dar admin
\`#demote @membro\` - Remover admin
\`#mute @usuário\` - Mutar por 5 minutos
\`#desmute @usuário\` - Desmutar
\`#antilink on/off\` - Ativar/desativar anti-link
\`#welcome on|off\` - Ativar/desativar boas-vindas
\`#tagall <mensagem>\` - Mencionar todos
\`#hidetag <mensagem>\` - Mencionar todos silenciosamente
\`#level on|off\` - Ativar/desativar sistema de level
\`#apagar\` - Apagar mensagem (responda a mensagem)

*🔍 PESQUISA:*
\`#pinterest <termo>\` - Buscar imagens no Pinterest
\`#web <termo>\` - Buscar na web

*💬 CONVERSA NORMAL:*
Apenas mencione "Akira" ou responda minhas mensagens para conversar normalmente!

*🎤 RESPOSTA A ÁUDIO:*
- Envie um áudio mencionando "Akira" em grupos
- Em PV, envie qualquer áudio que eu respondo
- Eu transcrevo seu áudio e respondo com minha voz

\`⚠️ COMANDOS DE GRUPO APENAS PARA ISAAC QUARENTA\`

*💚 GITHUB:* https://github.com/isaac-40/akira-js`;

        await sock.sendMessage(m.key.remoteJid, { text: helpText }, { quoted: m });
        return true;
     
      // === COMANDOS ORIGINAIS (MANTIDOS) ===
      case 'add':
      case 'remove':
      case 'ban':
      case 'promote':
      case 'demote':
      case 'mute':
      case 'desmute':
      case 'antilink':
      case 'apagar':
      case 'welcome':
        // Estes comandos já estão implementados na versão original
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
// SISTEMA DE XP AUTOMÁTICO
// ═══════════════════════════════════════════════════════════════════════
async function handleAutoXP(sock, m, ehGrupo, sender) {
  try {
    if (m.key.fromMe) return;
    if (!ehGrupo) return;
    if (cekBannedUser(sender)) return;
    
    const gid = m.key.remoteJid;
    const toggles = loadJSON(JSON_PATHS.leveling) || {};
    if (!toggles[gid]) return;
    
    const rec = getGroupLevelRecord(gid, sender, true);
    const amountXp = Math.floor(Math.random() * (25 - 15 + 1)) + 15;
    rec.xp += amountXp;
    saveGroupLevelRecord(rec);
    
    const requiredXp = getRequiredGroupXp(rec.level);
    if (rec.xp >= requiredXp) {
      rec.level += 1; 
      rec.xp = 0; 
      saveGroupLevelRecord(rec);
      
      const patente = getPatente(rec.level);
      const levelUpText = `🎉 *LEVEL UP!* 🎉
👤 @${sender.split('@')[0]}
📈 você foi elevado ao nível ${rec.level}!
🏅 Nova patente: ${patente}
✨ Parabéns! Continue interagindo para subir mais!`;
      
      await sock.sendMessage(m.key.remoteJid, { 
        text: levelUpText, 
        contextInfo: { mentionedJid: [sender] } 
      }, { quoted: m });
    }
  } catch (e) { 
    console.error('Erro no sistema de XP:', e); 
  }
}

// ═══════════════════════════════════════════════════════════════════════
// SISTEMA DE ECONOMIA
// ═══════════════════════════════════════════════════════════════════════
async function handleEconomy(sock, m, texto, sender) {
  try {
    if (!texto.startsWith(PREFIXO)) return;

    if (cekBannedUser(sender)) return;

    addATM(sender);

    // Ganha moedas por usar comandos
    const amountMoney = Math.floor(Math.random() * (100 - 90 + 1)) + 90;
    addKoinUser(sender, amountMoney);

  } catch (e) {
    console.error('Erro no sistema de economia:', e);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// CONEXÃO PRINCIPAL
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
        console.log('🎰 Sistema de Jogos: Completo');
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
        
        // Unwrap view-once containers
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
            try { 
              await sock.sendMessage(m.key.remoteJid, { 
                text: '⛔ Você atingiu o limite de 300 mensagens/h. Aguarde 1h.' 
              }, { quoted: m }); 
            } catch (_) {}
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
              await sock.sendMessage(groupId, { delete: m.key });
            } catch (e) {
              console.error('Erro ao apagar mensagem de usuário mutado:', e);
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

        if (temAudio && (!ehGrupo || replyInfo)) {
          console.log(`🎤 [ÁUDIO RECEBIDO] de ${nome}. Verificando se deve transcrever...`);
          
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

        // PAYLOAD PARA API COM CONTEXTO SUPER CLARO
        const payloadBase = {
          usuario: nome,
          numero: numeroReal,
          mensagem: textoParaAPI,
          tipo_conversa: ehGrupo ? 'grupo' : 'pv',
          tipo_mensagem: temAudio ? 'audio' : 'texto'
        };
        
        // ADICIONA CONTEXTO DE REPLY
        if (replyInfo) {
          if (replyInfo.ehRespostaAoBot) {
            payloadBase.mensagem_citada = `[MENSAGEM ANTERIOR DA AKIRA: "${replyInfo.textoMensagemCitada}"]`;
          } else {
            payloadBase.mensagem_citada = `[MENSAGEM DE ${replyInfo.quemEscreveuCitacaoNome.toUpperCase()}: "${replyInfo.textoMensagemCitada}"]`;
          }
          
          payloadBase.reply_info = {
            quem_fala_agora_nome: replyInfo.quemFalaAgoraNome,
            quem_fala_agora_numero: replyInfo.quemFalaAgoraNumero,
            texto_mensagem_citada: replyInfo.textoMensagemCitada,
            tipo_midia_citada: replyInfo.tipoMidiaCitada,
            quem_escreveu_citacao_nome: replyInfo.quemEscreveuCitacaoNome,
            quem_escreveu_citacao_numero: replyInfo.quemEscreveuCitacaoNumero,
            reply_to_bot: replyInfo.ehRespostaAoBot,
            mensagem_citada_eh_da_akira: replyInfo.ehRespostaAoBot,
            contexto_claro: replyInfo.contextoClaro
          };
        } else {
          payloadBase.mensagem_citada = '';
          payloadBase.reply_info = null;
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

        // SE A MENSAGEM ORIGINAL FOI ÁUDIO, RESPONDE APENAS COM ÁUDIO
        if (temAudio) {
          console.log('🎤 Convertendo resposta para áudio...');

          const tempoGravacao = Math.min(8000, 500 + (resposta.length * 40));
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
          // SIMULAÇÃO DE DIGITAÇÃO PARA TEXTO
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

    // Handler para welcome/goodbye
    sock.ev.on('group-participants.update', async (event) => {
      try {
        const groupId = event.id;
        const welcomeSettings = loadJSON(JSON_PATHS.welkom) || {};
        
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
    <p>Versão: COMPLETA COM TODAS FUNCIONALIDADES</p>
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
    <p>🎰 Sistema de Jogos: Completo</p>
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
      stickers_personalizados: 'Ativo',
      youtube_download: 'Ativo',
      efeitos_audio: '10 efeitos',
      jogos: 'Completo'
    },
    grupos_com_antilink: Array.from(antiLinkGroups).length,
    usuarios_mutados: mutedUsers.size,
    uptime: process.uptime(),
    version: 'v21_completa'
  });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🌐 Servidor rodando na porta ${PORT}\n`);
});

// Iniciar conexão
conectar();

// Handlers de erro
process.on('unhandledRejection', (err) => console.error('❌ REJECTION:', err));
process.on('uncaughtException', (err) => console.error('❌ EXCEPTION:', err));
