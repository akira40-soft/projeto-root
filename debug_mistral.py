import os
from pathlib import Path

def debug_mistral_key():
    print("--- Debug Detalhado Mistral Key ---")
    # Tenta ler do environment primeiro
    key = os.getenv("MISTRAL_API_KEY", "")
    
    if not key:
        # Tenta ler do .env manualmente para ver o que tem lá
        env_path = Path(".env")
        if env_path.exists():
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip().startswith("MISTRAL_API_KEY="):
                        key = line.strip().split("=", 1)[1]
                        print("Encontrada no .env via leitura manual.")
                        break
    
    if not key:
        print("❌ Chave não encontrada em lugar nenhum.")
        return

    print(f"Comprimento da chave: {len(key)}")
    print(f"Primeiros 4 caracteres: {key[:4]}")
    print(f"Últimos 4 caracteres: {key[-4:]}")
    
    # Verifica caracteres invisíveis ou espaços
    if key != key.strip():
        print("⚠️ A chave tem espaços no início ou fim!")
    
    import unicodedata
    print(f"Representação da chave (primeiros 10): {[hex(ord(c)) for c in key[:10]]}")
    
    # Limpeza da chave antes de usar
    clean_key = key.strip().replace('"', '').replace("'", "")
    
    # Teste de conexão simples com modelo ultra-básico
    import requests
    url = "https://api.mistral.ai/v1/models"
    headers = {"Authorization": f"Bearer {clean_key}"}
    
    try:
        print("\nTestando listagem de modelos (Endpoint /v1/models)...")
        res = requests.get(url, headers=headers, timeout=10)
        print(f"Status: {res.status_code}")
        if res.status_code == 200:
            models = res.json().get('data', [])
            print(f"✅ Sucesso! Modelos disponíveis: {[m['id'] for m in models[:5]]}")
        else:
            print(f"❌ Falha: {res.text}")
    except Exception as e:
        print(f"💥 Erro: {e}")

if __name__ == "__main__":
    debug_mistral_key()
