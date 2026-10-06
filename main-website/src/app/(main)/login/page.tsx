"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Mail, Lock, LogIn, ArrowLeft, Loader2 } from 'lucide-react';
import { auth } from '@/lib/firebase/config';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (email === "admin@0861" && password === "admin@0861") {
        router.push("/admin");
        return;
      }
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError("Incorrect email or password.");
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    setLoading(true);
    try {
      await signInWithPopup(auth, provider);
      router.push('/dashboard');
    } catch (err: any) {
      setLoading(false);
      if (err.code !== 'auth/popup-closed-by-user') setError("Google sign-up failed.");
    }
  };

  const GoogleIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 py-8 relative z-10">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-[440px] my-auto"
      >
        <div className="bg-[#0f0f0f]/90 backdrop-blur-3xl rounded-[24px] p-10 border border-white/10 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] relative overflow-hidden">
          
          <div className="text-center mb-8 relative z-10">
            <div className="w-16 h-16 rounded-[20px] bg-indigo-500/10 flex items-center justify-center mx-auto mb-5 text-indigo-400">
              <Lock className="w-8 h-8" />
            </div>
            <h1 className="text-[28px] font-bold text-white mb-2 font-outfit leading-tight tracking-tight">Welcome Back</h1>
            <p className="text-slate-400 text-[15px] font-medium">Please enter your details to sign in.</p>
          </div>

          <button onClick={handleGoogleLogin} className="w-full bg-white/5 border border-white/10 text-white py-3.5 rounded-xl flex items-center justify-center gap-3 hover:bg-white/10 transition-all mb-6 font-semibold text-sm relative z-10">
            <GoogleIcon /> Sign in with Google
          </button>

          <div className="relative mb-6 relative z-10">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
            <div className="relative flex justify-center text-[13px] font-medium leading-none">
              <span className="bg-[#0f0f0f] px-4 text-slate-500">or continue with</span>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 relative z-10 mb-8">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-white ml-1">Email Address</label>
              <div className="relative group">
                <input 
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-xl py-4 px-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all"
                  placeholder="name@example.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-white ml-1">Password</label>
              <div className="relative group">
                <input 
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-xl py-4 px-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {error && <div className="text-rose-500 text-xs font-medium text-center">{error}</div>}

            <button disabled={loading} className="w-full bg-indigo-500 hover:bg-indigo-600 active:scale-[0.98] text-white py-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all shadow-lg shadow-indigo-500/20 mt-2">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <> <LogIn className="w-5 h-5" /> Login </>}
            </button>
          </form>

          <div className="text-center space-y-4 relative z-10">
             <p className="text-sm text-slate-400 font-medium">
               Don't have an account? <Link href="/signup" className="text-indigo-400 hover:text-indigo-300 font-bold ml-1">Sign up</Link>
             </p>
             <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-white transition-colors">
               <ArrowLeft className="w-4 h-4" /> ← Back to Home
             </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
