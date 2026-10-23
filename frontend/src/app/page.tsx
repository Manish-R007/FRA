"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Activity, ArrowRight, BarChart3, Bot, Check, Compass, FileText,
  Layers3, Map, MapPin, RefreshCw, ShieldCheck, Sprout, Trees, Waves, Zap, Award,
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
  APPROVED: "#3dba78", REJECTED: "#c45a32", PENDING_VERIFICATION: "#e2b45c",
  FIELD_VERIFICATION: "#5ec4c8", GIS_VALIDATED: "#6fd392", SATELLITE_ANALYZE: "#7ec8e3",
  UPLOADED: "#9fb3a4", OCR_PROCESSED: "#c4843a",
};
const LAND_COLORS = ["#3dba78", "#e2b45c", "#5ec4c8", "#c45a32", "#c4843a"];
const chartTooltip = { borderRadius: 16, border: "1px solid rgba(226,180,92,0.25)", background: "rgba(6,22,16,0.94)", color: "#f3ead6", fontSize: 11 };
const revealItem: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};
const revealGroup: Variants = { hidden: {}, visible: { transition: { staggerChildren: 0.1 } } };
const number = (value?: number) => value === undefined || value === null ? "—" : value.toLocaleString("en-IN", { maximumFractionDigits: 1 });

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

  const statusData = useMemo(() => (stats?.charts.by_status ?? []).filter((item) => item.count > 0).map((item) => ({ ...item, label: item.status.replaceAll("_", " ").toLowerCase() })), [stats]);
  const stateData = useMemo(() => [...(stats?.charts.by_state ?? [])].sort((a, b) => b.count - a.count).slice(0, 10), [stats]);
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
  const leadingScheme = monitoring?.totals.schemes.filter((scheme) => scheme.eligible_beneficiaries > 0).sort((a, b) => b.eligible_beneficiaries - a.eligible_beneficiaries)[0];

  return (
    <div className="relative isolate overflow-hidden pb-20">
      <section className="relative px-5 pt-10 sm:px-8 lg:px-12 lg:pt-16">
        <div className="mx-auto grid max-w-[1440px] items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
          <motion.div initial={shouldReduceMotion ? false : { opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <motion.p className="kicker inline-flex items-center gap-2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Award size={13} /> Ministry of Tribal Affairs · FRA 2006
            </motion.p>
            <h1 className="mt-5 max-w-3xl font-display text-5xl leading-[0.92] sm:text-7xl lg:text-[86px]">
              Rights written
              <br />
              into the <span className="italic text-[var(--gold)]">canopy.</span>
            </h1>
            <p className="mt-6 max-w-xl text-sm leading-7 text-[var(--ink-muted)] sm:text-base">
              Map Individual, Community and Community Forest Resource claims. Read satellite land-cover. Follow scheme convergence from a single living workspace.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/atlas" className="btn-gold"><Compass size={16} /> Open the atlas <ArrowRight size={15} /></Link>
              <Link href="/monitoring" className="btn-ghost"><BarChart3 size={16} /> Scheme monitoring</Link>
            </div>
            <p className="mt-6 flex items-center gap-2 text-[11px] text-[var(--ink-muted)]">
              <span className="status-dot" />
              {loading ? "Connecting to the FRA registry…" : updatedAt ? `Registry live · ${updatedAt.toLocaleTimeString()}` : "Registry unavailable"}
            </p>
          </motion.div>

          <motion.div className="relative" initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.94, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.85, delay: 0.12 }}>
            <div className="absolute -inset-6 rounded-[2.2rem] bg-[radial-gradient(circle,rgba(226,180,92,0.18),transparent_70%)] blur-2xl" />
            <div className="glass-panel-glow relative p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="kicker">Registry pulse</p>
                  <h2 className="mt-1 font-display text-3xl">Live FRA glance</h2>
                </div>
                <span className="rounded-full border border-[var(--line)] px-3 py-1 text-[10px] text-[var(--gold)]">Atlas</span>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <HeroMetric icon={<FileText size={15} />} label="Claim records" value={number(summary?.total_claims)} detail="In the registry" loading={loading} />
                <HeroMetric icon={<ShieldCheck size={15} />} label="Approved titles" value={number(summary?.approved_claims)} detail="Recognized" loading={loading} />
                <HeroMetric icon={<MapPin size={15} />} label="States" value={number(summary?.states_covered)} detail="Represented" loading={loading} />
                <HeroMetric icon={<Layers3 size={15} />} label="Claimed land" value={`${number(summary?.total_claimed_area_hectares)} ha`} detail="Area on record" loading={loading} />
              </div>
              <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[rgba(226,180,92,0.08)] p-4">
                <p className="text-xs text-[var(--ink-muted)]">Scheme assessments</p>
                <strong className="mt-1 block font-display text-4xl text-[var(--gold)]">{monitoring ? number(eligibleCount) : "—"}</strong>
                <p className="mt-2 text-[10px] text-[var(--ink-muted)]">{number(assessedCount)} assessed · {number(coveredCount)} confirmed covered</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <main className="relative mx-auto mt-14 max-w-[1440px] space-y-10 px-4 sm:px-8 lg:px-12">
        <motion.section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" initial={shouldReduceMotion ? false : "hidden"} whileInView={shouldReduceMotion ? undefined : "visible"} viewport={{ once: true, amount: 0.2 }} variants={revealGroup}>
          <motion.div variants={revealItem} whileHover={shouldReduceMotion ? undefined : { y: -8 }}><StatCard icon={<FileText size={17} />} label="Total claim records" value={summary?.total_claims} supporting={`${number(summary?.villages_covered)} villages represented`} loading={loading} /></motion.div>
          <motion.div variants={revealItem} whileHover={shouldReduceMotion ? undefined : { y: -8 }}><StatCard icon={<Check size={17} />} label="Approved or verified" value={summary?.approved_claims} supporting={`${number(summary?.pending_claims)} awaiting a decision`} loading={loading} /></motion.div>
          <motion.div variants={revealItem} whileHover={shouldReduceMotion ? undefined : { y: -8 }}><StatCard icon={<Map size={17} />} label="Districts covered" value={summary?.districts_covered} supporting={`${number(summary?.states_covered)} states in the registry`} loading={loading} /></motion.div>
          <motion.div variants={revealItem} whileHover={shouldReduceMotion ? undefined : { y: -8 }}><StatCard icon={<Sprout size={17} />} label="Area discrepancy flags" value={summary?.flagged_discrepancies} supporting="Geometry review indicators" loading={loading} /></motion.div>
        </motion.section>

        <motion.section className="glass-panel relative overflow-hidden p-6 sm:p-8" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
          <div className="mb-6 flex items-center gap-3">
            <span className="icon-chip"><Zap size={18} /></span>
            <div>
              <p className="kicker">Live reading</p>
              <h2 className="font-display text-3xl">What the recorded data is showing</h2>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <InsightCard reduceMotion={Boolean(shouldReduceMotion)} index={0} icon={<ShieldCheck size={16} />} label="Approved share" value={approvalShare === null ? "—" : `${approvalShare.toFixed(1)}%`} detail={summary ? `${number(summary.approved_claims)} of ${number(summary.total_claims)} records` : "Unavailable"} />
            <InsightCard reduceMotion={Boolean(shouldReduceMotion)} index={1} icon={<MapPin size={16} />} label="Largest state grouping" value={leadingState?.state || "—"} detail={leadingState && leadingStateShare !== null ? `${number(leadingState.count)} records · ${leadingStateShare.toFixed(1)}%` : "No geographic records"} />
            <InsightCard reduceMotion={Boolean(shouldReduceMotion)} index={2} icon={<Layers3 size={16} />} label="Leading eligible scheme" value={leadingScheme?.scheme_code || "—"} detail={leadingScheme ? `${number(leadingScheme.eligible_beneficiaries)} eligible · ${leadingScheme.scheme_name}` : "No assessments"} />
            <InsightCard reduceMotion={Boolean(shouldReduceMotion)} index={3} icon={<Activity size={16} />} label="Assessment coverage" value={assessmentCoverage === null ? "—" : `${assessmentCoverage.toFixed(1)}%`} detail={claimSchemePairs ? `${number(assessedCount)} of ${number(claimSchemePairs)} pairs assessed` : "No pairs in view"} />
          </div>
        </motion.section>

        <motion.section className="grid gap-6 xl:grid-cols-[1.5fr_0.8fr]" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
          <div className="glass-panel overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-6 py-5">
              <div className="flex items-center gap-3">
                <span className="icon-chip"><Map size={17} /></span>
                <div>
                  <h2 className="font-display text-2xl">The forest rights landscape</h2>
                  <p className="text-[11px] text-[var(--ink-muted)]">Recorded parcels and their geography</p>
                </div>
              </div>
              <Link href="/atlas" className="text-xs font-semibold text-[var(--gold)] inline-flex items-center gap-1">Full atlas <ArrowRight size={14} /></Link>
            </div>
            <div className="h-[390px] sm:h-[470px]"><WebGISMap height="h-[390px] sm:h-[470px]" /></div>
          </div>
          <div className="flex flex-col gap-5">
            <section className="glass-panel p-5 sm:p-6">
              <div className="flex items-center gap-2.5">
                <span className="icon-chip"><Activity size={15} /></span>
                <h2 className="font-display text-xl">Where claims stand</h2>
              </div>
              <div className="mt-5 h-[210px]">
                {statusData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statusData} layout="vertical" margin={{ top: 2, right: 8, left: 4, bottom: 2 }}>
                      <CartesianGrid stroke="rgba(226,180,92,0.08)" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: "#8fa897" }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="label" width={112} tick={{ fontSize: 10, fill: "#d7e4d4" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={chartTooltip} />
                      <Bar dataKey="count" name="Claim records" radius={[0, 8, 8, 0]}>{statusData.map((entry) => <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || "#3dba78"} />)}</Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyPanel loading={loading} text="Workflow counts will appear as claims are recorded." />}
              </div>
            </section>
            <section className="glass-panel-glow p-5 sm:p-6">
              <div className="flex items-center gap-2.5">
                <span className="icon-chip"><Sprout size={15} /></span>
                <h2 className="font-display text-xl">Observed land cover</h2>
              </div>
              {landData.length ? (
                <div className="mt-4 flex items-center gap-4">
                  <div className="h-[116px] w-[116px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={landData} dataKey="value" nameKey="name" innerRadius={33} outerRadius={52} paddingAngle={3} stroke="none">
                          {landData.map((item, index) => <Cell key={item.name} fill={LAND_COLORS[index % LAND_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(value) => [`${number(Number(value))} ha`, "Observed area"]} contentStyle={chartTooltip} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    {landData.map((item, index) => (
                      <div key={item.name} className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="flex items-center gap-2 text-[var(--ink-soft)]"><span className="h-2.5 w-2.5 rounded-full" style={{ background: LAND_COLORS[index % LAND_COLORS.length] }} />{item.name}</span>
                        <strong>{number(item.value)} ha</strong>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <EmptyPanel loading={loading} text="Land-cover totals appear after satellite analysis is recorded." />}
              <p className="mt-4 flex items-start gap-2 border-t border-[var(--line)] pt-3 text-[10px] text-[var(--ink-muted)]"><Waves size={13} className="mt-0.5" /> Satellite indicators describe observed land cover; they do not determine legal title.</p>
            </section>
          </div>
        </motion.section>

        <motion.section className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
          <article className="glass-panel p-5 sm:p-6">
            <div className="flex items-center gap-2.5">
              <span className="icon-chip"><MapPin size={15} /></span>
              <h2 className="font-display text-2xl">Claim records across states</h2>
            </div>
            <div className="mt-4 h-[260px]">
              {stateData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stateData} layout="vertical" margin={{ top: 3, right: 12, left: 5, bottom: 3 }}>
                    <CartesianGrid stroke="rgba(226,180,92,0.08)" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: "#8fa897" }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="state" width={118} tick={{ fontSize: 10, fill: "#d7e4d4" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={chartTooltip} />
                    <Bar dataKey="count" name="Claim records" fill="#e2b45c" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyPanel loading={loading} text="State distribution will appear as claims are recorded." />}
            </div>
          </article>
          <article className="glass-panel p-5 sm:p-6">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="icon-chip"><Layers3 size={15} /></span>
              <h2 className="font-display text-2xl">Claim type composition</h2>
            </div>
            <div className="space-y-5">
              {claimTypeData.map((item, index) => {
                const total = claimTypeData.reduce((sum, type) => sum + type.count, 0);
                const share = total ? (item.count / total) * 100 : 0;
                return (
                  <div key={item.code}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs">{item.name} <span className="text-[var(--gold)]">{item.code}</span></span>
                      <strong>{loading ? "—" : number(item.count)}</strong>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
                      <motion.div className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${LAND_COLORS[index]}, #e2b45c)` }} initial={{ width: 0 }} whileInView={{ width: `${share}%` }} viewport={{ once: true }} transition={{ duration: 1, delay: index * 0.15 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        </motion.section>

        <motion.section className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
          <div className="glass-panel-glow p-7">
            <p className="kicker">Connected workflow</p>
            <h2 className="mt-2 font-display text-4xl leading-tight">From a claim record to a clearer next step.</h2>
            <Link href="/claims" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--gold)]">Open the claims registry <ArrowRight size={15} /></Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <WorkflowCard reduceMotion={Boolean(shouldReduceMotion)} number="01" icon={<FileText size={17} />} title="Record claims" text="Keep applicant, title, status and location together." href="/claims" action="Claims registry" />
            <WorkflowCard reduceMotion={Boolean(shouldReduceMotion)} number="02" icon={<Map size={17} />} title="Understand land" text="Review parcel boundaries alongside satellite indicators." href="/atlas" action="Forest atlas" />
            <WorkflowCard reduceMotion={Boolean(shouldReduceMotion)} number="03" icon={<Bot size={17} />} title="Review convergence" text="Explore scheme assessments and monitoring." href="/monitoring" action="Monitoring" />
          </div>
        </motion.section>

        <motion.section className="glass-panel flex flex-col justify-between gap-5 px-6 py-7 sm:flex-row sm:items-center" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <div className="flex items-start gap-4">
            <span className="icon-chip"><Bot size={20} /></span>
            <div>
              <h2 className="font-display text-3xl">Need a closer look?</h2>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--ink-muted)]">Ask the Decision Support System about claim context, eligibility, policy citations and next steps.</p>
            </div>
          </div>
          <Link href="/dss" className="btn-gold shrink-0">Open decision support <ArrowRight size={15} /></Link>
        </motion.section>

        <footer className="flex flex-col justify-between gap-2 border-t border-[var(--line)] pt-5 text-[10px] text-[var(--ink-muted)] sm:flex-row">
          <span>FRA Atlas · Forest Rights Act workspace · SIH 2025</span>
          <span>{updatedAt ? `Refreshed ${updatedAt.toLocaleTimeString()}` : loading ? "Loading" : "Unavailable"}</span>
        </footer>
      </main>
    </div>
  );
}

function HeroMetric({ icon, label, value, detail, loading }: { icon: ReactNode; label: string; value: string; detail: string; loading: boolean }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[rgba(255,255,255,0.03)] p-3.5">
      <span className="flex items-center gap-1.5 text-[10px] text-[var(--ink-muted)]">{icon}{label}</span>
      <strong className="mt-2 block font-display text-2xl">{loading ? "—" : value}</strong>
      <span className="text-[10px] text-[var(--ink-muted)]">{detail}</span>
    </div>
  );
}

function StatCard({ icon, label, value, supporting, loading }: { icon: ReactNode; label: string; value?: number; supporting: string; loading: boolean }) {
  return (
    <article className="glass-panel forest-card-hover p-5">
      <div className="flex items-start justify-between">
        <span className="text-[11px] text-[var(--ink-muted)]">{label}</span>
        <span className="icon-chip">{icon}</span>
      </div>
      <strong className="mt-4 block font-display text-4xl">{loading ? "—" : number(value)}</strong>
      <p className="mt-1 text-[10px] text-[var(--ink-muted)]">{supporting}</p>
    </article>
  );
}

function InsightCard({ icon, label, value, detail, index, reduceMotion }: { icon: ReactNode; label: string; value: string; detail: string; index: number; reduceMotion: boolean }) {
  return (
    <motion.article className="rounded-2xl border border-[var(--line)] bg-[rgba(255,255,255,0.03)] p-4" initial={reduceMotion ? false : { opacity: 0, y: 16 }} whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.08 }} whileHover={reduceMotion ? undefined : { y: -6 }}>
      <div className="flex items-center gap-2"><span className="icon-chip !h-8 !w-8">{icon}</span><span className="text-[10px] text-[var(--ink-muted)]">{label}</span></div>
      <strong className="mt-3 block truncate font-display text-3xl">{value}</strong>
      <p className="mt-1 text-[10px] text-[var(--ink-muted)]">{detail}</p>
    </motion.article>
  );
}

function WorkflowCard({ number: step, icon, title, text, href, action, reduceMotion }: { number: string; icon: ReactNode; title: string; text: string; href: string; action: string; reduceMotion: boolean }) {
  return (
    <motion.article className="glass-panel flex flex-col p-5" initial={reduceMotion ? false : { opacity: 0, y: 16 }} whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }} viewport={{ once: true }} whileHover={reduceMotion ? undefined : { y: -6 }}>
      <div className="flex items-center justify-between"><span className="font-display text-lg text-[var(--gold)]">{step}</span><span className="icon-chip">{icon}</span></div>
      <h3 className="mt-5 font-display text-2xl">{title}</h3>
      <p className="mt-2 flex-1 text-xs leading-5 text-[var(--ink-muted)]">{text}</p>
      <Link href={href} className="mt-5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--gold)]">{action}<ArrowRight size={13} /></Link>
    </motion.article>
  );
}

function EmptyPanel({ loading, text }: { loading: boolean; text: string }) {
  return <div className="flex h-full min-h-24 items-center justify-center rounded-xl border border-dashed border-[var(--line)] px-4 text-center text-xs text-[var(--ink-muted)]">{loading ? <span className="inline-flex items-center gap-2"><RefreshCw size={13} className="animate-spin text-[var(--gold)]" /> Loading registry data</span> : text}</div>;
}
