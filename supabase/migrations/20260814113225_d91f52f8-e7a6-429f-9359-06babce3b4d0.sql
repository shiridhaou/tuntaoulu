CREATE OR REPLACE FUNCTION public.is_active_session(_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.sessions s WHERE s.code = upper(trim(_code)) AND s.active);
$function$;

GRANT EXECUTE ON FUNCTION public.is_active_session(text) TO anon, authenticated, service_role;