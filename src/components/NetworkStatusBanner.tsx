import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useTranslation } from 'react-i18next';

export function NetworkStatusBanner() {
  const { isOnline, wasOffline } = useNetworkStatus();
  const { t } = useTranslation();

  const show = !isOnline || wasOffline;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className={`fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-2 py-2 px-4 text-xs font-semibold ${
            isOnline
              ? 'bg-emerald-500 text-white'
              : 'bg-destructive text-destructive-foreground'
          }`}
        >
          {isOnline ? (
            <>
              <Wifi className="w-3.5 h-3.5" />
              {t('back_online')}
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5" />
              {t('no_connection')}
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
