// Post-build script: inlines JS and CSS into index.html for file:// compatibility
import { readFileSync, writeFileSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '../build/apps/zoal-honeycomb');
const htmlPath = resolve(outDir, 'index.html');

let html = readFileSync(htmlPath, 'utf-8');

// Inline CSS: <link rel="stylesheet" href="./assets/...css">
html = html.replace(
  /<link rel="stylesheet" href="\.\/(assets\/[^"]+\.css)">/g,
  (_, cssPath) => {
    const css = readFileSync(resolve(outDir, cssPath), 'utf-8');
    return `<style>${css}</style>`;
  }
);

// Inline JS: <script type="module" crossorigin src="./assets/...js"></script>
html = html.replace(
  /<script type="module" crossorigin src="\.\/(assets\/[^"]+\.js)"><\/script>/g,
  (_, jsPath) => {
    const js = readFileSync(resolve(outDir, jsPath), 'utf-8');
    return `<script type="module">${js}</script>`;
  }
);

writeFileSync(htmlPath, html);
rmSync(resolve(outDir, 'assets'), { recursive: true, force: true });
console.log('Inlined JS/CSS into index.html');
