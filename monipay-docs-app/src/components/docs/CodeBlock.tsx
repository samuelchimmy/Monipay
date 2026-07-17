import { highlight } from '@/lib/shiki';
import { CodeBlockClient } from './CodeBlockClient';

interface CodeBlockProps {
  children: string;
  language?: string;
  title?: string;
}

export async function CodeBlock({ children, language = 'typescript', title }: CodeBlockProps) {
  const code = (typeof children === 'string' ? children : '').trim();
  const html = await highlight(code, language);

  return (
    <CodeBlockClient 
      code={code} 
      html={html} 
      language={language} 
      title={title} 
    />
  );
}
