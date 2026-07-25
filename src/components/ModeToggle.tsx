import { motion } from 'framer-motion';
import { usePayTag, AppMode } from '@/contexts/PayTagContext';
import { Store, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function ModeToggle() {
  const { mode, setMode, updatePreferredMode } = usePayTag();
  const { t } = useTranslation();

  const handleModeChange = (newMode: AppMode) => {
    setMode(newMode);
    // Persist to Supabase in background
    updatePreferredMode(newMode);
  };

  return (
    <div className="relative bg-muted/80 rounded-full p-0.5 flex items-center flex-shrink-0 border border-border/50">
      {/* Background Pill */}
      <motion.div
        className="absolute top-0.5 bottom-0.5 rounded-full bg-foreground"
        initial={false}
        animate={{
          left: mode === 'merchant' ? 2 : '50%',
          right: mode === 'merchant' ? '50%' : 2,
        }}
        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
      />

      {/* Merchant Button */}
      <button
        onClick={() => handleModeChange('merchant')}
        className={`
          relative z-10 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] transition-colors min-w-[80px]
          ${mode === 'merchant' ? 'text-background font-bold' : 'text-muted-foreground font-medium'}
        `}
      >
        <Store className="w-3 h-3 flex-shrink-0" />
        <span className="tracking-wider uppercase">{t('merchant_mode')}</span>
      </button>

      {/* User Button */}
      <button
        onClick={() => handleModeChange('user')}
        className={`
          relative z-10 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] transition-colors min-w-[80px]
          ${mode === 'user' ? 'text-background font-bold' : 'text-muted-foreground font-medium'}
        `}
      >
        <User className="w-3 h-3 flex-shrink-0" />
        <span className="tracking-wider uppercase">{t('personal_mode')}</span>
      </button>
    </div>
  );
}