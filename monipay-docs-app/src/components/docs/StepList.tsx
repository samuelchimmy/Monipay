import React from 'react';

interface StepProps {
  title: string;
  children: React.ReactNode;
}

export function StepList({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-12 my-12 relative before:absolute before:left-[19px] before:top-4 before:bottom-4 before:w-px before:bg-border">
      {children}
    </div>
  );
}

export function Step({ title, children }: StepProps) {
  return (
    <div className="relative pl-12">
      <div className="absolute left-0 top-0 w-10 h-10 bg-brand rounded-full flex items-center justify-center text-white font-bold text-lg border-4 border-surface z-10">
        {/* Number will be handled by CSS or passed as prop if needed, but for now just a dot or index */}
      </div>
      <h4 className="text-xl font-bold text-text-primary mb-4">{title}</h4>
      <div className="text-text-muted leading-7">{children}</div>
    </div>
  );
}
