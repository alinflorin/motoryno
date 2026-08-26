import { Link, type Href } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

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
 * "delete" action. Wraps the hit target + pressed-opacity feedback shared by
 * every screen header action. Kept as a plain square so the platform's own
 * round header-button background (e.g. iOS's glass buttons) lands centered
 * on the icon instead of on a padded, off-center box.
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

  return href ? (
    <Link href={href} asChild>
      {pressable}
    </Link>
  ) : (
    pressable
  );
}

const styles = StyleSheet.create({
  button: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.5,
  },
});
