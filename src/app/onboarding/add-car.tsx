import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CarFormFields, parseCarFormValues, useCarFormState } from '@/components/CarForm';
import { OnboardingFooter } from '@/components/OnboardingFooter';
import { OnboardingHeader } from '@/components/OnboardingHeader';
import { Screen } from '@/components/Screen';
import { useStorage } from '@/storage';
import { distanceUnitFor } from '@/utils/units';

export default function OnboardingAddCarScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { settings, cars, addCar, updateSettings } = useStorage();
  const distanceUnit = distanceUnitFor(settings.useImperialUnits);
  const { values, setField } = useCarFormState(undefined, distanceUnit);

  const addCarIfValid = () => {
    const parsed = parseCarFormValues(values, distanceUnit);
    if (parsed && !cars.some((car) => car.vin === parsed.vin)) {
      addCar(parsed);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <OnboardingHeader title={t('onboarding.addCarTitle')} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <CarFormFields values={values} setField={setField} distanceUnit={distanceUnit} />
        </ScrollView>
        <OnboardingFooter
          insetBottom={insets.bottom}
          onSkip={() => {
            updateSettings({ onboardingDone: true });
            router.replace('/');
          }}
          onNext={() => {
            addCarIfValid();
            updateSettings({ onboardingDone: true });
            router.replace('/');
          }}
          nextLabel={t('onboarding.getStarted')}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: 16,
    paddingTop: 20,
    gap: 18,
  },
});
