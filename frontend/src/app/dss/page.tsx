"use client";

import React, { useEffect, useState } from "react";
import { 
  Bot, 
  Sparkles, 
  Search, 
  Award, 
  MapPin, 
  Droplets, 
  Trees, 
  Wheat, 
  BookOpen, 
  CheckCircle2, 
  ArrowRight,
  TrendingUp,
  Filter,
  Compass
} from "lucide-react";
import { api } from "@/lib/api";
import { VillageConvergence, SchemeRecommendation } from "@/lib/types";
import { getPriorityBadgeColor } from "@/lib/utils";

const SAMPLE_QUERIES = [
  "Which villages have low water availability and need irrigation support?",
  "What schemes are suitable for FRA beneficiary Birsa Munda in Mayurbhanj?",
  "Which villages have high forest cover for Van Dhan Vikas Kendra clusters?",
  "Which FRA farmers need MGNREGA land levelling and soil conservation?",
];

export default function DSSCommandPage() {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [villages, setVillages] = useState<VillageConvergence[]>([]);
  const [loadingVillages, setLoadingVillages] = useState(true);

  useEffect(() => {
    api.getVillageConvergence()
      .then((data) => {
        setVillages(data);
        setLoadingVillages(false);
      })
      .catch(() => setLoadingVillages(false));
  }, []);

  const handleExecuteQuery = async (queryText: string) => {
    setQuery(queryText);
    setLoading(true);
    try {
      const res = await api.queryDSS(queryText);
      setResponse(res);
    } catch (err: any) {
      alert(err.message || "Failed to execute DSS query");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="border-b border-slate-800 pb-5 space-y-1">
        <div className="flex items-center gap-2">
          <Bot className="w-6 h-6 text-amber-400" />
          <h1 className="text-2xl font-bold text-white tracking-tight">DSS Command Center</h1>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono font-semibold">
            RAG + Deterministic Engine
          </span>
        </div>
        <p className="text-xs text-slate-400">
          AI-Powered Forest Rights Act Decision Support System combining PostGIS spatial analytics, Sentinel-2 remote sensing indices, and grounded Ministry of Tribal Affairs policy documents.
        </p>
      </div>

      {/* Query Bar & Presets */}
      <div className="glass-panel-glow p-6 rounded-3xl border border-slate-700/80 space-y-4 shadow-2xl">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Ask the Decision Support System</span>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleExecuteQuery(query)}
              placeholder="e.g., Which FRA farmers need irrigation support in Mayurbhanj district?"
              className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
          <button
            onClick={() => handleExecuteQuery(query)}
            disabled={loading || !query.trim()}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white text-xs font-bold shadow-lg shadow-amber-950/40 transition-all flex items-center gap-2 shrink-0"
          >
            <Sparkles className="w-4 h-4" />
            <span>{loading ? "Analyzing..." : "Generate DSS Assessment"}</span>
          </button>
        </div>

        {/* Sample query pills */}
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="text-[11px] text-slate-500 py-1">Quick Prompts:</span>
          {SAMPLE_QUERIES.map((sq) => (
            <button
              key={sq}
              onClick={() => handleExecuteQuery(sq)}
              className="px-3 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-[11px] transition-colors"
            >
              {sq}
            </button>
          ))}
        </div>
      </div>

      {/* Query Result Box */}
      {response && (
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Bot className="w-4 h-4 text-emerald-400" />
              Grounded Decision Support Assessment
            </h3>
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
              Context: {response.context_type}
            </span>
          </div>

          {/* Formatted Markdown Answer */}
          <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 text-xs text-slate-200 whitespace-pre-line leading-relaxed">
            {response.answer}
          </div>

          {/* RAG Citations Section */}
          {response.citations && response.citations.length > 0 && (
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                Statutory RAG Evidence & Policy Citations:
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {response.citations.map((c: any, i: number) => (
                  <div key={i} className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-400 font-medium">
                      <span className="truncate">{c.document_name}</span>
                      <span className="text-amber-400 font-mono shrink-0">Page {c.page_number}</span>
                    </div>
                    <p className="text-[11px] text-slate-300 italic line-clamp-3">&quot;{c.excerpt}&quot;</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Village Convergence Prioritization Matrix */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-400" />
              Village-Level Convergence Prioritization Matrix
            </h2>
            <p className="text-xs text-slate-400">
              Aggregated satellite remote-sensing indices (canopy, crops, water deficit) prioritizing district-level welfare intervention.
            </p>
          </div>
        </div>

        <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden shadow-2xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Village / District</th>
                <th className="py-3 px-4">Titles (Approved/Total)</th>
                <th className="py-3 px-4">Extent (Ha)</th>
                <th className="py-3 px-4">Forest Canopy %</th>
                <th className="py-3 px-4">Crop Cover %</th>
                <th className="py-3 px-4">Water Cover %</th>
                <th className="py-3 px-4">Priority Level</th>
                <th className="py-3 px-4">Recommended Schemes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loadingVillages ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    Loading village convergence metrics...
                  </td>
                </tr>
              ) : (
                villages.map((v) => (
                  <tr key={v.village} className="hover:bg-slate-900/50">
                    <td className="py-3.5 px-4">
                      <strong className="block text-slate-200 text-xs">{v.village}</strong>
                      <span className="text-[11px] text-slate-500">{v.district}, {v.state}</span>
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      <span className="text-emerald-400 font-bold">{v.approved_claims}</span> / {v.total_claims}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300">{v.total_fra_area_hectares} Ha</td>
                    <td className="py-3.5 px-4 font-mono text-emerald-400">{v.mean_forest_pct}%</td>
                    <td className="py-3.5 px-4 font-mono text-lime-400">{v.mean_crop_pct}%</td>
                    <td className="py-3.5 px-4 font-mono text-blue-400">{v.mean_water_pct}%</td>
                    <td className="py-3.5 px-4">
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-bold ${getPriorityBadgeColor(v.priority_level)}`}>
                        {v.priority_level}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1">
                        {v.recommended_schemes.map((s) => (
                          <span key={s} className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-300">
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
