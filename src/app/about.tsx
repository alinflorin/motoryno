import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { SettingsRow } from '@/components/SettingsRow';
import { SettingsSection } from '@/components/SettingsSection';
import type { ColorTokens } from '@/theme/colors';
import { useThemeColors } from '@/theme/ThemeContext';

export default function AboutScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = getStyles(colors);

  return (
    <Screen>
      <Stack.Screen options={{ title: t('about.title') }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SettingsSection>
          <SettingsRow label={t('about.help')} onPress={() => {}} />
          <SettingsRow label={t('about.rate')} onPress={() => {}} />
          <SettingsRow label={t('about.feedback')} onPress={() => {}} />
          <SettingsRow label={t('about.website')} onPress={() => {}} />
        </SettingsSection>

        <Text style={styles.version}>{t('about.version', { version: '1.0.0' })}</Text>

        <View style={styles.legalRow}>
          <Text style={styles.legalLink}>{t('about.tos')}</Text>
          <View style={styles.legalDivider} />
          <Text style={styles.legalLink}>{t('about.privacyPolicy')}</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

function getStyles(colors: ColorTokens) {
  return StyleSheet.create({
    content: {
      padding: 16,
      paddingTop: 24,
      gap: 24,
    },
    version: {
      color: colors.textFaint,
      fontSize: 13,
      textAlign: 'center',
    },
    legalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
    },
    legalDivider: {
      width: StyleSheet.hairlineWidth,
      height: 14,
      backgroundColor: colors.borderStrong,
    },
    legalLink: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
    },
  });
}
