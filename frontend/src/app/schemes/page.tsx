"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Layers, FileText, Building, Bot, BarChart3, ArrowRight, Sparkles, Award, ShieldCheck, CheckCircle2 } from "lucide-react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { api } from "@/lib/api";

const revealItem: Variants = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};
const revealGroup: Variants = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };

const SCHEME_ICONS: Record<string, React.ElementType> = {
  "PM-KISAN": Sparkles,
  "PMKSY": Award,
  "PMAY-G": Building,
  "VDVY": Layers,
  "MGNREGA": ShieldCheck,
  "JJM": CheckCircle2,
};

export default function SchemesPage() {
  const shouldReduceMotion = useReducedMotion();
  const [schemes, setSchemes] = useState<any[]>([]);
  const [coverage, setCoverage] = useState<any[]>([]);
  const [district, setDistrict] = useState("");
  const [coverageError, setCoverageError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getSchemes().then((data) => { setSchemes(data); setLoading(false); }).catch(() => setLoading(false));
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
    <div className="mx-auto min-h-[calc(100vh-var(--header-height))] max-w-[1440px] space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <motion.div className="fra-page-header" initial={shouldReduceMotion ? false : { opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <p className="kicker">Welfare convergence</p>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <h1 className="font-display text-5xl">Government schemes</h1>
          <span className="rounded-full border border-[var(--line)] bg-[rgba(226,180,92,0.1)] px-3 py-1 font-mono text-xs text-[var(--gold)]">{schemes.length} Active</span>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-[var(--ink-muted)]">Statutory convergence frameworks for automated DSS evaluation for Forest Rights Act title holders.</p>
      </motion.div>

      <motion.section className="glass-panel space-y-4 p-5 sm:p-6" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <p className="kicker">Live monitoring</p>
            <h2 className="mt-1 font-display text-3xl">Recorded scheme coverage</h2>
          </div>
          <div className="flex items-end gap-3">
            <label className="text-xs text-[var(--ink-muted)]">District filter
              <input value={district} onChange={(event) => setDistrict(event.target.value)} placeholder="All districts" className="ml-2 px-3 py-2 max-w-48" />
            </label>
            <Link href="/monitoring" className="btn-ghost !py-2 !px-3.5 text-xs"><BarChart3 size={14} /> Open monitoring</Link>
          </div>
        </div>
        {coverageError ? <p role="status" className="text-sm text-[var(--gold)]">{coverageError}</p> : (
          <div className="overflow-x-auto rounded-2xl border border-[var(--line)]">
            <table className="w-full text-left text-xs min-w-[800px]">
              <thead className="bg-[rgba(226,180,92,0.08)]">
                <tr>{["Scheme", "Eligible / assessed", "Enrolled", "Covered", "Pending", "Not covered", "Coverage", "Unknown"].map((h) => <th key={h} className="p-3 font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-[var(--line-soft)]">
                {coverage.map((row) => (
                  <tr key={row.scheme_id}>
                    <td className="p-3 font-medium">{row.scheme_name}<span className="block text-[var(--ink-muted)]">{row.scheme_code}</span></td>
                    <td className="p-3">{row.eligible_beneficiaries} / {row.eligibility_assessed} assessed</td>
                    <td className="p-3">{row.enrolled_beneficiaries}</td>
                    <td className="p-3">{row.confirmed_covered}</td>
                    <td className="p-3">{row.pending_beneficiaries}</td>
                    <td className="p-3">{row.confirmed_not_covered}</td>
                    <td className="p-3 font-semibold text-[var(--gold)]">{row.coverage_percentage === null ? "Unavailable" : `${row.coverage_percentage}%`}</td>
                    <td className="p-3">{row.unknown_coverage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.section>

      <motion.div className="grid grid-cols-1 gap-5 md:grid-cols-2" initial={shouldReduceMotion ? false : "hidden"} whileInView={shouldReduceMotion ? undefined : "visible"} viewport={{ once: true }} variants={revealGroup}>
        {loading ? (
          <div className="col-span-2 py-12 text-center text-[var(--ink-muted)]">Loading schemes database...</div>
        ) : schemes.map((scheme) => {
          const SchemeIcon = SCHEME_ICONS[scheme.code] || Layers;
          return (
            <motion.div key={scheme.id} variants={revealItem} whileHover={shouldReduceMotion ? undefined : { y: -6 }} className="glass-panel p-6 space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-start justify-between border-b border-[var(--line)] pb-3">
                  <div className="flex items-start gap-3">
                    <span className="icon-chip"><SchemeIcon className="w-5 h-5" /></span>
                    <div>
                      <span className="kicker block">{scheme.department}</span>
                      <h3 className="font-display text-2xl">{scheme.name}</h3>
                    </div>
                  </div>
                  <span className="font-mono text-xs px-2.5 py-1 rounded-full border border-[var(--line)] text-[var(--gold)]">{scheme.code}</span>
                </div>
                <p className="text-xs text-[var(--ink-soft)] leading-relaxed">{scheme.description}</p>
                <div className="p-3.5 rounded-2xl border border-[var(--line)] bg-[rgba(226,180,92,0.08)] text-xs space-y-1">
                  <strong className="block kicker">Entitlement benefits</strong>
                  <p className="leading-relaxed">{scheme.benefits}</p>
                </div>
                <div className="space-y-1.5 text-xs">
                  <span className="kicker">Required proof documents</span>
                  <div className="flex flex-wrap gap-1.5">
                    {scheme.documents_required?.map((doc: string) => (
                      <span key={doc} className="px-2.5 py-1 rounded-full border border-[var(--line)] text-[11px] flex items-center gap-1">
                        <FileText className="w-3 h-3 text-[var(--gold)]" />{doc}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <Link
                href={`/dss?query=${encodeURIComponent(`Explain the statutory eligibility guidelines, satellite verification criteria, and required documents for ${scheme.name} (${scheme.code}) under the Forest Rights Act convergence framework.`)}`}
                className="btn-ghost w-full text-xs"
              >
                <Bot className="w-4 h-4" /> Inquire with DSS <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
