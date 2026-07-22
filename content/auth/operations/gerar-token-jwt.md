---
operation: POST /api/v1/auth/credencial/login
summary: Gerar token JWT
---

Autentica com o **Token de Parceiro** (`Username`) e o **Token de Cliente** (`Password`) via HTTP Basic e retorna um novo token JWT.

> [!TIP]
> **Sessão Unificada:** O token gerado aqui é aplicado automaticamente nas chamadas às demais APIs do portal. Para detalhes sobre credenciais e boas práticas, consulte a [Visão geral da API](#auth/description/3-autenticação-no-portal).