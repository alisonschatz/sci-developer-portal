## 1. Visão geral da API

A **API Auth** é o serviço central de autenticação da SCI. Ela é responsável por gerar e renovar o token JWT utilizado por **todas as demais APIs disponíveis neste portal**.

> [!TIP]
> **Autenticação única no Portal:** Após gerar o token nesta API, a sua sessão fica ativa e o token é aplicado automaticamente em todas as outras abas. Não é necessário copiar e colar credenciais ao navegar entre os endpoints.

<br />

### 🚀 Fluxo de integração

Para começar a consumir as APIs da SCI, siga esta ordem recomendada:

1. **Obtenha as credenciais:** Veja como adquirir o Token de Parceiro e o Token de Cliente na seção [Credenciais de acesso](#auth/description/2-credenciais-de-acesso).
2. **Gere o token JWT:** Autentique sua sessão de testes na seção [Autenticação no portal](#auth/description/3-autenticação-no-portal).
3. **Explore as APIs:** Navegue pelas demais abas do portal para testar os endpoints de negócio desejados.

---

<br />

## 2. Credenciais de acesso

Para gerar o token JWT, você precisará de **duas credenciais distintas**. Elas combinam a identidade do integrador com a autorização da empresa cliente da SCI:

| Credencial | O que identifica e como obter |
| :--- | :--- |
| **Token de Parceiro** | Identifica o sistema do integrador. Concedido após a aprovação do cadastro de [contrato de parceria com a SCI](https://visual.sci10.com.br/sistemas-de-gestao/). |
| **Token de Cliente** | Identifica a empresa cliente da SCI que terá os dados acessados. Gerado no [SCI WEB](https://sciweb.com.br/) **exclusivamente através do Módulo Cliente**. |

> [!IMPORTANT]
> **Importante:** O Token de Parceiro e o Token de Cliente **não são o token JWT**. Eles são as credenciais usadas para **gerar o JWT** no passo seguinte.

> [!CAUTION]
> **Atenção:** Trate o Token de Parceiro e de Cliente como **credenciais confidenciais**. Nunca os exponha em **front-end, logs ou repositórios públicos**.

<br />

### 🤝 Obter Token de Parceiro

O **Token de Parceiro** é a credencial que identifica a sua empresa na SCI. Ele é emitido pela nossa equipe de integrações assim que a parceria é formalizada.

> [!TIP]
> **Já possui a parceria?** Verifique com a equipe técnica da sua empresa se o token já foi recebido por e-mail ou no processo de onboarding.

#### Ainda não possui a parceria?
Se a sua empresa ainda não é uma parceira cadastrada, solicite a sua credencial no link abaixo:

> [!NOTE]
> **[Solicitar Token de Parceiro (Cadastro de Integrador)](https://visual.sci10.com.br/sistemas-de-gestao/)**

<br />

### 🔑 Obter Token de Cliente

Esta credencial deve ser gerada pela empresa dentro do **Módulo Cliente** no sistema **SCI WEB**:

1. Acesse o [SCI WEB](https://sciweb.com.br) e faça login com a sua conta de empresa (Módulo Cliente).
2. No canto superior direito, clique sobre o seu nome de usuário e selecione **"Gerar token API"**.
3. Na tela *Token de Integração SCI WEB*, clique no botão **"+ Criar novo token"**.
4. Defina um nome identificador (ex: *Integração RH*) e clique em **"Continuar"**.
5. O sistema exibirá o token gerado. Clique em **"Copiar"** e salve-o imediatamente em um local seguro.

> [!WARNING]
> **Atenção:** O Token de Cliente é exibido **uma única vez** no momento da criação. Guarde-o em um local seguro. Em caso de perda, será necessário revogá-lo e gerar um novo.

---

<br />

## 3. Autenticação no portal

Com as duas credenciais em mãos, você pode autenticar a sua sessão diretamente no portal:

1. Selecione a operação de login ([`POST /api/v1/auth/credencial/login`](#auth/tag/autenticação/POST/api/v1/auth/credencial/login)) no menu lateral.
2. No painel **Authentication**, selecione o método **"Gerar JWT"**.
3. Preencha os campos com suas credenciais:
   * **Username:** insira o seu **Token de Parceiro**
   * **Password:** insira o seu **Token de Cliente**
4. Clique em **Send**.

Se as credenciais estiverem corretas, a API retornará o status `201 Created` contendo o campo `token`.

> [!TIP]
> Como descrito na [Visão geral](#auth/description/1-visão-geral-da-api), esse token já vale para as demais APIs do portal.

---

<br />

## 4. Gerenciamento do token JWT

A API Auth disponibiliza dois fluxos distintos para a gestão do token JWT. Escolha a operação adequada para cada etapa da sua integração:

<br />

### 🌟 Gerar JWT

| Campo | Detalhe |
| :--- | :--- |
| **Endpoint** | [`POST /api/v1/auth/credencial/login`](#auth/tag/autenticação/POST/api/v1/auth/credencial/login) |
| **Objetivo** | Iniciar uma nova sessão de acesso. |
| **Requer** | Token de Parceiro + Token de Cliente. |

> [!TIP]
> **Uso no Portal:** Esta é a opção padrão para autenticar seus testes na documentação.

<br />

### ⏳ Atualizar JWT

| Campo | Detalhe |
| :--- | :--- |
| **Endpoint** | [`POST /api/v1/auth/refresh`](#auth/tag/autenticação/POST/api/v1/auth/refresh) |
| **Objetivo** | Renovar o tempo de validade do token atual sem retransmitir credenciais sensíveis. |
| **Requer** | Token JWT atual (ainda válido). |

> [!NOTE]
> **Segurança:** Evite trafegar o Token de Parceiro e o Token de Cliente em chamadas recorrentes. Prefira renovar o acesso via [endpoint de refresh](#auth/tag/autenticação/POST/api/v1/auth/refresh).

---

<br />

## 5. Perguntas frequentes

<br />

<details>
<summary><b>1. Preciso gerar um token diferente para cada API do portal?</b></summary>

> [!NOTE]
> **Resposta:** Não. Ele é único e vale automaticamente para todas as APIs do portal (veja [Autenticação no portal](#auth/description/3-autenticação-no-portal)).

</details>

<details>
<summary><b>2. Qual método devo usar na minha aplicação: Gerar JWT ou Atualizar JWT?</b></summary>

> [!TIP]
> **Resposta:**
> * **Primeiro acesso (ou token expirado):** Use **Gerar JWT** enviando o Token de Parceiro e Token de Cliente.
> * **Renovação contínua em produção:** Use **Atualizar JWT** para renovar a validade periodicamente antes que o token atual expire.

</details>

<details>
<summary><b>3. Perdi o Token de Cliente. Como recuperar?</b></summary>

> [!WARNING]
> **Resposta:** Não é possível recuperá-lo. Acesse o **SCI WEB**, revogue o token antigo e gere um novo (veja [Obter Token de Cliente](#auth/description/obter-token-de-cliente)).

</details>

<details>
<summary><b>4. O que fazer se o token expirar durante meus testes no portal?</b></summary>

> [!TIP]
> **Resposta:** Você não precisa digitar suas credenciais novamente. Acesse a rota de login ([`POST /api/v1/auth/credencial/login`](#auth/tag/autenticação/POST/api/v1/auth/credencial/login)) no menu lateral e clique em **Send** para renovar a sessão do portal.

</details>
