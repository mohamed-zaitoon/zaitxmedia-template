const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const pngToIco = require('png-to-ico');

async function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function generate(srcPath, outBase) {
  if (!fs.existsSync(srcPath)) {
    console.error('Source image not found:', srcPath);
    process.exit(1);
  }

  const outDir = path.dirname(outBase);
  await ensureDir(outDir);

  const sizes = [16, 32, 48, 180, 192, 512];
  const generated = [];

  for (const size of sizes) {
    const out = `${outBase}-${size}.png`;
    await sharp(srcPath).resize(size, size, { fit: 'cover' }).png().toFile(out);
    generated.push(out);
    console.log('Wrote', out);
  }

  // create favicon.ico from 16,32,48
  const icoOut = `${outBase}.ico`;
  const icoBuffer = await pngToIco([`${outBase}-16.png`, `${outBase}-32.png`, `${outBase}-48.png`]);
  fs.writeFileSync(icoOut, icoBuffer);
  console.log('Wrote', icoOut);

  // copy 512 as the main png icon
  const png512 = `${outBase}-512.png`;
  const pngOut = `${outBase}-icon-512.png`;
  fs.copyFileSync(png512, pngOut);
  console.log('Wrote', pngOut);

  // apple touch icon (180)
  const appleSrc = `${outBase}-180.png`;
  const appleOut = `${outBase}-apple-touch.png`;
  fs.copyFileSync(appleSrc, appleOut);
  console.log('Wrote', appleOut);
}

async function main() {
  // Expect source images at public/user-logo-source.png and public/admin-logo-source.png
  const publicDir = path.join(__dirname, '..', 'public');
  await generate(path.join(publicDir, 'user-logo-source.png'), path.join(publicDir, 'user-logo'));
  await generate(path.join(publicDir, 'admin-logo-source.png'), path.join(publicDir, 'admin-logo'));
  console.log('All done. Generated favicons and icons in public/.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
