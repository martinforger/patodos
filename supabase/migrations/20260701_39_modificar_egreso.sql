-- ============================================================
-- Migración 39 · sp_modificar_egreso
-- ------------------------------------------------------------
-- Permite que coordinadores y admins modifiquen un egreso activo.
-- Internamente: anula el egreso original (o lote completo) y crea
-- uno nuevo con los nuevos datos. La operación es atómica.
--
-- Solo funciona sobre egresos no anulados.
-- El trigger trg_actualizar_stock revierte el stock del viejo
-- y decrementa por el nuevo automáticamente.
-- ============================================================

CREATE OR REPLACE FUNCTION public.sp_modificar_egreso(
  p_id                uuid,       -- movimiento_id (si no es lote) o lote_id (si es lote)
  p_es_lote           boolean,
  p_items             jsonb,      -- [{insumo_id, cantidad, solicitud_id?}]
  p_destino_id        uuid,
  p_contacto_id       uuid,
  p_responsables      jsonb,      -- [{persona_id?, nombre, apellido, telefono}]
  p_fecha             date,
  p_observaciones     text        DEFAULT NULL,
  p_afecta_inventario boolean     DEFAULT true,
  p_grupo_familiar_id uuid        DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_usuario_id   uuid;
  v_centro_id    uuid;
  v_rol          text;
  v_mov_ids      uuid[];
  v_nuevo_lote   uuid;
  v_mov_id       uuid;
  v_det_id       uuid;
  v_item         jsonb;
  v_resp         jsonb;
  v_sol_id       uuid;
  v_despachado   numeric(12,2);
  v_solicitada   numeric(12,2);
  v_estado_sol   estado_solicitud;
  v_nuevo_id     uuid;   -- id retornado (lote_id o movimiento_id)
  v_es_lote_out  boolean;
BEGIN
  -- 1. Obtener el usuario autenticado
  SELECT u.id INTO v_usuario_id
  FROM usuario u
  WHERE u.auth_user_id = auth.uid();

  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  -- 2. Obtener el centro_id del egreso original
  IF p_es_lote THEN
    SELECT DISTINCT m.centro_id INTO v_centro_id
    FROM movimiento m
    WHERE m.lote_id = p_id AND m.tipo = 'egreso' AND m.anulado = false;
  ELSE
    SELECT m.centro_id INTO v_centro_id
    FROM movimiento m
    WHERE m.id = p_id AND m.tipo = 'egreso' AND m.anulado = false;
  END IF;

  IF v_centro_id IS NULL THEN
    RAISE EXCEPTION 'El egreso no existe o ya está anulado';
  END IF;

  -- 3. Validar rol en ese centro
  SELECT uc.rol::text INTO v_rol
  FROM usuario_centro uc
  WHERE uc.usuario_id = v_usuario_id
    AND uc.centro_id  = v_centro_id
    AND uc.activo     = true;

  IF v_rol NOT IN ('coordinador_centro', 'administrador_sistema') THEN
    RAISE EXCEPTION 'Sin permiso para modificar egresos';
  END IF;

  -- 4. Obtener los IDs de movimientos a anular
  IF p_es_lote THEN
    SELECT array_agg(m.id) INTO v_mov_ids
    FROM movimiento m
    WHERE m.lote_id = p_id AND m.tipo = 'egreso' AND m.anulado = false;
  ELSE
    SELECT ARRAY[p_id] INTO v_mov_ids;
  END IF;

  IF v_mov_ids IS NULL OR cardinality(v_mov_ids) = 0 THEN
    RAISE EXCEPTION 'No se encontraron movimientos activos para modificar';
  END IF;

  -- 5. Anular los movimientos originales
  UPDATE movimiento SET
    anulado        = true,
    anulado_por    = v_usuario_id,
    anulado_motivo = 'Modificado',
    anulado_at     = now()
  WHERE id = ANY(v_mov_ids);

  -- 6. Recalcular estado de solicitudes vinculadas al egreso original
  FOR v_sol_id IN
    SELECT DISTINCT sm.solicitud_id
    FROM solicitud_movimiento sm
    WHERE sm.movimiento_id = ANY(v_mov_ids)
  LOOP
    SELECT COALESCE(SUM(m.cantidad), 0) INTO v_despachado
    FROM solicitud_movimiento sm
    JOIN movimiento m ON m.id = sm.movimiento_id
    WHERE sm.solicitud_id = v_sol_id AND m.anulado = false;

    SELECT s.cantidad_solicitada INTO v_solicitada
    FROM solicitud s WHERE s.id = v_sol_id;

    IF v_despachado = 0 THEN
      v_estado_sol := 'pendiente';
    ELSIF v_despachado < v_solicitada THEN
      v_estado_sol := 'parcialmente_atendida';
    ELSE
      v_estado_sol := 'completada';
    END IF;

    UPDATE solicitud
    SET estado = v_estado_sol, updated_at = now()
    WHERE id = v_sol_id AND estado != 'cancelada';
  END LOOP;

  -- 7. Crear los nuevos movimientos
  v_nuevo_lote := NULL;
  v_nuevo_id   := NULL;

  -- Si hay más de un ítem, usar un nuevo lote_id
  IF jsonb_array_length(p_items) > 1 THEN
    v_nuevo_lote := gen_random_uuid();
  END IF;

  v_es_lote_out := v_nuevo_lote IS NOT NULL;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO movimiento (
      centro_id, insumo_id, tipo, cantidad, fecha_movimiento,
      usuario_id, observaciones, lote_id, afecta_inventario
    ) VALUES (
      v_centro_id,
      (v_item->>'insumo_id')::uuid,
      'egreso',
      (v_item->>'cantidad')::numeric,
      p_fecha,
      v_usuario_id,
      p_observaciones,
      v_nuevo_lote,
      p_afecta_inventario
    )
    RETURNING id INTO v_mov_id;

    -- Si solo hay un ítem, el nuevo_id es el movimiento_id
    IF v_nuevo_lote IS NULL THEN
      v_nuevo_id := v_mov_id;
    ELSE
      v_nuevo_id := v_nuevo_lote;
    END IF;

    -- Crear detalle_egreso (1:1 con movimiento)
    INSERT INTO detalle_egreso (movimiento_id, destino_id, persona_contacto_id, grupo_familiar_id)
    VALUES (v_mov_id, p_destino_id, p_contacto_id, p_grupo_familiar_id)
    RETURNING id INTO v_det_id;

    -- Crear responsables de entrega
    FOR v_resp IN SELECT * FROM jsonb_array_elements(p_responsables)
    LOOP
      INSERT INTO responsable_entrega (
        detalle_egreso_id, persona_id,
        nombre, apellido, telefono
      ) VALUES (
        v_det_id,
        nullif(v_resp->>'persona_id', '')::uuid,
        v_resp->>'nombre',
        v_resp->>'apellido',
        v_resp->>'telefono'
      );
    END LOOP;

    -- Vincular solicitud si viene en el ítem
    IF (v_item->>'solicitud_id') IS NOT NULL AND (v_item->>'solicitud_id') != '' THEN
      INSERT INTO solicitud_movimiento (solicitud_id, movimiento_id)
      VALUES ((v_item->>'solicitud_id')::uuid, v_mov_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok',      true,
    'nuevo_id', v_nuevo_id,
    'es_lote',  v_es_lote_out
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sp_modificar_egreso(uuid, boolean, jsonb, uuid, uuid, jsonb, date, text, boolean, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sp_modificar_egreso(uuid, boolean, jsonb, uuid, uuid, jsonb, date, text, boolean, uuid) TO authenticated;
