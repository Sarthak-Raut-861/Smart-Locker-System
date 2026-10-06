"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Lock, Coins, LogOut, ArrowLeft, User } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { auth } from '@/lib/firebase/config';

export const Navbar: React.FC = () => {
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, initAuth } = useAuthStore();

  useEffect(() => {
    initAuth();
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = async () => {
    await auth.signOut();
    setIsMobileMenuOpen(false);
    router.push('/');
  };

  const pathname = usePathname();
  const isHome = pathname === '/';
  const isAuthPage = pathname === '/login' || pathname === '/signup';

  if (isAuthPage) return null;

  return (
    <nav 
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
        isScrolled 
        ? 'bg-black/80 backdrop-blur-2xl border-b border-white/10 py-2 shadow-lg' 
        : 'bg-black/40 backdrop-blur-sm border-b border-white/5 py-3'
      }`}
    >
      <div className="container mx-auto px-6 flex justify-between items-center">
        <div className="flex items-center gap-4">
          {!isHome && (
            <button 
              onClick={() => router.back()}
              className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-white/20 transition-all group"
            >
              <ArrowLeft className="w-4 h-4 text-gray-400 group-hover:text-white group-hover:-translate-x-0.5 transition-all" />
            </button>
          )}

          <Link href={user ? '/dashboard' : '/'} className="group flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
              <Lock className="text-primary w-5 h-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white font-outfit">
              Lockn<span className="text-primary">Leave</span>
            </span>
          </Link>
        </div>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          {user && !isHome ? (
            <>
              <div className="relative group">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 cursor-pointer"
                >
                  <Coins className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-black text-amber-500 font-outfit">{user.credits || 0}</span>
                </motion.div>

                {/* Loyalty Dropdown */}
                <div className="absolute top-full right-0 mt-3 w-72 p-5 bg-[#0f172a]/95 border border-amber-500/30 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] backdrop-blur-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible translate-y-[-10px] group-hover:translate-y-0 transition-all duration-300 pointer-events-none z-[100]">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-linear-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/40">
                      <Lock className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                      <div className="text-white font-bold text-base font-outfit leading-tight">Loyalty Credits</div>
                      <div className="text-amber-500 text-xs font-bold mt-0.5">10 Credits = ₹1.00 Off</div>
                    </div>
                  </div>
                  <p className="text-gray-400 text-[11px] leading-relaxed text-left font-medium">
                    Earn credits automatically by ending your locker sessions early. Use them to save on future bookings!
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-2 text-gray-400">
                <User className="w-4 h-4" />
                <span className="text-sm font-bold font-outfit">{user.name || 'User'}</span>
              </div>
              <button 
                onClick={handleLogout}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary hover:bg-primary hover:text-white transition-all text-xs font-bold uppercase tracking-widest shadow-lg shadow-primary/5"
              >
                <LogOut className="w-3.5 h-3.5" />
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm font-semibold text-white/80 hover:text-white transition-colors tracking-wide uppercase">Login</Link>
              <Link href="/signup" className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-full text-sm font-bold shadow-lg shadow-primary/20 transition-all active:scale-95 uppercase tracking-wide">
                Sign Up
              </Link>
            </>
          )}
        </div>

        {/* Mobile Toggle */}
        <button 
          className="md:hidden text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-black/95 backdrop-blur-2xl border-b border-white/10"
          >
            <div className="container mx-auto px-6 py-10 flex flex-col gap-8">
              {user ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Your Credits</span>
                    <div className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <Coins className="w-4 h-4 text-amber-500" />
                      <span className="text-lg font-black text-amber-500">{user.credits || 0}</span>
                    </div>
                  </div>
                  <button onClick={handleLogout} className="text-xl font-bold text-gray-400 uppercase tracking-widest text-left flex items-center gap-3">
                    <LogOut className="w-5 h-5" /> Logout
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" onClick={() => setIsMobileMenuOpen(false)} className="text-xl font-bold text-white/80 uppercase tracking-widest">Login</Link>
                  <Link href="/signup" onClick={() => setIsMobileMenuOpen(false)} className="text-xl font-bold text-primary uppercase tracking-widest">Sign Up</Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};
