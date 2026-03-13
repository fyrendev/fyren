import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { getDefaultOrg } from "../lib/api";

const inter = Inter({ subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  try {
    const { organization } = await getDefaultOrg();
    const iconUrl = organization.faviconUrl || organization.logoUrl;

    return {
      title: `${organization.name} Status`,
      description: `System status and incident updates for ${organization.name}`,
      ...(iconUrl ? { icons: { icon: iconUrl } } : {}),
    };
  } catch {
    return {
      title: "Status",
      description: "System status and incident updates",
    };
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
