import { AdminLayout } from '@/components/admin/AdminLayout';
import { getAllDocs } from '@/lib/mdx';
import { calculateC7Score } from '@/lib/c7score';
import { FileText, Globe, BarChart3, Zap, AlertCircle, TrendingUp, CheckCircle2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export default async function AdminPage() {
  const allDocs = await getAllDocs();
  
  const docsWithScores = allDocs
    .filter((doc): doc is { meta: any; content: string; slug: string } => doc !== null)
    .map(doc => ({
      ...doc,
      score: calculateC7Score(doc.content, doc.meta)
    }));

  const averageScore = docsWithScores.length > 0 
    ? Math.round(docsWithScores.reduce((acc, doc) => acc + doc.score.total, 0) / docsWithScores.length)
    : 0;

  const lowScoreDocs = docsWithScores.filter(doc => doc.score.total < 70);

  const stats = [
    { label: 'Total Pages', value: docsWithScores.length.toString(), icon: FileText, color: 'text-blue-500' },
    { label: 'C7Score Avg', value: `${averageScore}/100`, icon: Zap, color: 'text-amber-500' },
    { label: 'Needs Attention', value: lowScoreDocs.length.toString(), icon: AlertCircle, color: 'text-danger' },
    { label: 'SEO Health', value: '94%', icon: Globe, color: 'text-purple-500' },
  ];

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text-primary tracking-tight">Dashboard</h1>
            <p className="text-text-muted">Welcome back, Admin. Here's what's happening with Monipay Docs.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="px-4 py-2 bg-brand/10 text-brand rounded-lg border border-brand/20 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span className="font-bold text-lg">{averageScore}</span>
              <span className="text-xs font-medium uppercase tracking-wider opacity-70">Avg C7Score</span>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => (
            <div key={stat.label} className="p-6 bg-white dark:bg-gray-900 border border-border rounded-2xl shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className={cn("p-2 bg-gray-50 dark:bg-gray-800 rounded-lg", stat.color)}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-success">+12%</span>
              </div>
              <div className="text-2xl font-bold text-text-primary">{stat.value}</div>
              <div className="text-xs font-medium text-text-muted uppercase tracking-wider">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-gray-900 border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-border bg-gray-50/50 dark:bg-gray-800/50 flex items-center justify-between">
            <h2 className="font-bold text-lg">Content Audit</h2>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
              <input 
                type="text" 
                placeholder="Filter pages..." 
                className="pl-9 pr-4 py-1.5 bg-white dark:bg-gray-900 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/50"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-gray-800/50 text-[10px] font-bold uppercase tracking-widest text-text-subtle">
                  <th className="px-6 py-3">Page</th>
                  <th className="px-6 py-3">Clarity</th>
                  <th className="px-6 py-3">Completeness</th>
                  <th className="px-6 py-3">Currency</th>
                  <th className="px-6 py-3">Total Score</th>
                  <th className="px-6 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {docsWithScores.sort((a, b) => b.score.total - a.score.total).slice(0, 10).map((doc) => (
                  <tr key={doc.slug} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-sm text-text-primary">{doc.meta.title}</div>
                      <div className="text-xs text-text-subtle">/{doc.slug}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-24 bg-border h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-blue-500 h-full" 
                          style={{ width: `${doc.score.clarity}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-24 bg-border h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-purple-500 h-full" 
                          style={{ width: `${doc.score.completeness}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-24 bg-border h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-orange-500 h-full" 
                          style={{ width: `${doc.score.currency}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-1 rounded text-xs font-bold",
                        doc.score.total >= 80 ? "bg-green-500/10 text-green-500" :
                        doc.score.total >= 60 ? "bg-yellow-500/10 text-yellow-500" :
                        "bg-red-500/10 text-red-500"
                      )}>
                        {doc.score.total}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 border border-border rounded text-[10px] font-bold uppercase tracking-widest text-text-subtle">
                        Published
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
