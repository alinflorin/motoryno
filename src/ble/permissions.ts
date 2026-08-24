import { PermissionsAndroid, Platform } from 'react-native';

/**
 * Requests whatever runtime permissions this OS/API level needs before a BLE
 * scan can start. iOS prompts for Bluetooth access automatically the first
 * time the native scan call is made, so there's nothing to request there.
 * Resolves false if the user denied (or the platform doesn't support BLE).
 */
export async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  // Android 12+ (API 31) split Bluetooth out of the location permission and
  // introduced its own runtime grants; below that, scanning still requires
  // fine location because BLE advertisements can be used to derive it.
  const permissions =
    Platform.Version >= 31
      ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

  const results = await PermissionsAndroid.requestMultiple(permissions);
  return permissions.every((permission) => results[permission] === PermissionsAndroid.RESULTS.GRANTED);
}
