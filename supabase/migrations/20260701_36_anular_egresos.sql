-- ============================================================
-- Migración 36 · Anulación de egresos (soft delete)
-- ------------------------------------------------------------
-- Permite anular egresos individuales o en lotes completos.
-- Solo coordinadores de centro y administradores de sistema
-- pueden realizar esta acción. Restituye automáticamente el stock
-- e identifica y actualiza el estado de solicitudes vinculadas.
-- ============================================================

CREATE OR REPLACE FUNCTION public.sp_anular_egreso(
  p_id     uuid,
  p_es_lote boolean,
  p_motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_usuario_id uuid;
  v_centro_id  uuid;
  v_rol        text;
  v_mov_ids    uuid[];
  v_sol_id     uuid;
  v_despachado numeric(12,2);
  v_solicitada numeric(12,2);
  v_estado_sol estado_solicitud;
BEGIN
  -- 1. Obtener el usuario autenticado
  SELECT u.id INTO v_usuario_id
  FROM usuario u
  WHERE u.auth_user_id = auth.uid();

  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  -- 2. Obtener el centro_id y validar que existan movimientos válidos del tipo 'egreso'
  IF p_es_lote THEN
    SELECT DISTINCT m.centro_id INTO v_centro_id
    FROM movimiento m
    WHERE m.lote_id = p_id AND m.tipo = 'egreso';
  ELSE
    SELECT m.centro_id INTO v_centro_id
    FROM movimiento m
    WHERE m.id = p_id AND m.tipo = 'egreso';
  END IF;

  IF v_centro_id IS NULL THEN
    RAISE EXCEPTION 'Egreso o lote no encontrado';
  END IF;

  -- 3. Validar rol/permisos en ese centro
  SELECT uc.rol::text INTO v_rol
  FROM usuario_centro uc
  WHERE uc.usuario_id = v_usuario_id
    AND uc.centro_id  = v_centro_id
    AND uc.activo     = true;

  IF v_rol NOT IN ('coordinador_centro', 'administrador_sistema') THEN
    RAISE EXCEPTION 'Sin permiso para anular egresos';
  END IF;

  -- 4. Obtener los IDs de movimiento a anular que no estén anulados
  IF p_es_lote THEN
    SELECT array_agg(m.id) INTO v_mov_ids
    FROM movimiento m
    WHERE m.lote_id = p_id AND m.tipo = 'egreso' AND m.anulado = false;
  ELSE
    SELECT ARRAY[m.id] INTO v_mov_ids
    FROM movimiento m
    WHERE m.id = p_id AND m.tipo = 'egreso' AND m.anulado = false;
  END IF;

  IF v_mov_ids IS NULL OR cardinality(v_mov_ids) = 0 THEN
    RAISE EXCEPTION 'El egreso ya está anulado o no existe';
  END IF;

  -- 5. Anular los movimientos
  UPDATE movimiento SET
    anulado        = true,
    anulado_por    = v_usuario_id,
    anulado_motivo = p_motivo,
    anulado_at     = now()
  WHERE id = ANY(v_mov_ids);

  -- 6. Recalcular el estado de las solicitudes vinculadas
  FOR v_sol_id IN
    SELECT DISTINCT sm.solicitud_id
    FROM solicitud_movimiento sm
    WHERE sm.movimiento_id = ANY(v_mov_ids)
  LOOP
    -- Obtener la cantidad ya despachada no anulada
    SELECT COALESCE(SUM(m.cantidad), 0) INTO v_despachado
    FROM solicitud_movimiento sm
    JOIN movimiento m ON m.id = sm.movimiento_id
    WHERE sm.solicitud_id = v_sol_id AND m.anulado = false;

    -- Obtener la cantidad solicitada
    SELECT s.cantidad_solicitada INTO v_solicitada
    FROM solicitud s
    WHERE s.id = v_sol_id;

    -- Determinar el nuevo estado
    IF v_despachado = 0 THEN
      v_estado_sol := 'pendiente';
    ELSIF v_despachado < v_solicitada THEN
      v_estado_sol := 'parcialmente_atendida';
    ELSE
      v_estado_sol := 'completada';
    END IF;

    -- Actualizar la solicitud si no está cancelada
    UPDATE solicitud
    SET estado = v_estado_sol,
        updated_at = now()
    WHERE id = v_sol_id AND estado != 'cancelada';
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'anulados', cardinality(v_mov_ids));
END;
$$;

-- Habilitar RLS/Grants sobre el SP
REVOKE ALL ON FUNCTION public.sp_anular_egreso(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sp_anular_egreso(uuid, boolean, text) TO authenticated;
