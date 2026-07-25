# Monipay Blog

Official blog for [Monipay](https://monipay.xyz) — smart stablecoin payments powered by AI.

Built with [Astro](https://astro.build), deployed on [Vercel](https://vercel.com), powered by GitHub Markdown.

---

## Architecture

| Layer | Technology |
|-------|-----------|
| Framework | Astro 5 (static output) |
| Content | GitHub Markdown (`/content/posts/`) |
| Comments | Supabase (client-side, lazy-loaded) |
| Hosting | Vercel (static deployment) |
| SEO | Auto-generated sitemap, robots.txt, OG tags |

**No CMS. No server runtime. Pure static HTML.**

---

## Publishing a New Blog Post

### 1. Create a new Markdown file

```
content/posts/your-post-slug.md
```

### 2. Use this frontmatter template

```markdown
---
title: "Your Post Title Here"
slug: "your-post-slug"
description: "SEO meta description — keep under 160 characters."
date: "2026-05-15"
tags: ["payments", "crypto", "stablecoins"]
featured: false
cover: "https://cdn.example.com/your-cover-image.png"
ogImage: "https://cdn.example.com/your-og-image.png"
author: "Samuel Chiedozie"
---

# Your Post Title

Write your article content here in standard Markdown.
```

### 3. Supported Markdown formatting

- `# H1` / `## H2` / `### H3` headings
- Bullet lists and numbered lists
- `> Blockquotes`
- `[Links](https://example.com)`
- `` `inline code` `` and fenced code blocks
- `**bold**` and `*italic*`
- Images: `![alt](url)`
- Tables (GFM syntax)
- Horizontal rules: `---`

### 4. Publish

```bash
git add content/posts/your-post-slug.md
git commit -m "new post: Your Post Title"
git push
```

Vercel auto-deploys on push to `main`. Your post will be live within ~60 seconds.

---

## Frontmatter Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Post title (displays on page + SEO) |
| `slug` | string | Yes | URL path — must be URL-friendly |
| `description` | string | Yes | SEO meta description (≤160 chars) |
| `date` | string | Yes | Publish date in `YYYY-MM-DD` format |
| `tags` | string[] | No | Array of topic tags |
| `featured` | boolean | No | Mark as featured post |
| `cover` | string | No | Cover image URL (16:9 ratio ideal) |
| `ogImage` | string | No | OpenGraph image URL (falls back to cover) |
| `author` | string | No | Author name (defaults to "Samuel Chiedozie") |

---

## Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## Environment Variables

For the comments system to work, set these in Vercel:

```
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Supabase Setup

Run the SQL in `supabase-schema.sql` in your Supabase SQL editor to create the `monipay_comments` table with:
- Rate limiting (1 comment per IP fingerprint per 60 seconds)
- IP hash tracking for abuse protection
- Row Level Security (public read, public insert with rate limit trigger)

---

## Project Structure

```
/
├── content/posts/         # Blog post Markdown files (source of truth)
├── public/                # Static assets (logo, robots.txt, etc.)
├── src/
│   ├── components/        # Astro components (Comments, etc.)
│   ├── layouts/           # Base + BlogPost layouts
│   ├── pages/             # index.astro + [slug].astro
│   └── content.config.ts  # Content collection schema
├── astro.config.mjs       # Astro configuration
├── vercel.json            # Vercel deployment config
├── supabase-schema.sql    # Database schema for comments
└── package.json
```

---

## SEO Checklist

Every post automatically gets:
- `<title>` tag from frontmatter
- `<meta name="description">` from frontmatter
- `<link rel="canonical">` with full URL
- OpenGraph tags (title, description, image, type)
- Twitter Card tags (summary_large_image)
- `article:published_time` meta tag
- Inclusion in auto-generated sitemap

### SEO Rules (IMPORTANT)

- **Never change slugs after publishing** — URL stability is critical for rankings
- **Keep descriptions under 160 characters** — Google truncates beyond this
- **Use proper heading hierarchy** — H1 for title, H2 for sections, H3 for subsections
- **Keep titles clear and searchable** — think about what users would Google
- **Preserve URL stability** — 301 redirects only as last resort

---

## Images

Blog post images should be hosted externally for optimal performance:

1. **Recommended**: Upload to your CDN or cloud storage (Cloudflare R2, AWS S3, etc.)
2. **Quick option**: Use GitHub — upload images to an `assets` branch or use GitHub's image upload in issues
3. **Existing images**: Current posts use `cdn.hashnode.com` URLs which remain valid

In your Markdown, reference images with their full URL:

```markdown
![Alt description](https://your-cdn.com/path/to/image.png)
```

Cover images should be 16:9 aspect ratio (e.g., 1200x675px) for best card display.

---

## Links

- **App**: https://monipay.xyz
- **Docs**: https://docs.monipay.xyz
- **MoniBot**: https://monipay.xyz/monibot
- **X**: https://x.com/monipay_xyz
- **GitHub**: https://github.com/Monipay
- **Support**: https://monipay.xyz/support
