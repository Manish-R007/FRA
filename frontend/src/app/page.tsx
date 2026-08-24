"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Trees, 
  MapPin, 
  FileText, 
  Bot, 
  ShieldCheck, 
  ArrowRight, 
  Activity, 
  Sparkles, 
  AlertTriangle, 
  TrendingUp, 
  Layers, 
  Droplets, 
  Wheat, 
  Home, 
  Award,
  CheckCircle2,
  Clock,
  Scan,
  Compass
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from "recharts";
import WebGISMap from "@/components/map/WebGISMap";
import { api } from "@/lib/api";
import { AtlasStatistics } from "@/lib/types";

const LAND_USE_COLORS = ["#15803d", "#84cc16", "#0284c7", "#dc2626", "#d97706"];

export default function HomePage() {
  const [stats, setStats] = useState<AtlasStatistics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAtlasStats()
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const landUseData = stats ? [
    { name: "Forest Canopy", value: stats.land_cover_totals_ha.forest },
    { name: "Cultivated Crops", value: stats.land_cover_totals_ha.crop },
    { name: "Water Bodies", value: stats.land_cover_totals_ha.water },
    { name: "Homesteads/Built-up", value: stats.land_cover_totals_ha.building },
    { name: "Bare Land", value: stats.land_cover_totals_ha.bare_land },
  ] : [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      {/* Hero Section */}
      <section className="relative border-b border-slate-800 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 py-12 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-amber-600/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                Ministry of Tribal Affairs • SIH 2025 National Platform
              </div>
              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
                AI-Powered <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300 bg-clip-text text-transparent">FRA Atlas</span> & WebGIS Decision Support System
              </h1>
              <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
                Integrated monitoring, satellite remote-sensing segmentation, and rule-based welfare scheme convergence for Forest Rights Act (FRA 2006) implementation across tribal belts.
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap gap-3 items-center">
              <Link
                href="/atlas"
                className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center gap-2 shadow-lg shadow-emerald-950/50 transition-all group"
              >
                <Compass className="w-4 h-4" />
                <span>Launch WebGIS Atlas</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/dss"
                className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-semibold flex items-center gap-2 transition-all"
              >
                <Bot className="w-4 h-4 text-amber-400" />
                <span>DSS Command Center</span>
              </Link>
            </div>
          </div>

          {/* National Live Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-4">
            <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-blue-400" /> Total Claims
              </span>
              <strong className="text-2xl font-bold text-white block">
                {stats?.summary.total_claims || 0}
              </strong>
              <span className="text-[11px] text-slate-500">Across 4 States</span>
            </div>

            <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Approved Titles
              </span>
              <strong className="text-2xl font-bold text-emerald-400 block">
                {stats?.summary.approved_claims || 0}
              </strong>
              <span className="text-[11px] text-emerald-500/80">Titles Distributed</span>
            </div>

            <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                <Trees className="w-3.5 h-3.5 text-teal-400" /> FRA Land Extent
              </span>
              <strong className="text-2xl font-bold text-white block">
                {stats?.summary.total_claimed_area_hectares || 0} <span className="text-sm font-normal text-slate-400">Ha</span>
              </strong>
              <span className="text-[11px] text-slate-500">IFR & CFR Total</span>
            </div>

            <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                <Scan className="w-3.5 h-3.5 text-amber-400" /> AI Assets Detected
              </span>
              <strong className="text-2xl font-bold text-amber-400 block">
                {stats?.assets_detected.total || 0}
              </strong>
              <span className="text-[11px] text-slate-500">Ponds, Farms, Forests</span>
            </div>

            <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> Area Discrepancies
              </span>
              <strong className="text-2xl font-bold text-rose-400 block">
                {stats?.summary.flagged_discrepancies || 0}
              </strong>
              <span className="text-[11px] text-rose-400/80">Flagged For Review</span>
            </div>

            <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-purple-400" /> Scheme Priorities
              </span>
              <strong className="text-2xl font-bold text-purple-400 block">
                {stats?.summary.high_priority_interventions || 0}
              </strong>
              <span className="text-[11px] text-slate-500">High Convergence</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Interactive WebGIS Live Preview */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-500" />
              <h2 className="text-lg font-bold text-white">Live WebGIS Parcel Explorer</h2>
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                Sentinel-2 STAC
              </span>
            </div>
            <Link
              href="/atlas"
              className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
            >
              Open Fullscreen Atlas →
            </Link>
          </div>

          <div className="rounded-3xl border border-slate-800 overflow-hidden shadow-2xl h-[480px]">
            <WebGISMap height="h-[480px]" />
          </div>
        </div>

        {/* Analytics Grid: Recharts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Land-Cover Distribution Pie Chart */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                AI Land-Cover Distribution
              </h3>
              <span className="text-[11px] text-slate-400">Total Hectares</span>
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={landUseData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {landUseData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={LAND_USE_COLORS[index % LAND_USE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "12px", fontSize: "12px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
              {landUseData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: LAND_USE_COLORS[i] }}></span>
                  <span className="truncate">{d.name}: <strong>{d.value} Ha</strong></span>
                </div>
              ))}
            </div>
          </div>

          {/* Claims by State Bar Chart */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                State-Wise FRA Titles & Progress
              </h3>
              <span className="text-[11px] text-slate-400">Claims Logged</span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.charts.by_state || []}>
                  <XAxis dataKey="state" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "12px", fontSize: "12px" }}
                  />
                  <Bar dataKey="count" fill="#10b981" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
              <span>Odisha: <strong>3 Claims</strong> (Mayurbhanj)</span>
              <span>Madhya Pradesh: <strong>1 Claim</strong> (Dindori)</span>
              <span>Maharashtra: <strong>1 Claim</strong> (Gadchiroli)</span>
              <span>Jharkhand: <strong>1 Claim</strong> (Gumla)</span>
            </div>
          </div>
        </div>

        {/* End-to-End Workflow Pipeline Stepper */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                Complete End-to-End AI & GIS Lifecycle
              </h3>
              <p className="text-xs text-slate-400">
                Transparent statutory verification from physical Patta scanning to satellite convergence.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 text-center text-xs">
            {[
              { step: "1", title: "Document Upload", desc: "PDF/PNG Patta Ingestion", icon: FileText, color: "text-blue-400" },
              { step: "2", title: "Tesseract OCR", desc: "Text & Token Confidence", icon: Scan, color: "text-teal-400" },
              { step: "3", title: "LLM Extraction", desc: "Anti-Hallucination JSON", icon: Bot, color: "text-amber-400" },
              { step: "4", title: "Human Review", desc: "Split-Screen Verification", icon: CheckCircle2, color: "text-emerald-400" },
              { step: "5", title: "Actual Polygon", desc: "WGS84 Geodesic Math", icon: MapPin, color: "text-purple-400" },
              { step: "6", title: "Sentinel-2 S2", desc: "NDVI, NDWI, NDBI Bands", icon: Activity, color: "text-blue-400" },
              { step: "7", title: "Segmentation", desc: "8-Class Land Cover 100%", icon: Trees, color: "text-emerald-400" },
              { step: "8", title: "DSS & RAG", desc: "Grounded Scheme Sanctions", icon: Award, color: "text-amber-400" },
            ].map((st) => {
              const Icon = st.icon;
              return (
                <div key={st.step} className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800/80 space-y-1.5 hover:border-slate-700 transition-colors">
                  <div className="w-7 h-7 mx-auto rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-300 text-xs">
                    {st.step}
                  </div>
                  <Icon className={`w-5 h-5 mx-auto ${st.color}`} />
                  <strong className="block text-slate-200 text-xs font-semibold leading-tight">{st.title}</strong>
                  <span className="block text-[10px] text-slate-500 leading-tight">{st.desc}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
