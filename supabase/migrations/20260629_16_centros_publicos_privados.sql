-- ============================================================
-- Migración 16 · Centros públicos y privados + solicitudes de unión
-- ------------------------------------------------------------
-- Nuevas capacidades:
--   1. Cada centro tiene un tipo: público o privado.
--      - Privado: solo se puede unir por invitación del coordinador (flujo existente).
--      - Público: aparece en la lista al registrarse; el usuario puede solicitar unirse.
--   2. Nueva tabla solicitud_union_centro: guarda las solicitudes de unión a centros públicos.
--   3. El coordinador aprueba o rechaza cada solicitud desde su panel de equipo.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Agregar columna es_publico a centro_acopio
--    Default true: los centros existentes quedan como públicos.
-- ------------------------------------------------------------
ALTER TABLE centro_acopio
  ADD COLUMN IF NOT EXISTS es_publico boolean NOT NULL DEFAULT true;

-- ------------------------------------------------------------
-- 2. Tabla solicitud_union_centro
-- ------------------------------------------------------------
CREATE TYPE estado_solicitud_union AS ENUM ('pendiente', 'aprobada', 'rechazada');

CREATE TABLE IF NOT EXISTS solicitud_union_centro (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  centro_id   uuid        NOT NULL REFERENCES centro_acopio(id),
  usuario_id  uuid        NOT NULL REFERENCES usuario(id),
  estado      estado_solicitud_union NOT NULL DEFAULT 'pendiente',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (centro_id, usuario_id)
);

CREATE TRIGGER trg_updated_at_solicitud_union
  BEFORE UPDATE ON solicitud_union_centro
  FOR EACH ROW EXECUTE FUNCTION fn_actualizar_updated_at();

-- RLS
ALTER TABLE solicitud_union_centro ENABLE ROW LEVEL SECURITY;

-- El usuario ve sus propias solicitudes; el coordinador ve las de su centro.
CREATE POLICY "solicitud_union_select" ON solicitud_union_centro
  FOR SELECT TO authenticated
  USING (
    usuario_id = (SELECT id FROM usuario WHERE auth_user_id = auth.uid())
    OR fn_es_coordinador(centro_id)
  );

-- Solo los SPs SECURITY DEFINER escriben en esta tabla.
CREATE POLICY "solicitud_union_insert_definer" ON solicitud_union_centro
  FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "solicitud_union_update_definer" ON solicitud_union_centro
  FOR UPDATE TO authenticated
  USING (false);

-- ------------------------------------------------------------
-- 3. Actualizar sp_crear_centro_acopio para incluir es_publico.
--    Se elimina la firma vieja para que no quede ambigüedad.
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS sp_crear_centro_acopio(varchar, text, varchar, varchar, varchar, varchar);

CREATE OR REPLACE FUNCTION sp_crear_centro_acopio(
  p_nombre     varchar,
  p_direccion  text,
  p_municipio  varchar,
  p_estado_geo varchar,
  p_telefono   varchar  DEFAULT NULL,
  p_correo     varchar  DEFAULT NULL,
  p_es_publico boolean  DEFAULT true
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

  INSERT INTO centro_acopio(nombre, direccion, municipio, estado_geo, telefono, correo, es_publico)
  VALUES (p_nombre, p_direccion, p_municipio, p_estado_geo, p_telefono, p_correo, p_es_publico)
  RETURNING id INTO v_centro_id;

  INSERT INTO usuario_centro(usuario_id, centro_id, rol)
  VALUES (v_usuario_id, v_centro_id, 'coordinador_centro');

  RETURN jsonb_build_object('ok', true, 'centro_id', v_centro_id);
END;
$$;

REVOKE ALL ON FUNCTION sp_crear_centro_acopio(varchar, text, varchar, varchar, varchar, varchar, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_crear_centro_acopio(varchar, text, varchar, varchar, varchar, varchar, boolean) TO authenticated;

-- ------------------------------------------------------------
-- 4. Actualizar sp_registrar_centro_acopio (admin) para incluir es_publico.
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS sp_registrar_centro_acopio(varchar, text, varchar, varchar, varchar, varchar);

CREATE OR REPLACE FUNCTION sp_registrar_centro_acopio(
  p_nombre     varchar,
  p_direccion  text,
  p_municipio  varchar,
  p_estado_geo varchar,
  p_telefono   varchar  DEFAULT NULL,
  p_correo     varchar  DEFAULT NULL,
  p_es_publico boolean  DEFAULT true
)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO centro_acopio(nombre, direccion, municipio, estado_geo, telefono, correo, es_publico)
  VALUES (p_nombre, p_direccion, p_municipio, p_estado_geo, p_telefono, p_correo, p_es_publico)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'ok', true);
END;
$$;

REVOKE ALL ON FUNCTION sp_registrar_centro_acopio(varchar, text, varchar, varchar, varchar, varchar, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_registrar_centro_acopio(varchar, text, varchar, varchar, varchar, varchar, boolean) TO authenticated;

-- ------------------------------------------------------------
-- 5. Actualizar sp_listar_centros para incluir es_publico
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_listar_centros()
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  RETURN (
    SELECT jsonb_agg(row_to_json(c))
    FROM (
      SELECT id, nombre, municipio, estado_geo, telefono, activo, es_publico
      FROM centro_acopio
      ORDER BY nombre
    ) c
  );
END;
$$;

REVOKE ALL ON FUNCTION sp_listar_centros() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_listar_centros() TO authenticated;

-- ------------------------------------------------------------
-- 5b. Actualizar sp_mis_centros_coordinados para incluir es_publico
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_mis_centros_coordinados()
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  RETURN (
    SELECT jsonb_agg(row_to_json(c))
    FROM (
      SELECT ca.id, ca.nombre, ca.es_publico
      FROM usuario_centro uc
      JOIN usuario u        ON u.id = uc.usuario_id
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
-- 6. sp_listar_centros_publicos: centros públicos con estado de solicitud del caller
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_listar_centros_publicos()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_usuario_id uuid;
BEGIN
  SELECT id INTO v_usuario_id FROM usuario WHERE auth_user_id = auth.uid();

  RETURN (
    SELECT jsonb_agg(row_to_json(r))
    FROM (
      SELECT
        ca.id,
        ca.nombre,
        ca.municipio,
        ca.estado_geo,
        ca.telefono,
        (
          SELECT suc.estado::text
          FROM solicitud_union_centro suc
          WHERE suc.centro_id = ca.id AND suc.usuario_id = v_usuario_id
          ORDER BY suc.created_at DESC
          LIMIT 1
        ) AS solicitud_estado,
        EXISTS (
          SELECT 1 FROM usuario_centro uc
          WHERE uc.centro_id = ca.id AND uc.usuario_id = v_usuario_id AND uc.activo = true
        ) AS ya_es_miembro
      FROM centro_acopio ca
      WHERE ca.activo = true AND ca.es_publico = true
      ORDER BY ca.nombre
    ) r
  );
END;
$$;

REVOKE ALL ON FUNCTION sp_listar_centros_publicos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_listar_centros_publicos() TO authenticated;

-- ------------------------------------------------------------
-- 7. sp_solicitar_union_centro: usuario solicita unirse a un centro público
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_solicitar_union_centro(p_centro_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_usuario_id uuid;
  v_es_publico boolean;
BEGIN
  SELECT id INTO v_usuario_id FROM usuario WHERE auth_user_id = auth.uid();
  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado.';
  END IF;

  SELECT es_publico INTO v_es_publico
  FROM centro_acopio WHERE id = p_centro_id AND activo = true;

  IF v_es_publico IS NULL THEN
    RAISE EXCEPTION 'Centro no encontrado.';
  END IF;
  IF NOT v_es_publico THEN
    RAISE EXCEPTION 'Este centro es privado. Contacta al coordinador para ser invitado.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM usuario_centro
    WHERE usuario_id = v_usuario_id AND centro_id = p_centro_id AND activo = true
  ) THEN
    RAISE EXCEPTION 'Ya eres miembro de este centro.';
  END IF;

  INSERT INTO solicitud_union_centro(centro_id, usuario_id)
  VALUES (p_centro_id, v_usuario_id)
  ON CONFLICT (centro_id, usuario_id)
  DO UPDATE SET estado = 'pendiente', updated_at = now()
  WHERE solicitud_union_centro.estado = 'rechazada';

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION sp_solicitar_union_centro(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_solicitar_union_centro(uuid) TO authenticated;

-- ------------------------------------------------------------
-- 8. sp_listar_solicitudes_union: coordinador ve solicitudes pendientes de su centro
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_listar_solicitudes_union(p_centro_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT fn_es_coordinador(p_centro_id) THEN
    RAISE EXCEPTION 'Solo el coordinador del centro puede ver las solicitudes de unión';
  END IF;

  RETURN (
    SELECT jsonb_agg(row_to_json(r))
    FROM (
      SELECT
        suc.id,
        suc.estado,
        suc.created_at,
        u.id   AS usuario_id,
        u.nombre,
        u.apellido,
        u.correo,
        u.telefono
      FROM solicitud_union_centro suc
      JOIN usuario u ON u.id = suc.usuario_id
      WHERE suc.centro_id = p_centro_id
        AND suc.estado = 'pendiente'
      ORDER BY suc.created_at ASC
    ) r
  );
END;
$$;

REVOKE ALL ON FUNCTION sp_listar_solicitudes_union(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_listar_solicitudes_union(uuid) TO authenticated;

-- ------------------------------------------------------------
-- 9. sp_resolver_solicitud_union: aprobar o rechazar una solicitud
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_resolver_solicitud_union(
  p_solicitud_id uuid,
  p_accion       text   -- 'aprobar' | 'rechazar'
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_centro_id  uuid;
  v_usuario_id uuid;
  v_estado     estado_solicitud_union;
BEGIN
  SELECT centro_id, usuario_id, estado
  INTO v_centro_id, v_usuario_id, v_estado
  FROM solicitud_union_centro
  WHERE id = p_solicitud_id;

  IF v_centro_id IS NULL THEN
    RAISE EXCEPTION 'Solicitud no encontrada.';
  END IF;

  IF v_estado != 'pendiente' THEN
    RAISE EXCEPTION 'Esta solicitud ya fue procesada.';
  END IF;

  IF NOT fn_es_coordinador(v_centro_id) THEN
    RAISE EXCEPTION 'Solo el coordinador del centro puede resolver solicitudes de unión';
  END IF;

  IF p_accion = 'aprobar' THEN
    UPDATE solicitud_union_centro
    SET estado = 'aprobada', updated_at = now()
    WHERE id = p_solicitud_id;

    INSERT INTO usuario_centro(usuario_id, centro_id, rol)
    VALUES (v_usuario_id, v_centro_id, 'operador_inventario')
    ON CONFLICT (usuario_id, centro_id)
    DO UPDATE SET rol = 'operador_inventario', activo = true;

  ELSIF p_accion = 'rechazar' THEN
    UPDATE solicitud_union_centro
    SET estado = 'rechazada', updated_at = now()
    WHERE id = p_solicitud_id;

  ELSE
    RAISE EXCEPTION 'Acción inválida: usa "aprobar" o "rechazar"';
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION sp_resolver_solicitud_union(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_resolver_solicitud_union(uuid, text) TO authenticated;

-- ------------------------------------------------------------
-- 10. sp_mis_solicitudes_union: el usuario ve el estado de sus solicitudes
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_mis_solicitudes_union()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_usuario_id uuid;
BEGIN
  SELECT id INTO v_usuario_id FROM usuario WHERE auth_user_id = auth.uid();

  RETURN (
    SELECT jsonb_agg(row_to_json(r))
    FROM (
      SELECT
        suc.id,
        suc.estado,
        suc.created_at,
        ca.nombre  AS centro_nombre,
        ca.municipio,
        ca.estado_geo
      FROM solicitud_union_centro suc
      JOIN centro_acopio ca ON ca.id = suc.centro_id
      WHERE suc.usuario_id = v_usuario_id
      ORDER BY suc.created_at DESC
    ) r
  );
END;
$$;

REVOKE ALL ON FUNCTION sp_mis_solicitudes_union() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_mis_solicitudes_union() TO authenticated;
