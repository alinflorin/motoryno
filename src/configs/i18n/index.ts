import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import i18n, { type LanguageDetectorAsyncModule } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { defaultLanguage, resources, supportedLanguages, type SupportedLanguage } from './resources';

const LANGUAGE_STORAGE_KEY = 'motoryno.language';

function isSupportedLanguage(value: string | null | undefined): value is SupportedLanguage {
  return !!value && (supportedLanguages as readonly string[]).includes(value);
}

function detectDeviceLanguage(): SupportedLanguage {
  const deviceLanguageCode = Localization.getLocales()[0]?.languageCode;
  return isSupportedLanguage(deviceLanguageCode) ? deviceLanguageCode : defaultLanguage;
}

// Resolves the app language on startup: a language the user explicitly
// picked in Settings (persisted below) wins, otherwise fall back to
// whatever the device is set to.
const languageDetector: LanguageDetectorAsyncModule = {
  type: 'languageDetector',
  async: true,
  init: () => {},
  detect: async (callback) => {
    try {
      const storedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      callback(isSupportedLanguage(storedLanguage) ? storedLanguage : detectDeviceLanguage());
    } catch {
      callback(detectDeviceLanguage());
    }
  },
  cacheUserLanguage: async (language) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // Non-fatal: the language just won't be remembered across restarts.
    }
  },
};

// i18next's default export doubles as its own named exports for CJS/ESM
// interop, which trips this rule as a false positive on `.use`/`.changeLanguage`.
/* eslint-disable import/no-named-as-default-member */
void i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources,
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
