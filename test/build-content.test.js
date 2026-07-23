import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  applyInfo,
  applyOverview,
  applyTagDescriptions,
  applyTagRenames,
  applyTagVisibility,
  applyOperationOverrides,
  applyOperationVisibility,
  applyOperationMoves,
  applyExamples,
  applyResponseExamples,
  applySecurityDescriptions,
  applyServers,
  pruneEmptyTags,
  transformSpec,
  findOrphanOverrides,
  loadContent,
  parseFrontmatter,
} from '../scripts/build-content.js';
import os from 'node:os';

const fixture = () => JSON.parse(fs.readFileSync(path.join(process.cwd(), 'test/fixtures/openapi-auth.fixture.json'), 'utf8'));

test('applyOverview substitui info.description; overview vazio/nulo não altera nada', () => {
  const spec = fixture();
  const out = applyOverview(spec, '## Novo overview');
  assert.equal(out.info.description, '## Novo overview');
  assert.equal(applyOverview(spec, '').info.description, spec.info.description);
  assert.equal(applyOverview(spec, null).info.description, spec.info.description);
});

test('applyTagDescriptions sobrescreve só as tags com entrada; as demais mantêm o original', () => {
  const spec = { tags: [{ name: 'A', description: 'orig A' }, { name: 'B', description: 'orig B' }] };
  const out = applyTagDescriptions(spec, { A: { description: 'nova A' } });
  assert.equal(out.tags[0].description, 'nova A');
  assert.equal(out.tags[1].description, 'orig B');
});

test('applyOperationOverrides aplica summary/description por "MÉTODO /caminho", ignorando os ausentes', () => {
  const spec = fixture();
  const out = applyOperationOverrides(spec, {
    'POST /api/v1/auth/credencial/login': { summary: 'Login novo', description: 'Desc nova' },
    'GET /nao/existe': { summary: 'ignorado' },
  });
  const op = out.paths['/api/v1/auth/credencial/login'].post;
  assert.equal(op.summary, 'Login novo');
  assert.equal(op.description, 'Desc nova');
});

test('applyExamples injeta o exemplo em todos os media types do requestBody, e ignora chaves _comment', () => {
  const spec = {
    paths: {
      '/x': {
        post: { requestBody: { content: { 'application/json': { schema: {} } } } },
      },
    },
  };
  const out = applyExamples(spec, { 'POST /x': { nome: 'Exemplo' }, _comment: 'ignora' });
  assert.deepEqual(out.paths['/x'].post.requestBody.content['application/json'].example, { nome: 'Exemplo' });
});

test('applyServers injeta a URL só quando o spec não declara servers', () => {
  assert.deepEqual(applyServers({}, 'https://x').servers, [{ url: 'https://x' }]);
  const comServers = applyServers({ servers: [{ url: 'https://original' }] }, 'https://x');
  assert.deepEqual(comServers.servers, [{ url: 'https://original' }]);
});

test('transformSpec aplica o pipeline completo de uma vez', () => {
  const spec = fixture();
  const out = transformSpec(
    spec,
    {
      overview: '## Overview final',
      tags: null,
      operations: { 'POST /api/v1/auth/refresh': { summary: 'Refresh novo' } },
      examples: null,
    },
    { serverUrl: 'https://api-auth.sci.com.br' }
  );
  assert.equal(out.info.description, '## Overview final');
  assert.equal(out.paths['/api/v1/auth/refresh'].post.summary, 'Refresh novo');
  assert.deepEqual(out.servers, [{ url: 'https://api-auth.sci.com.br' }]);
});

test('findOrphanOverrides denuncia operações e tags que não existem no spec', () => {
  const spec = fixture();
  const warnings = findOrphanOverrides(spec, {
    operations: { 'POST /api/v1/auth/refresh': {}, 'GET /caminho/errado': {} },
    tags: { Autenticação: {}, TagInexistente: {} },
  });
  assert.equal(warnings.length, 2);
  assert.ok(warnings.some((w) => w.includes('GET /caminho/errado')));
  assert.ok(warnings.some((w) => w.includes('TagInexistente')));
});

test('parseFrontmatter separa cabeçalho YAML do corpo; sem frontmatter, corpo inteiro; YAML inválido vira error', () => {
  const ok = parseFrontmatter('---\ntag: Minha Tag\n---\n\nCorpo em **markdown**.');
  assert.deepEqual(ok.data, { tag: 'Minha Tag' });
  assert.equal(ok.body, 'Corpo em **markdown**.');

  const sem = parseFrontmatter('Só corpo, sem cabeçalho.');
  assert.equal(sem.data, null);
  assert.equal(sem.body, 'Só corpo, sem cabeçalho.');

  const invalido = parseFrontmatter('---\ntag: [aberto\n---\ncorpo');
  assert.equal(invalido.data, null);
  assert.ok(invalido.error.includes('frontmatter inválido'));
});

test('loadContent lê o formato de pastas da API auth real (sem postResponseScript em lugar nenhum)', () => {
  const content = loadContent('auth', process.cwd());
  assert.ok(content.overview.includes('Visão geral'));
  assert.ok(content.tags['Autenticação'].description.includes('token JWT'));
  assert.equal(content.operations['POST /api/v1/auth/credencial/login'].summary, 'Gerar token JWT');
  assert.equal(content.operations['POST /api/v1/auth/refresh'].summary, 'Atualizar token JWT');
  assert.deepEqual(content.warnings, [], 'conteúdo real não deveria gerar nenhum aviso');
  const serialized = JSON.stringify(content);
  assert.equal(serialized.includes('postResponseScript'), false);
  assert.equal(serialized.includes('pm.globals'), false);
});

test('loadContent ignora arquivos _modelo/_rascunho (prefixo _)', () => {
  const auth = loadContent('auth', process.cwd());
  assert.equal('NomeExatoDaTag' in (auth.tags || {}), false);
  assert.equal('GET /api/v1/exemplo' in (auth.operations || {}), false);

  const rh = loadContent('rhnetsocial', process.cwd());
  assert.equal(rh.tags, null, 'rascunho _feriado não deveria contar como conteúdo');
});

test('loadContent: exemplo .example.json pareado pelo nome do .md; frontmatter faltando e exemplo órfão geram avisos', () => {
  const fs2 = fs;
  const tmp = fs2.mkdtempSync(path.join(os.tmpdir(), 'content-test-'));
  const dir = path.join(tmp, 'content', 'minha-api', 'operations');
  fs2.mkdirSync(dir, { recursive: true });

  fs2.writeFileSync(
    path.join(dir, 'listar.md'),
    '---\noperation: GET /api/v1/coisas\nsummary: Listar coisas\n---\n\nDescrição da listagem.'
  );
  fs2.writeFileSync(path.join(dir, 'listar.example.json'), '{"nome": "Exemplo Sintético"}');

  fs2.writeFileSync(path.join(dir, 'quebrado.md'), 'Só corpo, sem cabeçalho.');

  fs2.writeFileSync(path.join(dir, 'orfao.example.json'), '{"a": 1}');

  const content = loadContent('minha-api', tmp);
  assert.equal(content.operations['GET /api/v1/coisas'].summary, 'Listar coisas');
  assert.deepEqual(content.examples['GET /api/v1/coisas'], { nome: 'Exemplo Sintético' });
  assert.ok(content.warnings.some((w) => w.includes('quebrado.md') && w.includes('operation:')));
  assert.ok(content.warnings.some((w) => w.includes('orfao.example.json')));

  fs2.rmSync(tmp, { recursive: true, force: true });
});

test('integração: transformSpec com o conteúdo real da auth produz um spec final coerente', () => {
  const spec = fixture();
  const content = loadContent('auth', process.cwd());
  const out = transformSpec(spec, content, { serverUrl: 'https://api-auth.sci.com.br' });

  assert.ok(out.info.description.includes('Visão geral'));
  assert.equal(out.paths['/api/v1/auth/credencial/login'].post.summary, 'Gerar token JWT');
  assert.equal(out.paths['/api/v1/auth/refresh'].post.summary, 'Atualizar token JWT');
  assert.ok(out.tags.find((t) => t.name === 'Autenticação').description.includes('token JWT'));
  assert.deepEqual(out.paths['/api/v1/auth/credencial/login'].post.security, [{ 'Gerar JWT': [] }]);
  assert.deepEqual(out.paths['/api/v1/auth/refresh'].post.security, [{ 'Atualizar JWT': [] }]);
});

test('applyInfo renomeia a API (title) e a versão exibida', () => {
  const out = applyInfo({ info: { title: 'Orig', version: '1.0' } }, { title: 'API Renomeada', version: '2.5' });
  assert.equal(out.info.title, 'API Renomeada');
  assert.equal(out.info.version, '2.5');
  assert.equal(applyInfo({ info: { title: 'Orig' } }, null).info.title, 'Orig');
});

test('applyTagRenames: renomeia na lista de tags E em toda operação que referencia a tag', () => {
  const spec = {
    tags: [{ name: 'Feriado', description: 'd' }, { name: 'Outra' }],
    paths: {
      '/a': { get: { tags: ['Feriado'] } },
      '/b': { post: { tags: ['Outra', 'Feriado'] } },
    },
  };
  const out = applyTagRenames(spec, { Feriado: { renameTo: 'Feriados Nacionais e Pontos Facultativos' } });
  assert.equal(out.tags[0].name, 'Feriados Nacionais e Pontos Facultativos');
  assert.deepEqual(out.paths['/a'].get.tags, ['Feriados Nacionais e Pontos Facultativos']);
  assert.deepEqual(out.paths['/b'].post.tags, ['Outra', 'Feriados Nacionais e Pontos Facultativos']);
});

test('applyOperationVisibility (hide: true) remove a operação; path sem operações some', () => {
  const spec = { paths: { '/a': { get: { summary: 'x' }, post: { summary: 'y' } }, '/b': { get: {} } } };
  const out = applyOperationVisibility(spec, { 'GET /a': { hide: true }, 'GET /b': { hide: true } });
  assert.equal('get' in out.paths['/a'], false);
  assert.ok(out.paths['/a'].post);
  assert.equal('/b' in out.paths, false);
});

test('applyTagVisibility (hide: true) remove a tag E todas as operações dela', () => {
  const spec = {
    tags: [{ name: 'Interna' }, { name: 'Publica' }],
    paths: { '/x': { get: { tags: ['Interna'] } }, '/y': { get: { tags: ['Publica'] } } },
  };
  const out = applyTagVisibility(spec, { Interna: { hide: true } });
  assert.equal('/x' in out.paths, false);
  assert.ok(out.paths['/y']);
  assert.deepEqual(out.tags.map((t) => t.name), ['Publica']);
});

test('applyOperationMoves reatribui a tag da operação, criando a tag destino se não existir', () => {
  const spec = { tags: [{ name: 'Velha' }], paths: { '/x': { get: { tags: ['Velha'] } } } };
  const out = applyOperationMoves(spec, { 'GET /x': { moveToTag: 'Nova Seção' } });
  assert.deepEqual(out.paths['/x'].get.tags, ['Nova Seção']);
  assert.ok(out.tags.some((t) => t.name === 'Nova Seção'));
});

test('applyOperationOverrides aplica deprecated e descrições de parâmetros por nome', () => {
  const spec = {
    paths: {
      '/x': {
        get: {
          parameters: [
            { name: 'inicio', in: 'query', description: 'orig' },
            { name: 'fim', in: 'query' },
          ],
        },
      },
    },
  };
  const out = applyOperationOverrides(spec, {
    'GET /x': { deprecated: true, parameters: { inicio: 'Data inicial (AAAA-MM-DD)' } },
  });
  assert.equal(out.paths['/x'].get.deprecated, true);
  assert.equal(out.paths['/x'].get.parameters[0].description, 'Data inicial (AAAA-MM-DD)');
  assert.equal(out.paths['/x'].get.parameters[1].description, undefined);
});

test('applyResponseExamples injeta o exemplo no status certo', () => {
  const spec = {
    paths: {
      '/x': {
        post: {
          responses: {
            201: { content: { 'application/json': { schema: {} } } },
            400: { content: { 'application/json': { schema: {} } } },
          },
        },
      },
    },
  };
  const out = applyResponseExamples(spec, { 'POST /x': { 201: { token: 'abc' } } });
  assert.deepEqual(out.paths['/x'].post.responses[201].content['application/json'].example, { token: 'abc' });
  assert.equal(out.paths['/x'].post.responses[400].content['application/json'].example, undefined);
});

test('applySecurityDescriptions edita a descrição do scheme sem tocar no resto', () => {
  const spec = {
    components: { securitySchemes: { 'Gerar JWT': { type: 'http', scheme: 'basic', description: 'orig' } } },
  };
  const out = applySecurityDescriptions(spec, { 'Gerar JWT': { description: 'Nova descrição.' } });
  assert.equal(out.components.securitySchemes['Gerar JWT'].description, 'Nova descrição.');
  assert.equal(out.components.securitySchemes['Gerar JWT'].scheme, 'basic');
});

test('pruneEmptyTags remove tags sem nenhuma operação', () => {
  const spec = { tags: [{ name: 'Vazia' }, { name: 'Cheia' }], paths: { '/x': { get: { tags: ['Cheia'] } } } };
  const out = pruneEmptyTags(spec);
  assert.deepEqual(out.tags.map((t) => t.name), ['Cheia']);
});

test('integração da ordem: hide/move/overrides usam o nome ORIGINAL; rename roda por último', () => {
  const spec = {
    tags: [{ name: 'Feriado', description: 'orig' }],
    paths: {
      '/feriados': { get: { tags: ['Feriado'], summary: 'orig' } },
      '/interno': { get: { tags: ['Feriado'] } },
    },
  };
  const out = transformSpec(spec, {
    overview: null,
    tags: { Feriado: { description: 'Nova desc.', renameTo: 'Feriados Nacionais' } },
    operations: { 'GET /interno': { hide: true }, 'GET /feriados': { summary: 'Listar feriados' } },
  });
  assert.equal('/interno' in out.paths, false);
  assert.equal(out.tags[0].name, 'Feriados Nacionais');
  assert.equal(out.tags[0].description, 'Nova desc.');
  assert.deepEqual(out.paths['/feriados'].get.tags, ['Feriados Nacionais']);
  assert.equal(out.paths['/feriados'].get.summary, 'Listar feriados');
});

test('findOrphanOverrides denuncia security scheme e parâmetro inexistentes', () => {
  const spec = {
    paths: { '/x': { get: { parameters: [{ name: 'existe' }] } } },
    components: { securitySchemes: { real: {} } },
  };
  const warnings = findOrphanOverrides(spec, {
    operations: { 'GET /x': { parameters: { existe: 'ok', naoExiste: 'x' } } },
    security: { real: { description: 'ok' }, fantasma: { description: 'x' } },
    responseExamples: { 'GET /nada': { 200: {} } },
  });
  assert.ok(warnings.some((w) => w.includes('naoExiste')));
  assert.ok(warnings.some((w) => w.includes('fantasma')));
  assert.ok(warnings.some((w) => w.includes('GET /nada')));
  assert.equal(warnings.some((w) => w.includes('"existe"')), false);
});

test('loadContent lê os campos novos (renameTo, hide, moveToTag, parameters, response examples, security)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'content-full-'));
  const base = path.join(tmp, 'content', 'x');
  fs.mkdirSync(path.join(base, 'tags'), { recursive: true });
  fs.mkdirSync(path.join(base, 'operations'), { recursive: true });
  fs.mkdirSync(path.join(base, 'security'), { recursive: true });

  fs.writeFileSync(path.join(base, 'overview.md'), '---\ntitle: API Renomeada\nversion: 9.9\n---\n\nOverview novo.');
  fs.writeFileSync(path.join(base, 'tags', 'a.md'), '---\ntag: Orig\nrenameTo: Novo Nome\n---\n\nDesc.');
  fs.writeFileSync(path.join(base, 'tags', 'b.md'), '---\ntag: Escondida\nhide: true\n---');
  fs.writeFileSync(
    path.join(base, 'operations', 'op.md'),
    '---\noperation: GET /x\nsummary: S\ndeprecated: true\nmoveToTag: Outra\nparameters:\n  inicio: Data inicial\n---\n\nDesc op.'
  );
  fs.writeFileSync(path.join(base, 'operations', 'op.example.json'), '{"a":1}');
  fs.writeFileSync(path.join(base, 'operations', 'op.response-200.example.json'), '{"ok":true}');
  fs.writeFileSync(path.join(base, 'security', 's.md'), '---\nscheme: Gerar JWT\n---\n\nDesc do scheme.');

  const content = loadContent('x', tmp);
  assert.deepEqual(content.info, { title: 'API Renomeada', version: 9.9 });
  assert.equal(content.overview, 'Overview novo.');
  assert.equal(content.tags.Orig.renameTo, 'Novo Nome');
  assert.equal(content.tags.Escondida.hide, true);
  const op = content.operations['GET /x'];
  assert.equal(op.deprecated, true);
  assert.equal(op.moveToTag, 'Outra');
  assert.deepEqual(op.parameters, { inicio: 'Data inicial' });
  assert.deepEqual(content.examples['GET /x'], { a: 1 });
  assert.deepEqual(content.responseExamples['GET /x']['200'], { ok: true });
  assert.equal(content.security['Gerar JWT'].description, 'Desc do scheme.');
  assert.deepEqual(content.warnings, []);

  fs.rmSync(tmp, { recursive: true, force: true });
});

test('loadContent: renameTo em security/*.md é recusado com aviso (quebraria prefill e requirements)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'content-sec-'));
  const base = path.join(tmp, 'content', 'x', 'security');
  fs.mkdirSync(base, { recursive: true });
  fs.writeFileSync(path.join(base, 's.md'), '---\nscheme: Gerar JWT\nrenameTo: Outro Nome\n---\n\nDesc.');

  const content = loadContent('x', tmp);
  assert.ok(content.warnings.some((w) => w.includes('"renameTo" em security schemes não é suportado')));
  assert.equal(content.security['Gerar JWT'].description, 'Desc.');

  fs.rmSync(tmp, { recursive: true, force: true });
});

test('resolveSecurityScheme: exatamente 1 bearer no spec → resolve sozinho', async () => {
  const { resolveSecurityScheme } = await import('../scripts/build-content.js');
  const spec = { components: { securitySchemes: { meuBearer: { type: 'http', scheme: 'bearer' }, basico: { type: 'http', scheme: 'basic' } } } };
  assert.equal(resolveSecurityScheme({ id: 'x', securityScheme: 'auto' }, spec), 'meuBearer');
  assert.equal(resolveSecurityScheme({ id: 'x', securityScheme: 'fixo' }, spec), 'fixo');
});

test('resolveSecurityScheme: 0 ou vários bearers → erro listando os nomes disponíveis', async () => {
  const { resolveSecurityScheme } = await import('../scripts/build-content.js');
  assert.throws(
    () => resolveSecurityScheme({ id: 'x', securityScheme: 'auto' }, { components: { securitySchemes: { a: { type: 'apiKey' } } } }),
    /Nenhum esquema HTTP bearer encontrado no spec.*Disponíveis: a/s
  );
  assert.throws(
    () => resolveSecurityScheme({ id: 'x', securityScheme: 'auto' }, { components: { securitySchemes: { b1: { type: 'http', scheme: 'bearer' }, b2: { type: 'http', scheme: 'bearer' } } } }),
    /Múltiplos esquemas bearer encontrados.*b1, b2/s
  );
});

test('resolveApi + generatePortalConfig produzem o contrato completo do frontend', async () => {
  const { resolveApi, generatePortalConfig } = await import('../scripts/build-content.js');
  const spec = { components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } } } };
  const api = {
    id: 'rhnetsocial', title: 'RH Net Social', slug: 'rhnetsocial', isAuthProvider: false,
    securityScheme: 'auto', default: false,
  };
  process.env.RHNETSOCIAL_SERVER_URL = 'https://prod';
  process.env.RHNETSOCIAL_SERVER_URL_HML = 'https://hml';
  const prod = resolveApi(api, spec, 'production');
  assert.equal(prod.serverUrl, 'https://prod');
  assert.equal(prod.securityScheme, 'bearerAuth');
  const hml = resolveApi(api, spec, 'homolog');
  assert.equal(hml.serverUrl, 'https://hml');

  const config = generatePortalConfig([prod], 'production');
  assert.equal(config.environment, 'production');
  assert.equal(config.sharedTokenVariable, 'sci_auth_token');
  assert.deepEqual(config.apis, [prod]);
});