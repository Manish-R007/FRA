"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getStoredToken, getStoredUser } from "@/lib/auth";
import { canAccessPath } from "@/lib/rbac";

export default function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const user = getStoredUser();
    const token = getStoredToken();
    if (pathname === "/login") return;
    if (!user || !token) {
      router.replace("/login");
      return;
    }
    if (!canAccessPath(user.role, pathname)) {
      router.replace("/");
    }
  }, [pathname, router]);

  return <>{children}</>;
}
