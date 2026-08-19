"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function AdminLoginForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: formData.get("username"), password: formData.get("password") }),
      });
      const result: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(isRecord(result) && typeof result.errorZh === "string" ? result.errorZh : "登录失败，请稍后重试。");
      router.replace("/admin");
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error && requestError.message ? requestError.message : "登录失败，请稍后重试。");
    } finally {
      setPending(false);
    }
  }

  return <form className="admin-login-form" onSubmit={handleSubmit}>
    <label htmlFor="admin-username">管理员账号<input id="admin-username" name="username" type="text" autoComplete="username" maxLength={120} required /></label>
    <label htmlFor="admin-password">管理员密码<input id="admin-password" name="password" type="password" autoComplete="current-password" maxLength={512} required /></label>
    {error ? <p className="admin-form-error" role="alert">{error}</p> : null}
    <button className="button button-dark admin-submit" type="submit" disabled={pending}>{pending ? "登录中…" : "登录后台"}</button>
  </form>;
}
