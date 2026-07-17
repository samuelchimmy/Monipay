import React from 'react';
import { Callout } from './Callout';
import { CodeBlock } from './CodeBlock';
import { StepList, Step } from './StepList';
import { ApiEndpoint } from './ApiEndpoint';
import { ChainBadge } from './ChainBadge';
import { ContractAddress } from './ContractAddress';
import { DiagramRenderer } from './DiagramRenderer';
import Link from 'next/link';

export const MDXComponents = {
  // Suppress MDX h1 by mapping to h2, h2 and h3 stay semantic
  h1: (props: any) => <h2 className="text-3xl font-extrabold mt-12 mb-6" {...props} />,
  h2: (props: any) => <h2 className="text-2xl font-extrabold mt-10 mb-5" {...props} />,
  h3: (props: any) => <h3 className="text-xl font-bold mt-8 mb-4" {...props} />,
  p: (props: any) => <p className="text-[16px] text-text-primary leading-[1.7] mb-6" {...props} />,
  ul: (props: any) => <ul className="list-disc ml-6 space-y-2 mb-6 text-[16px] text-text-primary" {...props} />,
  ol: (props: any) => <ol className="list-decimal ml-6 space-y-2 mb-6 text-[16px] text-text-primary" {...props} />,
  li: (props: any) => <li className="pl-1" {...props} />,
  blockquote: (props: any) => (
    <blockquote className="border-l-4 border-accent bg-accent/5 p-6 my-8 italic text-text-primary rounded-r-lg" {...props} />
  ),
  a: (props: any) => {
    const isExternal = props.href?.startsWith('http');
    if (isExternal) {
      return <a {...props} target="_blank" rel="noopener noreferrer" className="text-text-primary underline decoration-accent/30 hover:decoration-accent transition-all" />;
    }
    return <Link {...props} className="text-text-primary underline decoration-accent/30 hover:decoration-accent transition-all" />;
  },
  pre: (props: any) => {
    const children = React.Children.toArray(props.children)[0] as any;
    if (children && children.type === 'code') {
      const language = children.props.className?.replace('language-', '');
      const title = props['data-title'] || children.props.title;
      return (
        <CodeBlock
          language={language}
          title={title}
          {...children.props}
        >
          {children.props.children}
        </CodeBlock>
      );
    }
    return <pre {...props} />;
  },
  code: (props: any) => {
    // Inline code
    const isCommand = typeof props.children === 'string' && props.children.startsWith('!monibot');
    return (
      <code
        className={isCommand ? 'monibot-command' : ''}
        {...props}
      />
    );
  },
  table: (props: any) => (
    <div className="overflow-x-auto my-10 rounded-xl border border-border">
      <table className="w-full text-left border-collapse text-[15px]" {...props} />
    </div>
  ),
  thead: (props: any) => <thead className="bg-text-primary/5 border-b border-border" {...props} />,
  th: (props: any) => <th className="p-4 font-bold text-text-primary" {...props} />,
  td: (props: any) => <td className="p-4 text-text-primary border-t border-border align-top" {...props} />,
  
  // Custom Components
  Callout,
  CodeBlock,
  StepList,
  Step,
  ApiEndpoint,
  ChainBadge,
  ContractAddress,
  DiagramRenderer,
};
