GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

ALTER FUNCTION private.can_write_session(text) SECURITY DEFINER;
ALTER FUNCTION private.is_real_user() SECURITY DEFINER;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA private GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;