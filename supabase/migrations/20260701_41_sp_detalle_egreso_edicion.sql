-- ============================================================
-- Migración 41 · sp_detalle_egreso_edicion
-- ------------------------------------------------------------
-- Retorna el detalle estructurado con IDs para edición de egresos.
-- Incluye sub-objetos de destino, contacto y grupo familiar.
-- ============================================================

CREATE OR REPLACE FUNCTION public.sp_detalle_egreso_edicion(
  p_id uuid,
  p_es_lote boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_mov_ids uuid[];
  v_cab jsonb;
  v_items jsonb;
  v_resps jsonb;
  v_destino jsonb;
  v_contacto jsonb;
  v_grupo_familiar jsonb;
BEGIN
  IF p_es_lote THEN
    SELECT array_agg(id) INTO v_mov_ids
    FROM movimiento
    WHERE lote_id = p_id AND tipo = 'egreso';
  ELSE
    v_mov_ids := ARRAY[p_id];
  END IF;

  IF v_mov_ids IS NULL OR cardinality(v_mov_ids) = 0 THEN
    RAISE EXCEPTION 'Egreso no encontrado';
  END IF;

  -- 1. Destino
  SELECT jsonb_build_object(
    'id', d.id,
    'nombre', d.nombre,
    'municipio', d.municipio,
    'estado_geo', d.estado_geo
  ) INTO v_destino
  FROM movimiento m
  JOIN detalle_egreso de ON de.movimiento_id = m.id
  JOIN destino d ON d.id = de.destino_id
  WHERE m.id = v_mov_ids[1];

  -- 2. Contacto
  SELECT jsonb_build_object(
    'id', p.id,
    'nombre', p.nombre,
    'apellido', p.apellido,
    'telefono', p.telefono,
    'cedula', p.cedula
  ) INTO v_contacto
  FROM movimiento m
  JOIN detalle_egreso de ON de.movimiento_id = m.id
  JOIN persona p ON p.id = de.persona_contacto_id
  WHERE m.id = v_mov_ids[1];

  -- 3. Grupo familiar (opcional)
  SELECT CASE WHEN de.grupo_familiar_id IS NOT NULL THEN
    jsonb_build_object(
      'id', gf.id,
      'representante_id', rep.id,
      'representante_nombre', rep.nombre,
      'representante_apellido', rep.apellido,
      'representante_telefono', rep.telefono,
      'representante_cedula', rep.cedula
    )
    ELSE NULL END INTO v_grupo_familiar
  FROM movimiento m
  JOIN detalle_egreso de ON de.movimiento_id = m.id
  LEFT JOIN grupo_familiar gf ON gf.id = de.grupo_familiar_id
  LEFT JOIN persona rep ON rep.id = gf.representante_id
  WHERE m.id = v_mov_ids[1];

  -- 4. Cabecera general
  SELECT jsonb_build_object(
    'fecha',               m.fecha_movimiento,
    'observaciones',       m.observaciones,
    'afecta_inventario',   m.afecta_inventario
  ) INTO v_cab
  FROM movimiento m
  WHERE m.id = v_mov_ids[1];

  -- 5. Items (insumos y cantidades)
  SELECT jsonb_agg(jsonb_build_object(
    'insumo_id',    m.insumo_id,
    'cantidad',     m.cantidad,
    'solicitud_id', (SELECT sm.solicitud_id FROM solicitud_movimiento sm WHERE sm.movimiento_id = m.id LIMIT 1)
  )) INTO v_items
  FROM movimiento m
  WHERE m.id = ANY(v_mov_ids);

  -- 6. Responsables
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'persona_id', re.persona_id,
    'nombre',     re.nombre,
    'apellido',   re.apellido,
    'telefono',   re.telefono
  )), '[]'::jsonb) INTO v_resps
  FROM responsable_entrega re
  JOIN detalle_egreso de ON de.id = re.detalle_egreso_id
  WHERE de.movimiento_id = v_mov_ids[1];

  RETURN v_cab 
    || jsonb_build_object('destino', v_destino)
    || jsonb_build_object('contacto', v_contacto)
    || jsonb_build_object('grupo_familiar', COALESCE(v_grupo_familiar, 'null'::jsonb))
    || jsonb_build_object('items', COALESCE(v_items, '[]'::jsonb))
    || jsonb_build_object('responsables', COALESCE(v_resps, '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.sp_detalle_egreso_edicion(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sp_detalle_egreso_edicion(uuid, boolean) TO authenticated;
