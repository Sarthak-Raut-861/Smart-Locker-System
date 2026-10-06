"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Lock } from 'lucide-react';

export const Footer: React.FC = () => {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login' || pathname === '/signup';

  if (isAuthPage) return null;

  return (
    <footer className="py-10 border-t border-white/10 bg-black/60 backdrop-blur-xl relative z-10">
      <div className="container mx-auto px-6 text-center">
        <Link href="/" className="inline-flex items-center gap-2.5 mb-4 group transition-all">
          <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
            <Lock className="text-primary w-4 h-4" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white font-outfit">
            Lockn<span className="text-primary">Leave</span>
          </span>
        </Link>
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.4em] mb-4">
          Secure IoT Storage Infrastructure &bull; &copy; {new Date().getFullYear()} LocknLeave
        </p>
        <div className="flex justify-center flex-wrap gap-6 text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">
           <Link href="/help" className="hover:text-white transition-colors">Help Center</Link>
           <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
           <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
           <Link href="/contact" className="hover:text-white transition-colors">Contact Support</Link>
        </div>
      </div>
    </footer>
  );
};
