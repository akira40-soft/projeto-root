# main.py — AKIRA V21 ULTIMATE (Janeiro 2025)
"""
Entry point Flask API para Akira IA V21
- Multi-API com fallback (6 provedores)
- Suporte a .env para secrets
- Otimizado para Hugging Face Spaces
"""
import os
import sys

# === CORREÇÃO: Garante imports funcionam em qualquer estrutura ===
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
APP_ROOT = os.path.dirname(PROJECT_ROOT)  # Para docker/HF Spaces

# Adiciona ambos os paths (projeto e akira/)
for path in [PROJECT_ROOT, APP_ROOT]:
    if path not in sys.path:
        sys.path.insert(0, path)

print(f"Project root: {PROJECT_ROOT}")
print(f"App root: {APP_ROOT}")

# Carregar variáveis de ambiente (.env)
try:
    from dotenv import load_dotenv
    load_dotenv()
    print(".env carregado")
except ImportError:
    print("python-dotenv nao instalado")

from flask import Flask, jsonify
from loguru import logger
import datetime

# === LOGS ===
logger.remove()
logger.add(
    sys.stderr,
    format="<green>{time:HH:mm:ss}</green> | <level>{level}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan> -> <level>{message}</level>",
    colorize=True,
    backtrace=True,
    diagnose=True,
    level="INFO"
)

# === FLASK APP ===
app = Flask(__name__)

# Make app available for Gunicorn
application = app

# === ROTAS BASICAS ===
@app.route("/")
def index():
    """Pagina inicial com status"""
    apis_configuradas = []
    
    if os.getenv("MISTRAL_API_KEY"):
        apis_configuradas.append("Mistral")
    if os.getenv("GEMINI_API_KEY"):
        apis_configuradas.append("Gemini")
    if os.getenv("GROQ_API_KEY"):
        apis_configuradas.append("Groq")
    if os.getenv("COHERE_API_KEY"):
        apis_configuradas.append("Cohere")
    if os.getenv("TOGETHER_API_KEY"):
        apis_configuradas.append("Together")
    # HF não está sendo usado mais
    
    apis_texto = ", ".join(apis_configuradas) if apis_configuradas else "Nenhuma (configure em .env)"
    
    return f'''
    <div style="font-family: Courier New, monospace; text-align: center; margin: 50px; background: #000; color: #0f0; padding: 40px; border: 2px solid #0f0;">
        <h1>AKIRA V21 ULTIMATE ONLINE!</h1>
        <p><strong>Multi-API System com 6 Provedores</strong></p>
        <p><strong>APIs Configuradas:</strong> {apis_texto}</p>
        <p><strong>Endpoint:</strong> POST /api/akira</p>
        <hr style="border-color: #0f0;">
        <p><em>Luanda, Angola — Softedge Corporation</em></p>
    </div>
    ''', 200

@app.route("/health")
def health():
    """Health check para Docker/HF Spaces"""
    return "OK", 200

@app.route("/status")
def status():
    """Status detalhado das APIs"""
    try:
        import modules.config as config
        
        status_info = {
            "timestamp": datetime.datetime.now().isoformat(),
            "versao": "V21 ULTIMATE",
            "apis_disponiveis": [],
        }
        
        if config.MISTRAL_API_KEY:
            status_info["apis_disponiveis"].append("mistral")
        if config.GEMINI_API_KEY:
            status_info["apis_disponiveis"].append("gemini")
        if config.GROQ_API_KEY:
            status_info["apis_disponiveis"].append("groq")
        if config.COHERE_API_KEY:
            status_info["apis_disponiveis"].append("cohere")
        if config.TOGETHER_API_KEY:
            status_info["apis_disponiveis"].append("together")
        # HF não está sendo usado mais
        
        return jsonify(status_info), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# === INTEGRAÇÃO DA API ===
akira_api = None
api_disponivel = False

try:
    # Tenta importar a API
    from modules.api import AkiraAPI, get_blueprint
    
    import modules.config as config

    # API_AVAILABLE está em config.py
    API_AVAILABLE = getattr(config, 'API_AVAILABLE', {})

    if API_AVAILABLE or True:  # Always try if imports succeeded
        logger.info("Modulos importados com sucesso")
        
        if hasattr(config, 'validate_config'):
            config.validate_config()
            logger.info("Config validada")
        
        akira_api = AkiraAPI()
        
        app.register_blueprint(get_blueprint(), url_prefix="/api")
        logger.success("API V21 integrada -> /api/akira")
        
        apis_ok = []
        if config.MISTRAL_API_KEY:
            apis_ok.append("Mistral")
        if config.GEMINI_API_KEY:
            apis_ok.append("Gemini")
        if config.GROQ_API_KEY:
            apis_ok.append("Groq")
        if config.COHERE_API_KEY:
            apis_ok.append("Cohere")
        if config.TOGETHER_API_KEY:
            apis_ok.append("Together")
        # HF não está sendo usado mais
        
        if apis_ok:
            logger.info(f"APIs: {', '.join(apis_ok)}")
        else:
            logger.warning("NENHUMA API CONFIGURADA!")
        
        api_disponivel = True
    else:
        logger.warning("API nao disponivel (erro de import)")
        
except ImportError as e:
    logger.critical(f"ERRO DE IMPORTACAO: {e}")
    import traceback
    logger.critical(traceback.format_exc())
    
except Exception as e:
    logger.critical(f"FALHA: {e}")
    import traceback
    logger.critical(traceback.format_exc())

# === INICIO DO SERVIDOR ===
if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("AKIRA V21 ULTIMATE — SISTEMA MULTI-API")
    logger.info("=" * 60)
    
    host = os.getenv("API_HOST", "0.0.0.0")
    port = int(os.getenv("API_PORT", "7860"))
    
    logger.info(f"Servidor: http://{host}:{port}")
    logger.info("Endpoints: /, /health, /status, /api/akira")
    logger.info("=" * 60)
    
    if os.getenv("PRODUCTION", "false").lower() == "true":
        logger.info("Modo: PRODUCAO (Gunicorn)")
    else:
        logger.info("Modo: DESENVOLVIMENTO")
        app.run(host=host, port=port, debug=False, use_reloader=False)

