---
operation: POST /api/v1/auth/credencial/login
summary: Gerar token JWT
---

Efetua a autenticação inicial utilizando as credenciais secretas para emitir um **Token JWT** com validade de **1 hora (3.600 segundos)**.

| Item | Detalhe |
| :--- | :--- |
| **Tipo de Autenticação** | HTTP Basic Auth |
| **Credenciais** | `Username:` [Token de Parceiro](#auth/description/como-obter-o-token-de-parceiro) <br> `Password:` [Token de Cliente](#auth/description/como-obter-o-token-de-cliente) |
| **Validade da Chave** | `3600` segundos (1 hora) |

---

#### 📌 Como utilizar

1. Envie as credenciais no cabeçalho HTTP usando **Basic Auth**.
2. Armazene o valor retornado no campo `token`.
3. Utilize este token no cabeçalho `Authorization: Bearer <token>` em todas as chamadas às APIs de negócio.

> [!TIP]
> **Uso no Portal:** Ao executar esta operação com sucesso, o portal preenche o JWT automaticamente para uso nas demais APIs.

---

#### Exemplo de Resposta (`201 Created`)

```json
{
  "mensagem": "Token gerado com sucesso.",
  "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "validade": 3600
}