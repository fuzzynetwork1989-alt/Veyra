# Veyra Desktop & Mobile Installation

Install the native Veyra clients on Windows desktop and Android. Both apps wrap the same web UI with clickable icon navigation, settings toggles, advanced settings, and custom instructions.

## Prerequisites

| Platform | Requirements |
|----------|--------------|
| **All** | Node.js 18+, npm 9+, Veyra API running (`http://localhost:8000` or your server) |
| **Desktop** | Windows 10/11 |
| **Android APK** | Android Studio + Android SDK, Java 17 |

---

## 1. Install dependencies

```bash
cd veyra
npm install
```

---

## 2. Configure API URL (important for mobile)

On a phone or packaged app, `localhost` points to the device — not your PC.

1. Start the Veyra API on your machine.
2. Find your LAN IP (e.g. `ipconfig` → `192.168.1.42`).
3. In the app **Settings → Connection**, set:

   ```
   API URL: http://192.168.1.42:8000
   ```

4. Tap **Test connection**, then **Save settings**.

---

## 3. Desktop (Windows installer)

### Development (live reload)

```bash
npm run desktop:dev
```

Opens Electron loading `http://localhost:3000` with hot reload.

### Run desktop without installer (quick)

```bash
npm install
npm run build:native
npm run start:prod --workspace=@veyra/desktop
```

Launches Electron with the bundled static web UI. Run `npm install` first so the `electron` binary is available (do not rely on `npx` to download it on first launch).

### Production installer

Close any running Veyra/Electron windows first (they lock files during packaging).

```bash
npm install
npm run desktop:dist
```

Outputs:

| Artifact | Path |
|----------|------|
| NSIS installer | `apps/desktop/dist/Veyra-Setup-0.1.0.exe` (~75 MB) |
| Unpacked app | `apps/desktop/dist/win-unpacked/Veyra.exe` |

If `electron-builder` fails with a `7zip-bin` error, run `npm install` at the repo root and retry. You can always run the unpacked build:

```bash
npm run pack --workspace=@veyra/desktop
apps/desktop/dist/win-unpacked/Veyra.exe
```

### Install steps

1. Run `Veyra-Setup-0.1.0.exe`.
2. Choose install directory (or accept default).
3. Check **Create desktop shortcut**.
4. Launch **Veyra** from Start Menu or desktop.
5. Sign in at `/login`.
6. Open **Settings** (bottom/side icon dock) and set your API URL if not using localhost.

---

## 4. Android APK

### One-time Android Studio setup

1. Install [Android Studio](https://developer.android.com/studio).
2. Open SDK Manager → install **Android SDK 34**, **Build-Tools 34**, **Platform-Tools**.
3. Set environment variables:

   ```powershell
   $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
   $env:PATH += ";$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\tools"
   ```

### Initialize Capacitor Android project (first time only)

```bash
cd apps/mobile
npx cap add android
cd ../..
```

### Build debug APK

Requires Android Studio (JDK 17 + SDK 34). On Windows, use the helper script:

```powershell
.\scripts\setup-android.ps1
```

Or manually:

```bash
npm run mobile:apk
```

Output: `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`

### Install APK on device

1. Enable **Developer options** → **USB debugging** on your Android phone.
2. Connect via USB, or copy `app-debug.apk` to the device.
3. Install:

   ```bash
   adb install apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
   ```

4. Open **Veyra** → sign in → **Settings** → set API URL to your PC's LAN address.

---

## 5. Settings guide

| Section | What it controls |
|---------|------------------|
| **Connection** | API URL, timeout, test connection |
| **Custom instructions** | Persistent system prompt for every chat |
| **AI behavior** | Quality mode, temperature, max tokens, RAG/agents/streaming defaults |
| **Experience** | Model/latency display, compact mode, haptics, theme |
| **Advanced** | Telemetry, auto-refresh tokens, debug mode, reset/sign out |

Tap the **Advanced settings** header to expand/collapse advanced toggles.

---

## 6. Navigation

The icon dock is always visible on Chat, Tasks, and Settings:

| Icon | Route |
|------|-------|
| Home | `/` |
| Chat | `/chat` |
| Tasks | `/tasks` |
| Settings | `/settings` |

Active icon is highlighted in blue.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| API unreachable on phone | Use LAN IP, not `localhost`; allow port 8000 in Windows Firewall |
| Desktop blank screen | Run `npm run build:native --workspace=@veyra/web` then `npm run dist:win --workspace=@veyra/desktop` |
| APK build fails | Open `apps/mobile/android` in Android Studio and sync Gradle |
| OAuth fails on mobile | Configure redirect URIs for Capacitor (`https://localhost/oauth/...`) |