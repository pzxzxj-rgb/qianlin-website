import type { Metadata } from "next";
import { company } from "../data/siteConfig";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: `${company.name} | Discover Guizhou, Your Way`,
  description: company.description.en,
  openGraph: {
    title: `${company.name} | Discover Guizhou, Your Way`,
    description: "Explore breathtaking landscapes, unique cultures and unforgettable journeys with a local Guizhou travel team.",
    type: "website",
    images: [{ url: "/og.png", width: 1792, height: 944, alt: `Discover Guizhou, Your Way — ${company.name}` }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${company.name} | Discover Guizhou, Your Way`,
    description: "Thoughtful journeys through the landscapes of Guizhou.",
    images: ["/og.png"],
  },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
