CREATE OR REPLACE FUNCTION private.session_role_claimable(_code text, _role text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _role IS NULL THEN true
    WHEN lower(_role) NOT IN (
      'chief','chief-referee','technical-assistant','ta','assistant-referee',
      'judge','judge-a','judge-b','judge-c','a','b','c','ahj','judge-ahj',
      'var','display','spectator'
    ) THEN false
    WHEN lower(_role) IN ('chief','chief-referee','technical-assistant','ta') THEN NOT EXISTS (
      SELECT 1 FROM public.session_members m
      WHERE m.session_code = _code
        AND lower(m.role) = lower(_role)
        AND m.user_id <> auth.uid()
    )
    ELSE true
  END;
$function$;

CREATE OR REPLACE FUNCTION private.owns_judge_slot(_code text, _slot text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT private.can_manage_results(_code) OR (
    private.is_session_member(_code) AND (
      EXISTS (
        SELECT 1 FROM public.session_members m
        WHERE m.session_code = _code
          AND m.user_id = auth.uid()
          AND m.slot = _slot
      )
      OR NOT EXISTS (
        SELECT 1 FROM public.session_members m
        WHERE m.session_code = _code
          AND m.slot = _slot
          AND m.user_id <> auth.uid()
      )
    )
  );
$function$;