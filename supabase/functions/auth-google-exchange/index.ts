// TODO(step 3): receives the Google authorization code from the app,
// exchanges it server-side using GOOGLE_CLIENT_SECRET, and stores the refresh_token
// in user_google_tokens (service role). Never do this exchange on the device.
Deno.serve(() => new Response(JSON.stringify({ error: "not implemented" }), { status: 501 }));
