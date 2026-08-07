import type { Metadata } from "next";
import "./globals.css";
import { getSiteUrl } from "../lib/siteUrl";

const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() ? getSiteUrl({ strict: false }) : undefined;
const defaultTitle = "黔林旅行社｜贵州定制旅行";
const defaultDescription = "黔林旅行社专注贵州目的地旅行，为你规划轻松、清晰、值得回味的旅程。";

export const metadata: Metadata = {
  ...(configuredSiteUrl ? { metadataBase: new URL(configuredSiteUrl) } : {}),
  title: defaultTitle,
  description: defaultDescription,
  ...(configuredSiteUrl ? { alternates: { canonical: "/" } } : {}),
  openGraph: { title: defaultTitle, description: defaultDescription, type: "website", ...(configuredSiteUrl ? { url: configuredSiteUrl } : {}), images: [{ url: "/og.png", width: 1792, height: 944, alt: "黔林旅行社贵州旅行视觉图" }] },
  twitter: { card: "summary_large_image", title: defaultTitle, description: defaultDescription, images: ["/og.png"] },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
