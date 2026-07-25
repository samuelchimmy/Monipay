import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://blog.monipay.xyz',
  trailingSlash: 'never',
  output: 'static',
  integrations: [sitemap()],
  image: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.hashnode.com',
      },
    ],
  },
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
    },
  },
});
