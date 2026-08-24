import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import type { ColorTokens } from '@/theme/colors';
import { useThemeColors } from '@/theme/ThemeContext';

export default function SettingsResetScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useThemeColors();
  const styles = getStyles(colors);

  return (
    <Screen>
      <Stack.Screen options={{ title: t('settingsReset.title') }} />
      <View style={styles.content}>
        <Text style={styles.icon}>⚠️</Text>
        <Text style={styles.confirm}>{t('settingsReset.confirm')}</Text>
        <Text style={styles.warning}>{t('settingsReset.warning')}</Text>

        <View style={styles.buttonRow}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.button, styles.noButton, pressed && styles.pressed]}
          >
            <Text style={styles.noText}>{t('common.no')}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.button, styles.yesButton, pressed && styles.pressed]}
          >
            <Text style={styles.yesText}>{t('common.yes')}</Text>
          </Pressable>
        </View>

        <Text style={styles.databaseSize}>{t('settingsReset.databaseSize', { size: '3 MB' })}</Text>
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
    icon: {
      fontSize: 32,
      marginBottom: 4,
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
      alignItems: 'center',
      paddingVertical: 13,
      borderRadius: 14,
    },
    pressed: {
      opacity: 0.85,
    },
    noButton: {
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    noText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '700',
    },
    yesButton: {
      backgroundColor: colors.red,
    },
    yesText: {
      color: colors.onRed,
      fontSize: 14,
      fontWeight: '700',
    },
    databaseSize: {
      color: colors.textFainter,
      fontSize: 12,
      marginTop: 12,
    },
  });
}
