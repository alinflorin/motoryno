import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chevron } from '@/components/Chevron';
import { MCIcon } from '@/components/Icon';
import { OnboardingFooter } from '@/components/OnboardingFooter';
import { OnboardingHeader } from '@/components/OnboardingHeader';
import { Screen } from '@/components/Screen';
import { useStorage } from '@/storage';
import type { ColorTokens } from '@/theme/colors';
import { useThemeColors } from '@/theme/ThemeContext';

export default function OnboardingWelcomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { updateSettings } = useStorage();
  const colors = useThemeColors();
  const styles = getStyles(colors);

  const steps = [
    t('onboarding.stepIntro'),
    t('onboarding.stepLanguage'),
    t('onboarding.stepAddCar'),
  ];

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <OnboardingHeader title={t('onboarding.welcomeTitle')} right={<MCIcon name="hand-wave-outline" size={22} color={colors.amber} />} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.greeting}>{t('onboarding.welcomeGreeting')}</Text>
        <Text style={styles.body}>{t('onboarding.welcomeBody')}</Text>

        <View style={styles.steps}>
          <Text style={styles.stepsTitle}>{t('onboarding.stepsTitle')}</Text>
          {steps.map((step) => (
            <View key={step} style={styles.stepRow}>
              <Chevron color={colors.amber} size={15} />
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <OnboardingFooter
        insetBottom={insets.bottom}
        onSkip={() => {
          updateSettings({ onboardingDone: true });
          router.replace('/');
        }}
        onNext={() => router.push('/onboarding/intro')}
      />
    </Screen>
  );
}

function getStyles(colors: ColorTokens) {
  return StyleSheet.create({
    content: {
      padding: 16,
      paddingTop: 24,
      gap: 14,
    },
    greeting: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: '700',
    },
    body: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    steps: {
      marginTop: 12,
      gap: 10,
    },
    stepsTitle: {
      color: colors.textFaint,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    stepRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    stepText: {
      color: colors.textSecondary,
      fontSize: 14,
    },
  });
}
