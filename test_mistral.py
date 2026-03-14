import os
import requests
from dotenv import load_dotenv

def test_mistral():
    print("--- Teste de Ambiente AKIRA ---")
    
    # 1. Testar carregamento do .env
    dotenv_path = os.path.join(os.getcwd(), ".env")
    if os.path.exists(dotenv_path):
        load_dotenv(dotenv_path)
        print(f"✅ Arquivo .env encontrado em: {dotenv_path}")
    else:
        print("❌ Arquivo .env NÃO encontrado no diretório atual.")
        return

    mistral_key = os.getenv("MISTRAL_API_KEY")
    if not mistral_key or mistral_key == "sua_chave_aqui":
        print("❌ MISTRAL_API_KEY não configurada corretamente no .env")
        return
    else:
        print(f"✅ MISTRAL_API_KEY carregada (Início: {mistral_key[:5]}...)")

    # 2. Testar chamada real para a Mistral
    print("\n--- Testando API Mistral ---")
    url = "https://api.mistral.ai/v1/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {mistral_key}"
    }
    data = {
        "model": "mistral-tiny",
        "messages": [{"role": "user", "content": "Oi, você está funcionando? Responda curto."}],
        "max_tokens": 50
    }

    try:
        response = requests.post(url, headers=headers, json=data, timeout=10)
        if response.status_code == 200:
            result = response.json()
            message = result['choices'][0]['message']['content']
            print(f"✅ API Mistral respondendo com sucesso!")
            print(f"💬 Resposta: {message}")
        else:
            print(f"❌ Erro na API Mistral: Status {response.status_code}")
            print(f"🔍 Detalhes: {response.text}")
    except Exception as e:
        print(f"❌ Erro ao conectar com API Mistral: {e}")

if __name__ == "__main__":
    test_mistral()
