import { useCallback, useEffect, useRef, useState } from 'react';

import { getBleManager, waitForPoweredOn } from '@/ble/bleManager';
import { requestBlePermissions } from '@/ble/permissions';
import type { LearnProgress, LearnResult } from '@/obd';
import { learnOdometerSource } from '@/obd';
import type { ObdConfig } from '@/storage';

/** How long to wait for a direct connect to an already-paired adapter before giving up on a learn. */
const LEARN_CONNECT_TIMEOUT_MS = 15000;

export type LearnOutcome =
  | { status: 'found'; result: LearnResult }
  | { status: 'not-found' }
  | { status: 'connection-failed' }
  | { status: 'permission-denied' }
  | { status: 'bluetooth-off' };

/**
 * Drives the "Find odometer" flow (see `src/obd/odometer/learn.ts`) for one
 * paired adapter: permissions, connect, run, report progress, and cancel
 * cleanly when the screen goes away.
 */
export function useLearnOdometer(obd: ObdConfig | null, vehicle: { vin: string | null; make: string | null }) {
  const [progress, setProgress] = useState<LearnProgress | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setProgress(null);
  }, []);

  const start = useCallback(
    async (referenceKm: number): Promise<LearnOutcome | null> => {
      const manager = getBleManager();
      if (!manager || !obd) return null;
      if (!(await requestBlePermissions())) return { status: 'permission-denied' };
      if (!(await waitForPoweredOn(manager))) return { status: 'bluetooth-off' };

      const abort = new AbortController();
      abortRef.current = abort;
      setProgress({ step: 'connecting' });
      try {
        const device = await manager.connectToDevice(obd.deviceAddress, { timeout: LEARN_CONNECT_TIMEOUT_MS });
        const result = await learnOdometerSource(device, vehicle, referenceKm, {
          initCommands: obd.initCommands,
          signal: abort.signal,
          onProgress: (next) => {
            if (!abort.signal.aborted) setProgress(next);
          },
        });
        if (abort.signal.aborted) return null;
        return result ? { status: 'found', result } : { status: 'not-found' };
      } catch {
        return abort.signal.aborted ? null : { status: 'connection-failed' };
      } finally {
        abortRef.current = null;
        setProgress(null);
      }
    },
    [obd, vehicle]
  );

  return { progress, start, cancel, running: progress !== null };
}
