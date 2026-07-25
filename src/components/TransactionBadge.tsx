import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Bot, Gift, Receipt, ExternalLink, ShoppingCart, Globe, Sparkles } from 'lucide-react';

export type TransactionBadgeType = 
  | 'monibot_p2p' 
  | 'monibot_grant' 
  | 'invoice' 
  | 'external' 
  | 'payment_link' 
  | 'online_order'
  | 'magicpay';

interface TransactionBadgeProps {
  type: TransactionBadgeType;
  size?: 'sm' | 'md';
  className?: string;
}

const BADGE_CONFIG: Record<TransactionBadgeType, {
  label: string;
  icon: typeof Bot;
  className: string;
}> = {
  monibot_p2p: {
    label: 'MoniBot P2P',
    icon: Bot,
    className: 'bg-green-500/10 text-green-500 border-green-500/20',
  },
  monibot_grant: {
    label: 'MoniBot Grant',
    icon: Gift,
    className: 'bg-green-500/10 text-green-500 border-green-500/20',
  },
  invoice: {
    label: 'Invoice',
    icon: Receipt,
    className: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  },
  external: {
    label: 'External',
    icon: ExternalLink,
    className: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  },
  payment_link: {
    label: 'Payment Link',
    icon: ShoppingCart,
    className: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  },
  online_order: {
    label: 'Online Sale',
    icon: Globe,
    className: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  },
  magicpay: {
    label: 'MagicPay',
    icon: Sparkles,
    className: 'bg-purple-500/10 text-purple-500 border-purple-500/20 dark:bg-purple-500/20',
  },
};

export function TransactionBadge({ type, size = 'sm', className }: TransactionBadgeProps) {
  const config = BADGE_CONFIG[type];
  if (!config) return null;

  const Icon = config.icon;
  const iconSize = size === 'sm' ? 10 : 12;
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs';
  const padding = size === 'sm' ? 'px-1.5 py-0.5' : 'px-2 py-1';

  return (
    <Badge 
      variant="outline" 
      className={cn(
        'font-semibold gap-1 flex-shrink-0',
        padding,
        textSize,
        config.className,
        className
      )}
    >
      <Icon className="flex-shrink-0" style={{ width: iconSize, height: iconSize }} />
      {config.label}
    </Badge>
  );
}

/**
 * Determine which badges to show for a transaction
 */
export function getTransactionBadges(transaction: {
  source?: string;
  counterparty?: string;
  metadata?: {
    monibot_type?: 'p2p' | 'grant' | 'magicpay';
    is_monibot_transaction?: boolean;
  };
  invoiceId?: string;
  payerPayTag?: string;
}): TransactionBadgeType[] {
  const badges: TransactionBadgeType[] = [];

  const source = typeof transaction.source === 'string' ? transaction.source.trim().toLowerCase() : undefined;

  // MagicPay badge (Social Escrow)
  if (
    source === 'magicpay' ||
    source === 'iou' ||
    transaction.metadata?.monibot_type === 'magicpay' ||
    transaction.payerPayTag?.startsWith('MagicPay:') ||
    transaction.counterparty?.startsWith('MagicPay:')
  ) {
    badges.push('magicpay');
    return badges; // Primary badge, takes priority
  }

  // 1) Source is authoritative. If it explicitly says MoniBot, we show it.
  if (source === 'monibot_p2p') badges.push('monibot_p2p');
  if (source === 'monibot_grant') badges.push('monibot_grant');

  // 2) Only if source is missing, we may infer MoniBot from metadata.
  // (Never override an explicit, authoritative `source`.)
  if (!source) {
    const inferred = transaction.metadata?.monibot_type;
    if (inferred === 'p2p' || transaction.metadata?.is_monibot_transaction) {
      badges.push('monibot_p2p');
    } else if (inferred === 'grant' || transaction.payerPayTag?.toLowerCase() === 'monibot') {
      badges.push('monibot_grant');
    }
  }

  // Invoice badge
  if (transaction.invoiceId) {
    badges.push('invoice');
  }

  // Online sales badges
  if (source === 'payment_link') {
    badges.push('payment_link');
  } else if (source === 'online_order') {
    badges.push('online_order');
  }

  // External wallet badge - explicit source or inferred from raw address
  if (source === 'external') {
    badges.push('external');
  } else if (
    badges.length === 0 &&
    transaction.counterparty?.startsWith('0x') &&
    !transaction.payerPayTag
  ) {
    badges.push('external');
  }

  return badges;
}
