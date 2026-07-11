/**
 * ScanPaySheet — personal-mode "Pay" tile. Opens a full-screen QR
 * scanner and routes the scanned payload to the right destination:
 *  - https://monipay.xyz/pay/<code>          → /pay/<code>
 *  - JSON MoniPay payload { payTag, amount } → /pay?to=<tag>&amount=<n>
 *  - 0x… EVM address                         → /pay?wallet=<addr>
 *  - any other http(s) URL                   → window.location = url
 *  - else                                    → toast "Unrecognized QR"
 */
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { QRScanner } from '@/components/QRScanner';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ScanPaySheet({ open, onClose }: Props) {
  const navigate = useNavigate();

  const handleScan = useCallback((text: string) => {
    const raw = (text || '').trim();
    if (!raw) return;
    onClose();

    // /pay/<code> anywhere in the string
    const linkMatch = raw.match(/\/pay\/([A-Za-z0-9_-]{4,})/);
    if (linkMatch) {
      navigate(`/pay/${linkMatch[1]}`);
      return;
    }

    // JSON MoniPay payload
    try {
      const obj = JSON.parse(raw);
      if (obj && typeof obj === 'object') {
        if (obj.payTag) {
          const qs = new URLSearchParams();
          qs.set('to', String(obj.payTag));
          if (obj.amount) qs.set('amount', String(obj.amount));
          navigate(`/pay?${qs.toString()}`);
          return;
        }
        const addr = obj.address || obj?.addresses?.evm;
        if (addr) {
          navigate(`/pay?wallet=${addr}`);
          return;
        }
      }
    } catch { /* not JSON */ }

    // Bare EVM address
    if (/^0x[a-fA-F0-9]{40}$/.test(raw)) {
      navigate(`/pay?wallet=${raw}`);
      return;
    }

    // Generic URL — only navigate to monipay.xyz to avoid open-redirect surprises
    try {
      const u = new URL(raw);
      if (/(^|\.)monipay\.xyz$/.test(u.hostname)) {
        window.location.href = raw;
        return;
      }
    } catch { /* not a URL */ }

    toast.error('Unrecognized QR code');
  }, [navigate, onClose]);

  if (!open) return null;
  return <QRScanner onScan={handleScan} onClose={onClose} />;
}