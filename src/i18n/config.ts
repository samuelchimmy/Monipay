import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';
import enTranslation from '../../public/locales/en/translation.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'fr', label: 'Français', dir: 'ltr' },
  { code: 'ar', label: 'العربية', dir: 'rtl' },
  { code: 'es', label: 'Español', dir: 'ltr' },
  { code: 'ja', label: '日本語', dir: 'ltr' },
  { code: 'zh', label: '中文', dir: 'ltr' },
  { code: 'ru', label: 'Русский', dir: 'ltr' },
  { code: 'pt', label: 'Português', dir: 'ltr' },
] as const;

export type SupportedLanguageCode = typeof SUPPORTED_LANGUAGES[number]['code'];

const RTL_LANGUAGES: string[] = ['ar'];

export function isRTL(lang: string): boolean {
  return RTL_LANGUAGES.includes(lang);
}

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES.map(l => l.code),
    interpolation: { escapeValue: false },
    resources: {
      en: {
        translation: enTranslation
      }
    },
    backend: {
      loadPath: '/locales/{{lng}}/translation.json',
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'monipay_language',
    },
  });

/**
 * Geo-based language detection.
 * Runs only when the user has NOT explicitly chosen a language yet
 * (no `monipay_language` in localStorage). Maps the visitor's country
 * to one of our supported languages via a free IP geolocation API.
 * Falls back silently to navigator detection on any failure.
 */
const COUNTRY_TO_LANG: Record<string, SupportedLanguageCode> = {
  // French-speaking
  FR: 'fr', BE: 'fr', LU: 'fr', MC: 'fr', CI: 'fr', SN: 'fr', CM: 'fr',
  ML: 'fr', BF: 'fr', NE: 'fr', TG: 'fr', BJ: 'fr', GA: 'fr', CG: 'fr',
  CD: 'fr', MG: 'fr', HT: 'fr', DZ: 'fr', TN: 'fr', MA: 'fr',
  // Arabic
  SA: 'ar', AE: 'ar', EG: 'ar', QA: 'ar', KW: 'ar', BH: 'ar', OM: 'ar',
  JO: 'ar', LB: 'ar', IQ: 'ar', SY: 'ar', YE: 'ar', LY: 'ar', SD: 'ar',
  PS: 'ar',
  // Spanish
  ES: 'es', MX: 'es', AR: 'es', CO: 'es', CL: 'es', PE: 'es', VE: 'es',
  EC: 'es', GT: 'es', CU: 'es', BO: 'es', DO: 'es', HN: 'es', PY: 'es',
  SV: 'es', NI: 'es', CR: 'es', PA: 'es', UY: 'es', PR: 'es',
  // Portuguese
  PT: 'pt', BR: 'pt', AO: 'pt', MZ: 'pt', CV: 'pt',
  // Japanese
  JP: 'ja',
  // Chinese
  CN: 'zh', TW: 'zh', HK: 'zh', SG: 'zh', MO: 'zh',
  // Russian
  RU: 'ru', BY: 'ru', KZ: 'ru', KG: 'ru', UZ: 'ru', TJ: 'ru', AM: 'ru',
};

async function detectLanguageByGeo() {
  if (typeof window === 'undefined') return;
  try {
    const alreadyChosen = window.localStorage.getItem('monipay_language');
    if (alreadyChosen) return;
  } catch { return; }

  const endpoints = [
    'https://get.geojs.io/v1/ip/country.json',
    'https://ipapi.co/json/',
  ];

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const data = await res.json();
      const country: string | undefined =
        (data?.country || data?.country_code || '').toString().toUpperCase();
      if (!country) continue;
      const mapped = COUNTRY_TO_LANG[country];
      if (mapped && mapped !== i18n.language) {
        await i18n.changeLanguage(mapped);
      }
      return;
    } catch {
      // try next endpoint
    }
  }
}

// Kick off after init resolves so it doesn't block first render.
i18n.on('initialized', () => {
  // Defer slightly to let the app paint first.
  setTimeout(() => { void detectLanguageByGeo(); }, 250);
});

export default i18n;
