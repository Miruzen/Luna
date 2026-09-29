// TODO(step 8): runs ONLY after the user confirms in the app.
// 1. verify JWT  2. re-validate args with validateEventArgs (never trust the client)
// 3. load refresh_token (service role)  4. refresh access token  5. createCalendarEvent
// 6. write calendar_events_log  7. return success/error
Deno.serve(() => new Response(JSON.stringify({ error: "not implemented" }), { status: 501 }));
