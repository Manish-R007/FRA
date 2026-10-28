"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { clearAuthSession, getStoredToken, getStoredUser, setAuthSession } from "@/lib/auth";
import { canAccessPath } from "@/lib/rbac";

export default function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authorizedPath, setAuthorizedPath] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const user = getStoredUser();
    const token = getStoredToken();

    setAuthorizedPath(null);
    setAuthError(null);
    if (pathname === "/login") return () => { cancelled = true; };

    if (!user || !token) {
      router.replace("/login");
      return () => { cancelled = true; };
    }

    // Do not mount protected pages until the backend confirms the saved token.
    // Their effects otherwise run immediately and generate unauthenticated API calls.
    void api.getMe().then((currentUser) => {
      if (cancelled) return;
      setAuthSession(token, currentUser);
      if (!canAccessPath(currentUser.role, pathname)) {
        router.replace("/");
        return;
      }
      setAuthorizedPath(pathname);
    }).catch((error: unknown) => {
      if (cancelled) return;
      const message = error instanceof Error ? error.message : "Unable to verify your session";
      if (/not authenticated|validate credentials|invalid token/i.test(message)) {
        clearAuthSession();
        router.replace("/login");
        return;
      }
      setAuthError(message);
    });

    return () => { cancelled = true; };
  }, [pathname, router]);

  if (pathname === "/login" || authorizedPath === pathname) return <>{children}</>;
  if (authError) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
        <p role="alert">Could not verify your sign-in: {authError}</p>
        <button className="btn-gold" onClick={() => window.location.reload()}>Try again</button>
      </div>
    );
  }
  return null;
}
