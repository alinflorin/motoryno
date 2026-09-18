import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { connectPairedAdapter } from '@/ble/connectPairedAdapter';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FormField } from '@/components/FormField';
import { TextField } from '@/components/TextField';
import type { BusCaptureResult, RawCommandResult } from '@/obd';
import { captureBus, runRawCommands } from '@/obd';
import { isCanId, parseInitCommands } from '@/obd/manualConfig';
import type { ColorTokens } from '@/theme/colors';
import { fontSize, fontWeight, spacing } from '@/theme/tokens';
import { useStyles } from '@/theme/useStyles';
import { notify } from '@/utils/confirm';

/** How long a bus capture listens. Cluster/gateway frames repeat every few hundred ms, so this catches several rounds. */
const CAPTURE_MS = 3000;

function toHex(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}

/** Collapses a capture into one line per distinct frame (ID + data), most frequent first. */
function summarizeFrames(result: BusCaptureResult): { key: string; id: string; data: string; count: number }[] {
  const counts = new Map<string, { id: string; data: string; count: number }>();
  for (const frame of result.frames) {
    const data = toHex(frame.data);
    const key = `${frame.id} ${data}`;
    const entry = counts.get(key);
    if (entry) entry.count += 1;
    else counts.set(key, { id: frame.id, data, count: 1 });
  }
  return [...counts.entries()].map(([key, entry]) => ({ key, ...entry })).sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
}

/**
 * The "take charge" tools for a car whose data none of the built-in
 * strategies reach: send any adapter/diagnostic commands in order and read
 * the raw replies, or listen to the bus for a few seconds to spot the frame
 * that carries the value. Each run opens a fresh session with the car's
 * init commands applied, exactly as the syncs do.
 */
export function ObdConsole({
  deviceAddress,
  initCommands,
  disabled = false,
  onBusyChange,
}: {
  /** The paired adapter; null renders the card with everything disabled. */
  deviceAddress: string | null;
  initCommands: string[];
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { t } = useTranslation();
  const { styles } = useStyles(getStyles);
  const [commandText, setCommandText] = useState('');
  const [filterText, setFilterText] = useState('');
  const [running, setRunning] = useState<'commands' | 'capture' | null>(null);
  const [commandResults, setCommandResults] = useState<RawCommandResult[] | null>(null);
  const [capture, setCapture] = useState<BusCaptureResult | null>(null);

  const commands = parseInitCommands(commandText);
  const filterValid = filterText.trim() === '' || isCanId(filterText);

  const withDevice = async (which: 'commands' | 'capture', run: (device: Parameters<typeof runRawCommands>[0]) => Promise<void>) => {
    if (!deviceAddress) return;
    setRunning(which);
    onBusyChange?.(true);
    try {
      const connection = await connectPairedAdapter(deviceAddress);
      if ('error' in connection) {
        if (connection.error === 'permission-denied') notify(t('common.error'), t('carForm.obdPermissionDenied'));
        else if (connection.error === 'bluetooth-off') notify(t('common.error'), t('carForm.obdScanFailed'));
        else if (connection.error === 'connection-failed') notify(t('common.error'), t('obdSetup.connectionFailed'));
        return;
      }
      await run(connection.device);
    } catch {
      notify(t('common.error'), t('obdSetup.connectionFailed'));
    } finally {
      setRunning(null);
      onBusyChange?.(false);
    }
  };

  const sendCommands = () =>
    withDevice('commands', async (device) => {
      const results = await runRawCommands(device, initCommands, commands);
      if (!results) {
        notify(t('common.error'), t('obdSetup.connectionFailed'));
        return;
      }
      setCommandResults(results);
    });

  const listen = () =>
    withDevice('capture', async (device) => {
      const result = await captureBus(device, initCommands, CAPTURE_MS, filterText.trim().toUpperCase() || undefined);
      if (!result) {
        notify(t('common.error'), t('obdSetup.connectionFailed'));
        return;
      }
      setCapture(result);
    });

  const busy = disabled || running !== null;
  const frames = capture ? summarizeFrames(capture) : [];

  return (
    <Card title={t('obdSetup.consoleTitle')}>
      <Text style={styles.hint}>{t('obdSetup.consoleHint')}</Text>

      <FormField label={t('obdSetup.consoleCommands')}>
        <TextField
          value={commandText}
          onChangeText={setCommandText}
          placeholder={t('obdSetup.consoleCommandsPlaceholder')}
          multiline
          autoCapitalize="characters"
          autoCorrect={false}
          style={styles.multiline}
          editable={!busy}
        />
        <Text style={styles.fieldHint}>{t('obdSetup.consoleCommandsHint')}</Text>
      </FormField>
      <Button
        label={running === 'commands' ? t('obdSetup.consoleSending') : t('obdSetup.consoleSend')}
        variant="accent"
        size="sm"
        fullWidth={false}
        loading={running === 'commands'}
        disabled={busy || !deviceAddress || commands.length === 0}
        onPress={sendCommands}
      />
      {commandResults && (
        <View style={styles.output}>
          {commandResults.map((result, index) => (
            <View key={`${index}-${result.command}`} style={styles.outputRow}>
              <Text style={styles.monoCommand}>{`> ${result.command}`}</Text>
              <Text style={styles.mono}>{result.response || t('obdSetup.consoleEmptyReply')}</Text>
            </View>
          ))}
        </View>
      )}

      <FormField label={t('obdSetup.consoleFilter')} error={filterValid ? undefined : t('validation.invalidCanId')}>
        <TextField
          value={filterText}
          onChangeText={setFilterText}
          placeholder={t('obdSetup.consoleFilterPlaceholder')}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!busy}
        />
      </FormField>
      <Button
        label={running === 'capture' ? t('obdSetup.consoleListening') : t('obdSetup.consoleListen', { seconds: CAPTURE_MS / 1000 })}
        variant="accent"
        size="sm"
        fullWidth={false}
        loading={running === 'capture'}
        disabled={busy || !deviceAddress || !filterValid}
        onPress={listen}
      />
      {capture && (
        <View style={styles.output}>
          {frames.length > 0 ? (
            frames.map((frame) => (
              <Text key={frame.key} style={styles.mono}>
                {`${frame.id}  ${frame.data}  ×${frame.count}`}
              </Text>
            ))
          ) : capture.lines.length > 0 ? (
            capture.lines.slice(0, 40).map((line, index) => (
              <Text key={`${index}-${line}`} style={styles.mono}>
                {line}
              </Text>
            ))
          ) : (
            <Text style={styles.mono}>{t('obdSetup.consoleNoFrames')}</Text>
          )}
        </View>
      )}
      {!deviceAddress && <Text style={styles.fieldHint}>{t('obdSetup.testNeedsAdapter')}</Text>}
    </Card>
  );
}

function getStyles(colors: ColorTokens) {
  return StyleSheet.create({
    hint: {
      color: colors.textFaint,
      fontSize: fontSize.small,
      lineHeight: 17,
    },
    fieldHint: {
      color: colors.textFaint,
      fontSize: fontSize.caption,
      lineHeight: 15,
    },
    multiline: {
      minHeight: 72,
      textAlignVertical: 'top',
    },
    output: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 10,
      padding: spacing.md,
      gap: spacing.xs,
    },
    outputRow: {
      gap: 2,
    },
    monoCommand: {
      color: colors.textPrimary,
      fontSize: fontSize.small,
      fontWeight: fontWeight.semibold,
      fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    },
    mono: {
      color: colors.textSecondary,
      fontSize: fontSize.small,
      fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    },
  });
}
