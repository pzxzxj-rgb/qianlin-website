export type AppEnvironment =
  | "development"
  | "test"
  | "production";

const APP_ENVIRONMENTS = new Set<AppEnvironment>([
  "development",
  "test",
  "production",
]);

async function readWorkerBinding(name: string) {
  try {
    const { env } = await import("cloudflare:workers");
    const value = (env as unknown as Record<string, unknown>)[name];
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  } catch {
    return undefined;
  }
}

export async function getAppEnvironment(): Promise<AppEnvironment> {
  const workerValue = await readWorkerBinding("APP_ENV");
  const processValue = typeof process !== "undefined" ? process.env.APP_ENV?.trim() : undefined;
  const value = (workerValue ?? processValue)?.toLowerCase();

  if (value && APP_ENVIRONMENTS.has(value as AppEnvironment)) {
    return value as AppEnvironment;
  }

  throw new Error("APP_ENV must be explicitly configured.");
}
