"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronDown, HelpCircle, MessageSquare, Zap, Shield, Wallet, Box, KeyRound, ShieldAlert } from 'lucide-react';

const FAQ_DATA = [
  // Booking Questions
  {
    q: "How do I book a locker?",
    a: "Simply sign up or log in to your account, select your preferred locker size and duration, complete the payment, and you'll receive a unique PIN instantly. The entire process takes less than 2 minutes!",
    category: "booking"
  },
  {
    q: "Can I extend my booking duration?",
    a: "Yes! You can extend your booking from your dashboard before it expires. Simply select the locker and choose the additional time you need. Extended time will be charged at the standard hourly rate.",
    category: "booking"
  },
  {
    q: "What if I lose my PIN code?",
    a: "Don't worry! You can view your active PINs anytime in your dashboard. If you're still having trouble, contact our support team with your booking details, and we'll help you regain access.",
    category: "booking"
  },
  {
    q: "Lost your phone? How do I recover my locker without my device?",
    a: "If you lose your phone during your journey, use our Emergency Recovery system at /recovery from any available browser or station kiosk. Enter your booking details (Booking ID or Train PNR), verify your identity via DigiLocker, and provide your Emergency Recovery Code to receive an immediate 5-minute temporary unlock PIN.",
    category: "security"
  },
  // Payment Questions
  {
    q: "What payment methods do you accept?",
    a: "We accept all major payment methods including UPI, Credit/Debit Cards, Net Banking, and digital wallets. All transactions are secured with bank-grade encryption.",
    category: "payment"
  },
  {
    q: "Is my payment information secure?",
    a: "Absolutely! We use industry-standard SSL encryption and do not store your card details on our servers. All payments are processed through secure, PCI-compliant payment gateways.",
    category: "payment"
  },
  {
    q: "Can I get a refund if I cancel?",
    a: "Refunds are available if you cancel within 15 minutes of booking and haven't unlocked the locker yet. After that, bookings are non-refundable, but you can earn loyalty credits for early termination.",
    category: "payment"
  },
  // Security Questions
  {
    q: "How secure are the lockers?",
    a: "Our lockers feature reinforced steel construction, electronic locks with encrypted PIN codes, and 24/7 CCTV monitoring. Each locker is individually secured and can only be accessed with your unique PIN.",
    category: "security"
  },
  {
    q: "What happens if someone else knows my PIN?",
    a: "PINs are unique, time-sensitive, and generated securely. Never share your PIN with anyone. If you suspect your PIN has been compromised, reset it immediately from your dashboard or contact support.",
    category: "security"
  },
  {
    q: "Are there cameras monitoring the lockers?",
    a: "Yes, all locker areas are covered by 24/7 CCTV surveillance for your security. Camera footage is securely stored and only accessed in case of security incidents or user requests.",
    category: "security"
  },
  // Usage Questions
  {
    q: "What can I store in the locker?",
    a: "You can store personal belongings like bags, luggage, electronics, documents, and valuables. Prohibited items include weapons, explosives, illegal substances, perishable food, and hazardous materials.",
    category: "usage"
  },
  {
    q: "What are the locker sizes available?",
    a: "We offer multiple sizes: Small (for laptops, handbags), Medium (for backpacks, small suitcases), and Large (for large suitcases and multiple bags). You can view exact dimensions during the booking process.",
    category: "usage"
  },
  {
    q: "Can I access my locker multiple times?",
    a: "Yes! You can unlock and lock your locker as many times as you need during your booking period using the same PIN code.",
    category: "usage"
  }
];

const CATEGORIES = [
  { id: 'all', label: 'All', icon: HelpCircle },
  { id: 'booking', label: 'Booking', icon: Zap },
  { id: 'payment', label: 'Payment', icon: Wallet },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'usage', label: 'Usage', icon: Box },
];

const FAQItem = ({ q, a, isOpen, onToggle }: any) => (
  <div className={`glass-panel mb-4 overflow-hidden transition-all duration-300 ${isOpen ? 'ring-1 ring-primary/30 border-primary/20' : 'border-white/5'}`}>
    <button
      onClick={onToggle}
      className="w-full p-6 text-left flex justify-between items-center group"
    >
      <span className={`text-lg font-bold font-outfit transition-colors ${isOpen ? 'text-primary' : 'text-white group-hover:text-primary'}`}>
        {q}
      </span>
      <ChevronDown className={`w-5 h-5 text-primary transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
    </button>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="px-6 pb-6 text-gray-400 font-medium leading-relaxed">
            {a}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

export default function FAQPage() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const filteredFaqs = FAQ_DATA.filter(faq => {
    const matchesCategory = activeCategory === 'all' || faq.category === activeCategory;
    const matchesSearch = faq.q.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          faq.a.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="container mx-auto px-6 py-20 max-w-4xl">
      <div className="text-center mb-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-black uppercase tracking-widest mb-4"
        >
          <HelpCircle className="w-4 h-4" /> Help Center &amp; FAQ
        </motion.div>
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-6xl font-black text-white font-outfit uppercase italic tracking-tighter mb-6"
        >
          Got <span className="text-primary italic">Questions?</span>
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-xl text-gray-400 font-medium"
        >
          Everything you need to know about the LocknLeave Ecosystem.
        </motion.p>
      </div>

      {/* Emergency Locker Recovery Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel p-6 rounded-3xl border-amber-500/30 bg-amber-500/10 mb-12 flex flex-col md:flex-row items-center justify-between gap-4"
      >
        <div className="flex items-center gap-4 text-left">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-white font-bold text-base font-outfit uppercase">
              Lost Your Phone During Travel?
            </h3>
            <p className="text-gray-300 text-xs mt-0.5 leading-relaxed">
              Recover access to your active locker immediately using DigiLocker identity verification and your recovery code.
            </p>
          </div>
        </div>
        <Link
          href="/recovery"
          className="bg-amber-500 hover:bg-amber-600 text-black px-6 py-3 rounded-full text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap inline-flex items-center gap-2 shadow-lg shadow-amber-500/20"
        >
          <KeyRound className="w-4 h-4" /> Recover My Locker
        </Link>
      </motion.div>

      <div className="space-y-12 mb-20">
        <div className="relative group">
          <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
            <Search className="w-5 h-5 text-gray-600 group-focus-within:text-primary transition-colors" />
          </div>
          <input 
            type="text" 
            placeholder="Search for answers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-full py-6 pl-16 pr-8 text-white placeholder:text-gray-600 focus:border-primary/50 focus:bg-white/10 outline-hidden transition-all shadow-2xl"
          />
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold uppercase tracking-widest transition-all ${
                  activeCategory === cat.id 
                    ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                    : 'bg-white/5 text-gray-500 hover:bg-white/10'
                }`}
              >
                <Icon className="w-4 h-4" />
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-[400px]">
        {filteredFaqs.length > 0 ? (
          filteredFaqs.map((faq, idx) => (
            <FAQItem 
              key={idx} 
              {...faq} 
              isOpen={openIndex === idx} 
              onToggle={() => setOpenIndex(openIndex === idx ? null : idx)} 
            />
          ))
        ) : (
          <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-[3rem]">
            <HelpCircle className="w-16 h-16 text-gray-800 mx-auto mb-6" />
            <h3 className="text-xl font-bold text-gray-600">No matching questions found</h3>
            <p className="text-gray-700 text-sm mt-2 font-medium">Try searching for different keywords or categories.</p>
          </div>
        )}
      </div>

      <motion.div 
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="mt-32 glass-panel p-10 md:p-16 rounded-[4rem] text-center border-white/5 overflow-hidden relative"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-primary to-secondary opacity-50" />
        <h2 className="text-3xl font-black text-white font-outfit uppercase italic mb-6">Still confused?</h2>
        <p className="text-gray-400 font-medium mb-10 max-w-md mx-auto">
          Our specialized support squad is ready to handle your technical or account-related inquiries.
        </p>
        <button 
           onClick={() => (window.location.href = '/contact')}
           className="btn-primary px-12 py-5 text-lg"
        >
          Contact Support Team
        </button>
      </motion.div>
    </div>
  );
}
