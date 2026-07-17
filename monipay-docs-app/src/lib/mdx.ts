import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const CONTENT_PATH = path.join(process.cwd(), 'content');

export interface DocMeta {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  updated?: string;
  section?: string;
  tags?: string[];
  keywords?: string[];
  faq?: { q: string; a: string }[];
}

export interface Doc {
  meta: DocMeta;
  content: string;
  slug: string;
}

export async function getDocBySlug(slug: string[]): Promise<Doc | null> {
  const fullPath = path.join(CONTENT_PATH, ...slug) + '.mdx';
  if (!fs.existsSync(fullPath)) return null;
  
  const fileContents = fs.readFileSync(fullPath, 'utf8');
  const { data, content } = matter(fileContents);
  
  return {
    meta: data as DocMeta,
    content,
    slug: slug.join('/'),
  };
}

export async function getAllDocs(): Promise<Doc[]> {
  const walk = (dir: string): string[][] => {
    let results: string[][] = [];
    if (!fs.existsSync(dir)) return [];
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        results = results.concat(walk(filePath));
      } else if (file.endsWith('.mdx')) {
        const relativePath = path.relative(CONTENT_PATH, filePath);
        const slug = relativePath.replace(/\.mdx$/, '').split(path.sep);
        results.push(slug);
      }
    });
    return results;
  };
  
  const slugs = walk(CONTENT_PATH);
  const docs = await Promise.all(
    slugs.map(async (slug) => {
      return await getDocBySlug(slug);
    })
  );

  return docs.filter((doc): doc is Doc => doc !== null);
}
