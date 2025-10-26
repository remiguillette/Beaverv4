import { build } from 'esbuild';
import { copyFile, mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const outDir = path.join(projectRoot, 'dist', 'public');

await mkdir(outDir, { recursive: true });

await build({
  entryPoints: [path.join(projectRoot, 'src', 'frontend', 'index.tsx')],
  bundle: true,
  outfile: path.join(outDir, 'bundle.js'),
  minify: true,
  sourcemap: true,
  target: ['es2018'],
  format: 'esm',
  loader: {
    '.css': 'css',
    '.svg': 'dataurl',
    '.png': 'dataurl',
    '.jpg': 'dataurl'
  },
  define: {
    'process.env.NODE_ENV': '"production"'
  }
});

const htmlSourcePath = path.join(projectRoot, 'src', 'frontend', 'index.html');
const htmlDestPath = path.join(outDir, 'index.html');

try {
  await copyFile(htmlSourcePath, htmlDestPath);
} catch (error) {
  if (error && error.code === 'ENOENT') {
    await writeFile(
      htmlDestPath,
      '<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8"/><title>Desktop Menu</title></head><body><div id="root"></div><script type="module" src="./bundle.js"></script></body></html>\n'
    );
  } else {
    throw error;
  }
}
