-- Agrega insumo_id al resultado de sp_listar_solicitudes_pendientes
-- para que el formulario de egreso pueda comparar con el inventario.

CREATE OR REPLACE FUNCTION sp_listar_solicitudes_pendientes(
  p_centro_id uuid,
  p_insumo_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.fecha_solicitud), '[]'::jsonb)
    FROM (
      SELECT
        s.id,
        s.fecha_solicitud,
        s.cantidad_solicitada,
        s.estado,
        s.insumo_id,
        i.nombre        AS insumo,
        i.unidad_medida,
        p.nombre || ' ' || p.apellido AS solicitante
      FROM solicitud s
      JOIN insumo  i ON i.id = s.insumo_id
      JOIN persona p ON p.id = s.solicitante_id
      WHERE s.centro_id = p_centro_id
        AND s.estado IN ('pendiente', 'parcialmente_atendida')
        AND (p_insumo_id IS NULL OR s.insumo_id = p_insumo_id)
      ORDER BY s.fecha_solicitud
    ) r
  );
END;
$$;

REVOKE ALL ON FUNCTION sp_listar_solicitudes_pendientes(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_listar_solicitudes_pendientes(uuid, uuid) TO authenticated;
