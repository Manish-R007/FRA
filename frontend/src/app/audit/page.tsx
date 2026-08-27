"use client";

import React, { useEffect, useState } from "react";
import { 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  Lock, 
  Key, 
  RefreshCw, 
  Database,
  Search,
  Fingerprint
} from "lucide-react";
import { api } from "@/lib/api";
import { AuditLog } from "@/lib/types";

export default function AuditVaultPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [verification, setVerification] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  const loadLogs = () => {
    setLoading(true);
    api.getAuditLogs()
      .then((data) => {
        setLogs(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const handleVerifyChain = async () => {
    setVerifying(true);
    try {
      const res = await api.verifyAuditChain();
      setVerification(res);
    } catch (err: any) {
      alert(err.message || "Failed to verify hash chain");
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    loadLogs();
    handleVerifyChain();
  }, []);

  return (
    <div className="min-h-[calc(100vh-var(--header-height))] bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6 page-enter">
      {/* Header */}
      <div className="border-b border-slate-800 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-blue-400" />
            <h1 className="text-2xl font-bold text-white tracking-tight">Cryptographic Audit Vault</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono font-semibold">
              SHA-256 Hash Chain
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Immutable, tamper-evident audit trail linking all statutory decisions, OCR verifications, GIS boundary updates, and satellite analyses.
          </p>
        </div>

        <button
          onClick={handleVerifyChain}
          disabled={verifying}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-950/40 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${verifying ? "animate-spin" : ""}`} />
          <span>{verifying ? "Verifying..." : "Verify Hash Chain Integrity"}</span>
        </button>
      </div>

      {/* Verification Status Banner */}
      {verification && (
        <div className={`p-5 rounded-3xl border flex items-center justify-between text-xs ${
          verification.is_valid
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
            : "bg-rose-500/10 border-rose-500/30 text-rose-300"
        }`}>
          <div className="flex items-center gap-3">
            {verification.is_valid ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0" />
            )}
            <div>
              <strong className="block text-sm font-bold">
                {verification.is_valid ? "Cryptographic Chain Verified & Intact" : "Chain Broken or Tampered"}
              </strong>
              <span>{verification.message}</span>
            </div>
          </div>

          <div className="text-right font-mono text-[11px] hidden sm:block">
            <span className="text-slate-400 block">Total Verified Blocks:</span>
            <strong className="text-white text-sm">{verification.total_blocks}</strong>
          </div>
        </div>
      )}

      {/* Audit Blocks Table */}
      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden shadow-2xl">
        <div className="p-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold text-white flex items-center gap-1.5">
            <Fingerprint className="w-4 h-4 text-emerald-400" />
            Chained Hash Blocks ({logs.length})
          </span>
          <span className="text-[10px] text-slate-500 font-mono">Algorithm: SHA-256</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-900/50 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Block ID</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Current Block Hash</th>
                <th className="py-3 px-4">Previous Hash</th>
                <th className="py-3 px-4">Timestamp (UTC)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    Loading cryptographic audit vault...
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-400">#{log.id}</td>
                    <td className="py-3 px-4 text-emerald-400 font-bold">{log.action}</td>
                    <td className="py-3 px-4 text-slate-200">
                      {log.entity} (#{log.entity_id})
                    </td>
                    <td className="py-3 px-4 text-amber-400 font-mono text-[11px] truncate max-w-xs" title={log.hash}>
                      {log.hash.slice(0, 18)}...{log.hash.slice(-8)}
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px] truncate max-w-xs" title={log.previous_hash}>
                      {log.previous_hash.slice(0, 18)}...{log.previous_hash.slice(-8)}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {new Date(log.created_at).toLocaleString()}
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
