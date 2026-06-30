-- ============================================================
-- Migración 29 · Agrupar sp_listar_solicitudes_pendientes por lote
-- ------------------------------------------------------------
-- El selector "Solicitud asociada" del formulario de egreso mostraba un
-- renglón por insumo, incluso cuando varios insumos pertenecían a la misma
-- solicitud (lote). Ahora se agrupa por COALESCE(lote_id, id) y cada
-- elemento expone `items[]` con los insumos del lote, permitiendo
-- seleccionar y autocargar todos los insumos de una sola vez.
-- ============================================================

DROP FUNCTION IF EXISTS sp_listar_solicitudes_pendientes(uuid, uuid);

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
    WITH base AS (
      SELECT
        s.id,
        s.lote_id,
        COALESCE(s.lote_id, s.id) AS grp,
        s.fecha_solicitud,
        s.cantidad_solicitada,
        s.estado,
        s.insumo_id,
        trim(i.nombre || COALESCE(' ' || i.presentacion, '') || COALESCE(' ' || i.unidad_medida, '')) AS insumo,
        p.nombre || ' ' || p.apellido AS solicitante,
        s.destino_id,
        d.nombre      AS destino,
        d.municipio   AS destino_municipio,
        d.estado_geo  AS destino_estado_geo
      FROM solicitud s
      JOIN insumo  i ON i.id = s.insumo_id
      JOIN persona p ON p.id = s.solicitante_id
      LEFT JOIN destino d ON d.id = s.destino_id
      WHERE s.centro_id = p_centro_id
        AND s.estado IN ('pendiente', 'parcialmente_atendida')
        AND (p_insumo_id IS NULL OR s.insumo_id = p_insumo_id)
    )
    SELECT COALESCE(jsonb_agg(row_to_json(g) ORDER BY g.fecha_solicitud), '[]'::jsonb)
    FROM (
      SELECT
        grp                                          AS id,
        CASE WHEN bool_or(lote_id IS NOT NULL) THEN grp ELSE NULL END AS lote_id,
        bool_or(lote_id IS NOT NULL)                 AS es_lote,
        COUNT(*)::int                                AS num_insumos,
        MAX(fecha_solicitud)                         AS fecha_solicitud,
        MAX(solicitante)                             AS solicitante,
        (MAX(destino_id::text))::uuid                AS destino_id,
        MAX(destino)                                 AS destino,
        MAX(destino_municipio)                       AS destino_municipio,
        MAX(destino_estado_geo)                      AS destino_estado_geo,
        bool_or(estado = 'parcialmente_atendida')    AS tiene_parcial,
        jsonb_agg(jsonb_build_object(
          'id', id,
          'insumo_id', insumo_id,
          'insumo', insumo,
          'cantidad_solicitada', cantidad_solicitada,
          'estado', estado
        ) ORDER BY insumo) AS items
      FROM base
      GROUP BY grp
    ) g
  );
END;
$$;

REVOKE ALL ON FUNCTION sp_listar_solicitudes_pendientes(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_listar_solicitudes_pendientes(uuid, uuid) TO authenticated;
