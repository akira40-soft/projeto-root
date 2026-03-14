# Plano de Melhorias AKIRA V21 ULTIMATE

## Objetivo
Implementar melhorias de personalidade e performance conforme solicitado.

---

## 1. CONFIGURAÇÕES DE PERFORMANCE ✅

### 1.1 MAX_TOKENS
- **Atual**: 700 → **Novo**: 1000
- **Status**: ✅ Implementado

### 1.2 MEMORIA_MAX_MENSAGENS
- **Atual**: 20 → **Novo**: 100
- **Status**: ✅ Implementado

### 1.3 MEMORIA_EMOCIONAL_MAX
- **Atual**: 50 → **Novo**: 100 (RAM suficiente disponível)
- **Status**: ✅ Implementado

---

## 2. REGRAS DE PRIMEIRA MENSAGEM (IMERSÃO) ✅

### 2.1 Novos Prompts para Primeira Mensagem
- **Regra**: Se for a primeira mensagem do usuário
- **Resposta**: Apenas 2-3 palavras curtas
- **Exemplos**: "oi", "fala", "sim", "que foi", "é oquê"

### 2.2 Implementação
- Adicionado ao SYSTEM_PROMPT em `modules/config.py`
- Adicionadas flags `primeira_mensagem` em `modules/contexto.py`
- **Status**: ✅ Implementado

---

## 3. RESPOSTAS DINÂMICAS POR TAMANHO ✅

### 3.1 Lógica de Comprimento
| Tamanho da Mensagem | Resposta Akira |
|---------------------|----------------|
| Curta (1-5 palavras) | Curta (1-8 palavras) |
| Média (6-20 palavras) | Média (10-30 palavras) |
| Longa (20+ palavras) | Longa (20-60 palavras) |

### 3.2 Implementação
- Adicionado ao SYSTEM_PROMPT em `modules/config.py`
- **Status**: ✅ Implementado

---

## 4. TRANSIÇÃO GRADUAL DE TOM ✅

### 4.1 Nova Lógica
- **Nível de transição máximo**: 3 → **1** (muito lento)
- **Threshold de transição**: 0.7 → **0.9** (maior limiar)
- **Delay entre mudanças**: Múltiplas mensagens necessárias

### 4.2 Arquivos Modificados
- `modules/config.py`:
  - `NIVEL_TRANSICAO_MAX`: 3 → 1
  - `TRANSICAO_HUMOR_THRESHOLD`: 0.7 → 0.9
- `modules/contexto.py`: `determinar_nivel_transicao()` atualizado
- **Status**: ✅ Implementado

---

## 5. RESUMO DAS MUDANÇAS

### 5.1 constants.py (modules/config.py)
```python
MAX_TOKENS: int = 1000                    # ✅ Mantido em 1000
MEMORIA_MAX_MENSAGENS: int = 100          # ✅ 20 → 100
MEMORIA_EMOCIONAL_MAX: int = 100          # ✅ 50 → 100
NIVEL_TRANSICAO_MAX: int = 1              # ✅ 3 → 1
TRANSICAO_HUMOR_THRESHOLD: float = 0.9    # ✅ 0.7 → 0.9
```

### 5.2 SYSTEM_PROMPT Additions ✅
- Primeira mensagem: respostas de 2-3 palavras
- Respostas dinâmicas baseadas no comprimento da msg do usuário
- Transição de tom muito lenta (mudar gradualmente)

### 5.3 Contexto Changes ✅
- Adicionado flags: `primeira_mensagem`, `tom_anterior`, `contagem_mensagens_tom`
- Função `determinar_nivel_transicao()` atualizada para transição lenta

---

## 6. ORDEM DE IMPLEMENTAÇÃO

1. ✅ Análise e planejamento
2. ✅ Modificar `modules/config.py` (constantes e prompts)
3. ✅ Modificar `modules/contexto.py` (memória e transição)
4. ⬜ Testar as mudanças

---

## 7. ARQUIVOS MODIFICADOS

- `modules/config.py` - Constantes e prompts atualizados
- `modules/contexto.py` - Contexto e memória atualizados

---

## 8. EXEMPLOS DE RESPOSTAS

### Primeira Mensagem
```
Usuário: "oi"
Akira: "oi e aí! 😎"
```

### Resposta Curta
```
Usuário: "bom dia"
Akira: "bom dia! 🎉 tudo bem?"
```

### Resposta Longa
```
Usuário: "Akira, preciso de ajuda com código"
Akira: "Claro mano! Manda o código que a gente olha. Qual linguagem?"
```

---

**Data**: 06/01/2025
**Versão**: 1.0
**Status**: ✅ Implementado

