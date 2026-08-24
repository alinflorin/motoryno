import type { Car, ServiceVisit, TrackedServiceItem } from '@/storage/types';

export type ServiceItemStatus = 'overdue' | 'due-soon' | 'ok';

/** Progress past this fraction of an item's interval counts as "due soon". */
const DUE_SOON_THRESHOLD = 0.85;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface TrackedItemStatus {
  item: TrackedServiceItem;
  status: ServiceItemStatus;
  /** 0..1+ fraction of the interval elapsed since the last visit (or since always, if never serviced). Clamped to 1 for display. */
  progress: number;
  /** The most recent service visit that performed this item, if any. */
  lastVisit: ServiceVisit | null;
}

function findLastVisitForItem(car: Car, itemName: string): ServiceVisit | null {
  let last: ServiceVisit | null = null;
  for (const visit of car.serviceVisits) {
    if (!visit.itemsDone.includes(itemName)) continue;
    if (!last || visit.timestamp > last.timestamp) last = visit;
  }
  return last;
}

/** How far along `item` is towards being due on `car`, based on its stored km/time intervals. */
export function computeTrackedItemStatus(item: TrackedServiceItem, car: Car, now = Date.now()): TrackedItemStatus {
  const lastVisit = findLastVisitForItem(car, item.name);

  if (item.timeIntervalDays == null && item.kmInterval == null) {
    // No interval configured — nothing to be overdue against.
    return { item, status: 'ok', progress: 0, lastVisit };
  }

  let progress = 0;
  if (item.timeIntervalDays != null) {
    const daysSince = lastVisit ? (now - lastVisit.timestamp) / MS_PER_DAY : Infinity;
    progress = Math.max(progress, daysSince / item.timeIntervalDays);
  }
  if (item.kmInterval != null) {
    const kmSince = lastVisit ? car.odometerKm - lastVisit.odometerKm : Infinity;
    progress = Math.max(progress, kmSince / item.kmInterval);
  }

  const status: ServiceItemStatus = progress >= 1 ? 'overdue' : progress >= DUE_SOON_THRESHOLD ? 'due-soon' : 'ok';
  return { item, status, progress: Math.min(progress, 1), lastVisit };
}

/** Statuses for the car's currently-active tracked items — inactive items aren't due/overdue against anything. */
export function computeCarItemStatuses(car: Car, now = Date.now()): TrackedItemStatus[] {
  return car.trackedServiceItems.filter((item) => item.isActive).map((item) => computeTrackedItemStatus(item, car, now));
}

export function getOverdueItemsForCar(car: Car, now = Date.now()): TrackedItemStatus[] {
  return computeCarItemStatuses(car, now).filter((entry) => entry.status === 'overdue');
}

export function getOverdueCountForCar(car: Car, now = Date.now()): number {
  return getOverdueItemsForCar(car, now).length;
}

function pluralMonths(months: number): string {
  return `${months}mo`;
}

/** e.g. "12mo or 10,000 km", "60mo", "10,000 km", or "—" if neither is set. */
export function formatIntervalLabel(item: TrackedServiceItem): string {
  const parts: string[] = [];
  if (item.timeIntervalDays != null) {
    parts.push(pluralMonths(Math.round((item.timeIntervalDays / 365) * 12)));
  }
  if (item.kmInterval != null) {
    parts.push(`${item.kmInterval.toLocaleString()} km`);
  }
  return parts.length > 0 ? parts.join(' or ') : '—';
}

/** e.g. "+10,503 km · 24mo ago", "29mo ago", or "Never serviced". */
export function formatSinceLabel(entry: TrackedItemStatus, car: Car, now = Date.now()): string {
  const { item, lastVisit } = entry;
  if (!lastVisit) return 'Never serviced';

  const parts: string[] = [];
  if (item.kmInterval != null) {
    const deltaKm = car.odometerKm - lastVisit.odometerKm;
    parts.push(`${deltaKm >= 0 ? '+' : ''}${deltaKm.toLocaleString()} km`);
  }
  if (item.timeIntervalDays != null) {
    const deltaMonths = Math.round(((now - lastVisit.timestamp) / MS_PER_DAY / 365) * 12);
    parts.push(`${deltaMonths}mo ago`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'Recently serviced';
}
