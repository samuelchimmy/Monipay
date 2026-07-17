import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const CONTENT_PATH = path.join(process.cwd(), 'content');
const OUTPUT_PATH = path.join(process.cwd(), 'public', 'llms-full.txt');

// Order matching llms.txt structure
const taxonomy = [
  'what-is-monipay',
  'how-it-works',
  'concepts/resolution',
  'payments/iou',
  'monibot/fees',
  'glossary',
  'getting-started',
  'concepts/monitag',
  'payments/payment-links',
  'merchant/overview',
  'monibot/multi-recipient',
  'merchant/storefront',
  'mobile/overview',
  'mobile/deep-links',
  'monibot/discord',
  'monibot/telegram',
  'monibot/twitter',
  'developers/chrome-extension',
  'chains/celo',
  'chains/base',
  'chains/bsc',
  'chains/ink',
  'chains/solana',
  'security/solana-key-storage',
  'developers/api-reference',
  'merchant/webhooks',
  'contracts/overview',
  'contracts/tempo',
  'concepts/reserved-usernames',
  'concepts/walkaway-test',
  'roadmap',
  'faq',
];

function generateLLMSFull() {
  let fullText = '';

  // Get all files to handle those not in taxonomy too
  const allFiles: string[] = [];
  const walk = (dir: string) => {
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        walk(filePath);
      } else if (file.endsWith('.mdx')) {
        const relativePath = path.relative(CONTENT_PATH, filePath).replace(/\.mdx$/, '');
        allFiles.push(relativePath);
      }
    });
  };
  walk(CONTENT_PATH);

  const orderedFiles = [...new Set([...taxonomy, ...allFiles])];

  orderedFiles.forEach((slug) => {
    const filePath = path.join(CONTENT_PATH, slug + '.mdx');
    if (fs.existsSync(filePath)) {
      const fileContents = fs.readFileSync(filePath, 'utf8');
      const { content } = matter(fileContents);

      fullText += `# \nSource: https://docs.monipay.xyz/docs/${slug}\n\n`;
      fullText += content.trim();
      fullText += '\n\n';
    }
  });

  fs.writeFileSync(OUTPUT_PATH, fullText);
  console.log('llms-full.txt generated successfully.');
}

generateLLMSFull();
