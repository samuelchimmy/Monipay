import { motion } from 'framer-motion';
import {
  FileText, ArrowUp, QrCode, ArrowDownLeft, User,
  BarChart3, ShoppingBag, Clock } from
'lucide-react';
import type { AppMode } from '@/contexts/PayTagContext';
import { feedback } from '@/lib/feedback';
import { useTranslation } from 'react-i18next';

export type PersonalTab = 'invoices' | 'send' | 'pay' | 'receive' | 'account';
export type MerchantTab = 'stats' | 'store' | 'charge' | 'history' | 'account';
export type BottomNavTab = PersonalTab | MerchantTab;

interface NavItem {
  id: BottomNavTab;
  labelKey: string;
  icon: React.ComponentType<{className?: string;}>;
  isCenter?: boolean;
}

const personalItems: NavItem[] = [
  { id: 'invoices', labelKey: 'invoice', icon: FileText },
  { id: 'send', labelKey: 'send', icon: ArrowUp },
  { id: 'pay', labelKey: 'pay', icon: QrCode, isCenter: true },
  { id: 'receive', labelKey: 'receive', icon: ArrowDownLeft },
  { id: 'account', labelKey: 'account', icon: User },
];

const merchantItems: NavItem[] = [
  { id: 'stats', labelKey: 'stats', icon: BarChart3 },
  { id: 'store', labelKey: 'store', icon: ShoppingBag },
  { id: 'charge', labelKey: 'charge', icon: QrCode, isCenter: true },
  { id: 'history', labelKey: 'history', icon: Clock },
  { id: 'account', labelKey: 'account', icon: User },
];

interface BottomNavProps {
  mode: AppMode;
  activeTab: BottomNavTab | null;
  onTabPress: (tab: BottomNavTab) => void;
  badge?: Partial<Record<BottomNavTab, number>>;
  accentColor?: string;
}

export function BottomNav({ mode, activeTab, onTabPress, badge, accentColor }: BottomNavProps) {
  const { t } = useTranslation();
  const items = mode === 'merchant' ? merchantItems : personalItems;

  return (
    <nav
      className="fixed bottom-4 left-4 right-4 z-50"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)'
      }}>

      <div className="mx-auto flex max-w-lg items-center justify-around rounded-[28px] px-3 py-2.5 bg-card shadow-[0_4px_32px_-4px_hsl(var(--foreground)/0.12)] dark:shadow-[0_4px_32px_-4px_hsl(0_0%_0%/0.5)] border border-border/50">
        {items.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          const badgeCount = badge?.[item.id];

          if (item.isCenter) {
            return (
              <motion.button
                key={item.id}
                whileTap={{ scale: 0.88 }}
                onClick={() => {
                  feedback('tap');
                  onTabPress(item.id);
                }}
                className="relative -mt-7 flex flex-col items-center">

                <motion.div
                  animate={isActive ? { scale: 1.08, y: -2 } : { scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                  className="flex h-[56px] w-[56px] items-center justify-center rounded-full"
                  style={{
                    backgroundColor: accentColor || 'hsl(var(--primary))',
                    boxShadow: isActive
                      ? `0 8px 24px ${accentColor ? accentColor.replace(')', ' / 0.5)').replace('hsl(', 'hsla(') : 'hsl(var(--primary) / 0.5)'}`
                      : `0 6px 20px ${accentColor ? accentColor.replace(')', ' / 0.4)').replace('hsl(', 'hsla(') : 'hsl(var(--primary) / 0.4)'}`
                  }}>

                  <Icon className="h-6 w-6 text-white" />
                </motion.div>
                <span className="mt-1 text-[10px] font-medium text-muted-foreground">{t(item.labelKey)}</span>
              </motion.button>);
          }

          return (
            <motion.button
              key={item.id}
              whileTap={{ scale: 0.92 }}
              onClick={() => {
                feedback('tap');
                onTabPress(item.id);
              }}
              className="relative flex min-w-[52px] flex-col items-center justify-center py-1 gap-0.5">

              {isActive ? (
                <motion.div
                  layoutId="navPill"
                  className="flex flex-col items-center gap-0.5"
                  transition={{ type: 'spring', stiffness: 520, damping: 34 }}>
                  <div className="relative">
                    <Icon className="h-5 w-5 text-foreground" />
                    {badgeCount != null && badgeCount > 0 && (
                      <span className="absolute -right-1.5 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-destructive px-0.5 text-[8px] font-bold text-destructive-foreground">
                        {badgeCount > 9 ? '9+' : badgeCount}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-foreground">{t(item.labelKey)}</span>
                  <motion.div
                    layoutId="navDot"
                    className="w-1 h-1 rounded-full bg-foreground"
                    transition={{ type: 'spring', stiffness: 520, damping: 34 }}
                  />
                </motion.div>
              ) : (
                <div className="flex flex-col items-center gap-0.5">
                  <div className="relative">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    {badgeCount != null && badgeCount > 0 && (
                      <span className="absolute -right-1.5 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-destructive px-0.5 text-[8px] font-bold text-destructive-foreground">
                        {badgeCount > 9 ? '9+' : badgeCount}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground">{t(item.labelKey)}</span>
                </div>
              )}
            </motion.button>);
        })}
      </div>
    </nav>);
}
