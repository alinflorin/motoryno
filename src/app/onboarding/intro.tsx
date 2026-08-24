import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OnboardingFooter } from '@/components/OnboardingFooter';
import { OnboardingHeader } from '@/components/OnboardingHeader';
import { Screen } from '@/components/Screen';
import { colors } from '@/theme/colors';

export default function OnboardingIntroScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <OnboardingHeader title={t('onboarding.introTitle')} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.body}>{t('onboarding.introBody1')}</Text>
        <View style={styles.illustration}>
          <Text style={styles.illustrationGlyph}>🚗</Text>
        </View>
        <Text style={styles.body}>{t('onboarding.introBody2')}</Text>
      </ScrollView>
      <OnboardingFooter
        insetBottom={insets.bottom}
        onSkip={() => router.replace('/')}
        onNext={() => router.push('/onboarding/language')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingTop: 24,
    gap: 20,
  },
  body: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  illustration: {
    height: 160,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationGlyph: {
    fontSize: 48,
  },
});
