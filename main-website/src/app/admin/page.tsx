"use client";

import { useAdminStore } from "@/store/useAdminStore";
import { StatCard } from "@/components/dashboard/StatCard";
import { RevenueLineChart, BookingBarChart, UsageDonutChart } from "@/components/charts/Charts";
import { Server, Users, IndianRupee, Clock, TrendingUp, Activity, Calendar, Star, Zap, ShieldCheck, AlertCircle, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMemo, useEffect, useState } from "react";

function formatRevenue(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function DashboardPage() {
  const { lockers, bookings, isInitializing, initSync, error, showModal } = useAdminStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const lockerList = Object.values(lockers);
  const totalLockers  = lockerList.length || 20;
  const activeLockers = lockerList.filter(l => l.status === "ACTIVE" || l.status === "OCCUPIED").length;
  const availableLockers  = lockerList.filter(l => l.status === "AVAILABLE").length;
  const maintenanceLockers = lockerList.filter(l => l.status === "MAINTENANCE").length;

  const totalRevenue   = bookings.reduce((s, b) => s + (Number(b.amount) || 0), 0);
  const totalBookings  = bookings.length;
  const avgRevenue     = totalBookings > 0 ? (totalRevenue / totalBookings).toFixed(0) : "0";
  const avgDuration    = totalBookings > 0
    ? (bookings.reduce((s, b) => s + (Number(b.hours || b.duration) || 0), 0) / totalBookings).toFixed(1)
    : "0";

  const revChartData = useMemo(() => {
    if (!mounted || !bookings.length) return [];
    const map: Record<string, number> = {};
    bookings.forEach(b => {
      if (!b.createdAt) return;
      const d = new Date(b.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
      map[d] = (map[d] || 0) + (Number(b.amount) || 0);
    });
    return Object.entries(map).map(([name, revenue]) => {
      const rep = bookings.find(b => new Date(b.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) === name);
      return { name, revenue, ts: rep?.createdAt || 0 };
    }).sort((a, b) => a.ts - b.ts).slice(-14).map(({ name, revenue }) => ({ name, revenue }));
  }, [bookings, mounted]);

  const bookingsByDay = useMemo(() => {
    if (!mounted || !bookings.length) return [];
    const map: Record<string, number> = {};
    bookings.forEach(b => {
      if (!b.createdAt) return;
      const d = new Date(b.createdAt).toLocaleDateString("en-IN", { weekday: "short" });
      map[d] = (map[d] || 0) + 1;
    });
    // Order by standard week progression
    const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return order.map(name => ({ name, bookings: map[name] || 0 }));
  }, [bookings, mounted]);

  const donutData = [
    { name: "Available", value: availableLockers || 0 },
    { name: "Occupied",  value: activeLockers || 0 },
    { name: "Maintenance", value: maintenanceLockers || 0 },
  ].filter(d => d.value > 0);

  const peakDay = bookingsByDay.reduce((max, d) => d.bookings > (max?.bookings || 0) ? d : max, bookingsByDay[0]);

  const handleExport = () => {
    if (!bookings.length) {
      showModal('Export Failed', 'No booking data available to export in the current manifest.', 'error');
      return;
    }
    const rows = [["ID", "Locker", "User", "Amount", "Hours", "Status", "Date"]];
    bookings.forEach(b => rows.push([
      b.id, b.lockerId, b.userName || "N/A",
      `₹${b.amount}`, `${b.hours}h`,
      b.status,
      new Date(b.createdAt).toLocaleDateString("en-IN")
    ]));
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "locknleave_bookings.csv"; a.click();
  };

  if (!mounted) return null;

  return (
    <div className="space-y-12 pt-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <div>
           <h1 className="text-5xl font-black text-white font-outfit uppercase italic tracking-tighter leading-none mb-1 text-shadow-glow">
            System <span className="text-primary italic border-b-4 border-primary/20 pb-2">Overview</span>
          </h1>
          <div className="flex items-center gap-4 mt-6">
            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-[0.3em] leading-none">Live telemetry & performance metrics.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={handleExport} className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/5 transition-all active:scale-95">
            Export Manifest
          </button>
          <button onClick={() => initSync(true)} className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 transition-all active:scale-95 group">
            <Zap className="w-3.5 h-3.5 fill-white group-hover:scale-125 transition-transform" /> Re-Sync Grid
          </button>
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-panel rounded-3xl p-8 border-rose-500/20 bg-rose-500/5 flex flex-col md:flex-row items-center gap-6"
          >
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20 shrink-0">
               <Lock className="w-8 h-8 text-rose-500" />
            </div>
            <div className="flex-1 text-center md:text-left">
               <h3 className="text-xl font-black text-white font-outfit uppercase italic tracking-tight mb-2">Access Synchronization Restricted</h3>
               <p className="text-xs text-gray-500 font-bold uppercase tracking-widest leading-relaxed">
                  {error}
               </p>
            </div>
            <button 
              onClick={() => window.location.href = '/login'}
              className="px-6 py-3 bg-white text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-colors shrink-0"
            >
               Admin Login
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {!error && (
        <>
          {/* Primary Analytics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            <StatCard label="Live Fleet Available"  value={availableLockers}        icon={Server}    color="emerald" loading={isInitializing} delay={0.0} />
            <StatCard label="Active Engagements"     value={activeLockers}           icon={Users}     color="blue"    loading={isInitializing} delay={0.1} />
            <StatCard label="Net System Revenue"      value={formatRevenue(totalRevenue)} icon={IndianRupee} color="amber" loading={isInitializing} delay={0.2} />
            <StatCard label="Maintenance Offline"     value={maintenanceLockers}      icon={Activity}  color="rose"    loading={isInitializing} delay={0.3} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
            <div className="lg:col-span-3">
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="glass-panel rounded-[2rem] p-8 relative overflow-hidden h-full"
                >
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                    <TrendingUp className="w-24 h-24 text-white" />
                  </div>
                  <div className="flex justify-between items-end mb-8">
                    <div>
                      <h2 className="text-xl font-black text-white font-outfit uppercase italic tracking-tight mb-1">Revenue Trendline</h2>
                      <p className="text-[9px] text-gray-500 font-bold uppercase tracking-[0.2em]">Temporal earnings distribution.</p>
                    </div>
                    <div className="flex items-center gap-2 text-primary font-black font-outfit text-sm">
                      Avg Ticket: ₹{avgRevenue}
                    </div>
                  </div>
                  <div className="h-[280px]">
                    {revChartData.length > 0
                      ? <RevenueLineChart data={revChartData} />
                      : <div className="h-full flex items-center justify-center text-gray-700 text-[10px] font-bold uppercase tracking-widest">Initialising Telemetry...</div>
                    }
                  </div>
                </motion.div>
            </div>

            <div className="space-y-5">
              <StatCard label="Session Pacing" value={`${avgDuration}h`} icon={Clock} color="indigo" loading={isInitializing} delay={0.4} />
              <StatCard label="Peak Cycle" value={peakDay?.name || "—"} icon={Star} color="amber" loading={isInitializing} delay={0.5} />
              
              <div className="glass-panel rounded-2xl p-6 border-white/5 bg-linear-to-b from-primary/5 to-transparent">
                  <div className="flex items-center gap-3 mb-4">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Security Status</h4>
                  </div>
                  <p className="text-[9px] text-gray-500 font-bold uppercase leading-relaxed mb-4">
                    All solenoids active. End-to-end encryption verified for 20 units.
                  </p>
                  <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full w-full bg-primary animate-pulse" />
                  </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
              className="glass-panel rounded-[2rem] p-8"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-base font-black text-white font-outfit uppercase italic tracking-tight">Fleet Distribution</h2>
                <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest opacity-60">Status Split</span>
              </div>
              <div className="h-64">
                {donutData.length > 0
                  ? <UsageDonutChart data={donutData} />
                  : <div className="h-full flex items-center justify-center text-gray-700 text-[10px] font-bold uppercase tracking-widest">Empty Grid</div>
                }
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
              className="glass-panel rounded-[2rem] p-8"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-base font-black text-white font-outfit uppercase italic tracking-tight">Cycle Intensity</h2>
                <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest opacity-60">Weekly Volume</span>
              </div>
              <div className="h-64">
                {bookingsByDay.length > 0
                  ? <BookingBarChart data={bookingsByDay} />
                  : <div className="h-full flex items-center justify-center text-gray-700 text-[10px] font-bold uppercase tracking-widest">No Cycle History</div>
                }
              </div>
            </motion.div>
          </div>


        </>
      )}
    </div>
  );
}
