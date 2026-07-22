# Portal do Desenvolvedor — SCI

Portal de documentação das APIs da SCI, renderizado com [Scalar](https://github.com/scalar/scalar) (Vue 3 + Vite). Autentica-se **uma vez** na API de Autenticação e o token JWT vale automaticamente em todas as outras APIs do portal — sem copiar e colar.

## Começando

```bash
npm install
npm run env        # cria/sincroniza o .env — preencha as URLs das APIs
npm run api:sync   # baixa os specs de produção + gera o conteúdo final
npm run dev        # portal local em http://localhost:5173
```

As URLs base das APIs **não ficam no código** — vivem no `.env` local (nunca commitado) e nos secrets do CI, com nomes **derivados do id** de cada API: `AUTH_SERVER_URL`, `RHNETSOCIAL_SERVER_URL` (e o sufixo `_HML` para homologação). A URL do spec OpenAPI é sempre derivada: `<serverUrl>/docs?api-docs.json`.

Sem acesso às APIs? Os testes usam fixtures — copie-as para desenvolver offline:

```bash
cp test/fixtures/openapi-auth.fixture.json src/base/openapi-auth.json
cp test/fixtures/openapi-rhnetsocial.fixture.json src/base/openapi-rhnetsocial.json
npm run build:content && npm run dev
```

## Onde cada coisa mora

```
apis.config.js            ← FONTE ÚNICA DA VERDADE: toda API é declarada aqui
content/<id>/             ← Conteúdo editorial de cada API (o que você mais edita)
  overview.md               A "página inicial" da API (markdown puro)
  tags/*.md                 Um arquivo markdown por tag (frontmatter diz qual)
  operations/*.md           Um arquivo markdown por operação (frontmatter diz qual)
  operations/*.example.json Exemplos de requisição/resposta, pareados pelo nome do .md
  security/*.md             Descrição de cada security scheme (painel de auth)
scripts/                  ← Pipeline (fetch → build) e utilitários — sem CLI de terceiros
src/plugins/              ← Plugin de token (API oficial do Scalar) + sync de storage
src/config/               ← Configuration do Scalar, montada do portal.config.json
public/portal.config.json ← Gerado pelo build: o contrato que o frontend consome
test/                     ← 78 testes (node:test) — tudo puro, sem rede
```

## Como adicionar uma API nova

```bash
npm run api:new -- nova-api "Nova API"
```

O comando faz tudo: cria `content/nova-api/` com os modelos, **insere o bloco no `apis.config.js` sozinho** (validando o manifesto na hora), sincroniza o `.env` com as variáveis novas, e lista exatamente o que falta:

1. Preencher `NOVA_API_SERVER_URL` no `.env` (e como secret no CI, com a linha correspondente no workflow);
2. Rodar `npm run api:sync`;
3. Escrever o conteúdo em `content/nova-api/` (comece pelo `overview.md`).

> [!TIP]
> O `securityScheme: 'auto'` é resolvido pelo build lendo `components.securitySchemes` do spec baixado: exatamente 1 scheme HTTP bearer → usa; 0 ou vários → o build **falha** listando os nomes disponíveis para você fixar explicitamente no manifesto. Ou é automático, ou avisa — nunca "conferir depois".

## Como editar o conteúdo de uma API

Tudo em `content/<id>/`, tudo **markdown puro** — nada de texto dentro de YAML ou JSON:

**Descrever uma tag** — um `.md` em `tags/` (nome de arquivo livre) com um cabeçalho dizendo a qual tag se aplica:

```markdown
---
tag: Feriado
renameTo: Feriados Nacionais e Pontos Facultativos
---

O que esse grupo de endpoints permite fazer, em markdown normal.
```

**Descrever uma operação** — mesmo padrão, em `operations/`:

```markdown
---
operation: GET /api/v1/feriados
summary: Listar feriados
---

Explicação completa da operação, em markdown normal.
```

**Exemplos** — um `.example.json` com o **mesmo nome** do `.md` da operação (requisição) e `.response-<status>.example.json` (resposta por status). Sempre dados sintéticos, nunca reais (LGPD).

**Security scheme** — o texto do painel de Authentication, em `security/`, com frontmatter `scheme:`.

### Referência completa do que é personalizável

| Onde | Campo | Efeito |
| :--- | :--- | :--- |
| `overview.md` frontmatter | `title:` | Renomeia a API no portal |
| | `version:` | Versão exibida |
| `overview.md` corpo | — | Página inicial da API (`info.description`) |
| `tags/*.md` frontmatter | `tag:` **(obrigatório)** | Nome EXATO da tag no spec |
| | `renameTo:` | Renomeia a tag (na lista E em toda operação do grupo) |
| | `hide: true` | Esconde a tag e todas as operações dela |
| `tags/*.md` corpo | — | Descrição da tag |
| `operations/*.md` frontmatter | `operation:` **(obrigatório)** | `"MÉTODO /caminho"` |
| | `summary:` | Título exibido da operação |
| | `hide: true` | Esconde a operação |
| | `deprecated: true` | Marca como descontinuada |
| | `moveToTag:` | Move para outra tag (cria se não existir) |
| | `parameters:` | Mapa `nome-do-parâmetro: descrição` |
| `operations/*.md` corpo | — | Descrição da operação |
| `operations/<nome>.example.json` | — | Exemplo de corpo de requisição |
| `operations/<nome>.response-<status>.example.json` | — | Exemplo de resposta por status |
| `security/*.md` frontmatter | `scheme:` **(obrigatório)** | Nome EXATO do security scheme |
| `security/*.md` corpo | — | Descrição do scheme (painel de auth) |

Regras práticas:

- **Arquivo ausente não altera nada** — o texto original do backend aparece.
- **Arquivos começando com `_` são ignorados** — rascunhos e modelos (cada pasta tem um `_modelo.md` com o formato).
- **Todo campo referencia o nome ORIGINAL do spec** — o `renameTo` é aplicado por último no pipeline.
- **Renomear security scheme não é suportado de propósito** — o nome participa do prefill do token e dos security requirements; o build avisa se você tentar.
- **Erro editorial nunca passa em silêncio** — `npm run build:content` avisa sobre frontmatter faltando, `tag:`/`operation:` inexistente no spec, duplicatas, exemplo órfão e JSON inválido. Leia a saída.
- **Links internos** usam o formato de âncora do Scalar: heading do overview `#<slug-api>/description/<slug-heading>`; operação `#<slug-api>/tag/<slug-tag>/<MÉTODO><caminho>`; outra API `#<slug-api>`. Slug: minúsculo, sem emoji/pontuação, espaços viram hífen. `renameTo` muda o slug da tag — atualize links que apontem para ela.

## Como o token é compartilhado entre as APIs

1. **`src/plugins/sci-token-plugin.js`** — um [ClientPlugin oficial do Scalar](https://guides.scalar.com/scalar/scalar-api-references/plugins) com dois hooks: `responseReceived` captura o JWT de respostas bem-sucedidas da API de Autenticação (campo definido por `tokenResponseField` no manifesto); `beforeRequest` injeta `Authorization: Bearer <token>` nas chamadas às APIs consumidoras — **só** se o header estiver ausente, vazio ou com o placeholder `{{sci_auth_token}}` não resolvido. Um valor digitado manualmente nunca é sobrescrito.
2. **`src/plugins/token-storage.js`** — grava o token na persistência de auth do Scalar (`localStorage`) para o campo aparecer preenchido na próxima ativação de documento (trocar de aba/recarregar), com um guard que reaplica o token por cima do autosave interno do Scalar.

O campo na tela mostra `{{sci_auth_token}}` como texto até a próxima ativação do documento; a **requisição enviada** carrega o token real desde a primeira chamada. No documento de Autenticação, os dois schemes ("Gerar JWT" e "Atualizar JWT") ficam sempre disponíveis no topo; dentro de cada operação, alterna-se manualmente.

## Comandos

```bash
npm run dev                 # servidor local
npm run build               # verify + build:content + vite build (produção)
npm run verify              # valida apis.config.js
npm run env                 # cria/sincroniza .env e .env.example a partir do manifesto
npm run api:new             # scaffold completo de uma API nova
npm run api:sync[:hml]      # fetch + build:content num comando (produção [homologação])
npm run api:fetch[:hml]     # só o fetch (blacklist + x-internal filtrados)
npm run build:content[:hml] # só o build (specs + conteúdo + portal.config.json)
npm run clean               # limpa os arquivos gerados
npm test                    # 78 testes (node:test, sem rede)
```