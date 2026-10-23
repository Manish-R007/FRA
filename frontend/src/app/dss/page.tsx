"use client";

import React, { useEffect, useState, useRef, Suspense } from "react";
import { motion, useReducedMotion } from "framer-motion";
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
    query: "What recorded land and claim evidence supports PMKSY irrigation assistance?",
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
        return <strong key={idx} className="font-semibold text-[var(--ink)]">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("*") && part.endsWith("*") && !part.startsWith("**")) {
        return <em key={idx} className="text-amber-300 italic">{part.slice(1, -1)}</em>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={idx} className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-amber-800 dark:text-amber-300 font-mono text-[11px]">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  const flushTable = (key: number) => {
    if (tableHeader.length > 0 || tableRows.length > 0) {
      renderedElements.push(
        <div key={`table-${key}`} className="my-3 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-950/60 shadow-inner">
          <table className="w-full text-left text-xs border-collapse">
            {tableHeader.length > 0 && (
              <thead className="bg-slate-200/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  {tableHeader.map((h, i) => (
                    <th key={i} className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-300">{h}</th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
              {tableRows.map((row, ri) => (
                <tr key={ri} className="hover:bg-slate-200/50 dark:hover:bg-slate-900/40">
                  {row.map((cell, ci) => (
                    <td key={ci} className="py-2 px-3 text-slate-800 dark:text-slate-300">{parseInline(cell)}</td>
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
        <h3 key={idx} className="text-sm font-bold text-emerald-700 dark:text-emerald-400 mt-4 mb-2 flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800/80 pb-1">
          {parseInline(trimmed.slice(4))}
        </h3>
      );
    } else if (trimmed.startsWith("#### ")) {
      renderedElements.push(
        <h4 key={idx} className="text-xs font-bold text-amber-800 dark:text-amber-300 mt-3 mb-1.5">
          {parseInline(trimmed.slice(5))}
        </h4>
      );
    } else if (trimmed.startsWith("## ")) {
      renderedElements.push(
        <h2 key={idx} className="text-base font-bold text-slate-900 dark:text-white mt-4 mb-2">
          {parseInline(trimmed.slice(3))}
        </h2>
      );
    } else if (trimmed.startsWith("# ")) {
      renderedElements.push(
        <h1 key={idx} className="text-lg font-bold text-slate-900 dark:text-white mt-4 mb-2">
          {parseInline(trimmed.slice(2))}
        </h1>
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      renderedElements.push(
        <div key={idx} className="flex items-start gap-2 text-xs text-slate-800 dark:text-slate-200 my-1 pl-1">
          <span className="text-emerald-700 dark:text-emerald-400 font-bold shrink-0 mt-0.5">•</span>
          <span className="leading-relaxed">{parseInline(trimmed.slice(2))}</span>
        </div>
      );
    } else if (/^\d+\.\s/.test(trimmed)) {
      const match = trimmed.match(/^(\d+)\.\s(.*)$/);
      if (match) {
        renderedElements.push(
          <div key={idx} className="flex items-start gap-2 text-xs text-slate-800 dark:text-slate-200 my-1 pl-1">
            <span className="text-amber-800 dark:text-amber-400 font-mono font-bold text-[11px] shrink-0 mt-0.5">{match[1]}.</span>
            <span className="leading-relaxed">{parseInline(match[2])}</span>
          </div>
        );
      }
    } else {
      renderedElements.push(
        <p key={idx} className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed my-1">
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
  const [conversationId, setConversationId] = useState("");

  useEffect(() => {
    const key = "fra_atlas_dss_conversation";
    let id = sessionStorage.getItem(key);
    if (!id) { id = crypto.randomUUID(); sessionStorage.setItem(key, id); }
    setConversationId(id);
  }, []);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: `### 🌲 Welcome to the FRA Decision Support Assistant
I am your **AI-Powered Policy & Spatial Advisor**, grounded in recorded claim information, mapped land boundaries, and **Ministry of Tribal Affairs (MoTA)** statutory convergence frameworks.

**How I can assist you:**
- **Scheme Eligibility & Reasoning**: Ask why a claim qualifies for **PM-KISAN, PMKSY, Van Dhan (VDVY), PMAY-G**, or **MGNREGA**.
- **Land Evidence**: Inquire about recorded land-cover observations and mapped parcel information.
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
        scheme_code: schemeCodeOverride,
        conversation_id: conversationId || undefined,
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
    const freshId = crypto.randomUUID();
    sessionStorage.setItem("fra_atlas_dss_conversation", freshId);
    setConversationId(freshId);
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
    <div className="mx-auto min-h-[calc(100vh-var(--header-height))] max-w-[1440px] space-y-7 px-4 py-7 sm:px-6 lg:px-8 page-enter">
      {/* Header Banner */}
      <motion.div
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 fra-page-header"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span className="icon-chip">
              <Bot className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-5xl">Decision support</h1>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#f0ece2] text-[#9c6644] border border-[#e6dfd0] font-mono font-semibold flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Groq Real-Time LLM + RAG
                </span>
              </div>
              <p className="text-xs text-[#68806e]">
                Grounded Decision Support System combining claim records, mapped parcel information, and official Ministry of Tribal Affairs policy documents.
              </p>
            </div>
          </div>
        </div>

        {/* Claim Context Selector & Chat Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#dce6e0] text-xs">
            <Filter className="w-3.5 h-3.5 text-[#8c9d8f]" />
            <span className="text-[#8c9d8f] text-[11px]">Context:</span>
            <select
              value={selectedClaimId || ""}
              onChange={(e) => setSelectedClaimId(e.target.value ? Number(e.target.value) : null)}
              className="bg-transparent text-[#1a2f23] text-xs font-semibold focus:outline-none cursor-pointer"
            >
              <option value="">Auto-Detect from Chat</option>
              {claimsList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.claim_id} - {c.applicant_name} ({c.village})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleClearChat}
            className="p-2.5 rounded-xl bg-white hover:bg-rose-50 border border-[#dce6e0] text-[#8c9d8f] hover:text-rose-600 transition-colors text-xs flex items-center gap-1.5"
            title="Clear Chat History"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">Clear</span>
          </button>
        </div>
      </motion.div>

      {/* Active Claim Context Bar (if a claim is selected) */}
      {activeClaim && (
        <motion.div
          className="glass-panel p-4 rounded-2xl border border-[#c5d4b8] bg-[#f5f8f2] flex flex-wrap items-center justify-between gap-3 text-xs"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center gap-3">
            <div className="icon-chip !h-8 !w-8">
              <ShieldCheck className="w-4 h-4 text-[#3d7a4f]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#1a2f23] font-mono">{activeClaim.claim_id}</span>
                <span className="text-[#3d7a4f] font-semibold">{activeClaim.applicant_name}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#e4ede0] text-[#3d7a4f] border border-[#c5d4b8] font-semibold">
                  {activeClaim.claim_type} ({activeClaim.area_claimed} Ha)
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-white text-[#3d5a46] border border-[#dce6e0] font-mono">
                  {activeClaim.status}
                </span>
              </div>
              <p className="text-[11px] text-[#68806e]">
                Location: {activeClaim.village}, {activeClaim.district}, {activeClaim.state} • Land Use: {activeClaim.land_use || "Agriculture"}
              </p>
            </div>
          </div>

          <button
            onClick={() => setSelectedClaimId(null)}
            className="text-[11px] text-[#68806e] hover:text-[#3d7a4f] underline cursor-pointer"
          >
            Reset Context
          </button>
        </motion.div>
      )}

      {/* Main Chat & Assessment Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Chat Stream (Left / Main Column) */}
        <div className="lg:col-span-8 space-y-4 flex flex-col h-[750px]">
          {/* Scrollable Message History */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar glass-panel p-5 rounded-[1.4rem] shadow-lg">
            {messages.map((msg, index) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={index}
                  className={`flex gap-3.5 ${isUser ? "justify-end" : "justify-start"} animate-in fade-in duration-150`}
                >
                  {!isUser && (
                    <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-[#f0ece2] to-[#e6dfd0] shrink-0 mt-1 shadow-sm flex items-center justify-center">
                      <Bot className="w-4 h-4 text-[#b47a3c]" />
                    </div>
                  )}

                  <div className={`space-y-2 max-w-[88%] ${isUser ? "items-end" : "items-start"}`}>
                    <div className="flex items-center gap-2 text-[10px] text-[#8c9d8f] px-1">
                      <span className="font-semibold text-[#3d5a46]">{isUser ? "You" : "DSS Decision AI"}</span>
                      <span>•</span>
                      <span>{msg.timestamp || "Just now"}</span>
                      {msg.model_used && (
                        <span className="px-1.5 py-0.2 rounded-md bg-[#f0f1e9] text-[#68806e] font-mono text-[9px] border border-[#e2e5da]">
                          {msg.model_used}
                        </span>
                      )}
                    </div>

                    <div
                      className={`p-4 rounded-2xl text-xs leading-relaxed shadow-sm ${
                        isUser
                          ? "dss-message-user"
                          : "dss-message-bot text-[#3d5a46]"
                      }`}
                    >
                      <FormattedMarkdown content={msg.content} />
                    </div>
                  </div>

                  {isUser && (
                    <div className="w-8 h-8 rounded-2xl bg-[#e4ede0] border border-[#c5d4b8] shrink-0 mt-1 flex items-center justify-center">
                      <User className="w-4 h-4 text-[#3d7a4f]" />
                    </div>
                  )}
                </div>
              );
            })}

            {loading && (
              <div className="flex items-start gap-3.5 animate-in fade-in">
                <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-[#f0ece2] to-[#e6dfd0] shrink-0 mt-1 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-[#b47a3c] animate-pulse" />
                </div>
                <div className="p-4 rounded-2xl dss-message-bot text-xs text-[#68806e] flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#b47a3c] animate-bounce" style={{ animationDelay: "0ms" }}></span>
                    <span className="w-2 h-2 rounded-full bg-[#4a9460] animate-bounce" style={{ animationDelay: "150ms" }}></span>
                    <span className="w-2 h-2 rounded-full bg-[#6ea5c0] animate-bounce" style={{ animationDelay: "300ms" }}></span>
                  </div>
                  <span className="font-mono text-[11px] text-[#556c60]">
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
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#68806e]">
                <Sparkles className="w-3.5 h-3.5 text-[#b47a3c]" />
                <span>Suggested Follow-up Questions:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {activeResponse.suggested_followups.map((sug, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendQuery(sug)}
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#faf5ef] border border-[#e2e5da] hover:border-[#d4b27a] text-[#3d5a46] hover:text-[#9c6644] text-[11px] transition-all text-left flex items-center gap-1.5 shadow-sm"
                  >
                    <ArrowRight className="w-3 h-3 text-[#b47a3c] shrink-0" />
                    <span>{sug}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat Input Box */}
          <div className="glass-panel-glow p-3.5 rounded-2xl shadow-lg space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendQuery(inputQuery)}
                placeholder="Ask about claim eligibility, Van Dhan MFP, PMKSY irrigation rules, or policy guidance..."
                className="flex-1 px-4 py-3 rounded-xl bg-white border border-[#dce6e0] text-xs text-[#1a2f23] placeholder-[#aab8ad] focus:outline-none focus:border-[#b47a3c]"
                disabled={loading}
              />
              <button
                onClick={() => handleSendQuery(inputQuery)}
                disabled={loading || !inputQuery.trim()}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#b47a3c] to-[#c8943c] hover:from-[#9c6644] hover:to-[#b47a3c] text-white text-xs font-bold shadow-lg shadow-[#b47a3c]/15 transition-all flex items-center gap-2 shrink-0 disabled:opacity-50"
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
                  className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900/80 hover:bg-emerald-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-white text-[10px] shrink-0 transition-colors truncate max-w-[280px] shadow-sm"
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
          {/* SCHEME RECOMMENDATION CARDS WITH DIRECT CLARIFICATION BUTTON */}
          {activeResponse?.recommendations && activeResponse.recommendations.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="kicker flex items-center gap-1.5 !normal-case tracking-[0.14em]">
                  <Award className="w-4 h-4 text-[var(--gold)]" />
                  Evaluated schemes ({activeResponse.recommendations.length})
                </h3>
                <span className="text-[10px] text-[var(--ink-muted)]">Click to clarify with AI</span>
              </div>

              <div className="space-y-3">
                {activeResponse.recommendations.map((rec) => (
                  <div
                    key={rec.id || rec.scheme_code}
                    className="glass-panel p-4 space-y-3 forest-card-hover"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-display text-xl leading-tight text-[var(--ink)]">{rec.scheme_name}</h4>
                        <span className="text-[10px] text-[var(--ink-muted)] font-mono">{rec.department}</span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                        rec.eligibility_status === "ELIGIBLE"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : rec.eligibility_status === "CONDITIONAL"
                          ? "bg-[rgba(226,180,92,0.12)] text-[var(--gold)] border-[var(--line)]"
                          : "bg-rose-50 text-rose-800 border-rose-200"
                      }`}>
                        {rec.eligibility_status}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-[var(--ink-muted)] font-mono">
                        <span>Match score</span>
                        <span className="text-[#936323] font-bold">{rec.eligibility_score}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-[#e8eadf] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#b8863b] to-[#3d8050]"
                          style={{ width: `${rec.eligibility_score}%` }}
                        />
                      </div>
                    </div>

                    <div className="p-2.5 rounded-2xl border border-[var(--line)] bg-[rgba(226,180,92,0.07)] text-[11px] text-[var(--ink-soft)]">
                      <p className="line-clamp-3 leading-snug">{rec.reason}</p>
                    </div>

                    <button
                      onClick={() => handleSendQuery(
                        `Explain in detail why this claim is evaluated as ${rec.eligibility_status} for ${rec.scheme_name} (${rec.scheme_code}), what recorded claim and land evidence supports it, what documents are required, and how the applicant can claim the benefits.`,
                        rec.claim_id,
                        rec.scheme_code
                      )}
                      className="btn-ghost w-full !py-2 text-[11px]"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Clarify eligibility & next steps</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* RAG Policy Citations Card */}
          {activeResponse?.citations && activeResponse.citations.length > 0 && (
            <div className="glass-panel p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[var(--line)] pb-2.5">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[var(--gold)]" />
                  <h3 className="font-display text-xl">Grounded policy citations</h3>
                </div>
                <span className="text-[10px] text-[var(--ink-muted)] font-mono">
                  {activeResponse.citations.length} policy sources
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
                    {c.source_url && <a href={c.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] text-emerald-700 hover:underline"><ExternalLink className="h-3 w-3" />Open source</a>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Village Convergence Prioritization Matrix */}
      <div className="space-y-4 pt-4 border-t border-[var(--line)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-3xl flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[var(--gold)]" />
              Village-level convergence matrix
            </h2>
            <p className="text-xs text-[var(--ink-muted)]">
              Claim and land-cover records help prioritize district-level welfare intervention.
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
                      <td className="py-3.5 px-4 font-mono text-emerald-400">{v.mean_forest_pct == null ? "Unavailable" : `${v.mean_forest_pct}%`}</td>
                      <td className="py-3.5 px-4 font-mono text-lime-400">{v.mean_crop_pct == null ? "Unavailable" : `${v.mean_crop_pct}%`}</td>
                      <td className="py-3.5 px-4 font-mono text-blue-400">{v.mean_water_pct == null ? "Unavailable" : `${v.mean_water_pct}%`}</td>
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
                          onClick={() => handleSendQuery(`Provide a detailed DSS convergence assessment for village ${v.village} in ${v.district} district. Explain why it is rated ${v.priority_level} priority using the available recorded village indicators.`)}
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
