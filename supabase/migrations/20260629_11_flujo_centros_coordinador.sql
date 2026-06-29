-- ============================================================
-- Migración 11 · Flujo self-service de centros + coordinación por correo
-- ------------------------------------------------------------
-- Cambia el modelo de onboarding:
--   1. Cualquier usuario autenticado puede crear un centro de acopio y queda
--      automáticamente como coordinador_centro de ese centro.
--   2. Un coordinador puede invitar a usuarios YA registrados a su centro
--      (como coordinador_centro u operador_inventario) usando su correo.
--   3. Un coordinador puede ceder/agregar coordinación a otro usuario
--      (es el mismo flujo de invitación con rol = coordinador_centro).
--
-- Los SP de auto-servicio son SECURITY DEFINER porque las políticas RLS de
-- centro_acopio y usuario_centro solo permiten INSERT a administrador_sistema
-- (ver migración 07). El control de acceso se hace dentro de cada SP.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Helper: ¿el caller coordina este centro? (o es admin)
-- SECURITY DEFINER para leer usuario_centro sin recursión RLS.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_es_coordinador(p_centro_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT fn_es_admin() OR EXISTS (
    SELECT 1 FROM usuario_centro uc
    JOIN usuario u ON u.id = uc.usuario_id
    WHERE u.auth_user_id = auth.uid()
      AND uc.centro_id = p_centro_id
      AND uc.rol = 'coordinador_centro'
      AND uc.activo = true
  )
$$;

REVOKE ALL ON FUNCTION fn_es_coordinador(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_es_coordinador(uuid) TO authenticated;

-- ------------------------------------------------------------
-- 2. sp_crear_centro_acopio: cualquier usuario crea un centro y queda como
-- coordinador_centro del mismo, en una sola transacción.
-- SECURITY DEFINER: escribe centro_acopio + usuario_centro saltando las
-- políticas admin-only; el único requisito es estar autenticado y tener fila
-- en `usuario`.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_crear_centro_acopio(
  p_nombre     varchar,
  p_direccion  text,
  p_municipio  varchar,
  p_estado_geo varchar,
  p_telefono   varchar DEFAULT NULL,
  p_correo     varchar DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_usuario_id uuid;
  v_centro_id  uuid;
BEGIN
  SELECT id INTO v_usuario_id FROM usuario WHERE auth_user_id = auth.uid();
  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado. Vuelve a iniciar sesión.';
  END IF;

  INSERT INTO centro_acopio(nombre, direccion, municipio, estado_geo, telefono, correo)
  VALUES (p_nombre, p_direccion, p_municipio, p_estado_geo, p_telefono, p_correo)
  RETURNING id INTO v_centro_id;

  INSERT INTO usuario_centro(usuario_id, centro_id, rol)
  VALUES (v_usuario_id, v_centro_id, 'coordinador_centro');

  RETURN jsonb_build_object('ok', true, 'centro_id', v_centro_id);
END;
$$;

REVOKE ALL ON FUNCTION sp_crear_centro_acopio(varchar, text, varchar, varchar, varchar, varchar) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_crear_centro_acopio(varchar, text, varchar, varchar, varchar, varchar) TO authenticated;

-- ------------------------------------------------------------
-- 3. sp_invitar_usuario_centro: un coordinador agrega a un usuario ya
-- registrado a su centro, identificándolo por correo. Solo permite roles
-- coordinador_centro u operador_inventario (administrador_sistema NO se asigna
-- por esta vía).
-- SECURITY DEFINER: valida que el caller coordine el centro y luego escribe
-- usuario_centro saltando la política admin-only.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_invitar_usuario_centro(
  p_centro_id uuid,
  p_correo    varchar,
  p_rol       rol_usuario
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_usuario_id uuid;
  v_nombre     varchar;
  v_apellido   varchar;
BEGIN
  IF NOT fn_es_coordinador(p_centro_id) THEN
    RAISE EXCEPTION 'Solo el coordinador del centro puede agregar usuarios';
  END IF;

  IF p_rol NOT IN ('coordinador_centro', 'operador_inventario') THEN
    RAISE EXCEPTION 'Rol inválido: solo coordinador_centro u operador_inventario';
  END IF;

  SELECT id, nombre, apellido INTO v_usuario_id, v_nombre, v_apellido
  FROM usuario
  WHERE lower(correo) = lower(trim(p_correo)) AND activo = true
  LIMIT 1;

  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'No existe un usuario registrado con el correo %', p_correo;
  END IF;

  INSERT INTO usuario_centro(usuario_id, centro_id, rol)
  VALUES (v_usuario_id, p_centro_id, p_rol)
  ON CONFLICT (usuario_id, centro_id)
  DO UPDATE SET rol = EXCLUDED.rol, activo = true;

  RETURN jsonb_build_object(
    'ok', true,
    'usuario_id', v_usuario_id,
    'nombre', v_nombre,
    'apellido', v_apellido
  );
END;
$$;

REVOKE ALL ON FUNCTION sp_invitar_usuario_centro(uuid, varchar, rol_usuario) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_invitar_usuario_centro(uuid, varchar, rol_usuario) TO authenticated;

-- ------------------------------------------------------------
-- 4. sp_mis_centros_coordinados: centros donde el caller es coordinador_centro
-- activo. Alimenta el selector de la pantalla de equipo.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_mis_centros_coordinados()
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  RETURN (
    SELECT jsonb_agg(row_to_json(c))
    FROM (
      SELECT ca.id, ca.nombre
      FROM usuario_centro uc
      JOIN usuario u       ON u.id = uc.usuario_id
      JOIN centro_acopio ca ON ca.id = uc.centro_id
      WHERE u.auth_user_id = auth.uid()
        AND uc.rol = 'coordinador_centro'
        AND uc.activo = true
        AND ca.activo = true
      ORDER BY ca.nombre
    ) c
  );
END;
$$;

REVOKE ALL ON FUNCTION sp_mis_centros_coordinados() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_mis_centros_coordinados() TO authenticated;

-- ------------------------------------------------------------
-- 5. sp_listar_equipo: integrantes de un centro que el caller coordina.
-- SECURITY DEFINER + verificación explícita de coordinación.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_listar_equipo(p_centro_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT fn_es_coordinador(p_centro_id) THEN
    RAISE EXCEPTION 'Solo el coordinador del centro puede ver el equipo';
  END IF;

  RETURN (
    SELECT jsonb_agg(row_to_json(r))
    FROM (
      SELECT u.id, u.nombre, u.apellido, u.correo, uc.rol, uc.activo
      FROM usuario_centro uc
      JOIN usuario u ON u.id = uc.usuario_id
      WHERE uc.centro_id = p_centro_id
      ORDER BY uc.activo DESC, uc.rol, u.apellido
    ) r
  );
END;
$$;

REVOKE ALL ON FUNCTION sp_listar_equipo(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_listar_equipo(uuid) TO authenticated;
