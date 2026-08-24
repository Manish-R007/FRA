"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  MapPin, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink, 
  Clock, 
  Sparkles,
  ArrowUpDown,
  UploadCloud,
  ChevronRight
} from "lucide-react";
import { api } from "@/lib/api";
import { FRAClaim, ClaimType, ClaimStatus } from "@/lib/types";
import { getStatusBadgeColor, formatArea } from "@/lib/utils";

export default function ClaimsRegistryPage() {
  const [claims, setClaims] = useState<FRAClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New claim form state
  const [formData, setFormData] = useState({
    claim_id: "",
    claim_type: "IFR",
    applicant_name: "",
    father_or_husband_name: "",
    age: "",
    gender: "Male",
    village: "Baripada",
    block: "Baripada Sadar",
    district: "Mayurbhanj",
    state: "Odisha",
    survey_number: "",
    area_claimed: "2.5",
    land_use: "Traditional Agriculture & Homestead",
  });
  const [formSubmitting, setFormSubmitting] = useState(false);

  const fetchClaims = () => {
    setLoading(true);
    api.getClaims({
      search: search || undefined,
      claim_type: selectedType || undefined,
      status: selectedStatus || undefined,
    })
      .then((data) => {
        setClaims(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchClaims();
  }, [selectedType, selectedStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchClaims();
  };

  const handleCreateClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    try {
      await api.createClaim({
        claim_id: formData.claim_id,
        claim_type: formData.claim_type as ClaimType,
        applicant_name: formData.applicant_name,
        father_or_husband_name: formData.father_or_husband_name || undefined,
        age: formData.age ? parseInt(formData.age) : undefined,
        gender: formData.gender,
        village: formData.village,
        block: formData.block,
        district: formData.district,
        state: formData.state,
        survey_number: formData.survey_number || undefined,
        area_claimed: parseFloat(formData.area_claimed) || 1.5,
        land_use: formData.land_use,
        status: "UPLOADED",
      });
      setShowCreateModal(false);
      fetchClaims();
    } catch (err: any) {
      alert(err.message || "Failed to create claim");
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">FRA Claims Registry</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-semibold">
              {claims.length} Records
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Individual (IFR), Community (CR), and Community Forest Resource (CFR) titles under Forest Rights Act 2006.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setFormData({
                ...formData,
                claim_id: `FRA-OD-MAY-${Math.floor(100 + Math.random() * 900)}`,
              });
              setShowCreateModal(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-emerald-950/40 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New FRA Claim</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <form onSubmit={handleSearchSubmit} className="md:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Claim ID, Applicant Name, or Survey Number..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
          />
        </form>

        <div>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/60"
          >
            <option value="">All Rights Types (IFR / CR / CFR)</option>
            <option value="IFR">IFR - Individual Forest Rights</option>
            <option value="CR">CR - Community Rights</option>
            <option value="CFR">CFR - Community Forest Resource</option>
          </select>
        </div>

        <div>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/60"
          >
            <option value="">All Workflow Statuses</option>
            <option value="APPROVED">APPROVED (Patta Granted)</option>
            <option value="GIS_VALIDATED">GIS_VALIDATED</option>
            <option value="SATELLITE_ANALYZE">SATELLITE_ANALYZE</option>
            <option value="PENDING_VERIFICATION">PENDING_VERIFICATION</option>
            <option value="UPLOADED">UPLOADED</option>
            <option value="REJECTED">REJECTED</option>
          </select>
        </div>
      </div>

      {/* Claims Data Table */}
      <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
              <tr>
                <th className="py-3.5 px-4">Claim ID</th>
                <th className="py-3.5 px-4">Applicant & Relation</th>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4">Location (Village/District)</th>
                <th className="py-3.5 px-4">Claimed Area</th>
                <th className="py-3.5 px-4">Workflow Status</th>
                <th className="py-3.5 px-4">AI / GIS Layers</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    Loading registered claims...
                  </td>
                </tr>
              ) : claims.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No FRA claims match the current filters.
                  </td>
                </tr>
              ) : (
                claims.map((claim) => (
                  <tr key={claim.id} className="hover:bg-slate-900/50 transition-colors group">
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                      <Link href={`/claims/${claim.id}`} className="hover:underline flex items-center gap-1">
                        <span>{claim.claim_id}</span>
                      </Link>
                    </td>

                    <td className="py-3.5 px-4">
                      <strong className="block text-slate-200">{claim.applicant_name}</strong>
                      <span className="text-[11px] text-slate-500">
                        {claim.father_or_husband_name ? `S/o ${claim.father_or_husband_name}` : "Gram Sabha Committee"}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-semibold font-mono ${
                        claim.claim_type === "IFR" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" :
                        claim.claim_type === "CR" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" :
                        "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                      }`}>
                        {claim.claim_type}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-300">
                      <span>{claim.village}</span>
                      <span className="text-[11px] text-slate-500 block">{claim.district}, {claim.state}</span>
                    </td>

                    <td className="py-3.5 px-4 font-medium text-slate-200">
                      {formatArea(claim.area_claimed)}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-semibold ${getStatusBadgeColor(claim.status)}`}>
                        {claim.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 text-[10px]">
                        <span className={`px-1.5 py-0.5 rounded ${claim.has_geometry ? "bg-blue-500/20 text-blue-300" : "bg-slate-800 text-slate-500"}`}>
                          GIS Polygon
                        </span>
                        <span className={`px-1.5 py-0.5 rounded ${claim.has_analysis ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-800 text-slate-500"}`}>
                          Sentinel-2
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/claims/${claim.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white text-xs font-medium transition-all"
                      >
                        <span>Workspace</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Claim Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel-glow p-6 rounded-3xl max-w-2xl w-full border border-slate-700 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base text-white">Create New FRA Patta Claim</h3>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateClaim} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Claim ID *</label>
                  <input
                    type="text"
                    required
                    value={formData.claim_id}
                    onChange={(e) => setFormData({ ...formData, claim_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Claim Type *</label>
                  <select
                    value={formData.claim_type}
                    onChange={(e) => setFormData({ ...formData, claim_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white"
                  >
                    <option value="IFR">IFR (Individual Forest Rights)</option>
                    <option value="CR">CR (Community Rights)</option>
                    <option value="CFR">CFR (Community Forest Resource)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Applicant Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.applicant_name}
                    onChange={(e) => setFormData({ ...formData, applicant_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Father / Husband Name</label>
                  <input
                    type="text"
                    value={formData.father_or_husband_name}
                    onChange={(e) => setFormData({ ...formData, father_or_husband_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Village *</label>
                  <input
                    type="text"
                    required
                    value={formData.village}
                    onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">District *</label>
                  <input
                    type="text"
                    required
                    value={formData.district}
                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Claimed Area (Hectares) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.area_claimed}
                    onChange={(e) => setFormData({ ...formData, area_claimed: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Survey / Khasra No.</label>
                  <input
                    type="text"
                    value={formData.survey_number}
                    onChange={(e) => setFormData({ ...formData, survey_number: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1.5"
                >
                  {formSubmitting ? "Creating Claim..." : "Create Claim"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
