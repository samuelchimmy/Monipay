import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const CONTENT_PATH = path.join(process.cwd(), 'content');
const OUTPUT_PATH = path.join(process.cwd(), 'public', 'sitemap.xml');
const OUTPUT_0_PATH = path.join(process.cwd(), 'public', 'sitemap-0.xml');
const OUTPUT_INDEX_PATH = path.join(process.cwd(), 'public', 'sitemap-index.xml');
const BASE_URL = 'https://docs.monipay.xyz';

function generateSitemap() {
  const allDocs: { slug: string; updated: string }[] = [];

  const walk = (dir: string) => {
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        walk(filePath);
      } else if (file.endsWith('.mdx')) {
        const fileContents = fs.readFileSync(filePath, 'utf8');
        const { data } = matter(fileContents);
        const relativePath = path.relative(CONTENT_PATH, filePath)
          .replace(/\.mdx$/, '')
          .replace(/\\/g, '/'); // Normalize backslashes for Windows
        
        allDocs.push({
          slug: relativePath,
          updated: data.updated || new Date().toISOString().split('T')[0],
        });
      }
    });
  };

  walk(CONTENT_PATH);

  // XML Header
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  const addedUrls = new Set<string>();

  // Static routes
  const staticRoutes = [
    { url: `${BASE_URL}/`, priority: '1.0' },
    { url: `${BASE_URL}/docs/changelog`, priority: '0.9' },
    { url: `${BASE_URL}/docs/roadmap`, priority: '0.9' },
    { url: `${BASE_URL}/docs/faq`, priority: '0.9' },
  ];

  const today = new Date().toISOString().split('T')[0];

  staticRoutes.forEach((route) => {
    if (!addedUrls.has(route.url)) {
      addedUrls.add(route.url);
      xml += `  <url>\n`;
      xml += `    <loc>${route.url}</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>${route.priority}</priority>\n`;
      xml += `  </url>\n`;
    }
  });

  // MDX routes
  allDocs.forEach((doc) => {
    const fullUrl = `${BASE_URL}/docs/${doc.slug}`;
    if (!addedUrls.has(fullUrl)) {
      addedUrls.add(fullUrl);
      const prioritySlugs = ['what-is-monipay', 'getting-started', 'how-it-works', 'concepts/monitag'];
      const priority = prioritySlugs.includes(doc.slug) ? '1.0' : '0.8';

      xml += `  <url>\n`;
      xml += `    <loc>${fullUrl}</loc>\n`;
      xml += `    <lastmod>${doc.updated}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>${priority}</priority>\n`;
      xml += `  </url>\n`;
    }
  });

  xml += `</urlset>\n`;

  fs.writeFileSync(OUTPUT_PATH, xml);
  fs.writeFileSync(OUTPUT_0_PATH, xml);

  let indexXml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  indexXml += `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  indexXml += `  <sitemap>\n`;
  indexXml += `    <loc>https://docs.monipay.xyz/sitemap-0.xml</loc>\n`;
  indexXml += `  </sitemap>\n`;
  indexXml += `</sitemapindex>\n`;

  fs.writeFileSync(OUTPUT_INDEX_PATH, indexXml);
  console.log('Sitemaps generated successfully at public/sitemap.xml, sitemap-0.xml, and sitemap-index.xml');
}

generateSitemap();
