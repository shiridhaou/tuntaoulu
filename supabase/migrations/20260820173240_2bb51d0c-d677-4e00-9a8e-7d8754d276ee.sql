CREATE OR REPLACE FUNCTION private.can_manage_results(_code text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT private.is_real_user() OR EXISTS (
    SELECT 1 FROM public.session_members m
    JOIN public.sessions s ON s.code = m.session_code AND s.active
    WHERE m.session_code = _code
      AND m.user_id = auth.uid()
      AND (
        m.role ILIKE 'chief%'
        OR m.role ILIKE 'head%'
        OR m.role ILIKE 'admin%'
        OR m.role ILIKE 'technical%'
        OR m.role ILIKE 'assistant%'
        OR upper(coalesce(m.role, '')) IN ('TA', 'AHJ')
        OR upper(coalesce(m.slot, '')) LIKE 'AHJ%'
      )
  );
$function$;