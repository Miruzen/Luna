# android-app

Create the project in Android Studio (Empty Activity, Kotlin, Jetpack Compose), package `com.luna.app`, so Gradle files are generated correctly. Then use this structure under `app/src/main/java/com/luna/app/`:

```
ui/        Compose screens (Home: mic button, transcript, confirm card)
voice/     SpeechRecognizer + TextToSpeech wrappers
network/   Supabase client, calls to luna-intent / luna-execute
model/     data classes mirroring supabase/functions/_shared/types.ts
MainActivity.kt
```

Only the Supabase anon key and Google OAuth *client ID* belong in the app. Nothing else.
