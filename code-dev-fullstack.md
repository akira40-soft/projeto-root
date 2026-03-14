# Integração do Isolamento de Contexto e Manipulação de Respostas (AKIRA-SOFTEDGE)

## Visão Geral
Este documento descreve *tin-tin por tin-tin* as adaptações realizadas para integrar o sistema de Isolamento de Contexto, Memória de Curto Prazo (STM) e o Tratamento Avançado de Respostas (Reply Context) do projeto `akira-index` no `AKIRA-SOFTEDGE`. Todo o processo foi pensado de forma a manter intocados os algoritmos de **Personalidade** e **Prompt** presentes originalmente no `AKIRA-SOFTEDGE`.

---

## 1. O Problema Resolvido
O sistema anterior do `AKIRA-SOFTEDGE` compartilhava a memória de chamadas contínuas não isolando completamente quem mandava a mensagem (podendo misturar histórico de grupo com histórico privado em alguns escopos). Além disso:
- Respostas curtas que citavam outra mensagem do Bot perdiam contexto facilmente (ex: responder "qual?" para uma mensagem giganta).
- O Payload JSON retornado não coincidia com o que a ponte NodeJS (`index-js2.1`) agora esperava (metadados de quote, etc).

## 2. Ferramentas e Módulos Importados
Para sanar essas limitações, os seguintes módulos independentes foram copiados e inseridos no projeto base (`AKIRA-SOFTEDGE/modules/`):

* `context_isolation.py`: Contém o `ContextIsolationManager`. Cria Hash IDs de conversa combinando `usuario + tipo_conversa + grupo`, permitindo que o mesmo usuário tenha estados mentais (conversas) diferentes dependendo de onde ele está chamando o bot.
* `short_term_memory.py`: Contém a `ShortTermMemoryManager`. Uma lista na memória volátil limitando o cache rotativo a 15 mensagens estritas, evitando estouro de tokens sem danificar a coerência.
* `reply_context_handler.py`: Contém classes que dissecam o Payload de citação de resposta. Define scores e prioridades de atendimento (ex: Pergunta Curta com Reply tem altíssima prioridade).
* `unified_context.py`: Construtor (`UnifiedContextBuilder`) que cola o histórico do banco de dados, o isolamento e a Memória de Curto Prazo em um único Prompt String limpo.

---

## 3. Fluxo Técnico de Implementação

### 3.1. Integração no `api.py`
Foi necessário interceptar e adicionar novos gestores na classe `AkiraAPI`.

**Instanciamento na Inicialização:**
```python
# Em AkiraAPI.__init__
try:
    db_instance = Database(getattr(self.config, 'DB_PATH', 'akira.db'))
except Exception:
    db_instance = None
    
# Injetando construtores lógicos
self.context_manager = ContextIsolationManager(db=db_instance)
self.stm_manager = ShortTermMemoryManager(max_messages=15)
self.unified_builder = UnifiedContextBuilder(
    context_manager=self.context_manager,
    stm_manager=self.stm_manager,
    db_instance=db_instance
)
```

**Rota de Escuta `/akira` e Fluxo de Entrada:**
1. A API recebe o payload contendo o texto, usuário, tipo de conversa, e agora o nó vital: `reply_metadata`.
2. Em vez de injetar o estado de usuário genérico diretamente, chamamos:
   ```python
   conversation_id = self.context_manager.get_conversation_id(
       usuario=usuario,
       conversation_type=tipo_conversa,
       group_id=numero if tipo_conversa == 'grupo' else None
   )
   ```
3. O `conversation_id` cria e acopla a chave única. Em seguida, a inteligência `unified_builder.build_context()` entra em cena para absorver os metadados de reply (texto original, quem o bot está respondendo) junto ao histórico local.

**Mudanças cruciais no Prompt (`_build_prompt`):**
O prompt do `AKIRA-SOFTEDGE` (com suas restrições *STRICT_OVERRIDES* maravilhosas, incluindo o tom `love`) foi preservado. Entretanto, a assinatura agora aceita e acopla a string polida do `unified_context` no meio do payload:
```python
if unified_context and unified_context.formatted_prompt_section:
    strict_override += "\n" + unified_context.formatted_prompt_section + "\n"
```
Com isso, a IA passa a receber o **[CONTEXTO DE REPLY]** e **[HISTÓRICO RECENTE]** unificados logo acima do seu próprio `SYSTEM_PROMPT`.

**Resposta JSON Adequada:**
Por fim, atualizamos o `jsonify()` do Flask para retornar variáveis mandatórias como `is_reply`, `quoted_author` e `context_hint`.

### 3.2. Integração no `contexto.py`
A classe Base `Contexto` precisava ler e compreender as sub-janelas de análise (usadas pelo `reply_context_handler`). Adicionamos novos métodos:
* `obter_historico_expandido(self, limite)`
* `criar_resumo_topicos_conversa(self, historico)`
* E todo o pipeline de extração de reply (como `processar_contexto_reply`). 

Essas funções fazem parseamentos sintáticos manuais baseados em expressões regulares simples, detectando se uma citação abrange `tempo_clima`, `pesquisa` ou `emocao`. 

---

## 4. Variáveis e Estado
* `reply_metadata_robust`: Um dicionário recriado no pipeline de resposta para garantir que nunca enviaremos "Nones" ou "Undefineds" pelo Request da Citação.
* `smart_context_instruction`: Flag em texto bruto. Se a prioridade de uma Citação / Reply for `>= 3` (Significa usualmente: Um reply curto feito diretamente a uma mensagem do bot), adicionamos no fim da string uma ordem extrema: `"⚠️ ATENÇÃO: PERGUNTA CURTA COM REPLY. FOCAR TOTALMENTE NO CONTEXTO DO REPLY CITADO ACIMA!"`

## Conclusão de Facilitação de Debug e Escalabilidade
Ao separar as responsabilidades, se a memória falhar, você sabe que está em `short_term_memory.py`. Se ela enxergar os grupos em privados, você debugará apenas `context_isolation.py`. E se o payload JSON arrebentar o Front, ele ocorre diretamente nos últimos domínios JSON da classe Flask de rotas `api.py`.
O design plug-and-play do `unified_context` permitiu não tocarmos na variável basilar `system_prompt` do Bot, prevenindo as famosas regressões de personalidade.

---

## 5. Fase 2: Construção da Memória de Longo Prazo (RAG Inteligente)
Apenas armazenar o Hit/Miss na memória de curto prazo (STM) não era suficiente para criar um vínculo com o usuário. Desenvolvemos uma injeção Real-Time da memória de BD no prompt:

**Como Funciona no `unified_context.py`:**
- O `UnifiedContextBuilder.build()` agora captura ativamente o contexto consolidado de longo prazo usando as queries de `Database.py`.
- Ele invoca `recuperar_aprendizado_detalhado()` ignorando marcadores técnicos pontuais e exibe apenas Fatualidades (fatos sobre o usuário) e invoca `obter_tom_predominante()`.
- Estes dados são convertidos numa string listada em `[📖 MEMÓRIA DE LONGO PRAZO (BANCO DE DADOS)]` no meio do prompt, acima do STM, ativando uma recuperação contextual de Recuperação baseada em Geração (RAG).

**Refatorações de Segurança em RAG (`contexto.py`):**
A API do `EmotionAnalyzer` gerava crashes (*Object of type None is not callable/has no attribute*) por falta de tipagem estrita no Python. Nós transformamos os try/catches para usar inspeção de métodos dinamicamente (`hasattr(emotion_analyzer, 'analisar')`).  

---

## 6. Prevenção Rígida de Alucinação (Anti Auto-Resposta)
A Akira corria o risco de tratar mensagens citadas em modo *Reply* como se pertencessem a terceiros, mesmo que ela mesma tivesse enviado aquela mensagem (comum em IAs conversacionais em WhatsApp sem flag is_bot explícita do BD).

**Correção Cronológica e de Identidade:**
- **Injeção de Identidade JID:** Quando `reply_to_bot=True` é identificado pelo `api.py`, o prompt agora acorda a Akira violentamente com a String: 
  > `⛔ ALERTA ANTI-ALUCINAÇÃO (AUTO-RESPOSTA): O usuário citou/deu reply NUMA MENSAGEM QUE VOCÊ MESMA, A AKIRA, MANDOU ANTES! Não aja como se a mensagem citada fosse de um terceiro ou atendente! VOCÊ disse aquilo. Complete sua linha de raciocínio ou tire a dúvida da pessoa sobre o que você falou.`
- **Cronologia Real (`api.py`):** Modificamos o injetor de `data_hora`. Ao invés de um estático `DD/MM/YYYY`, ele monta uma estrutura literal humana (ex: *Hoje é Quarta-Feira, 24 de Abril de 2024, e agora são exatamente 16:45.*), facilitando associações temporais naturais nas réplicas do LLM.
