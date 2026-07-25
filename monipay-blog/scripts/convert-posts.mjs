import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'content', 'posts');

// Find all Hashnode-exported .md files (they have cuid filenames)
const mdFiles = fs.readdirSync(ROOT).filter(
  f => f.endsWith('.md') && f !== 'README.md' && /^cm[a-z0-9]+\.md$/.test(f)
);

console.log(`Found ${mdFiles.length} posts to convert\n`);

for (const file of mdFiles) {
  const raw = fs.readFileSync(path.join(ROOT, file), 'utf-8');
  
  // Parse frontmatter manually
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) {
    console.log(`  ⚠ Skipping ${file} (no frontmatter)`);
    continue;
  }
  
  const fmRaw = fmMatch[1];
  const body = fmMatch[2];
  
  // Extract fields from frontmatter
  const get = (key) => {
    const match = fmRaw.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
    return match ? match[1].trim().replace(/^["']|["']$/g, '') : '';
  };
  
  const title = get('title');
  const slug = get('slug');
  const seoDescription = get('seoDescription');
  const datePublished = get('datePublished');
  const cover = get('cover');
  const ogImage = get('ogImage');
  const tagsRaw = get('tags');
  
  // Parse date to YYYY-MM-DD
  const date = datePublished ? datePublished.split('T')[0] : '2026-01-01';
  
  // Parse tags from comma-separated to array
  const tags = tagsRaw
    ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean)
    : [];
  
  // Truncate description to 160 chars
  let description = seoDescription || '';
  if (description.length > 160) {
    description = description.substring(0, 157) + '...';
  }
  
  // Build new frontmatter
  const newFm = [
    '---',
    `title: "${title.replace(/"/g, '\\"')}"`,
    `slug: "${slug}"`,
    `description: "${description.replace(/"/g, '\\"')}"`,
    `date: "${date}"`,
    `tags: [${tags.map(t => `"${t}"`).join(', ')}]`,
    `featured: false`,
    cover ? `cover: "${cover}"` : null,
    ogImage ? `ogImage: "${ogImage}"` : null,
    `author: "Samuel Chiedozie"`,
    '---',
  ].filter(Boolean).join('\n');
  
  const output = newFm + '\n' + body;
  const outFile = path.join(OUT_DIR, `${slug}.md`);
  fs.writeFileSync(outFile, output, 'utf-8');
  console.log(`  ✅ ${slug}.md`);
}

console.log(`\nDone! ${mdFiles.length} posts converted to content/posts/`);
