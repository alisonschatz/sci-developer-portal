# Arquitetura — decisões e trade-offs

Este documento registra o **porquê** de cada decisão do portal. O **como usar** está no README.

## 1. Princípios

- **Fonte única da verdade**: toda API é declarada em `apis.config.js`, e só ali. Scripts, config do Scalar, plugin de token, `.env` e CI derivam do manifesto — adicionar uma API não exige tocar em mais nada (e o `npm run api:new` faz até a inserção no manifesto sozinho).
- **Autoria ≠ runtime**: o manifesto é a camada de autoria; o build resolve tudo (ambiente, schemes, URLs) e gera `public/portal.config.json`, o contrato que o frontend consome. Nenhum módulo de `src/` importa o manifesto.
- **Erros nunca silenciosos**: chave editorial errada, scheme ambíguo, variável de ambiente ausente — tudo falha ou avisa citando exatamente o que corrigir.
- **Baseado no que o Scalar documenta**: o compartilhamento de token usa a API oficial de plugins, não interceptação de `fetch` nem scripts embutidos no spec (`x-post-response`/`pm.globals` não funciona nesta versão do Scalar — o store de variáveis é recriado a cada requisição).

## 2. Manifesto e variáveis de ambiente derivadas

`apis.config.js` declara por API: `id`, `title`, `slug`, `isAuthProvider`, `securityScheme` (ou `securitySchemes` no caso rico), `tokenResponseField` (só no auth provider), `default` e opcionalmente `docsPath`. A validação (`validateManifest`) exige exatamente 1 auth provider e 1 default, ids/slugs únicos em kebab-case, e que toda API de negócio tenha um scheme onde plugar o token.

As **URLs base não ficam no código** (segurança do repositório): `getServerUrl` lê variáveis de ambiente com nomes **derivados do id** (`serverEnvVarName`): `<ID>_SERVER_URL` (produção) e `<ID>_SERVER_URL_HML` (homologação). Nada a declarar; variável ausente lança citando o nome exato. `npm run env` regenera o `.env.example` do manifesto e cria/sincroniza o `.env` — acrescenta chaves novas sem tocar em valores preenchidos. Nota honesta de escopo: as URLs continuam visíveis no portal publicado (precisam — são a documentação pública de onde chamar as APIs); a variável protege o *repositório*, não o site.

A **URL do spec é sempre derivada**: `<serverUrl><docsPath>` (padrão `/docs?api-docs.json`, sobrescrevível por API). Não existe URL de docs configurável à parte.

## 3. Pipeline: fetch → build-content

Dois estágios separados de propósito — o build funciona offline a partir do que está em `src/base/` (útil para editar conteúdo sem rede e para testes com fixtures).

**`scripts/fetch.js`** (`node scripts/fetch.js [production|homolog]`, ou `PORTAL_ENV`) baixa cada spec e aplica dois filtros de segurança antes de gravar:
1. **Blacklist por padrão de rota** (admin/internal/debug/health/metrics/swagger/docs) — proteção por convenção de URL;
2. **`x-internal: true`** — respeita a marcação explícita do backend, no nível do path item (rota inteira) e da operação individual (rota que ficar sem operações some junto).

**`scripts/build-content.js`** combina cada spec bruto com o conteúdo editorial e grava `public/openapi/<id>.json` + `public/portal.config.json`. É um conjunto de **funções puras exportadas e testadas** (`applyOverview`, `applyTagRenames`, `applyOperationOverrides`, …) — sem CLI de terceiros, sem arquivos intermediários. O trade-off assumido de não usar um linter OpenAPI externo: os specs vêm dos backends da SCI (que já os validam), e `findOrphanOverrides()` cobre o erro editorial mais comum (chave de operação/tag/scheme/parâmetro que não existe no spec, que senão falharia em silêncio).

### 3.1 Ordem do pipeline (fixa, determinística)

```
1. servers / info(title, version) / overview        (documento)
2. hide de operações, depois de tags                (nomes ORIGINAIS)
3. moveToTag                                        (ainda nomes originais)
4. summary/description/deprecated/parameters + exemplos (chaveados por caminho — imunes a rename)
5. descrições de tag e de security scheme           (nomes originais)
6. renameTo de tags                                 (POR ÚLTIMO)
7. prune de tags que ficaram vazias
```

A regra que essa ordem cria para quem escreve conteúdo: **todo campo referencia o nome original do spec**. Um `moveToTag` + `renameTo` da tag destino funcionam juntos porque o move roda antes do rename; sem ordem fixa, o resultado dependeria da ordem dos arquivos no disco.

**`renameTo` atualiza dois lugares ao mesmo tempo** — `spec.tags[].name` E o array `tags` de cada operação. Só o primeiro faria as operações "sumirem" do grupo (o Scalar agrupa pelo nome exato).

**Renomear security scheme é recusado** (com aviso no build): o nome participa do prefill do token e dos security requirements de cada operação — um rename editorial quebraria os dois silenciosamente.

**`hide` editorial ≠ filtros do fetch.** Os filtros do fetch são segurança — rotas internas nunca chegam ao repositório. O `hide` é curadoria — a rota existe no spec baixado, só não aparece na documentação.

## 4. Resolução automática de securityScheme

`securityScheme: 'auto'` é resolvido pelo build contra o spec **real** baixado (`resolveSecurityScheme`): exatamente 1 scheme HTTP bearer em `components.securitySchemes` → é ele; 0 ou vários → o build **falha** listando os nomes disponíveis para fixar explicitamente. Determinístico: ou resolve sozinho, ou explica exatamente o que fazer — nunca "conferir depois".

## 5. portal.config.json — o contrato de runtime

O build gera `public/portal.config.json` com `{ environment, sharedTokenVariable, apis: [...] }` (cada API já resolvida: `serverUrl` do ambiente, scheme detectado, prefills). O `main.js` faz **bootstrap assíncrono**: busca o arquivo, e só então monta o app passando o config como prop — com mensagem clara se o arquivo não existir (`rode npm run build:content`).

Consequências práticas: o portal de homologação aponta para as APIs de homologação de verdade (o "Send" testa hml), o título marca "(Homologação)", e os testes do frontend usam uma fixture do contrato em vez do manifesto real.

## 6. Token compartilhado — API oficial de plugins

`src/plugins/sci-token-plugin.js` é um ClientPlugin com os hooks documentados do Scalar, embrulhado num ApiReferencePlugin via `apiClientPlugins` (formato documentado) e passado em `configuration.plugins`:

- **`responseReceived`**: captura o token de qualquer resposta bem-sucedida vinda do server da API de Autenticação (login E refresh — casa por prefixo de URL contra o `serverUrl` resolvido, sem caminho hardcoded), lendo o campo `tokenResponseField`.
- **`beforeRequest`**: injeta `Authorization: Bearer <token>` nas requisições às APIs consumidoras. Os servers consumidores são derivados do config: toda API com `securityScheme` + a própria Autenticação (o refresh usa Bearer). A regra de quando corrigir: header ausente, vazio, ou com o placeholder `{{sci_auth_token}}` não resolvido — **nunca** um valor real digitado pela pessoa.

Os hooks são defensivos (nunca lançam; payload inesperado = no-op): no pior caso o portal funciona sem a correção automática, nunca quebrado por ela.

**Risco conhecido:** os hooks foram testados com payloads no shape documentado (`requestBuilder` com `.url`/`.headers.set`, `response` com `.url`/`.ok`/`.clone().json()`), não dentro do Scalar renderizado num navegador. Roteiro de QA: gerar o token no login → Send no refresh (deve sair com Bearer) → trocar para outra API (campo preenchido) → chamada de negócio (autentica).

## 7. Sincronização com o localStorage

`src/plugins/token-storage.js` escreve na mesma persistência de auth que o Scalar usa (confirmado no código-fonte dele):

- **Chave e formato**: `scalar-reference-auth-<slug>`, com `secrets[scheme] = { type, 'x-scalar-secret-token' | username | password }` e `selected.document = { selectedIndex, selectedSchemes }`. O Scalar só **relê** essa chave ao ativar um documento (trocar de aba/recarregar) — nunca reativamente; por isso o token capturado é gravado ali, para o campo aparecer preenchido na próxima ativação.
- **Guard no `setItem`**: o Scalar tem autosave próprio (debounced) na mesma chave, refletindo só o que ele sabe em memória — sem o guard, esse autosave apagaria o token gravado por fora. O guard intercepta a escrita e reaplica o token por cima, na hora. A flag de idempotência é um `WeakSet` em memória — nunca uma propriedade no storage (num navegador real, `storage.prop = x` vira uma entrada persistente de verdade).
- **`ensureAllMultiSchemeSelections`** (a cada carga da página): mantém o `selected.document` da Autenticação sempre com os dois schemes. Trade-off consciente: a **existência** de `selected.document` desliga a escolha automática de scheme por operação — as duas coisas competem pelo mesmo campo interno do Scalar, sem meio-termo. Escolhido: topo do documento nunca em branco; a pessoa alterna manualmente entre "Gerar JWT"/"Atualizar JWT" dentro de cada operação.

## 8. Configuration do Scalar

`buildScalarConfiguration(portalConfig, baseUrl, { plugins })` é pura e testável em Node — o que toca em browser (plugin com storage) é injetado por `App.vue`. Tema `fastify` com accent SCI via CSS **fora de `@layer`** (as camadas `scalar-base`/`scalar-theme` têm prioridade menor que estilos sem camada — é o mecanismo oficial de customização). Autenticação por documento: caso simples = scheme preferido + prefill `{{sci_auth_token}}`; caso da Autenticação = **nenhum** scheme preferido (`preferredSecurityScheme: null`), porque um preferido no nível do documento "vaza" para operações que deveriam usar outro scheme — cada operação usa o próprio security requirement.

A marca do portal entra pelo slot oficial `sidebar-start` do `<ApiReference>`.

## 9. Conteúdo editorial: um arquivo markdown por coisa

Se a página inicial (`overview.md`) é intuitiva por ser *markdown puro num arquivo*, tudo segue o mesmo padrão: um `.md` por tag/operação/scheme, com um frontmatter mínimo dizendo o alvo, e exemplos como `.json` de verdade pareados pelo nome. Decisões dentro do formato:

- **Frontmatter em vez de nome-de-arquivo-como-chave** — chaves de operação contêm barras (impossíveis num nome de arquivo) e nomes de tag têm acento (problemas de normalização Unicode NFC/NFD no git entre sistemas). O nome do arquivo fica livre e humano; o frontmatter declara o alvo.
- **Exemplo pareado por nome** (`x.md` + `x.example.json` / `x.response-<status>.example.json`) — um `.json` real tem highlight, validação do editor e diff limpo; e é o `.md` que declara a operação, então exemplo órfão gera aviso.
- **Prefixo `_` = ignorado** — rascunhos e modelos moram na mesma pasta (cada pasta tem um `_modelo.md` com a referência completa de campos, no lugar exato onde a pessoa escreve).
- **Avisos acumulados e impressos no build** — frontmatter faltando (com o modelo certo na mensagem), alvo inexistente no spec, duplicatas, JSON inválido.

A referência completa de campos está no README.

## 10. Links âncora

Formatos confirmados no código-fonte do Scalar (`getNavigationOptions()` em `@scalar/workspace-store`): heading do overview = `{documentId}/description/{slug}`; tag = `{documentId}/tag/{slug}`; operação = `{documentId}/tag/{slugTag}/{MÉTODO}{caminho}`; documento = `{documentId}`. O slug: minúsculo, remove o que não é letra/marca/número, espaços viram hífen. Emoji comum some do slug; **emoji de teclado numérico (1️⃣) não** — evitar em títulos. `renameTo` de tag muda o slug — links que apontem para ela precisam acompanhar.

## 11. CI e ambientes

O ambiente é uma dimensão de primeira classe: `fetch.js` e `build-content.js` aceitam `production|homolog` por argumento CLI ou `PORTAL_ENV`, lendo as variáveis correspondentes (`<ID>_SERVER_URL[_HML]`).

- **`deploy-prod.yml`**: fluxo simples — push na `main` → testes → fetch de produção → build → GitHub Pages. Secrets: um `<ID>_SERVER_URL` por API.
- **`deploy-hml.yml`**: placeholder que falha explicitamente se disparado — o fluxo de homologação é responsabilidade do DevOps após a validação do projeto. O código já suporta o ambiente por completo (`npm run api:sync:hml`); nenhuma mudança será necessária.

O `.gitignore` cobre o padrão do projeto: `.env`, gerados do pipeline (`src/base/*`, `public/openapi/*`, `public/portal.config.json`) preservando os `.gitkeep`.