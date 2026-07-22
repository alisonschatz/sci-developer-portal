---
operation: POST /api/v1/auth/refresh
summary: Atualizar token JWT
---

Renova o tempo de expiração de uma sessão ativa autenticando-se com o próprio **token JWT atual** (Bearer Auth), dispensando o reenvio das credenciais mestres.

> [!NOTE]
> **Recomendação:** Indicado para renovação contínua de acesso em produção. Entenda as diferenças na seção [Gerenciamento do token JWT](#auth/description/4-gerenciamento-e-boas-práticas-do-token-jwt).