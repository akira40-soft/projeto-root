import os
import requests
from dotenv import load_dotenv

# Configurações de saída
RESULT_FILE = "mistral_status.txt"

def test_direct_mistral():
    print("Iniciando teste direto Mistral...")
    with open(RESULT_FILE, "w", encoding="utf-8") as f:
        f.write("=== STATUS MISTRAL DIRECT ===\n")
        
        # 1. Carrega .env
        load_dotenv()
        key = os.getenv("MISTRAL_API_KEY")
        
        if not key:
            f.write("❌ MISTRAL_API_KEY não encontrada no .env\n")
            return
            
        f.write(f"🔑 Chave detectada: {key[:5]}...{key[-5:]}\n")
        
        # 2. Faz requisição
        url = "https://api.mistral.ai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "mistral-small-latest",
            "messages": [{"role": "user", "content": "Olá, você é a IA Akira? Responda em uma frase curta."}],
            "max_tokens": 100
        }
        
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=15)
            if response.status_code == 200:
                data = response.json()
                content = data['choices'][0]['message']['content']
                f.write(f"✅ SUCESSO! Mistral respondeu.\n")
                f.write(f"🤖 RESPOSTA: {content}\n")
            else:
                f.write(f"❌ ERRO API: Status {response.status_code}\n")
                f.write(f"🔍 DETALHES: {response.text}\n")
        except Exception as e:
            f.write(f"❌ ERRO CONEXÃO: {str(e)}\n")

if __name__ == "__main__":
    test_direct_mistral()
    print("Teste finalizado.")
