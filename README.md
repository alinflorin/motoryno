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

- Odometer live update - via OBD2 (BLE). This is the most complex component of the app. It requires a broad compatibility configuration for car makes and models, as each will store this information differently in the OBD modules (different modules, PIDs..). The app should allow configuring an OBD adapter connection and, when the connection is being sensed (BLE) - it will detect which car it is, read the odometer and perform a live update.

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
