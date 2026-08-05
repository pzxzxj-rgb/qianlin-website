import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Travel site",
  description: "A tenant-ready travel website.",
  alternates: { canonical: "/" },
  openGraph: { title: "Travel site", description: "A tenant-ready travel website.", type: "website", url: siteUrl, images: [{ url: "/og.png", width: 1792, height: 944, alt: "Travel website visual" }] },
  twitter: { card: "summary_large_image", title: "Travel site", description: "A tenant-ready travel website.", images: ["/og.png"] },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
