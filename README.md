# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

# Project purpose

The Motoryno app helps users track the service intervals on their car parts, automatically or semi-automatically.

# How it works/Requirements

## Platforms

Expo (Universal look and feel) app with React Native, targeting latest Android and iOS.

## Data collected:

- List of cars (VIN is the unique identifier). For each car:
  - Nickname
  - Make, model, year
  - Number of km/miles on the odometer (filled in manually or automatically)
  - A list of default tracked service items will be loaded and activated for tracking. But still editable and configurable. Examples:
    - Engine oil - every 10k km or 1 year
    - Battery - every 5y
    - Oil filter - every 10k km or 1 year
    - Etc.
  - Service visits log. These would be manually added by the user. Each service visit log to include:
    - Shop name
    - Price
    - Date of intervention
    - Odometer at the time of the visit
    - Items performed (multiselect from the active tracking list of items)

## Automations:

- Odometer read (when car is created, and afterwards) + live update - via OBD2 (BLE). This is the most complex component of the app. It requires a broad compatibility configuration for car makes and models, as each will store this information differently in the OBD modules (different modules, PIDs..). The app should allow configuring an OBD adapter connection and, when the connection is being sensed (BLE) - it will detect which car it is, read the odometer and perform a live update.

- App data (the single JSON file) is backed up automatically via each platform's built-in device backup — iCloud Backup on iOS, Auto Backup for Apps on Android — using whichever account is already signed into the device. No in-app login or account screen. This is backup/restore semantics (recovered on reinstall or new-device setup), not live multi-device sync.

## Notification feature:

Every morning (configurable), a notification will be sent to the user, if there are any overdue service items, for any car.

## DYI service intervention feature + parts search

Provide documentation and schemas/diagrams (and parts and prices) on how to perform servicing for items (and overdue items). Like WIS/EPC for Mercedes.

## DTC detector feature:

We can leverage the OBD connectivity to scan for DTCs at a scheduled interval. It will scan only when connected to the car and report the found DTCs.
Nice to have: Online search for DTC explanation.

## Agent integration:

Ability to share all this app data, including DTCs, with AI apps (Claude, Gemini, ChatGPT). Not sure how to do the integration. Share button?

## Settings:

- Units of measurement (imperial/metric)
- Theme (system - default / dark / light)
- Language (app should support i18n for en and ro)
- Data backup is handled by the OS (see Automations); the app exposes manual download/import/share-with-AI actions under Settings → Data

# Technical implementation details

The application will store all its data and settings into a single JSON file stored in app data for ios and android, and Local Storage when running on Web (storage shall be abstractized in the code).

There is no in-app login or account system, and no live multi-device sync. Instead, the JSON file is written to each platform's standard per-app document directory, which both iOS and Android already include in their OS-level device backup by default:

- **iOS**: files under the app's document directory are included in iCloud Backup automatically whenever the user has iCloud Backup enabled on their device (the default for most users). Restored automatically when they restore their phone or set up a new one.
- **Android**: Auto Backup for Apps (on by default for apps targeting API 23+) backs up the app's internal files directory to the user's Google Drive (a private, app-scoped area, not visible in their Drive UI), using whichever Google account is already on the device. Restored on reinstall or new-device setup.

Both are true "no login" mechanisms since they piggyback on the OS account already configured on the device — no OAuth, no sign-in screen, no custom native sync module required. The tradeoff is that this is backup/restore, not real-time sync: a change made on one device won't appear on another until a reinstall/restore happens.

The app additionally exposes manual data portability actions (Settings → Data): download the JSON as a file, import/restore from a previously downloaded file, and share the data with an AI app.

Data Model (JSON object with arrays):

```
{
  "settings": {
    "onboardingDone": false,
    "theme": "system",
    "language": "en",
    "useImperialUnits": false,
    "currency": "EUR",
    "notifications": {
      "cron": "0 8 * * *" // or null
    },

  },
  "data": {
    "cars": [
    {
      "vin": "asd",
      "displayName": "C250",
      "make": "Mercedes-Benz",
      "model": "C250 CDI",
      "year": 2011,
      "odometerKm": 350000,
      "trackedServiceItems": [
        {
          "name": "item1",
          "isActive": true,
          "timeIntervalDays": 365, // or null
          "kmInterval": 10000 // or null
        }
      ],
      "serviceVisits": [
        {
          "uuid": "sdsffs",
          "timestamp": 2112131313,
          "odometerKm": 349000,
          "shopName": "some shop",
          "spend": 234,
          "itemsDone": ["item1"],
          "comments": null // optional freeform notes about the visit, or null
        }
      ],
      "obd": {
        "deviceName": "asd",
        "deviceAddress": "0x234234",
        "lastSyncedAt": 172333434234
      } // or null
    }
  ]
  }
}
```

When first opening the app, the Intro and Welcome/Set language/etc steps shall be followed. If the JSON file already exists on disk (e.g. because it was restored by the OS from an iCloud/Android backup on a new device) and onboarding was already marked done in it, skip those screens.

When adding a new car, if a BLE OBD adapter is selected, the app should try and self-detect where relevant data is located, by trying PIDs.
The name, VIN, odometer of the car should be pulled.
The OBD adapter details shall also be stored in JSON.

When the OBD BLE adapter is detected and the connection is established, the app should always, in the background, identify which car it is, read the odometer and store the value, once.
