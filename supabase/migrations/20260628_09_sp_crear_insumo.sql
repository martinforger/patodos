-- SP para crear un insumo nuevo desde el formulario de ingreso.
-- SECURITY DEFINER: insumo es tabla catálogo global sin política INSERT para
-- usuarios autenticados (solo SELECT). Cualquier usuario autenticado puede
-- agregar insumos al catálogo compartido; la elevación es intencional.
CREATE OR REPLACE FUNCTION sp_crear_insumo(
  p_nombre        text,
  p_unidad_medida text,
  p_categoria_id  uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_categoria_nombre text;
  v_id               uuid;
BEGIN
  -- Verifica que el caller esté autenticado
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT nombre INTO v_categoria_nombre
  FROM categoria_insumo
  WHERE id = p_categoria_id AND activo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Categoría no encontrada o inactiva';
  END IF;

  INSERT INTO insumo (categoria_id, nombre, unidad_medida)
  VALUES (p_categoria_id, trim(p_nombre), trim(p_unidad_medida))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'id',            v_id,
    'nombre',        trim(p_nombre),
    'unidad_medida', trim(p_unidad_medida),
    'categoria',     v_categoria_nombre
  );
END;
$$;

REVOKE ALL ON FUNCTION sp_crear_insumo(text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_crear_insumo(text, text, uuid) TO authenticated;
