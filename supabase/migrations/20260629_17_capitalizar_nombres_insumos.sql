-- Capitaliza con initcap() todos los nombres existentes en la tabla insumo.
-- initcap pone en mayúscula la primera letra de cada palabra.
UPDATE insumo
SET nombre = initcap(nombre)
WHERE nombre <> initcap(nombre);

-- Actualiza sp_crear_insumo para que los nuevos insumos siempre entren capitalizados.
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
  v_nombre_final     text;
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

  v_nombre_final := initcap(trim(p_nombre));

  INSERT INTO insumo (categoria_id, nombre, unidad_medida)
  VALUES (p_categoria_id, v_nombre_final, trim(p_unidad_medida))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'id',            v_id,
    'nombre',        v_nombre_final,
    'unidad_medida', trim(p_unidad_medida),
    'categoria',     v_categoria_nombre
  );
END;
$$;

REVOKE ALL ON FUNCTION sp_crear_insumo(text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_crear_insumo(text, text, uuid) TO authenticated;
