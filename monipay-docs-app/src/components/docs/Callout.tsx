import { Info, AlertTriangle, Lightbulb, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CalloutProps {
  type?: 'note' | 'warning' | 'tip' | 'danger';
  children: React.ReactNode;
}

export function Callout({ type = 'note', children }: CalloutProps) {
  const styles = {
    note: {
      bg: 'bg-blue-50 dark:bg-blue-900/10',
      border: 'border-blue-500',
      text: 'text-blue-800 dark:text-blue-300',
      icon: Info,
    },
    warning: {
      bg: 'bg-amber-50 dark:bg-amber-900/10',
      border: 'border-amber-500',
      text: 'text-amber-800 dark:text-amber-300',
      icon: AlertTriangle,
    },
    tip: {
      bg: 'bg-emerald-50 dark:bg-emerald-900/10',
      border: 'border-emerald-500',
      text: 'text-emerald-800 dark:text-emerald-300',
      icon: Lightbulb,
    },
    danger: {
      bg: 'bg-red-50 dark:bg-red-900/10',
      border: 'border-red-500',
      text: 'text-red-800 dark:text-red-300',
      icon: XCircle,
    },
  };

  const { bg, border, text, icon: Icon } = styles[type];

  return (
    <div className={cn('flex gap-4 p-4 my-6 rounded-r-lg border-l-4', bg, border)}>
      <Icon className={cn('w-5 h-5 shrink-0 mt-0.5', text)} />
      <div className={cn('text-sm leading-6', text)}>{children}</div>
    </div>
  );
}
