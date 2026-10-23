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
  Fingerprint,
  Link2,
  Hash
} from "lucide-react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { api } from "@/lib/api";
import { AuditLog } from "@/lib/types";

const revealItem: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

export default function AuditVaultPage() {
  const shouldReduceMotion = useReducedMotion();
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
    <div className="mx-auto min-h-[calc(100vh-var(--header-height))] max-w-[1440px] space-y-7 px-4 py-8 sm:px-6 lg:px-8">
      <motion.div
        className="fra-page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        initial={shouldReduceMotion ? false : { opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <div className="flex items-center gap-2.5">
            <span className="icon-chip">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-5xl">Audit history</h1>
                <span className="text-xs px-2.5 py-0.5 rounded-full border border-[var(--line)] text-[var(--gold)] font-mono font-semibold">
                  SHA-256 Hash Chain
                </span>
              </div>
              <p className="text-xs text-[#68806e] mt-0.5">
                Immutable, tamper-evident audit trail linking all statutory decisions, OCR verifications, GIS boundary updates, and satellite analyses.
              </p>
            </div>
          </div>
        </div>

        <motion.button
          onClick={handleVerifyChain}
          disabled={verifying}
          className="btn-gold text-xs"
          whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${verifying ? "animate-spin" : ""}`} />
          <span>{verifying ? "Verifying..." : "Verify Hash Chain Integrity"}</span>
        </motion.button>
      </motion.div>

      {/* Verification Status Banner */}
      {verification && (
        <motion.div
          className={`p-5 rounded-2xl border flex items-center justify-between text-xs shadow-sm ${
            verification.is_valid
              ? "bg-[#f0f8f1] border-[#c5d4b8] text-[#2a4e34]"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
          initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex items-center gap-3">
            {verification.is_valid ? (
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e4ede0] text-[#3d7a4f]">
                <CheckCircle2 className="w-5 h-5" />
              </span>
            ) : (
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-600">
                <AlertTriangle className="w-5 h-5" />
              </span>
            )}
            <div>
              <strong className="block text-sm font-bold text-[#1a2f23]">
                {verification.is_valid ? "Cryptographic Chain Verified & Intact" : "Chain Broken or Tampered"}
              </strong>
              <span className="text-[#68806e]">{verification.message}</span>
            </div>
          </div>

          <div className="text-right font-mono text-[11px] hidden sm:block">
            <span className="text-[#8c9d8f] block">Total Verified Blocks:</span>
            <strong className="text-[#1a2f23] text-lg">{verification.total_blocks}</strong>
          </div>
        </motion.div>
      )}

      {/* Audit Blocks Table */}
      <motion.div
        className="glass-panel rounded-[1.4rem] overflow-hidden"
        initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
        whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.6 }}
      >
        <div className="p-4 border-b border-[var(--line)] flex items-center justify-between bg-[rgba(226,180,92,0.06)]">
          <span className="text-xs font-bold text-[#1a2f23] flex items-center gap-2">
            <span className="icon-chip !h-7 !w-7">
              <Fingerprint className="w-3.5 h-3.5" />
            </span>
            Chained Hash Blocks ({logs.length})
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#8c9d8f] font-mono flex items-center gap-1">
              <Lock size={10} /> Algorithm: SHA-256
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#faf9f4] text-[#68806e] uppercase text-[10px] tracking-wider border-b border-[#e2e5da]">
              <tr>
                <th className="py-3.5 px-4">Block ID</th>
                <th className="py-3.5 px-4">Action</th>
                <th className="py-3.5 px-4">Entity</th>
                <th className="py-3.5 px-4">Current Block Hash</th>
                <th className="py-3.5 px-4">Previous Hash</th>
                <th className="py-3.5 px-4">Timestamp (UTC)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f1e9] text-[#3d5a46]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#8c9d8f]">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-[#4a9460] border-t-transparent rounded-full animate-spin" />
                      Loading cryptographic audit vault...
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log, index) => (
                  <motion.tr
                    key={log.id}
                    className="hover:bg-[#f5f8f2] transition-colors"
                    initial={shouldReduceMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(index * 0.02, 0.5) }}
                  >
                    <td className="py-3.5 px-4 font-bold text-[#8c9d8f]">
                      <span className="inline-flex items-center gap-1">
                        <Hash size={10} />#{log.id}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-[#e4ede0] text-[#3d7a4f] font-bold text-[10px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-[#1a2f23]">
                      {log.entity} <span className="text-[#8c9d8f]">(#{log.entity_id})</span>
                    </td>
                    <td className="py-3.5 px-4 text-[11px] truncate max-w-xs" title={log.hash}>
                      <span className="text-[#9c6644]">{log.hash.slice(0, 18)}</span>
                      <span className="text-[#aab8ad]">...</span>
                      <span className="text-[#9c6644]">{log.hash.slice(-8)}</span>
                    </td>
                    <td className="py-3.5 px-4 text-[#8c9d8f] text-[11px] truncate max-w-xs" title={log.previous_hash}>
                      <span className="flex items-center gap-1">
                        <Link2 size={9} className="shrink-0" />
                        {log.previous_hash.slice(0, 18)}...{log.previous_hash.slice(-8)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-[#68806e] text-[11px]">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
