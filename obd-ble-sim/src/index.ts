import { SimCar, W204_SIM } from './elmSim';
import { bleno, createGattService } from './gatt';
import { resolveProfile } from './profiles';

const car: SimCar = process.env.OBD_CAR === 'w204' ? 'w204' : 'generic';
const deviceName = process.env.OBD_NAME ?? 'OBDII';
const vin = process.env.OBD_VIN ?? (car === 'w204' ? 'WDD2040471F123456' : 'WDD2050471F123456');
const odometerKm = Number(process.env.OBD_ODOMETER_KM ?? '123458');
const profile = resolveProfile(process.env.OBD_PROFILE);

console.log(`Simulated OBD2 adapter starting up.`);
console.log(`  Advertised name : ${deviceName}`);
console.log(`  GATT profile    : ${profile.label}`);
console.log(`  Service UUID    : ${profile.serviceUUID}`);
console.log(`  Simulated car   : ${car}`);
console.log(`  VIN             : ${vin}`);
console.log(`  Odometer        : ${odometerKm} km`);
if (car === 'w204') {
  console.log(`  EZS             : ${W204_SIM.ezs.header}/${W204_SIM.ezs.response}, km at 22 ${W204_SIM.ezs.kmDid} (after 10 03)`);
  console.log(
    `  Cluster         : ${W204_SIM.cluster.header}/${W204_SIM.cluster.response}, km at 21 ${W204_SIM.cluster.kmLocalId} (after 10 92)`
  );
  console.log(`  Broadcast       : ${W204_SIM.broadcastId} bytes 4-6 (ATMA)`);
}
console.log('');

const service = createGattService(profile, { vin, odometerKm, car });

bleno.on('stateChange', (state: string) => {
  console.log(`Bluetooth adapter state: ${state}`);
  if (state === 'poweredOn') {
    bleno.startAdvertising(deviceName, [profile.serviceUUID]);
  } else {
    bleno.stopAdvertising();
  }
});

bleno.on('advertisingStart', (error?: Error) => {
  if (error) {
    console.error('Failed to start advertising:', error);
    return;
  }
  bleno.setServices([service], (setServicesError?: Error) => {
    if (setServicesError) {
      console.error('Failed to set services:', setServicesError);
      return;
    }
    console.log(`Advertising as "${deviceName}" - connect from the app now.`);
  });
});

bleno.on('accept', (clientAddress: string) => {
  console.log(`Central connected: ${clientAddress}`);
});

bleno.on('disconnect', (clientAddress: string) => {
  console.log(`Central disconnected: ${clientAddress}`);
});

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  bleno.stopAdvertising();
  bleno.disconnect();
  process.exit(0);
});
