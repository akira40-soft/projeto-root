import os
import requests
import sys
from pathlib import Path

# Tentativa 1: python-dotenv
try:
    from dotenv import load_dotenv
    loaded = load_dotenv()
    print(f"INFO: python-dotenv carregou .env? {'Sim' if loaded else 'Não (arquivo não encontrado ou erro)'}")
except ImportError:
    print("INFO: python-dotenv não instalado. Vou tentar ler .env manualmente.")

# Tentativa 2: Carregamento Manual (Fallback)
def manual_load_env():
    env_path = Path(".env")
    if env_path.exists():
        print(f"INFO: Carregando {env_path.absolute()} manualmente...")
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    os.environ[key.strip()] = value.strip()
        return True
    return False

if not os.getenv("MISTRAL_API_KEY"):
    manual_load_env()

print(f"CWD: {os.getcwd()}")
print(f"Arquivos no CWD: {os.listdir('.')}")

def test_mistral():
    print("\n--- Testando Mistral ---")
    key = os.getenv("MISTRAL_API_KEY", "").strip()
    if not key:
        print("❌ MISTRAL_API_KEY não encontrada no ambiente.")
        return
    
    if (key.startswith('"') and key.endswith('"')) or (key.startswith("'") and key.endswith("'")):
        key = key[1:-1]
        
    print(f"Chave encontrada (prefixo): {key[:6]}...")
    
    url = "https://api.mistral.ai/v1/chat/completions"
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    payload = {
        "model": "mistral-large-latest",
        "messages": [{"role": "user", "content": "Oi"}],
        "max_tokens": 10
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=10)
        if response.status_code == 200:
            print("✅ Mistral OK!")
        else:
            print(f"❌ Mistral erro {response.status_code}: {response.text}")
    except Exception as e:
        print(f"💥 Erro na requisição Mistral: {e}")

def test_gemini():
    print("\n--- Testando Gemini ---")
    key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY", "").strip()
    if not key:
        print("❌ Chave Gemini/Google não encontrada.")
        return
    
    print(f"Chave encontrada (prefixo): {key[:6]}...")
    
    # Teste via endpoint v1 estável
    url = f"https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key={key}"
    payload = {"contents": [{"parts":[{"text": "Oi"}]}]}
    
    try:
        response = requests.post(url, json=payload, timeout=10)
        if response.status_code == 200:
            print("✅ Gemini OK!")
        else:
            print(f"❌ Gemini erro {response.status_code}: {response.text}")
    except Exception as e:
        print(f"💥 Erro na requisição Gemini: {e}")

def test_groq():
    print("\n--- Testando Groq ---")
    key = os.getenv("GROQ_API_KEY", "").strip()
    if not key:
        print("❌ GROQ_API_KEY não encontrada.")
        return
    
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [{"role": "user", "content": "Oi"}],
        "max_tokens": 10
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=10)
        if response.status_code == 200:
            print("✅ Groq OK!")
        else:
            print(f"❌ Groq erro {response.status_code}: {response.text}")
    except Exception as e:
        print(f"💥 Erro na requisição Groq: {e}")

if __name__ == "__main__":
    print(f"Python: {sys.version}")
    test_mistral()
    test_gemini()
    test_groq()
