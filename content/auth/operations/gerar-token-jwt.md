---
operation: POST /api/v1/auth/credencial/login
summary: Gerar token JWT
---

Autentica com o **Token de Parceiro** (`Username`) e o **Token de Cliente** (`Password`), via HTTP Basic, e retorna um novo JWT com validade limitada.

O token retornado fica disponível automaticamente nas demais APIs deste portal — não é necessário copiar e colar. Veja [Autenticação no portal](#auth/description/3-autenticação-no-portal) para o passo a passo completo, ou [Gerenciamento do token JWT](#auth/description/4-gerenciamento-do-token-jwt) para a diferença entre esta operação e o endpoint de refresh.
