# Portal do Desenvolvedor — SCI (v2)

Portal de documentação das APIs da SCI, renderizado com [Scalar](https://github.com/scalar/scalar) (Vue 3 + Vite). Autentica-se **uma vez** na API Auth e o token JWT vale automaticamente em todas as outras APIs do portal.

## Começando

```bash
npm install
npm run env             # cria/sincroniza o .env (a partir do .env.example) — preencha as URLs
npm run api:sync        # fetch dos specs de PRODUÇÃO + build do conteúdo, num comando
npm run dev             # portal local em http://localhost:5173
```

As URLs base das APIs **não ficam no código** — vivem no `.env` local (nunca commitado) e nos secrets do CI, com nomes **derivados do id** de cada API: `AUTH_SERVER_URL`, `RHNETSOCIAL_SERVER_URL` (e `_HML` para homologação, quando ativada). A URL do spec continua sempre derivada: `<serverUrl>/docs?api-docs.json`.

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
src/config/               ← Configuration do Scalar, derivada do manifesto
test/                     ← 71 testes (node:test) — tudo puro, sem rede
```

## Como adicionar uma API nova

```bash
npm run api:new -- nova-api "Nova API"
```

Isso cria `content/folha-pagamento/` com os 4 arquivos editoriais e imprime o bloco pronto para colar em `apis.config.js`. Depois: `npm run env:example` → configure o `.env` → `npm run api:sync`. **Nada mais precisa ser tocado** — a config do Scalar, o plugin de token e o CI derivam tudo do manifesto.

> [!IMPORTANT]
> Depois do primeiro fetch, confira o nome real do security scheme em `src/base/openapi-<id>.json` → `components.securitySchemes` e corrija o `securityScheme` no manifesto se for diferente do chutado. Nome errado = preenchimento do token não aparece no painel (o header ainda é corrigido pelo plugin, que casa por URL — mas a experiência fica incoerente).

## Como editar o conteúdo de uma API existente

Tudo em `content/<id>/`, tudo **markdown puro** — nada de escrever texto dentro de YAML ou JSON:

**Descrever uma tag** — crie um `.md` em `tags/` (nome do arquivo é livre) com um cabeçalho de 3 linhas dizendo a qual tag ele se aplica:

```markdown
---
tag: Feriado
---

O que esse grupo de endpoints permite fazer, em markdown normal.
```

**Descrever uma operação** — mesmo padrão, em `operations/`, com `operation:` e `summary:`:

```markdown
---
operation: GET /api/v1/feriados
summary: Listar feriados
---

Explicação completa da operação, em markdown normal.
```

**Adicionar um exemplo de corpo** — crie um `.example.json` com o **mesmo nome** do `.md` da operação (ex.: `listar-feriados.md` + `listar-feriados.example.json`). Para exemplos de **resposta**, use `.response-<status>.example.json` (ex.: `listar-feriados.response-200.example.json`). Sempre dados sintéticos, nunca reais (LGPD).

**Descrever um security scheme** — o texto do painel de Authentication, em `security/`:

```markdown
---
scheme: Gerar JWT
---

Autorização necessária para gerar o token JWT...
```

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
| | `moveToTag:` | Move pra outra tag (cria se não existir) |
| | `parameters:` | Mapa `nome-do-parâmetro: descrição` |
| `operations/*.md` corpo | — | Descrição da operação |
| `operations/<nome>.example.json` | — | Exemplo de corpo de requisição |
| `operations/<nome>.response-<status>.example.json` | — | Exemplo de resposta por status |
| `security/*.md` frontmatter | `scheme:` **(obrigatório)** | Nome EXATO do security scheme |
| `security/*.md` corpo | — | Descrição do scheme (painel de auth) |

Duas regras transversais: **todo campo referencia o nome ORIGINAL do spec** (o `renameTo` é aplicado por último, então `moveToTag`, descrições etc. usam os nomes de antes do rename); e **renomear security scheme não é suportado de propósito** (o nome participa do prefill do token e dos security requirements — renomear quebraria os dois silenciosamente; o build avisa se você tentar).

> [!WARNING]
> `renameTo` muda os **links âncora** da tag (`#api/tag/<slug>/...`) — se o overview ou outra descrição linka operações daquela tag, atualize os links para o slug do nome novo.

Regras práticas:

- **Arquivo ausente não altera nada** — o texto original do backend aparece.
- **Arquivos começando com `_` são ignorados** — use para rascunhos e modelos (cada pasta já vem com um `_modelo.md` mostrando o formato).
- **Erro de digitação não passa em silêncio** — `npm run build:content` avisa sobre frontmatter faltando, `operation:`/`tag:` que não existem no spec, exemplo órfão e JSON inválido. Leia a saída.
- **Links internos** entre seções/operações usam o formato de âncora do Scalar (confirmado no código-fonte deles):
  - Heading do overview: `#<slug-da-api>/description/<slug-do-heading>`
  - Operação: `#<slug-da-api>/tag/<slug-da-tag>/<MÉTODO><caminho>`
  - Outra API: `#<slug-da-api>` (ex.: `#rhnetsocial`)
  - O slug de um heading: minúsculo, sem emoji/pontuação, espaços viram hífen (`## 2. Credenciais de acesso` → `2-credenciais-de-acesso`). Emoji comum some do slug; **emoji de teclado numérico (1️⃣) não** — evite nos títulos.

## Como o token é compartilhado entre as APIs

O requisito central do portal, implementado pela **API oficial de plugins do Scalar** (não por interceptação de fetch, como na v1):

1. **`src/plugins/sci-token-plugin.js`** — um [ClientPlugin](https://guides.scalar.com/scalar/scalar-api-references/plugins) com dois hooks documentados:
   - `responseReceived`: quando uma resposta vem do server da API Auth com sucesso, captura o campo `token` (nome vem de `tokenResponseField` no manifesto).
   - `beforeRequest`: antes de cada envio a uma API consumidora (servers derivados do manifesto), injeta `Authorization: Bearer <token>` — **só** se o header estiver ausente, vazio ou com o placeholder `{{sci_auth_token}}` não resolvido. Um valor digitado manualmente nunca é sobrescrito.
2. **`src/plugins/token-storage.js`** — grava o token capturado na mesma chave de `localStorage` que o Scalar usa para persistir autenticação (`scalar-reference-auth-<slug>`), para o campo aparecer preenchido de verdade na próxima ativação de documento (trocar de aba/recarregar). Inclui um guard no `setItem` que reaplica o token por cima do autosave interno do Scalar (que senão o apagaria), e a autocura do `selected.document` da Auth (os dois schemes sempre disponíveis no topo).

O campo na tela mostra `{{sci_auth_token}}` como texto até a próxima ativação do documento — é assim que templating aparece em clientes estilo Postman; a **requisição enviada** carrega o token real desde a primeira chamada.

Decisão de UX registrada: o topo do documento Auth sempre mostra os dois schemes ("Gerar JWT" e "Atualizar JWT") disponíveis; dentro de cada operação, a pessoa alterna manualmente entre eles. Ver `docs/arquitetura.md` para o porquê (as duas coisas competem pelo mesmo campo interno do Scalar).

## Comandos

```bash
npm run dev             # servidor local
npm run build           # verify + build:content + vite build (produção)
npm run verify          # valida apis.config.js
npm run api:new         # scaffold de uma API nova
npm run env             # cria/sincroniza .env e .env.example a partir do manifesto
npm run api:sync[:hml]  # fetch + build:content num comando (produção [homologação])
npm run api:fetch[:hml] # só o fetch (blacklist + x-internal filtrados)
npm run build:content[:hml] # só o build (specs + conteúdo + portal.config.json)
npm run clean           # limpa src/base/ e public/openapi/ (gerados)
npm test                # 81 testes (node:test, sem rede)
```

## Deploy

**Produção (provisório)** — `.github/workflows/deploy-prod.yml`: push na `main` → testes → fetch de produção → build → GitHub Pages. Secrets necessários: `AUTH_SERVER_URL` e `RHNETSOCIAL_SERVER_URL` (API nova = +1 secret `<ID>_SERVER_URL` + a linha no step de fetch do workflow).

**Homologação** — `.github/workflows/deploy-hml.yml` é um placeholder para o DevOps implementar após a validação do projeto. O código já está pronto: `npm run api:sync:hml` gera o portal apontando pras APIs de homologação (variáveis `<ID>_SERVER_URL_HML`), sem nenhuma mudança necessária.