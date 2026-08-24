export type DistanceUnit = 'km' | 'mi';

const KM_PER_MILE = 1.60934;

export function distanceUnitFor(useImperialUnits: boolean): DistanceUnit {
  return useImperialUnits ? 'mi' : 'km';
}

/** Cars are always stored in km — convert for display in the user's chosen unit. */
export function kmToDisplay(km: number, unit: DistanceUnit): number {
  return unit === 'mi' ? km / KM_PER_MILE : km;
}

/** Convert a value entered in the user's chosen unit back to km for storage. */
export function displayToKm(value: number, unit: DistanceUnit): number {
  return unit === 'mi' ? value * KM_PER_MILE : value;
}

export function formatDistance(km: number, unit: DistanceUnit): string {
  return Math.round(kmToDisplay(km, unit)).toLocaleString();
}
