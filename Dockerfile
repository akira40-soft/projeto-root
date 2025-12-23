# ═══════════════════════════════════════════════════════════════════════
# DOCKERFILE — AKIRA BOT V21 (RAILWAY OPTIMIZED)
# SoftEdge Corporation © 2025
# ═══════════════════════════════════════════════════════════════════════

# Base: Node.js 20 Alpine (leve e rápido)
FROM node:20-alpine

# Metadados
LABEL maintainer="Isaac Quarenta <softedgecorporation@gmail.com>"
LABEL description="AKIRA BOT V21 - IA Autônoma 100% Angolana | SoftEdge Corporation"
LABEL version="21.0.0"
LABEL company="SoftEdge Corporation"

# ═══════════════════════════════════════════════════════════════════════
# VARIÁVEIS DE AMBIENTE
# ═══════════════════════════════════════════════════════════════════════
ENV NODE_ENV=production \
    PORT=3000 \
    TZ=Africa/Luanda \
    NPM_CONFIG_LOGLEVEL=error \
    NODE_OPTIONS="--max-old-space-size=512"

# ═══════════════════════════════════════════════════════════════════════
# INSTALAR DEPENDÊNCIAS DO SISTEMA
# ═══════════════════════════════════════════════════════════════════════
RUN apk add --no-cache \
    # Build tools
    python3 \
    make \
    g++ \
    git \
    # FFmpeg (CRÍTICO para áudio/vídeo)
    ffmpeg \
    # Bibliotecas para canvas/imagens
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev \
    librsvg-dev \
    # Utilitários
    curl \
    bash \
    && rm -rf /var/cache/apk/*

# ═══════════════════════════════════════════════════════════════════════
# CRIAR USUÁRIO NÃO-ROOT (SEGURANÇA)
# ═══════════════════════════════════════════════════════════════════════
RUN addgroup -S akira && \
    adduser -S akira -G akira && \
    mkdir -p /home/akira/.npm-global && \
    chown -R akira:akira /home/akira

# ═══════════════════════════════════════════════════════════════════════
# DEFINIR DIRETÓRIO DE TRABALHO
# ═══════════════════════════════════════════════════════════════════════
WORKDIR /app

# ═══════════════════════════════════════════════════════════════════════
# COPIAR PACKAGE FILES
# ═══════════════════════════════════════════════════════════════════════
COPY --chown=akira:akira package*.json ./

# ═══════════════════════════════════════════════════════════════════════
# INSTALAR DEPENDÊNCIAS NODE.JS
# ═══════════════════════════════════════════════════════════════════════
RUN npm install -g npm@latest && \
    npm cache clean --force && \
    npm install --production --no-audit --no-fund && \
    # Limpar cache npm
    npm cache clean --force && \
    # Remover arquivos desnecessários
    find /app/node_modules -type f -name "*.md" -delete && \
    find /app/node_modules -type f -name "*.ts" -delete && \
    find /app/node_modules -type d -name "test" -exec rm -rf {} + 2>/dev/null || true && \
    find /app/node_modules -type d -name "docs" -exec rm -rf {} + 2>/dev/null || true

# ═══════════════════════════════════════════════════════════════════════
# COPIAR CÓDIGO DA APLICAÇÃO
# ═══════════════════════════════════════════════════════════════════════
COPY --chown=akira:akira index.js ./

# ═══════════════════════════════════════════════════════════════════════
# CRIAR ESTRUTURA DE PASTAS
# ═══════════════════════════════════════════════════════════════════════
RUN mkdir -p \
    /app/auth_info_baileys \
    /app/temp \
    /app/database/data \
    /app/database/datauser && \
    chown -R akira:akira /app && \
    chmod -R 755 /app

# ═══════════════════════════════════════════════════════════════════════
# MUDAR PARA USUÁRIO NÃO-ROOT
# ═══════════════════════════════════════════════════════════════════════
USER akira

# ═══════════════════════════════════════════════════════════════════════
# EXPOR PORTA
# ═══════════════════════════════════════════════════════════════════════
EXPOSE 3000

# ═══════════════════════════════════════════════════════════════════════
# HEALTHCHECK (RAILWAY MONITORING)
# ═══════════════════════════════════════════════════════════════════════
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => { \
        if (r.statusCode === 200) { \
            console.log('✅ AKIRA BOT: Healthy'); \
            process.exit(0); \
        } else { \
            console.log('❌ AKIRA BOT: Unhealthy'); \
            process.exit(1); \
        } \
    }).on('error', () => { \
        console.log('❌ AKIRA BOT: Connection failed'); \
        process.exit(1); \
    })"

# ═══════════════════════════════════════════════════════════════════════
# COMANDO DE INICIALIZAÇÃO
# ═══════════════════════════════════════════════════════════════════════
CMD ["node", "index.js"]

# ═══════════════════════════════════════════════════════════════════════
# BUILD INFO (aparecer nos logs)
# ═══════════════════════════════════════════════════════════════════════
RUN echo "═══════════════════════════════════════════════════════════" && \
    echo "🤖 AKIRA BOT V21 - Docker Image Build Completo" && \
    echo "🏢 SoftEdge Corporation © 2025" && \
    echo "👨‍💻 Desenvolvido por: Isaac Quarenta" && \
    echo "🇦🇴 100% Angolano" && \
    echo "═══════════════════════════════════════════════════════════" && \
    node --version && \
    npm --version && \
    ffmpeg -version | head -n 1 && \
    echo "═══════════════════════════════════════════════════════════"
