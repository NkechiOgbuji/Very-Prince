export type Locale = 'en' | 'es' | 'ja';

export const defaultLocale: Locale = 'en';

export const locales: Locale[] = ['en', 'es', 'ja'];

export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}
