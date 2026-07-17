import { getAllDocs } from './mdx';

export interface RelatedPage {
  title: string;
  href: string;
  section?: string;
  description?: string;
}

export async function getRelatedDocs(currentSlug: string, section?: string, tags: string[] = []): Promise<RelatedPage[]> {
  const allDocs = await getAllDocs();

  const scored = allDocs
    .filter(doc => doc.slug !== currentSlug)
    .map(doc => {
      let score = 0;

      const meta = doc.meta;
      if (!meta) return { title: doc.slug, href: `/docs/${doc.slug}`, score: 0 };

      // Same section = 3 points
      if (section && meta.section === section) {
        score += 3;
      }

      // Shared tags = 1 point each
      if (tags.length > 0 && meta.tags && Array.isArray(meta.tags)) {
        const sharedTags = tags.filter(t => meta.tags?.includes(t));
        score += sharedTags.length;
      }

      // Simple keyword overlap in title/description
      const currentTerms = currentSlug.split('/');
      const docTerms = doc.slug.split('/');
      const sharedTerms = currentTerms.filter(t => docTerms.includes(t));
      score += sharedTerms.length;

      return {
        title: meta.title || doc.slug,
        href: `/docs/${doc.slug}`,
        section: meta.section,
        description: meta.description,
        score
      };
    });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ score, ...rest }) => rest);
}
