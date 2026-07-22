---
operation: POST /api/v1/auth/refresh
summary: Atualizar token JWT
---

Renova a validade de um token JWT ainda válido, autenticando com o próprio **token atual** (Bearer) em vez de reenviar o Token de Parceiro e o Token de Cliente.

Mais relevante para integrações em produção, que preferem evitar retransmitir credenciais sensíveis a cada renovação — veja [Gerenciamento do token JWT](#auth/description/4-gerenciamento-do-token-jwt) para mais contexto.
