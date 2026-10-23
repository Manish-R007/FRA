"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, RefreshCw, ShieldCheck, BarChart3, MapPin, TrendingUp, Layers } from "lucide-react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";

type SchemeMetric = {
  scheme_id: number; scheme_code: string; scheme_name: string; claims_in_scope: number;
  eligible_beneficiaries: number; eligibility_assessed: number; conditional_beneficiaries: number;
  ineligible_beneficiaries: number; enrolled_beneficiaries: number; confirmed_covered: number;
  pending_beneficiaries: number; confirmed_not_covered: number; coverage_percentage: number | null;
  coverage_denominator: number; unknown_coverage: number;
};
type LocationRow = { state?: string; district?: string; village?: string; claim_count: number; approved_claims: number; schemes: SchemeMetric[] };
type MonitoringData = {
  level: string; refreshed_at: string; locations: LocationRow[];
  totals: { claim_count: number; approved_claims: number; eligible_assessments: number; schemes: SchemeMetric[] };
  options: { states: string[]; districts: string[]; blocks: string[] };
};

const blank: MonitoringData = { level: "state", refreshed_at: "", locations: [], totals: { claim_count: 0, approved_claims: 0, eligible_assessments: 0, schemes: [] }, options: { states: [], districts: [], blocks: [] } };

const revealItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};
const revealGroup: Variants = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };

export default function MonitoringPage() {
  const shouldReduceMotion = useReducedMotion();
  const [level, setLevel] = useState("state");
  const [state, setState] = useState("");
  const [district, setDistrict] = useState("");
  const [block, setBlock] = useState("");
  const [data, setData] = useState<MonitoringData>(blank);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const result = await api.getCoverageMonitoring({ level, state, district, block });
      setData(result);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Monitoring data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [level, state, district, block]);

  useEffect(() => {
    setLoading(true);
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const locations = useMemo(() => [...data.locations].sort((a, b) => b.claim_count - a.claim_count), [data.locations]);
  const schemeChart = useMemo(() => [...data.totals.schemes]
    .sort((a, b) => b.eligible_beneficiaries - a.eligible_beneficiaries)
    .map((row) => ({ name: row.scheme_code, Eligible: row.eligible_beneficiaries, Covered: row.confirmed_covered })), [data.totals.schemes]);
  const locationChart = useMemo(() => locations.slice(0, 12).map((row) => {
    const key = row.village || row.district || row.state || "Unspecified";
    return { name: key, Claims: row.claim_count, Approved: row.approved_claims,
      Eligible: row.schemes.reduce((sum, scheme) => sum + scheme.eligible_beneficiaries, 0) };
  }), [locations]);

  const locationName = (row: LocationRow) => [row.village, row.district, row.state].filter(Boolean).join(", ") || "Unspecified location";

  const STAT_CARDS = [
    { label: "FRA claim records", value: data.totals.claim_count, icon: Activity },
    { label: "Approved / verified", value: data.totals.approved_claims, icon: ShieldCheck },
    { label: "Eligible scheme assessments", value: data.totals.eligible_assessments, icon: TrendingUp },
    { label: "Active schemes", value: data.totals.schemes.length, icon: Layers },
  ];

  return (
    <div className="mx-auto min-h-[calc(100vh-var(--header-height))] max-w-[1500px] space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <motion.header
        className="flex flex-col justify-between gap-4 fra-page-header md:flex-row md:items-end"
        initial={shouldReduceMotion ? false : { opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <p className="kicker inline-flex items-center gap-2">Live administration <span className="status-dot" /></p>
          <h1 className="mt-2 font-display text-5xl">Scheme and FRA monitoring</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ink-muted)]">Explore DSS eligibility assessments and recorded scheme delivery by state, district, and village. Data refreshes automatically every 30 seconds.</p>
        </div>
        <motion.button type="button" onClick={() => void refresh()} className="btn-gold" whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }} whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}>
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh now
        </motion.button>
      </motion.header>

      {/* Filters */}
      <motion.section
        className="glass-panel grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4"
        initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.08 }}
      >
        <label className="text-xs font-medium text-[#556c60]">Geographic view
          <select value={level} onChange={(event) => setLevel(event.target.value)} className="mt-1 block w-full rounded-xl border border-[#dce6e0] bg-white px-3 py-2.5 text-sm text-[#1a2f23]">
            <option value="state">State</option><option value="district">District</option><option value="village">Village</option>
          </select>
        </label>
        <label className="text-xs font-medium text-[#556c60]">State
          <select value={state} onChange={(event) => { setState(event.target.value); setDistrict(""); setBlock(""); }} className="mt-1 block w-full rounded-xl border border-[#dce6e0] bg-white px-3 py-2.5 text-sm text-[#1a2f23]">
            <option value="">All available states</option>{data.options.states.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-[#556c60]">District
          <select value={district} onChange={(event) => { setDistrict(event.target.value); setBlock(""); }} className="mt-1 block w-full rounded-xl border border-[#dce6e0] bg-white px-3 py-2.5 text-sm text-[#1a2f23]">
            <option value="">All available districts</option>{data.options.districts.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-[#556c60]">Block
          <select value={block} onChange={(event) => setBlock(event.target.value)} className="mt-1 block w-full rounded-xl border border-[#dce6e0] bg-white px-3 py-2.5 text-sm text-[#1a2f23]">
            <option value="">All available blocks</option>{data.options.blocks.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </motion.section>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}

      {/* Stat Cards */}
      <motion.section
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        initial={shouldReduceMotion ? false : "hidden"}
        whileInView={shouldReduceMotion ? undefined : "visible"}
        viewport={{ once: true, amount: 0.2 }}
        variants={revealGroup}
      >
        {STAT_CARDS.map(({ label, value, icon: Icon }) => (
          <motion.article
            key={label}
            variants={revealItem}
            whileHover={shouldReduceMotion ? undefined : { y: -6 }}
            className="glass-panel p-5"
          >
            <div className="flex items-start justify-between">
              <p className="text-xs font-medium text-[var(--ink-muted)]">{label}</p>
              <span className="icon-chip"><Icon size={17} /></span>
            </div>
            <p className="mt-3 font-display text-4xl">{loading ? "…" : Number(value).toLocaleString()}</p>
          </motion.article>
        ))}
      </motion.section>

      {/* Charts */}
      <motion.section
        className="grid gap-5 xl:grid-cols-2"
        initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
        whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.6 }}
      >
        <article className="glass-panel min-w-0 p-5 sm:p-6">
          <div className="flex items-start gap-3 mb-4">
            <span className="icon-chip shrink-0"><BarChart3 size={16} /></span>
            <div>
              <h2 className="font-semibold text-[#1a2f23]">Eligible assessments and recorded coverage by scheme</h2>
              <p className="mt-0.5 text-xs text-[#8c9d8f]">Eligibility uses DSS assessments; coverage uses explicit delivery records.</p>
            </div>
          </div>
          <div className="h-[320px]">{schemeChart.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={schemeChart} margin={{ top: 8, right: 12, left: -16, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226,180,92,0.12)" /><XAxis dataKey="name" tick={{ fontSize: 11, fill: "#8fa897" }} /><YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#8fa897" }} /><Tooltip contentStyle={{ borderRadius: 16, border: "1px solid rgba(226,180,92,0.25)", background: "rgba(6,22,16,0.94)", color: "#f3ead6", fontSize: 11 }} /><Legend /><Bar dataKey="Eligible" fill="#e2b45c" radius={[5, 5, 0, 0]} /><Bar dataKey="Covered" fill="#3dba78" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer> : <Empty loading={loading} />}</div>
        </article>
        <article className="glass-panel min-w-0 p-5 sm:p-6">
          <div className="flex items-start gap-3 mb-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#f0ece2] to-[#e6dfd0] text-[#9c6644]"><MapPin size={16} /></span>
            <div>
              <h2 className="font-semibold text-[#1a2f23]">Claims and eligible assessments by {level}</h2>
              <p className="mt-0.5 text-xs text-[#8c9d8f]">Showing up to 12 locations with the most claim records.</p>
            </div>
          </div>
          <div className="h-[320px]">{locationChart.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={locationChart} margin={{ top: 8, right: 12, left: -16, bottom: 44 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226,180,92,0.12)" /><XAxis dataKey="name" angle={-28} textAnchor="end" interval={0} height={66} tick={{ fontSize: 10, fill: "#8fa897" }} /><YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#8fa897" }} /><Tooltip contentStyle={{ borderRadius: 16, border: "1px solid rgba(226,180,92,0.25)", background: "rgba(6,22,16,0.94)", color: "#f3ead6", fontSize: 11 }} /><Legend /><Bar dataKey="Claims" fill="#8fa897" radius={[5, 5, 0, 0]} /><Bar dataKey="Approved" fill="#3dba78" radius={[5, 5, 0, 0]} /><Bar dataKey="Eligible" fill="#e2b45c" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer> : <Empty loading={loading} />}</div>
        </article>
      </motion.section>

      {/* Detail Table */}
      <motion.section
        className="glass-panel space-y-4 p-5"
        initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
        whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.6 }}
      >
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-lg font-bold text-[#1a2f23]">{level[0].toUpperCase() + level.slice(1)}-wise scheme detail</h2>
            <p className="mt-1 text-xs text-[#8c9d8f]">Eligibility uses explicit recorded decisions when present, otherwise DSS recommendations. Unknown delivery is not counted as uncovered.</p>
          </div>
          <p className="text-xs text-[#8c9d8f]">{data.refreshed_at ? `Updated ${new Date(data.refreshed_at).toLocaleTimeString()}` : "Waiting for data"}</p>
        </div>
        <div className="overflow-x-auto rounded-xl border border-[#e2e5da]">
          <table className="w-full min-w-[1250px] text-left text-xs">
            <thead className="bg-[rgba(226,180,92,0.08)]">
              <tr>{["Location", "Claims", "Scheme", "Eligible / assessed", "Conditional", "Ineligible", "Enrolled", "Covered", "Not covered", "Coverage", "Pending", "Unknown"].map((item) => <th key={item} className="p-3 font-semibold">{item}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-[#f0f1e9]">
              {locations.flatMap((location) => location.schemes.map((scheme) => (
                <tr key={`${locationName(location)}-${scheme.scheme_id}`} className="hover:bg-[#f5f8f2] transition-colors">
                  <td className="p-3 font-medium" title={locationName(location)}>{locationName(location)}</td>
                  <td className="p-3">{location.claim_count}</td>
                  <td className="p-3">{scheme.scheme_name}<span className="block text-[#8c9d8f]">{scheme.scheme_code}</span></td>
                  <td className="p-3">{scheme.eligible_beneficiaries} / {scheme.eligibility_assessed}</td>
                  <td className="p-3">{scheme.conditional_beneficiaries}</td>
                  <td className="p-3">{scheme.ineligible_beneficiaries}</td>
                  <td className="p-3">{scheme.enrolled_beneficiaries}</td>
                  <td className="p-3">{scheme.confirmed_covered}</td>
                  <td className="p-3">{scheme.confirmed_not_covered}</td>
                  <td className="p-3">{scheme.coverage_percentage === null ? "Unavailable" : `${scheme.coverage_percentage}% (${scheme.coverage_denominator})`}</td>
                  <td className="p-3">{scheme.pending_beneficiaries}</td>
                  <td className="p-3">{scheme.unknown_coverage}</td>
                </tr>
              )))}
              {!locations.length && <tr><td colSpan={12} className="p-8 text-center text-[#8c9d8f]">{loading ? "Loading live monitoring data…" : "No FRA claims are available in this scope."}</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="flex items-center gap-2 text-[11px] text-[#8c9d8f]"><ShieldCheck size={13} className="text-[#4a9460]" /> {data.totals.claim_count.toLocaleString()} claim records in the selected scope. Eligibility and delivery are shown from their respective source records.</p>
      </motion.section>
    </div>
  );
}

function Empty({ loading }: { loading: boolean }) {
  return <div className="flex h-full items-center justify-center text-sm text-[#8c9d8f]">{loading ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-[#4a9460] border-t-transparent rounded-full animate-spin" />Loading live data…</span> : "No records match these filters."}</div>;
}
