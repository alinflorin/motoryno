import type { Car, OverdueAlert, ServiceVisit, TrackedItem } from '@/types/models';

/**
 * Static sample data used to lay out the screens before real storage and
 * calculations are wired up. Every derived-looking value (status, progress,
 * labels) is hardcoded here rather than computed.
 */

export const cars: Car[] = [
  {
    id: 'c1',
    vin: 'WDD2040121F123456',
    nickname: 'C250',
    make: 'Mercedes-Benz',
    model: 'C250 W204',
    year: 2012,
    odometer: 211703,
    unit: 'km',
  },
  {
    id: 'c2',
    vin: 'JTDBR32E720123456',
    nickname: 'Corolla',
    make: 'Toyota',
    model: 'Corolla E21',
    year: 2019,
    odometer: 100720,
    unit: 'km',
  },
];

export const trackedItems: TrackedItem[] = [
  {
    id: 'ti1',
    carId: 'c1',
    name: 'Engine oil',
    intervalLabel: '12mo or 10,000 km',
    sinceLabel: '+10,503 km · 24mo ago',
    status: 'overdue',
    progress: 1,
    active: true,
  },
  {
    id: 'ti2',
    carId: 'c1',
    name: 'Oil filter',
    intervalLabel: '12mo or 10,000 km',
    sinceLabel: '+10,503 km · 24mo ago',
    status: 'overdue',
    progress: 1,
    active: true,
  },
  {
    id: 'ti3',
    carId: 'c1',
    name: 'Air filter',
    intervalLabel: '24mo or 30,000 km',
    sinceLabel: '+36,703 km · 39mo ago',
    status: 'overdue',
    progress: 1,
    active: true,
  },
  {
    id: 'ti4',
    carId: 'c1',
    name: 'Brake fluid',
    intervalLabel: '24mo',
    sinceLabel: '29mo ago',
    status: 'due-soon',
    progress: 0.92,
    active: true,
  },
  {
    id: 'ti5',
    carId: 'c1',
    name: 'Spark plugs',
    intervalLabel: '48mo or 60,000 km',
    sinceLabel: '+61,703 km · 62mo ago',
    status: 'overdue',
    progress: 1,
    active: true,
  },
  {
    id: 'ti6',
    carId: 'c1',
    name: 'Battery',
    intervalLabel: '60mo',
    sinceLabel: '71mo ago',
    status: 'overdue',
    progress: 1,
    active: true,
  },
  {
    id: 'ti7',
    carId: 'c1',
    name: 'Cabin air filter',
    intervalLabel: '12mo or 15,000 km',
    sinceLabel: '+10,503 km · 24mo ago',
    status: 'overdue',
    progress: 1,
    active: true,
  },
  {
    id: 'ti8',
    carId: 'c1',
    name: 'Coolant flush',
    intervalLabel: '36mo',
    sinceLabel: '28mo ago',
    status: 'ok',
    progress: 0.78,
    active: true,
  },
  {
    id: 'ti9',
    carId: 'c2',
    name: 'Engine oil',
    intervalLabel: '12mo or 10,000 km',
    sinceLabel: '+7,220 km · 8mo ago',
    status: 'ok',
    progress: 0.72,
    active: true,
  },
  {
    id: 'ti10',
    carId: 'c2',
    name: 'Oil filter',
    intervalLabel: '12mo or 10,000 km',
    sinceLabel: '+7,220 km · 8mo ago',
    status: 'ok',
    progress: 0.72,
    active: true,
  },
  {
    id: 'ti11',
    carId: 'c2',
    name: 'Air filter',
    intervalLabel: '24mo or 30,000 km',
    sinceLabel: '+25,720 km · 20mo ago',
    status: 'due-soon',
    progress: 0.86,
    active: true,
  },
  {
    id: 'ti12',
    carId: 'c2',
    name: 'Brake fluid',
    intervalLabel: '24mo',
    sinceLabel: '14mo ago',
    status: 'ok',
    progress: 0.58,
    active: true,
  },
];

export const serviceVisits: ServiceVisit[] = [
  {
    id: 'sv1',
    carId: 'c1',
    shopName: 'Lex Auto Service',
    dateLabel: '10.08.2024',
    odometer: 201200,
    price: 350,
    currency: 'RON',
    itemNames: ['Engine oil', 'Oil filter', 'Cabin air filter'],
  },
  {
    id: 'sv2',
    carId: 'c1',
    shopName: 'QuickService Buc',
    dateLabel: '03.03.2024',
    odometer: 195000,
    price: 180,
    currency: 'RON',
    itemNames: ['Brake fluid'],
  },
  {
    id: 'sv3',
    carId: 'c1',
    shopName: 'Auto Clinic MB',
    dateLabel: '20.04.2022',
    odometer: 162000,
    price: 420,
    currency: 'RON',
    itemNames: ['Coolant flush'],
  },
  {
    id: 'sv4',
    carId: 'c2',
    shopName: 'Toyota Service Center',
    dateLabel: '01.12.2024',
    odometer: 93500,
    price: 280,
    currency: 'RON',
    itemNames: ['Engine oil', 'Oil filter'],
  },
];

export const overdueAlerts: OverdueAlert[] = [
  { id: 'c1-ti1', carId: 'c1', carNickname: 'C250', itemName: 'Engine oil' },
  { id: 'c1-ti2', carId: 'c1', carNickname: 'C250', itemName: 'Oil filter' },
  { id: 'c1-ti3', carId: 'c1', carNickname: 'C250', itemName: 'Air filter' },
  { id: 'c1-ti5', carId: 'c1', carNickname: 'C250', itemName: 'Spark plugs' },
  { id: 'c1-ti6', carId: 'c1', carNickname: 'C250', itemName: 'Battery' },
  { id: 'c1-ti7', carId: 'c1', carNickname: 'C250', itemName: 'Cabin air filter' },
];

export function getCarById(carId: string | undefined): Car | undefined {
  return cars.find((car) => car.id === carId);
}

export function getTrackedItemsForCar(carId: string | undefined): TrackedItem[] {
  return trackedItems.filter((item) => item.carId === carId);
}

export function getServiceVisitsForCar(carId: string | undefined): ServiceVisit[] {
  return serviceVisits.filter((visit) => visit.carId === carId);
}

export function getOverdueCountForCar(carId: string): number {
  return overdueAlerts.filter((alert) => alert.carId === carId).length;
}
