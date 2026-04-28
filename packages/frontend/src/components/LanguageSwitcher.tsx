"use client";

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Locale, defaultLocale, locales } from '@/lib/i18n';

interface LanguageSwitcherProps {
  currentLocale: Locale;
}

export function LanguageSwitcher({ currentLocale }: LanguageSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const handleLanguageChange = (newLocale: Locale) => {
    // Extract the current path without the locale
    const pathSegments = pathname.split('/').filter(Boolean);
    
    // Remove the current locale if it exists
    if (locales.includes(pathSegments[0] as Locale)) {
      pathSegments.shift();
    }
    
    // Build the new path with the new locale
    const newPath = `/${newLocale}${pathSegments.length > 0 ? '/' + pathSegments.join('/') : ''}`;
    
    router.push(newPath);
    setIsOpen(false);
  };

  const languageNames = {
    en: 'English',
    es: 'Español',
    ja: '日本語',
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white/80 transition-all duration-200 hover:border-white/30 hover:bg-white/10 hover:text-white"
        aria-label="Select language"
      >
        <span className="text-lg">{currentLocale === 'en' ? '🇬🇧' : currentLocale === 'es' ? '🇪🇸' : '🇯🇵'}</span>
        <span>{languageNames[currentLocale]}</span>
        <svg
          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-48 rounded-lg border border-white/15 bg-stellar-blue/95 backdrop-blur-xl shadow-lg">
          <div className="py-1">
            {locales.map((locale) => (
              <button
                key={locale}
                onClick={() => handleLanguageChange(locale)}
                className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors ${
                  locale === currentLocale
                    ? 'bg-stellar-purple/20 text-stellar-purple'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="text-lg">
                  {locale === 'en' ? '🇬🇧' : locale === 'es' ? '🇪🇸' : '🇯🇵'}
                </span>
                <span>{languageNames[locale]}</span>
                {locale === currentLocale && (
                  <svg className="ml-auto h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
