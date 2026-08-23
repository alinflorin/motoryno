import { Column, Host, Spacer, Text } from '@expo/ui';

export default function HomeScreen() {
  return (
    <Host style={{ flex: 1 }} matchContents={{ vertical: false, horizontal: false }}>
      <Column alignment="center" style={{ width: '100%', height: '100%' }}>
        <Spacer flexible />
        <Text textStyle={{ fontSize: 32, fontWeight: '700' }}>Motoryno</Text>
        <Spacer flexible />
      </Column>
    </Host>
  );
}
