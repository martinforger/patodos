-- ============================================================
-- Migración 22 · Catálogo de insumos por centro de acopio
-- ------------------------------------------------------------
-- Contexto: insumo era un catálogo global (sin centro_id, RLS
-- "USING (true)"), igual que persona/destino antes de la migración
-- 20. Esto causaba dos problemas: (1) un centro veía y podía
-- despachar insumos creados por otro centro, y (2) la búsqueda de
-- insumos en los formularios cargaba el catálogo completo una sola
-- vez en el servidor y filtraba en memoria del cliente, por lo que
-- un insumo recién creado no aparecía hasta refrescar la página.
--
-- Esta migración:
--   1. Agrega centro_id a insumo.
--   2. Backfill seguro: como insumo era global, algunos insumos ya
--      están referenciados por movimiento/inventario_centro/solicitud
--      de MÁS DE UN centro. Para esos casos, el insumo original se
--      queda con el primer centro que lo usó y se clona una fila por
--      cada centro adicional, reapuntando sus referencias para no
--      romper historial/inventario bajo las nuevas políticas RLS.
--   3. Cambia el UNIQUE de (nombre) a (nombre, centro_id).
--   4. Scopea RLS con fn_centros_del_usuario()/fn_es_admin(), mismo
--      patrón que persona/destino (migración 20).
--   5. Limpia overloads obsoletos de sp_crear_insumo/sp_listar_insumos
--      acumulados en producción por CREATE OR REPLACE con firmas
--      distintas, y los reescribe recibiendo p_centro_id.
--   6. Crea sp_buscar_insumo: búsqueda viva server-side (mismo patrón
--      que sp_buscar_persona) en lugar del filtrado client-side.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Columna centro_id (nullable durante el backfill)
-- ------------------------------------------------------------
ALTER TABLE insumo
  ADD COLUMN IF NOT EXISTS centro_id uuid REFERENCES centro_acopio(id);

-- ------------------------------------------------------------
-- 2. Quitar UNIQUE(nombre) ANTES del backfill: el backfill clona
--    filas con el mismo nombre para distintos centros (ej. "Agua"
--    usado por 2 centros), lo que viola el constraint global si
--    sigue activo durante la inserción.
-- ------------------------------------------------------------
ALTER TABLE insumo DROP CONSTRAINT IF EXISTS uq_insumo_nombre;

-- ------------------------------------------------------------
-- 3. Backfill: asignar centro_id según uso real, duplicando
--    insumos compartidos entre varios centros.
-- ------------------------------------------------------------
DO $$
DECLARE
  v_insumo   RECORD;
  v_centro   RECORD;
  v_primero  boolean;
  v_nuevo_id uuid;
BEGIN
  FOR v_insumo IN
    SELECT id, categoria_id, nombre, descripcion, activo, unidad_medida, presentacion
    FROM insumo
    WHERE centro_id IS NULL
  LOOP
    v_primero := true;

    FOR v_centro IN
      SELECT DISTINCT centro_id FROM (
        SELECT centro_id FROM movimiento        WHERE insumo_id = v_insumo.id
        UNION
        SELECT centro_id FROM inventario_centro WHERE insumo_id = v_insumo.id
        UNION
        SELECT centro_id FROM solicitud          WHERE insumo_id = v_insumo.id
      ) u
      ORDER BY centro_id
    LOOP
      IF v_primero THEN
        -- El primer centro que usó este insumo se queda con la fila original.
        UPDATE insumo SET centro_id = v_centro.centro_id WHERE id = v_insumo.id;
        v_primero := false;
      ELSE
        -- Centros adicionales: clonar el insumo y reapuntar sus referencias.
        INSERT INTO insumo (categoria_id, nombre, descripcion, activo, unidad_medida, presentacion, centro_id)
        VALUES (v_insumo.categoria_id, v_insumo.nombre, v_insumo.descripcion, v_insumo.activo,
                v_insumo.unidad_medida, v_insumo.presentacion, v_centro.centro_id)
        RETURNING id INTO v_nuevo_id;

        UPDATE movimiento SET insumo_id = v_nuevo_id
          WHERE insumo_id = v_insumo.id AND centro_id = v_centro.centro_id;
        UPDATE inventario_centro SET insumo_id = v_nuevo_id
          WHERE insumo_id = v_insumo.id AND centro_id = v_centro.centro_id;
        UPDATE solicitud SET insumo_id = v_nuevo_id
          WHERE insumo_id = v_insumo.id AND centro_id = v_centro.centro_id;
      END IF;
    END LOOP;
  END LOOP;

  -- Insumos sin ningún uso registrado: asignar al primer centro creado
  -- (mismo criterio usado en la migración 20 para persona/destino).
  UPDATE insumo
  SET centro_id = (SELECT id FROM centro_acopio ORDER BY created_at LIMIT 1)
  WHERE centro_id IS NULL;
END $$;

ALTER TABLE insumo ALTER COLUMN centro_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_insumo_centro ON insumo (centro_id);

-- ------------------------------------------------------------
-- 3. UNIQUE(nombre) → UNIQUE(nombre, centro_id)
-- ------------------------------------------------------------
ALTER TABLE insumo DROP CONSTRAINT IF EXISTS uq_insumo_nombre;
ALTER TABLE insumo ADD CONSTRAINT uq_insumo_nombre_centro UNIQUE (nombre, centro_id);

-- ------------------------------------------------------------
-- 4. RLS — scopear por centro
-- ------------------------------------------------------------
DROP POLICY IF EXISTS insumo_select ON insumo;
DROP POLICY IF EXISTS insumo_insert ON insumo;

CREATE POLICY insumo_select ON insumo FOR SELECT TO authenticated
  USING (centro_id IN (SELECT fn_centros_del_usuario()) OR fn_es_admin());

CREATE POLICY insumo_insert ON insumo FOR INSERT TO authenticated
  WITH CHECK (centro_id IN (SELECT fn_centros_del_usuario()) OR fn_es_admin());

-- ------------------------------------------------------------
-- 5. Limpiar overloads obsoletos acumulados en producción
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS sp_crear_insumo(text, text, uuid);
DROP FUNCTION IF EXISTS sp_crear_insumo(text, uuid, text);
DROP FUNCTION IF EXISTS sp_crear_insumo(text, uuid, text, text);
DROP FUNCTION IF EXISTS sp_listar_insumos(uuid);
DROP FUNCTION IF EXISTS sp_listar_insumos(uuid, uuid);

-- ------------------------------------------------------------
-- 6. sp_crear_insumo — ahora requiere p_centro_id
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_crear_insumo(
  p_centro_id     uuid,
  p_nombre        text,
  p_categoria_id  uuid,
  p_unidad_medida text DEFAULT NULL,
  p_presentacion  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_categoria_nombre text;
  v_id               uuid;
  v_unidad           text;
  v_presentacion     text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF NOT (p_centro_id IN (SELECT fn_centros_del_usuario()) OR fn_es_admin()) THEN
    RAISE EXCEPTION 'No tiene acceso a este centro';
  END IF;

  SELECT nombre INTO v_categoria_nombre
  FROM categoria_insumo
  WHERE id = p_categoria_id AND activo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Categoría no encontrada o inactiva';
  END IF;

  v_unidad      := CASE WHEN trim(coalesce(p_unidad_medida, '')) = '' THEN NULL
                        ELSE trim(p_unidad_medida) END;
  v_presentacion := CASE WHEN trim(coalesce(p_presentacion, '')) = '' THEN NULL
                         ELSE trim(p_presentacion) END;

  INSERT INTO insumo (centro_id, categoria_id, nombre, unidad_medida, presentacion)
  VALUES (p_centro_id, p_categoria_id, trim(p_nombre), v_unidad, v_presentacion)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'id',            v_id,
    'nombre',        trim(trim(p_nombre) || COALESCE(' ' || v_presentacion, '') || COALESCE(' ' || v_unidad, '')),
    'categoria',     v_categoria_nombre,
    'unidad_medida', v_unidad,
    'presentacion',  v_presentacion
  );
END;
$$;

REVOKE ALL ON FUNCTION sp_crear_insumo(uuid, text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_crear_insumo(uuid, text, uuid, text, text) TO authenticated;

-- ------------------------------------------------------------
-- 7. sp_listar_insumos — ahora requiere p_centro_id
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_listar_insumos(
  p_centro_id    uuid,
  p_categoria_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(i) ORDER BY i.nombre), '[]'::jsonb)
    FROM (
      SELECT i.id,
             trim(i.nombre || COALESCE(' ' || i.presentacion, '') || COALESCE(' ' || i.unidad_medida, '')) AS nombre,
             i.unidad_medida, i.presentacion, i.descripcion,
             c.id AS categoria_id, c.nombre AS categoria
      FROM insumo i
      JOIN categoria_insumo c ON c.id = i.categoria_id
      WHERE i.activo = true
        AND i.centro_id = p_centro_id
        AND (p_categoria_id IS NULL OR i.categoria_id = p_categoria_id)
      ORDER BY i.nombre
    ) i
  );
END;
$$;

REVOKE ALL ON FUNCTION sp_listar_insumos(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_listar_insumos(uuid, uuid) TO authenticated;

-- ------------------------------------------------------------
-- 8. sp_buscar_insumo — búsqueda viva server-side (nuevo)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_buscar_insumo(
  p_termino      text,
  p_centro_id    uuid,
  p_categoria_id uuid DEFAULT NULL
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
    SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.nombre), '[]'::jsonb)
    FROM (
      SELECT *
      FROM (
        SELECT i.id,
               trim(i.nombre || COALESCE(' ' || i.presentacion, '') || COALESCE(' ' || i.unidad_medida, '')) AS nombre,
               i.unidad_medida, i.presentacion,
               c.id AS categoria_id, c.nombre AS categoria
        FROM insumo i
        JOIN categoria_insumo c ON c.id = i.categoria_id
        WHERE i.activo = true
          AND i.centro_id = p_centro_id
          AND (p_categoria_id IS NULL OR i.categoria_id = p_categoria_id)
      ) x
      WHERE lower(x.nombre) LIKE v_term
      ORDER BY x.nombre
      LIMIT 20
    ) r
  );
END;
$$;

REVOKE ALL ON FUNCTION sp_buscar_insumo(text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_buscar_insumo(text, uuid, uuid) TO authenticated;
