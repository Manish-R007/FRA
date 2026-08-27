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
  const [isDark, setIsDark] = useState(false);
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
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 shadow-sm backdrop-blur-xl">
      {/* Top Govt of India Header Banner */}
      <div className="h-6 bg-slate-950 text-slate-400 text-[10px] px-4 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span className="font-semibold text-amber-400 flex items-center gap-1">
            <Award className="w-3.5 h-3.5" />
            GOVERNMENT OF INDIA
          </span>
          <span className="text-slate-500">|</span>
          <span>Ministry of Tribal Affairs</span>
          <span className="text-slate-500">|</span>
          <span className="hidden sm:inline text-emerald-400">Forest Rights Act, 2006</span>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-[10px]">
          <span className="inline-flex items-center gap-1 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            System operational
          </span>
          <span className="text-slate-500">Secure government workspace</span>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-[68px] flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-700 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-900/25 group-hover:scale-105 transition-transform">
            <Trees className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-700 dark:from-emerald-400 dark:to-teal-300 bg-clip-text text-transparent">
                FRA ATLAS AI
              </span>
              <span className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-mono font-bold">
                DSS
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-none">
              Forest Rights Decision Support System
            </p>
          </div>
        </Link>

        {/* Primary Nav Links */}
        <nav className="hidden xl:flex items-center gap-1.5 text-sm font-medium">
          <Link
            href="/atlas"
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all duration-150 ${
              pathname === "/atlas"
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-500/30"
                : "text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50/80 dark:hover:bg-emerald-950/30 border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800/40"
            }`}
          >
            <MapPin className="w-4 h-4 text-emerald-500" />
            WebGIS Atlas
          </Link>

          <Link
            href="/claims"
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all duration-150 ${
              pathname.startsWith("/claims")
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-500/30"
                : "text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50/80 dark:hover:bg-emerald-950/30 border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800/40"
            }`}
          >
            <FileText className="w-4 h-4 text-emerald-500" />
            Claims Registry
          </Link>

          <Link
            href="/dss"
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all duration-150 ${
              pathname === "/dss"
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-500/30"
                : "text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50/80 dark:hover:bg-emerald-950/30 border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800/40"
            }`}
          >
            <Bot className="w-4 h-4 text-amber-500" />
            DSS Command
          </Link>

          <Link
            href="/schemes"
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all duration-150 ${
              pathname === "/schemes"
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-500/30"
                : "text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50/80 dark:hover:bg-emerald-950/30 border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800/40"
            }`}
          >
            <Layers className="w-4 h-4 text-emerald-500" />
            Schemes
          </Link>

          <Link
            href="/audit"
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all duration-150 ${
              pathname === "/audit"
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-500/30"
                : "text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50/80 dark:hover:bg-emerald-950/30 border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800/40"
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
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:border-emerald-300 dark:hover:border-emerald-500/40 text-xs transition-all shadow-sm"
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
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-semibold"
                          : "hover:bg-emerald-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300"
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
      <nav className="md:hidden border-t border-slate-200/80 dark:border-slate-800 px-3 h-10 flex items-center gap-1 overflow-x-auto text-[11px] font-medium scrollbar-none">
        {[
          { href: "/atlas", label: "Atlas", icon: MapPin },
          { href: "/claims", label: "Claims", icon: FileText },
          { href: "/dss", label: "DSS", icon: Bot },
          { href: "/schemes", label: "Schemes", icon: Layers },
          { href: "/audit", label: "Audit", icon: ShieldCheck },
        ].map(({ href, label, icon: Icon }) => {
          const active = href === "/claims" ? pathname.startsWith("/claims") : pathname === href;
          return (
            <Link key={href} href={href} className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${active ? "bg-emerald-500/10 text-emerald-500" : "text-slate-500 dark:text-slate-400"}`}>
              <Icon className="w-3.5 h-3.5" />{label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
