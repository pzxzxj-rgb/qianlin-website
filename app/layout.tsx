import type { Metadata } from "next";
import { company } from "../data/siteConfig";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const phone = company.contact.channels.find((channel) => channel.key === "phone")?.value ?? "";
const email = company.contact.channels.find((channel) => channel.key === "email")?.value ?? "";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "黔林旅行社｜贵州旅游咨询与定制行程",
  description: "黔林旅行社提供贵州旅游咨询、私人行程规划和本地旅行服务，帮助游客根据时间、人数和兴趣定制贵州旅程。",
  alternates: { canonical: "/" },
  openGraph: {
    title: "黔林旅行社｜贵州旅游咨询与定制行程",
    description: "黔林旅行社提供贵州旅游咨询、私人行程规划和本地旅行服务，帮助游客根据时间、人数和兴趣定制贵州旅程。",
    type: "website",
    url: siteUrl,
    images: [{ url: "/og.png", width: 1792, height: 944, alt: "黔林旅行社贵州旅游主题视觉图" }],
  },
  twitter: { card: "summary_large_image", title: "黔林旅行社｜贵州旅游咨询与定制行程", description: "黔林旅行社提供贵州旅游咨询、私人行程规划和本地旅行服务。", images: ["/og.png"] },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "TravelAgency",
  name: company.nameZh,
  alternateName: company.name,
  description: "黔林旅行社提供贵州旅游咨询、私人行程规划和本地旅行服务，帮助游客根据时间、人数和兴趣定制贵州旅程。",
  url: siteUrl,
  telephone: phone ? `+86${phone}` : undefined,
  email,
  address: { "@type": "PostalAddress", addressCountry: "CN", addressLocality: "贵阳市", addressRegion: "贵州省", streetAddress: company.address },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />{children}</body></html>;
}
