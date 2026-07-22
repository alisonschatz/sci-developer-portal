---
tag: NomeExatoDaTag
# renameTo: Novo Nome Exibido        (renomeia a tag no portal — atualiza
#                                     também toda operação do grupo; atenção:
#                                     muda os links âncora #api/tag/<slug>/...)
# hide: true                          (esconde a tag E todas as operações dela)
---

Arquivos que começam com `_` são ignorados pelo build — este é só um modelo.

O corpo (daqui pra baixo do frontmatter) vira a descrição da tag, em
markdown puro. O `tag:` precisa bater EXATAMENTE com o nome no spec do
backend — mesmo quando você usa `renameTo` (todos os campos referenciam
o nome ORIGINAL; o rename é aplicado por último).
