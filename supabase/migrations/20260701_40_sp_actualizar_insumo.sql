-- ============================================================
-- Migración 40 · sp_actualizar_insumo + sp_listar_todos_insumos
-- ------------------------------------------------------------
-- Agrega:
--   - sp_actualizar_insumo: permite editar nombre, categoría,
--     unidad de medida, presentación y estado activo/inactivo
--     de un insumo del centro del usuario.
--   - sp_listar_todos_insumos: lista todos los insumos de un centro
--     (incluidos inactivos), para el panel de gestión.
-- ============================================================

-- ------------------------------------------------------------
-- sp_actualizar_insumo
-- SECURITY DEFINER: insumo usa RLS scopeada pero el UPDATE también
-- necesita poder escribir sin restric. de políticas adicionales.
-- Se valida el acceso al centro dentro del cuerpo del SP.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sp_actualizar_insumo(
  p_id            uuid,
  p_nombre        text,
  p_categoria_id  uuid,
  p_unidad_medida text    DEFAULT NULL,
  p_presentacion  text    DEFAULT NULL,
  p_activo        boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_centro_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  -- Obtener el centro del insumo para validar acceso
  SELECT centro_id INTO v_centro_id FROM insumo WHERE id = p_id;

  IF v_centro_id IS NULL THEN
    RAISE EXCEPTION 'Insumo no encontrado';
  END IF;

  IF NOT (v_centro_id IN (SELECT fn_centros_del_usuario()) OR fn_es_admin()) THEN
    RAISE EXCEPTION 'Sin acceso a este insumo';
  END IF;

  UPDATE insumo
  SET
    nombre        = trim(p_nombre),
    categoria_id  = p_categoria_id,
    unidad_medida = nullif(trim(coalesce(p_unidad_medida, '')), ''),
    presentacion  = nullif(trim(coalesce(p_presentacion, '')), ''),
    activo        = p_activo,
    updated_at    = now()
  WHERE id = p_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.sp_actualizar_insumo(uuid, text, uuid, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sp_actualizar_insumo(uuid, text, uuid, text, text, boolean) TO authenticated;

-- ------------------------------------------------------------
-- sp_listar_todos_insumos — incluye inactivos (para panel gestión)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sp_listar_todos_insumos(
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
        'id',            i.id,
        'nombre',        i.nombre,
        'categoria_id',  i.categoria_id,
        'categoria',     ci.nombre,
        'unidad_medida', i.unidad_medida,
        'presentacion',  i.presentacion,
        'activo',        i.activo
      )
      ORDER BY ci.nombre, i.nombre
    )
    FROM insumo i
    JOIN categoria_insumo ci ON ci.id = i.categoria_id
    WHERE i.centro_id = p_centro_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sp_listar_todos_insumos(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sp_listar_todos_insumos(uuid) TO authenticated;
