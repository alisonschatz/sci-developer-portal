---
tag: Autenticação
---

Gerenciamento do ciclo de vida do **Token JWT** utilizado para autenticar requisições em **todas as demais APIs do portal**.

| Operação | Finalidade | Tipo de Autenticação |
| :--- | :--- | :--- |
| [**Gerar JWT**](#auth/tag/autenticacao/POST/api/v1/auth/credencial/login) | Emitir novo token JWT | **Basic Auth** (`Username` + `Password`) |
| [**Atualizar JWT**](#auth/tag/autenticacao/POST/api/v1/auth/refresh) | Renovar sessão ativa sem expor credenciais | **Bearer Auth** (`Bearer <token>`) |

> [!TIP]
> **Uso no Portal:**  
> Ao gerar ou atualizar o JWT por este grupo, o portal aplica a nova chave automaticamente no cabeçalho `Authorization` das demais APIs para facilitar seus testes.

> [!NOTE]
> **Como obter credenciais?**  
> Para consultar o seu **Token de Parceiro** ou gerar um **Token de Cliente**, veja a seção de [**Credenciais de acesso**](#auth/description/2-credenciais-de-acesso) na Visão Geral.