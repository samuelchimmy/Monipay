import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { getNavigation } from '../src/lib/navigation';

const CONTENT_PATH = path.join(process.cwd(), 'content');

function getAllLinksInContent() {
  const links = new Set<string>();
  const walk = (dir: string) => {
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        walk(filePath);
      } else if (file.endsWith('.mdx')) {
        const content = fs.readFileSync(filePath, 'utf8');
        // Extract internal links like [text](/docs/slug) or [text](/slug)
        const internalLinkRegex = /\[.*?\]\((?:\/docs)?\/(.*?)\)/g;
        let match;
        while ((match = internalLinkRegex.exec(content)) !== null) {
          links.add(match[1].replace(/^\//, ''));
        }
      }
    });
  };
  walk(CONTENT_PATH);
  return links;
}

function checkOrphans() {
  const navigation = getNavigation();
  const navLinks = new Set<string>();
  navigation.forEach(section => {
    section.items.forEach(item => {
      navLinks.add(item.href.replace(/^\/docs\//, '').replace(/^\//, ''));
    });
  });

  const contentLinks = getAllLinksInContent();
  const allReachable = new Set([...navLinks, ...contentLinks]);

  const allFiles: string[] = [];
  const walk = (dir: string) => {
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        walk(filePath);
      } else if (file.endsWith('.mdx')) {
        allFiles.push(path.relative(CONTENT_PATH, filePath).replace(/\.mdx$/, '').replace(/\\/g, '/'));
      }
    });
  };
  walk(CONTENT_PATH);

  const orphans = allFiles.filter(file => !allReachable.has(file));

  if (orphans.length > 0) {
    console.error('ERROR: Found orphan MDX files (unreachable from sidebar or internal links):');
    orphans.forEach(o => console.error(` - ${o}`));
    process.exit(1);
  } else {
    console.log('No orphan files found.');
  }
}

checkOrphans();
