"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Trees, Lock, Mail, ArrowRight, Sparkles, UserCheck, Award, ShieldCheck, MapPin, Eye, EyeOff
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { api } from "@/lib/api";
import { setAuthSession } from "@/lib/auth";

const QUICK_ROLES = [
  { role: "ADMIN", name: "Dr. Rajesh K. Meena", email: "admin@fra.gov.in", desc: "MoTA Admin HQ", icon: ShieldCheck },
  { role: "STATE_OFFICER_ODISHA", name: "Smt. Shanti Murmu", email: "state.officer@fra.gov.in", desc: "Odisha State Cell", icon: MapPin },
  { role: "STATE_OFFICER_MP", name: "Smt. Anusuiya Uikey", email: "state.mp@fra.gov.in", desc: "Madhya Pradesh State Cell", icon: MapPin },
  { role: "STATE_OFFICER_KARNATAKA", name: "Shri Basavaraj Gowda", email: "state.karnataka@fra.gov.in", desc: "Karnataka State Cell", icon: MapPin },
  { role: "STATE_OFFICER_TELANGANA", name: "Shri K. Ramulu", email: "state.telangana@fra.gov.in", desc: "Telangana State Cell", icon: MapPin },
  { role: "CITIZEN", name: "Birsa Munda", email: "citizen@fra.gov.in", desc: "Beneficiary Claimant", icon: UserCheck },
];

export default function LoginPage() {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const [email, setEmail] = useState("admin@fra.gov.in");
  const [password, setPassword] = useState("Admin@2025!");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.login(email, password);
      setAuthSession(res.access_token, res.user);
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSelect = (preset: typeof QUICK_ROLES[0]) => {
    setEmail(preset.email);
    let pass = "Admin@2025!";
    if (preset.role.startsWith("STATE_OFFICER")) pass = "State@2025!";
    else if (preset.role === "CITIZEN") pass = "Citizen@2025!";
    setPassword(pass);
  };

  return (
    <div className="login-surface relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div className="relative z-10 grid w-full max-w-5xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7 }}
          className="hidden lg:block"
        >
          <p className="kicker">Ministry of Tribal Affairs</p>
          <h1 className="mt-4 font-display text-6xl leading-[0.95] text-[var(--ink)]">
            Enter the
            <br />
            <span className="italic text-[var(--gold)]">forest rights</span>
            <br />
            workspace.
          </h1>
          <p className="mt-5 max-w-md text-sm leading-7 text-[var(--ink-muted)]">
            A living atlas for FRA claims, satellite land-cover, and welfare scheme convergence — built for officers, analysts, and title holders.
          </p>
          <div className="mt-8 flex items-center gap-3 text-xs text-[var(--ink-soft)]">
            <Award size={16} className="text-[var(--gold)]" />
            Forest Rights Act, 2006 · Smart India Hackathon 2025
          </div>
        </motion.div>

        <motion.div
          className="w-full max-w-md mx-auto space-y-5"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6 }}
        >
          <div className="text-center lg:hidden space-y-3">
            <div className="brand-mark mx-auto"><Trees className="w-7 h-7" /></div>
            <h1 className="font-display text-4xl text-[var(--ink)]">FRA Atlas</h1>
          </div>

          <div className="glass-panel-glow p-6 sm:p-7 space-y-4">
            <div className="flex items-center gap-3">
              <span className="icon-chip"><Trees size={18} /></span>
              <div>
                <p className="kicker">Secure portal</p>
                <h2 className="font-display text-2xl">Sign in to the canopy</h2>
              </div>
            </div>

            {error && (
              <motion.div className="p-3 rounded-xl bg-[rgba(196,90,50,0.16)] border border-[rgba(196,90,50,0.35)] text-[#f3b8a8] text-xs" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
                {error}
              </motion.div>
            )}

            <form onSubmit={handleLogin} className="space-y-3.5 text-xs">
              <div>
                <label className="text-[var(--ink-muted)] font-medium block mb-1.5">Official Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[var(--gold)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 pr-3 py-3 font-mono" placeholder="Enter your official email" />
                </div>
              </div>
              <div>
                <label className="text-[var(--ink-muted)] font-medium block mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[var(--gold)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 pr-10 py-3" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]">
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <motion.button type="submit" disabled={loading} className="btn-gold w-full" whileHover={shouldReduceMotion ? undefined : { scale: 1.015 }} whileTap={shouldReduceMotion ? undefined : { scale: 0.985 }}>
                {loading ? "Opening the atlas…" : <>Enter workspace <ArrowRight className="w-4 h-4" /></>}
              </motion.button>
            </form>

            <div className="pt-3.5 border-t border-[var(--line)] space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles size={12} className="text-[var(--gold)]" />
                <span className="text-[10px] font-bold text-[var(--ink-muted)] uppercase tracking-[0.16em]">Demo role presets</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                {QUICK_ROLES.map((q) => {
                  const Icon = q.icon;
                  const selected = email === q.email;
                  return (
                    <motion.button
                      key={q.role}
                      type="button"
                      onClick={() => handleQuickSelect(q)}
                      className={`p-2.5 rounded-2xl border text-left ${selected ? "border-[var(--gold)] bg-[rgba(226,180,92,0.12)]" : "border-[var(--line)] bg-transparent"}`}
                      whileHover={shouldReduceMotion ? undefined : { y: -2 }}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Icon size={11} className="text-[var(--gold)]" />
                        <strong>{q.role.replace(/_/g, " ").replace(/ODISHA|MP|KARNATAKA|TELANGANA/g, "").trim()}</strong>
                      </div>
                      <span className="text-[10px] text-[var(--ink-muted)] truncate block">{q.name}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
