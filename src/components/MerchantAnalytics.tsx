import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePayTag } from '@/contexts/PayTagContext';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, TrendingUp, DollarSign, ShoppingBag, 
  Calendar, ArrowUpRight, ArrowDownRight, Users, BarChart3,
  Download, UserCheck
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, BarChart as RechartsBarChart, Bar, Cell
} from 'recharts';
import { CustomersSection } from './CustomersSection';
import { exportTransactionsToCSV } from '@/lib/csvExport';

interface MerchantAnalyticsProps {
  onClose: () => void;
}

type TabType = 'analytics' | 'customers';

const COLORS = ['#0052FF', '#00C853', '#FF6D00', '#AA00FF', '#00B8D4'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function MerchantAnalytics({ onClose }: MerchantAnalyticsProps) {
  const { transactions, profile } = usePayTag();
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('7d');
  const [activeTab, setActiveTab] = useState<TabType>('analytics');

  const merchantTransactions = useMemo(() => 
    transactions.filter(tx => tx.type === 'received'),
    [transactions]
  );

  // Calculate stats
  const stats = useMemo(() => {
    const now = Date.now();
    const ranges = {
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      'all': Infinity,
    };

    const filtered = merchantTransactions.filter(tx => 
      now - tx.timestamp < ranges[timeRange]
    );

    const totalRevenue = filtered.reduce((sum, tx) => sum + (tx.amount - tx.fee), 0);
    const totalSales = filtered.length;
    const avgTransaction = totalSales > 0 ? totalRevenue / totalSales : 0;
    const totalFees = filtered.reduce((sum, tx) => sum + tx.fee, 0);

    // Growth comparison
    const prevFiltered = merchantTransactions.filter(tx => {
      const age = now - tx.timestamp;
      return age >= ranges[timeRange] && age < ranges[timeRange] * 2;
    });
    const prevRevenue = prevFiltered.reduce((sum, tx) => sum + (tx.amount - tx.fee), 0);
    const growth = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;

    // Retention rate
    const counterpartyCounts = new Map<string, number>();
    filtered.forEach(tx => {
      counterpartyCounts.set(tx.counterparty, (counterpartyCounts.get(tx.counterparty) || 0) + 1);
    });
    const uniqueCustomers = counterpartyCounts.size;
    const repeatCustomers = Array.from(counterpartyCounts.values()).filter(c => c > 1).length;
    const retentionRate = uniqueCustomers > 0 ? (repeatCustomers / uniqueCustomers) * 100 : 0;

    return { totalRevenue, totalSales, avgTransaction, totalFees, growth, retentionRate, uniqueCustomers, repeatCustomers };
  }, [merchantTransactions, timeRange]);

  // Revenue chart data
  const revenueChartData = useMemo(() => {
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 14;
    const data = [];
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    for (let i = days - 1; i >= 0; i--) {
      const dayStart = now - (i + 1) * dayMs;
      const dayEnd = now - i * dayMs;
      const dayTxs = merchantTransactions.filter(tx => 
        tx.timestamp >= dayStart && tx.timestamp < dayEnd
      );
      const revenue = dayTxs.reduce((sum, tx) => sum + (tx.amount - tx.fee), 0);
      const date = new Date(dayEnd);
      data.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: parseFloat(revenue.toFixed(2)),
        sales: dayTxs.length,
      });
    }
    return data;
  }, [merchantTransactions, timeRange]);

  // Day-of-week heatmap
  const dayOfWeekData = useMemo(() => {
    const days = Array(7).fill(0).map((_, i) => ({ day: DAY_NAMES[i], sales: 0, revenue: 0 }));
    merchantTransactions.forEach(tx => {
      const dow = new Date(tx.timestamp).getDay();
      days[dow].sales++;
      days[dow].revenue += (tx.amount - tx.fee);
    });
    return days;
  }, [merchantTransactions]);

  // Top customers
  const topProducts = useMemo(() => {
    const productMap = new Map<string, { count: number; revenue: number }>();
    merchantTransactions.forEach(tx => {
      const key = tx.counterparty;
      const existing = productMap.get(key) || { count: 0, revenue: 0 };
      productMap.set(key, {
        count: existing.count + 1,
        revenue: existing.revenue + (tx.amount - tx.fee),
      });
    });
    return Array.from(productMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [merchantTransactions]);

  // Hourly distribution
  const hourlyData = useMemo(() => {
    const hours = Array(24).fill(0).map((_, i) => ({ hour: i, sales: 0 }));
    merchantTransactions.forEach(tx => {
      const hour = new Date(tx.timestamp).getHours();
      hours[hour].sales++;
    });
    return hours.filter((_, i) => i >= 6 && i <= 22);
  }, [merchantTransactions]);

  const maxDaySales = Math.max(...dayOfWeekData.map(d => d.sales), 1);

  return (
    <motion.div
      initial={{ opacity: 0, x: '100%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed inset-0 z-50 bg-background overflow-y-auto"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold text-foreground flex-1">
            {activeTab === 'analytics' ? 'Analytics' : 'Customers'}
          </h1>
          
          {activeTab === 'analytics' && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => exportTransactionsToCSV(merchantTransactions)}
              >
                <Download className="w-3.5 h-3.5" />
                CSV
              </Button>
              <div className="flex bg-muted rounded-full p-1">
                {(['7d', '30d', 'all'] as const).map(range => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      timeRange === range 
                        ? 'bg-base-blue text-white' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {range === 'all' ? 'All' : range.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Tab Navigation */}
        <div className="container px-4 pb-2 flex gap-1">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeTab === 'analytics' 
                ? 'bg-base-blue text-white' 
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Analytics
          </button>
          <button
            onClick={() => setActiveTab('customers')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeTab === 'customers' 
                ? 'bg-base-blue text-white' 
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="w-4 h-4" />
            Customers
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'customers' ? (
          <motion.div
            key="customers"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="h-[calc(100vh-140px)]"
          >
            <CustomersSection 
              isOpen={true} 
              onClose={() => setActiveTab('analytics')} 
              profileId={profile?.id || ''} 
              embedded={true}
            />
          </motion.div>
        ) : (
          <motion.div
            key="analytics"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <div className="container px-4 py-6 space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-base-blue/10 flex items-center justify-center">
                      <DollarSign className="w-4 h-4 text-base-blue" />
                    </div>
                    <span className="text-xs text-muted-foreground">Revenue</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">${stats.totalRevenue.toFixed(2)}</p>
                  <div className={`flex items-center gap-1 text-xs mt-1 ${
                    stats.growth >= 0 ? 'text-success' : 'text-destructive'
                  }`}>
                    {stats.growth >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    <span>{Math.abs(stats.growth).toFixed(1)}%</span>
                  </div>
                </div>

                <div className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
                      <ShoppingBag className="w-4 h-4 text-success" />
                    </div>
                    <span className="text-xs text-muted-foreground">Sales</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{stats.totalSales}</p>
                  <p className="text-xs text-muted-foreground mt-1">Avg ${stats.avgTransaction.toFixed(2)}</p>
                </div>

                <div className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                      <UserCheck className="w-4 h-4 text-purple-500" />
                    </div>
                    <span className="text-xs text-muted-foreground">Retention</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{stats.retentionRate.toFixed(0)}%</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.repeatCustomers}/{stats.uniqueCustomers} repeat
                  </p>
                </div>

                <div className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-amber-500" />
                    </div>
                    <span className="text-xs text-muted-foreground">Balance</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    ${profile?.merchantBalance?.toFixed(2) || '0.00'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">USDC</p>
                </div>
              </div>

              {/* Revenue Chart */}
              <div className="bg-card border border-border rounded-2xl p-4">
                <h3 className="font-semibold text-foreground mb-4">Revenue Trend</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueChartData}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0052FF" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#0052FF" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={{ stroke: 'hsl(var(--border))' }} />
                      <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={{ stroke: 'hsl(var(--border))' }} tickFormatter={(value) => `$${value}`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                        formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="#0052FF" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Day-of-Week Heatmap */}
              <div className="bg-card border border-border rounded-2xl p-4">
                <h3 className="font-semibold text-foreground mb-4">Sales by Day of Week</h3>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={dayOfWeekData}>
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                        formatter={(value: number, name: string) => [
                          name === 'revenue' ? `$${value.toFixed(2)}` : value,
                          name === 'revenue' ? 'Revenue' : 'Sales'
                        ]}
                      />
                      <Bar dataKey="sales" radius={[4, 4, 0, 0]}>
                        {dayOfWeekData.map((entry, index) => (
                          <Cell 
                            key={index} 
                            fill={`rgba(0, 82, 255, ${0.2 + (entry.sales / maxDaySales) * 0.8})`} 
                          />
                        ))}
                      </Bar>
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Peak Hours */}
              <div className="bg-card border border-border rounded-2xl p-4">
                <h3 className="font-semibold text-foreground mb-4">Peak Sales Hours</h3>
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={hourlyData}>
                      <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(h) => `${h}:00`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                        formatter={(value: number) => [value, 'Sales']}
                        labelFormatter={(h) => `${h}:00`}
                      />
                      <Bar dataKey="sales" fill="#0052FF" radius={[4, 4, 0, 0]} />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Top Customers */}
              <div className="bg-card border border-border rounded-2xl p-4">
                <h3 className="font-semibold text-foreground mb-4">Top Customers</h3>
                {topProducts.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4 text-sm">No sales data yet</p>
                ) : (
                  <div className="space-y-3">
                    {topProducts.map((item, index) => (
                      <div key={item.name} className="flex items-center gap-3">
                        <div 
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        >
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground text-sm truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.count} orders</p>
                        </div>
                        <span className="font-bold text-foreground">${item.revenue.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
