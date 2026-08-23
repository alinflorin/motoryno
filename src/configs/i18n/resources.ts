import en from './locales/en.json';
import ro from './locales/ro.json';

export const resources = {
  en: { translation: en },
  ro: { translation: ro },
} as const;

export const supportedLanguages = Object.keys(resources) as (keyof typeof resources)[];

export type SupportedLanguage = keyof typeof resources;

export const defaultLanguage: SupportedLanguage = 'en';

// Augment i18next's types so `t('car.nickname')` is autocompleted and
// typo'd/missing keys are compile errors.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: (typeof resources)['en'];
  }
}
