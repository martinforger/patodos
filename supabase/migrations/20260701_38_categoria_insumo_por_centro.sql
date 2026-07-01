-- ============================================================
-- Migración 38 · categoria_insumo por centro de acopio
-- ------------------------------------------------------------
-- La tabla categoria_insumo era un catálogo global (sin centro_id).
-- Esta migración la convierte en per-centro, siguiendo el mismo
-- patrón que insumo (migración 22), persona y destino (migración 20).
--
-- Cambios:
--   1. Agregar centro_id a categoria_insumo.
--   2. Backfill: clonar las categorías globales existentes para cada
--      centro (asignando el insumo.categoria_id al clon correcto).
--   3. Quitar UNIQUE(nombre) y añadir UNIQUE(nombre, centro_id).
--   4. Hacer centro_id NOT NULL.
--   5. Actualizar políticas RLS.
--   6. Reescribir sp_listar_categorias_insumos para aceptar p_centro_id.
--   7. Crear sp_crear_categoria_insumo y sp_actualizar_categoria_insumo.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Columna centro_id (nullable durante el backfill)
-- ------------------------------------------------------------
ALTER TABLE categoria_insumo
  ADD COLUMN IF NOT EXISTS centro_id uuid REFERENCES centro_acopio(id);

-- ------------------------------------------------------------
-- 2. Backfill: clonar las categorías existentes para cada centro
--    y reasignar insumo.categoria_id al clon del centro correcto.
-- ------------------------------------------------------------
DO $$
DECLARE
  v_cat     RECORD;
  v_centro  RECORD;
  v_primero boolean;
  v_nuevo_id uuid;
BEGIN
  FOR v_cat IN
    SELECT id, nombre, descripcion, activo, created_at
    FROM categoria_insumo
    WHERE centro_id IS NULL
  LOOP
    v_primero := true;

    -- Iterar sobre cada centro que usa esta categoría
    FOR v_centro IN
      SELECT DISTINCT i.centro_id
      FROM insumo i
      WHERE i.categoria_id = v_cat.id
        AND i.centro_id IS NOT NULL
      ORDER BY i.centro_id
    LOOP
      IF v_primero THEN
        -- El primer centro conserva el registro original
        UPDATE categoria_insumo
        SET centro_id = v_centro.centro_id
        WHERE id = v_cat.id;
        v_primero := false;
      ELSE
        -- Los centros adicionales reciben un clon
        INSERT INTO categoria_insumo (nombre, descripcion, activo, centro_id)
        VALUES (v_cat.nombre, v_cat.descripcion, v_cat.activo, v_centro.centro_id)
        RETURNING id INTO v_nuevo_id;

        -- Reasignar los insumos de este centro al clon
        UPDATE insumo
        SET categoria_id = v_nuevo_id
        WHERE categoria_id = v_cat.id
          AND centro_id    = v_centro.centro_id;
      END IF;
    END LOOP;

    -- Si la categoría no fue usada por ningún centro, asignarla al primero
    IF v_primero THEN
      UPDATE categoria_insumo
      SET centro_id = (SELECT id FROM centro_acopio ORDER BY created_at LIMIT 1)
      WHERE id = v_cat.id;
    END IF;
  END LOOP;
END;
$$;

-- Rellenar cualquier categoría restante sin centro_id (seguridad)
UPDATE categoria_insumo
SET centro_id = (SELECT id FROM centro_acopio ORDER BY created_at LIMIT 1)
WHERE centro_id IS NULL;

-- ------------------------------------------------------------
-- 3. Quitar UNIQUE(nombre) global y añadir UNIQUE(nombre, centro_id)
-- ------------------------------------------------------------
ALTER TABLE categoria_insumo DROP CONSTRAINT IF EXISTS categoria_insumo_nombre_key;
ALTER TABLE categoria_insumo DROP CONSTRAINT IF EXISTS uq_categoria_insumo_nombre;
ALTER TABLE categoria_insumo ADD CONSTRAINT uq_categoria_insumo_nombre_centro
  UNIQUE (nombre, centro_id);

-- ------------------------------------------------------------
-- 4. Hacer centro_id NOT NULL
-- ------------------------------------------------------------
ALTER TABLE categoria_insumo ALTER COLUMN centro_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_categoria_insumo_centro ON categoria_insumo (centro_id);

-- ------------------------------------------------------------
-- 5. Políticas RLS de categoria_insumo — scopear por centro
-- ------------------------------------------------------------
DROP POLICY IF EXISTS cat_select    ON categoria_insumo;
DROP POLICY IF EXISTS cat_insert    ON categoria_insumo;
DROP POLICY IF EXISTS cat_update    ON categoria_insumo;

-- SELECT: el usuario puede ver las categorías de sus centros (o admin ve todo)
CREATE POLICY cat_select ON categoria_insumo FOR SELECT TO authenticated
  USING (centro_id IN (SELECT fn_centros_del_usuario()) OR fn_es_admin());

-- INSERT: el usuario puede crear categorías en sus centros
CREATE POLICY cat_insert ON categoria_insumo FOR INSERT TO authenticated
  WITH CHECK (centro_id IN (SELECT fn_centros_del_usuario()) OR fn_es_admin());

-- UPDATE: el usuario puede modificar categorías de sus centros
CREATE POLICY cat_update ON categoria_insumo FOR UPDATE TO authenticated
  USING (centro_id IN (SELECT fn_centros_del_usuario()) OR fn_es_admin())
  WITH CHECK (centro_id IN (SELECT fn_centros_del_usuario()) OR fn_es_admin());

-- ------------------------------------------------------------
-- 6. Reescribir sp_listar_categorias_insumos para recibir p_centro_id
-- ------------------------------------------------------------
-- Primero eliminar la versión sin parámetros para evitar ambigüedad
DROP FUNCTION IF EXISTS public.sp_listar_categorias_insumos();

CREATE OR REPLACE FUNCTION public.sp_listar_categorias_insumos(
  p_centro_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id',          ci.id,
        'nombre',      ci.nombre,
        'descripcion', ci.descripcion,
        'activo',      ci.activo
      )
      ORDER BY ci.nombre
    )
    FROM categoria_insumo ci
    WHERE ci.centro_id = p_centro_id
      AND ci.activo    = true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sp_listar_categorias_insumos(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sp_listar_categorias_insumos(uuid) TO authenticated;

-- ------------------------------------------------------------
-- 7a. sp_listar_todas_categorias_insumos — incluye inactivas (para el panel de gestión)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sp_listar_todas_categorias_insumos(
  p_centro_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id',               ci.id,
        'nombre',           ci.nombre,
        'descripcion',      ci.descripcion,
        'activo',           ci.activo,
        'num_insumos',      COUNT(i.id)
      )
      ORDER BY ci.nombre
    )
    FROM categoria_insumo ci
    LEFT JOIN insumo i ON i.categoria_id = ci.id AND i.activo = true AND i.centro_id = p_centro_id
    WHERE ci.centro_id = p_centro_id
    GROUP BY ci.id, ci.nombre, ci.descripcion, ci.activo
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sp_listar_todas_categorias_insumos(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sp_listar_todas_categorias_insumos(uuid) TO authenticated;

-- ------------------------------------------------------------
-- 7b. sp_crear_categoria_insumo — cualquier usuario del centro puede crear
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sp_crear_categoria_insumo(
  p_centro_id   uuid,
  p_nombre      text,
  p_descripcion text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  INSERT INTO categoria_insumo (nombre, descripcion, centro_id)
  VALUES (trim(p_nombre), nullif(trim(p_descripcion), ''), p_centro_id)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'id',          v_id,
    'nombre',      trim(p_nombre),
    'descripcion', nullif(trim(coalesce(p_descripcion,'')), ''),
    'activo',      true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sp_crear_categoria_insumo(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sp_crear_categoria_insumo(uuid, text, text) TO authenticated;

-- ------------------------------------------------------------
-- 7c. sp_actualizar_categoria_insumo — cualquier usuario del centro puede editar
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sp_actualizar_categoria_insumo(
  p_id          uuid,
  p_nombre      text,
  p_descripcion text DEFAULT NULL,
  p_activo      boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  UPDATE categoria_insumo
  SET
    nombre      = trim(p_nombre),
    descripcion = nullif(trim(p_descripcion), ''),
    activo      = p_activo,
    updated_at  = now()
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Categoría no encontrada';
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.sp_actualizar_categoria_insumo(uuid, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sp_actualizar_categoria_insumo(uuid, text, text, boolean) TO authenticated;

-- ------------------------------------------------------------
-- 8. Agregar updated_at a categoria_insumo si no existe
-- ------------------------------------------------------------
ALTER TABLE categoria_insumo
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Trigger updated_at para categoria_insumo
DROP TRIGGER IF EXISTS trg_updated_at_categoria_insumo ON categoria_insumo;
CREATE TRIGGER trg_updated_at_categoria_insumo
  BEFORE UPDATE ON categoria_insumo
  FOR EACH ROW EXECUTE FUNCTION fn_actualizar_updated_at();
