import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatArea(hectares: number): string {
  if (!hectares) return "0.00 Ha";
  return `${hectares.toFixed(2)} Ha (${(hectares * 2.47105).toFixed(2)} Acres)`;
}

export function getStatusBadgeColor(status: string): string {
  switch (status) {
    case "APPROVED":
    case "VERIFIED":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-400/30";
    case "PENDING_VERIFICATION":
    case "FIELD_VERIFICATION":
      return "bg-amber-500/15 text-amber-300 border-amber-400/30";
    case "GIS_VALIDATED":
    case "SATELLITE_ANALYZE":
      return "bg-cyan-500/15 text-cyan-300 border-cyan-400/30";
    case "REJECTED":
      return "bg-rose-500/15 text-rose-300 border-rose-400/30";
    case "FLAGGED":
      return "bg-rose-500/15 text-rose-300 border-rose-400/30 animate-pulse";
    default:
      return "bg-white/5 text-[var(--ink-muted)] border-[var(--line)]";
  }
}

export function getPriorityBadgeColor(priority: string): string {
  switch (priority) {
    case "HIGH":
      return "bg-rose-500/15 text-rose-300 border-rose-400/30";
    case "MEDIUM":
      return "bg-amber-500/15 text-amber-300 border-amber-400/30";
    case "LOW":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-400/30";
    default:
      return "bg-white/5 text-[var(--ink-muted)] border-[var(--line)]";
  }
}

export function getLandCoverColor(className: string): string {
  switch (className) {
    case "forest": return "#3dba78";
    case "crop": return "#e2b45c";
    case "water": return "#5ec4c8";
    case "building": return "#c45a32";
    case "bare_land": return "#c4843a";
    case "grassland": return "#6fd392";
    case "road": return "#8fa897";
    default: return "#9fb3a4";
  }
}
