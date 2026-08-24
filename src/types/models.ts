export type DistanceUnit = 'km' | 'mi';

export type ServiceItemStatus = 'overdue' | 'due-soon' | 'ok';

export interface Car {
  id: string;
  vin: string;
  nickname: string;
  make: string;
  model: string;
  year: number;
  odometer: number;
  unit: DistanceUnit;
}

export interface TrackedItem {
  id: string;
  carId: string;
  name: string;
  intervalLabel: string;
  sinceLabel: string;
  status: ServiceItemStatus;
  /** 0..1 progress towards the next interval, for display only. */
  progress: number;
  active: boolean;
}

export interface ServiceVisit {
  id: string;
  carId: string;
  shopName: string;
  dateLabel: string;
  odometer: number;
  price: number;
  currency: string;
  itemNames: string[];
}

export interface OverdueAlert {
  id: string;
  carId: string;
  carNickname: string;
  itemName: string;
}
