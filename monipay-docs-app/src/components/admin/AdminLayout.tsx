'use client';

import { useState } from 'react';
import { LayoutDashboard, FileText, Globe, BarChart3, Settings, LogOut, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [activeTab, setActiveTab] = useState('dashboard');

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'content', label: 'Content', icon: FileText },
    { id: 'seo', label: 'SEO', icon: Globe },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-surface flex">
      <aside className="w-64 border-r border-border flex flex-col">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-2 font-bold text-lg">
            <div className="w-6 h-6 bg-brand rounded flex items-center justify-center text-white text-xs">M</div>
            Admin Panel
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
                activeTab === item.id 
                  ? "bg-brand text-white shadow-lg shadow-brand/20" 
                  : "text-text-muted hover:bg-gray-100 dark:hover:bg-gray-800"
              )}
            >
              <div className="flex items-center gap-3">
                <item.icon className="w-4 h-4" />
                {item.label}
              </div>
              {activeTab === item.id && <ChevronRight className="w-4 h-4" />}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-border">
          <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-danger hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-all">
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-8">
        {children}
      </main>
    </div>
  );
}
