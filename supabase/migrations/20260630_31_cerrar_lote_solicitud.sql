-- ============================================================
-- Migración 31 · Cierre manual de lote de solicitud incompleto
-- ------------------------------------------------------------
-- El trigger fn_actualizar_estado_solicitud ya autocompleta cada ítem
-- (fila de solicitud) cuando la cantidad despachada iguala la
-- solicitada, sin importar si el egreso afectó inventario o no.
-- Cuando un lote (solicitud múltiple) queda con ítems sin completar,
-- el coordinador/admin puede decidir cerrarlo igual en vez de dejarlo
-- abierto hasta despachar el resto.
-- ============================================================

CREATE OR REPLACE FUNCTION sp_cerrar_lote_solicitud(
  p_lote_id uuid,
  p_motivo  text DEFAULT NULL
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
  v_cerrados   int;
BEGIN
  SELECT u.id INTO v_usuario_id
  FROM usuario u
  WHERE u.auth_user_id = auth.uid();

  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  SELECT DISTINCT s.centro_id INTO v_centro_id
  FROM solicitud s
  WHERE s.lote_id = p_lote_id;

  IF v_centro_id IS NULL THEN
    RAISE EXCEPTION 'Lote no encontrado: %', p_lote_id;
  END IF;

  SELECT uc.rol::text INTO v_rol
  FROM usuario_centro uc
  WHERE uc.usuario_id = v_usuario_id
    AND uc.centro_id  = v_centro_id
    AND uc.activo     = true;

  IF v_rol NOT IN ('coordinador_centro', 'administrador_sistema') THEN
    RAISE EXCEPTION 'Sin permiso para cerrar la solicitud';
  END IF;

  UPDATE solicitud
     SET estado        = 'completada',
         observaciones = CASE
           WHEN p_motivo IS NOT NULL THEN COALESCE(observaciones || E'\n', '') || 'Cerrada manualmente: ' || p_motivo
           ELSE observaciones
         END,
         updated_at    = now()
   WHERE lote_id = p_lote_id
     AND estado NOT IN ('completada', 'cancelada');

  GET DIAGNOSTICS v_cerrados = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'items_cerrados', v_cerrados);
END;
$$;

REVOKE ALL ON FUNCTION sp_cerrar_lote_solicitud(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_cerrar_lote_solicitud(uuid, text) TO authenticated;
