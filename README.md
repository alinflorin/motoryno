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

- Possibility of all app data to be stored/synced to either iCloud (for iOS), or Google Drive (or other alternative) for Android.

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
- Data sync/backup settings (Google Drive or iCloud)

# Technical implementation details

The application will store all its data and settings into a single JSON file stored in app data for ios and android, and Local Storage when running on Web (storage shall be abstractized in the code).
For Android and iOS, the Sync feature should be enabled only (syncing the JSON file to iCloud or Drive?). This is so users won't have to log in into the app at all.

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
      "cron": "0 8 * * *", // or null
      "ring": true,
      "vibrate": true
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
        },
        {
          "name": "Other", // catch-all default item, for work that doesn't fit a specific tracked item; no interval, so never due/overdue
          "isActive": true,
          "timeIntervalDays": null,
          "kmInterval": null
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

When first time opening the app, the Intro and Welcome/Set language/etc steps shall be followed. If there's an existing JSON file in the cloud, it has to be pulled, and if the onboarding has already happened, don't show those screens.

When adding a new car, if a BLE OBD adapter is selected, the app should try and self-detect where relevant data is located, by trying PIDs.
The name, VIN, odometer of the car should be pulled.
The OBD adapter details shall also be stored in JSON.

When the OBD BLE adapter is detected and the connection is established, the app should always, in the background, identify which car it is, read the odometer and store the value, once.
