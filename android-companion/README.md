# Android Companion

`android-companion/` is the repo-local Android side app for Hayalet Ev's central capture hub.

Goals:

- keep the phone camera preview on the phone screen
- receive capture and command sessions from the desktop host
- run Android-side offline transcription and photo capture
- send transcript events and captured media back into Hayalet Ev

Source layout:

- `app/` Android application module
- `app/src/main/kotlin/com/hayaletev/androidcompanion/` Kotlin entry points
- `app/src/main/res/` Android resources

Build contract:

- root `npm run android:check` verifies scaffold and environment status
- root `npm run android:build` assembles the debug APK and publishes a canonical artifact manifest
- root `npm run android:install -- <deviceId>` installs or updates the companion through ADB
- root `npm run android:open -- <deviceId>` launches the companion activity through ADB
- successful builds publish artifacts into `dist/android-companion/`
- debug APKs ship the Vosk Android runtime and bundled Turkish small model

Current status:

- the app owns the phone-side camera preview
- the app polls the desktop bridge over `adb reverse`
- the app records Analyze dictation on the phone microphone and transcribes it offline with Vosk
- the app can acknowledge capture commands and upload Analyze photos
- desktop install/update comparisons read the shared `companion-manifest.json`
