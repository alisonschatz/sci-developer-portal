---
operation: GET /api/v1/exemplo
summary: Título curto da operação
# hide: true                          (esconde a operação da documentação)
# deprecated: true                    (marca como descontinuada)
# moveToTag: Outra Seção              (move pra outra tag — cria se não existir;
#                                     use o nome ORIGINAL da tag destino)
# parameters:                         (descrição por parâmetro, pelo nome)
#   inicio: Data inicial no formato AAAA-MM-DD
#   fim: Data final no formato AAAA-MM-DD
---

Arquivos que começam com `_` são ignorados pelo build — este é só um modelo.

O corpo vira a descrição da operação, em markdown puro.

Arquivos pareados pelo MESMO nome deste `.md` (opcionais):
- `<nome>.example.json`               → exemplo de corpo de REQUISIÇÃO
- `<nome>.response-200.example.json`  → exemplo de RESPOSTA para o status 200
  (qualquer status: .response-201, .response-400, ...)

Sempre dados sintéticos, nunca reais (LGPD).
