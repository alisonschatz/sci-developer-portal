## 🌐 1. Visão geral

A **API Auth** é o serviço central de autenticação da SCI, responsável por gerar e atualizar o **token JWT** que autoriza o acesso a **todas as APIs da SCI**.

> [!NOTE]
> **O que é o Token JWT?**  
> É uma chave de acesso temporária enviada no cabeçalho das requisições (`Authorization: Bearer <token>`) para autenticar chamadas de forma segura.

> [!TIP]
> **Autenticação Global no Portal:**  
> Ao autenticar nesta página, o portal aplica automaticamente o cabeçalho `Authorization: Bearer <token>` em **todas as APIs do portal**.

---

## 🔏 2. Credenciais de acesso

Para gerar o **Token JWT**, sua aplicação deve enviar as credenciais mapeadas na **tabela de credenciais de acesso** abaixo:

| Parâmetro | Credencial | Função |
| :--- | :--- | :--- |
| **`Username`** | [**Token de Parceiro**](#auth/description/como-obter-o-token-de-parceiro) | Identificar qual **parceiro** está chamando a API |
| **`Password`** | [**Token de Cliente**](#auth/description/como-obter-o-token-de-cliente) | Autorizar o acesso aos dados do **cliente** |

> [!CAUTION]
> **Segurança:** Ambas as credenciais são secretas. Guarde-as em local seguro e nunca as exponha publicamente.

---

### 🔑 Como obter o Token de Parceiro

> Este é o valor do campo **`Username`** na [tabela de credenciais de acesso](#auth/description/2-credenciais-de-acesso) — ele identifica o seu sistema integrador perante a SCI.

> [!TIP]
> **Já é parceiro SCI?**
> Solicite seu token diretamente com a equipe de integrações.

> [!NOTE]
> **Ainda não é parceiro?**
> Cadastre-se como integrador para solicitar a sua chave de acesso:
> 
> <p align="center">
> 
> [![Solicitar Token de Parceiro](https://img.shields.io/badge/PARCEIRO-📩_SOLICITAR_TOKEN_AGORA-38486C?style=for-the-badge&labelColor=91D8F7)](https://visual.sci10.com.br/sistemas-de-gestao/)
> 
> </p>

---

### 🔑 Como obter o Token de Cliente

> Este é o valor do campo **`Password`** na [tabela de credenciais de acesso](#auth/description/2-credenciais-de-acesso) — ele autoriza o acesso aos dados da sua empresa.

O cliente deve gerar esta credencial no **SCI WEB**:

1. **Acessar o menu de tokens:**  
   Acesse o [SCI WEB](https://sciweb.com.br), entre no **Módulo Cliente**, clique no seu nome de usuário localizado no canto superior direito e selecione **"Gerar token API"**.  
   ![Gerar token API](./assets/gerar-token.png)

2. **Iniciar a criação:**  
   Na janela de gerenciamento de tokens, clique no botão **"+ Criar novo token"**.  
   ![Criar novo token](./assets/gerar-token2.png)

3. **Identificar o token:**  
   Defina um nome identificador para o token, como por exemplo *Integração RH*, e clique em **"Continuar"**.  
   ![Nomear o token](./assets/gerar-token3.png)

4. **Copiar e armazenar:**  
   Clique em **"Copiar"** para copiar a chave gerada e salve-a imediatamente em um local seguro.  
   ![Copiar token gerado](./assets/gerar-token4.png)

> [!WARNING]
> **Atenção:** O Token de Cliente é exibido **uma única vez** no momento da criação.

> [!NOTE]
> **Em caso de perda do token:**
> 1. Siga o [**passo 1**](#auth/description/como-obter-o-token-de-cliente) para acessar a janela de gerenciamento de tokens.
> 2. Na coluna **Ações**, clique no ícone **"X"** para excluir a chave antiga.  
>    ![Excluir token gerado](./assets/excluir-token.png)
> 3. Em seguida, siga os [**passos de 2 a 4**](#auth/description/como-obter-o-token-de-cliente) para gerar um novo token.

---

## 🔐 3. Autenticação

A autenticação é dividida em dois fluxos complementares. Escolha a operação adequada para o estado atual da sua aplicação:

| Necessidade da Integração | Autenticação Requerida |
| :--- | :--- |
| [**Gerar JWT**](#auth/description/gerar-jwt)<br>*(Primeiro acesso)* | **Basic Auth** (`Username` + `Password`) |
| [**Atualizar JWT**](#auth/description/atualizar-jwt)<br>*(Renovação de sessão)* | **Bearer Auth** (`Bearer <token_jwt_atual>`) |

### 🔑 Gerar JWT

Efetue o login para emitir um **Token JWT** válido por **1 hora (3.600 segundos)**.

| Item | Detalhe |
| :--- | :--- |
| **Endpoint** | [`POST /api/v1/auth/credencial/login`](#auth/tag/autenticação/POST/api/v1/auth/credencial/login) |
| **Tipo** | HTTP Basic Auth |
| **Credenciais** | `Username:` Token de Parceiro <br> `Password:` Token de Cliente |
| **Validade** | `3600` segundos |
| **Status** | `201 Created` |

#### Exemplo de Resposta JSON (`201 Created`):

```json
{
  "mensagem": "Token gerado com sucesso.",
  "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "validade": 3600
}
```

> [!IMPORTANT]
> **Como utilizar:** Armazene o valor do campo `token` no seu servidor e utilize-a no cabeçalho HTTP de todas as requisições subsequentes:
> `Authorization: Bearer <token>`

> [!NOTE]
> Teste este endpoint pelo menu lateral em [**Gerar token JWT**](#auth/tag/autenticação/POST/api/v1/auth/credencial/login)

---

### 🔑 Atualizar JWT

Estenda o tempo de acesso da sua aplicação sem a necessidade de retransmitir as credenciais secretas primárias (`Token de Parceiro` e `Token de Cliente`). Ao renovar, o novo JWT retornado substitui o anterior e renova a sessão por mais **3.600 segundos (1 hora)**.

| Item | Detalhe |
| :--- | :--- |
| **Endpoint** | [`POST /api/v1/auth/refresh`](#auth/tag/autenticação/POST/api/v1/auth/refresh) |
| **Tipo**| Bearer Auth |
| **Credenciais** | `Bearer <token_jwt_atual>` |
| **Validade** | `3600` segundos |
| **Status** | `200 OK` |

#### Exemplo de Resposta JSON (`200 OK`):

```json
{
  "mensagem": "Token refresh feito com sucesso.",
  "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "validade": 3600
}
```

> [!TIP]
> **Estratégia de Renovação:** Programe sua aplicação para executar a atualização periodicamente antes dos 3.600 segundos expirarem. Isso evita ter que refazer o fluxo de login via Basic Auth.

> [!NOTE]
> Teste este endpoint pelo menu lateral em [**Atualizar token JWT**](#auth/tag/autenticação/POST/api/v1/auth/refresh)