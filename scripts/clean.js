import fs from 'node:fs';
import path from 'node:path';

/**
 * Limpa os arquivos locais gerados pelo pipeline (fetch + build),
 * deixando o repositório no estado de um checkout limpo. Preserva os
 * .gitkeep. Não apaga node_modules/dist de propósito.
 */
const targets = [
  { type: 'dir-content', path: 'src/base' },
  { type: 'dir-content', path: 'public/openapi' },
];
const files = ['public/portal.config.json'];

console.log('🧹 Limpando arquivos gerados...');
for (const target of targets) {
  const fullPath = path.resolve(target.path);
  if (!fs.existsSync(fullPath)) continue;
  for (const file of fs.readdirSync(fullPath)) {
    if (file === '.gitkeep') continue;
    fs.rmSync(path.join(fullPath, file), { recursive: true, force: true });
  }
  console.log(`🗑️  Conteúdo limpo em: ${target.path}/`);
}
for (const file of files) {
  const full = path.resolve(file);
  if (fs.existsSync(full)) { fs.rmSync(full); console.log(`🗑️  Removido: ${file}`); }
}
console.log('✨ Pronto!');
