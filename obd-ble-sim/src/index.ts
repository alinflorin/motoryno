import { bleno, createGattService } from "./gatt";
import { resolveProfile } from "./profiles";

const deviceName = process.env.OBD_NAME ?? "OBDII";
const vin = process.env.OBD_VIN ?? "WDD2050471F123456";
const odometerKm = Number(process.env.OBD_ODOMETER_KM ?? "123458");
const profile = resolveProfile(process.env.OBD_PROFILE);

console.log(`Simulated OBD2 adapter starting up.`);
console.log(`  Advertised name : ${deviceName}`);
console.log(`  GATT profile    : ${profile.label}`);
console.log(`  Service UUID    : ${profile.serviceUUID}`);
console.log(`  VIN             : ${vin}`);
console.log(`  Odometer        : ${odometerKm} km`);
console.log("");

const service = createGattService(profile, { vin, odometerKm });

bleno.on("stateChange", (state: string) => {
  console.log(`Bluetooth adapter state: ${state}`);
  if (state === "poweredOn") {
    bleno.startAdvertising(deviceName, [profile.serviceUUID]);
  } else {
    bleno.stopAdvertising();
  }
});

bleno.on("advertisingStart", (error?: Error) => {
  if (error) {
    console.error("Failed to start advertising:", error);
    return;
  }
  bleno.setServices([service], (setServicesError?: Error) => {
    if (setServicesError) {
      console.error("Failed to set services:", setServicesError);
      return;
    }
    console.log(`Advertising as "${deviceName}" - connect from the app now.`);
  });
});

bleno.on("accept", (clientAddress: string) => {
  console.log(`Central connected: ${clientAddress}`);
});

bleno.on("disconnect", (clientAddress: string) => {
  console.log(`Central disconnected: ${clientAddress}`);
});

process.on("SIGINT", () => {
  console.log("\nShutting down...");
  bleno.stopAdvertising();
  bleno.disconnect();
  process.exit(0);
});
