import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { defaultLanguage, resources, supportedLanguages, type SupportedLanguage } from './resources';

function isSupportedLanguage(value: string | null | undefined): value is SupportedLanguage {
  return !!value && (supportedLanguages as readonly string[]).includes(value);
}

function detectDeviceLanguage(): SupportedLanguage {
  const deviceLanguageCode = Localization.getLocales()[0]?.languageCode;
  return isSupportedLanguage(deviceLanguageCode) ? deviceLanguageCode : defaultLanguage;
}

// TODO: once the SQLite Settings table is wired up, resolve/persist the
// user's chosen language there instead of always falling back to the device.

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

export { defaultLanguage, supportedLanguages, type SupportedLanguage };
export default i18n;
