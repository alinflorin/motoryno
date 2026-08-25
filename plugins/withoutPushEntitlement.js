const fs = require("fs");
const plist = require("@expo/plist").default ?? require("@expo/plist");
const { withFinalizedMod, IOSConfig } = require("@expo/config-plugins");

/**
 * expo-notifications unconditionally adds the `aps-environment` (Push
 * Notifications) entitlement to the iOS project during prebuild. Motoryno
 * only schedules local notifications (see README.md "Notification
 * feature") and never uses remote push, and that entitlement requires a
 * paid Apple Developer Program membership — a free "Personal Team" cannot
 * create a matching provisioning profile with it present.
 *
 * expo-notifications' entitlements mod is applied via autolinking, which
 * runs after every plugin declared in app.json's `plugins` array — so a
 * plain `withEntitlementsPlist` here (even listed last) still executes
 * before it and gets clobbered. `withFinalizedMod` is the one hook the
 * config-plugins compiler guarantees runs after *everything* else for the
 * platform, so strip the entitlement directly from disk there instead.
 */
const withoutPushEntitlement = (config) => {
  return withFinalizedMod(config, [
    "ios",
    (config) => {
      const entitlementsPath = IOSConfig.Entitlements.getEntitlementsPath(
        config.modRequest.projectRoot
      );
      const contents = plist.parse(fs.readFileSync(entitlementsPath, "utf8"));
      if ("aps-environment" in contents) {
        delete contents["aps-environment"];
        fs.writeFileSync(entitlementsPath, plist.build(contents));
      }
      return config;
    },
  ]);
};

module.exports = withoutPushEntitlement;
