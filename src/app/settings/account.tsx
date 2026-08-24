import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { downloadAppData, useStorage } from '@/storage';
import type { ColorTokens } from '@/theme/colors';
import { useThemeColors } from '@/theme/ThemeContext';

export default function SettingsAccountScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const { settings, cars } = useStorage();
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadAppData({ settings, data: { cars } });
    } catch (error) {
      console.warn('[settings/account] Failed to download data.', error);
      Alert.alert(t('settingsAccount.downloadError'));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: t('settingsAccount.title') }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>{t('settingsAccount.syncSubtitle')}</Text>

        <View style={styles.loginButtons}>
          <Pressable style={({ pressed }) => [styles.loginButton, pressed && styles.loginButtonPressed]}>
            <Text style={styles.loginGlyph}>G</Text>
            <Text style={styles.loginText}>{t('settingsAccount.loginWithGoogle')}</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.loginButton, pressed && styles.loginButtonPressed]}>
            <Text style={styles.loginGlyph}>🍎</Text>
            <Text style={styles.loginText}>{t('settingsAccount.loginWithApple')}</Text>
          </Pressable>
        </View>

        <View style={styles.statusBlock}>
          <Text style={styles.statusText}>
            {t('settingsAccount.loggedInAs', { email: 'alin@example.com', provider: 'Google' })}
          </Text>
          <Text style={styles.statusMeta}>{t('settingsAccount.lastSync', { date: '12.10.2024, 19:32' })}</Text>
        </View>

        <View style={styles.actionRow}>
          <Pressable style={({ pressed }) => [styles.syncButton, pressed && styles.syncButtonPressed]}>
            <Text style={styles.syncButtonText}>{t('settingsAccount.syncNow')}</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.logoutButton, pressed && styles.logoutButtonPressed]}>
            <Text style={styles.logoutButtonText}>{t('settingsAccount.logOut')}</Text>
          </Pressable>
        </View>

        <View style={styles.divider} />

        <View style={styles.downloadBlock}>
          <Text style={styles.downloadSubtitle}>{t('settingsAccount.downloadSubtitle')}</Text>
          <Pressable
            onPress={handleDownload}
            disabled={downloading}
            style={({ pressed }) => [
              styles.downloadButton,
              pressed && styles.downloadButtonPressed,
              downloading && styles.downloadButtonDisabled,
            ]}
          >
            <Text style={styles.downloadButtonText}>
              {downloading ? t('settingsAccount.downloading') : t('settingsAccount.downloadData')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

function getStyles(colors: ColorTokens) {
  return StyleSheet.create({
    content: {
      padding: 16,
      gap: 20,
      paddingBottom: 32,
    },
    intro: {
      color: colors.textFaint,
      fontSize: 13,
      lineHeight: 18,
    },
    loginButtons: {
      gap: 10,
    },
    loginButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 14,
      paddingVertical: 13,
    },
    loginButtonPressed: {
      borderColor: colors.amberBorder,
    },
    loginGlyph: {
      color: colors.textSecondary,
      fontSize: 15,
      fontWeight: '700',
    },
    loginText: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '600',
    },
    statusBlock: {
      gap: 4,
    },
    statusText: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    statusMeta: {
      color: colors.textFaint,
      fontSize: 12,
    },
    actionRow: {
      flexDirection: 'row',
      gap: 10,
    },
    syncButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 13,
      borderRadius: 14,
      backgroundColor: colors.amber,
    },
    syncButtonPressed: {
      opacity: 0.85,
    },
    syncButtonText: {
      color: colors.onAmber,
      fontSize: 13,
      fontWeight: '700',
    },
    logoutButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 13,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    logoutButtonPressed: {
      backgroundColor: colors.surface,
    },
    logoutButtonText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '700',
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.borderStrong,
    },
    downloadBlock: {
      gap: 10,
    },
    downloadSubtitle: {
      color: colors.textFaint,
      fontSize: 13,
      lineHeight: 18,
    },
    downloadButton: {
      alignItems: 'center',
      paddingVertical: 13,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    downloadButtonPressed: {
      backgroundColor: colors.surface,
    },
    downloadButtonDisabled: {
      opacity: 0.6,
    },
    downloadButtonText: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '700',
    },
  });
}
