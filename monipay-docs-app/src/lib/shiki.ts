import { createHighlighter, type Highlighter } from 'shiki';

let highlighter: Highlighter | null = null;

export async function highlight(code: string, lang: string = 'typescript') {
  if (!highlighter) {
    highlighter = await createHighlighter({
      themes: ['github-dark'],
      langs: ['typescript', 'javascript', 'bash', 'json', 'solidity', 'markdown', 'yaml', 'http'],
    });
  }

  return highlighter.codeToHtml(code, {
    lang,
    theme: 'github-dark',
  });
}
