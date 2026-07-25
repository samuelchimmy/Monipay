import { motion } from 'framer-motion';
import { TrendingUp, Users, Zap, Clock, DollarSign, Globe } from 'lucide-react';

const CASE_STUDIES = [
  {
    icon: TrendingUp,
    title: 'Street Vendor in Lagos',
    category: 'Merchant POS',
    metrics: [
      { label: 'Monthly Transactions', value: '1,200+' },
      { label: 'Avg. Settlement', value: '<2s' },
      { label: 'Hardware Cost', value: '$0' },
    ],
    quote: '"I used to lose 3-4 customers daily because I couldn\'t accept digital payments. Now my phone is my POS terminal."',
    result: 'Increased daily revenue by 40% by accepting stablecoin payments with zero hardware investment.',
  },
  {
    icon: Users,
    title: 'MoniBot Airdrop Campaign',
    category: 'Social AI Agent',
    metrics: [
      { label: 'Recipients Reached', value: '5,000' },
      { label: 'Avg. Distribution Time', value: '< 8s' },
      { label: 'Manual Work', value: '0 hrs' },
    ],
    quote: '"One tweet triggered 5,000 autonomous on-chain transfers. No spreadsheets, no manual sends, no errors."',
    result: 'Fully autonomous airdrop campaign — MoniBot verified participants, distributed funds, and replied with confirmations.',
  },
  {
    icon: Clock,
    title: 'Freelancer Cross-Border Payment',
    category: 'P2P Payments',
    metrics: [
      { label: 'Settlement Time', value: 'Instant' },
      { label: 'Fee vs Wire Transfer', value: '1% vs $45' },
      { label: 'No Intermediary Banks', value: '✓' },
    ],
    quote: '"My client in Dubai pays me via my MonìTag. It arrives instantly — no SWIFT, no conversion fees, no 5-day wait."',
    result: 'Eliminated $540/year in wire fees and reduced payment wait time from 3-5 days to under 2 seconds.',
  },
  {
    icon: Globe,
    title: 'E-Commerce Integration',
    category: 'Payment Gateway',
    metrics: [
      { label: 'Integration Time', value: '<1 hr' },
      { label: 'API Compatibility', value: 'Stripe-like' },
      { label: 'Checkout Conversion', value: '+22%' },
    ],
    quote: '"We integrated MoniPay\'s API in 45 minutes. pk_live/sk_live keys, webhooks, hosted checkout — it just works."',
    result: 'Crypto checkout conversion improved 22% vs previous wallet-popup flow by removing gas fees and network switching.',
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.4 } }),
};

export function CaseStudyCards() {
  return (
    <section className="py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <span className="inline-flex items-center bg-primary/10 text-primary rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest mb-4">
            Real Results
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground font-['Montserrat'] uppercase tracking-tight mb-4">
            Case <span className="text-primary">Studies</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Real-world scenarios showing how MoniPay eliminates friction at every step of the payment journey.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {CASE_STUDIES.map((study, i) => (
            <motion.div
              key={study.title}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              className="group rounded-2xl border border-border bg-card/50 backdrop-blur-sm overflow-hidden hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5"
            >
              {/* Header */}
              <div className="p-5 pb-0">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <study.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-foreground font-['Montserrat'] tracking-tight">{study.title}</h3>
                      <span className="text-[10px] font-bold text-primary uppercase tracking-widest">{study.category}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Metrics */}
              <div className="px-5 py-3">
                <div className="grid grid-cols-3 gap-2">
                  {study.metrics.map((metric) => (
                    <div key={metric.label} className="rounded-lg bg-muted/50 p-2.5 text-center">
                      <p className="text-sm font-extrabold text-primary font-['Montserrat']">{metric.value}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{metric.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quote & Result */}
              <div className="px-5 pb-5 space-y-3">
                <blockquote className="text-xs text-foreground/70 italic leading-relaxed border-l-2 border-primary/30 pl-3">
                  {study.quote}
                </blockquote>
                <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/10 p-3">
                  <DollarSign className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-foreground/80 leading-relaxed font-medium">{study.result}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
