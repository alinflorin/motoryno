import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ScreenScrollView } from '@/components/ScreenScrollView';
import { downloadAppData, pickAppData, shareCarsData, useStorage } from '@/storage';
import type { ColorTokens } from '@/theme/colors';
import { useStyles } from '@/theme/useStyles';
import { confirmAsync, notify } from '@/utils/confirm';

export default function SettingsDataScreen() {
  const { t } = useTranslation();
  const { styles } = useStyles(getStyles);
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
      <ScreenScrollView>
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
      </ScreenScrollView>
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
      <Button label={buttonLabel} variant="secondary" onPress={onPress} loading={disabled} />
    </View>
  );
}

function getStyles(colors: ColorTokens) {
  return StyleSheet.create({
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
  });
}
