import { useTranslation } from "react-i18next";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import type { ObdConfig } from "@/storage";
import type { ColorTokens } from "@/theme/colors";
import { useThemeColors } from "@/theme/ThemeContext";
import { formatDateDMY } from "@/utils/date";

/**
 * Card offering to scan for/pair a BLE OBD2 adapter, shown on the car form.
 * When `obd` is already persisted for the car, it's displayed instead of the
 * scan prompt, with a button to pair a different adapter.
 * BLE isn't available on web, so this renders nothing there.
 */
export function ObdConfigCard({ obd }: { obd: ObdConfig | null }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = getStyles(colors);
  console.log(obd);
  if (Platform.OS === "web") {
    // return null;
  }

  return (
    <View style={styles.obdCard}>
      <View style={styles.obdHeader}>
        <Text style={styles.obdTitle}>{t("carForm.obdTitle")}</Text>
      </View>
      <View style={styles.obdBody}>
        {obd ? (
          <View style={styles.obdDeviceInfo}>
            <Text style={styles.obdDeviceName}>{obd.deviceName}</Text>
            <Text style={styles.obdSubtitle}>
              {obd.lastSyncedAt
                ? t("carForm.obdLastSynced", {
                    date: formatDateDMY(obd.lastSyncedAt),
                  })
                : t("carForm.obdNeverSynced")}
            </Text>
          </View>
        ) : (
          <Text style={styles.obdSubtitle}>{t("carForm.obdSubtitle")}</Text>
        )}
        <Pressable
          style={({ pressed }) => [
            styles.scanButton,
            pressed && styles.scanButtonPressed,
          ]}
        >
          <Text style={styles.scanButtonText}>
            {obd ? t("carForm.change") : t("carForm.scan")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function getStyles(colors: ColorTokens) {
  return StyleSheet.create({
    obdCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 16,
      overflow: "hidden",
    },
    obdHeader: {
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    obdTitle: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "700",
    },
    obdBody: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    obdDeviceInfo: {
      flex: 1,
      paddingRight: 12,
      gap: 2,
    },
    obdDeviceName: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: "600",
    },
    obdSubtitle: {
      color: colors.textFaint,
      fontSize: 12,
      flex: 1,
      paddingRight: 12,
    },
    scanButton: {
      backgroundColor: colors.amber,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
    },
    scanButtonPressed: {
      opacity: 0.85,
    },
    scanButtonText: {
      color: colors.onAmber,
      fontSize: 12,
      fontWeight: "700",
    },
  });
}
