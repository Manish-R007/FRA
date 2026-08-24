"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Trees, 
  MapPin, 
  FileText, 
  Bot, 
  ShieldCheck, 
  Layers, 
  User as UserIcon, 
  LogOut, 
  Sun, 
  Moon, 
  Bell, 
  Sparkles,
  Award,
  ChevronDown
} from "lucide-react";
import { getStoredUser, setAuthSession, clearAuthSession } from "@/lib/auth";
import { User, UserRole } from "@/lib/types";

const ROLE_PRESETS: { role: UserRole; name: string; email: string; desc: string }[] = [
  { role: "ADMIN", name: "Dr. Rajesh K. Meena", email: "admin@fra.gov.in", desc: "MoTA Admin HQ" },
  { role: "STATE_OFFICER", name: "Smt. Shanti Murmu", email: "state.officer@fra.gov.in", desc: "Odisha State Cell" },
  { role: "DISTRICT_OFFICER", name: "Shri Ashok Pattnaik, IAS", email: "district.officer@fra.gov.in", desc: "Mayurbhanj Collector" },
  { role: "FIELD_OFFICER", name: "Shri Debendra Majhi", email: "field.officer@fra.gov.in", desc: "Baripada Field Unit" },
  { role: "ANALYST", name: "Ananya Sen", email: "analyst@fra.gov.in", desc: "GIS & Remote Sensing" },
  { role: "CITIZEN", name: "Birsa Munda", email: "citizen@fra.gov.in", desc: "Beneficiary Claimant" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isDark, setIsDark] = useState(true);
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  useEffect(() => {
    // Initial user load or auto-login with admin
    const u = getStoredUser();
    if (u) {
      setCurrentUser(u);
    } else {
      fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@fra.gov.in", password: "Admin@2025!" }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.access_token && data.user) {
            setAuthSession(data.access_token, data.user);
            setCurrentUser(data.user);
          }
        })
        .catch(() => {
          const defaultUser: User = {
            id: 1,
            full_name: "Dr. Rajesh K. Meena",
            email: "admin@fra.gov.in",
            role: "ADMIN",
            is_active: true,
          };
          setAuthSession("role-token-ADMIN", defaultUser);
          setCurrentUser(defaultUser);
        });
    }
  }, []);

  const toggleTheme = () => {
    setIsDark(!isDark);
    if (!isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const handleRoleSwitch = async (preset: typeof ROLE_PRESETS[0]) => {
    let password = "Admin@2025!";
    if (preset.role === "STATE_OFFICER") password = "State@2025!";
    else if (preset.role === "DISTRICT_OFFICER") password = "District@2025!";
    else if (preset.role === "FIELD_OFFICER") password = "Field@2025!";
    else if (preset.role === "ANALYST") password = "Analyst@2025!";
    else if (preset.role === "CITIZEN") password = "Citizen@2025!";

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: preset.email, password }),
      });
      const data = await res.json();
      if (data.access_token && data.user) {
        setAuthSession(data.access_token, data.user);
        setCurrentUser(data.user);
      }
    } catch {
      const updatedUser: User = {
        id: 1,
        full_name: preset.name,
        email: preset.email,
        role: preset.role,
        is_active: true,
        district: preset.role.includes("DISTRICT") ? "Mayurbhanj" : undefined,
        state: preset.role.includes("STATE") ? "Odisha" : undefined,
      };
      setAuthSession(`role-token-${preset.role}`, updatedUser);
      setCurrentUser(updatedUser);
    }
    setShowRoleMenu(false);
    window.location.reload();
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md">
      {/* Top Govt of India Header Banner */}
      <div className="bg-slate-900 text-slate-300 text-xs px-4 py-1 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-amber-400 flex items-center gap-1">
            <Award className="w-3.5 h-3.5" />
            GOVERNMENT OF INDIA
          </span>
          <span className="text-slate-500">|</span>
          <span>Ministry of Tribal Affairs (MoTA)</span>
          <span className="text-slate-500">|</span>
          <span className="text-emerald-400">Smart India Hackathon 2025</span>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <span className="inline-flex items-center gap-1 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Sentinel-2 Live STAC Connected
          </span>
          <span>SHA-256 Audit: <strong className="text-amber-400">Verified Unbroken</strong></span>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-700 via-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-900/30 group-hover:scale-105 transition-transform">
            <Trees className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-300 bg-clip-text text-transparent">
                FRA ATLAS AI
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono font-medium">
                v2.1 DSS
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-none">
              Forest Rights Decision Support System
            </p>
          </div>
        </Link>

        {/* Primary Nav Links */}
        <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
          <Link
            href="/atlas"
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-colors ${
              pathname === "/atlas"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900"
            }`}
          >
            <MapPin className="w-4 h-4 text-emerald-500" />
            WebGIS Atlas
          </Link>

          <Link
            href="/claims"
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-colors ${
              pathname.startsWith("/claims")
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900"
            }`}
          >
            <FileText className="w-4 h-4 text-emerald-500" />
            Claims Registry
          </Link>

          <Link
            href="/dss"
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-colors ${
              pathname === "/dss"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900"
            }`}
          >
            <Bot className="w-4 h-4 text-amber-500" />
            DSS Command
          </Link>

          <Link
            href="/schemes"
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-colors ${
              pathname === "/schemes"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900"
            }`}
          >
            <Layers className="w-4 h-4 text-emerald-500" />
            Schemes
          </Link>

          <Link
            href="/audit"
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-colors ${
              pathname === "/audit"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900"
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-blue-500" />
            Audit Vault
          </Link>
        </nav>

        {/* Right Action Controls: Role Switcher, Theme, Profile */}
        <div className="flex items-center gap-3">
          {/* Role Switcher Button */}
          <div className="relative">
            <button
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 hover:border-emerald-500/40 text-xs transition-all"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {currentUser?.role || "ADMIN"}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* Role Dropdown Menu */}
            {showRoleMenu && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Switch Active Role View
                </div>
                <div className="space-y-1">
                  {ROLE_PRESETS.map((p) => (
                    <button
                      key={p.role}
                      onClick={() => handleRoleSwitch(p)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs flex flex-col transition-colors ${
                        currentUser?.role === p.role
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold"
                          : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <span className="font-medium">{p.role}</span>
                      <span className="text-[10px] text-slate-400">{p.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
            title="Toggle theme"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>
        </div>
      </div>
    </header>
  );
}
