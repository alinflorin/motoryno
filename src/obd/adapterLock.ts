/**
 * Serialises adapter sessions per BLE device. The always-on monitor
 * (`src/ble/obdMonitor.ts`), the pairing scan and the learn flow can all
 * want the same dongle at once - e.g. the app coming to the foreground
 * forces a sync right as the user taps "Find odometer" - and an ELM327
 * only has one command/response stream, so two sessions interleaving
 * their commands would corrupt each other's replies. Each session waits
 * for the previous one on the same device to finish first.
 */

const chains = new Map<string, Promise<unknown>>();

export function withAdapterLock<T>(deviceId: string, session: () => Promise<T>): Promise<T> {
  const previous = chains.get(deviceId) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(session);
  chains.set(deviceId, run);
  void run
    .catch(() => undefined)
    .finally(() => {
      if (chains.get(deviceId) === run) chains.delete(deviceId);
    });
  return run;
}
