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
      return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
    case "PENDING_VERIFICATION":
    case "FIELD_VERIFICATION":
      return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
    case "GIS_VALIDATED":
    case "SATELLITE_ANALYZE":
      return "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30";
    case "REJECTED":
      return "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30";
    case "FLAGGED":
      return "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 animate-pulse";
    default:
      return "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30";
  }
}

export function getPriorityBadgeColor(priority: string): string {
  switch (priority) {
    case "HIGH":
      return "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30";
    case "MEDIUM":
      return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
    case "LOW":
      return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
    default:
      return "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30";
  }
}

export function getLandCoverColor(className: string): string {
  switch (className) {
    case "forest":
      return "#15803d"; // Dark green
    case "crop":
      return "#84cc16"; // Lime green
    case "water":
      return "#0284c7"; // Blue
    case "building":
      return "#dc2626"; // Red
    case "bare_land":
      return "#d97706"; // Amber
    case "grassland":
      return "#10b981"; // Emerald
    case "road":
      return "#64748b"; // Slate
    default:
      return "#94a3b8"; // Light slate
  }
}
