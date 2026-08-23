import { Column, Host, Spacer, Text } from '@expo/ui';
import { useTranslation } from 'react-i18next';

export default function HomeScreen() {
  const { t } = useTranslation();

  return (
    <Host style={{ flex: 1 }} matchContents={{ vertical: false, horizontal: false }}>
      <Column alignment="center" style={{ width: '100%', height: '100%' }}>
        <Spacer flexible />
        <Text textStyle={{ fontSize: 32, fontWeight: '700' }}>{t('home.title')}</Text>
        <Spacer flexible />
      </Column>
    </Host>
  );
}
