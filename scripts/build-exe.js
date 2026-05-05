const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

// Clean dist
if (fs.existsSync(DIST)) {
  try { fs.rmSync(DIST, { recursive: true, force: true }); } catch { /* may be locked */ }
}
if (!fs.existsSync(DIST)) fs.mkdirSync(DIST);

// Build client
console.log('Building client...');
execSync('npm run build:client', { cwd: ROOT, stdio: 'inherit' });

// Rebuild better-sqlite3 for the pkg target Node version
const PKG_NODE_VERSION = '22.22.2';
console.log(`Rebuilding better-sqlite3 for Node ${PKG_NODE_VERSION}...`);
try {
  execSync(
    `npx node-gyp rebuild --target=${PKG_NODE_VERSION} --arch=x64 --directory=node_modules/better-sqlite3`,
    { cwd: ROOT, stdio: 'inherit' }
  );
} catch {
  console.log('node-gyp rebuild failed, trying npm rebuild with target...');
  execSync(
    `npm rebuild better-sqlite3 --build-from-source --target=${PKG_NODE_VERSION}`,
    { cwd: ROOT, stdio: 'inherit' }
  );
}

// Run pkg
console.log('Packaging executable...');
execSync('npx @yao-pkg/pkg . --compress GZip', { cwd: ROOT, stdio: 'inherit' });

// Copy native addon alongside exe
const nativeAddon = path.join(ROOT, 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node');
fs.copyFileSync(nativeAddon, path.join(DIST, 'better_sqlite3.node'));

console.log('');
console.log('Build complete! Output in dist/');
console.log('Distribute both files together:');
console.log('  - fpvtrackside-dvr-review.exe');
console.log('  - better_sqlite3.node');
