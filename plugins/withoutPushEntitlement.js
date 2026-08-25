const { withEntitlementsPlist } = require("@expo/config-plugins");

/**
 * expo-notifications unconditionally adds the `aps-environment` (Push
 * Notifications) entitlement to the iOS project during prebuild. Motoryno
 * only schedules local notifications (see README.md "Notification
 * feature") and never uses remote push, and that entitlement requires a
 * paid Apple Developer Program membership — a free "Personal Team" cannot
 * create a matching provisioning profile with it present. Strip it back
 * out after expo-notifications runs.
 */
const withoutPushEntitlement = (config) => {
  return withEntitlementsPlist(config, (config) => {
    delete config.modResults["aps-environment"];
    return config;
  });
};

module.exports = withoutPushEntitlement;
