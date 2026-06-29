-- ============================================================
-- Migración 20 · persona y destino privados por centro de acopio
-- ------------------------------------------------------------
-- Contexto: las tablas persona y destino eran catálogos globales
-- (USING true en RLS). Ahora cada registro pertenece a un centro
-- específico, replicando el patrón de voluntario/movimiento.
--
-- Cambios:
--   1. Agregar centro_id a persona y destino.
--   2. Asignar registros existentes al primer centro (datos de prueba).
--   3. Actualizar políticas RLS con fn_centros_del_usuario().
--   4. Reescribir sp_buscar_persona, sp_crear_persona,
--      sp_listar_destinos, sp_crear_destino para recibir p_centro_id.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Columna centro_id en persona
-- ------------------------------------------------------------
ALTER TABLE persona
  ADD COLUMN IF NOT EXISTS centro_id uuid REFERENCES centro_acopio(id);

-- Asignar al primer centro existente (datos de prueba)
UPDATE persona
SET centro_id = (SELECT id FROM centro_acopio ORDER BY created_at LIMIT 1)
WHERE centro_id IS NULL;

ALTER TABLE persona ALTER COLUMN centro_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_persona_centro ON persona (centro_id);

-- ------------------------------------------------------------
-- 2. Columna centro_id en destino
-- ------------------------------------------------------------
ALTER TABLE destino
  ADD COLUMN IF NOT EXISTS centro_id uuid REFERENCES centro_acopio(id);

-- Asignar al primer centro existente (datos de prueba)
UPDATE destino
SET centro_id = (SELECT id FROM centro_acopio ORDER BY created_at LIMIT 1)
WHERE centro_id IS NULL;

ALTER TABLE destino ALTER COLUMN centro_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_destino_centro ON destino (centro_id);

-- ------------------------------------------------------------
-- 3. Políticas RLS de persona — scopear por centro
-- ------------------------------------------------------------
DROP POLICY IF EXISTS persona_select ON persona;
DROP POLICY IF EXISTS persona_insert ON persona;

CREATE POLICY persona_select ON persona FOR SELECT TO authenticated
  USING (centro_id IN (SELECT fn_centros_del_usuario()) OR fn_es_admin());

CREATE POLICY persona_insert ON persona FOR INSERT TO authenticated
  WITH CHECK (centro_id IN (SELECT fn_centros_del_usuario()) OR fn_es_admin());

-- ------------------------------------------------------------
-- 4. Políticas RLS de destino — scopear por centro
-- ------------------------------------------------------------
DROP POLICY IF EXISTS destino_select ON destino;
DROP POLICY IF EXISTS destino_insert ON destino;

CREATE POLICY destino_select ON destino FOR SELECT TO authenticated
  USING (centro_id IN (SELECT fn_centros_del_usuario()) OR fn_es_admin());

CREATE POLICY destino_insert ON destino FOR INSERT TO authenticated
  WITH CHECK (centro_id IN (SELECT fn_centros_del_usuario()) OR fn_es_admin());

-- ------------------------------------------------------------
-- 5. sp_buscar_persona — ahora requiere p_centro_id
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS sp_buscar_persona(text);

CREATE OR REPLACE FUNCTION sp_buscar_persona(
  p_termino   text,
  p_centro_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_term text := '%' || lower(trim(p_termino)) || '%';
BEGIN
  RETURN (
    SELECT jsonb_agg(row_to_json(p) ORDER BY p.nombre, p.apellido)
    FROM (
      SELECT id, nombre, apellido, cedula, telefono, correo
      FROM persona
      WHERE centro_id = p_centro_id
        AND (
          lower(nombre)   LIKE v_term
          OR lower(apellido)  LIKE v_term
          OR lower(telefono)  LIKE v_term
          OR lower(cedula)    LIKE v_term
        )
      LIMIT 20
    ) p
  );
END;
$$;

REVOKE ALL ON FUNCTION sp_buscar_persona(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_buscar_persona(text, uuid) TO authenticated;

-- ------------------------------------------------------------
-- 6. sp_crear_persona — ahora requiere p_centro_id
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS sp_crear_persona(varchar, varchar, varchar, varchar, varchar, text);

CREATE OR REPLACE FUNCTION sp_crear_persona(
  p_centro_id     uuid,
  p_nombre        varchar,
  p_apellido      varchar,
  p_telefono      varchar,
  p_cedula        varchar DEFAULT NULL,
  p_correo        varchar DEFAULT NULL,
  p_observaciones text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO persona(centro_id, nombre, apellido, telefono, cedula, correo, observaciones)
  VALUES (p_centro_id, p_nombre, p_apellido, p_telefono, p_cedula, p_correo, p_observaciones)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'ok', true);
END;
$$;

REVOKE ALL ON FUNCTION sp_crear_persona(uuid, varchar, varchar, varchar, varchar, varchar, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_crear_persona(uuid, varchar, varchar, varchar, varchar, varchar, text) TO authenticated;

-- ------------------------------------------------------------
-- 7. sp_listar_destinos — ahora requiere p_centro_id
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS sp_listar_destinos();

CREATE OR REPLACE FUNCTION sp_listar_destinos(p_centro_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(d) ORDER BY d.nombre), '[]'::jsonb)
    FROM (
      SELECT id, nombre, direccion, municipio, estado_geo, referencia
      FROM destino
      WHERE activo = true
        AND centro_id = p_centro_id
      ORDER BY nombre
    ) d
  );
END;
$$;

REVOKE ALL ON FUNCTION sp_listar_destinos(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_listar_destinos(uuid) TO authenticated;

-- ------------------------------------------------------------
-- 8. sp_crear_destino — ahora requiere p_centro_id
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS sp_crear_destino(varchar, text, varchar, varchar, text);

CREATE OR REPLACE FUNCTION sp_crear_destino(
  p_centro_id  uuid,
  p_nombre     varchar,
  p_direccion  text,
  p_municipio  varchar,
  p_estado_geo varchar,
  p_referencia text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO destino(centro_id, nombre, direccion, municipio, estado_geo, referencia)
  VALUES (p_centro_id, p_nombre, p_direccion, p_municipio, p_estado_geo, p_referencia)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'ok', true);
END;
$$;

REVOKE ALL ON FUNCTION sp_crear_destino(uuid, varchar, text, varchar, varchar, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_crear_destino(uuid, varchar, text, varchar, varchar, text) TO authenticated;
