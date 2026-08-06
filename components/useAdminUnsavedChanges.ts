"use client";

import { useEffect, useRef } from "react";

export function confirmAdminNavigation(isDirty: boolean, message: string) {
  return !isDirty || window.confirm(message);
}

export function useAdminUnsavedChanges(isDirty: boolean, message: string) {
  const guardRef = useRef<{ url: string; id: string } | null>(null);

  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) {
      const guard = guardRef.current;
      guardRef.current = null;
      if (guard && window.location.href === guard.url && window.history.state?.adminUnsavedGuardId === guard.id) window.history.back();
      return;
    }
    if (!guardRef.current) {
      const guardedUrl = window.location.href;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      window.history.pushState({ ...window.history.state, adminUnsavedGuard: true, adminUnsavedGuardId: id }, "", guardedUrl);
      guardRef.current = { url: guardedUrl, id };
    }
    const handlePopState = () => {
      const guard = guardRef.current;
      if (!guard) return;
      if (window.confirm(message)) {
        guardRef.current = null;
        window.history.back();
      } else {
        window.history.pushState({ ...window.history.state, adminUnsavedGuard: true, adminUnsavedGuardId: guard.id }, "", guard.url);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isDirty, message]);
}
