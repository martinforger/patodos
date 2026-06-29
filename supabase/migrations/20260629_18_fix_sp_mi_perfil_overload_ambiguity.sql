-- Corrige la ambigüedad en la sobrecarga de sp_mi_perfil.
-- Al tener sp_mi_perfil(uuid DEFAULT NULL), PostgreSQL no puede decidir
-- entre llamar a sp_mi_perfil() o sp_mi_perfil(DEFAULT) cuando no se pasan argumentos.
-- Solución: eliminar el valor DEFAULT NULL de la versión de 1 parámetro.

-- 1. Elimina la función con parámetro por defecto
DROP FUNCTION IF EXISTS sp_mi_perfil(uuid);

-- 2. Crea la versión de 1 parámetro SIN valor por defecto
CREATE OR REPLACE FUNCTION sp_mi_perfil(p_centro_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_perfil jsonb;
BEGIN
  -- Intenta obtener perfil para el centro solicitado (si se especificó)
  IF p_centro_id IS NOT NULL THEN
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
      AND uc.centro_id = p_centro_id;
  END IF;

  -- Fallback: mayor jerarquía de rol (comportamiento original)
  IF v_perfil IS NULL THEN
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
  END IF;

  RETURN v_perfil;
END;
$$;

-- Permisos
REVOKE ALL ON FUNCTION sp_mi_perfil(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_mi_perfil(uuid) TO authenticated;

-- 3. Recrea la versión de 0 parámetros para que delegue con NULL explícito
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
