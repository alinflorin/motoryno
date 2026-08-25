import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { OnboardingFooter } from '@/components/OnboardingFooter';
import { OnboardingHeader } from '@/components/OnboardingHeader';
import { PreferencesFields } from '@/components/PreferencesFields';
import { Screen } from '@/components/Screen';
import { useStorage } from '@/storage';
import { useThemeColors } from '@/theme/ThemeContext';

export default function OnboardingPreferencesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { cars, updateSettings } = useStorage();
  const colors = useThemeColors();
  const hasCars = cars.length > 0;

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <OnboardingHeader title={t('onboarding.languageTitle')} right={<Icon name="options-outline" size={20} color={colors.textMuted} />} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PreferencesFields />
      </ScrollView>
      <OnboardingFooter
        insetBottom={insets.bottom}
        onSkip={() => {
          updateSettings({ onboardingDone: true });
          router.replace('/');
        }}
        onNext={() => {
          if (hasCars) {
            updateSettings({ onboardingDone: true });
            router.replace('/');
          } else {
            router.push('/onboarding/add-car');
          }
        }}
        nextLabel={hasCars ? t('onboarding.getStarted') : undefined}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingTop: 20,
    gap: 20,
  },
});
