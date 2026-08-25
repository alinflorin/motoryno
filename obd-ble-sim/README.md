# obd-ble-sim

Simulates a BLE ELM327-compatible OBD2 adapter, so you can test the
Motoryno app's BLE scan/connect/VIN/odometer flow (see `src/obd/elm327.ts`)
without a real car or dongle.

It's a Node.js **BLE peripheral** (GATT server) - your computer advertises
itself as a fake OBD2 dongle and the phone running the app connects to it,
exactly like a real one.

## Requirements

- A Mac (or Linux box) with a Bluetooth radio, separate from the phone
  running the app.
- Node.js 18+.
- On macOS: Xcode Command Line Tools (`xcode-select --install`) to build the
  native `@abandonware/bleno` binding, and you'll get a one-time system
  prompt to allow Bluetooth access for your terminal app.
- On Linux: `bluez` and running as a user with the right `setcap` on the
  node binary (see the [bleno README](https://github.com/abandonware/bleno)
  if you go this route) - macOS is the easier path.

This can't run on the same phone as the app (no BLE peripheral support in
Expo Go), and iOS Simulator/Android Emulator can't do real BLE at all - you
need a **real phone** running the app and a **separate machine** running
this script.

## Setup

```sh
cd obd-ble-sim
npm install
npm start
```

You should see it start advertising as `OBDII`. In the app, go to add/connect
an OBD adapter and scan - it should show up like any other BLE dongle.

## Configuring the simulated car

Environment variables, all optional:

| Var                | Default              | Meaning                                          |
| ------------------ | -------------------- | ------------------------------------------------- |
| `OBD_NAME`          | `OBDII`               | Advertised BLE device name                        |
| `OBD_VIN`           | `WDD2050471F123456`   | VIN returned for Mode 09 PID 02                   |
| `OBD_ODOMETER_KM`   | `123456`              | Odometer returned for Mode 01 PID A6               |
| `OBD_PROFILE`       | `hm10`                | GATT shape: `hm10`, `fff0`, or `nordic`            |

Example:

```sh
OBD_VIN=WBA3A5C50DF123456 OBD_ODOMETER_KM=98765 OBD_PROFILE=nordic npm start
```

`OBD_PROFILE` lets you exercise the three chipset shapes the app already
knows about (`KNOWN_UART_PROFILES` in `src/obd/elm327.ts`) - useful for
checking the app's profile-detection fallback path actually finds each one.

## What it simulates

- Standard AT command handshake (`ATZ`, `ATE0`, `ATL0`, `ATS0`, `ATH0`,
  `ATSP0`, `ATSH...`) - always answered `OK` (`ATZ` gets a version banner).
- `0902` - VIN, per SAE J1979 Mode 09 PID 02.
- `01A6` - odometer, per SAE J1979-2 Mode 01 PID A6 (0.1 km/bit).
- Any other Mode 01 or Mode 22 (UDS `ReadDataByIdentifier`) request -
  `NO DATA`, simulating a car that doesn't support that PID/DID. This is
  realistic: most cars only expose the odometer through a brand-specific
  Mode 22 DID that isn't modeled here, so the app's brand-specific
  candidates (`catalogs/odometerDids.ts`) are expected to mostly miss and
  fall through to the `01A6` standard PID, same as a real 2022+ vehicle.

It logs every command it receives and response it sends, so the terminal
running it doubles as a live trace of what the app is asking for.
