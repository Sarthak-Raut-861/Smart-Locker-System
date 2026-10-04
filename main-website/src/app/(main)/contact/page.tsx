"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mail, Phone, Clock, Send, CheckCircle, MessageSquare, Loader2 } from 'lucide-react';

const InfoCard = ({ icon: Icon, title, value, delay }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ delay }}
    className="glass-panel p-8 rounded-3xl text-center border-white/5 hover:border-primary/20 transition-all group flex-1 min-w-[280px]"
  >
    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
      <Icon className="w-8 h-8 text-primary" />
    </div>
    <h3 className="text-lg font-bold text-white font-outfit uppercase tracking-wider mb-2">{title}</h3>
    <p className="text-gray-400 font-medium">{value}</p>
  </motion.div>
);

export default function ContactPage() {
  const [formState, setFormState] = useState<'idle' | 'submitting' | 'success'>('idle');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormState('submitting');
    setTimeout(() => setFormState('success'), 1500);
  };

  return (
    <div className="container mx-auto px-6 py-20 max-w-6xl">
      <div className="text-center mb-24">
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-6xl md:text-7xl font-black text-white font-outfit uppercase italic tracking-tighter mb-6"
        >
          Let’s <span className="text-primary italic">Talk</span>
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-xl text-gray-400 max-w-2xl mx-auto font-medium"
        >
          We’re here to help you 24/7. Reach out anytime, anywhere.
        </motion.p>
      </div>

      <div className="flex flex-wrap gap-8 mb-20">
        <InfoCard icon={Mail} title="Email Support" value="support@locknleave.com" delay={0.1} />
        <InfoCard icon={Phone} title="Call Us" value="+91 98765 43210" delay={0.2} />
        <InfoCard icon={Clock} title="Working Hours" value="Mon - Sun: 9:00 AM - 9:00 PM" delay={0.3} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <motion.div
           initial={{ opacity: 0, x: -30 }}
           whileInView={{ opacity: 1, x: 0 }}
           viewport={{ once: true }}
           className="space-y-8"
        >
          <div className="glass-panel p-10 rounded-[2.5rem] border-primary/20 bg-linear-to-br from-primary/10 to-transparent">
            <h2 className="text-3xl font-black text-white font-outfit uppercase italic mb-6 tracking-tight">Need Immediate <span className="text-primary">Help?</span></h2>
            <p className="text-gray-400 leading-relaxed font-medium mb-8">
              Check out our Help Center for instant answers to frequently asked questions about booking, payments, and locker security.
            </p>
            <Link href="/help" className="inline-flex items-center gap-3 text-primary font-black uppercase tracking-widest text-sm hover:gap-5 transition-all">
              Visit Help Center <MessageSquare className="w-5 h-5" />
            </Link>
          </div>
          
          <div className="flex items-center gap-6 px-10">
            <div className="flex -space-x-4">
              {[1,2,3,4].map(i => (
                <div key={i} className="w-12 h-12 rounded-full border-4 border-black bg-gray-800 overflow-hidden">
                  <img src={`https://i.pravatar.cc/150?u=${i}`} alt="Agent" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
            <div className="text-xs text-gray-500 font-bold uppercase tracking-widest">
              Available Support Agents Online
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="glass-panel p-10 md:p-14 rounded-[3rem] border-white/5 relative overflow-hidden"
        >
          {formState === 'success' ? (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center py-10"
            >
              <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-8">
                <CheckCircle className="w-10 h-10 text-emerald-500" />
              </div>
              <h3 className="text-2xl font-black text-white font-outfit uppercase italic mb-4">Message Sent!</h3>
              <p className="text-gray-400 font-medium mb-8">We've received your query and our team will get back to you within 2-4 hours.</p>
              <button 
                onClick={() => setFormState('idle')}
                className="text-primary font-black uppercase tracking-widest text-xs"
              >
                Send another message
              </button>
            </motion.div>
          ) : (
            <>
              <h3 className="text-2xl font-black text-white font-outfit uppercase italic mb-8 tracking-tight">Send a <span className="text-primary">Message</span></h3>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <input 
                    type="text" 
                    placeholder="Your Full Name" 
                    required 
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white placeholder:text-gray-600 focus:border-primary/50 focus:bg-white/10 outline-hidden transition-all"
                  />
                </div>
                <div>
                  <input 
                    type="email" 
                    placeholder="Email Address" 
                    required 
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white placeholder:text-gray-600 focus:border-primary/50 focus:bg-white/10 outline-hidden transition-all"
                  />
                </div>
                <div>
                  <textarea 
                    rows={4} 
                    placeholder="How can we help you?" 
                    required 
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white placeholder:text-gray-600 focus:border-primary/50 focus:bg-white/10 outline-hidden transition-all resize-none"
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={formState === 'submitting'}
                  className="w-full btn-primary py-5 text-lg flex items-center justify-center gap-3 group"
                >
                  {formState === 'submitting' ? (
                    <Loader2 className="w-6 h-6 animate-spin text-white" />
                  ) : (
                    <>
                      Transmit Message <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
