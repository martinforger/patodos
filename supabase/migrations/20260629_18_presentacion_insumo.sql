-- ============================================================
-- Migración 18 · Agregar presentacion a insumo
-- ------------------------------------------------------------
-- Campo opcional que indica el tamaño/contenido de la unidad,
-- p.ej. "500" (con unidad_medida "ml") para "Agua 500ml".
-- ============================================================

-- ------------------------------------------------------------
-- 1. Agregar columna
-- ------------------------------------------------------------
ALTER TABLE insumo ADD COLUMN IF NOT EXISTS presentacion varchar(50) DEFAULT NULL;

-- ------------------------------------------------------------
-- 2. sp_crear_insumo  (con presentacion opcional)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_crear_insumo(
  p_nombre         text,
  p_categoria_id   uuid,
  p_unidad_medida  text DEFAULT NULL,
  p_presentacion   text DEFAULT NULL
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

  INSERT INTO insumo (categoria_id, nombre, unidad_medida, presentacion)
  VALUES (p_categoria_id, trim(p_nombre), v_unidad, v_presentacion)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'id',            v_id,
    'nombre',        trim(p_nombre),
    'categoria',     v_categoria_nombre,
    'unidad_medida', v_unidad,
    'presentacion',  v_presentacion
  );
END;
$$;

REVOKE ALL ON FUNCTION sp_crear_insumo(text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_crear_insumo(text, uuid, text, text) TO authenticated;

-- ------------------------------------------------------------
-- 3. sp_listar_insumos  (incluye presentacion)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_listar_insumos(
  p_categoria_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT jsonb_agg(row_to_json(i) ORDER BY i.nombre)
    FROM (
      SELECT i.id, i.nombre, i.unidad_medida, i.presentacion, i.descripcion,
             c.nombre AS categoria
      FROM insumo i
      JOIN categoria_insumo c ON c.id = i.categoria_id
      WHERE i.activo = true
        AND (p_categoria_id IS NULL OR i.categoria_id = p_categoria_id)
      ORDER BY i.nombre
    ) i
  );
END;
$$;

REVOKE ALL ON FUNCTION sp_listar_insumos(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_listar_insumos(uuid) TO authenticated;
