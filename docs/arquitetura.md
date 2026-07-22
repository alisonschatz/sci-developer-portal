# Arquitetura — decisões e trade-offs (v2)

Este documento registra o **porquê** de cada decisão da v2. O histórico completo da v1 (20 decisões, incluindo os becos sem saída que levaram até aqui) vive no repositório da v1 — aqui, cada seção resume o que foi herdado e por quê, e detalha o que é novo.

## 1. Por que uma v2

A v1 funcionava, mas acumulou complexidade de caminhos que se provaram errados e foram contornados em camadas: um pipeline Redocly inteiro (CLI + config gerada + plugin de decorators) para transformações que são JSON puro; `x-post-response`/`postResponseScript` no spec, que **nunca funcionou** nesta versão do Scalar (o store de variáveis é recriado por requisição — confirmado no código-fonte deles); e um `customFetch` que dependia de detalhes internos não documentados de como o Scalar chama essa função (a assinatura de 1 argumento foi descoberta por engenharia reversa depois de uma versão quebrada).

A v2 reconstrói sobre o que a documentação oficial do Scalar suporta de verdade, mantendo o que a v1 provou que funciona.

## 2. Manifesto único (`apis.config.js`) — herdado da v1

Fonte única da verdade. Config do Scalar, plugin de token, fetch, CI e `.env.example` derivam dele. Adicionar uma API = uma entrada no array + uma pasta em `content/`. A validação (`validateManifest`) roda antes de todo build e é coberta por teste.

## 3. Pipeline de conteúdo sem Redocly

**v1:** fetch → gerar `redocly.generated.yaml` → Redocly CLI (`lint` + `bundle`) com um plugin de decorators customizado → bundle final. Três camadas de indireção (config gerada, registro de plugin, CLI externa) para transformações que, no fim, eram "ler YAML, mexer no JSON".

**v2:** `scripts/build-content.js` — funções puras (`applyOverview`, `applyTagDescriptions`, `applyOperationOverrides`, `applyExamples`, `applyServers`), exportadas e testadas diretamente, sem arquivo intermediário e sem CLI de terceiro. O que se perde do Redocly é o lint de OpenAPI — trade-off aceito: os specs vêm dos backends da SCI (que já os validam), e o `findOrphanOverrides()` cobre o erro editorial mais comum (chave de operação/tag digitada errada, que antes falhava silenciosamente).

O fetch (`scripts/fetch.js`) mantém o filtro de blacklist da v1 (rotas admin/internal/debug/health nunca chegam à documentação pública) e usa `fetch` nativo do Node 22 — sem axios, sem dotenv (`--env-file-if-exists` do próprio Node).

## 4. Token compartilhado pela API oficial de plugins

O coração da v2. A documentação oficial de plugins do Scalar expõe hooks de ciclo de vida do API Client:

```js
// ClientPlugin (documentado)
hooks: {
  beforeRequest: ({ requestBuilder }) => { requestBuilder.headers.set(...) },
  responseReceived: ({ response }) => { ... },
}
```

`src/plugins/sci-token-plugin.js` usa exatamente isso:

- **`responseReceived`** captura o token de qualquer resposta bem-sucedida vinda do server da API Auth (login E refresh — casa por prefixo de URL contra `serverUrl` do manifesto, sem caminho hardcoded), lendo o campo `tokenResponseField`.
- **`beforeRequest`** injeta `Authorization: Bearer <token>` nas requisições às APIs consumidoras (servers derivados do manifesto — inclui a própria Auth, porque "Atualizar JWT" usa Bearer; lição da decisão 18 da v1). A regra de quando corrigir é a mesma validada na v1: header ausente, vazio, ou placeholder não resolvido — **nunca** um valor real digitado pela pessoa.

O ClientPlugin é embrulhado num ApiReferencePlugin via `apiClientPlugins` (formato documentado) e entra em `configuration.plugins`.

**O que isso elimina da v1:** o `customFetch` (e toda a fragilidade da assinatura de chamada descoberta por engenharia reversa), e o `x-post-response`/`postResponseScript` no spec (que nunca funcionou — `content/*/operations.yaml` da v2 não tem nenhum script, só texto). Com isso, `verify-shared-token.js` da v1 também deixa de existir — não há mais o que verificar no spec.

**Risco conhecido:** os hooks foram testados com payloads no shape documentado (`requestBuilder` com `.url`/`.headers`, `response` com `.url`/`.ok`/`.clone().json()`), não dentro do Scalar renderizado num navegador — mesma limitação de ambiente da v1. Os hooks são defensivos (nunca lançam; payload inesperado = no-op) para que, no pior caso, o portal continue funcionando sem a correção automática, nunca quebrado por ela.

## 5. Sincronização com o localStorage — herdada da v1, confirmada em produção

`src/plugins/token-storage.js` é o port direto do módulo da v1 que o usuário **confirmou funcionando em navegador real**:

- Grava o token capturado na chave `scalar-reference-auth-<slug>` (mesma chave e formato que o Scalar usa — confirmado no código-fonte), para o campo de auth aparecer preenchido na próxima ativação de documento. O Scalar só relê essa chave ao ativar um documento (trocar de aba/recarregar) — nunca reativamente.
- **Guard no `setItem`**: o Scalar tem autosave próprio (debounced) nessa mesma chave, refletindo só o que ele sabe em memória — sem o guard, esse autosave apagava o token gravado por fora (corrida real diagnosticada na v1). O guard intercepta a escrita e reaplica o token por cima, na hora. A flag de idempotência é um `WeakSet` em memória — nunca uma propriedade no storage (num navegador real, `storage.prop = x` vira uma entrada de verdade; bug real da v1, decisão 19.1).
- **`ensureAllMultiSchemeSelections()`** (chamada no `main.js`): mantém `selected.document` da Auth sempre com os dois schemes. Trade-off decidido conscientemente pelo usuário na v1 (decisão 17): a **existência** de `selected.document` desliga a escolha automática de scheme por operação — as duas coisas competem pelo mesmo campo interno, sem meio-termo. Escolhido: topo do documento nunca em branco; a pessoa alterna manualmente entre "Gerar JWT"/"Atualizar JWT" dentro de cada operação.

## 6. Configuration do Scalar — herdada, com plugins injetados

`buildScalarConfiguration(baseUrl, { plugins })` continua pura e testável em Node — o que toca em browser (criação do plugin, com storage) é injetado por `App.vue`. Valores globais mantidos da v1 (tema `fastify` com accent SCI via CSS fora de `@layer` — regra de Cascade Layers garante a vitória, ver comentário em `src/style.css`; `operationTitleSource: 'summary'`; etc.).

Autenticação por documento:
- Caso simples (`securityScheme`): scheme preferido + prefill `{{sci_auth_token}}`.
- Caso rico (auth): **nenhum** scheme preferido (`preferredSecurityScheme: null`) — cada operação usa o próprio security requirement (decisão 15 da v1: um preferido no nível do documento "vaza" para operações que deveriam usar outro scheme).

## 7. Conteúdo editorial: um arquivo markdown por coisa

**v1:** `src/decorators/<id>/descriptions.yaml` — texto de documentação espremido dentro de YAML (indentação de bloco `|`, sem preview de markdown no editor) e exemplos num JSON chaveado. Funcionava, mas quem edita conteúdo não deveria precisar saber YAML.

**v2 (iteração 2):** se `overview.md` é intuitivo por ser *markdown puro num arquivo*, tudo segue o mesmo padrão:

```
content/<id>/
  overview.md
  tags/<nome-livre>.md              frontmatter: tag → corpo = descrição
  operations/<nome-livre>.md        frontmatter: operation + summary → corpo = descrição
  operations/<mesmo-nome>.example.json   exemplo de corpo, pareado pelo nome do .md
```

Decisões dentro desse formato:

- **Frontmatter em vez de nome-de-arquivo-como-chave** — chaves de operação contêm barras (`POST /api/v1/auth/refresh`), impossíveis num nome de arquivo sem encoding feio; e nomes de tag têm acento, que cria problemas de normalização Unicode entre sistemas (NFC/NFD no git entre macOS/Windows). O nome do arquivo fica livre e humano; o frontmatter (3 linhas) declara o alvo.
- **Exemplo pareado por nome** (`x.md` + `x.example.json`) em vez de frontmatter — JSON dentro de YAML é a mesma dor que o formato antigo; um arquivo `.json` de verdade tem highlight, validação do editor e diff limpo.
- **Prefixo `_` = ignorado** — rascunhos e modelos moram na mesma pasta sem efeito no build (cada pasta scaffoldada já vem com um `_modelo.md` mostrando o formato no próprio lugar onde a pessoa vai escrever).
- **Avisos em vez de silêncio** — `loadContent` acumula e o build imprime: frontmatter faltando (com o modelo certo na própria mensagem), `tag:`/`operation:` inexistente no spec (via `findOrphanOverrides`, herdado), duplicata entre arquivos, exemplo órfão, JSON inválido. O erro editorial nunca falha silenciosamente — a lição mais repetida da v1.

A camada de transformação (`transformSpec` e os `apply*`) não mudou nada — o formato interno `{ overview, tags, operations, examples }` é o mesmo; só `loadContent` (a leitura) foi trocada. É exatamente o tipo de mudança que a separação leitura/transformação existia pra permitir.

### 7.1 Personalização completa (iteração 3)

A pedido, o sistema foi estendido pra cobrir **tudo** que é editável num spec pela camada editorial — mesmo o que ainda não é usado, pra funcionalidade existir quando precisar. A referência completa de campos está no README ("Referência completa do que é personalizável"); aqui, as decisões de design:

**Ordem do pipeline importa, e é fixa** (`transformSpec`):

```
1. servers / info(title, version) / overview       (documento)
2. hide de operações, depois de tags               (nomes ORIGINAIS)
3. moveToTag                                       (ainda nomes originais)
4. summary/description/deprecated/parameters + exemplos (chaveados por caminho — imunes a rename)
5. descrições de tag e de security scheme          (nomes originais)
6. renameTo de tags                                (POR ÚLTIMO — muda os nomes que tudo acima usou)
7. prune de tags que ficaram vazias
```

A regra que essa ordem cria pra quem escreve conteúdo: **todo campo referencia o nome original do spec**. Um `moveToTag` + um `renameTo` da tag destino funcionam juntos porque o move roda antes do rename. Sem essa ordem fixa, o resultado dependeria da ordem dos arquivos no disco — não-determinístico.

**`renameTo` atualiza dois lugares ao mesmo tempo** — `spec.tags[].name` E o array `tags` de cada operação. Só o primeiro faria as operações "sumirem" do grupo (o Scalar agrupa pelo nome exato). É por isso que rename é uma transformação própria, não um caso do `applyTagDescriptions`.

**Renomear security scheme é recusado de propósito** (com aviso no build se alguém tentar via `renameTo` em `security/*.md`): o nome do scheme participa do prefill do token (`apis.config.js`) e dos security requirements de cada operação — um rename editorial quebraria os dois silenciosamente, a classe de bug mais cara deste projeto.

**`hide` editorial ≠ blacklist do fetch.** A blacklist (`scripts/fetch.js`) é segurança — rotas internas nunca chegam ao repositório. O `hide` é curadoria — a rota existe no spec baixado, só não aparece na documentação. Camadas diferentes, propósitos diferentes.

**Tags vazias são podadas automaticamente** (`pruneEmptyTags`) — depois de `hide`s e `move`s, uma tag sem nenhuma operação viraria uma seção vazia no portal.

Os links âncora dentro do conteúdo usam os formatos confirmados no código-fonte do Scalar (`getNavigationOptions()` em `@scalar/workspace-store`): `{doc}/description/{slug}` para headings, `{doc}/tag/{slug}/{MÉTODO}{caminho}` para operações, `{doc}` sozinho para trocar de API. O algoritmo de slug (e a pegadinha do emoji de teclado numérico) está documentado no README, seção "Como editar o conteúdo".

## 8. O que ainda depende de QA num navegador real

- **Os hooks do plugin dentro do Scalar renderizado** — o shape dos payloads segue a documentação e os testes simulam exatamente esse shape, mas a integração completa (Scalar chamando os hooks de verdade) só um navegador confirma. Roteiro de teste: gerar o token no login → clicar Send no refresh (deve sair com Bearer correto) → trocar pra aba RH Net Social (campo deve aparecer preenchido) → chamada de negócio (deve autenticar).
- **Nome do security scheme da RH Net Social** — `'bearerAuth'` segue não confirmado contra o spec real (mesma pendência da v1). Conferir após o primeiro `npm run api:fetch` de produção.
- **Aparência final** — tema, tabelas (CSS herdado da v1), responsividade.

## 9. Iteração 4: ambientes, resolução automática e a separação autoria/runtime

**Problema apontado:** `sourceUrlEnv` era redundante (a URL de docs é sempre `serverUrl + '/docs?api-docs.json'`), o `securityScheme` pedia conferência manual pós-fetch ("ou é automático ou não é"), e faltava o fluxo homologação → produção.

**Decisões:**

1. **URL de docs derivada, nunca configurada** — `getDocsUrl(api, env)` = `servers[env] + docsPath` (padrão `DOCS_PATH_DEFAULT`, sobrescrevível por API se alguma fugir do padrão). Isso eliminou o `.env` inteiro: sem axios, sem dotenv, sem `env:example` — o manifesto é literalmente a única configuração.

2. **`securityScheme: 'auto'` resolvido pelo build contra o spec REAL** (`resolveSecurityScheme`): exatamente 1 scheme HTTP bearer em `components.securitySchemes` → é ele; 0 ou vários → o build **falha** listando os nomes disponíveis. Determinístico: ou resolve sozinho, ou explica exatamente o que fixar. A pendência eterna do "conferir o nome do bearerAuth depois" deixou de existir como categoria.

3. **Separação autoria/runtime** — `apis.config.js` é a camada de AUTORIA (o que a pessoa declara); o build resolve tudo (ambiente, schemes, URLs) e gera `public/portal.config.json`, a camada de RUNTIME (o contrato que o frontend consome via fetch no bootstrap). Nenhum módulo de `src/` importa mais o manifesto: `scalar.config`, `sci-token-plugin` e `token-storage` são parametrizados pelo config resolvido. Consequências práticas: o portal de homolog aponta pras APIs de homolog DE VERDADE (o "Send" testa hml), o título marca "(Homologação)", e os testes usam uma fixture do contrato em vez do manifesto real.

4. **Ambientes como dimensão de primeira classe** — `servers: { production, homolog }` por API; `fetch.js`/`build-content.js` aceitam o ambiente por argumento CLI (`node scripts/fetch.js homolog`) ou `PORTAL_ENV`. Homolog sem URL configurada = erro apontando o campo exato.

5. **CI em dois fluxos** — `deploy-prod.yml` (simples: testes → fetch de produção → build → Pages) e `deploy-hml.yml` (placeholder; o fluxo de homologação será implementado pelo DevOps após a validação — o código já suporta o ambiente via `npm run api:sync:hml`).

## 10. Iteração 5: URLs fora do código e CI provisório

**URLs como variáveis de ambiente derivadas** — as URLs base saíram de `apis.config.js` por segurança (não ficam no repositório): `getServerUrl` lê `<ID>_SERVER_URL` / `<ID>_SERVER_URL_HML`, com os nomes **derivados do id** (`serverEnvVarName`) — nada a declarar no manifesto, `npm run env:example` regenera o `.env.example`, e a ausência da variável falha citando o nome exato. Nota honesta de escopo: as URLs continuam visíveis no portal publicado (precisam — são a documentação pública de onde chamar as APIs); a variável protege o *repositório*, não o site.

**CI reduzido de propósito** — o fluxo de homologação saiu do escopo do projeto e é responsabilidade do DevOps pós-validação. `deploy-prod.yml` é o mínimo honesto (testes → fetch → build → Pages); `deploy-hml.yml` é um placeholder que falha explicitamente se disparado, documentando que os scripts por ambiente já estão prontos.


## 11. Iteração 6: automações de rotina

- **Filtro `x-internal: true` no fetch** — além da blacklist por padrão de rota, o fetch agora remove path items e operações individuais marcados com `x-internal: true` no spec de origem (rota que fica sem operações some junto). A blacklist protege por convenção de URL; o `x-internal` respeita a marcação explícita do backend.
- **`npm run env`** — regenera o `.env.example` do manifesto E cria/sincroniza o `.env` a partir dele: chaves novas são acrescentadas, valores preenchidos nunca são tocados, e as variáveis ainda vazias são listadas. Idempotente.
- **`npm run api:sync[:hml]`** — fetch + build:content num comando (o par que sempre roda junto).
- **`api:new` totalmente automático** — além do scaffold de conteúdo, insere o bloco no `apis.config.js` sozinho (num marcador fixo; se o marcador sumir, cai no modo manual com o bloco impresso), valida o manifesto na hora, sincroniza o `.env` e lista exatamente o que falta preencher. Os modelos `_modelo.md` são copiados da API auth (fonte única dos modelos).
