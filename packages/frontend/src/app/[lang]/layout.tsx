import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Locale, defaultLocale } from "@/lib/i18n";
import { getDictionary } from "@/lib/getDictionary";
import type { Dictionary } from "@/lib/getDictionary";
import "../globals.css";

// ── Font Loading ──────────────────────────────────────────────────────────────

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

// ── Layout Types ─────────────────────────────────────────────────────────────

export interface LocaleLayoutProps {
  children: React.ReactNode;
  params: {
    lang: Locale;
  };
}

// ── SEO Metadata ──────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: LocaleLayoutProps): Promise<Metadata> {
  const dictionary = await getDictionary(params.lang);

  return {
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
    ),
    title: {
      template: "%s | very-princess",
      default: dictionary.home.title,
    },
    description: dictionary.home.description,
    keywords: ["Stellar", "Soroban", "DeFi", "Open Source", "Drips", "Payouts"],
    openGraph: {
      siteName: "very-princess",
      title: dictionary.home.title,
      description: dictionary.home.description,
      type: "website",
      locale: params.lang === 'en' ? 'en_US' : params.lang === 'es' ? 'es_ES' : 'ja_JP',
    },
    twitter: {
      card: "summary_large_image",
      title: dictionary.home.title,
      description: dictionary.home.description,
    },
  };
}

// ── Layout Component ───────────────────────────────────────────────────────────

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const dictionary = await getDictionary(params.lang);

  return (
    <html lang={params.lang} className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-stellar-blue font-sans text-white antialiased">
        {/* Starfield ambient background */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 bg-hero-pattern"
        />
        {/* Page content */}
        <div className="relative">{children}</div>
        
        {/* Toast notifications */}
        <Toaster
          position="top-right"
          expand={false}
          richColors
          closeButton
          theme="dark"
          toastOptions={{
            style: {
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: 'white',
            },
          }}
        />
      </body>
    </html>
  );
}
