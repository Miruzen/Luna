-- Stage 3.1 F3.1-4: public.rls_auto_enable() is Supabase's event trigger function that enables RLS
-- on every new table in public (event trigger ensure_rls). It stays. Event trigger functions cannot
-- be called directly, but the advisor flags the EXECUTE grant to API roles; remove it (PUBLIC too,
-- or anon/authenticated keep it through PUBLIC). The owner (postgres) keeps it.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
