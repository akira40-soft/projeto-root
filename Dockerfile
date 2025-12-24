# Dockerfile — AKIRA BOT V21 (Dezembro 2025)
FROM node:20-alpine

# Variáveis de ambiente
ENV NODE_ENV=production \
    PORT=3000

# Instala dependências do sistema
RUN apk add --no-cache \
    git \
    python3 \
    make \
    g++ \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev \
    ffmpeg

# Cria usuário não-root
RUN addgroup -S app && adduser -S app -G app

# Define diretório de trabalho
WORKDIR /app

# Copia package files
COPY package*.json ./

# Instala dependências
RUN npm install --omit=dev --no-audit --ignore-scripts && \
    npm rebuild ffmpeg-static || true

# Copia código da aplicação
COPY index.js ./

# Cria diretórios necessários
RUN mkdir -p \
    /app/temp \
    /app/database/data \
    /app/database/datauser \
    /app/auth_info_baileys \
    /app/lib \
    /app/banner \
    /app/bin \
    /app/level && \
    chown -R app:app /app

# Muda para usuário não-root
USER app

# Expõe porta
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Comando de inicialização
CMD ["node", "index.js"]
