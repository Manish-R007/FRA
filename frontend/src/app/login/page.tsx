"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Trees, 
  Lock, 
  Mail, 
  ArrowRight, 
  Sparkles, 
  UserCheck, 
  Award,
  ShieldCheck
} from "lucide-react";
import { api } from "@/lib/api";
import { setAuthSession } from "@/lib/auth";

const QUICK_ROLES = [
  { role: "ADMIN", name: "Dr. Rajesh K. Meena", email: "admin@fra.gov.in", desc: "MoTA Admin HQ" },
  { role: "STATE_OFFICER", name: "Smt. Shanti Murmu", email: "state.officer@fra.gov.in", desc: "Odisha State Cell" },
  { role: "DISTRICT_OFFICER", name: "Shri Ashok Pattnaik", email: "district.officer@fra.gov.in", desc: "Mayurbhanj Collector" },
  { role: "FIELD_OFFICER", name: "Shri Debendra Majhi", email: "field.officer@fra.gov.in", desc: "Baripada Field Unit" },
  { role: "ANALYST", name: "Ananya Sen", email: "analyst@fra.gov.in", desc: "GIS & Remote Sensing" },
  { role: "CITIZEN", name: "Birsa Munda", email: "citizen@fra.gov.in", desc: "Beneficiary Claimant" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@fra.gov.in");
  const [password, setPassword] = useState("Admin@2025!");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (preset.role === "STATE_OFFICER") pass = "State@2025!";
    else if (preset.role === "DISTRICT_OFFICER") pass = "District@2025!";
    else if (preset.role === "FIELD_OFFICER") pass = "Field@2025!";
    else if (preset.role === "ANALYST") pass = "Analyst@2025!";
    else if (preset.role === "CITIZEN") pass = "Citizen@2025!";
    setPassword(pass);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-700 to-teal-500 flex items-center justify-center text-white mx-auto shadow-xl shadow-emerald-950/50">
            <Trees className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">FRA ATLAS AI Portal</h1>
          <p className="text-xs text-slate-400">
            Ministry of Tribal Affairs • Integrated Forest Rights Decision Support System
          </p>
        </div>

        {/* Login Card */}
        <div className="glass-panel-glow p-6 rounded-3xl border border-slate-800 space-y-4 shadow-2xl">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-3 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Official Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all text-xs"
            >
              <span>{loading ? "Authenticating..." : "Sign In to Portal"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Role Presets */}
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
              1-Click Demo Role Presets:
            </span>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              {QUICK_ROLES.map((q) => (
                <button
                  key={q.role}
                  type="button"
                  onClick={() => handleQuickSelect(q)}
                  className={`p-2 rounded-xl border text-left transition-colors ${
                    email === q.email
                      ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-semibold"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <strong className="block text-[11px]">{q.role}</strong>
                  <span className="text-[10px] text-slate-500 truncate block">{q.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
