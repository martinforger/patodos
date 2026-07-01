-- ============================================================
-- Migración 33 · Grupos familiares (HU-15)
-- ------------------------------------------------------------
-- Contexto: los centros necesitan agrupar personas por familia con un
-- representante que retira los insumos para todo el grupo, y ver la
-- composición (adultos / menores / bebés) para cerciorarse de que lo
-- solicitado corresponde a la familia (ej. fórmula solo si hay bebé).
--
-- Modelo:
--   grupo_familiar     — cabecera, con representante (persona completa).
--   integrante_familia — filas LIGERAS (no son persona): nombre, parentesco,
--                        fecha_nacimiento, marcas es_menor / es_bebe.
--
-- Se agregan enlaces OPCIONALES (default NULL, retrocompatibles) a
-- solicitud y detalle_egreso, y se recrean sp_registrar_solicitud_multiple
-- y sp_registrar_egreso_multiple con el parámetro p_grupo_familiar_id.
--
-- Patrón de scoping por centro y RLS igual a persona/destino
-- (migración 20) y a las tablas de detalle (migración 07).
-- ============================================================

-- ============================================================
-- 1. Tabla grupo_familiar
-- ============================================================
CREATE TABLE IF NOT EXISTS grupo_familiar (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centro_id       uuid NOT NULL REFERENCES centro_acopio(id),
  nombre_familia  varchar(200) NOT NULL,
  representante_id uuid NOT NULL REFERENCES persona(id),
  observaciones   text,
  activo          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_grupo_familiar_centro       ON grupo_familiar (centro_id);
CREATE INDEX IF NOT EXISTS idx_grupo_familiar_representante ON grupo_familiar (representante_id);

DROP TRIGGER IF EXISTS trg_updated_at_grupo_familiar ON grupo_familiar;
CREATE TRIGGER trg_updated_at_grupo_familiar
  BEFORE UPDATE ON grupo_familiar
  FOR EACH ROW EXECUTE FUNCTION fn_actualizar_updated_at();

-- ============================================================
-- 2. Tabla integrante_familia (modelo ligero)
-- ============================================================
CREATE TABLE IF NOT EXISTS integrante_familia (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id         uuid NOT NULL REFERENCES grupo_familiar(id) ON DELETE CASCADE,
  nombre           varchar(200) NOT NULL,
  parentesco       varchar(100),
  fecha_nacimiento date,
  es_menor         boolean NOT NULL DEFAULT false,
  es_bebe          boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integrante_familia_grupo ON integrante_familia (grupo_id);

-- ============================================================
-- 3. Enlaces opcionales en solicitud y detalle_egreso
-- ============================================================
ALTER TABLE solicitud
  ADD COLUMN IF NOT EXISTS grupo_familiar_id uuid REFERENCES grupo_familiar(id);

ALTER TABLE detalle_egreso
  ADD COLUMN IF NOT EXISTS grupo_familiar_id uuid REFERENCES grupo_familiar(id);

CREATE INDEX IF NOT EXISTS idx_solicitud_grupo_familiar
  ON solicitud (grupo_familiar_id) WHERE grupo_familiar_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_detalle_egreso_grupo_familiar
  ON detalle_egreso (grupo_familiar_id) WHERE grupo_familiar_id IS NOT NULL;

-- ============================================================
-- 4. RLS
-- ============================================================
ALTER TABLE grupo_familiar     ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrante_familia ENABLE ROW LEVEL SECURITY;

-- grupo_familiar: scopeado por su propio centro_id (patrón persona/destino)
DROP POLICY IF EXISTS grupo_familiar_select ON grupo_familiar;
DROP POLICY IF EXISTS grupo_familiar_insert ON grupo_familiar;
DROP POLICY IF EXISTS grupo_familiar_update ON grupo_familiar;

CREATE POLICY grupo_familiar_select ON grupo_familiar FOR SELECT TO authenticated
  USING (centro_id IN (SELECT fn_centros_del_usuario()) OR fn_es_admin());

CREATE POLICY grupo_familiar_insert ON grupo_familiar FOR INSERT TO authenticated
  WITH CHECK (centro_id IN (SELECT fn_centros_del_usuario()) OR fn_es_admin());

CREATE POLICY grupo_familiar_update ON grupo_familiar FOR UPDATE TO authenticated
  USING (centro_id IN (SELECT fn_centros_del_usuario()) OR fn_es_admin())
  WITH CHECK (centro_id IN (SELECT fn_centros_del_usuario()) OR fn_es_admin());

-- integrante_familia: scopeado por el centro del grupo padre (patrón tablas de detalle)
DROP POLICY IF EXISTS integrante_familia_select ON integrante_familia;
DROP POLICY IF EXISTS integrante_familia_insert ON integrante_familia;
DROP POLICY IF EXISTS integrante_familia_update ON integrante_familia;
DROP POLICY IF EXISTS integrante_familia_delete ON integrante_familia;

CREATE POLICY integrante_familia_select ON integrante_familia FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM grupo_familiar g
      WHERE g.id = integrante_familia.grupo_id
        AND (g.centro_id IN (SELECT fn_centros_del_usuario()) OR fn_es_admin())
    )
  );

CREATE POLICY integrante_familia_insert ON integrante_familia FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM grupo_familiar g
      WHERE g.id = integrante_familia.grupo_id
        AND (g.centro_id IN (SELECT fn_centros_del_usuario()) OR fn_es_admin())
    )
  );

CREATE POLICY integrante_familia_update ON integrante_familia FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM grupo_familiar g
      WHERE g.id = integrante_familia.grupo_id
        AND (g.centro_id IN (SELECT fn_centros_del_usuario()) OR fn_es_admin())
    )
  );

CREATE POLICY integrante_familia_delete ON integrante_familia FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM grupo_familiar g
      WHERE g.id = integrante_familia.grupo_id
        AND (g.centro_id IN (SELECT fn_centros_del_usuario()) OR fn_es_admin())
    )
  );

-- ============================================================
-- 5. Helper interno: insertar integrantes desde jsonb
-- ------------------------------------------------------------
-- Se define como bloque reutilizable dentro de los SPs de crear/editar.
-- (No es una función separada para mantener todo en la misma tx.)
-- ============================================================

-- ============================================================
-- 6. sp_crear_grupo_familiar
-- ============================================================
CREATE OR REPLACE FUNCTION sp_crear_grupo_familiar(
  p_centro_id       uuid,
  p_nombre_familia  varchar,
  p_representante_id uuid,
  p_observaciones   text  DEFAULT NULL,
  p_integrantes     jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_grupo_id uuid;
  v_int      jsonb;
BEGIN
  IF p_representante_id IS NULL THEN
    RAISE EXCEPTION 'El grupo familiar requiere un representante';
  END IF;

  IF p_nombre_familia IS NULL OR trim(p_nombre_familia) = '' THEN
    RAISE EXCEPTION 'El grupo familiar requiere un nombre';
  END IF;

  INSERT INTO grupo_familiar(centro_id, nombre_familia, representante_id, observaciones)
  VALUES (p_centro_id, trim(p_nombre_familia), p_representante_id, p_observaciones)
  RETURNING id INTO v_grupo_id;

  FOR v_int IN SELECT * FROM jsonb_array_elements(COALESCE(p_integrantes, '[]'::jsonb)) LOOP
    IF NULLIF(trim(v_int->>'nombre'), '') IS NULL THEN
      CONTINUE;  -- ignora filas vacías
    END IF;
    INSERT INTO integrante_familia(grupo_id, nombre, parentesco, fecha_nacimiento, es_menor, es_bebe)
    VALUES (
      v_grupo_id,
      trim(v_int->>'nombre'),
      NULLIF(trim(v_int->>'parentesco'), ''),
      NULLIF(v_int->>'fecha_nacimiento', '')::date,
      COALESCE((v_int->>'es_menor')::boolean, false),
      COALESCE((v_int->>'es_bebe')::boolean, false)
    );
  END LOOP;

  RETURN jsonb_build_object('id', v_grupo_id, 'ok', true);
END;
$$;

REVOKE ALL ON FUNCTION sp_crear_grupo_familiar(uuid, varchar, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_crear_grupo_familiar(uuid, varchar, uuid, text, jsonb) TO authenticated;

-- ============================================================
-- 7. sp_editar_grupo_familiar — reemplaza integrantes
-- ============================================================
CREATE OR REPLACE FUNCTION sp_editar_grupo_familiar(
  p_grupo_id       uuid,
  p_nombre_familia varchar,
  p_observaciones  text  DEFAULT NULL,
  p_integrantes    jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_int jsonb;
BEGIN
  IF p_nombre_familia IS NULL OR trim(p_nombre_familia) = '' THEN
    RAISE EXCEPTION 'El grupo familiar requiere un nombre';
  END IF;

  UPDATE grupo_familiar
  SET nombre_familia = trim(p_nombre_familia),
      observaciones  = p_observaciones
  WHERE id = p_grupo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Grupo familiar no encontrado: %', p_grupo_id;
  END IF;

  DELETE FROM integrante_familia WHERE grupo_id = p_grupo_id;

  FOR v_int IN SELECT * FROM jsonb_array_elements(COALESCE(p_integrantes, '[]'::jsonb)) LOOP
    IF NULLIF(trim(v_int->>'nombre'), '') IS NULL THEN
      CONTINUE;
    END IF;
    INSERT INTO integrante_familia(grupo_id, nombre, parentesco, fecha_nacimiento, es_menor, es_bebe)
    VALUES (
      p_grupo_id,
      trim(v_int->>'nombre'),
      NULLIF(trim(v_int->>'parentesco'), ''),
      NULLIF(v_int->>'fecha_nacimiento', '')::date,
      COALESCE((v_int->>'es_menor')::boolean, false),
      COALESCE((v_int->>'es_bebe')::boolean, false)
    );
  END LOOP;

  RETURN jsonb_build_object('id', p_grupo_id, 'ok', true);
END;
$$;

REVOKE ALL ON FUNCTION sp_editar_grupo_familiar(uuid, varchar, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_editar_grupo_familiar(uuid, varchar, text, jsonb) TO authenticated;

-- ============================================================
-- 8. sp_listar_grupos_familiares — con resumen de composición
-- ============================================================
CREATE OR REPLACE FUNCTION sp_listar_grupos_familiares(
  p_centro_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(g) ORDER BY g.nombre_familia), '[]'::jsonb)
    FROM (
      SELECT
        gf.id,
        gf.nombre_familia,
        gf.observaciones,
        gf.representante_id,
        p.nombre || ' ' || p.apellido AS representante,
        p.telefono                    AS representante_telefono,
        COALESCE(ci.total,   0) AS total_integrantes,
        COALESCE(ci.bebes,   0) AS bebes,
        COALESCE(ci.menores, 0) AS menores,
        COALESCE(ci.adultos, 0) AS adultos
      FROM grupo_familiar gf
      JOIN persona p ON p.id = gf.representante_id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)                                             AS total,
          COUNT(*) FILTER (WHERE i.es_bebe)                    AS bebes,
          COUNT(*) FILTER (WHERE i.es_menor AND NOT i.es_bebe) AS menores,
          COUNT(*) FILTER (WHERE NOT i.es_menor AND NOT i.es_bebe) AS adultos
        FROM integrante_familia i
        WHERE i.grupo_id = gf.id
      ) ci ON true
      WHERE gf.centro_id = p_centro_id
        AND gf.activo = true
      ORDER BY gf.nombre_familia
    ) g
  );
END;
$$;

REVOKE ALL ON FUNCTION sp_listar_grupos_familiares(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_listar_grupos_familiares(uuid) TO authenticated;

-- ============================================================
-- 9. sp_detalle_grupo_familiar — cabecera + integrantes[]
-- ============================================================
CREATE OR REPLACE FUNCTION sp_detalle_grupo_familiar(
  p_grupo_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_cab   jsonb;
  v_items jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id',                     gf.id,
    'nombre_familia',         gf.nombre_familia,
    'observaciones',          gf.observaciones,
    'representante_id',       gf.representante_id,
    'representante',          p.nombre || ' ' || p.apellido,
    'representante_telefono', p.telefono
  ) INTO v_cab
  FROM grupo_familiar gf
  JOIN persona p ON p.id = gf.representante_id
  WHERE gf.id = p_grupo_id;

  IF v_cab IS NULL THEN
    RAISE EXCEPTION 'Grupo familiar no encontrado: %', p_grupo_id;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',               i.id,
    'nombre',           i.nombre,
    'parentesco',       i.parentesco,
    'fecha_nacimiento', i.fecha_nacimiento,
    'es_menor',         i.es_menor,
    'es_bebe',          i.es_bebe
  ) ORDER BY i.created_at), '[]'::jsonb)
  INTO v_items
  FROM integrante_familia i
  WHERE i.grupo_id = p_grupo_id;

  RETURN v_cab || jsonb_build_object('integrantes', v_items);
END;
$$;

REVOKE ALL ON FUNCTION sp_detalle_grupo_familiar(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_detalle_grupo_familiar(uuid) TO authenticated;

-- ============================================================
-- 10. sp_buscar_grupo_familiar — fuzzy por familia o representante
-- ============================================================
CREATE OR REPLACE FUNCTION sp_buscar_grupo_familiar(
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
    SELECT COALESCE(jsonb_agg(row_to_json(g) ORDER BY g.nombre_familia), '[]'::jsonb)
    FROM (
      SELECT
        gf.id,
        gf.nombre_familia,
        gf.representante_id,
        p.nombre    AS representante_nombre,
        p.apellido  AS representante_apellido,
        p.telefono  AS representante_telefono,
        p.cedula    AS representante_cedula,
        COALESCE((SELECT COUNT(*) FROM integrante_familia i WHERE i.grupo_id = gf.id), 0) AS total_integrantes,
        COALESCE((SELECT COUNT(*) FROM integrante_familia i WHERE i.grupo_id = gf.id AND i.es_bebe), 0) AS bebes
      FROM grupo_familiar gf
      JOIN persona p ON p.id = gf.representante_id
      WHERE gf.centro_id = p_centro_id
        AND gf.activo = true
        AND (
          lower(gf.nombre_familia) LIKE v_term
          OR lower(p.nombre)       LIKE v_term
          OR lower(p.apellido)     LIKE v_term
          OR lower(p.telefono)     LIKE v_term
          OR lower(COALESCE(p.cedula, '')) LIKE v_term
        )
      LIMIT 20
    ) g
  );
END;
$$;

REVOKE ALL ON FUNCTION sp_buscar_grupo_familiar(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_buscar_grupo_familiar(text, uuid) TO authenticated;

-- ============================================================
-- 11. sp_registrar_solicitud_multiple — agregar p_grupo_familiar_id
-- ------------------------------------------------------------
-- Recreado desde la migración 28 sumando el parámetro opcional al final.
-- ============================================================
DROP FUNCTION IF EXISTS sp_registrar_solicitud_multiple(uuid, uuid, date, uuid, text, jsonb);

CREATE OR REPLACE FUNCTION sp_registrar_solicitud_multiple(
  p_centro_id        uuid,
  p_solicitante_id   uuid,
  p_fecha            date    DEFAULT CURRENT_DATE,
  p_destino_id       uuid    DEFAULT NULL,
  p_observaciones    text    DEFAULT NULL,
  p_items            jsonb   DEFAULT '[]'::jsonb,
  p_grupo_familiar_id uuid   DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_usuario_id uuid;
  v_lote_id    uuid;
  v_item       jsonb;
  v_insumo_id  uuid;
  v_cantidad   numeric;
  v_id         uuid;
  v_ids        uuid[] := '{}';
BEGIN
  SELECT u.id INTO v_usuario_id
  FROM usuario u WHERE u.auth_user_id = auth.uid();

  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado para auth_uid %', auth.uid();
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La solicitud requiere al menos un insumo';
  END IF;

  v_lote_id := gen_random_uuid();

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_insumo_id := NULLIF(v_item->>'insumo_id', '')::uuid;
    v_cantidad  := (v_item->>'cantidad')::numeric;

    IF v_insumo_id IS NULL THEN
      RAISE EXCEPTION 'Cada insumo de la solicitud es obligatorio';
    END IF;
    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'La cantidad de cada insumo debe ser mayor a cero';
    END IF;

    INSERT INTO solicitud(
      centro_id, insumo_id, cantidad_solicitada,
      solicitante_id, fecha_solicitud, destino_id, observaciones,
      usuario_registro_id, estado, lote_id, grupo_familiar_id
    )
    VALUES (
      p_centro_id, v_insumo_id, v_cantidad,
      p_solicitante_id, p_fecha, p_destino_id, p_observaciones,
      v_usuario_id, 'pendiente', v_lote_id, p_grupo_familiar_id
    )
    RETURNING id INTO v_id;

    v_ids := array_append(v_ids, v_id);
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'ids', to_jsonb(v_ids), 'lote_id', v_lote_id);
END;
$$;

REVOKE ALL ON FUNCTION sp_registrar_solicitud_multiple(uuid, uuid, date, uuid, text, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_registrar_solicitud_multiple(uuid, uuid, date, uuid, text, jsonb, uuid) TO authenticated;

-- ============================================================
-- 12. sp_registrar_egreso_multiple — agregar p_grupo_familiar_id
-- ------------------------------------------------------------
-- Recreado desde la migración 28 sumando el parámetro opcional al final.
-- ============================================================
DROP FUNCTION IF EXISTS sp_registrar_egreso_multiple(uuid, date, uuid, uuid, jsonb, text, jsonb, boolean);

CREATE OR REPLACE FUNCTION sp_registrar_egreso_multiple(
  p_centro_id            uuid,
  p_fecha                date,
  p_destino_id           uuid,
  p_persona_contacto_id  uuid    DEFAULT NULL,
  p_responsables         jsonb   DEFAULT '[]'::jsonb,
  p_observaciones        text    DEFAULT NULL,
  p_items                jsonb   DEFAULT '[]'::jsonb,
  p_afecta_inventario    boolean DEFAULT true,
  p_grupo_familiar_id    uuid    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_usuario_id  uuid;
  v_lote_id     uuid;
  v_movimiento  uuid;
  v_detalle     uuid;
  v_stock       numeric;
  v_resp        jsonb;
  v_item        jsonb;
  v_insumo_id   uuid;
  v_cantidad    numeric;
  v_solicitud   uuid;
  v_ids         uuid[] := '{}';
BEGIN
  SELECT u.id INTO v_usuario_id
  FROM usuario u WHERE u.auth_user_id = auth.uid();

  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado para auth_uid %', auth.uid();
  END IF;

  IF p_destino_id IS NULL THEN
    RAISE EXCEPTION 'El egreso requiere un destino';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El egreso requiere al menos un insumo';
  END IF;

  v_lote_id := gen_random_uuid();

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_insumo_id := NULLIF(v_item->>'insumo_id', '')::uuid;
    v_cantidad  := (v_item->>'cantidad')::numeric;
    v_solicitud := NULLIF(v_item->>'solicitud_id', '')::uuid;

    IF v_insumo_id IS NULL THEN
      RAISE EXCEPTION 'Cada insumo del egreso es obligatorio';
    END IF;
    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'La cantidad de cada insumo debe ser mayor a cero';
    END IF;

    IF p_afecta_inventario THEN
      SELECT stock INTO v_stock
      FROM inventario_centro
      WHERE centro_id = p_centro_id AND insumo_id = v_insumo_id;

      IF v_stock IS NULL OR v_stock < v_cantidad THEN
        RAISE EXCEPTION 'Stock insuficiente para el insumo %: disponible %, solicitado %',
          (SELECT nombre FROM insumo WHERE id = v_insumo_id),
          COALESCE(v_stock, 0), v_cantidad;
      END IF;
    END IF;

    INSERT INTO movimiento(centro_id, insumo_id, tipo, cantidad, fecha_movimiento,
                           usuario_id, observaciones, afecta_inventario, lote_id)
    VALUES (p_centro_id, v_insumo_id, 'egreso', v_cantidad, p_fecha,
            v_usuario_id, p_observaciones, p_afecta_inventario, v_lote_id)
    RETURNING id INTO v_movimiento;

    INSERT INTO detalle_egreso(movimiento_id, destino_id, persona_contacto_id, grupo_familiar_id)
    VALUES (v_movimiento, p_destino_id, p_persona_contacto_id, p_grupo_familiar_id)
    RETURNING id INTO v_detalle;

    FOR v_resp IN SELECT * FROM jsonb_array_elements(COALESCE(p_responsables, '[]'::jsonb)) LOOP
      INSERT INTO responsable_entrega(detalle_egreso_id, persona_id, nombre, apellido, telefono)
      VALUES (
        v_detalle,
        NULLIF(v_resp->>'persona_id', '')::uuid,
        NULLIF(v_resp->>'nombre', ''),
        NULLIF(v_resp->>'apellido', ''),
        NULLIF(v_resp->>'telefono', '')
      );
    END LOOP;

    IF v_solicitud IS NOT NULL THEN
      INSERT INTO solicitud_movimiento(solicitud_id, movimiento_id)
      VALUES (v_solicitud, v_movimiento)
      ON CONFLICT (solicitud_id, movimiento_id) DO NOTHING;
    END IF;

    v_ids := array_append(v_ids, v_movimiento);
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'ids', to_jsonb(v_ids), 'lote_id', v_lote_id);
END;
$$;

REVOKE ALL ON FUNCTION sp_registrar_egreso_multiple(uuid, date, uuid, uuid, jsonb, text, jsonb, boolean, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_registrar_egreso_multiple(uuid, date, uuid, uuid, jsonb, text, jsonb, boolean, uuid) TO authenticated;
