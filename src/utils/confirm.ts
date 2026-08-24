import { Alert, Platform } from 'react-native';

/**
 * Cross-platform blocking confirm dialog. `Alert.alert` is a no-op on web
 * (react-native-web ships an empty stub), so it's routed through
 * `window.confirm` there instead.
 */
export function confirmAsync(title: string, message: string, confirmLabel: string, cancelLabel: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

/** Cross-platform single-button info alert — see `confirmAsync` for why web needs its own path. */
export function notify(message: string): void {
  if (Platform.OS === 'web') {
    window.alert(message);
    return;
  }
  Alert.alert(message);
}
