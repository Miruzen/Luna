# LUNA V0.1 architecture

Android app (mic -> SpeechRecognizer -> text)
  -> Edge Function `luna-intent`  (LLM via provider abstraction, validate args, return confirm/clarify)
  -> user confirms in app
  -> Edge Function `luna-execute` (re-validate, refresh Google token, create event, log)
  -> app shows/speaks result

Secrets live only in Supabase Edge Function secrets. The LLM only proposes; the backend validates and executes after confirmation.
