import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { create, insert, search as oramaSearch } from '@orama/orama';

export interface SearchResult {
  title: string;
  description: string;
  href: string;
  section: string;
  excerpt: string;
  score: number;
}

const CONTENT_PATH = path.join(process.cwd(), 'content');

let db: any = null;

async function getOrCreateDB() {
  if (db) return db;

  db = await create({
    schema: {
      title: 'string',
      description: 'string',
      section: 'string',
      tags: 'string[]',
      body: 'string',
      href: 'string',
    },
  });

  // Index all MDX files
  const walk = (dir: string) => {
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        walk(filePath);
      } else if (file.endsWith('.mdx')) {
        const fileContents = fs.readFileSync(filePath, 'utf8');
        const { data, content } = matter(fileContents);
        const relativePath = path.relative(CONTENT_PATH, filePath);
        const slug = relativePath.replace(/\.mdx$/, '');

        // Strip MDX syntax for body
        const body = content
          .replace(/---[\s\S]*?---/, '') // redundant but safe
          .replace(/[#*`\-_\[\](){}|<>]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        insert(db, {
          title: data.title || slug,
          description: data.description || '',
          section: data.section || '',
          tags: data.tags || [],
          body,
          href: '/docs/' + slug.split(path.sep).join('/'),
        });
      }
    });
  };

  walk(CONTENT_PATH);
  return db;
}

export async function search(query: string, limit: number = 8): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) return [];

  const database = await getOrCreateDB();

  const results = await oramaSearch(database, {
    term: query,
    limit,
    boost: {
      title: 5,
      description: 3,
      section: 2,
      tags: 2,
      body: 1,
    },
  });

  return results.hits.map((hit: any) => ({
    title: hit.document.title,
    description: hit.document.description,
    href: hit.document.href,
    section: hit.document.section,
    excerpt: getExcerpt(hit.document.body, query),
    score: hit.score,
  }));
}

function getExcerpt(content: string, query: string): string {
  const q = query.toLowerCase();
  const lower = content.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) {
    const firstWord = q.split(/\s+/)[0];
    const wordIdx = lower.indexOf(firstWord);
    if (wordIdx === -1) return content.slice(0, 120) + '...';
    const start = Math.max(0, wordIdx - 40);
    const end = Math.min(content.length, wordIdx + 100);
    return (start > 0 ? '...' : '') + content.slice(start, end) + (end < content.length ? '...' : '');
  }
  const start = Math.max(0, idx - 40);
  const end = Math.min(content.length, idx + 100);
  return (start > 0 ? '...' : '') + content.slice(start, end) + (end < content.length ? '...' : '');
}
