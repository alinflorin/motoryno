import * as Localization from 'expo-localization';

import en from './locales/en.json';
import ro from './locales/ro.json';

export const resources = {
  en: { translation: en },
  ro: { translation: ro },
} as const;

export const supportedLanguages = Object.keys(resources) as (keyof typeof resources)[];

export type SupportedLanguage = keyof typeof resources;

export const defaultLanguage: SupportedLanguage = 'en';

export function isSupportedLanguage(value: string | null | undefined): value is SupportedLanguage {
  return !!value && (supportedLanguages as readonly string[]).includes(value);
}

/** Used only where nothing has been persisted yet: a fresh install's default settings, and i18next's synchronous init before storage has loaded. */
export function detectDeviceLanguage(): SupportedLanguage {
  const deviceLanguageCode = Localization.getLocales()[0]?.languageCode;
  return isSupportedLanguage(deviceLanguageCode) ? deviceLanguageCode : defaultLanguage;
}

// Augment i18next's types so `t('car.nickname')` is autocompleted and
// typo'd/missing keys are compile errors.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: (typeof resources)['en'];
  }
}
