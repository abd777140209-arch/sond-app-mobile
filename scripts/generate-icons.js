import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const svgPath = path.resolve('public/icon.svg');
const svgBuffer = fs.readFileSync(svgPath);

const mipmaps = [
  { dir: 'android/app/src/main/res/mipmap-mdpi', size: 48 },
  { dir: 'android/app/src/main/res/mipmap-hdpi', size: 72 },
  { dir: 'android/app/src/main/res/mipmap-xhdpi', size: 96 },
  { dir: 'android/app/src/main/res/mipmap-xxhdpi', size: 144 },
  { dir: 'android/app/src/main/res/mipmap-xxxhdpi', size: 192 },
];

async function generateIcons() {
  console.log('Generating Android Mipmap Icons...');

  for (const item of mipmaps) {
    if (!fs.existsSync(item.dir)) {
      fs.mkdirSync(item.dir, { recursive: true });
    }

    const launcherPath = path.join(item.dir, 'ic_launcher.png');
    const launcherRoundPath = path.join(item.dir, 'ic_launcher_round.png');

    await sharp(svgBuffer)
      .resize(item.size, item.size)
      .toFormat('png')
      .toFile(launcherPath);

    await sharp(svgBuffer)
      .resize(item.size, item.size)
      .toFormat('png')
      .toFile(launcherRoundPath);

    console.log(`Generated ${item.size}x${item.size} icons in ${item.dir}`);
  }

  console.log('Generating Web & Asset PNG Icons...');

  const webIcons = [
    { file: 'public/pwa-192.png', size: 192 },
    { file: 'public/pwa-512.png', size: 512 },
    { file: 'android/app/src/main/assets/public/pwa-192.png', size: 192 },
    { file: 'android/app/src/main/assets/public/pwa-512.png', size: 512 },
  ];

  if (fs.existsSync('dist')) {
    webIcons.push({ file: 'dist/pwa-192.png', size: 192 });
    webIcons.push({ file: 'dist/pwa-512.png', size: 512 });
    fs.copyFileSync('public/icon.svg', 'dist/icon.svg');
  }

  if (fs.existsSync('android/app/src/main/assets/public')) {
    fs.copyFileSync('public/icon.svg', 'android/app/src/main/assets/public/icon.svg');
  }

  for (const item of webIcons) {
    const dir = path.dirname(item.file);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    await sharp(svgBuffer)
      .resize(item.size, item.size)
      .toFormat('png')
      .toFile(item.file);

    console.log(`Generated ${item.size}x${item.size} at ${item.file}`);
  }

  console.log('All icons generated successfully!');
}

generateIcons().catch(err => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});
