import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const OFFICIAL_GREEN_BNB_LOGO_BASE64 =
  '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';

const BG_COLOR = { r: 6, g: 130, b: 46, alpha: 1 };

async function generateAllIcons() {
  const sourceBuffer = Buffer.from(OFFICIAL_GREEN_BNB_LOGO_BASE64, 'base64');

  // 1. Generate 512x512 master PNG buffer
  const master512 = await sharp(sourceBuffer)
    .resize(512, 512, { fit: 'cover' })
    .png({ compressionLevel: 9 })
    .toBuffer();

  // Write Web public icons
  const publicTargets = [
    'public/logo.png',
    'public/bnb_logo.png',
    'public/app_icon.png',
    'android/app/src/main/ic_launcher-web.png',
    'android/app/src/main/res/drawable/splash.png',
  ];

  for (const relPath of publicTargets) {
    const fullPath = path.resolve(process.cwd(), relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, master512);
  }

  // Write Apple touch icon & favicons
  await sharp(master512).resize(180, 180).png().toFile(path.resolve(process.cwd(), 'public/apple-touch-icon.png'));
  const fav64 = await sharp(master512).resize(64, 64).png().toBuffer();
  fs.writeFileSync(path.resolve(process.cwd(), 'public/favicon.png'), fav64);
  fs.writeFileSync(path.resolve(process.cwd(), 'public/favicon.ico'), fav64);

  // Replace samity_logo.svg with embedded official green BNB logo so no black SVG remains
  const pngB64 = master512.toString('base64');
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <image href="data:image/png;base64,${pngB64}" width="512" height="512" />
</svg>\n`;
  fs.writeFileSync(path.resolve(process.cwd(), 'public/samity_logo.svg'), svgContent, 'utf8');

  // 2. Write Android mipmap icons across all densities
  const densities = [
    { dir: 'mipmap-mdpi', size: 48, fg: 108 },
    { dir: 'mipmap-hdpi', size: 72, fg: 162 },
    { dir: 'mipmap-xhdpi', size: 96, fg: 216 },
    { dir: 'mipmap-xxhdpi', size: 144, fg: 324 },
    { dir: 'mipmap-xxxhdpi', size: 192, fg: 432 },
  ];

  for (const { dir, size, fg } of densities) {
    const outDir = path.resolve(process.cwd(), 'android/app/src/main/res', dir);
    fs.mkdirSync(outDir, { recursive: true });

    // Standard launcher icon
    await sharp(master512)
      .resize(size, size, { fit: 'cover' })
      .png({ compressionLevel: 9 })
      .toFile(path.join(outDir, 'ic_launcher.png'));

    // Round launcher icon (circular mask with inner logo)
    const innerRoundSize = Math.round(size * 0.78);
    const resizedInnerRound = await sharp(master512)
      .resize(innerRoundSize, innerRoundSize, { fit: 'contain', background: BG_COLOR })
      .png()
      .toBuffer();

    const circleSvg = Buffer.from(
      `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#06822e"/></svg>`
    );

    const roundBase = await sharp(circleSvg)
      .composite([{ input: resizedInnerRound, gravity: 'center' }])
      .png()
      .toBuffer();

    const maskSvg = Buffer.from(
      `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#ffffff"/></svg>`
    );

    await sharp(roundBase)
      .composite([{ input: maskSvg, blend: 'dest-in' }])
      .png({ compressionLevel: 9 })
      .toFile(path.join(outDir, 'ic_launcher_round.png'));

    // Adaptive icon foreground (66% safe zone centered on solid #06822e background)
    const safeLogoSize = Math.round(fg * 0.66);
    const resizedFgLogo = await sharp(master512)
      .resize(safeLogoSize, safeLogoSize, { fit: 'contain', background: BG_COLOR })
      .png()
      .toBuffer();

    await sharp({
      create: {
        width: fg,
        height: fg,
        channels: 4,
        background: BG_COLOR,
      },
    })
      .composite([{ input: resizedFgLogo, gravity: 'center' }])
      .png({ compressionLevel: 9 })
      .toFile(path.join(outDir, 'ic_launcher_foreground.png'));
  }

  console.log('Official green BNB icons generated successfully across public/ and android/ mipmap directories.');
}

generateAllIcons().catch((err) => {
  console.error('Error generating official icons:', err);
  process.exit(1);
});
