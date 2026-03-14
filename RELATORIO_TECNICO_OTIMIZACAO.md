# Relatório Técnico: Otimização AKIRA AI para Hugging Face Spaces

Este documento descreve detalhadamente a transição técnica do sistema AKIRA de uma execução local pesada para uma arquitetura híbrida focada em Cloud, visando a estabilidade no plano Free do Hugging Face (HF).

## 1. Contexto e Problema
O projeto AKIRA utilizava o `llama-cpp-python` para rodar modelos GGUF (como TinyLlama) localmente. No entanto:
- **Build Timeouts**: A compilação nativa do `llama.cpp` no Docker demorava mais de 30 minutos, excedendo os limites do HF Spaces.
- **Consumo de RAM**: Carregar um modelo na RAM (mesmo 1.1B) em conjunto com o `BART` (Emotion Analyzer) e `BERT` causava instabilidade no limite de 16GB.
- **Alucinações**: O modelo local excessivamente quantizado apresentava respostas inconsistentes.

## 2. Solução Implementada: Arquitetura Cloud-First
A estratégia foi migrar o fallback de "Local Offline" para "Cloud API Fallback".

### 2.1 Alterações no Dockerfile
- **Remoção de Compiladores**: Eliminamos `cmake`, `build-essential`, `libopenblas-dev`.
- **Simplificação do Pip**: Removida a flag `CMAKE_ARGS` e a biblioteca `llama-cpp-python`.
- **Resultado**: O build agora é instantâneo (apenas instala pacotes binários prontos).

### 2.2 Reestruturação do `local_llm.py`
O módulo foi transformado num "Proxy de Emergência":
- **Variáveis Chave**:
  - `_hf_client`: Instância do `InferenceClient` da Hugging Face.
  - `_is_hf_inference_mode`: Flag que indica que o sistema está em modo Cloud.
- **Fluxo Lógico**:
  1. O sistema tenta as APIs principais (Groq, Google, etc.).
  2. Se falharem, o `local_llm.py` é acionado.
  3. Em vez de abrir um ficheiro `.gguf`, ele faz uma chamada rápida ao modelo `TinyLlama-1.1B-Chat-v1.0` através da API de Inferência Gratuita da Hugging Face.
  4. Isso garante **zero uso de RAM local** para o LLM e **zero uso de CPU** para inferência.

### 2.3 Manutenção do Emotion Analyzer
Apesar da remoção do LLM local, mantivemos as dependências `torch` e `transformers` no `requirements.txt` a pedido do utilizador. Isso permite que o modulo de análise emocional (baseado em BART) continue funcionando localmente, já que é um modelo muito menor e crítico para a persona.

## 3. Ferramentas Utilizadas
- **Hugging Face Inference API**: Para o fallback final sem custo de hardware.
- **Docker (Slim Python)**: Para manter a imagem leve.
- **Loguru**: Monitorização em tempo real de falhas nas APIs.

## 4. Benefícios
- **Escalabilidade**: O bot pode crescer sem medo de exceder a RAM.
- **Velocidade**: Sem compilações pesadas no deploy.
- **Estabilidade**: Sem alucinações causadas por falta de recursos locais.

---
**Assinado:** Antigravity AI Engineer | Google Deepmind Team
