-- Agrega sp_mis_centros y extiende sp_mi_perfil para soporte multi-centro.
-- El usuario puede pertenecer a varios centros con distintos roles.
-- sp_mis_centros  → retorna todos los centros activos del usuario autenticado.
-- sp_mi_perfil    → ahora acepta p_centro_id opcional para seleccionar contexto.

-- ─── sp_mis_centros ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sp_mis_centros()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_resultado jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'centro_id', uc.centro_id,
      'centro',    ca.nombre,
      'rol',       uc.rol
    )
    ORDER BY CASE uc.rol
      WHEN 'administrador_sistema' THEN 1
      WHEN 'coordinador_centro'    THEN 2
      WHEN 'operador_inventario'   THEN 3
      ELSE 4
    END, ca.nombre
  ) INTO v_resultado
  FROM usuario u
  JOIN usuario_centro uc ON uc.usuario_id = u.id AND uc.activo = true
  JOIN centro_acopio  ca ON ca.id = uc.centro_id AND ca.activo = true
  WHERE u.auth_user_id = auth.uid();

  RETURN COALESCE(v_resultado, '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION sp_mis_centros() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_mis_centros() TO authenticated;

-- ─── sp_mi_perfil (extiende para aceptar p_centro_id opcional) ───────────────
-- Si p_centro_id es NULL → retorna el centro de mayor jerarquía (comportamiento original).
-- Si p_centro_id se pasa → retorna el perfil para ese centro si el usuario tiene acceso;
--   si no tiene acceso cae en el centro de mayor jerarquía como fallback seguro.

CREATE OR REPLACE FUNCTION sp_mi_perfil(p_centro_id uuid DEFAULT NULL)
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

REVOKE ALL ON FUNCTION sp_mi_perfil(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_mi_perfil(uuid) TO authenticated;
