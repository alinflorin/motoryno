import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { useStorage } from '@/storage';
import type { ColorTokens } from '@/theme/colors';
import { useStyles } from '@/theme/useStyles';

export default function SettingsResetScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, styles } = useStyles(getStyles);
  const { settings, cars, resetAllData } = useStorage();

  // Approximate byte size from the serialized JSON blob (good enough for display).
  const databaseSizeKb = JSON.stringify({ settings, data: { cars } }).length / 1024;
  const databaseSizeLabel = `${databaseSizeKb < 1 ? '<1' : databaseSizeKb.toFixed(1)} KB`;

  const handleReset = () => {
    resetAllData();
    router.replace('/');
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: t('settingsReset.title') }} />
      <View style={styles.content}>
        <Icon name="warning-outline" size={32} color={colors.yellow} />
        <Text style={styles.confirm}>{t('settingsReset.confirm')}</Text>
        <Text style={styles.warning}>{t('settingsReset.warning')}</Text>

        <View style={styles.buttonRow}>
          <Button label={t('common.no')} variant="secondary" onPress={() => router.back()} style={styles.button} />
          <Button label={t('common.yes')} variant="danger" onPress={handleReset} style={styles.button} />
        </View>

        <Text style={styles.databaseSize}>{t('settingsReset.databaseSize', { size: databaseSizeLabel })}</Text>
      </View>
    </Screen>
  );
}

function getStyles(colors: ColorTokens) {
  return StyleSheet.create({
    content: {
      padding: 16,
      paddingTop: 32,
      alignItems: 'center',
      gap: 14,
    },
    confirm: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '700',
      textAlign: 'center',
    },
    warning: {
      color: colors.textFaint,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 18,
      maxWidth: 280,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 8,
      width: '100%',
    },
    button: {
      flex: 1,
    },
    databaseSize: {
      color: colors.textFainter,
      fontSize: 12,
      marginTop: 12,
    },
  });
}
