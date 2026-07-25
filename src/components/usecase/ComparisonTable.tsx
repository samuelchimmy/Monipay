import { motion } from 'framer-motion';
import { Check, X, Minus } from 'lucide-react';

type CellValue = boolean | string;

interface ComparisonRow {
  feature: string;
  monipay: CellValue;
  stripe: CellValue;
  paypal: CellValue;
  metamask: CellValue;
}

const COMPARISON: ComparisonRow[] = [
  { feature: 'Zero Gas Fees for Users', monipay: true, stripe: false, paypal: false, metamask: false },
  { feature: 'No Seed Phrase / No MetaMask', monipay: true, stripe: false, paypal: false, metamask: false },
  { feature: 'Instant Settlement', monipay: true, stripe: false, paypal: false, metamask: true },
  { feature: 'Non-Custodial', monipay: true, stripe: false, paypal: false, metamask: true },
  { feature: 'Human-Readable Identity (@tag)', monipay: true, stripe: false, paypal: true, metamask: false },
  { feature: 'AI Social Agent (Airdrops/Payments)', monipay: true, stripe: false, paypal: false, metamask: false },
  { feature: 'No Hardware Required', monipay: true, stripe: false, paypal: true, metamask: true },
  { feature: 'Multi-Chain Support', monipay: true, stripe: false, paypal: false, metamask: true },
  { feature: 'REST API / Webhooks', monipay: true, stripe: true, paypal: true, metamask: false },
  { feature: 'No Monthly Fees', monipay: true, stripe: false, paypal: true, metamask: true },
  { feature: 'Transaction Fee', monipay: '1%', stripe: '2.9%+30¢', paypal: '2.9%+30¢', metamask: 'Gas fees' },
  { feature: 'On-Chain Transparency', monipay: true, stripe: false, paypal: false, metamask: true },
  { feature: 'Chargeback Risk', monipay: 'None', stripe: 'High', paypal: 'High', metamask: 'None' },
];

function CellIcon({ value }: { value: CellValue }) {
  if (typeof value === 'string') {
    return <span className="text-xs font-semibold text-foreground">{value}</span>;
  }
  return value ? (
    <Check className="w-4 h-4 text-primary mx-auto" />
  ) : (
    <X className="w-4 h-4 text-muted-foreground/40 mx-auto" />
  );
}

export function ComparisonTable() {
  return (
    <section className="py-16 px-4 bg-muted/30 border-y border-border/50">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <span className="inline-flex items-center bg-primary/10 text-primary rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest mb-4">
            Head-to-Head
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground font-['Montserrat'] uppercase tracking-tight mb-4">
            MoniPay vs <span className="text-primary">The Rest</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            See how MoniPay stacks up against traditional payment processors and crypto wallets.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-2xl border border-border bg-card/50 backdrop-blur-sm overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-xs font-bold text-muted-foreground uppercase tracking-wider min-w-[180px]">Feature</th>
                  <th className="p-4 text-center min-w-[100px]">
                    <span className="text-xs font-extrabold text-primary uppercase tracking-wider font-['Montserrat']">MoniPay</span>
                  </th>
                  <th className="p-4 text-center min-w-[100px]">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Stripe</span>
                  </th>
                  <th className="p-4 text-center min-w-[100px]">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">PayPal</span>
                  </th>
                  <th className="p-4 text-center min-w-[100px]">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">MetaMask</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr key={row.feature} className={`border-b border-border/50 ${i % 2 === 0 ? 'bg-muted/20' : ''}`}>
                    <td className="p-4 text-xs font-medium text-foreground">{row.feature}</td>
                    <td className="p-4 text-center"><CellIcon value={row.monipay} /></td>
                    <td className="p-4 text-center"><CellIcon value={row.stripe} /></td>
                    <td className="p-4 text-center"><CellIcon value={row.paypal} /></td>
                    <td className="p-4 text-center"><CellIcon value={row.metamask} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
