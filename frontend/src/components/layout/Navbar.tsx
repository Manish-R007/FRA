"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BarChart3, Bot, ChevronDown, FileText, Layers, Map, Menu, Moon, ShieldCheck, Sun, Trees, X } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { getStoredUser, setAuthSession } from "@/lib/auth";
import { canAccessPath } from "@/lib/rbac";
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
  { href: "/atlas", label: "Atlas", icon: Map },
  { href: "/claims", label: "Claims", icon: FileText },
  { href: "/dss", label: "DSS", icon: Bot },
  { href: "/schemes", label: "Schemes", icon: Layers },
  { href: "/monitoring", label: "Monitor", icon: BarChart3 },
  { href: "/audit", label: "Audit", icon: ShieldCheck },
];

export default function Navbar() {
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();
  const [user, setUser] = useState<User | null>(null);
  const [roleMenu, setRoleMenu] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [dawn, setDawn] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setUser(getStoredUser());
    const isDawn = document.documentElement.classList.contains("dawn") || localStorage.getItem("fra_theme") === "dawn";
    setDawn(isDawn);
    document.documentElement.classList.toggle("dawn", isDawn);
    document.documentElement.classList.toggle("dark", !isDawn);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!roleMenu) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".role-menu-container")) setRoleMenu(false);
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [roleMenu]);

  const switchRole = async (preset: typeof ROLE_PRESETS[number]) => {
    const password = preset.role === "ADMIN" ? "Admin@2025!" : preset.role === "CITIZEN" ? "Citizen@2025!" : "State@2025!";
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: preset.email, password }) });
      const data = await response.json();
      if (!response.ok || !data.access_token || !data.user) throw new Error(data.detail || "Unable to switch workspace");
      setAuthSession(data.access_token, data.user);
      setUser(data.user);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to switch workspace");
      setRoleMenu(false);
      return;
    }
    setRoleMenu(false);
    window.location.reload();
  };

  const toggleTheme = () => {
    const next = !dawn;
    setDawn(next);
    try {
      localStorage.setItem("fra_theme", next ? "dawn" : "canopy");
    } catch (e) {}
    document.documentElement.classList.toggle("dawn", next);
    document.documentElement.classList.toggle("dark", !next);
  };

  if (pathname === "/login") return null;

  return (
    <header className={`site-header ${scrolled ? "is-scrolled" : ""}`}>
      <div className="site-container flex min-h-[84px] items-center justify-between gap-3">
        <Link href="/" className="flex shrink-0 items-center gap-3 group" aria-label="FRA Atlas home">
          <motion.span
            className="brand-mark"
            whileHover={shouldReduceMotion ? undefined : { scale: 1.08, rotate: -8 }}
            animate={shouldReduceMotion ? undefined : { rotate: [0, 4, -3, 0] }}
            transition={{ rotate: { duration: 8, repeat: Infinity, ease: "easeInOut" }, scale: { type: "spring", stiffness: 400, damping: 16 } }}
          >
            <Trees size={22} strokeWidth={1.9} />
          </motion.span>
          <span>
            <strong className="block font-display text-[22px] font-semibold leading-none text-[var(--ink)]">FRA Atlas</strong>
            <span className="mt-1 block text-[10px] tracking-[0.22em] text-[var(--gold)] uppercase">Land · Rights · Canopy</span>
          </span>
        </Link>

        <nav className="nav-pill hidden lg:flex" aria-label="Primary navigation">
          {NAV_ITEMS.filter((item) => canAccessPath(user?.role, item.href)).map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link key={href} href={href} className={`nav-link ${active ? "nav-link-active" : ""}`}>
                {active && !shouldReduceMotion && (
                  <motion.span
                    className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-[#e2b45c] to-[#c4843a]"
                    layoutId="nav-active-bg"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                {active && shouldReduceMotion && <span className="absolute inset-0 -z-10 rounded-full bg-[#e2b45c]" />}
                <Icon size={13} strokeWidth={2} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 mr-1 text-[10px] uppercase tracking-[0.16em] text-[var(--ink-muted)]">
            <span className="status-dot" />
            MoTA live
          </div>
          <div className="relative role-menu-container">
            <motion.button
              className="role-button"
              onClick={() => setRoleMenu(!roleMenu)}
              aria-expanded={roleMenu}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
            >
              <span className="role-avatar">{(user?.full_name || "Officer").slice(0, 1)}</span>
              <span className="hidden sm:block text-left">
                <strong className="block text-xs text-[var(--ink)]">{user?.full_name?.split(" ")[0] || "Workspace"}</strong>
                <span className="block text-[10px] text-[var(--ink-muted)]">{(user?.role || "ADMIN").replaceAll("_", " ")}</span>
              </span>
              <motion.span animate={{ rotate: roleMenu ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown size={14} className="text-[var(--gold)]" />
              </motion.span>
            </motion.button>

            <AnimatePresence>
              {roleMenu && (
                <motion.div
                  className="role-menu"
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                >
                  <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--gold)]">Switch role view</p>
                  {ROLE_PRESETS.map((preset) => (
                    <motion.button
                      key={preset.email}
                      onClick={() => switchRole(preset)}
                      className="role-option"
                      whileHover={shouldReduceMotion ? undefined : { x: 4 }}
                    >
                      <span>{preset.role.replaceAll("_", " ")}</span>
                      <small>{preset.desc}</small>
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <motion.button
            className="icon-button hidden sm:grid"
            title="Toggle dawn / canopy"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            whileTap={shouldReduceMotion ? undefined : { scale: 0.9, rotate: 18 }}
          >
            {dawn ? <Moon size={17} /> : <Sun size={17} />}
          </motion.button>

          <motion.button
            className="icon-button lg:hidden"
            onClick={() => setMobileMenu(!mobileMenu)}
            aria-label={mobileMenu ? "Close navigation" : "Open navigation"}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
          >
            {mobileMenu ? <X size={19} /> : <Menu size={19} />}
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {mobileMenu && (
          <motion.nav
            className="mobile-nav lg:hidden"
            aria-label="Mobile navigation"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            {NAV_ITEMS.filter((item) => canAccessPath(user?.role, item.href)).map(({ href, label, icon: Icon }, index) => (
              <motion.div
                key={href}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                <Link
                  href={href}
                  onClick={() => setMobileMenu(false)}
                  className={`nav-link ${pathname === href ? "nav-link-active !text-[#1a1204]" : ""}`}
                  style={pathname === href ? { background: "linear-gradient(135deg,#e2b45c,#c4843a)" } : undefined}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              </motion.div>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
