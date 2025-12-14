# 🔧 Guia de Instalação - Akira Bot V21

## 📋 Pré-requisitos

- Node.js v18 ou superior
- FFmpeg instalado
- Windows 10/11 (para este guia)

## 🚀 Instalação Rápida

### 1. Instalar Dependências Node.js

```powershell
cd akira-js
npm install
```

### 2. Instalar FFmpeg (se não tiver)

**Opção A: Via Chocolatey (Recomendado)**
```powershell
# Execute como Administrador
choco install ffmpeg
```

**Opção B: Download Manual**
1. Baixe: https://www.gyan.dev/ffmpeg/builds/
2. Extraia para `C:\ffmpeg`
3. Adicione `C:\ffmpeg\bin` ao PATH do sistema

### 3. Instalar libwebp (webpmux) para Stickers com Metadados

**Opção A: Script Automático (Recomendado)**
```powershell
# Execute como Administrador
powershell -ExecutionPolicy Bypass -File install-webpmux.ps1
```

**Opção B: Instalação Manual**
1. Baixe: https://developers.google.com/speed/webp/download
2. Extraia o arquivo ZIP
3. Copie todos os arquivos `.exe` da pasta `bin` para `C:\Windows\System32`
4. Teste executando: `webpmux -version`

**⚠️ IMPORTANTE:** Mesmo sem webpmux, o bot funcionará normalmente, mas os stickers não terão metadados personalizados (nome do pack e autor).

### 4. Configurar API do Deepgram (STT - Opcional)

O bot já vem com uma chave de API gratuita, mas você pode usar a sua própria:

1. Crie conta em: https://deepgram.com/
2. Copie sua API Key
3. Edite `index.js` e substitua:
```javascript
const DEEPGRAM_API_KEY = 'SUA_CHAVE_AQUI';
```

**Plano Gratuito:** 200 horas/mês de transcrição

## 🎯 Executar o Bot

```powershell
npm start
```

## ✅ Verificar Instalação

Após iniciar o bot, você verá:

```
══════════════════════════════════════════════════════════════════════
✅ AKIRA BOT V21 ONLINE! (COM TODAS FUNCIONALIDADES)
══════════════════════════════════════════════════════════════════════
🤖 Bot JID: ...
📱 Número: ...
🎤 STT: Deepgram API (200h/mês GRATUITO)
🎤 TTS: Google TTS (funcional)
🎨 Stickers personalizados: Com metadados
🎵 Download YouTube: Sistema corrigido
...
```

## 🔍 Solução de Problemas

### Erro: "webpmux não é reconhecido"

**Solução:** Execute o script `install-webpmux.ps1` como administrador ou instale manualmente.

**Alternativa:** O bot funcionará sem webpmux, mas stickers não terão metadados.

### Erro: "ffmpeg não encontrado"

**Solução:** Instale FFmpeg via Chocolatey ou adicione ao PATH manualmente.

### YouTube download falhando

O bot agora usa 3 métodos diferentes:
1. **yt-dlp** (mais confiável)
2. **ytdl-core** (fallback)
3. **play-dl** (fallback final)

Se todos falharem, pode ser bloqueio temporário do YouTube. Aguarde alguns minutos e tente novamente.

## 📚 Comandos Disponíveis

### Stickers
- `#sticker` - Criar sticker (responda imagem/vídeo)
- `#take Nome|Autor` - Personalizar sticker (responda sticker)

### YouTube
- `#play <nome ou link>` - Baixar música
- `#ytmp4 <link>` - Baixar vídeo

### Efeitos de Áudio
- `#nightcore`, `#slow`, `#bass`, `#earrape`, etc.

### Sistema
- `#menu` - Ver todos os comandos
- `#registrar Nome|Idade` - Registrar no sistema
- `#level` - Ver seu nível

## 🔐 Comandos Restritos (Apenas Isaac Quarenta)

- `#add`, `#remove`, `#promote`, `#demote`
- `#mute`, `#desmute`, `#antilink`
- `#clearchat`, `#bc`

## 🌐 Acessar Interface Web

Após iniciar o bot, acesse:
- **Status:** http://localhost:3000
- **QR Code:** http://localhost:3000/qr
- **Health Check:** http://localhost:3000/health

## 📝 Notas Importantes

1. **Primeira execução:** Escaneie o QR code que aparece no terminal ou acesse `/qr`
2. **Permissões:** Alguns comandos requerem que o bot seja admin do grupo
3. **Rate Limit:** Máximo 6 comandos a cada 8 segundos por usuário
4. **Anti-spam:** 3 segundos entre comandos do mesmo usuário

## 🆘 Suporte

Se encontrar problemas:
1. Verifique se todas as dependências estão instaladas
2. Confira os logs no terminal
3. Teste com comandos simples primeiro (#menu)
4. Reinicie o bot se necessário

## 🔄 Atualizar Dependências

```powershell
npm update
```

## 📦 Estrutura de Pastas

```
akira-js/
├── index.js              # Arquivo principal
├── package.json          # Dependências
├── install-webpmux.ps1   # Script de instalação webpmux
├── INSTALACAO.md         # Este arquivo
├── temp/                 # Arquivos temporários
├── database/             # Banco de dados JSON
│   ├── data/            # Configurações de grupos
│   └── datauser/        # Dados de usuários
└── auth_info_baileys/   # Sessão do WhatsApp
```

## ✨ Recursos Principais

- ✅ Sistema de níveis e patentes
- ✅ Sistema de economia
- ✅ Sistema de registro
- ✅ Download de YouTube (3 métodos)
- ✅ Stickers personalizados com metadados
- ✅ 10 efeitos de áudio
- ✅ Transcrição de áudio (STT)
- ✅ Síntese de voz (TTS)
- ✅ Anti-spam e moderação
- ✅ Comandos de grupo (apenas dono)

---

**Versão:** V21 - Completa
**Última atualização:** 2025