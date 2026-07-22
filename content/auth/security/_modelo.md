---
scheme: NomeExatoDoScheme
---

Arquivos que começam com `_` são ignorados pelo build — este é só um modelo.

O corpo vira a descrição do security scheme — o texto que aparece no
painel de Authentication do portal. O `scheme:` precisa bater EXATAMENTE
com o nome em components.securitySchemes do spec.

Renomear um scheme NÃO é suportado de propósito: o nome participa do
prefill do token (apis.config.js) e dos security requirements de cada
operação — renomear quebraria os dois silenciosamente.
