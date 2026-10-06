"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, Server, Activity, AlertCircle, 
  History, BarChart3, Banknote, ScrollText, 
  Wrench, Settings, LogOut, RefreshCw, Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { auth } from '@/lib/firebase/config';
import { signOut } from 'firebase/auth';
import { useAdminStore } from '@/store/useAdminStore';

const NAV_ITEMS = [
  { href: '/admin',            label: 'Dashboard',      icon: LayoutDashboard },
  { href: '/admin/lockers',    label: 'Lockers',         icon: Server          },
  { href: '/admin/sessions',   label: 'Active Sessions', icon: Activity        },
  { href: '/admin/alerts',     label: 'Alerts',          icon: AlertCircle, badge: true },
  { href: '/admin/history',    label: 'History',         icon: History         },
  { href: '/admin/analytics',  label: 'Analytics',       icon: BarChart3       },
  { href: '/admin/pricing',    label: 'Pricing Manager', icon: Banknote        },
  { href: '/admin/logs',       label: 'Admin Logs',      icon: ScrollText      },
  { href: '/admin/maintenance',label: 'Maintenance',     icon: Wrench          },
  { href: '/admin/settings',   label: 'Settings',        icon: Settings        },
];

export function Sidebar() {
  const pathname = usePathname();
  const alerts = useAdminStore((state) => state.alerts);
  const hasUnacknowledgedAlerts = alerts.some(a => !a.acknowledged);

  const handleReturnToSite = () => {
    window.location.href = '/';
  };

  return (
    <aside className="w-64 fixed h-full left-0 top-0 bg-sidebar border-r border-sidebar-border flex flex-col z-50 shadow-2xl">
      <div className="p-8 pb-10">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/40">
             <Layers className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-black text-sidebar-foreground font-outfit uppercase italic tracking-tighter leading-none">
              LocknLeave
            </h1>
            <p className="text-[8px] text-gray-400 font-black uppercase tracking-[0.2em] mt-1">Control Interface</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-1 custom-scrollbar">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          const shouldShowBadge = item.label === 'Alerts' && hasUnacknowledgedAlerts;

          return (
            <Link key={item.href} href={item.href} className="block relative focus:outline-none group">
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 bg-white/10 rounded-xl border border-white/20"
                  initial={false}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <div className={cn(
                "relative flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all",
                isActive ? "text-white translate-x-1" : "text-gray-400 hover:text-white hover:bg-white/5"
              )}>
                <item.icon className={cn("w-4 h-4 shrink-0 transition-transform group-hover:scale-110", isActive ? "text-white" : "text-gray-500")} />
                <span className="flex-1 truncate">{item.label}</span>
                {shouldShowBadge && (
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
                )}
              </div>
            </Link>
          );
        })}
      </div>

      <div className="p-6 mt-4 border-t border-sidebar-border">
        <button 
          onClick={handleReturnToSite}
          className="w-full flex items-center justify-center gap-2 bg-primary/10 hover:bg-primary hover:text-white text-primary py-3 rounded-xl font-black uppercase tracking-widest transition-all text-[10px] border border-primary/20 active:scale-95"
        >
          <LogOut className="w-3.5 h-3.5" />
          Return to Website
        </button>
      </div>
    </aside>
  );
}

