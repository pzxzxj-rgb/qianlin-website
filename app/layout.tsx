import type { Metadata } from "next";
import "./globals.css";
import { getSiteUrl } from "../lib/siteUrl";

const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() ? getSiteUrl({ strict: false }) : undefined;

export const metadata: Metadata = {
  ...(configuredSiteUrl ? { metadataBase: new URL(configuredSiteUrl) } : {}),
  title: "Travel site",
  description: "A tenant-ready travel website.",
  alternates: { canonical: "/" },
  openGraph: { title: "Travel site", description: "A tenant-ready travel website.", type: "website", ...(configuredSiteUrl ? { url: configuredSiteUrl } : {}), images: [{ url: "/og.png", width: 1792, height: 944, alt: "Travel website visual" }] },
  twitter: { card: "summary_large_image", title: "Travel site", description: "A tenant-ready travel website.", images: ["/og.png"] },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
