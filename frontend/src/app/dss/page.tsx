"use client";

import React, { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { 
  Bot, 
  User, 
  Sparkles, 
  Send, 
  RefreshCw, 
  Trash2, 
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
  Compass, 
  Zap, 
  Cpu, 
  AlertTriangle, 
  HelpCircle, 
  MessageSquare, 
  ShieldCheck, 
  FileText, 
  ExternalLink,
  ChevronDown,
  Layers,
  Activity
} from "lucide-react";
import { api } from "@/lib/api";
import { 
  VillageConvergence, 
  SchemeRecommendation, 
  ChatMessage, 
  DSSChatResponse, 
  SatelliteTelemetry, 
  RAGCitation,
  FRAClaim 
} from "@/lib/types";
import { getPriorityBadgeColor } from "@/lib/utils";

const SAMPLE_PROMPTS = [
  {
    category: "Claim Eligibility & Multi-Scheme Convergence",
    icon: Award,
    query: "What central and state welfare schemes are eligible FRA title holders entitled to under statutory rules?",
  },
  {
    category: "Satellite Indices & Irrigation Scarcity",
    icon: Droplets,
    query: "How do Copernicus Sentinel-2 NDRE/NDWI indices evaluate agricultural vitality and water scarcity for PMKSY?",
  },
  {
    category: "Eligibility Gaps & Actionable Next Steps",
    icon: HelpCircle,
    query: "What documentation or cadastral requirements are needed for an IFR Patta holder to receive PM-KISAN benefits?",
  },
  {
    category: "Minor Forest Produce & Van Dhan SHGs",
    icon: Trees,
    query: "Which forest resource criteria determine eligibility for setting up a Van Dhan Vikas Kendra (VDVK) cluster?",
  },
  {
    category: "Scheme Prioritization & Rules",
    icon: MapPin,
    query: "Summarize the convergence guidelines for PMAY-Gramin, PM-KISAN, and MGNREGA land levelling on FRA land.",
  },
];

function FormattedMarkdown({ content }: { content: string }) {
  // Simple, robust markdown processor for structured AI answers
  const lines = content.split("\n");
  const renderedElements: React.ReactNode[] = [];
  let inTable = false;
  let tableRows: string[][] = [];
  let tableHeader: string[] = [];

  const parseInline = (text: string) => {
    // Bold: **text**
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
    return parts.map((part, idx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={idx} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("*") && part.endsWith("*") && !part.startsWith("**")) {
        return <em key={idx} className="text-amber-300 italic">{part.slice(1, -1)}</em>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={idx} className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono text-[11px]">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  const flushTable = (key: number) => {
    if (tableHeader.length > 0 || tableRows.length > 0) {
      renderedElements.push(
        <div key={`table-${key}`} className="my-3 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60 shadow-inner">
          <table className="w-full text-left text-xs border-collapse">
            {tableHeader.length > 0 && (
              <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  {tableHeader.map((h, i) => (
                    <th key={i} className="py-2.5 px-3 font-semibold text-slate-300">{h}</th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody className="divide-y divide-slate-800/60">
              {tableRows.map((row, ri) => (
                <tr key={ri} className="hover:bg-slate-900/40">
                  {row.map((cell, ci) => (
                    <td key={ci} className="py-2 px-3 text-slate-300">{parseInline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableHeader = [];
      tableRows = [];
      inTable = false;
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // Table row detection
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const cells = trimmed.slice(1, -1).split("|").map(c => c.trim());
      // Check if separator line
      if (cells.every(c => /^:?-+:?$/.test(c))) {
        inTable = true;
        return;
      }
      if (!inTable && tableHeader.length === 0) {
        tableHeader = cells;
        inTable = true;
      } else {
        tableRows.push(cells);
      }
      return;
    } else if (inTable) {
      flushTable(idx);
    }

    if (!trimmed) {
      renderedElements.push(<div key={idx} className="h-2" />);
      return;
    }

    if (trimmed.startsWith("### ")) {
      renderedElements.push(
        <h3 key={idx} className="text-sm font-bold text-emerald-400 mt-4 mb-2 flex items-center gap-1.5 border-b border-slate-800/80 pb-1">
          {parseInline(trimmed.slice(4))}
        </h3>
      );
    } else if (trimmed.startsWith("#### ")) {
      renderedElements.push(
        <h4 key={idx} className="text-xs font-bold text-amber-300 mt-3 mb-1.5">
          {parseInline(trimmed.slice(5))}
        </h4>
      );
    } else if (trimmed.startsWith("## ")) {
      renderedElements.push(
        <h2 key={idx} className="text-base font-bold text-white mt-4 mb-2">
          {parseInline(trimmed.slice(3))}
        </h2>
      );
    } else if (trimmed.startsWith("# ")) {
      renderedElements.push(
        <h1 key={idx} className="text-lg font-bold text-white mt-4 mb-2">
          {parseInline(trimmed.slice(2))}
        </h1>
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      renderedElements.push(
        <div key={idx} className="flex items-start gap-2 text-xs text-slate-200 my-1 pl-1">
          <span className="text-emerald-400 font-bold shrink-0 mt-0.5">•</span>
          <span className="leading-relaxed">{parseInline(trimmed.slice(2))}</span>
        </div>
      );
    } else if (/^\d+\.\s/.test(trimmed)) {
      const match = trimmed.match(/^(\d+)\.\s(.*)$/);
      if (match) {
        renderedElements.push(
          <div key={idx} className="flex items-start gap-2 text-xs text-slate-200 my-1 pl-1">
            <span className="text-amber-400 font-mono font-bold text-[11px] shrink-0 mt-0.5">{match[1]}.</span>
            <span className="leading-relaxed">{parseInline(match[2])}</span>
          </div>
        );
      }
    } else {
      renderedElements.push(
        <p key={idx} className="text-xs text-slate-200 leading-relaxed my-1">
          {parseInline(trimmed)}
        </p>
      );
    }
  });

  if (inTable) {
    flushTable(lines.length);
  }

  return <div className="space-y-1">{renderedElements}</div>;
}

function DSSChatComponent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("query") || "";
  const initialClaimId = searchParams.get("claim_id") ? Number(searchParams.get("claim_id")) : null;

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: `### 🌲 Welcome to the FRA Decision Support Assistant
I am your **AI-Powered Policy & Spatial Advisor**, directly connected to **Copernicus Sentinel-2 remote sensing indices** (NDVI crop, NDWI water deficit, forest canopy) and grounded in **Ministry of Tribal Affairs (MoTA)** statutory convergence frameworks.

**How I can assist you:**
- **Scheme Eligibility & Reasoning**: Ask why a claim qualifies for **PM-KISAN, PMKSY, Van Dhan (VDVY), PMAY-G**, or **MGNREGA**.
- **Remote Sensing Evidence**: Inquire about satellite vegetation indices, drought/water deficits, or land-cover distribution.
- **Eligibility Gap Analysis**: If a claim is conditional or ineligible, ask for actionable step-by-step guidance on how to become eligible.
- **Village-Level Convergence**: Find which villages qualify for irrigation check-dams or tribal enterprise clusters.

*Select a suggested prompt below or type your question!*`,
      timestamp: "Just now",
      model_used: "Groq/LLM-Grounded"
    }
  ]);

  const [inputQuery, setInputQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeResponse, setActiveResponse] = useState<DSSChatResponse | null>(null);
  const [selectedClaimId, setSelectedClaimId] = useState<number | null>(initialClaimId);
  const [claimsList, setClaimsList] = useState<FRAClaim[]>([]);
  const [villages, setVillages] = useState<VillageConvergence[]>([]);
  const [loadingVillages, setLoadingVillages] = useState(true);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load claims and villages
  useEffect(() => {
    api.getClaims({ limit: 50 })
      .then((data) => setClaimsList(data))
      .catch(() => {});

    api.getVillageConvergence()
      .then((data) => {
        setVillages(data);
        setLoadingVillages(false);
      })
      .catch(() => setLoadingVillages(false));
  }, []);

  // Auto-trigger query from URL parameters if present
  useEffect(() => {
    if (initialQuery) {
      handleSendQuery(initialQuery, initialClaimId || undefined);
    }
  }, [initialQuery]);

  // Scroll to bottom when messages update
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSendQuery = async (queryText: string, claimIdOverride?: number, schemeCodeOverride?: string) => {
    const textToSend = queryText.trim();
    if (!textToSend || loading) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputQuery("");
    setLoading(true);

    try {
      const chatReq = {
        query: textToSend,
        messages: newMessages,
        claim_id: claimIdOverride !== undefined ? claimIdOverride : (selectedClaimId || undefined),
        scheme_code: schemeCodeOverride
      };

      const res = await api.chatDSS(chatReq);
      setActiveResponse(res);
      setMessages([...newMessages, res.message]);

      if (res.claim_context?.id && !selectedClaimId) {
        setSelectedClaimId(res.claim_context.id);
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        role: "assistant",
        content: `⚠️ **Unable to process query at this time:** ${err.message || "Network error. Please try again."}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        model_used: "Error"
      };
      setMessages([...newMessages, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        role: "assistant",
        content: "Conversation cleared. Feel free to ask about any FRA claim, satellite remote sensing index, or government welfare scheme!",
        timestamp: "Just now",
        model_used: "Groq/LLM-Grounded"
      }
    ]);
    setActiveResponse(null);
  };

  const activeClaim = claimsList.find(c => c.id === selectedClaimId);

  return (
    <div className="min-h-[calc(100vh-var(--header-height))] bg-slate-950 text-slate-100 p-4 lg:p-8 space-y-8 page-enter">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-600 via-amber-500 to-emerald-400 p-0.5 shadow-lg shadow-amber-950/50">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Bot className="w-5 h-5 text-amber-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-white tracking-tight">DSS AI Conversational Assistant</h1>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono font-semibold flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Groq Real-Time LLM + RAG
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Grounded multi-modal Decision Support System combining PostGIS spatial analytics, Sentinel-2 spectral indices, and official Ministry of Tribal Affairs policy documents.
              </p>
            </div>
          </div>
        </div>

        {/* Claim Context Selector & Chat Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400 text-[11px]">Context:</span>
            <select
              value={selectedClaimId || ""}
              onChange={(e) => setSelectedClaimId(e.target.value ? Number(e.target.value) : null)}
              className="bg-transparent text-white text-xs font-semibold focus:outline-none cursor-pointer"
            >
              <option value="" className="bg-slate-900 text-slate-300">Auto-Detect from Chat</option>
              {claimsList.map((c) => (
                <option key={c.id} value={c.id} className="bg-slate-900 text-slate-200">
                  {c.claim_id} - {c.applicant_name} ({c.village})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleClearChat}
            className="p-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-rose-400 transition-colors text-xs flex items-center gap-1.5"
            title="Clear Chat History"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">Clear</span>
          </button>
        </div>
      </div>

      {/* Active Claim Context Bar (if a claim is selected) */}
      {activeClaim && (
        <div className="glass-panel p-4 rounded-3xl border border-emerald-500/30 bg-emerald-950/20 flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white font-mono">{activeClaim.claim_id}</span>
                <span className="text-emerald-300 font-semibold">{activeClaim.applicant_name}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                  {activeClaim.claim_type} ({activeClaim.area_claimed} Ha)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                  {activeClaim.status}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Location: {activeClaim.village}, {activeClaim.district}, {activeClaim.state} • Land Use: {activeClaim.land_use || "Agriculture"}
              </p>
            </div>
          </div>

          <button
            onClick={() => setSelectedClaimId(null)}
            className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
          >
            Reset Context
          </button>
        </div>
      )}

      {/* Main Chat & Assessment Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Chat Stream (Left / Main Column) */}
        <div className="lg:col-span-8 space-y-4 flex flex-col h-[750px]">
          {/* Scrollable Message History */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar glass-panel p-5 rounded-3xl border border-slate-800/80 shadow-2xl">
            {messages.map((msg, index) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={index}
                  className={`flex gap-3.5 ${isUser ? "justify-end" : "justify-start"} animate-in fade-in duration-150`}
                >
                  {!isUser && (
                    <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-amber-500 to-emerald-500 p-0.5 shrink-0 mt-1 shadow-md">
                      <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                        <Bot className="w-4 h-4 text-amber-400" />
                      </div>
                    </div>
                  )}

                  <div className={`space-y-2 max-w-[88%] ${isUser ? "items-end" : "items-start"}`}>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 px-1">
                      <span className="font-semibold text-slate-300">{isUser ? "You" : "DSS Decision AI"}</span>
                      <span>•</span>
                      <span>{msg.timestamp || "Just now"}</span>
                      {msg.model_used && (
                        <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono text-[9px] border border-slate-700">
                          {msg.model_used}
                        </span>
                      )}
                    </div>

                    <div
                      className={`p-4 rounded-3xl text-xs leading-relaxed shadow-lg ${
                        isUser
                          ? "bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-tr-sm"
                          : "bg-slate-900/90 border border-slate-800 text-slate-200 rounded-tl-sm"
                      }`}
                    >
                      <FormattedMarkdown content={msg.content} />
                    </div>
                  </div>

                  {isUser && (
                    <div className="w-8 h-8 rounded-2xl bg-slate-800 border border-slate-700 p-1 shrink-0 mt-1 flex items-center justify-center">
                      <User className="w-4 h-4 text-emerald-400" />
                    </div>
                  )}
                </div>
              );
            })}

            {loading && (
              <div className="flex items-start gap-3.5 animate-in fade-in">
                <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-amber-500 to-emerald-500 p-0.5 shrink-0 mt-1">
                  <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                    <Bot className="w-4 h-4 text-amber-400 animate-pulse" />
                  </div>
                </div>
                <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 text-xs text-slate-400 flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "0ms" }}></span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "150ms" }}></span>
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "300ms" }}></span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-300">
                    Querying Groq LLM with PostGIS spatial indices & RAG guidelines...
                  </span>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Suggested Follow-up Prompts */}
          {activeResponse?.suggested_followups && activeResponse.suggested_followups.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Suggested Follow-up Questions:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {activeResponse.suggested_followups.map((sug, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendQuery(sug)}
                    className="px-3 py-1.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 text-slate-300 hover:text-amber-300 text-[11px] transition-all text-left flex items-center gap-1.5 shadow-sm"
                  >
                    <ArrowRight className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>{sug}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat Input Box */}
          <div className="glass-panel-glow p-3.5 rounded-3xl border border-slate-700/80 shadow-2xl space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendQuery(inputQuery)}
                placeholder="Ask about claim eligibility, satellite NDVI/NDWI, Van Dhan MFP, or PMKSY irrigation rules..."
                className="flex-1 px-4 py-3 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                disabled={loading}
              />
              <button
                onClick={() => handleSendQuery(inputQuery)}
                disabled={loading || !inputQuery.trim()}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white text-xs font-bold shadow-lg shadow-amber-950/50 transition-all flex items-center gap-2 shrink-0 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Ask AI</span>
              </button>
            </div>

            {/* Quick Starter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto py-1 custom-scrollbar text-xs">
              <span className="text-[10px] text-slate-500 uppercase font-semibold shrink-0">Quick Starters:</span>
              {SAMPLE_PROMPTS.slice(0, 3).map((sp, i) => (
                <button
                  key={i}
                  onClick={() => handleSendQuery(sp.query)}
                  className="px-2.5 py-1 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-[10px] shrink-0 transition-colors truncate max-w-[280px]"
                  title={sp.query}
                >
                  {sp.query}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Side Panel: Live Satellite Telemetry & Scheme Cards (Right Column) */}
        <div className="lg:col-span-4 space-y-5 h-[750px] overflow-y-auto pr-1 custom-scrollbar">
          {/* SATELLITE REMOTE SENSING TELEMETRY */}
          {activeResponse?.satellite_telemetry ? (
            <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-4 shadow-xl animate-in fade-in">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-teal-400" />
                  <h3 className="text-xs font-bold text-white">Live Sentinel-2 Telemetry</h3>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/20 font-mono">
                  10m Surface Reflectance
                </span>
              </div>

              {/* Spectral Meters */}
              <div className="space-y-3">
                {/* Crop NDVI */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-300 flex items-center gap-1">
                      <Wheat className="w-3.5 h-3.5 text-lime-400" /> Active Crop Cover
                    </span>
                    <span className="font-mono text-lime-400 font-bold">
                      {activeResponse.satellite_telemetry.crop_pct}%
                      {activeResponse.satellite_telemetry.mean_ndvi !== undefined && ` (NDVI: ${activeResponse.satellite_telemetry.mean_ndvi})`}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-lime-500 rounded-full"
                      style={{ width: `${Math.min(activeResponse.satellite_telemetry.crop_pct, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Forest Canopy */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-300 flex items-center gap-1">
                      <Trees className="w-3.5 h-3.5 text-emerald-400" /> Forest Canopy Cover
                    </span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {activeResponse.satellite_telemetry.forest_pct}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${Math.min(activeResponse.satellite_telemetry.forest_pct, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Water Cover / NDWI */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-300 flex items-center gap-1">
                      <Droplets className="w-3.5 h-3.5 text-blue-400" /> Surface Water Cover
                    </span>
                    <span className="font-mono text-blue-400 font-bold">
                      {activeResponse.satellite_telemetry.water_pct}%
                      {activeResponse.satellite_telemetry.mean_ndwi !== undefined && ` (NDWI: ${activeResponse.satellite_telemetry.mean_ndwi})`}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${Math.min(activeResponse.satellite_telemetry.water_pct, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Water Deficit Alert */}
              {activeResponse.satellite_telemetry.water_deficit && (
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-amber-200">Critical Water Deficit Detected</strong>
                    <span>Parcel has active crops ({activeResponse.satellite_telemetry.crop_pct}%) but negligible surface water ({activeResponse.satellite_telemetry.water_pct}%). Priority candidate for PMKSY drip irrigation subsidy.</span>
                  </div>
                </div>
              )}

              {/* Detected Spatial Assets */}
              <div className="space-y-1 text-xs">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Detected Spatial Assets:</span>
                <div className="flex flex-wrap gap-1.5">
                  {activeResponse.satellite_telemetry.assets_detected.map((ast, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-[10px] font-mono">
                      {ast}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-panel p-5 rounded-3xl border border-slate-800 space-y-3 text-center py-8">
              <Compass className="w-8 h-8 text-slate-600 mx-auto" />
              <h4 className="text-xs font-bold text-slate-300">Spatial Telemetry Ready</h4>
              <p className="text-[11px] text-slate-500">
                Ask about a specific FRA claim (e.g. Birsa Munda or FRA-OD-MAY-001) to view real-time Sentinel-2 remote sensing statistics.
              </p>
            </div>
          )}

          {/* SCHEME RECOMMENDATION CARDS WITH DIRECT CLARIFICATION BUTTON */}
          {activeResponse?.recommendations && activeResponse.recommendations.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-400" />
                  Evaluated Schemes ({activeResponse.recommendations.length})
                </h3>
                <span className="text-[10px] text-slate-400">Click to clarify with AI</span>
              </div>

              <div className="space-y-3">
                {activeResponse.recommendations.map((rec) => (
                  <div
                    key={rec.id || rec.scheme_code}
                    className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 transition-all space-y-3 shadow-lg"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-bold text-white">{rec.scheme_name}</h4>
                        <span className="text-[10px] text-slate-400 font-mono">{rec.department}</span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                        rec.eligibility_status === "ELIGIBLE"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : rec.eligibility_status === "CONDITIONAL"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                      }`}>
                        {rec.eligibility_status}
                      </span>
                    </div>

                    {/* Progress Meter */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                        <span>Match Score</span>
                        <span className="text-amber-400 font-bold">{rec.eligibility_score}%</span>
                      </div>
                      <div className="w-full h-1 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full"
                          style={{ width: `${rec.eligibility_score}%` }}
                        />
                      </div>
                    </div>

                    {/* Reasoning Snippet */}
                    <div className="p-2.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 text-[11px] text-slate-300">
                      <p className="line-clamp-3 leading-snug">{rec.reason}</p>
                    </div>

                    {/* Direct Clarification Button */}
                    <button
                      onClick={() => handleSendQuery(
                        `Explain in detail why this claim is evaluated as ${rec.eligibility_status} for ${rec.scheme_name} (${rec.scheme_code}), what exact satellite NDVI/NDWI indicators confirm it, what documents are required, and how the applicant can claim the benefits.`,
                        rec.claim_id,
                        rec.scheme_code
                      )}
                      className="w-full py-2 px-3 rounded-2xl bg-slate-800 hover:bg-amber-500/20 text-amber-300 hover:text-amber-200 border border-slate-700 hover:border-amber-500/40 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Clarify Eligibility & Next Steps</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* RAG Policy Citations Card */}
          {activeResponse?.citations && activeResponse.citations.length > 0 && (
            <div className="glass-panel p-4 rounded-3xl border border-slate-800 space-y-3 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-bold text-white">Grounded Policy Citations</h3>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">
                  {activeResponse.citations.length} Official PDFs
                </span>
              </div>

              <div className="space-y-2.5">
                {activeResponse.citations.map((c: RAGCitation, i: number) => (
                  <div key={i} className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-300 font-medium">
                      <span className="truncate text-[11px] font-semibold">{c.document_name}</span>
                      <span className="text-amber-400 font-mono text-[10px] shrink-0">Page {c.page_number}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 italic line-clamp-3">&quot;{c.excerpt}&quot;</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Village Convergence Prioritization Matrix */}
      <div className="space-y-4 pt-4 border-t border-slate-800/80">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-400" />
              Village-Level Convergence Prioritization Matrix
            </h2>
            <p className="text-xs text-slate-400">
              Aggregated Sentinel-2 remote sensing indices (canopy, crops, water deficit) prioritizing district-level welfare intervention.
            </p>
          </div>
        </div>

        <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
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
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loadingVillages ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500">
                      Loading village convergence metrics...
                    </td>
                  </tr>
                ) : (
                  villages.map((v) => (
                    <tr key={v.village} className="hover:bg-slate-900/50 transition-colors">
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
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleSendQuery(`Provide a detailed DSS convergence assessment for village ${v.village} in ${v.district} district. Explain why it is rated ${v.priority_level} priority based on its ${v.mean_forest_pct}% forest canopy, ${v.mean_crop_pct}% crop cover, and ${v.mean_water_pct}% water cover.`)}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-600/30 text-emerald-400 hover:text-emerald-300 border border-slate-700 text-[11px] font-semibold flex items-center gap-1 shrink-0 ml-auto transition-all cursor-pointer"
                        >
                          <Bot className="w-3.5 h-3.5" />
                          <span>Ask AI</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DSSCommandPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading DSS Command Center...</span>
        </div>
      </div>
    }>
      <DSSChatComponent />
    </Suspense>
  );
}
