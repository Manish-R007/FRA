"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Activity, ArrowDownRight, ArrowRight, BarChart3, Bot, Check, Compass, FileText,
  Layers3, Map, MapPin, RefreshCw, ShieldCheck, Sprout, Trees, Waves,
} from "lucide-react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import WebGISMap from "@/components/map/WebGISMap";
import { api } from "@/lib/api";
import { AtlasStatistics } from "@/lib/types";

type SchemeSummary = { scheme_name: string; scheme_code: string; claims_in_scope: number; eligible_beneficiaries: number; eligibility_assessed: number; confirmed_covered: number };
type MonitoringSummary = { totals: { schemes: SchemeSummary[] } };

const STATUS_COLORS: Record<string, string> = {
  APPROVED: "#2e7653", REJECTED: "#bf6258", PENDING_VERIFICATION: "#c99345",
  FIELD_VERIFICATION: "#638b99", GIS_VALIDATED: "#76926b", SATELLITE_ANALYZE: "#7087a1",
  UPLOADED: "#9a9b8d", OCR_PROCESSED: "#9a7e9a",
};
const LAND_COLORS = ["#2d7452", "#a2aa69", "#6398a2", "#c99550", "#b87b64"];
const revealItem: Variants = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: "easeOut" } },
};
const revealGroup: Variants = { hidden: {}, visible: { transition: { staggerChildren: 0.09 } } };
const number = (value?: number) => value === undefined || value === null
  ? "—"
  : value.toLocaleString("en-IN", { maximumFractionDigits: 1 });

export default function HomePage() {
  const shouldReduceMotion = useReducedMotion();
  const [stats, setStats] = useState<AtlasStatistics | null>(null);
  const [monitoring, setMonitoring] = useState<MonitoringSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    const [statsResult, monitoringResult] = await Promise.allSettled([
      api.getAtlasStats(),
      api.getCoverageMonitoring({ level: "state" }),
    ]);
    if (statsResult.status === "fulfilled") setStats(statsResult.value);
    if (monitoringResult.status === "fulfilled") setMonitoring(monitoringResult.value);
    if (statsResult.status === "fulfilled" || monitoringResult.status === "fulfilled") setUpdatedAt(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const statusData = useMemo(() => (stats?.charts.by_status ?? [])
    .filter((item) => item.count > 0)
    .map((item) => ({ ...item, label: item.status.replaceAll("_", " ").toLowerCase() })), [stats]);
  const stateData = useMemo(() => [...(stats?.charts.by_state ?? [])]
    .sort((a, b) => b.count - a.count).slice(0, 10), [stats]);
  const claimTypeData = useMemo(() => stats ? [
    { name: "Individual Forest Rights", code: "IFR", count: stats.claim_types.IFR },
    { name: "Community Rights", code: "CR", count: stats.claim_types.CR },
    { name: "Community Forest Resource", code: "CFR", count: stats.claim_types.CFR },
  ] : [], [stats]);
  const landData = useMemo(() => stats ? [
    { name: "Forest cover", value: stats.land_cover_totals_ha.forest },
    { name: "Cultivated", value: stats.land_cover_totals_ha.crop },
    { name: "Water", value: stats.land_cover_totals_ha.water },
    { name: "Built-up", value: stats.land_cover_totals_ha.building },
    { name: "Bare land", value: stats.land_cover_totals_ha.bare_land },
  ].filter((item) => item.value > 0) : [], [stats]);
  const eligibleCount = monitoring?.totals.schemes.reduce((sum, item) => sum + item.eligible_beneficiaries, 0);
  const assessedCount = monitoring?.totals.schemes.reduce((sum, item) => sum + item.eligibility_assessed, 0);
  const coveredCount = monitoring?.totals.schemes.reduce((sum, item) => sum + item.confirmed_covered, 0);
  const claimSchemePairs = monitoring?.totals.schemes.reduce((sum, item) => sum + item.claims_in_scope, 0);
  const summary = stats?.summary;
  const assessmentCoverage = claimSchemePairs ? ((assessedCount ?? 0) / claimSchemePairs) * 100 : null;
  const approvalShare = summary?.total_claims ? (summary.approved_claims / summary.total_claims) * 100 : null;
  const leadingState = stateData[0];
  const leadingStateShare = leadingState && summary?.total_claims ? (leadingState.count / summary.total_claims) * 100 : null;
  const leadingScheme = monitoring?.totals.schemes
    .filter((scheme) => scheme.eligible_beneficiaries > 0)
    .sort((a, b) => b.eligible_beneficiaries - a.eligible_beneficiaries)[0];

  return (
    <div className="relative isolate min-h-[calc(100vh-var(--header-height))] overflow-hidden pb-16 page-enter">
      <div className="relative z-10">
      <section className="relative isolate overflow-hidden bg-[#153a2b] text-white">
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_78%_28%,rgba(123,166,119,0.22),transparent_40%),linear-gradient(110deg,rgba(11,34,25,0.1),transparent_70%)]" />
          <motion.div className="absolute -left-40 top-[12%] h-[32rem] w-[32rem] rounded-full bg-[#9cbd91]/25 blur-[80px]" animate={{ x: shouldReduceMotion ? [0, 2, 0] : [0, 64, -28, 0], y: shouldReduceMotion ? [0, -2, 0] : [0, 42, -18, 0], opacity: [0.48, 0.82, 0.55, 0.48], scale: [0.94, 1.12, 0.98, 0.94] }} transition={{ duration: shouldReduceMotion ? 30 : 15, repeat: Infinity, ease: "easeInOut" }} />
          <motion.div className="absolute -right-48 bottom-[-18rem] h-[42rem] w-[42rem] rounded-full bg-[#adc9a0]/25 blur-[90px]" animate={{ x: shouldReduceMotion ? [0, -2, 0] : [0, -58, 20, 0], y: shouldReduceMotion ? [0, 2, 0] : [0, -38, 14, 0], opacity: [0.44, 0.78, 0.52, 0.44], scale: [1, 0.92, 1.1, 1] }} transition={{ duration: shouldReduceMotion ? 34 : 18, repeat: Infinity, ease: "easeInOut", delay: 1.2 }} />
          <motion.div className="absolute -right-40 -top-56 h-[800px] w-[800px] rounded-full border border-white/[0.22]" animate={{ rotate: shouldReduceMotion ? [0, 2, 0] : [0, 14, 0], scale: shouldReduceMotion ? [1, 1.005, 1] : [1, 1.03, 1] }} transition={{ duration: shouldReduceMotion ? 38 : 30, repeat: Infinity, ease: "easeInOut" }} />
          <motion.div className="absolute -right-12 -top-24 h-[560px] w-[560px] rounded-full border border-[#d8ead2]/18" animate={{ rotate: shouldReduceMotion ? [0, -2, 0] : [0, -18, 0], scale: shouldReduceMotion ? [1, 0.995, 1] : [1, 0.96, 1] }} transition={{ duration: shouldReduceMotion ? 36 : 25, repeat: Infinity, ease: "easeInOut", delay: 0.5 }} />
          <motion.div className="absolute right-[7%] top-[14%] h-2.5 w-2.5 rounded-full bg-[#d9e9c8] shadow-[0_0_18px_7px_rgba(199,225,175,0.32)]" animate={{ x: [0, -20, 0], y: [0, 28, 0], opacity: [0.45, 1, 0.45], scale: [0.8, 1.2, 0.8] }} transition={{ duration: shouldReduceMotion ? 26 : 11, repeat: Infinity, ease: "easeInOut" }} />
        </div>

        <div className="relative z-10 mx-auto grid max-w-[1600px] gap-12 px-5 pb-14 pt-14 sm:px-8 sm:pb-18 sm:pt-18 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-16 lg:px-12 lg:py-24 xl:gap-24">
          <motion.div className="relative z-10 max-w-4xl" initial={shouldReduceMotion ? false : { opacity: 0, x: -28 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.75, ease: "easeOut" }}>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100/30 bg-emerald-50/[0.12] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-50 shadow-sm shadow-black/10">
              <Trees size={14} /> Forest Rights Act · 2006
            </div>
            <h1 className="mt-7 max-w-4xl font-[Manrope] text-4xl font-bold leading-[1.06] tracking-[-0.045em] text-[#f3f6ef] drop-shadow-[0_2px_22px_rgba(0,0,0,0.22)] sm:text-6xl lg:text-[76px] xl:text-[88px]">
              Forest rights claims.<br /><span className="text-[#bdd5b5]">Mapped and monitored.</span>
            </h1>
            <motion.p className="mt-6 max-w-2xl text-sm leading-7 text-emerald-50/75 sm:text-base" initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.2 }}>
              Manage Individual, Community and Community Forest Resource claims, review mapped parcels and satellite observations, and monitor welfare scheme assessments in one workspace.
            </motion.p>
            <motion.div className="mt-8 flex flex-wrap gap-3" initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.34 }}>
              <Link href="/atlas" className="group inline-flex items-center gap-2.5 rounded-xl bg-[#edf3e8] px-5 py-3 text-sm font-semibold text-[#193c2b] shadow-lg shadow-black/10 transition hover:bg-white">
                <Compass size={17} /> Explore the atlas <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </Link>
              <Link href="/monitoring" className="inline-flex items-center gap-2.5 rounded-xl border border-white/20 bg-white/[0.06] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.12]">
                <BarChart3 size={16} /> Scheme monitoring
              </Link>
            </motion.div>
            <div className="mt-8 flex items-center gap-2 text-[11px] text-emerald-100/60">
              <span className="h-1.5 w-1.5 rounded-full bg-[#a9d29a] shadow-[0_0_10px_rgba(169,210,154,0.8)]" />
              {loading ? "Connecting to the FRA Atlas registry…" : updatedAt ? `Connected to the FRA Atlas registry · refreshed ${updatedAt.toLocaleTimeString()}` : "Registry data is currently unavailable"}
            </div>
          </motion.div>

          <motion.div className="relative mx-auto w-full max-w-[540px] lg:justify-self-end" initial={shouldReduceMotion ? false : { opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.8, delay: 0.18, ease: "easeOut" }}>
            <div className="absolute -inset-5 rounded-[2rem] bg-emerald-200/[0.06] blur-2xl" />
            <div className="relative overflow-hidden rounded-[1.6rem] border border-white/15 bg-[#f7f7ef] p-5 text-[#203c2d] shadow-2xl shadow-black/20 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#728275]">The registry at a glance</p><p className="mt-1 text-sm font-semibold">A live view of recorded progress</p></div>
                <span className="rounded-full border border-[#dce5d9] bg-white px-2.5 py-1 text-[10px] font-semibold text-[#55735b]">FRA Atlas</span>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <HeroMetric icon={<FileText size={15} />} label="Claim records" value={number(summary?.total_claims)} detail="In the registry" loading={loading} />
                <HeroMetric icon={<ShieldCheck size={15} />} label="Approved titles" value={number(summary?.approved_claims)} detail="Recognized / verified" loading={loading} />
                <HeroMetric icon={<MapPin size={15} />} label="States represented" value={number(summary?.states_covered)} detail="Across recorded claims" loading={loading} />
                <HeroMetric icon={<Layers3 size={15} />} label="Land under claims" value={`${number(summary?.total_claimed_area_hectares)} ha`} detail="Claimed area" loading={loading} />
              </div>
              <div className="mt-4 rounded-xl border border-[#e3e7df] bg-white/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-[#344d3b]">Scheme assessments</span>
                  <span className="text-[10px] text-[#7b8b7e]">Recorded DSS results</span>
                </div>
                <div className="mt-3 flex items-end gap-2">
                  <strong className="font-[Manrope] text-3xl font-bold tracking-tight text-[#254c35]">{monitoring ? number(eligibleCount) : "—"}</strong>
                  <span className="pb-1 text-xs text-[#718176]">eligible assessments</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-[#edf0ea] pt-3 text-[10px] text-[#6f7d72]">
                  <span>{number(assessedCount)} assessments recorded</span><span>{number(coveredCount)} confirmed covered</span>
                </div>
              </div>
              <p className="mt-3 text-[10px] leading-4 text-[#879188]">Eligibility assessments and confirmed scheme coverage are counted from their respective records.</p>
            </div>
          </motion.div>
        </div>
      </section>

      <main className="relative isolate mx-auto max-w-[1440px] space-y-12 px-4 pt-8 sm:px-8 sm:pt-10 lg:px-10">
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden="true">
          <motion.div className="absolute -left-44 top-[4rem] h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,rgba(72,119,76,0.58)_0%,rgba(94,139,91,0.28)_48%,transparent_72%)] blur-xl" animate={{ x: shouldReduceMotion ? [0, 2, 0] : [0, 72, -36, 0], y: shouldReduceMotion ? [0, -2, 0] : [0, 50, -24, 0], scale: [0.92, 1.12, 0.96, 0.92], opacity: [0.7, 1, 0.8, 0.7] }} transition={{ duration: shouldReduceMotion ? 30 : 15, repeat: Infinity, ease: "easeInOut" }} />
          <motion.div className="absolute -right-48 top-[68rem] h-[36rem] w-[36rem] rounded-full bg-[radial-gradient(circle,rgba(76,122,81,0.52)_0%,rgba(97,143,94,0.24)_50%,transparent_72%)] blur-xl" animate={{ x: shouldReduceMotion ? [0, -2, 0] : [0, -62, 32, 0], y: shouldReduceMotion ? [0, 2, 0] : [0, -46, 30, 0], scale: [1, 0.9, 1.1, 1], opacity: [0.66, 1, 0.78, 0.66] }} transition={{ duration: shouldReduceMotion ? 34 : 18, repeat: Infinity, ease: "easeInOut", delay: 1 }} />
          <motion.div className="absolute -left-48 top-[145rem] h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,rgba(139,126,72,0.38)_0%,rgba(162,148,91,0.18)_50%,transparent_72%)] blur-xl" animate={{ x: shouldReduceMotion ? [0, 2, 0] : [0, 52, -28, 0], y: shouldReduceMotion ? [0, -2, 0] : [0, 40, -34, 0], scale: [1, 1.1, 0.94, 1], opacity: [0.56, 0.9, 0.68, 0.56] }} transition={{ duration: shouldReduceMotion ? 36 : 20, repeat: Infinity, ease: "easeInOut", delay: 1.8 }} />
          <motion.div className="absolute -right-40 top-[220rem] h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,rgba(72,119,76,0.5)_0%,rgba(94,139,91,0.22)_50%,transparent_72%)] blur-xl" animate={{ x: shouldReduceMotion ? [0, -2, 0] : [0, -48, 26, 0], y: shouldReduceMotion ? [0, 2, 0] : [0, -36, 30, 0], scale: [0.94, 1.12, 0.96, 0.94], opacity: [0.55, 0.92, 0.68, 0.55] }} transition={{ duration: shouldReduceMotion ? 38 : 22, repeat: Infinity, ease: "easeInOut", delay: 0.7 }} />
        </div>
        <motion.section aria-label="Key FRA indicators" className="relative z-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" initial={shouldReduceMotion ? false : "hidden"} whileInView={shouldReduceMotion ? undefined : "visible"} viewport={{ once: true, amount: 0.2 }} variants={revealGroup}>
          <motion.div variants={revealItem} whileHover={shouldReduceMotion ? undefined : { y: -4, scale: 1.01 }}><StatCard icon={<FileText size={17} />} label="Total claim records" value={summary?.total_claims} supporting={`${number(summary?.villages_covered)} villages represented`} color="green" loading={loading} /></motion.div>
          <motion.div variants={revealItem} whileHover={shouldReduceMotion ? undefined : { y: -4, scale: 1.01 }}><StatCard icon={<Check size={17} />} label="Approved or verified" value={summary?.approved_claims} supporting={`${number(summary?.pending_claims)} awaiting a decision`} color="sage" loading={loading} /></motion.div>
          <motion.div variants={revealItem} whileHover={shouldReduceMotion ? undefined : { y: -4, scale: 1.01 }}><StatCard icon={<Map size={17} />} label="Districts covered" value={summary?.districts_covered} supporting={`${number(summary?.states_covered)} states in the registry`} color="blue" loading={loading} /></motion.div>
          <motion.div variants={revealItem} whileHover={shouldReduceMotion ? undefined : { y: -4, scale: 1.01 }}><StatCard icon={<Sprout size={17} />} label="Area discrepancy flags" value={summary?.flagged_discrepancies} supporting="Geometry review indicators" color="amber" loading={loading} /></motion.div>
        </motion.section>

        <motion.section className="relative z-10 isolate overflow-hidden rounded-[1.6rem] border border-[#d9e4d9] bg-[#f1f4ed] p-5 sm:p-7" initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }} whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.18 }} transition={{ duration: 0.7, ease: "easeOut" }}>
          <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
            <motion.div className="absolute -right-16 -top-24 h-72 w-72 rounded-full border-2 border-[#759572]/75" animate={{ rotate: shouldReduceMotion ? [0, 2, 0] : [0, 28, 0], scale: [1, 1.04, 1], opacity: [0.7, 1, 0.7] }} transition={{ duration: shouldReduceMotion ? 36 : 19, repeat: Infinity, ease: "easeInOut" }} />
            <motion.div className="absolute -right-4 -top-12 h-48 w-48 rounded-full border-2 border-[#759572]/70" animate={{ rotate: shouldReduceMotion ? [0, -2, 0] : [0, -32, 0], scale: [1, 0.96, 1], opacity: [0.62, 1, 0.62] }} transition={{ duration: shouldReduceMotion ? 32 : 16, repeat: Infinity, ease: "easeInOut", delay: 0.8 }} />
            <motion.div className="absolute -left-20 bottom-[-9rem] h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(73,119,76,0.44)_0%,rgba(100,142,93,0.2)_44%,transparent_70%)] blur-xl" animate={{ x: [0, 42, -18, 0], y: [0, -26, 16, 0], scale: [1, 1.1, 0.94, 1], opacity: [0.64, 1, 0.7, 0.64] }} transition={{ duration: shouldReduceMotion ? 38 : 21, repeat: Infinity, ease: "easeInOut" }} />
          </div>
          <div className="relative">
            <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#778878]">A live reading of the registry</p><h2 className="mt-1 font-[Manrope] text-xl font-semibold tracking-tight text-[#263e2d]">What the recorded data is showing</h2></div><span className="text-[10px] text-[#879287]">Derived from current claim and DSS records</span></div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <InsightCard reduceMotion={Boolean(shouldReduceMotion)} index={0} icon={<ShieldCheck size={16} />} label="Approved / verified share" value={approvalShare === null ? "—" : `${approvalShare.toFixed(1)}%`} detail={summary ? `${number(summary.approved_claims)} of ${number(summary.total_claims)} claim records` : "Registry data unavailable"} accent="green" />
              <InsightCard reduceMotion={Boolean(shouldReduceMotion)} index={1} icon={<MapPin size={16} />} label="Largest state grouping" value={leadingState?.state || "—"} detail={leadingState && leadingStateShare !== null ? `${number(leadingState.count)} records · ${leadingStateShare.toFixed(1)}% of registry` : "No geographic records available"} accent="blue" />
              <InsightCard reduceMotion={Boolean(shouldReduceMotion)} index={2} icon={<Layers3 size={16} />} label="Leading eligible scheme" value={leadingScheme?.scheme_code || "—"} detail={leadingScheme ? `${number(leadingScheme.eligible_beneficiaries)} eligible assessments · ${leadingScheme.scheme_name}` : "No eligible DSS assessments recorded"} accent="amber" />
              <InsightCard reduceMotion={Boolean(shouldReduceMotion)} index={3} icon={<Activity size={16} />} label="Assessment coverage" value={assessmentCoverage === null ? "—" : `${assessmentCoverage.toFixed(1)}%`} detail={claimSchemePairs ? `${number(assessedCount)} of ${number(claimSchemePairs)} claim–scheme pairs assessed` : "No active claim–scheme pairs in this view"} accent="sage" />
            </div>
            <p className="mt-4 text-[10px] leading-4 text-[#788579]">These are descriptive record counts. Approval share is not a household rate, and scheme eligibility counts are assessments, not confirmed enrollments.</p>
          </div>
        </motion.section>

        <motion.section className="relative z-10 grid gap-7 xl:grid-cols-[1.5fr_0.8fr] xl:items-stretch" initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }} whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.1 }} transition={{ duration: 0.7, ease: "easeOut" }}>
          <div className="overflow-hidden rounded-[1.5rem] border border-[#dce5dc] bg-white shadow-[0_14px_45px_rgba(28,55,38,0.08)]">
            <div className="flex flex-col justify-between gap-3 border-b border-[#edf0eb] px-5 py-4 sm:flex-row sm:items-center sm:px-6">
              <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#eaf2e9] text-[#397050]"><Map size={17} /></span><div><p className="text-sm font-bold text-[#243c2d]">The forest rights landscape</p><p className="mt-0.5 text-[11px] text-[#79877c]">Explore recorded claim parcels and their geography</p></div></div>
              <Link href="/atlas" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#376c4b] hover:text-[#214d35]">Open full atlas <ArrowRight size={14} /></Link>
            </div>
            <div className="h-[390px] bg-[#e8eee8] sm:h-[470px]"><WebGISMap height="h-[390px] sm:h-[470px]" /></div>
            <div className="grid gap-3 border-t border-[#edf0eb] bg-[#fbfcfa] p-4 sm:grid-cols-3 sm:px-6">
              <MapNote icon={<MapPin size={14} />} title="Claim geography" text="View mapped parcels and administrative locations." />
              <MapNote icon={<Trees size={14} />} title="Landscape context" text="Review land cover and satellite analysis records." />
              <MapNote icon={<ArrowDownRight size={14} />} title="Follow the record" text="Open a claim to inspect its supporting details." />
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <section className="rounded-[1.5rem] border border-[#dce5dc] bg-white p-5 shadow-[0_14px_45px_rgba(28,55,38,0.06)] sm:p-6">
              <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#849086]">Claim workflow</p><h2 className="mt-1 text-base font-bold text-[#243c2d]">Where claims stand</h2></div><Activity size={17} className="mt-1 text-[#4a805d]" /></div>
              <div className="mt-5 h-[210px]">
                {statusData.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={statusData} layout="vertical" margin={{ top: 2, right: 8, left: 4, bottom: 2 }}><CartesianGrid stroke="#edf1ec" horizontal={false} /><XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: "#879187" }} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="label" width={112} tick={{ fontSize: 10, fill: "#68776c" }} axisLine={false} tickLine={false} /><Tooltip cursor={{ fill: "#f3f6f2" }} contentStyle={{ borderRadius: 10, borderColor: "#e1e8e0", fontSize: 11 }} /><Bar dataKey="count" name="Claim records" radius={[0, 5, 5, 0]}>{statusData.map((entry) => <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || "#73917a"} />)}</Bar></BarChart></ResponsiveContainer> : <EmptyPanel loading={loading} text="Workflow counts will appear as claims are recorded." />}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-[#edf0eb] pt-4"><span className="text-[11px] text-[#7b887e]">Pending review</span><strong className="text-sm text-[#a77635]">{number(summary?.pending_claims)} claims</strong></div>
            </section>

            <section className="rounded-[1.5rem] border border-[#dce5dc] bg-[#edf3eb] p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#758578]">Landscape indicators</p><h2 className="mt-1 text-base font-bold text-[#243c2d]">Observed land cover</h2></div><Sprout size={18} className="mt-1 text-[#4b805c]" /></div>
              {landData.length ? <div className="mt-4 flex items-center gap-4">
                <div className="h-[116px] w-[116px] shrink-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={landData} dataKey="value" nameKey="name" innerRadius={33} outerRadius={52} paddingAngle={2} stroke="none">{landData.map((item, index) => <Cell key={item.name} fill={LAND_COLORS[index % LAND_COLORS.length]} />)}</Pie><Tooltip formatter={(value) => [`${number(Number(value))} ha`, "Observed area"]} contentStyle={{ borderRadius: 10, borderColor: "#e1e8e0", fontSize: 11 }} /></PieChart></ResponsiveContainer></div>
                <div className="min-w-0 flex-1 space-y-2">{landData.map((item, index) => <div key={item.name} className="flex items-center justify-between gap-2 text-[11px]"><span className="flex min-w-0 items-center gap-2 text-[#5e7163]"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: LAND_COLORS[index % LAND_COLORS.length] }} />{item.name}</span><strong className="shrink-0 font-semibold text-[#344c39]">{number(item.value)} ha</strong></div>)}</div>
              </div> : <EmptyPanel loading={loading} text="Land-cover totals appear after satellite analysis is recorded." />}
              <p className="mt-4 flex items-start gap-2 border-t border-[#dce6da] pt-3 text-[10px] leading-4 text-[#718073]"><Waves size={13} className="mt-0.5 shrink-0" /> Satellite indicators describe observed land cover; they do not determine legal title or scheme enrollment.</p>
            </section>
          </div>
        </motion.section>

        <motion.section className="relative z-10 grid gap-5 xl:grid-cols-[1.3fr_0.7fr]" initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }} whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }} transition={{ duration: 0.7, ease: "easeOut" }}>
          <article className="rounded-[1.5rem] border border-[#dce5dc] bg-white p-5 shadow-[0_10px_34px_rgba(28,55,38,0.05)] sm:p-6">
            <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#849086]">Geographic reach</p><h2 className="mt-1 text-base font-bold text-[#243c2d]">Claim records across states</h2></div><MapPin size={17} className="mt-1 text-[#4a805d]" /></div>
            <div className="mt-4 h-[260px]">{stateData.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={stateData} layout="vertical" margin={{ top: 3, right: 12, left: 5, bottom: 3 }}><CartesianGrid stroke="#edf1ec" horizontal={false} /><XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: "#879187" }} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="state" width={118} tick={{ fontSize: 10, fill: "#68776c" }} axisLine={false} tickLine={false} /><Tooltip cursor={{ fill: "#f3f6f2" }} contentStyle={{ borderRadius: 10, borderColor: "#e1e8e0", fontSize: 11 }} /><Bar dataKey="count" name="Claim records" fill="#527f5c" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer> : <EmptyPanel loading={loading} text="State distribution will appear as claims are recorded." />}</div>
            <p className="mt-2 text-[10px] text-[#89958b]">Top 10 states by recorded claim volume.</p>
          </article>
          <article className="rounded-[1.5rem] border border-[#dce5dc] bg-[#f7f8f3] p-5 sm:p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#849086]">Rights categories</p><h2 className="mt-1 text-base font-bold text-[#243c2d]">Claim type composition</h2>
            <div className="mt-6 space-y-5">{claimTypeData.map((item, index) => {
              const total = claimTypeData.reduce((sum, type) => sum + type.count, 0);
              const share = total ? (item.count / total) * 100 : 0;
              return <div key={item.code}><div className="flex items-baseline justify-between gap-3"><span className="text-xs font-semibold text-[#405747]">{item.name} <span className="ml-1 text-[10px] font-medium text-[#879287]">{item.code}</span></span><strong className="text-sm text-[#304b37]">{loading ? "—" : number(item.count)}</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e5e9df]"><div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${share}%`, background: LAND_COLORS[index] }} /></div><p className="mt-1 text-right text-[10px] text-[#8b968d]">{loading ? "" : `${share.toFixed(1)}% of recorded claims`}</p></div>;
            })}</div>
            <p className="mt-6 border-t border-[#e1e6dc] pt-4 text-[10px] leading-4 text-[#859087]">Category totals describe claim records in the current registry. They do not represent unique households or finalized titles.</p>
          </article>
        </motion.section>

        <motion.section className="relative z-10 grid gap-6 lg:grid-cols-[0.75fr_1.25fr]" initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }} whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }} transition={{ duration: 0.7, ease: "easeOut" }}>
          <div className="rounded-[1.5rem] bg-[#f0f2e9] p-6 sm:p-7">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#778576]">A connected workflow</p>
            <h2 className="mt-2 max-w-md font-[Manrope] text-2xl font-semibold leading-tight tracking-tight text-[#243c2d]">From a claim record to a clearer next step.</h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-[#68776a]">Bring evidence together, understand the local picture, and review where convergence may need attention.</p>
            <Link href="/claims" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#376c4b] hover:text-[#214d35]">Open the claims registry <ArrowRight size={15} /></Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <WorkflowCard reduceMotion={Boolean(shouldReduceMotion)} number="01" icon={<FileText size={17} />} title="Record claims" text="Keep applicant, title, status and location information together." href="/claims" action="Claims registry" />
            <WorkflowCard reduceMotion={Boolean(shouldReduceMotion)} number="02" icon={<Map size={17} />} title="Understand land" text="Review parcel boundaries alongside recorded satellite indicators." href="/atlas" action="Forest atlas" />
            <WorkflowCard reduceMotion={Boolean(shouldReduceMotion)} number="03" icon={<Bot size={17} />} title="Review convergence" text="Explore scheme assessments and administrative monitoring." href="/monitoring" action="Monitoring" />
          </div>
        </motion.section>

        <motion.section className="relative z-10 flex flex-col justify-between gap-5 rounded-[1.5rem] border border-[#d9e4d9] bg-white px-5 py-6 shadow-[0_12px_36px_rgba(28,55,38,0.05)] sm:flex-row sm:items-center sm:px-7" initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }} whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.65, ease: "easeOut" }}>
          <div className="flex items-start gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#e9f1e8] text-[#3c7653]"><Bot size={20} /></span><div><h2 className="text-base font-bold text-[#243c2d]">Need a closer look at a claim or scheme?</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-[#748176]">Ask the Decision Support System to explain recorded claim context, eligibility assessments, policy citations and next steps.</p></div></div>
          <Link href="/dss" className="group inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#28563b] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1f452f]">Open decision support <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" /></Link>
        </motion.section>

        <footer className="flex flex-col justify-between gap-2 border-t border-[#e1e7df] pt-5 text-[10px] text-[#879187] sm:flex-row sm:items-center">
          <span>FRA Atlas · Forest Rights Act implementation workspace</span>
          <span>{updatedAt ? `Registry data refreshed ${updatedAt.toLocaleTimeString()}` : loading ? "Registry data loading" : "Registry data unavailable"} · Updates automatically</span>
        </footer>
      </main>
      </div>
    </div>
  );
}

function HeroMetric({ icon, label, value, detail, loading }: { icon: ReactNode; label: string; value: string; detail: string; loading: boolean }) {
  return <div className="rounded-xl border border-[#e3e7df] bg-white/75 p-3.5"><span className="flex items-center gap-1.5 text-[10px] font-medium text-[#77847a]">{icon}{label}</span><strong className="mt-2 block font-[Manrope] text-xl font-bold tracking-tight text-[#284b34]">{loading ? "—" : value}</strong><span className="mt-0.5 block text-[10px] text-[#93a096]">{detail}</span></div>;
}

function StatCard({ icon, label, value, supporting, color, loading }: { icon: ReactNode; label: string; value?: number; supporting: string; color: string; loading: boolean }) {
  const tones: Record<string, string> = { green: "bg-[#eaf2eb] text-[#3b7652]", sage: "bg-[#eef1e6] text-[#70824b]", blue: "bg-[#eaf0f1] text-[#4f7884]", amber: "bg-[#f5eee2] text-[#a87937]" };
  return <article className="forest-card-hover rounded-2xl border border-[#e0e7df] bg-white p-4 shadow-[0_5px_18px_rgba(28,55,38,0.035)]"><div className="flex items-start justify-between gap-3"><span className="text-[11px] font-medium text-[#78867a]">{label}</span><span className={`grid h-8 w-8 place-items-center rounded-xl ${tones[color]}`}>{icon}</span></div><strong className="mt-3 block font-[Manrope] text-3xl font-bold tracking-tight text-[#263d2d]">{loading ? "—" : number(value)}</strong><p className="mt-1 text-[10px] text-[#8a958b]">{supporting}</p></article>;
}

function InsightCard({ icon, label, value, detail, accent, index, reduceMotion }: { icon: ReactNode; label: string; value: string; detail: string; accent: string; index: number; reduceMotion: boolean }) {
  const tones: Record<string, string> = {
    green: "bg-[#e7f0e7] text-[#3b7652]", blue: "bg-[#e8eff0] text-[#4f7884]",
    amber: "bg-[#f4ecdf] text-[#a87937]", sage: "bg-[#ecefe3] text-[#70824b]",
  };
  return <motion.article className="min-w-0 rounded-2xl border border-white/80 bg-white/90 p-4 shadow-[0_6px_20px_rgba(35,59,39,0.045)]" initial={reduceMotion ? false : { opacity: 0, y: 16 }} whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.5, delay: index * 0.08, ease: "easeOut" }} whileHover={reduceMotion ? undefined : { y: -5, scale: 1.015, boxShadow: "0 16px 30px rgba(35,59,39,0.12)" }}><div className="flex items-center gap-2"><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${tones[accent]}`}>{icon}</span><span className="text-[10px] font-semibold text-[#78867a]">{label}</span></div><strong className="mt-3 block truncate font-[Manrope] text-2xl font-bold tracking-tight text-[#294333]" title={value}>{value}</strong><p className="mt-1 min-h-8 text-[10px] leading-4 text-[#859087]">{detail}</p></motion.article>;
}

function MapNote({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return <div className="flex items-start gap-2.5"><span className="mt-0.5 text-[#568064]">{icon}</span><div><p className="text-[11px] font-semibold text-[#425848]">{title}</p><p className="mt-0.5 text-[10px] leading-4 text-[#849087]">{text}</p></div></div>;
}

function WorkflowCard({ number: step, icon, title, text, href, action, reduceMotion }: { number: string; icon: ReactNode; title: string; text: string; href: string; action: string; reduceMotion: boolean }) {
  return <motion.article className="flex flex-col rounded-2xl border border-[#e0e7df] bg-white p-5 shadow-[0_5px_18px_rgba(28,55,38,0.035)]" initial={reduceMotion ? false : { opacity: 0, y: 16 }} whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.5, ease: "easeOut" }} whileHover={reduceMotion ? undefined : { y: -4 }}><div className="flex items-center justify-between"><span className="font-[Manrope] text-xs font-bold tracking-widest text-[#8e9c8d]">{step}</span><span className="text-[#4c805e]">{icon}</span></div><h3 className="mt-5 text-sm font-bold text-[#304535]">{title}</h3><p className="mt-2 flex-1 text-xs leading-5 text-[#758277]">{text}</p><Link href={href} className="mt-5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#3d714e]">{action}<ArrowRight size={13} /></Link></motion.article>;
}

function EmptyPanel({ loading, text }: { loading: boolean; text: string }) {
  return <div className="flex h-full min-h-24 items-center justify-center rounded-xl border border-dashed border-[#d9e2d8] px-4 text-center text-xs text-[#879287]">{loading ? <span className="inline-flex items-center gap-2"><RefreshCw size={13} className="animate-spin" /> Loading registry data</span> : text}</div>;
}
