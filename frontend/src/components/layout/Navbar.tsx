"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Award, BarChart3, Bot, ChevronDown, FileText, Layers, Map, Menu, Moon, ShieldCheck, Sun, Trees, X } from "lucide-react";
import { getStoredUser, setAuthSession } from "@/lib/auth";
import { User, UserRole } from "@/lib/types";

const ROLE_PRESETS: { role: UserRole; name: string; email: string; desc: string; state?: string }[] = [
  { role: "ADMIN", name: "Dr. Rajesh K. Meena", email: "admin@fra.gov.in", desc: "MoTA Admin HQ", state: "National" },
  { role: "STATE_OFFICER", name: "Smt. Shanti Murmu", email: "state.officer@fra.gov.in", desc: "Odisha State Cell", state: "Odisha" },
  { role: "STATE_OFFICER", name: "Smt. Anusuiya Uikey", email: "state.mp@fra.gov.in", desc: "Madhya Pradesh State Cell", state: "Madhya Pradesh" },
  { role: "STATE_OFFICER", name: "Shri Basavaraj Gowda", email: "state.karnataka@fra.gov.in", desc: "Karnataka State Cell", state: "Karnataka" },
  { role: "STATE_OFFICER", name: "Shri K. Ramulu", email: "state.telangana@fra.gov.in", desc: "Telangana State Cell", state: "Telangana" },
  { role: "CITIZEN", name: "Birsa Munda", email: "citizen@fra.gov.in", desc: "Beneficiary Claimant", state: "Odisha" },
];

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: Activity },
  { href: "/atlas", label: "Forest atlas", icon: Map },
  { href: "/claims", label: "Claims", icon: FileText },
  { href: "/dss", label: "Decision support", icon: Bot },
  { href: "/schemes", label: "Schemes", icon: Layers },
  { href: "/monitoring", label: "Monitoring", icon: BarChart3 },
  { href: "/audit", label: "Audit", icon: ShieldCheck },
];

export default function Navbar() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [roleMenu, setRoleMenu] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => { setUser(getStoredUser()); }, []);

  const switchRole = async (preset: typeof ROLE_PRESETS[number]) => {
    const password = preset.role === "ADMIN" ? "Admin@2025!" : preset.role === "CITIZEN" ? "Citizen@2025!" : "State@2025!";
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: preset.email, password }) });
      const data = await response.json();
      if (data.access_token && data.user) { setAuthSession(data.access_token, data.user); setUser(data.user); }
    } catch {
      const fallback: User = { id: user?.id || 1, full_name: preset.name, email: preset.email, role: preset.role, is_active: true, state: preset.state };
      setAuthSession(`role-token-${preset.role}_${preset.state || ""}`, fallback);
      setUser(fallback);
    }
    setRoleMenu(false);
    window.location.reload();
  };

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  };

  return (
    <header className="site-header sticky top-0 z-50">
      <div className="site-topline">
        <div className="site-container flex h-8 items-center justify-between text-[11px]">
          <div className="flex items-center gap-2 text-forest-700"><Award size={13} /><span className="font-semibold tracking-wide">MINISTRY OF TRIBAL AFFAIRS</span><span className="hidden sm:inline text-stone-400">·</span><span className="hidden sm:inline">Forest Rights Act, 2006</span></div>
          <span className="hidden sm:flex items-center gap-1.5 text-forest-700"><span className="status-dot" /> Atlas workspace</span>
        </div>
      </div>
      <div className="site-container flex min-h-[68px] items-center justify-between gap-3">
        <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="FRA Atlas home">
          <span className="brand-mark"><Trees size={23} strokeWidth={1.8} /></span>
          <span><strong className="block text-[15px] font-bold tracking-tight text-forest-950">FRA Atlas</strong><span className="block text-[10px] tracking-wide text-stone-500">LAND · RIGHTS · LIVELIHOODS</span></span>
        </Link>
        <nav className="hidden lg:flex items-center gap-1" aria-label="Primary navigation">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
            return <Link key={href} href={href} className={`nav-link ${active ? "nav-link-active" : ""}`}><Icon size={15} strokeWidth={1.8} />{label}</Link>;
          })}
        </nav>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button className="role-button" onClick={() => setRoleMenu(!roleMenu)} aria-expanded={roleMenu}><span className="role-avatar">{(user?.full_name || "Officer").slice(0, 1)}</span><span className="hidden sm:block text-left"><strong className="block text-xs text-forest-950">{user?.full_name?.split(" ")[0] || "Workspace"}</strong><span className="block text-[10px] text-stone-500">{(user?.role || "ADMIN").replaceAll("_", " ")}</span></span><ChevronDown size={14} className="text-stone-400" /></button>
            {roleMenu && <div className="role-menu"><p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-stone-500">Switch role view</p>{ROLE_PRESETS.map((preset) => <button key={`${preset.email}`} onClick={() => switchRole(preset)} className="role-option"><span>{preset.role.replaceAll("_", " ")}</span><small>{preset.desc}</small></button>)}</div>}
          </div>
          <button className="icon-button hidden sm:grid" title="Toggle theme" onClick={toggleTheme} aria-label="Toggle theme">{dark ? <Sun size={17} /> : <Moon size={17} />}</button>
          <button className="icon-button lg:hidden" onClick={() => setMobileMenu(!mobileMenu)} aria-label={mobileMenu ? "Close navigation" : "Open navigation"}>{mobileMenu ? <X size={19} /> : <Menu size={19} />}</button>
        </div>
      </div>
      {mobileMenu && <nav className="mobile-nav lg:hidden" aria-label="Mobile navigation">{NAV_ITEMS.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setMobileMenu(false)} className={`nav-link ${pathname === href ? "nav-link-active" : ""}`}><Icon size={16} />{label}</Link>)}</nav>}
    </header>
  );
}
