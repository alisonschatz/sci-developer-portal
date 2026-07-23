---
operation: POST /api/v1/auth/refresh
summary: Atualizar token JWT
---

Renova a sessão estendendo o tempo de acesso por mais **1 hora (3.600 segundos)** a partir do **token JWT atual**, dispensando o reenvio das credenciais (`Username` e `Password`).

| Item | Detalhe |
| :--- | :--- |
| **Tipo de Autenticação** | Bearer Auth |
| **Credencial** | `Bearer <token_jwt_atual>` |
| **Validade do Novo Token** | `3600` segundos (1 hora) |

---

#### 📌 Boas práticas de integração

* **Renovação Antecipada:** Execute a atualização periodicamente antes do término dos 3.600 segundos para manter a conexão ativa sem interrupções.
* **Substituição:** Substitua o JWT antigo pelo novo valor retornado no campo `token`.

> [!TIP]
> **Uso no Portal:** Se a sua sessão de testes expirar, execute esta operação para renovar a chave no portal sem precisar refazer o login via Basic Auth.

---

#### Exemplo de Resposta (`200 OK`)

```json
{
  "mensagem": "Token refresh feito com sucesso.",
  "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "validade": 3600
}