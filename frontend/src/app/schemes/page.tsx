"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Layers, 
  Award, 
  FileText, 
  CheckCircle2, 
  Sparkles, 
  Plus, 
  ChevronRight,
  ShieldCheck,
  Building,
  Bot,
  MessageSquare,
  BarChart3
} from "lucide-react";
import { api } from "@/lib/api";

export default function SchemesPage() {
  const [schemes, setSchemes] = useState<any[]>([]);
  const [coverage, setCoverage] = useState<any[]>([]);
  const [district, setDistrict] = useState("");
  const [coverageError, setCoverageError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getSchemes()
      .then((data) => {
        setSchemes(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    let mounted = true;
    const refresh = () => api.getCoverageMonitoring({ level: "state", district })
      .then((data) => { if (mounted) { setCoverage(data.totals?.schemes || []); setCoverageError(""); } })
      .catch((error) => { if (mounted) setCoverageError(error.message); });
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => { mounted = false; window.clearInterval(timer); };
  }, [district]);

  return (
    <div className="mx-auto min-h-[calc(100vh-var(--header-height))] max-w-[1440px] space-y-7 px-4 py-7 sm:px-6 lg:px-8 page-enter">
      {/* Header */}
      <div className="space-y-2 border-b border-[#e3e4d9] pb-5">
        <div className="flex items-center gap-2">
          <Layers className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          <h1 className="font-[Manrope] text-2xl font-bold tracking-tight text-[#203b2b]">Government schemes</h1>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-mono font-semibold">
            {schemes.length} Schemes Active
          </span>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-stone-600">
          Statutory convergence frameworks configured for automated DSS evaluation for Forest Rights Act title holders.
        </p>
      </div>

      <section className="glass-panel space-y-4 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Recorded scheme coverage</h2>
            <p className="text-xs text-slate-500 mt-1">Eligibility uses explicit recorded decisions when present, otherwise DSS assessments. Delivery uses recorded coverage; unknown outcomes are excluded from its percentage.</p>
          </div>
          <div className="flex items-end gap-3"><label className="text-xs text-slate-600 dark:text-slate-300">District filter
            <input value={district} onChange={(event) => setDistrict(event.target.value)} placeholder="All districts" className="ml-2 px-3 py-2 rounded-lg border bg-white max-w-48" />
          </label><Link href="/monitoring" className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"><BarChart3 size={14} /> Open monitoring</Link></div>
        </div>
        {coverageError ? <p role="status" className="text-sm text-amber-700">{coverageError}</p> : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs min-w-[800px]">
              <thead className="bg-emerald-50 text-emerald-950"><tr>{["Scheme", "Eligible / assessed", "Enrolled", "Covered", "Pending", "Not covered", "Coverage", "Unknown"].map((h) => <th key={h} className="p-3 font-semibold">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">{coverage.map((row) => <tr key={row.scheme_id}>
                <td className="p-3 font-medium">{row.scheme_name}<span className="block text-slate-500">{row.scheme_code}</span></td>
                <td className="p-3">{row.eligible_beneficiaries} / {row.eligibility_assessed} assessed</td>
                <td className="p-3">{row.enrolled_beneficiaries}</td><td className="p-3">{row.confirmed_covered}</td>
                <td className="p-3">{row.pending_beneficiaries}</td><td className="p-3">{row.confirmed_not_covered}</td>
                <td className="p-3 font-semibold">{row.coverage_percentage === null ? "Unavailable" : `${row.coverage_percentage}%`}</td>
                <td className="p-3">{row.unknown_coverage}</td>
              </tr>)}</tbody>
            </table>
          </div>
        )}
      </section>

      {/* Schemes Cards Grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {loading ? (
          <div className="col-span-2 py-12 text-center text-slate-500">
            <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            Loading schemes database...
          </div>
        ) : (
          schemes.map((scheme) => (
            <div key={scheme.id} className="glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4 hover:border-emerald-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between shadow-sm">
              <div className="space-y-4">
                <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono uppercase font-bold tracking-wider block">
                      {scheme.department}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">{scheme.name}</h3>
                  </div>
                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 shadow-sm">
                    {scheme.code}
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {scheme.description}
                </p>

                {/* Benefits Banner */}
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
                  <strong className="block text-emerald-900 dark:text-emerald-200 text-[10px] uppercase font-bold tracking-wider">
                    Entitlement Benefits:
                  </strong>
                  <p className="leading-relaxed">{scheme.benefits}</p>
                </div>

                {/* Required Documents */}
                <div className="space-y-1.5 text-xs">
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase block">Required Proof Documents:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {scheme.documents_required?.map((doc: string) => (
                      <span key={doc} className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-[11px] flex items-center gap-1 shadow-sm">
                        <FileText className="w-3 h-3 text-slate-400" />
                        {doc}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Ask Chatbot Action */}
              <div className="pt-2">
                <Link
                  href={`/dss?query=${encodeURIComponent(`Explain the statutory eligibility guidelines, satellite verification criteria, and required documents for ${scheme.name} (${scheme.code}) under the Forest Rights Act convergence framework.`)}`}
                  className="w-full py-2.5 px-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100 dark:bg-slate-900 dark:hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-200 border border-emerald-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-500/40 text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm"
                >
                  <Bot className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Inquire with DSS AI Chatbot</span>
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
