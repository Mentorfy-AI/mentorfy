const fs = require('fs');
const path = require('path');
const wawoff2 = require('wawoff2');

const ttfDir = path.join(__dirname, '../public/fonts/neue-haas-grotesk-display-pro');
const woff2Dir = path.join(ttfDir, 'woff2');

// Ensure woff2 directory exists
if (!fs.existsSync(woff2Dir)) {
  fs.mkdirSync(woff2Dir, { recursive: true });
}

// Get all TTF files
const ttfFiles = fs.readdirSync(ttfDir).filter(file => file.endsWith('.ttf'));

console.log(`Converting ${ttfFiles.length} TTF files to WOFF2...\n`);

async function convertFiles() {
  for (const file of ttfFiles) {
    const ttfPath = path.join(ttfDir, file);
    const woff2Path = path.join(woff2Dir, file.replace('.ttf', '.woff2'));

    try {
      const ttfData = fs.readFileSync(ttfPath);
      const woff2Data = await wawoff2.compress(ttfData);
      fs.writeFileSync(woff2Path, woff2Data);

      const ttfSize = (fs.statSync(ttfPath).size / 1024).toFixed(2);
      const woff2Size = (fs.statSync(woff2Path).size / 1024).toFixed(2);
      const savings = ((1 - woff2Size / ttfSize) * 100).toFixed(1);

      console.log(`✓ ${file}`);
      console.log(`  ${ttfSize} KB → ${woff2Size} KB (${savings}% smaller)\n`);
    } catch (error) {
      console.error(`✗ Failed to convert ${file}:`, error.message);
    }
  }

  console.log('Conversion complete!');
}

convertFiles();
