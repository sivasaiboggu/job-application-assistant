const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

let cached = null;

// Compiles the TypeScript sources once per test process into a temp dir and
// returns a require() bound to it. No build artifacts are kept in the repo.
module.exports = function compile() {
  if (cached) return cached;
  const output = mkdtempSync(path.join(tmpdir(), 'jaa-tests-'));
  process.on('exit', () => rmSync(output, { recursive: true, force: true }));
  const root = path.join(__dirname, '..');
  execFileSync(process.execPath, [
    require.resolve('typescript/bin/tsc'),
    '--module', 'commonjs', '--target', 'es2022', '--skipLibCheck',
    '--outDir', output, path.join(root, 'src', 'model.ts'),
    path.join(root, 'src', 'facts.ts'), path.join(root, 'src', 'dedupe.ts'),
    path.join(root, 'src', 'eligibility.ts'), path.join(root, 'src', 'store.ts'),
    path.join(root, 'src', 'drafting.ts'), path.join(root, 'src', 'approval.ts'),
    path.join(root, 'src', 'cli.ts'),
  ]);
  cached = (name) => require(path.join(output, `${name}.js`));
  return cached;
};
