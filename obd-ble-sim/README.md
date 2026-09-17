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
| `OBD_VIN`           | `WDD2050471F123456`   | VIN returned for Mode 09 PID 02 (`WDD2040471F123456` for `w204`) |
| `OBD_ODOMETER_KM`   | `123458`              | Odometer the simulated car reports                 |
| `OBD_PROFILE`       | `hm10`                | GATT shape: `hm10`, `fff0`, or `nordic`            |
| `OBD_CAR`           | `generic`             | Simulated car: `generic` (answers 01 A6) or `w204` (see below) |

Example:

```sh
OBD_VIN=WBA3A5C50DF123456 OBD_ODOMETER_KM=98765 OBD_PROFILE=nordic npm start
```

`OBD_PROFILE` lets you exercise the three chipset shapes the app already
knows about (`KNOWN_UART_PROFILES` in `src/obd/elm327.ts`) - useful for
checking the app's profile-detection fallback path actually finds each one.

## What it simulates

- The ELM327 AT command set the app uses, with the adapter state that
  matters tracked: `ATSH` transmit header, `ATCRA` receive filter,
  `ATSP`/`ATDPN` protocol, `ATH`/`ATS`/`ATCAF` formatting flags and `ATMA`
  monitor mode (frames stream until the app sends any byte, then `STOPPED`).
- `0902` - VIN, per SAE J1979 Mode 09 PID 02 (multi-frame, like a real adapter).
- `generic` car: `01A6` odometer per SAE J1979-2 (0.1 km/bit); everything
  else is `NO DATA`/negative, like a car that doesn't support it.
- `w204` car - modelled on what `src/obd/odometer/mercedes.ts` expects from
  a Mercedes W204-generation car, so the app's learn flow ("Find odometer")
  can be exercised end to end:
  - no `01A6`;
  - a UDS engine ECU at `7E0`/`7E8` (`10 03`, `22 F190`, negatives otherwise);
  - a UDS EZS at `612`/`482` that only answers once the app has set
    `ATCRA 482`, and serves the km on `22 0100` after `10 03`;
  - a KWP2000 cluster at `742`/`4A8` that needs Daimler's `10 92` session
    before `21 42` returns the km (and answers `3E 00` with a negative
    response, which still proves it's there);
  - a periodic km broadcast on frame `0A8` (bytes 4-6) in `ATMA` mode.
  The EZS/cluster identifiers and the cluster's CAN IDs are made up - the
  real ones aren't public, which is exactly why the app learns them.

It logs every command it receives and response it sends, so the terminal
running it doubles as a live trace of what the app is asking for.
