const fs = require('fs');
const path = require('path');

async function copyRecursive(src, dest) {
  await fs.promises.mkdir(dest, { recursive: true });
  const entries = await fs.promises.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyRecursive(srcPath, destPath);
    } else {
      await fs.promises.copyFile(srcPath, destPath);
    }
  }
}

async function run() {
  const root = path.resolve(__dirname, '..');
  const srcStatic = path.join(root, '.next', 'static');
  const destStatic = path.join(root, '.next', 'standalone', '.next');
  const srcPublic = path.join(root, 'public');
  const destPublic = path.join(root, '.next', 'standalone', 'public');

  await fs.promises.rm(destStatic, { recursive: true, force: true });
  await fs.promises.rm(destPublic, { recursive: true, force: true });
  await copyRecursive(srcStatic, destStatic);
  await copyRecursive(srcPublic, destPublic);
}

run().catch((err) => {
  console.error('copy-static failed:', err);
  process.exit(1);
});
