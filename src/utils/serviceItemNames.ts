import type { TFunction } from 'i18next';

import { DEFAULT_TRACKED_SERVICE_ITEMS } from '@/storage/defaultData';

/** Canonical (English, as stored) names of the presets seeded onto every new car. */
const DEFAULT_ITEM_NAMES = new Set(DEFAULT_TRACKED_SERVICE_ITEMS.map((item) => item.name));

/**
 * Display name for a tracked item. Default presets (seeded from `DEFAULT_TRACKED_SERVICE_ITEMS`)
 * are looked up in the `defaultServiceItems` i18n namespace by their canonical English name and
 * translated; a user-added custom item isn't in that set, so its name passes through unchanged —
 * there's nothing to translate it against.
 */
export function translateItemName(t: TFunction, name: string): string {
  if (!DEFAULT_ITEM_NAMES.has(name)) return name;
  return t(`defaultServiceItems.${name}`, { defaultValue: name });
}
