import { UserRole } from "./types";

const ALL_ROLES: UserRole[] = [
  "ADMIN",
  "STATE_OFFICER",
  "DISTRICT_OFFICER",
  "FIELD_OFFICER",
  "ANALYST",
  "CITIZEN",
];

/** Route prefixes allowed per RBAC matrix (README). Citizen: own claims, atlas, DSS recs — not audit, monitoring, or scheme catalog. */
export const ROUTE_ACCESS: { prefix: string; roles: UserRole[] }[] = [
  { prefix: "/login", roles: ALL_ROLES },
  { prefix: "/documents/verify", roles: ["ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER", "FIELD_OFFICER", "ANALYST"] },
  { prefix: "/audit", roles: ["ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER", "ANALYST"] },
  { prefix: "/monitoring", roles: ["ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER", "FIELD_OFFICER", "ANALYST"] },
  { prefix: "/schemes", roles: ["ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER", "FIELD_OFFICER", "ANALYST"] },
  { prefix: "/dss", roles: ALL_ROLES },
  { prefix: "/claims", roles: ALL_ROLES },
  { prefix: "/atlas", roles: ALL_ROLES },
  { prefix: "/", roles: ALL_ROLES },
];

export function canAccessPath(role: UserRole | undefined | null, pathname: string): boolean {
  if (!role) return true;
  const rule = ROUTE_ACCESS.find((item) =>
    item.prefix === "/"
      ? pathname === "/"
      : pathname === item.prefix || pathname.startsWith(`${item.prefix}/`)
  );
  if (!rule) return true;
  return rule.roles.includes(role);
}

export function canSeeAudit(role?: UserRole | null) {
  return !!role && ["ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER", "ANALYST"].includes(role);
}

export function canMutateClaims(role?: UserRole | null) {
  return !!role && ["ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER", "FIELD_OFFICER"].includes(role);
}

export function canApproveTitles(role?: UserRole | null) {
  return !!role && ["ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"].includes(role);
}

export function canRunSatellite(role?: UserRole | null) {
  return !!role && ["ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER", "ANALYST"].includes(role);
}

export function canPurgeData(role?: UserRole | null) {
  return role === "ADMIN";
}
