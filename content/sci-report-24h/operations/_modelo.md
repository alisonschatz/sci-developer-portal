---
operation: GET /api/v1/exemplo
summary: Título curto e claro da operação
# Configurações opcionais de override:
# hide: true                     # Oculta esta operação na documentação
# deprecated: true               # Exibe o selo de operação descontinuada
# moveToTag: NomeDaTag           # Reatribui a operação a outra tag (use o nome exato)
# parameters:                    # Sobrescreve a descrição dos parâmetros por nome
  # inicio: Data inicial no formato AAAA-MM-DD
  # fim: Data final no formato AAAA-MM-DD
---

Descreva aqui os detalhes da operação. O conteúdo do corpo é renderizado como a descrição principal em Markdown.

### Arquivos de Exemplo (Opcional)

Para adicionar exemplos práticos de payloads, crie arquivos na mesma pasta mantendo o mesmo nome base deste `.md`:

- `<nome>.example.json`
  Exemplo de corpo para requisições (body).
- `<nome>.response-<status>.example.json`
  Exemplo de resposta por código HTTP (ex.: `exemplo.response-200.example.json`, `exemplo.response-400.example.json`).

> **Nota de Segurança:** Utilize apenas dados sintéticos (fictícios) nos arquivos de exemplo.