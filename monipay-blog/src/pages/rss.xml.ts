import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';

export async function GET(context: APIContext) {
  const posts = await getCollection('posts');
  const sortedPosts = posts.sort(
    (a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime()
  );

  const siteUrl = 'https://blog.monipay.xyz';

  const items = sortedPosts
    .map((post) => {
      const pubDate = new Date(post.data.date).toUTCString();
      return `    <item>
      <title><![CDATA[${post.data.title}]]></title>
      <link>${siteUrl}/${post.data.slug}</link>
      <guid isPermaLink="true">${siteUrl}/${post.data.slug}</guid>
      <description><![CDATA[${post.data.description}]]></description>
      <pubDate>${pubDate}</pubDate>
      ${post.data.tags.map((t: string) => `<category>${t}</category>`).join('\n      ')}
    </item>`;
    })
    .join('\n');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Monipay Blog</title>
    <link>${siteUrl}</link>
    <description>Official blog for Monipay — smart stablecoin payments powered by AI. Technical deep dives, product updates, builder notes.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
