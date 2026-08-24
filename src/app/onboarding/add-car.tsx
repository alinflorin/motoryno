import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CarFormFields, toParsedCarFormValues, useCarForm } from '@/components/CarForm';
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
  const {
    control,
    handleSubmit,
    formState: { errors, isValid, touchedFields, isSubmitted },
  } = useCarForm(undefined, distanceUnit, cars.map((car) => car.vin));

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <OnboardingHeader title={t('onboarding.addCarTitle')} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <CarFormFields
            control={control}
            errors={errors}
            touchedFields={touchedFields}
            isSubmitted={isSubmitted}
            distanceUnit={distanceUnit}
            obd={null}
          />
        </ScrollView>
        <OnboardingFooter
          insetBottom={insets.bottom}
          onSkip={() => {
            updateSettings({ onboardingDone: true });
            router.replace('/');
          }}
          onNext={handleSubmit((values) => {
            addCar(toParsedCarFormValues(values, distanceUnit));
            updateSettings({ onboardingDone: true });
            router.replace('/');
          })}
          nextLabel={t('onboarding.getStarted')}
          nextDisabled={!isValid}
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
