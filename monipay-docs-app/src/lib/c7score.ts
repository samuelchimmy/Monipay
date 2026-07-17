export interface C7Score {
  clarity: number;
  completeness: number;
  credibility: number;
  currency: number;
  consistency: number;
  connectivity: number;
  citability: number;
  total: number;
}

export function calculateC7Score(content: string, meta: any): C7Score {
  // Clarity: readability score (simplified approximation)
  const wordCount = content.split(/\s+/).length;
  const sentenceCount = content.split(/[.!?]+/).length;
  const clarity = Math.min(100, Math.max(0, 100 - (wordCount / sentenceCount - 15) * 2));

  // Completeness: has title, description, headings, examples, diagrams
  let completeness = 0;
  if (meta.title) completeness += 20;
  if (meta.description) completeness += 20;
  if (content.includes('## ')) completeness += 20;
  if (content.includes('```')) completeness += 20;
  if (content.includes('<DiagramRenderer')) completeness += 20;

  // Credibility: has external links to verified sources (explorers, GitHub)
  const links = (content.match(/https?:\/\/[^\s)]+/g) || []).length;
  const credibility = Math.min(100, links * 10);

  // Currency: how recently was page updated (days since update)
  const updatedDate = new Date(meta.updated || Date.now());
  const daysSinceUpdate = Math.floor((Date.now() - updatedDate.getTime()) / (1000 * 60 * 60 * 24));
  const currency = Math.max(0, 100 - daysSinceUpdate);

  // Consistency: terminology matches glossary definitions (simplified)
  const terms = ['MoniTag', 'non-custodial', 'gasless', 'MoniBot', 'MonipayRouter'];
  let consistencyCount = 0;
  terms.forEach(term => {
    if (content.includes(term)) consistencyCount++;
  });
  const consistency = (consistencyCount / terms.length) * 100;

  // Connectivity: internal links + external links count
  const internalLinks = (content.match(/\[[^\]]+\]\(\//g) || []).length;
  const connectivity = Math.min(100, (internalLinks + links) * 5);

  // Citability: has schema.org, headings are descriptive, has TL;DR
  let citability = 0;
  if (meta.schema_type) citability += 30;
  if (content.includes('## ')) citability += 40;
  if (content.includes('TL;DR') || content.includes('Summary')) citability += 30;

  const total = Math.round(
    (clarity + completeness + credibility + currency + consistency + connectivity + citability) / 7
  );

  return {
    clarity,
    completeness,
    credibility,
    currency,
    consistency,
    connectivity,
    citability,
    total,
  };
}
