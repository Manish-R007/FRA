"use client";

import React, { useEffect, useState } from "react";
import { 
  Layers, 
  Award, 
  FileText, 
  CheckCircle2, 
  Sparkles, 
  Plus, 
  ChevronRight,
  ShieldCheck,
  Building
} from "lucide-react";
import { api } from "@/lib/api";

export default function SchemesPage() {
  const [schemes, setSchemes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getSchemes()
      .then((data) => {
        setSchemes(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="border-b border-slate-800 pb-5 space-y-1">
        <div className="flex items-center gap-2">
          <Layers className="w-6 h-6 text-emerald-400" />
          <h1 className="text-2xl font-bold text-white tracking-tight">Government Welfare Schemes Catalog</h1>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-semibold">
            {schemes.length} Schemes Active
          </span>
        </div>
        <p className="text-xs text-slate-400">
          Statutory convergence frameworks configured for automated DSS evaluation for Forest Rights Act title holders.
        </p>
      </div>

      {/* Schemes Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {loading ? (
          <div className="col-span-2 py-12 text-center text-slate-500">
            <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            Loading schemes database...
          </div>
        ) : (
          schemes.map((scheme) => (
            <div key={scheme.id} className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 hover:border-slate-700 transition-all">
              <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                <div>
                  <span className="text-[10px] text-emerald-400 font-mono uppercase font-bold tracking-wider block">
                    {scheme.department}
                  </span>
                  <h3 className="text-base font-bold text-white">{scheme.name}</h3>
                </div>
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-slate-300">
                  {scheme.code}
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {scheme.description}
              </p>

              {/* Benefits Banner */}
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 space-y-1">
                <strong className="block text-emerald-200 text-[10px] uppercase font-bold tracking-wider">
                  Entitlement Benefits:
                </strong>
                <p className="leading-relaxed">{scheme.benefits}</p>
              </div>

              {/* Required Documents */}
              <div className="space-y-1.5 text-xs">
                <span className="text-[10px] font-semibold text-slate-400 uppercase block">Required Proof Documents:</span>
                <div className="flex flex-wrap gap-1.5">
                  {scheme.documents_required?.map((doc: string) => (
                    <span key={doc} className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-[11px] flex items-center gap-1">
                      <FileText className="w-3 h-3 text-slate-400" />
                      {doc}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
