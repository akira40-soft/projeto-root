# Dockerfile — AKIRA V21 ULTIMATE (Janeiro 2025)
# Otimizado para Hugging Face Spaces (CPU básico)

FROM python:3.11-slim

# Variáveis de ambiente
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    LOCAL_LLM_AUTO_DOWNLOAD=true

WORKDIR /akira

# Instala apenas dependências essenciais e ferramentas de build
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        ca-certificates \
        tesseract-ocr \
        tesseract-ocr-por \
        tesseract-ocr-eng \
        libgl1 \
        && rm -rf /var/lib/apt/lists/*

# Copia dependências
COPY requirements.txt .

# Instala dependências Python
RUN pip install --upgrade pip && \
    pip install --no-cache-dir --prefer-binary \
        numpy \
        huggingface_hub \
        -r requirements.txt

# Copia código da aplicação
COPY main.py .
COPY modules/ modules/

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:7860/health || exit 1

# Expõe porta
EXPOSE 7860

# Comando de inicialização
CMD ["gunicorn", "--bind", "0.0.0.0:7860", "--workers", "2", "--threads", "4", "--timeout", "120", "main:app"]

