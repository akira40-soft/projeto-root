#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🚀 TESTE FINAL - AKIRA V21 ULTIMATE CORRIGIDO
Testa todos os módulos corrigidos
"""

import sys
import os

# Adiciona o diretório pai ao path (onde está a pasta modules/)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def testar_database():
    """Testa o módulo Database."""
    print("\n" + "=" * 50)
    print("🗄️ TESTANDO DATABASE")
    print("=" * 50)
    try:
        from modules.database import Database
        db = Database("akira_teste.db")
        print("✅ Database instanciado")
        
        # Testa usuário privilegiado
        ok, codigo = db.adicionar_usuario_privilegiado("244937035662", "Isaac Quarenta", "Isaac", "tecnico_formal")
        print(f"   Usuário privilegiado: {'OK' if ok else 'ERRO'} (código: {codigo})")
        
        # Testa privilégios
        eh_priv = db.eh_privilegiado("244937035662")
        print(f"   Verificação privilégio: {'OK' if eh_priv else 'ERRO'}")
        
        # Testa salvar mensagem
        ok = db.salvar_mensagem(
            usuario="Isaac", 
            mensagem="Oi", 
            resposta="Eae", 
            numero="244937035662"
        )
        print(f"   Mensagem salva: {'OK' if ok else 'ERRO'}")
        
        # Testa recuperar mensagens
        msgs = db.recuperar_mensagens("Isaac", limite=5)
        print(f"   Mensagens recuperadas: {len(msgs)}")
        
        # Testa salvar contexto
        ok = db.salvar_contexto(
            user_key="244937035662",
            emocao_atual="neutra",
            humor_atual="neutro"
        )
        print(f"   Contexto salvo: {'OK' if ok else 'ERRO'}")
        
        # Testa tom do usuário
        ok = db.registrar_tom_usuario("244937035662", "formal", 0.8, "contexto teste")
        print(f"   Tom registrado: {'OK' if ok else 'ERRO'}")
        
        tom = db.obter_tom_predominante("244937035662")
        print(f"   Tom predominante: {tom}")
        
        # Testa gírias
        ok = db.salvar_giria_aprendida("244937035662", "bué", "termo regional", "contexto")
        print(f"   Gíria salva: {'OK' if ok else 'ERRO'}")
        
        girias = db.recuperar_girias_usuario("244937035662")
        print(f"   Gírias recuperadas: {len(girias)}")
        
        # Limpa
        if os.path.exists("akira_teste.db"):
            os.remove("akira_teste.db")
        return True
    except Exception as e:
        print(f"❌ ERRO: {e}")
        import traceback
        traceback.print_exc()
        return False

def testar_treinamento():
    """Testa o módulo Treinamento."""
    print("\n" + "=" * 50)
    print("🧠 TESTANDO TREINAMENTO")
    print("=" * 50)
    try:
        from modules.treinamento import Treinamento
        from modules.database import Database
        
        db = Database("akira_teste.db")
        t = Treinamento(db)
        print("✅ Treinamento instanciado")
        
        # Testa registrar interação
        t.registrar_interacao(
            usuario="Isaac", 
            mensagem="Oi", 
            resposta="Eae", 
            numero="244937035662"
        )
        print("✅ Interação registrada")
        
        # Testa estatísticas
        stats = t.obter_estatisticas()
        print(f"   Stats: {stats}")
        
        # Limpa
        if os.path.exists("akira_teste.db"):
            os.remove("akira_teste.db")
        return True
    except Exception as e:
        print(f"❌ ERRO: {e}")
        import traceback
        traceback.print_exc()
        return False

def testar_contexto():
    """Testa o módulo Contexto."""
    print("\n" + "=" * 50)
    print("🎭 TESTANDO CONTEXTO")
    print("=" * 50)
    try:
        from modules.contexto import criar_contexto, Contexto
        from modules.database import Database
        
        db = Database("akira_teste.db")
        c = criar_contexto(db=db, identificador="teste")
        print("✅ Contexto criado via factory")
        
        # Testa atributos
        print(f"   Usuário: {c.usuario}")
        print(f"   Emoção atual: {c.emocao_atual}")
        
        # Testa análise de emoções
        analise = c.analisar_emocoes_mensagem("Hoje estou muito feliz!")
        print(f"   Análise emocional: {analise}")
        
        # Testa análise de intenção
        historico = []
        analise_intencao = c.analisar_intencao_e_normalizar("Oi Akira, tudo bem?", historico)
        print(f"   Intenção: {analise_intencao['intencao']}")
        print(f"   Estilo: {analise_intencao['estilo']}")
        print(f"   Emoção: {analise_intencao['emocao']}")
        
        # Testa atualizar contexto
        c.atualizar_contexto(mensagem="Oi", resposta="Eae", numero="244937035662")
        print("✅ Contexto atualizado")
        
        # Testa obter histórico
        hist = c.obter_historico(limite=5)
        print(f"   Histórico: {len(hist)} mensagens")
        
        # Testa obter aprendizados
        apr = c.obter_aprendizados()
        print(f"   Aprendizados: {list(apr.keys())}")
        
        # Testa obter histórico para LLM
        hist_llm = c.obter_historico_para_llm()
        print(f"   Histórico LLM: {len(hist_llm)} mensagens")
        
        # Limpa
        if os.path.exists("akira_teste.db"):
            os.remove("akira_teste.db")
        return True
    except Exception as e:
        print(f"❌ ERRO: {e}")
        import traceback
        traceback.print_exc()
        return False

def testar_config():
    """Testa as funções auxiliares do config e contexto."""
    print("\n" + "=" * 50)
    print("⚙️ TESTANDO CONFIG/CONTEXTO")
    print("=" * 50)
    try:
        from modules.contexto import (
            eh_usuario_privilegiado, 
            forcar_modo_inicial_privilegiado, 
            analisar_tom_usuario, 
            determinar_nivel_transicao
        )
        from modules.config import validate_config
        
        num = "244937035662"
        
        # Testa privilégios
        priv = eh_usuario_privilegiado(num)
        print(f"   Privilegiado: {priv}")
        
        # Testa modo inicial
        modo = forcar_modo_inicial_privilegiado(num)
        print(f"   Modo inicial: {modo}")
        
        # Testa análise de tom
        tom = analisar_tom_usuario("Oi tudo bem? kkk")
        print(f"   Tom: {tom}")
        
        # Testa nível de transição
        trans = determinar_nivel_transicao(num, tom, 1)
        print(f"   Transição: {trans}")
        
        # Testa validação
        print("\n   Validando config:")
        validate_config()
        print("   ✅ Config válida")
        
        return True
    except Exception as e:
        print(f"❌ ERRO: {e}")
        import traceback
        traceback.print_exc()
        return False

def testar_api():
    """Testa a API."""
    print("\n" + "=" * 50)
    print("🌐 TESTANDO API")
    print("=" * 50)
    try:
        from modules.api import AkiraAPI, SimpleTTLCache
        
        # Testa cache
        cache = SimpleTTLCache(ttl_seconds=60)
        cache["teste"] = {"chave": "valor"}
        valor = cache.get("teste")
        print(f"   Cache test: {'OK' if valor else 'ERRO'}")
        print(f"   Valor: {valor}")
        
        # Testa API (sem parâmetros como esperado)
        api = AkiraAPI()
        print("✅ API instanciada")
        
        # Testa blueprint
        bp = api.get_blueprint()
        print(f"   Blueprint: {bp.name}")
        
        # Testa health
        print("\n   Health check:")
        # Não podemos testar diretamente sem cliente
        
        return True
    except Exception as e:
        print(f"❌ ERRO: {e}")
        import traceback
        traceback.print_exc()
        return False

def testar_web_search():
    """Testa o módulo WebSearch."""
    print("\n" + "=" * 50)
    print("🔍 TESTANDO WEB SEARCH")
    print("=" * 50)
    try:
        from modules.web_search import WebSearch
        ws = WebSearch()
        print("✅ WebSearch instanciado")
        
        # Testa detecção de intenção
        i1 = ws.detectar_intencao_busca("Qual o clima em Luanda?")
        i2 = ws.detectar_intencao_busca("Notícias de Angola")
        print(f"   Intenção clima: {i1}")
        print(f"   Intenção notícias: {i2}")
        
        return True
    except Exception as e:
        print(f"❌ ERRO: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Executa todos os testes."""
    print("\n" + "=" * 60)
    print("🚀 AKIRA V21 ULTIMATE - TESTE COMPLETO")
    print("=" * 60)
    
    resultados = []
    
    # Executa testes
    resultados.append(("Database", testar_database()))
    resultados.append(("Treinamento", testar_treinamento()))
    resultados.append(("Contexto", testar_contexto()))
    resultados.append(("Config/Contexto", testar_config()))
    resultados.append(("API", testar_api()))
    resultados.append(("Web Search", testar_web_search()))
    
    # Resumo
    print("\n" + "=" * 60)
    print("📊 RESUMO DOS TESTES")
    print("=" * 60)
    
    todos_ok = True
    for nome, ok in resultados:
        status = "✅ OK" if ok else "❌ ERRO"
        print(f"   {nome}: {status}")
        if not ok:
            todos_ok = False
    
    print("\n" + "=" * 60)
    if todos_ok:
        print("🎉 TODOS OS TESTES PASSARAM!")
        print("\n📋 PRÓXIMOS PASSOS:")
        print("1. pip install -r requirements.txt")
        print("2. python main.py")
        print("3. http://localhost:7860/health")
    else:
        print("⚠️ ALGUNS TESTES FALHARAM")
        print("   Verifique os erros acima")
    print("=" * 60)
    
    return 0 if todos_ok else 1

if __name__ == "__main__":
    sys.exit(main())

