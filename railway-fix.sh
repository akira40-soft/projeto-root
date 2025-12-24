#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════
# AKIRA BOT V21 — SCRIPT DE CORREÇÃO PARA RAILWAY
# Resolve erro: Cannot find module '@whiskeysockets/baileys'
# ═══════════════════════════════════════════════════════════════════════

echo "🚀 AKIRA BOT V21 - Railway Fix Script"
echo "═══════════════════════════════════════════════════════════════"

# ═══════════════════════════════════════════════════════════════════════
# ETAPA 1: Verificação de Ambiente
# ═══════════════════════════════════════════════════════════════════════
echo "📋 Verificando ambiente..."
echo "Node Version: $(node --version)"
echo "NPM Version: $(npm --version)"
echo "Working Directory: $(pwd)"

# ═══════════════════════════════════════════════════════════════════════
# ETAPA 2: Limpeza de Cache
# ═══════════════════════════════════════════════════════════════════════
echo ""
echo "🧹 Limpando cache do NPM..."
npm cache clean --force

# ═══════════════════════════════════════════════════════════════════════
# ETAPA 3: Remove node_modules antigo
# ═══════════════════════════════════════════════════════════════════════
echo ""
echo "🗑️ Removendo node_modules antigo..."
rm -rf node_modules
rm -rf package-lock.json

# ═══════════════════════════════════════════════════════════════════════
# ETAPA 4: Instala dependências com flags especiais
# ═══════════════════════════════════════════════════════════════════════
echo ""
echo "📦 Instalando dependências..."
npm install --production \
            --no-audit \
            --legacy-peer-deps \
            --loglevel verbose

# ═══════════════════════════════════════════════════════════════════════
# ETAPA 5: Rebuild de módulos nativos
# ═══════════════════════════════════════════════════════════════════════
echo ""
echo "🔧 Rebuilding módulos nativos..."
npm rebuild ffmpeg-static --build-from-source || echo "⚠️ ffmpeg-static rebuild falhou (não crítico)"
npm rebuild sharp --build-from-source || echo "⚠️ sharp rebuild falhou (não crítico)"

# ═══════════════════════════════════════════════════════════════════════
# ETAPA 6: Verificação de instalação
# ═══════════════════════════════════════════════════════════════════════
echo ""
echo "🔍 Verificando instalação do Baileys..."

if [ -d "node_modules/@whiskeysockets/baileys" ]; then
    echo "✅ Baileys instalado com sucesso!"
    echo "📁 Conteúdo de @whiskeysockets/baileys:"
    ls -lh node_modules/@whiskeysockets/baileys/ | head -10
else
    echo "❌ ERRO: Baileys NÃO foi instalado!"
    echo "📋 Tentando instalar manualmente..."
    npm install @whiskeysockets/baileys@latest --save --legacy-peer-deps
    
    if [ -d "node_modules/@whiskeysockets/baileys" ]; then
        echo "✅ Instalação manual bem-sucedida!"
    else
        echo "❌ FALHA CRÍTICA: Não foi possível instalar Baileys"
        exit 1
    fi
fi

# ═══════════════════════════════════════════════════════════════════════
# ETAPA 7: Verificação de outros módulos críticos
# ═══════════════════════════════════════════════════════════════════════
echo ""
echo "📦 Verificando módulos críticos..."

CRITICAL_MODULES=(
    "express"
    "axios"
    "pino"
    "qrcode"
    "fluent-ffmpeg"
)

for module in "${CRITICAL_MODULES[@]}"; do
    if [ -d "node_modules/$module" ]; then
        echo "✅ $module - OK"
    else
        echo "❌ $module - AUSENTE (instalando...)"
        npm install "$module" --save --legacy-peer-deps
    fi
done

# ═══════════════════════════════════════════════════════════════════════
# ETAPA 8: Cria diretórios necessários
# ═══════════════════════════════════════════════════════════════════════
echo ""
echo "📁 Criando diretórios necessários..."
mkdir -p temp database/data database/datauser auth_info_baileys

# ═══════════════════════════════════════════════════════════════════════
# ETAPA 9: Teste de sintaxe
# ═══════════════════════════════════════════════════════════════════════
echo ""
echo "🧪 Testando sintaxe do index.js..."
node -c index.js

if [ $? -eq 0 ]; then
    echo "✅ Sintaxe OK!"
else
    echo "❌ ERRO DE SINTAXE no index.js"
    exit 1
fi

# ═══════════════════════════════════════════════════════════════════════
# ETAPA 10: Resumo final
# ═══════════════════════════════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "✅ SCRIPT CONCLUÍDO COM SUCESSO!"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "📊 Estatísticas:"
echo "   - Módulos instalados: $(ls node_modules | wc -l)"
echo "   - Tamanho total: $(du -sh node_modules 2>/dev/null | cut -f1)"
echo ""
echo "🚀 Você pode iniciar o bot com:"
echo "   npm start"
echo ""
