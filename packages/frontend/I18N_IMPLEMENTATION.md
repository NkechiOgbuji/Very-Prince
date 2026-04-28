# Internationalization (i18n) Implementation

## Overview

This document explains the internationalization implementation for the very-princess Next.js dashboard. The implementation follows Next.js App Router best practices and uses React Server Components for optimal performance.

## Architecture

### 1. URL Structure
- **Root URL (`/`)**: Redirects to `/en` (default locale)
- **Localized URLs**: `/{lang}/...` where `lang` is one of: `en`, `es`, `ja`
- **Examples**:
  - `/en` - English homepage
  - `/es/dashboard` - Spanish dashboard
  - `/ja/dashboard` - Japanese dashboard

### 2. File Structure

```
src/
├── app/
│   ├── [lang]/              # Dynamic locale routes
│   │   ├── layout.tsx       # Locale-specific layout
│   │   ├── page.tsx         # Localized homepage
│   │   └── dashboard/
│   │       └── page.tsx     # Localized dashboard
│   ├── layout.tsx           # Minimal root layout
│   └── page.tsx             # Root redirect to /en
├── components/
│   └── LanguageSwitcher.tsx # Language switcher component
├── dictionaries/
│   ├── en.json              # English translations
│   ├── es.json              # Spanish translations
│   └── ja.json              # Japanese translations
└── lib/
    ├── i18n.ts              # Locale types and configuration
    └── getDictionary.ts     # Dictionary loading utility
```

## Implementation Details

### 1. Locale Configuration (`src/lib/i18n.ts`)

```typescript
export type Locale = 'en' | 'es' | 'ja';
export const defaultLocale: Locale = 'en';
export const locales: Locale[] = ['en', 'es', 'ja'];
export function isValidLocale(locale: string): locale is Locale
```

### 2. Dictionary Structure

Each dictionary file contains nested translation keys organized by feature:

```json
{
  "common": {
    "loading": "Loading...",
    "dashboard": "Dashboard"
  },
  "navigation": {
    "dashboard": "Dashboard",
    "github": "View on GitHub"
  },
  "home": {
    "title": "very-princess — Stellar Payout Registry",
    "hero_title": "Open Source"
  },
  "dashboard": {
    "title": "Dashboard",
    "connect_wallet": "Connect Wallet"
  }
}
```

### 3. Dictionary Loading (`src/lib/getDictionary.ts`)

```typescript
import { Locale } from './i18n';
import enDictionary from '@/dictionaries/en.json';
import esDictionary from '@/dictionaries/es.json';
import jaDictionary from '@/dictionaries/ja.json';

export async function getDictionary(locale: Locale = 'en'): Promise<Dictionary> {
  const dictionaries = {
    en: enDictionary,
    es: esDictionary,
    ja: jaDictionary,
  };
  return dictionaries[locale] || dictionaries.en;
}
```

### 4. Language Switcher Component

The `LanguageSwitcher` component:
- Displays current language with flag emoji
- Provides dropdown to switch languages
- Maintains current path when switching languages
- Updates URL to new locale

### 5. Page Implementation Pattern

Pages follow this pattern:

```typescript
interface PageProps {
  params: { lang: Locale };
}

export default async function Page({ params }: PageProps) {
  const dictionary = await getDictionary(params.lang);
  
  return (
    <div>
      <h1>{dictionary.home.title}</h1>
      <p>{dictionary.home.description}</p>
    </div>
  );
}
```

## Usage Instructions

### 1. Development Setup

```bash
cd packages/frontend
npm install
npm run dev
```

### 2. Testing the Implementation

1. **Homepage Testing**:
   - Visit `http://localhost:3000` → redirects to `/en`
   - Visit `http://localhost:3000/es` → Spanish homepage
   - Visit `http://localhost:3000/ja` → Japanese homepage

2. **Dashboard Testing**:
   - Visit `http://localhost:3000/en/dashboard` → English dashboard
   - Visit `http://localhost:3000/es/dashboard` → Spanish dashboard
   - Visit `http://localhost:3000/ja/dashboard` → Japanese dashboard

3. **Language Switcher Testing**:
   - Click the language dropdown in the navigation
   - Select a different language
   - Verify the URL updates and content translates

### 3. Adding New Translations

1. **Add to all dictionary files**:
   ```json
   // src/dictionaries/en.json
   {
     "new_feature": {
       "title": "New Feature",
       "description": "Description of new feature"
     }
   }
   
   // src/dictionaries/es.json
   {
     "new_feature": {
       "title": "Nueva Característica",
       "description": "Descripción de la nueva característica"
     }
   }
   ```

2. **Use in components**:
   ```typescript
   const dictionary = await getDictionary(params.lang);
   return <h1>{dictionary.new_feature.title}</h1>;
   ```

### 4. Adding New Languages

1. **Update locale configuration**:
   ```typescript
   // src/lib/i18n.ts
   export type Locale = 'en' | 'es' | 'ja' | 'fr'; // Add 'fr'
   export const locales: Locale[] = ['en', 'es', 'ja', 'fr']; // Add 'fr'
   ```

2. **Create dictionary file**:
   ```json
   // src/dictionaries/fr.json
   {
     "common": { "loading": "Chargement..." },
     // ... all translations
   }
   ```

3. **Update getDictionary utility**:
   ```typescript
   // src/lib/getDictionary.ts
   import frDictionary from '@/dictionaries/fr.json';
   const dictionaries = { en: enDictionary, es: esDictionary, ja: jaDictionary, fr: frDictionary };
   ```

## Technical Benefits

1. **Server-Side Rendering**: Translations are loaded on the server, providing fast initial page loads
2. **SEO Optimized**: Each language has its own URL structure
3. **Minimal Client Bundle**: No heavy i18n libraries needed
4. **Type Safety**: Full TypeScript support for translation keys
5. **Scalable**: Easy to add new languages and features

## Migration Notes

- Original hardcoded strings have been extracted to dictionaries
- URL structure changed from `/dashboard` to `/en/dashboard`
- Root page now redirects to default locale
- All pages now receive `lang` parameter and load appropriate translations

## Future Enhancements

1. **Locale Detection**: Automatically detect user's preferred language from browser
2. **RTL Support**: Add support for right-to-left languages
3. **Pluralization**: Implement pluralization rules for different languages
4. **Date/Number Formatting**: Add locale-specific formatting
5. **Missing Key Detection**: Add development warnings for missing translations
