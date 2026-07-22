## 🌐 1. Visão geral

A **API Auth** é o serviço central de autenticação da SCI, responsável por emitir e renovar o token JWT utilizado por **todas as demais APIs da plataforma**.

> [!TIP]
> **Autenticação Global:** Ao autenticar nesta documentação interativa, o portal armazena e aplica automaticamente o cabeçalho `Authorization: Bearer <token>` em todas as demais abas. Não é necessário copiar e colar tokens ao navegar pelo portal.
>
> * **Para autenticar:** Acesse a rota [Gerar JWT](#auth/tag/autenticação/POST/api/v1/auth/credencial/login), selecione a opção **"Gerar JWT"** no painel *Authentication*, informe suas credenciais e clique em **Send**.
> * **Para renovar:** Acesse a rota [Atualizar JWT](#auth/tag/autenticação/POST/api/v1/auth/refresh), selecione a opção **"Atualizar JWT"** no painel *Authentication*, confirme o token atual e clique em **Send**.

---

## 🔐 2. Credenciais de acesso

Para gerar o token JWT, sua aplicação precisará de **duas credenciais distintas**:

| Credencial | Identificação e Emissão |
| :--- | :--- |
| **Token de Parceiro** | Identifica o software/sistema integrador. Emitido pela SCI após a formalização da [parceria com a SCI](https://visual.sci10.com.br/sistemas-de-gestao/). |
| **Token de Cliente** | Identifica a empresa cujos dados serão acessados. Gerado pela própria empresa no [SCI WEB](https://sciweb.com.br/) (**Módulo Cliente**). |

> [!IMPORTANT]
> O Token de Parceiro e o Token de Cliente **não são o token JWT**. Eles funcionam apenas como credenciais primárias para emissão do JWT.

> [!CAUTION]
> **Segurança:** Trate ambas as credenciais como secretas. Nunca as exponha em código front-end, logs ou repositórios públicos.

### 🤝 Token de Parceiro

Solicite a credencial para a equipe de integrações caso sua empresa já seja parceira. Se ainda não possui cadastro, utilize o link:
* **[Solicitar Token de Parceiro (Cadastro de Integrador)](https://visual.sci10.com.br/sistemas-de-gestao/)**

### 🔑 Token de Cliente

A empresa cliente deve gerar esta chave dentro do **SCI WEB**:

1. Faça login no [SCI WEB](https://sciweb.com.br) no **Módulo Cliente**.
2. Clique no seu nome de usuário (canto superior direito) e selecione **"Gerar token API"**.
3. Clique em **"+ Criar novo token"**, defina um nome identificador (ex: *Integração RH*) e confirme.
4. Copie o token exibido e salve-o em local seguro.

> [!WARNING]
> O Token de Cliente é exibido **uma única vez**. Em caso de perda, acesse o SCI WEB, revogue a chave antiga e gere uma nova.

---

## ⚡ 3. Autenticação

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

### 🔄 Atualizar JWT

Estenda o tempo de acesso da sua aplicação sem a necessidade de retransmitir as credenciais secretas primárias (`Token de Parceiro` e `Token de Cliente`). Ao renovar, o novo JWT retornado substitui o anterior e renova a sessão por mais **3.600 segundos (1 hora)**.

| Item | Detalhe |
| :--- | :--- |
| **Endpoint** | [`POST /api/v1/auth/refresh`](#auth/tag/autenticação/POST/api/v1/auth/refresh) |
| **Tipo**| Bearer Auth |
| **Conteúdo** | (`Authorization: Bearer <token_atual>`) |
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