"use client";

import React, { useEffect, useState, useRef } from "react";
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
  ChevronRight,
  Camera,
  RotateCcw,
  Bot,
  Layers,
  Award,
  ShieldCheck,
  Check,
  X,
  Eye,
  AlertCircle,
  FileCheck2,
  Scan,
  Trash2,
  Upload
} from "lucide-react";
import { api } from "@/lib/api";
import { FRAClaim, ClaimType, ClaimStatus, DocumentData, SchemeRecommendation } from "@/lib/types";
import { getStatusBadgeColor, formatArea } from "@/lib/utils";

type IntakeMode = "upload" | "camera" | "manual";

export default function ClaimsRegistryPage() {
  const [claims, setClaims] = useState<FRAClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<any>(null);
  const [purging, setPurging] = useState(false);

  // Modal mode & OCR processing state
  const [intakeMode, setIntakeMode] = useState<IntakeMode>("upload");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [uploadedDoc, setUploadedDoc] = useState<DocumentData | null>(null);
  const [fieldConfidences, setFieldConfidences] = useState<Record<string, number>>({});
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Camera state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    claim_id: "",
    claim_type: "IFR",
    applicant_name: "",
    father_or_husband_name: "",
    age: "",
    gender: "Male",
    village: "",
    block: "",
    district: "",
    state: "",
    survey_number: "",
    area_claimed: "",
    land_use: "Traditional Agriculture",
  });
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Success & Instant Scheme Preview State
  const [createdClaim, setCreatedClaim] = useState<FRAClaim | null>(null);
  const [schemeRecs, setSchemeRecs] = useState<SchemeRecommendation[]>([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

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

  const handlePurgeAllData = async () => {
    if (!window.confirm("Are you sure you want to purge all claims data and start completely fresh? This will remove all demo claims, geometries, and analyses.")) {
      return;
    }
    setPurging(true);
    try {
      const res = await api.purgeData();
      alert(res.message || "Claims database cleared successfully!");
      fetchClaims();
    } catch (err: any) {
      alert(err.message || "Failed to purge claims data.");
    } finally {
      setPurging(false);
    }
  };

  const handleBulkFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkLoading(true);
    setBulkResult(null);
    try {
      const res = await api.uploadGeospatialFile(file, undefined, "GEOJSON_BULK_UPLOAD");
      setBulkResult(res);
      fetchClaims();
    } catch (err: any) {
      setBulkResult({ error: err.message || "Failed to upload geospatial parcel file" });
    } finally {
      setBulkLoading(false);
    }
  };

  useEffect(() => {
    fetchClaims();
  }, [selectedType, selectedStatus]);

  // Clean up camera stream when modal closes or unmounts
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchClaims();
  };

  // Camera controls
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (mediaStreamRef.current) {
        stopCamera();
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err: any) {
      setCameraError("Camera access was denied or not supported on this device. Please use file upload instead.");
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setCameraActive(false);
  };

  const handleCapturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    stopCamera();

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `camera_scan_${Date.now()}.jpg`, { type: "image/jpeg" });
      setPreviewImageUrl(URL.createObjectURL(blob));
      await processDocumentOCR(file);
    }, "image/jpeg", 0.95);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith("image/")) {
      setPreviewImageUrl(URL.createObjectURL(file));
    } else {
      setPreviewImageUrl(null);
    }
    await processDocumentOCR(file);
  };

  const processDocumentOCR = async (file: File) => {
    setOcrLoading(true);
    setOcrError(null);
    try {
      const doc = await api.uploadDocument(file, "FRA_PATTA");
      setUploadedDoc(doc);

      // Populate form fields from extracted document fields
      const newForm = { ...formData };
      const confMap: Record<string, number> = {};

      doc.fields?.forEach((f) => {
        if (!f.field_value) return;
        confMap[f.field_name] = f.confidence;

        switch (f.field_name) {
          case "claim_id":
            newForm.claim_id = f.field_value;
            break;
          case "applicant_name":
            newForm.applicant_name = f.field_value;
            break;
          case "father_name":
            newForm.father_or_husband_name = f.field_value;
            break;
          case "age":
            newForm.age = f.field_value;
            break;
          case "gender":
            newForm.gender = f.field_value;
            break;
          case "village":
            newForm.village = f.field_value;
            break;
          case "block":
            newForm.block = f.field_value;
            break;
          case "district":
            newForm.district = f.field_value;
            break;
          case "state":
            newForm.state = f.field_value;
            break;
          case "claim_type":
            if (["IFR", "CR", "CFR"].includes(f.field_value.toUpperCase())) {
              newForm.claim_type = f.field_value.toUpperCase();
            }
            break;
          case "area":
            newForm.area_claimed = f.field_value;
            break;
          case "survey_number":
            newForm.survey_number = f.field_value;
            break;
          case "land_use":
            newForm.land_use = f.field_value;
            break;
        }
      });

      if (!newForm.claim_id) {
        newForm.claim_id = `FRA-${(newForm.state.slice(0, 2) || "OD").toUpperCase()}-${(newForm.district.slice(0, 3) || "MAY").toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
      }

      setFormData(newForm);
      setFieldConfidences(confMap);
    } catch (err: any) {
      setOcrError(err.message || "Failed to parse document with OCR/Groq AI. Please fill in details manually.");
    } finally {
      setOcrLoading(false);
    }
  };

  const handleCreateClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    try {
      const created = await api.createClaim({
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

      setCreatedClaim(created);

      // Fetch instant scheme recommendations for the new claim
      try {
        const recs = await api.getClaimRecommendations(created.id);
        setSchemeRecs(recs);
      } catch {
        setSchemeRecs([]);
      }

      setShowCreateModal(false);
      setShowSuccessModal(true);
      fetchClaims();
    } catch (err: any) {
      alert(err.message || "Failed to create claim");
    } finally {
      setFormSubmitting(false);
    }
  };

  const openNewClaimModal = () => {
    stopCamera();
    setUploadedDoc(null);
    setPreviewImageUrl(null);
    setFieldConfidences({});
    setOcrError(null);
    setIntakeMode("upload");
    setFormData({
      claim_id: `FRA-${Math.floor(100000 + Math.random() * 900000)}`,
      claim_type: "IFR",
      applicant_name: "",
      father_or_husband_name: "",
      age: "",
      gender: "Male",
      village: "",
      block: "",
      district: "",
      state: "",
      survey_number: "",
      area_claimed: "",
      land_use: "Traditional Agriculture",
    });
    setShowCreateModal(true);
  };

  return (
    <div className="min-h-[calc(100vh-var(--header-height))] bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6 page-enter">
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

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              setBulkResult(null);
              setShowBulkModal(true);
            }}
            className="px-3.5 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700 hover:border-slate-600 text-xs font-semibold flex items-center gap-2 transition-all shadow-sm"
          >
            <Upload className="w-4 h-4 text-teal-400" />
            <span>Bulk Upload GeoJSON</span>
          </button>

          {claims.length > 0 && (
            <button
              onClick={handlePurgeAllData}
              disabled={purging}
              className="px-3.5 py-2.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-2 transition-all"
              title="Reset & Purge All Claims Data"
            >
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span>{purging ? "Purging..." : "Purge Data"}</span>
            </button>
          )}

          <button
            onClick={openNewClaimModal}
            className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-emerald-950/40 transition-all hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            <span>Register New FRA Claim</span>
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
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="max-w-md mx-auto space-y-3 py-4">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
                        <FileText className="w-6 h-6" />
                      </div>
                      <strong className="text-base font-bold text-white block">No Claims in Registry (Clean State)</strong>
                      <p className="text-xs text-slate-400">
                        Upload official Patta documents (PDF/images) with AI OCR extraction, bulk import village Cadastral GeoJSON boundaries, or manually register new titles.
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                        <button
                          onClick={openNewClaimModal}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Register New Claim</span>
                        </button>
                        <button
                          onClick={() => {
                            setBulkResult(null);
                            setShowBulkModal(true);
                          }}
                          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5"
                        >
                          <Upload className="w-3.5 h-3.5 text-teal-400" />
                          <span>Upload GeoJSON / KML</span>
                        </button>
                      </div>
                    </div>
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
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/atlas?claim_id=${claim.claim_id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-950/40 hover:bg-emerald-600 border border-emerald-500/30 text-emerald-400 hover:text-white text-xs font-medium transition-all shadow-sm"
                          title="View Parcel on Map"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          <span>Map</span>
                        </Link>
                        <Link
                          href={`/claims/${claim.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-all shadow-sm"
                        >
                          <span>Workspace</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MULTI-MODAL CLAIM INTAKE STUDIO MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass-panel-glow p-6 lg:p-7 rounded-3xl max-w-3xl w-full border border-slate-700 space-y-5 my-8 animate-in zoom-in-95 duration-150 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                    <Scan className="w-4 h-4 text-emerald-400" />
                  </div>
                  <h3 className="font-bold text-lg text-white">FRA Claim AI Registration Studio</h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Upload official Patta/Application, scan via camera, or enter manually. AI OCR automatically extracts applicant details and verifies scheme eligibility.
                </p>
              </div>
              <button 
                onClick={() => {
                  stopCamera();
                  setShowCreateModal(false);
                }} 
                className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Intake Mode Switcher Tabs */}
            <div className="grid grid-cols-3 gap-2 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setIntakeMode("upload");
                }}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  intakeMode === "upload"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-950/50"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <UploadCloud className="w-4 h-4" />
                <span>Upload Document (PDF/Image)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIntakeMode("camera");
                  startCamera();
                }}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  intakeMode === "camera"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-950/50"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Camera className="w-4 h-4" />
                <span>Capture with Camera</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setIntakeMode("manual");
                }}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  intakeMode === "manual"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-950/50"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Direct Manual Entry</span>
              </button>
            </div>

            {/* TAB 1: UPLOAD DOCUMENT (BEFORE EXTRACTION) */}
            {intakeMode === "upload" && !uploadedDoc && !ocrLoading && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-slate-700 hover:border-emerald-500/60 rounded-3xl p-8 text-center transition-all bg-slate-900/40">
                  <input
                    type="file"
                    id="patta-upload-input"
                    accept=".pdf,.png,.jpg,.jpeg,.tiff"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <label htmlFor="patta-upload-input" className="cursor-pointer block space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-950/40">
                      <UploadCloud className="w-7 h-7" />
                    </div>
                    <div>
                      <strong className="text-sm text-white block">Click to browse or drag & drop Patta document</strong>
                      <span className="text-xs text-slate-400 block mt-1 max-w-md mx-auto">
                        Supports Official FRA Title Deeds, Form A / B / C, or Gram Sabha Resolutions (PDF, PNG, JPG, JPEG up to 25MB)
                      </span>
                    </div>
                    <div className="pt-2">
                      <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md">
                        <Scan className="w-4 h-4" />
                        <span>Select Document for AI OCR</span>
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* TAB 2: CAMERA CAPTURE (BEFORE EXTRACTION) */}
            {intakeMode === "camera" && !uploadedDoc && !ocrLoading && (
              <div className="space-y-4">
                <div className="relative rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 aspect-video flex items-center justify-center shadow-inner">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Document Framing Overlay Guide */}
                  <div className="absolute inset-4 border-2 border-emerald-500/60 rounded-2xl pointer-events-none flex flex-col justify-between p-3 bg-emerald-950/10">
                    <span className="text-[10px] font-mono font-bold text-emerald-400 bg-slate-950/80 px-2 py-0.5 rounded self-start">
                      📐 ALIGN FRA PATTA PAPER INSIDE BORDER
                    </span>
                    <span className="text-[10px] font-mono text-slate-300 bg-slate-950/80 px-2 py-0.5 rounded self-end">
                      Hold steady under good lighting
                    </span>
                  </div>

                  {cameraError && (
                    <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center space-y-2">
                      <AlertCircle className="w-8 h-8 text-amber-400" />
                      <p className="text-xs text-slate-300 max-w-sm">{cameraError}</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleCapturePhoto}
                    disabled={ocrLoading}
                    className="px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-950/50 transition-all hover:scale-105"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Snap Photo & Run AI Extraction</span>
                  </button>

                  <button
                    type="button"
                    onClick={startCamera}
                    className="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                    title="Restart Camera"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* OCR Processing Banner */}
            {ocrLoading && (
              <div className="p-8 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col items-center justify-center text-center space-y-3">
                <div className="w-8 h-8 border-3 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                <div className="space-y-1">
                  <strong className="text-sm text-emerald-300 block">Extracting Text & Parsing via Groq AI...</strong>
                  <p className="text-xs text-emerald-400/80 max-w-md">
                    Applying Tesseract OCR + Groq LLM structured schema extractor to extract Claim ID, Applicant, Land Extent, and Village.
                  </p>
                </div>
              </div>
            )}

            {/* OCR Error Notice */}
            {ocrError && (
              <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-xs text-amber-300 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>{ocrError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOcrError(null);
                    setIntakeMode("manual");
                  }}
                  className="px-3 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-semibold shrink-0"
                >
                  Switch to Manual Entry
                </button>
              </div>
            )}

            {/* EXTRACTED DOCUMENT HEADER (WHEN SCANNED) */}
            {uploadedDoc && !ocrLoading && (
              <div className="p-3.5 rounded-2xl bg-slate-900 border border-emerald-500/30 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <FileCheck2 className="w-5 h-5" />
                  </div>
                  <div>
                    <strong className="text-white block">{uploadedDoc.file_name}</strong>
                    <span className="text-[10px] text-emerald-400 font-mono">
                      OCR Confidence: {( (uploadedDoc.ocr_confidence || 0.92) * 100).toFixed(0)}% • {uploadedDoc.fields?.length || 0} Fields Extracted
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setUploadedDoc(null);
                    setPreviewImageUrl(null);
                    setFieldConfidences({});
                    if (intakeMode === "camera") {
                      startCamera();
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Scan Another</span>
                </button>
              </div>
            )}

            {/* CLAIM DATA REVIEW & FORM FIELDS (SHOWN ONLY IF IN MANUAL MODE OR AFTER OCR EXTRACTION) */}
            {(intakeMode === "manual" || (uploadedDoc && !ocrLoading)) && (
              <form onSubmit={handleCreateClaim} className="space-y-4 text-xs pt-1">
                <div className="border-t border-slate-800 pt-3">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>{uploadedDoc ? "Review & Confirm Extracted Metadata" : "Manual Claim Entry"}</span>
                    </span>
                    {Object.keys(fieldConfidences).length > 0 && (
                      <span className="text-[10px] text-emerald-400 font-mono">
                        ✓ AI Verified with Field Confidences
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Claim ID */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-400">Claim ID *</label>
                      {fieldConfidences.claim_id && (
                        <span className="text-[9px] text-emerald-400 font-mono">
                          {(fieldConfidences.claim_id * 100).toFixed(0)}% conf
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      value={formData.claim_id}
                      onChange={(e) => setFormData({ ...formData, claim_id: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono"
                    />
                  </div>

                  {/* Claim Type */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-400">Claim Type *</label>
                      {fieldConfidences.claim_type && (
                        <span className="text-[9px] text-emerald-400 font-mono">
                          {(fieldConfidences.claim_type * 100).toFixed(0)}% conf
                        </span>
                      )}
                    </div>
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

                  {/* Applicant Name */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-400">Applicant Name *</label>
                      {fieldConfidences.applicant_name && (
                        <span className="text-[9px] text-emerald-400 font-mono">
                          {(fieldConfidences.applicant_name * 100).toFixed(0)}% conf
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      value={formData.applicant_name}
                      onChange={(e) => setFormData({ ...formData, applicant_name: e.target.value })}
                      placeholder="e.g. Sanatan Soren"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white"
                    />
                  </div>

                  {/* Father / Husband Name */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-400">Father / Husband Name</label>
                      {fieldConfidences.father_name && (
                        <span className="text-[9px] text-emerald-400 font-mono">
                          {(fieldConfidences.father_name * 100).toFixed(0)}% conf
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={formData.father_or_husband_name}
                      onChange={(e) => setFormData({ ...formData, father_or_husband_name: e.target.value })}
                      placeholder="e.g. Late Budhu Soren"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white"
                    />
                  </div>

                  {/* Age & Gender */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 block mb-1">Age</label>
                      <input
                        type="number"
                        value={formData.age}
                        onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                        placeholder="48"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Gender</label>
                      <select
                        value={formData.gender}
                        onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  {/* Extent of Forest Land */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-400">Claimed Area (Hectares) *</label>
                      {fieldConfidences.area && (
                        <span className="text-[9px] text-emerald-400 font-mono">
                          {(fieldConfidences.area * 100).toFixed(0)}% conf
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.area_claimed}
                      onChange={(e) => setFormData({ ...formData, area_claimed: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono"
                    />
                  </div>

                  {/* Village */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-400">Village / Gram Sabha *</label>
                      {fieldConfidences.village && (
                        <span className="text-[9px] text-emerald-400 font-mono">
                          {(fieldConfidences.village * 100).toFixed(0)}% conf
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      value={formData.village}
                      onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white"
                    />
                  </div>

                  {/* Block */}
                  <div>
                    <label className="text-slate-400 block mb-1">Block / Tehsil</label>
                    <input
                      type="text"
                      value={formData.block}
                      onChange={(e) => setFormData({ ...formData, block: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white"
                    />
                  </div>

                  {/* District & State */}
                  <div className="grid grid-cols-2 gap-2">
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
                      <label className="text-slate-400 block mb-1">State *</label>
                      <input
                        type="text"
                        required
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white"
                      />
                    </div>
                  </div>

                  {/* Survey Number */}
                  <div>
                    <label className="text-slate-400 block mb-1">Survey / Khasra No.</label>
                    <input
                      type="text"
                      value={formData.survey_number}
                      onChange={(e) => setFormData({ ...formData, survey_number: e.target.value })}
                      placeholder="e.g. PLOT-889/B"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono"
                    />
                  </div>

                  {/* Land Use */}
                  <div className="md:col-span-2">
                    <label className="text-slate-400 block mb-1">Primary Land Use</label>
                    <input
                      type="text"
                      value={formData.land_use}
                      onChange={(e) => setFormData({ ...formData, land_use: e.target.value })}
                      placeholder="e.g. Traditional Agriculture & Homestead"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    setShowCreateModal(false);
                  }}
                  className="px-4 py-2 rounded-2xl bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={formSubmitting || ocrLoading}
                  className="px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-2 shadow-lg shadow-emerald-950/50 transition-all hover:scale-[1.02]"
                >
                  {formSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Registering & Evaluating Schemes...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Submit Claim & Run AI Scheme Evaluation</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Initial State Cancel Button for Upload/Camera tabs */}
          {intakeMode !== "manual" && !uploadedDoc && !ocrLoading && (
            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setShowCreateModal(false);
                }}
                className="px-4 py-2 rounded-2xl bg-slate-900 text-slate-400 hover:text-white border border-slate-800 text-xs"
              >
                Cancel
              </button>
            </div>
          )}
          </div>
        </div>
      )}

      {/* SUCCESS & INSTANT SCHEME CONVERGENCE MODAL */}
      {showSuccessModal && createdClaim && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel-glow p-6 lg:p-8 rounded-3xl max-w-xl w-full border border-emerald-500/40 space-y-5 animate-in zoom-in-95 duration-150 shadow-2xl">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-xl shadow-emerald-950/60">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white">FRA Claim Registered Successfully!</h3>
              <p className="text-xs text-slate-300">
                Claim <strong className="text-emerald-400 font-mono">{createdClaim.claim_id}</strong> for <strong className="text-white">{createdClaim.applicant_name}</strong> is now registered in the Forest Rights Registry.
              </p>
            </div>

            {/* Instant AI Convergence Preview */}
            <div className="space-y-2.5 bg-slate-900/80 p-4 rounded-2xl border border-slate-800 text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Bot className="w-4 h-4 text-emerald-400" />
                  <span>Instant AI Scheme Recommendation Preview:</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono">
                  {schemeRecs.filter(r => r.eligibility_status === "ELIGIBLE").length} Eligible Schemes
                </span>
              </div>

              {schemeRecs.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {schemeRecs.slice(0, 4).map((rec) => (
                    <div key={rec.id} className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-white text-xs">{rec.scheme_name}</strong>
                          <span className="text-[10px] font-mono text-slate-400">({rec.scheme_code})</span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate max-w-xs">{rec.benefits}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${
                        rec.eligibility_status === "ELIGIBLE" ? "bg-emerald-500/20 text-emerald-300" :
                        rec.eligibility_status === "CONDITIONAL" ? "bg-amber-500/20 text-amber-300" :
                        "bg-slate-800 text-slate-400"
                      }`}>
                        {rec.eligibility_score}% Match
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-2 text-center">
                  Evaluating satellite telemetry and statutory rules for PM-KISAN, PMKSY, Van Dhan (VDVY), and PMAY-G...
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
              <Link
                href={`/claims/${createdClaim.id}`}
                className="py-2.5 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/50 transition-all text-center"
              >
                <span>Open Claim</span>
                <ChevronRight className="w-4 h-4" />
              </Link>

              <Link
                href={`/atlas?claim_id=${createdClaim.claim_id}`}
                className="py-2.5 px-3 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-teal-950/50 transition-all text-center"
              >
                <MapPin className="w-4 h-4" />
                <span>View on Map</span>
              </Link>

              <Link
                href={`/dss?claim_id=${createdClaim.id}&query=${encodeURIComponent(`Explain which government schemes ${createdClaim.applicant_name} (${createdClaim.claim_id}) is eligible for and why.`)}`}
                className="py-2.5 px-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-slate-700 hover:border-emerald-500/40 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all text-center"
              >
                <Bot className="w-4 h-4" />
                <span>AI Schemes</span>
              </Link>
            </div>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setShowSuccessModal(false)}
                className="text-xs text-slate-500 hover:text-slate-300 underline"
              >
                Back to Claims Registry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK GEOJSON / KML UPLOAD MODAL */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel-glow p-6 lg:p-7 rounded-3xl max-w-xl w-full border border-slate-700 space-y-4 animate-in zoom-in-95 duration-150 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Bulk Upload GeoJSON / Cadastral Data</h3>
                  <p className="text-xs text-slate-400">Upload entire village parcel datasets (.geojson, .json, .kml)</p>
                </div>
              </div>
              <button
                onClick={() => setShowBulkModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="border-2 border-dashed border-slate-700 hover:border-teal-500/60 rounded-3xl p-6 text-center space-y-3 bg-slate-900/40 transition-all">
              <UploadCloud className="w-10 h-10 text-teal-400 mx-auto" />
              <div>
                <strong className="text-sm text-white block">Select or Drag & Drop Geospatial File</strong>
                <span className="text-xs text-slate-400 block mt-0.5">
                  Supports GeoJSON FeatureCollection or KML containing surveyed land parcels with metadata.
                </span>
              </div>
              <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold cursor-pointer shadow">
                <span>Browse Geospatial File</span>
                <input
                  type="file"
                  accept=".geojson,.json,.kml"
                  onChange={handleBulkFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {bulkLoading && (
              <div className="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center gap-3 text-xs text-teal-300">
                <div className="w-4 h-4 border-2 border-teal-400 border-t-transparent rounded-full animate-spin"></div>
                <span>Parsing features, validating geometries, and creating database records...</span>
              </div>
            )}

            {bulkResult && (
              <div className={`p-4 rounded-2xl border text-xs space-y-1.5 ${
                bulkResult.error ? "bg-rose-500/10 border-rose-500/30 text-rose-300" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              }`}>
                {bulkResult.error ? (
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{bulkResult.error}</span>
                  </div>
                ) : (
                  <div>
                    <strong className="block text-emerald-200">
                      ✓ {bulkResult.message || `Successfully processed ${bulkResult.processed_count || 0} parcels.`}
                    </strong>
                    <span className="text-[11px] text-emerald-400/80 block mt-1">
                      Parcels are now loaded into the Claims Registry and WebGIS Atlas with geodesic areas calculated.
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              {bulkResult && !bulkResult.error ? (
                <Link
                  href={`/atlas?claim_id=${bulkResult.parcels?.[0]?.claim_id || ""}`}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5 shadow"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>View in WebGIS Atlas</span>
                </Link>
              ) : <div></div>}
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
