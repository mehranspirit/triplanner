import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const sourceSvg = readFileSync(join(publicDir, 'favicon.svg'));

const outputs = [
  { file: 'icon-512x512.png', size: 512 },
  { file: 'icon-192x192.png', size: 192 },
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'favicon-96x96.png', size: 96 },
];

for (const { file, size } of outputs) {
  await sharp(sourceSvg).resize(size, size).png().toFile(join(publicDir, file));
  console.log(`Wrote ${file} (${size}x${size})`);
}

await sharp(sourceSvg)
  .resize(32, 32)
  .png()
  .toFile(join(publicDir, 'favicon-32x32.png'));

await sharp(join(publicDir, 'favicon-32x32.png'))
  .toFile(join(publicDir, 'favicon.ico'));

console.log('Wrote favicon.ico');
