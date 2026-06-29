-- Corrige sp_mi_perfil para usuarios con múltiples asignaciones de centro.
-- Sin ORDER BY, LIMIT 1 retornaba un rol arbitrario; si el admin creaba un
-- segundo centro quedaba como coordinador_centro y el layout lo redirigía
-- fuera de la sección admin.
-- Fix: ordenar por jerarquía de rol (admin > coordinador > operador).

CREATE OR REPLACE FUNCTION sp_mi_perfil()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_perfil jsonb;
BEGIN
  SELECT jsonb_build_object(
    'usuario_id', u.id,
    'nombre',     u.nombre,
    'apellido',   u.apellido,
    'correo',     u.correo,
    'centro_id',  uc.centro_id,
    'centro',     ca.nombre,
    'rol',        uc.rol
  ) INTO v_perfil
  FROM usuario u
  JOIN usuario_centro uc ON uc.usuario_id = u.id AND uc.activo = true
  JOIN centro_acopio  ca ON ca.id = uc.centro_id AND ca.activo = true
  WHERE u.auth_user_id = auth.uid()
  ORDER BY CASE uc.rol
    WHEN 'administrador_sistema' THEN 1
    WHEN 'coordinador_centro'    THEN 2
    WHEN 'operador_inventario'   THEN 3
    ELSE 4
  END
  LIMIT 1;

  RETURN v_perfil;
END;
$$;

REVOKE ALL ON FUNCTION sp_mi_perfil() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_mi_perfil() TO authenticated;
