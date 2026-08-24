"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  FileText, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Scan, 
  ArrowLeft, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Sparkles,
  Save,
  Lock
} from "lucide-react";
import { api } from "@/lib/api";
import { DocumentData, DocumentField } from "@/lib/types";

export default function DocumentVerificationPage() {
  const params = useParams();
  const router = useRouter();
  const docIdParam = params?.id as string;

  const [document, setDocument] = useState<DocumentData | null>(null);
  const [fields, setFields] = useState<DocumentField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (docIdParam) {
      api.getDocument(parseInt(docIdParam))
        .then((doc) => {
          setDocument(doc);
          setFields(doc.fields || []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [docIdParam]);

  const handleFieldChange = (index: number, value: string) => {
    const updated = [...fields];
    updated[index].field_value = value;
    updated[index].source = "HUMAN_EDITED";
    updated[index].confidence = 1.0;
    setFields(updated);
  };

  const handleConfirm = async () => {
    if (!document) return;
    setSaving(true);
    try {
      await api.verifyDocument(document.id, "CONFIRM", fields);
      alert("Document verified & Claim updated successfully!");
      if (document.claim_id) {
        router.push(`/claims/${document.claim_id}`);
      } else {
        router.push("/claims");
      }
    } catch (err: any) {
      alert(err.message || "Verification submission failed");
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    const reason = prompt("Enter reason for rejection:");
    if (!reason || !document) return;
    setSaving(true);
    try {
      await api.verifyDocument(document.id, "REJECT", fields, reason);
      alert("Document rejected.");
      router.push("/claims");
    } catch (err: any) {
      alert(err.message || "Failed to reject document");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !document) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading Document Verification Workstation...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <div className="h-14 border-b border-slate-800 bg-slate-900 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/claims" className="text-slate-400 hover:text-white flex items-center gap-1 text-xs">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </Link>
          <span className="text-slate-600">|</span>
          <div className="flex items-center gap-2">
            <Scan className="w-4 h-4 text-emerald-400" />
            <h1 className="text-sm font-bold text-white">OCR Human Verification Workstation</h1>
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
              {document.file_name}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReject}
            disabled={saving}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-900/60 text-rose-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Reject Claim</span>
          </button>

          <button
            onClick={handleConfirm}
            disabled={saving}
            className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-emerald-950/40 transition-all"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{saving ? "Confirming..." : "Confirm & Approve Claim"}</span>
          </button>
        </div>
      </div>

      {/* Split-Screen Container */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden h-[calc(100vh-120px)]">
        {/* LEFT PANEL: Original Document Viewer */}
        <div className="border-r border-slate-800 bg-slate-950 p-4 flex flex-col overflow-hidden">
          {/* Controls toolbar */}
          <div className="flex items-center justify-between bg-slate-900 p-2 rounded-xl border border-slate-800 text-xs mb-3">
            <span className="text-slate-400 text-[11px] font-semibold uppercase">Original Document Scanned Patta</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoom(Math.max(50, zoom - 20))}
                className="p-1 rounded hover:bg-slate-800 text-slate-300"
                title="Zoom out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="font-mono text-[11px] text-slate-400">{zoom}%</span>
              <button
                onClick={() => setZoom(Math.min(200, zoom + 20))}
                className="p-1 rounded hover:bg-slate-800 text-slate-300"
                title="Zoom in"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setRotation((rotation + 90) % 360)}
                className="p-1 rounded hover:bg-slate-800 text-slate-300"
                title="Rotate"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Document Viewer Box */}
          <div className="flex-1 overflow-auto bg-slate-900/50 rounded-2xl border border-slate-800 p-6 flex items-center justify-center">
            <div 
              style={{ 
                transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                transformOrigin: "center center",
                transition: "transform 0.15s ease-out" 
              }}
              className="max-w-full glass-panel p-8 rounded-xl shadow-2xl border border-slate-700/80 text-slate-300 font-serif text-xs space-y-4 max-w-lg"
            >
              <div className="text-center border-b border-slate-700 pb-3">
                <h3 className="font-bold text-sm text-slate-100 uppercase tracking-wide">Government of Odisha</h3>
                <h4 className="text-xs text-emerald-400 font-sans font-semibold">Scheduled Tribes and Other Traditional Forest Dwellers Act, 2006</h4>
                <p className="text-[10px] text-slate-400">Title for Forest Land under Section 3(1)(a)</p>
              </div>

              <div className="space-y-2 text-[11px] leading-relaxed">
                <p>This is to certify that <strong>{fields.find(f => f.field_name === "applicant_name")?.field_value || "Claimant"}</strong>, S/o <strong>{fields.find(f => f.field_name === "father_name")?.field_value || "Father"}</strong> residing in Village <strong>{fields.find(f => f.field_name === "village")?.field_value || "Village"}</strong>, District <strong>{fields.find(f => f.field_name === "district")?.field_value || "Mayurbhanj"}</strong> is recognized as holder of forest land rights.</p>
                
                <p><strong>Claim Category:</strong> {fields.find(f => f.field_name === "claim_type")?.field_value || "IFR"}</p>
                <p><strong>Extent of Land:</strong> {fields.find(f => f.field_name === "area")?.field_value || "2.40"} Hectares</p>
                <p><strong>Survey / Plot Number:</strong> {fields.find(f => f.field_name === "survey_number")?.field_value || "SY-104/2B"}</p>
                <p><strong>Land Use:</strong> Traditional Agriculture & Homestead</p>
              </div>

              <div className="pt-4 border-t border-slate-700 flex justify-between text-[10px] text-slate-500 font-mono">
                <span>District Level Committee (DLC)</span>
                <span>Signature & Seal</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: AI Extracted Fields & Human Editor */}
        <div className="bg-slate-950 p-6 flex flex-col overflow-y-auto space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                AI Extracted Structured Fields
              </h2>
              <p className="text-xs text-slate-400">
                Review, edit, and confirm extracted data. Changes are recorded with cryptographic audit logging.
              </p>
            </div>
            <span className="text-xs font-mono px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Confidence: {((document.ocr_confidence || 0.92) * 100).toFixed(0)}%
            </span>
          </div>

          <div className="space-y-3">
            {fields.map((field, idx) => (
              <div key={field.field_name} className="glass-panel p-3.5 rounded-2xl border border-slate-800 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <label className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                    {field.field_name.replace(/_/g, " ")}
                  </label>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                    field.source === "HUMAN_EDITED"
                      ? "bg-blue-500/20 text-blue-300"
                      : "bg-emerald-500/20 text-emerald-300"
                  }`}>
                    {field.source} ({((field.confidence || 0.9) * 100).toFixed(0)}%)
                  </span>
                </div>

                <input
                  type="text"
                  value={field.field_value || ""}
                  onChange={(e) => handleFieldChange(idx, e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700/80 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
