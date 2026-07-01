-- ============================================================
-- Migración 34 · Control de entregas por persona / familia (HU-16)
-- ------------------------------------------------------------
-- Contexto: cortar el abuso de pedir el mismo insumo varias veces (el
-- mismo día o a lo largo de la semana) para revenderlo. El dato ya existe
-- (detalle_egreso.persona_contacto_id + movimiento.fecha_movimiento);
-- estas funciones solo LEEN y lo exponen.
--
-- Se cuentan TODOS los egresos no anulados, afecten o no el inventario:
-- para efectos de "ya le entregué esto" da igual si descontó stock.
-- ============================================================

-- ============================================================
-- 1. sp_historial_entregas_persona
-- ------------------------------------------------------------
-- Todo lo que una persona (como persona_contacto) ha recibido en el centro.
-- ============================================================
CREATE OR REPLACE FUNCTION sp_historial_entregas_persona(
  p_persona_id uuid,
  p_centro_id  uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.fecha_movimiento DESC, t.created_at DESC), '[]'::jsonb)
    FROM (
      SELECT
        m.id,
        m.fecha_movimiento,
        m.cantidad,
        m.afecta_inventario,
        m.lote_id,
        trim(i.nombre || COALESCE(' ' || i.presentacion, '') || COALESCE(' ' || i.unidad_medida, '')) AS insumo,
        dst.nombre AS destino,
        gf.nombre_familia AS grupo_familiar,
        m.created_at
      FROM movimiento m
      JOIN detalle_egreso de ON de.movimiento_id = m.id
      JOIN insumo         i  ON i.id = m.insumo_id
      LEFT JOIN destino   dst ON dst.id = de.destino_id
      LEFT JOIN grupo_familiar gf ON gf.id = de.grupo_familiar_id
      WHERE m.centro_id = p_centro_id
        AND m.tipo = 'egreso'
        AND m.anulado = false
        AND de.persona_contacto_id = p_persona_id
      ORDER BY m.fecha_movimiento DESC, m.created_at DESC
    ) t
  );
END;
$$;

REVOKE ALL ON FUNCTION sp_historial_entregas_persona(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_historial_entregas_persona(uuid, uuid) TO authenticated;

-- ============================================================
-- 2. sp_historial_entregas_familia
-- ------------------------------------------------------------
-- Todo lo entregado a un grupo familiar (por detalle_egreso.grupo_familiar_id).
-- ============================================================
CREATE OR REPLACE FUNCTION sp_historial_entregas_familia(
  p_grupo_familiar_id uuid,
  p_centro_id         uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.fecha_movimiento DESC, t.created_at DESC), '[]'::jsonb)
    FROM (
      SELECT
        m.id,
        m.fecha_movimiento,
        m.cantidad,
        m.afecta_inventario,
        m.lote_id,
        trim(i.nombre || COALESCE(' ' || i.presentacion, '') || COALESCE(' ' || i.unidad_medida, '')) AS insumo,
        CASE WHEN pc.id IS NOT NULL THEN pc.nombre || ' ' || pc.apellido ELSE '—' END AS recibido_por,
        m.created_at
      FROM movimiento m
      JOIN detalle_egreso de ON de.movimiento_id = m.id
      JOIN insumo         i  ON i.id = m.insumo_id
      LEFT JOIN persona   pc ON pc.id = de.persona_contacto_id
      WHERE m.centro_id = p_centro_id
        AND m.tipo = 'egreso'
        AND m.anulado = false
        AND de.grupo_familiar_id = p_grupo_familiar_id
      ORDER BY m.fecha_movimiento DESC, m.created_at DESC
    ) t
  );
END;
$$;

REVOKE ALL ON FUNCTION sp_historial_entregas_familia(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_historial_entregas_familia(uuid, uuid) TO authenticated;

-- ============================================================
-- 3. sp_entregas_recientes — corazón del aviso
-- ------------------------------------------------------------
-- Para los insumos indicados y la persona O su familia, devuelve por
-- insumo lo entregado HOY y en los ÚLTIMOS 7 DÍAS (la ventana de 7 días
-- incluye el día de hoy). Retorna [] si no hay nada.
-- ============================================================
CREATE OR REPLACE FUNCTION sp_entregas_recientes(
  p_centro_id         uuid,
  p_persona_id        uuid,
  p_grupo_familiar_id uuid,
  p_insumo_ids        uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF (p_persona_id IS NULL AND p_grupo_familiar_id IS NULL)
     OR p_insumo_ids IS NULL
     OR array_length(p_insumo_ids, 1) IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.insumo), '[]'::jsonb)
    FROM (
      SELECT
        m.insumo_id,
        trim(i.nombre || COALESCE(' ' || i.presentacion, '') || COALESCE(' ' || i.unidad_medida, '')) AS insumo,
        SUM(m.cantidad) FILTER (WHERE m.fecha_movimiento = CURRENT_DATE)            AS cantidad_hoy,
        COUNT(*)        FILTER (WHERE m.fecha_movimiento = CURRENT_DATE)            AS veces_hoy,
        SUM(m.cantidad) FILTER (WHERE m.fecha_movimiento >= CURRENT_DATE - 6)       AS cantidad_semana,
        COUNT(*)        FILTER (WHERE m.fecha_movimiento >= CURRENT_DATE - 6)       AS veces_semana
      FROM movimiento m
      JOIN detalle_egreso de ON de.movimiento_id = m.id
      JOIN insumo         i  ON i.id = m.insumo_id
      WHERE m.centro_id = p_centro_id
        AND m.tipo = 'egreso'
        AND m.anulado = false
        AND m.insumo_id = ANY(p_insumo_ids)
        AND m.fecha_movimiento >= CURRENT_DATE - 6
        AND (
          (p_persona_id        IS NOT NULL AND de.persona_contacto_id = p_persona_id)
          OR (p_grupo_familiar_id IS NOT NULL AND de.grupo_familiar_id = p_grupo_familiar_id)
        )
      GROUP BY m.insumo_id, i.nombre, i.presentacion, i.unidad_medida
      HAVING SUM(m.cantidad) FILTER (WHERE m.fecha_movimiento >= CURRENT_DATE - 6) > 0
    ) t
  );
END;
$$;

REVOKE ALL ON FUNCTION sp_entregas_recientes(uuid, uuid, uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_entregas_recientes(uuid, uuid, uuid, uuid[]) TO authenticated;
