"use client";

import { useEffect } from "react";

export function confirmAdminNavigation(isDirty: boolean, message: string) {
  return !isDirty || window.confirm(message);
}

export function useAdminUnsavedChanges(isDirty: boolean, message: string) {
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
    if (!isDirty) return;
    const guardedUrl = window.location.href;
    let allowNavigation = false;
    window.history.pushState({ ...window.history.state, adminUnsavedGuard: true }, "", guardedUrl);
    const handlePopState = () => {
      if (allowNavigation) return;
      if (window.confirm(message)) {
        allowNavigation = true;
        window.history.back();
      } else {
        window.history.pushState({ ...window.history.state, adminUnsavedGuard: true }, "", guardedUrl);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isDirty, message]);
}
