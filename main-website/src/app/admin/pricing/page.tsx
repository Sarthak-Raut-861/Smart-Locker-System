"use client";

import { useAdminStore } from '@/store/useAdminStore';
import { Banknote, TrendingUp, Save, Zap } from 'lucide-react';
import { useState } from 'react';

export default function PricingPage() {
  const { lockers, showModal } = useAdminStore();
  const [threshold, setThreshold] = useState(90);
  const [multiplier, setMultiplier] = useState(1.2);

  const totalLockers = Object.keys(lockers).length || 20;
  const activeLockers = Object.values(lockers).filter(l => l.status === 'ACTIVE' || l.status === 'OCCUPIED').length;
  const occupancyPercent = totalLockers > 0 ? Math.round((activeLockers / totalLockers) * 100) : 0;
  
  const isSurgeActive = occupancyPercent >= threshold;

  const handleRunAlgorithm = () => {
    showModal(
      'Algorithm Simulation',
      `Current Network Occupancy: ${occupancyPercent}%\n\nResult: Surge is currently ${isSurgeActive ? 'ACTIVATED' : 'INACTIVE'}.\n\nAt this threshold, customers ${isSurgeActive ? `will be charged ${multiplier}x base rate` : 'will continue with standard pricing'}.`,
      isSurgeActive ? 'warning' : 'info'
    );
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white shadow-sm flex items-center gap-3">
          <Banknote className="w-8 h-8 text-primary" />
          Pricing Engine
        </h1>
        <p className="text-muted-foreground mt-1">Configure base rates and automated surge multipliers.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-panel p-6 rounded-2xl border border-white/5">
           <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
             <TrendingUp className="w-5 h-5 text-amber-400" />
             Auto-Dynamic Surge
           </h2>
           
           <div className="space-y-6">
             <div>
               <div className="flex justify-between mb-2">
                 <label className="text-sm text-muted-foreground">Current Network Occupancy</label>
                 <span className="text-sm font-bold text-white">{occupancyPercent}%</span>
               </div>
               <div className="w-full bg-white/5 rounded-full h-2.5 overflow-hidden">
                 <div className={`h-2.5 rounded-full ${isSurgeActive ? 'bg-red-500 shadow-[0_0_10px_#ef4444]' : 'bg-primary'}`} style={{ width: `${occupancyPercent}%` }}></div>
               </div>
             </div>

             <div className="space-y-4">
               <div>
                  <label className="text-sm text-gray-400 block mb-1">Surge Threshold (%)</label>
                  <input 
                    type="range" min="50" max="100" value={threshold} 
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="w-full accent-primary" 
                  />
                  <div className="text-right text-xs text-primary font-mono">{threshold}%</div>
               </div>
               <div>
                  <label className="text-sm text-gray-400 block mb-1">Surge Multiplier (x)</label>
                  <input 
                    type="number" step="0.1" value={multiplier}
                    onChange={(e) => setMultiplier(Number(e.target.value))}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
                  />
               </div>
             </div>

             <div className={`p-4 rounded-xl border ${isSurgeActive ? 'bg-red-500/10 border-red-500/30' : 'bg-white/5 border-white/5'}`}>
                <h3 className={`text-sm font-bold ${isSurgeActive ? 'text-red-400' : 'text-muted-foreground'}`}>
                  {isSurgeActive ? '⚠️ SURGE PRICING ACTIVE' : 'STANDARD PRICING ACTIVE'}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  At this exact moment, all new bookings would be charged at {isSurgeActive ? `${multiplier}x` : '1.0x'} the base rate.
                </p>
             </div>

             <button 
               onClick={handleRunAlgorithm}
               className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl transition-colors flex justify-center items-center gap-2"
             >
               <Zap className="w-4 h-4" />
               Run Simulation Algorithm
             </button>
           </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-white/5 flex flex-col">
           <h2 className="text-xl font-bold text-white mb-1">Coach Passenger Pricing Matrix</h2>
           <p className="text-xs text-muted-foreground mb-4">Indicative passenger-facing tariffs (Min 1 hr, Max 48 hrs) for railway coach installations.</p>
           
           <div className="flex-1 overflow-x-auto">
             <table className="w-full text-left text-xs text-gray-300">
               <thead className="uppercase text-muted-foreground border-b border-white/10 font-bold">
                 <tr>
                   <th className="py-2.5">Tier / Size</th>
                   <th className="py-2.5 text-center">1 Hr</th>
                   <th className="py-2.5 text-center">3 Hrs</th>
                   <th className="py-2.5 text-center">6 Hrs</th>
                   <th className="py-2.5 text-center">12 Hrs</th>
                   <th className="py-2.5 text-center">24 Hrs (1D)</th>
                   <th className="py-2.5 text-center">48 Hrs (2D)</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-white/5">
                 <tr>
                   <td className="py-3 font-semibold text-white">
                     <div>SMALL</div>
                     <div className="text-[10px] text-gray-500 font-normal">Backpack, laptop</div>
                   </td>
                   <td className="py-3 text-center text-primary font-bold">₹15</td>
                   <td className="py-3 text-center">₹35</td>
                   <td className="py-3 text-center">₹60</td>
                   <td className="py-3 text-center">₹90</td>
                   <td className="py-3 text-center">₹150</td>
                   <td className="py-3 text-center">₹260</td>
                 </tr>
                 <tr>
                   <td className="py-3 font-semibold text-white">
                     <div>MEDIUM <span className="text-[9px] text-emerald-400 bg-emerald-400/10 px-1 rounded">Base</span></div>
                     <div className="text-[10px] text-gray-500 font-normal">Cabin trolley + bag</div>
                   </td>
                   <td className="py-3 text-center text-primary font-bold">₹25</td>
                   <td className="py-3 text-center">₹55</td>
                   <td className="py-3 text-center">₹95</td>
                   <td className="py-3 text-center">₹140</td>
                   <td className="py-3 text-center">₹240</td>
                   <td className="py-3 text-center">₹420</td>
                 </tr>
                 <tr>
                   <td className="py-3 font-semibold text-white">
                     <div>LARGE</div>
                     <div className="text-[10px] text-gray-500 font-normal">Suitcase / multiple</div>
                   </td>
                   <td className="py-3 text-center text-primary font-bold">₹40</td>
                   <td className="py-3 text-center">₹85</td>
                   <td className="py-3 text-center">₹150</td>
                   <td className="py-3 text-center">₹220</td>
                   <td className="py-3 text-center">₹380</td>
                   <td className="py-3 text-center">₹680</td>
                 </tr>
               </tbody>
             </table>

             <div className="mt-4 pt-3 border-t border-white/5">
               <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Extension Add-on Rates</div>
               <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                 <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                   <div className="text-gray-400 font-bold mb-0.5">+30 Min</div>
                   <div className="text-white font-mono">₹10 / ₹15 / ₹20</div>
                 </div>
                 <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                   <div className="text-gray-400 font-bold mb-0.5">+1 Hour</div>
                   <div className="text-white font-mono">₹15 / ₹25 / ₹40</div>
                 </div>
                 <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                   <div className="text-gray-400 font-bold mb-0.5">+3 Hours</div>
                   <div className="text-white font-mono">₹35 / ₹55 / ₹85</div>
                 </div>
               </div>
             </div>
           </div>

           <button className="mt-4 w-full py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-colors flex justify-center items-center gap-2 border border-white/10">
             <Save className="w-4 h-4" />
             Save To Firestore
           </button>
        </div>
      </div>
    </div>
  );
}
