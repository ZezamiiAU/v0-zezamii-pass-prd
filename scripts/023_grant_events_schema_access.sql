GRANT USAGE ON SCHEMA events TO anon, authenticated, service_role;
GRANT INSERT ON events.outbox TO anon, authenticated, service_role;
GRANT SELECT ON events.outbox TO service_role;
