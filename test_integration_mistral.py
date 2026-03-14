import os
import sys
import json

# Adiciona o diretório atual ao path para importar os módulos
sys.path.append(os.getcwd())

# Tenta carregar config e api
try:
    from modules.config import load_dotenv, validate_config, logger
    from modules.api import AkiraAPI
    CONFIG_OK = True
except Exception as e:
    CONFIG_OK = False
    CONFIG_ERROR = str(e)

OUTPUT_FILE = "mistral_test_results.txt"

def run_test():
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write("=== LOG DE TESTE MISTRAL ===\n")
        
        if not CONFIG_OK:
            f.write(f"❌ Erro ao importar módulos: {CONFIG_ERROR}\n")
            return

        try:
            # 1. Validar config
            warnings = validate_config()
            f.write(f"✅ Configuração validada. Avisos: {warnings}\n")
            
            # 2. Inicializar API
            api = AkiraAPI()
            f.write(f"✅ Provedores ativos: {api.provedores_ativos}\n")
            
            if 'mistral' not in api.provedores_ativos:
                f.write("❌ Mistral não está entre os provedores ativos nos logs da API.\n")
                # Tenta forçar via setup_mistral se necessário, mas AkiraAPI já deveria ter feito
            
            # 3. Testar Resposta
            prompt = "Responda apenas: 'IA_MISTRAL_ONLINE'. Não diga mais nada."
            f.write(f"🚀 Enviando prompt: {prompt}\n")
            
            response_data = api.processar_requisicao(prompt, usuario_id="tester_888")
            
            resposta = response_data.get("resposta", "")
            provedor = response_data.get("provedor", "desconhecido")
            
            f.write(f"✅ Resposta recebida do provedor: {provedor}\n")
            f.write(f"🤖 RESPOSTA: {resposta}\n")
            
            if "IA_MISTRAL_ONLINE" in resposta:
                f.write("\n✨ CONCLUSÃO: MISTRAL ESTÁ FUNCIONANDO PERFEITAMENTE!")
            else:
                f.write("\n⚠️ Resposta recebida, mas não contém a senha esperada. Verifique os logs.")

        except Exception as e:
            f.write(f"❌ Erro crítico no teste: {str(e)}\n")
            import traceback
            f.write(traceback.format_exc())

if __name__ == "__main__":
    run_test()
    print(f"Teste concluído. Resultado em {OUTPUT_FILE}")
