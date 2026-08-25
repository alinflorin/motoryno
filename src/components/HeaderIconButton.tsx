import { Link, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/Icon';

type IconName = React.ComponentProps<typeof Icon>['name'];

type HeaderIconButtonProps = {
  name: IconName;
  color: string;
  size?: number;
  accessibilityLabel?: string;
} & ({ href: Href; onPress?: never } | { onPress: () => void; href?: never });

/**
 * Icon button meant for `Stack.Screen`'s `headerRight`, e.g. an "add" link or a
 * "delete" action. Wraps the paddingRight spacing + hit target + pressed-opacity
 * feedback shared by every screen header action.
 */
export function HeaderIconButton({ name, color, size = 22, accessibilityLabel, href, onPress }: HeaderIconButtonProps) {
  const pressable = (
    <Pressable
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
    >
      <Icon name={name} size={size} color={color} />
    </Pressable>
  );

  return (
    <View style={styles.container}>
      {href ? (
        <Link href={href} asChild>
          {pressable}
        </Link>
      ) : (
        pressable
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingRight: 16,
  },
  button: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.5,
  },
});
