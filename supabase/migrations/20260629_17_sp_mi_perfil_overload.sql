-- Recrea la sobrecarga sp_mi_perfil() con 0 argumentos
-- para mantener la compatibilidad con llamadas de Postgrest/Supabase que no envían parámetros.
-- Delegará internamente a sp_mi_perfil(p_centro_id => NULL).

CREATE OR REPLACE FUNCTION sp_mi_perfil()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN sp_mi_perfil(NULL::uuid);
END;
$$;

REVOKE ALL ON FUNCTION sp_mi_perfil() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_mi_perfil() TO authenticated;
