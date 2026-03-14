"""
Script de setup para instalar dependências e configurar o projeto Akira IA
"""
import subprocess
import sys
import os

def install_dependencies():
    """Instala as dependências do requirements.txt"""
    print("📦 Instalando dependências...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✅ Dependências instaladas com sucesso!")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Erro ao instalar dependências: {e}")
        return False

def check_env_file():
    """Verifica se o arquivo .env existe"""
    if not os.path.exists('.env'):
        print("⚠️  Arquivo .env não encontrado!")
        print("📝 Copie .env.example para .env e configure suas chaves de API:")
        print("   cp .env.example .env")
        return False
    print("✅ Arquivo .env encontrado!")
    return True

def main():
    print("🚀 Configurando Akira IA...\n")
    
    # Instalar dependências
    if not install_dependencies():
        sys.exit(1)
    
    print()
    
    # Verificar .env
    check_env_file()
    
    print("\n✨ Setup concluído!")
    print("\n📖 Próximos passos:")
    print("1. Configure suas chaves de API no arquivo .env")
    print("2. Execute: python main.py")
    print("3. Acesse: http://localhost:5000/health")

if __name__ == "__main__":
    main()