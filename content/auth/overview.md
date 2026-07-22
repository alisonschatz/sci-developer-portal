## 🌐 1. Visão geral

A **API Auth** é o serviço central de autenticação da SCI, responsável por gerar e atualizar o **token JWT** que autoriza o acesso a **todas as APIs da SCI**.

> [!NOTE]
> **O que é o Token JWT?**  
> É uma chave de acesso temporária enviada no cabeçalho das requisições (`Authorization: Bearer <token>`) para autenticar chamadas de forma segura.

> [!TIP]
> **Autenticação Global no Portal:**  
> Ao autenticar nesta página, o portal aplica automaticamente o cabeçalho `Authorization: Bearer <token>` em **todas as APIs do portal**.

---

## 🔐 2. Credenciais de acesso

Para gerar o **Token JWT**, sua aplicação deve enviar as credenciais mapeadas nos parâmetros de autenticação conforme a tabela abaixo:

| Parâmetro | Credencial | Papel |
| :--- | :--- | :--- |
| **`Username`** | [**Token de Parceiro**](#auth/description/como-obter-o-token-de-parceiro) | Identificar o sistema integrador. |
| **`Password`** | [**Token de Cliente**](#auth/description/como-obter-o-token-de-cliente) | Autorizar o acesso aos dados da empresa. |

> [!NOTE]
> **Dinâmica das credenciais:** O Token de Parceiro e o Token de Cliente são credenciais primárias usadas para emitir o **Token JWT**, este sim responsável por autenticar as requisições na API.

> [!CAUTION]
> **Segurança:** Ambas as credenciais são secretas. Guarde-as em local seguro e nunca as exponha publicamente.

---

### 🔑 Como obter o Token de Parceiro

>  Este é o valor do campo **`Username`** na [tabela de credenciais de acesso](#auth/description/2-credenciais-de-acesso) — ele identifica o seu sistema integrador perante a SCI.

| Situação da sua empresa | O que fazer |
| :--- | :--- |
| ✅ **Já é parceira SCI** | Solicite o token diretamente à equipe de integrações. |
| 🆕 **Ainda não é parceira** | Cadastre-se como integrador clicando no botão abaixo. |

<p align="center">

[![Solicitar Token de Parceiro](https://img.shields.io/badge/PARCEIRO-📩_SOLICITAR_TOKEN_AGORA-38486C?style=for-the-badge&labelColor=91D8F7)](https://visual.sci10.com.br/sistemas-de-gestao/)

</p>

### 🔑 Como obter o Token de Cliente

>  Este é o valor do campo **`Password`** na [tabela de credenciais de acesso](#auth/description/2-credenciais-de-acesso) — ele autoriza o acesso aos dados da sua empresa.

O cliente deve gerar esta credencial no **SCI WEB**:

1. Acesse o [SCI WEB](https://sciweb.com.br) e entre no **Módulo Cliente**.
2. No canto superior direito, clique no seu nome de usuário e selecione **"Gerar token API"**.
![Gerar token API](/assets/gerar-token.png)
3. Clique em **"+ Criar novo token"**, defina um nome identificador (ex: *Integração RH*) e confirme.
4. Copie o token exibido e salve-o em local seguro.

> [!WARNING]
> O Token de Cliente é exibido **uma única vez**. Em caso de perda, acesse o SCI WEB, revogue a chave antiga e gere uma nova.

---

## 🔐 3. Autenticação

A autenticação valida suas credenciais primárias ou renova a sessão existente para retornar um token JWT válido de acesso.

### 🔑 Gerar JWT

Gere o token de acesso (JWT) enviando o **Token de Parceiro** (no campo *Username*) e o **Token de Cliente** (no campo *Password*) via autenticação HTTP Basic. O token retornado possui **validade de 1 hora (3.600 segundos)**.

| Item | Detalhe |
| :--- | :--- |
| **Endpoint** | [`POST /api/v1/auth/credencial/login`](#auth/tag/autenticação/POST/api/v1/auth/credencial/login) |
| **Tipo**| HTTP Basic Auth |
| **Conteúdo** | `Username:` Token de Parceiro</br>`Password:` Token de Cliente |
| **Validade** | `3600` segundos |
| **Resposta** | Status `201 Created` |

#### Exemplo de Resposta JSON (`201 Created`):

```json
{
  "mensagem": "Token gerado com sucesso.",
  "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "validade": 3600
}
```

> [!IMPORTANT]
> **Uso do Token:** Armazene a string retornada no campo `token` no seu servidor e utilize-a no cabeçalho HTTP de todas as requisições subsequentes:
> `Authorization: Bearer <token>`

> [!NOTE]
> Para testar requisições diretamente pelo portal, consulte as instruções na [Visão geral](#auth/description/1-visão-geral).

---

### 🔑 Atualizar JWT

Estenda o tempo de acesso da sua aplicação sem a necessidade de retransmitir as credenciais secretas primárias (`Token de Parceiro` e `Token de Cliente`). Ao renovar, o novo JWT retornado substitui o anterior e renova a sessão por mais **3.600 segundos (1 hora)**.

| Item | Detalhe |
| :--- | :--- |
| **Endpoint** | [`POST /api/v1/auth/refresh`](#auth/tag/autenticação/POST/api/v1/auth/refresh) |
| **Tipo**| Bearer Auth |
| **Conteúdo** | `Bearer <token_atual>` |
| **Validade** | `3600` segundos |
| **Resposta** | Status `200 OK` |

#### Exemplo de Resposta JSON:

```json
{
  "mensagem": "Token refresh feito com sucesso.",
  "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "validade": 3600
}
```

> [!TIP]
> **Estratégia de Renovação:** Programe sua aplicação para executar o *refresh* periodicamente antes dos 3.600 segundos expirarem. Isso evita ter que refazer o fluxo de login via Basic Auth.

> [!NOTE]
> Para testar requisições diretamente pelo portal, consulte as instruções na [Visão geral](#auth/description/1-visão-geral).