import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';

import { Screen } from '@/components/Screen';
import { downloadAppData, pickAppData, shareCarsData, useStorage } from '@/storage';
import type { ColorTokens } from '@/theme/colors';
import { useThemeColors } from '@/theme/ThemeContext';
import { confirmAsync, notify } from '@/utils/confirm';

export default function SettingsDataScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const { settings, cars, replaceAllData } = useStorage();
  const [downloading, setDownloading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [sharing, setSharing] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadAppData({ settings, data: { cars } });
    } catch (error) {
      console.warn('[settings/data] Failed to download data.', error);
      notify(t('common.error'), t('settingsData.downloadError'));
    } finally {
      setDownloading(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const imported = await pickAppData();
      if (!imported) return;

      const proceed = await confirmAsync(
        t('settingsData.importConfirmTitle'),
        t('settingsData.importConfirmMessage'),
        t('settingsData.importConfirmProceed'),
        t('settingsData.importConfirmCancel')
      );
      if (!proceed) return;

      replaceAllData(imported);
      notify(t('common.success'), t('settingsData.importSuccess'));
    } catch (error) {
      console.warn('[settings/data] Failed to import data.', error);
      notify(t('common.error'), t('settingsData.importError'));
    } finally {
      setImporting(false);
    }
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      const shared = await shareCarsData(cars);
      if (!shared) notify(t('common.error'), t('settingsData.shareUnavailable'));
    } catch (error) {
      console.warn('[settings/data] Failed to share data.', error);
      notify(t('common.error'), t('settingsData.shareError'));
    } finally {
      setSharing(false);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: t('settingsData.title') }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>{t('settingsData.subtitle')}</Text>

        <SectionBlock
          styles={styles}
          subtitle={t('settingsData.downloadSubtitle')}
          buttonLabel={downloading ? t('settingsData.downloading') : t('settingsData.downloadData')}
          onPress={handleDownload}
          disabled={downloading}
        />

        <SectionBlock
          styles={styles}
          subtitle={t('settingsData.importSubtitle')}
          buttonLabel={importing ? t('settingsData.importing') : t('settingsData.importData')}
          onPress={handleImport}
          disabled={importing}
        />

        <SectionBlock
          styles={styles}
          subtitle={t('settingsData.shareWithAISubtitle')}
          buttonLabel={sharing ? t('settingsData.sharing') : t('settingsData.shareWithAI')}
          onPress={handleShare}
          disabled={sharing}
        />
      </ScrollView>
    </Screen>
  );
}

function SectionBlock({
  styles,
  subtitle,
  buttonLabel,
  onPress,
  disabled,
}: {
  styles: ReturnType<typeof getStyles>;
  subtitle: string;
  buttonLabel: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.downloadBlock}>
      <Text style={styles.downloadSubtitle}>{subtitle}</Text>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.downloadButton,
          pressed && styles.downloadButtonPressed,
          disabled && styles.downloadButtonDisabled,
        ]}
      >
        <Text style={styles.downloadButtonText}>{buttonLabel}</Text>
      </Pressable>
    </View>
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
