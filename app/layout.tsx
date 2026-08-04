import type { Metadata } from "next";
import { company } from "../data/siteConfig";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const phone = company.contact.channels.find((channel) => channel.key === "phone")?.value ?? "";
const email = company.contact.channels.find((channel) => channel.key === "email")?.value ?? "";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: `${company.name} | Discover Guizhou, Your Way`,
  description: company.description.en,
  alternates: { canonical: "/" },
  openGraph: {
    title: `${company.name} | Discover Guizhou, Your Way`,
    description: "Explore breathtaking landscapes, unique cultures and thoughtful journeys with a local Guizhou travel team.",
    type: "website",
    url: siteUrl,
    images: [{ url: "/og.png", width: 1792, height: 944, alt: `Discover Guizhou, Your Way — ${company.name}` }],
  },
  twitter: { card: "summary_large_image", title: `${company.name} | Discover Guizhou, Your Way`, description: "Thoughtful journeys through the landscapes of Guizhou.", images: ["/og.png"] },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "TravelAgency",
  name: company.nameZh,
  alternateName: company.name,
  url: siteUrl,
  telephone: phone ? `+86${phone}` : undefined,
  email,
  address: { "@type": "PostalAddress", addressCountry: "CN", addressLocality: "贵阳市", addressRegion: "贵州省", streetAddress: company.address },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />{children}</body></html>;
}
