"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, RefreshCw, ShieldCheck } from "lucide-react";
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

export default function MonitoringPage() {
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

  return (
    <div className="mx-auto min-h-[calc(100vh-var(--header-height))] max-w-[1500px] space-y-6 px-4 py-7 sm:px-6 lg:px-8 page-enter">
      <header className="flex flex-col justify-between gap-4 border-b border-[#e3e4d9] pb-5 md:flex-row md:items-end">
        <div>
          <div className="flex items-center gap-2 text-emerald-700"><Activity size={19} /><span className="text-xs font-semibold uppercase tracking-wider">Live administration view</span></div>
          <h1 className="mt-2 font-[Manrope] text-2xl font-bold tracking-tight text-[#203b2b]">Scheme and FRA monitoring</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-stone-600">Explore DSS eligibility assessments and recorded scheme delivery by state, district, and village. Data refreshes automatically every 30 seconds.</p>
        </div>
        <button type="button" onClick={() => void refresh()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"><RefreshCw size={15} /> Refresh now</button>
      </header>

      <section className="glass-panel grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-medium text-slate-600">Geographic view<select value={level} onChange={(event) => setLevel(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"><option value="state">State</option><option value="district">District</option><option value="village">Village</option></select></label>
        <label className="text-xs font-medium text-slate-600">State<select value={state} onChange={(event) => { setState(event.target.value); setDistrict(""); setBlock(""); }} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"><option value="">All available states</option>{data.options.states.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="text-xs font-medium text-slate-600">District<select value={district} onChange={(event) => { setDistrict(event.target.value); setBlock(""); }} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"><option value="">All available districts</option>{data.options.districts.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="text-xs font-medium text-slate-600">Block<select value={block} onChange={(event) => setBlock(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"><option value="">All available blocks</option>{data.options.blocks.map((item) => <option key={item}>{item}</option>)}</select></label>
      </section>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["FRA claim records", data.totals.claim_count],
          ["Approved / verified", data.totals.approved_claims],
          ["Eligible scheme assessments", data.totals.eligible_assessments],
          ["Active schemes", data.totals.schemes.length],
        ].map(([label, value]) => <article key={label} className="glass-panel p-5"><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold tracking-tight text-emerald-900">{loading ? "…" : Number(value).toLocaleString()}</p></article>)}
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="glass-panel min-w-0 p-5"><h2 className="font-semibold text-slate-900">Eligible assessments and recorded coverage by scheme</h2><p className="mb-4 mt-1 text-xs text-slate-500">Eligibility uses DSS assessments; coverage uses explicit delivery records.</p>
          <div className="h-[320px]">{schemeChart.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={schemeChart} margin={{ top: 8, right: 12, left: -16, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Legend /><Bar dataKey="Eligible" fill="#13865b" radius={[4, 4, 0, 0]} /><Bar dataKey="Covered" fill="#72a9d1" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : <Empty loading={loading} />}</div>
        </article>
        <article className="glass-panel min-w-0 p-5"><h2 className="font-semibold text-slate-900">Claims and eligible assessments by {level}</h2><p className="mb-4 mt-1 text-xs text-slate-500">Showing up to 12 locations with the most claim records.</p>
          <div className="h-[320px]">{locationChart.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={locationChart} margin={{ top: 8, right: 12, left: -16, bottom: 44 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" angle={-28} textAnchor="end" interval={0} height={66} tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Legend /><Bar dataKey="Claims" fill="#94a3b8" radius={[4, 4, 0, 0]} /><Bar dataKey="Approved" fill="#4b8e6c" radius={[4, 4, 0, 0]} /><Bar dataKey="Eligible" fill="#e3a544" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : <Empty loading={loading} />}</div>
        </article>
      </section>

      <section className="glass-panel space-y-4 p-5">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><h2 className="text-lg font-bold text-slate-900">{level[0].toUpperCase() + level.slice(1)}-wise scheme detail</h2><p className="mt-1 text-xs text-slate-500">Eligibility uses explicit recorded decisions when present, otherwise DSS recommendations. Unknown delivery is not counted as uncovered.</p></div><p className="text-xs text-slate-500">{data.refreshed_at ? `Updated ${new Date(data.refreshed_at).toLocaleTimeString()}` : "Waiting for data"}</p></div>
        <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[1250px] text-left text-xs"><thead className="bg-emerald-50 text-emerald-950"><tr>{["Location", "Claims", "Scheme", "Eligible / assessed", "Conditional", "Ineligible", "Enrolled", "Covered", "Not covered", "Coverage", "Pending", "Unknown"].map((item) => <th key={item} className="p-3 font-semibold">{item}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{locations.flatMap((location) => location.schemes.map((scheme) => <tr key={`${locationName(location)}-${scheme.scheme_id}`}><td className="p-3 font-medium" title={locationName(location)}>{locationName(location)}</td><td className="p-3">{location.claim_count}</td><td className="p-3">{scheme.scheme_name}<span className="block text-slate-500">{scheme.scheme_code}</span></td><td className="p-3">{scheme.eligible_beneficiaries} / {scheme.eligibility_assessed}</td><td className="p-3">{scheme.conditional_beneficiaries}</td><td className="p-3">{scheme.ineligible_beneficiaries}</td><td className="p-3">{scheme.enrolled_beneficiaries}</td><td className="p-3">{scheme.confirmed_covered}</td><td className="p-3">{scheme.confirmed_not_covered}</td><td className="p-3">{scheme.coverage_percentage === null ? "Unavailable" : `${scheme.coverage_percentage}% (${scheme.coverage_denominator})`}</td><td className="p-3">{scheme.pending_beneficiaries}</td><td className="p-3">{scheme.unknown_coverage}</td></tr>))}{!locations.length && <tr><td colSpan={12} className="p-8 text-center text-slate-500">{loading ? "Loading live monitoring data…" : "No FRA claims are available in this scope."}</td></tr>}</tbody></table></div>
        <p className="flex items-center gap-2 text-[11px] text-slate-500"><ShieldCheck size={13} /> {data.totals.claim_count.toLocaleString()} claim records in the selected scope. Eligibility and delivery are shown from their respective source records.</p>
      </section>
    </div>
  );
}

function Empty({ loading }: { loading: boolean }) {
  return <div className="flex h-full items-center justify-center text-sm text-slate-500">{loading ? "Loading live data…" : "No records match these filters."}</div>;
}
