/**
 * MerchantActionGrid — compact 8-tile action box for the MiniPay
 * merchant mode. Replaces the old basic tools row.
 *
 * Tiles: Charge · Invoice · Store · Catalog · Quick Add · Stats ·
 *         Receive · Settings.
 *
 * Each tile expands into a sheet bound to the wallet's resolved
 * profileId (legacy or wallet_profiles, set by wallet-session).
 * No PIN, no key decryption.
 */

import { useState } from 'react';
import {
  Calculator, FileText, Store, Package, PlusCircle,
  BarChart3, QrCode, Settings as SettingsIcon,
} from 'lucide-react';
import { feedback } from '@/lib/feedback';

import { ChargeSheet } from './ChargeSheet';
import { StatsSheet } from './StatsSheet';
import { ReceiveQRSheet } from './ReceiveQRSheet';
import { QuickAddSheet } from './QuickAddSheet';

export type MerchantTile =
  | 'charge' | 'invoice' | 'store' | 'catalog'
  | 'quickadd' | 'stats' | 'receive' | 'settings';

interface Props {
  walletAddress: `0x${string}`;
  profileId: string;
  payTag: string | null;
  isLegacy: boolean;
  /** Tiles that delegate to existing modals managed by parent. */
  onOpenInvoice: () => void;
  onOpenCatalog: () => void;
  onOpenStore: () => void;
  onOpenSettings: () => void;
}

export function MerchantActionGrid({
  walletAddress, profileId, payTag, isLegacy,
  onOpenInvoice, onOpenCatalog, onOpenStore, onOpenSettings,
}: Props) {
  const [active, setActive] = useState<MerchantTile | null>(null);
  const close = () => setActive(null);

  const handle = (tile: MerchantTile) => {
    feedback('tap');
    switch (tile) {
      case 'invoice':  return onOpenInvoice();
      case 'catalog':  return onOpenCatalog();
      case 'store':    return onOpenStore();
      case 'settings': return onOpenSettings();
      default:         return setActive(tile);
    }
  };

  return (
    <>
      <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-black px-2 pt-1 pb-2">
        Merchant · <span className="opacity-70">most actions coming soon</span>
      </p>
      <div className="grid grid-cols-4 gap-2">
        <Tile icon={Calculator}  label="Charge"   onClick={() => handle('charge')}   disabled comingSoon />
        <Tile icon={QrCode}      label="Receive"  onClick={() => handle('receive')}  disabled comingSoon />
        <Tile icon={FileText}    label="Invoice"  onClick={() => handle('invoice')}  disabled comingSoon />
        <Tile icon={Store}       label="Store"    onClick={() => handle('store')}    disabled comingSoon />
        <Tile icon={Package}     label="Catalog"  onClick={() => handle('catalog')}  disabled comingSoon />
        <Tile icon={PlusCircle}  label="Quick Add" onClick={() => handle('quickadd')} disabled comingSoon />
        <Tile icon={BarChart3}   label="Stats"    onClick={() => handle('stats')}    disabled comingSoon />
        <Tile icon={SettingsIcon} label="Settings" onClick={() => handle('settings')} />
      </div>

      <ChargeSheet
        open={active === 'charge'}
        onClose={close}
        profileId={profileId}
        payTag={payTag}
      />
      <ReceiveQRSheet
        open={active === 'receive'}
        onClose={close}
        walletAddress={walletAddress}
        payTag={payTag}
      />
      <StatsSheet
        open={active === 'stats'}
        onClose={close}
        profileId={profileId}
      />
      <QuickAddSheet
        open={active === 'quickadd'}
        onClose={close}
        profileId={profileId}
        isLegacy={isLegacy}
      />
    </>
  );
}

function Tile({
  icon: Icon, label, onClick,
  disabled = false,
  comingSoon = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  comingSoon?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => { if (disabled) return; onClick(); }}
      disabled={disabled}
      aria-disabled={disabled}
      className={`relative group flex flex-col items-center justify-center gap-1 rounded-2xl border border-black/15 transition-all py-3 text-black ${disabled ? 'opacity-55 cursor-not-allowed' : 'active:scale-[0.98]'}`}
      style={{
        background:
          'linear-gradient(160deg, hsl(60 100% 90%) 0%, hsl(80 70% 86%) 55%, hsl(154 65% 88%) 100%)',
      }}
    >
      {comingSoon && (
        <span className="absolute -top-1.5 -right-1.5 text-[7px] font-extrabold uppercase tracking-wider bg-black text-[#FCFF52] rounded-full px-1.5 py-[1px] shadow-sm">Soon</span>
      )}
      <span className="h-9 w-9 rounded-full bg-black text-[#FCFF52] flex items-center justify-center">
        <Icon className="w-4 h-4" />
      </span>
      <span className="text-[10px] font-semibold tracking-wide text-black">{label}</span>
    </button>
  );
}