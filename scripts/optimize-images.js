import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const assetsDir = './src/assets/minipay';
const publicDir = './public/images';

async function optimizeMockups() {
  console.log('Optimizing phone mockups...');
  try {
    const lightInput = path.join(assetsDir, 'monibot-phone-light.png');
    const lightOutput = path.join(assetsDir, 'monibot-phone-light.webp');
    const darkInput = path.join(assetsDir, 'monibot-phone-dark.png');
    const darkOutput = path.join(assetsDir, 'monibot-phone-dark.webp');

    if (fs.existsSync(lightInput)) {
      await sharp(lightInput)
        .resize({ width: 620 })
        .webp({ quality: 82 })
        .toFile(lightOutput);
      console.log('✔ Optimized light mockup saved to WebP.');
    }

    if (fs.existsSync(darkInput)) {
      await sharp(darkInput)
        .resize({ width: 620 })
        .webp({ quality: 82 })
        .toFile(darkOutput);
      console.log('✔ Optimized dark mockup saved to WebP.');
    }
  } catch (err) {
    console.error('Error optimizing mockups:', err);
  }
}

async function optimizeAvatars() {
  console.log('Optimizing avatars...');
  try {
    const avatarDir = path.join(assetsDir, 'avatars');
    if (!fs.existsSync(avatarDir)) {
      console.log('Avatars directory not found.');
      return;
    }

    const files = fs.readdirSync(avatarDir);
    for (const file of files) {
      if (file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.png')) {
        const inputPath = path.join(avatarDir, file);
        const outputPath = path.join(avatarDir, file.replace(/\.(jpg|jpeg|png)$/, '_temp.jpg'));
        
        await sharp(inputPath)
          .resize(80, 80, { fit: 'cover' })
          .jpeg({ quality: 80 })
          .toFile(outputPath);

        // Replace original file with optimized one
        fs.unlinkSync(inputPath);
        fs.renameSync(outputPath, inputPath);
        console.log(`✔ Optimized avatar: ${file}`);
      }
    }
  } catch (err) {
    console.error('Error optimizing avatars:', err);
  }
}

async function optimizeBanner() {
  console.log('Optimizing sports promo banner...');
  try {
    const bannerInput = path.join(publicDir, 'conditional-sports-p2p-banner.jpg');
    const bannerOutput = path.join(publicDir, 'conditional-sports-p2p-banner.webp');

    if (fs.existsSync(bannerInput)) {
      await sharp(bannerInput)
        .resize({ width: 602 })
        .webp({ quality: 80 })
        .toFile(bannerOutput);
      console.log('✔ Optimized sports promo banner saved to WebP.');
    }
  } catch (err) {
    console.error('Error optimizing banner:', err);
  }
}

async function main() {
  await optimizeMockups();
  await optimizeAvatars();
  await optimizeBanner();
  console.log('All image optimization tasks completed!');
}

main();
