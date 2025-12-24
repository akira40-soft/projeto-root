FROM node:20-slim

ENV NODE_ENV=production PORT=3000

# Instala dependências do sistema
RUN apt-get update && apt-get install -y \
    git curl python3 build-essential \
    libcairo2-dev libpango1.0-dev libjpeg-dev \
    ffmpeg yt-dlp \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copia package files
COPY package*.json ./

# INSTALAÇÃO SIMPLES E GARANTIDA (SEM --production)
RUN npm cache clean --force && \
    npm install @whiskeysockets/baileys@6.7.5 --legacy-peer-deps && \
    npm install --legacy-peer-deps

# Copia código
COPY index.js ./

# Cria diretórios
RUN mkdir -p temp database/data database/datauser auth_info_baileys

# Expõe porta
EXPOSE 3000

# Inicia bot
CMD ["node", "index.js"]
