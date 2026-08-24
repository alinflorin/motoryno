import { Platform } from 'react-native';
import { BleManager } from 'react-native-ble-plx';

/**
 * Single app-wide `BleManager` instance. Constructing it touches native
 * modules that don't exist on web, so it's created lazily and only once.
 */
let manager: BleManager | null = null;

export function getBleManager(): BleManager | null {
  if (Platform.OS === 'web') {
    return null;
  }
  if (!manager) {
    manager = new BleManager();
  }
  return manager;
}
