import { Locale } from './i18n';
import enDictionary from '@/dictionaries/en.json';
import esDictionary from '@/dictionaries/es.json';
import jaDictionary from '@/dictionaries/ja.json';

const dictionaries = {
  en: enDictionary,
  es: esDictionary,
  ja: jaDictionary,
} as const;

export type Dictionary = typeof dictionaries.en;

export async function getDictionary(locale: Locale = 'en'): Promise<Dictionary> {
  return dictionaries[locale] || dictionaries.en;
}
