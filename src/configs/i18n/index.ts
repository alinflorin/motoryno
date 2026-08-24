import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import {
  defaultLanguage,
  detectDeviceLanguage,
  isSupportedLanguage,
  resources,
  supportedLanguages,
  type SupportedLanguage,
} from './resources';

// The device language is only a placeholder for the brief window before the
// persisted settings have loaded (StorageProvider calls syncLanguageFromSettings
// once they have, which is the actual source of truth thereafter).

// i18next's default export doubles as its own named exports for CJS/ESM
// interop, which trips this rule as a false positive on `.use`/`.changeLanguage`.
/* eslint-disable import/no-named-as-default-member */
void i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: detectDeviceLanguage(),
    fallbackLng: defaultLanguage,
    supportedLngs: supportedLanguages,
    interpolation: {
      escapeValue: false, // React already escapes rendered output
    },
  });

/** Call from the Settings screen when the user manually picks a language. */
export function setLanguage(language: SupportedLanguage) {
  return i18n.changeLanguage(language);
}

/**
 * Call once persisted settings have loaded to align i18next with the user's
 * stored choice (falls back to the already-active device-detected language
 * if the stored value isn't a supported/known one).
 */
export function syncLanguageFromSettings(language: string) {
  if (isSupportedLanguage(language) && language !== i18n.language) {
    return setLanguage(language);
  }
  return undefined;
}

export { defaultLanguage, supportedLanguages, type SupportedLanguage };
export default i18n;
