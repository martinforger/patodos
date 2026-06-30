-- ============================================================
-- Migración 26 · sp_buscar_destino
-- ------------------------------------------------------------
-- Búsqueda viva de destinos (mismo patrón que sp_buscar_persona),
-- para reemplazar el <select> de destino en el formulario de egreso
-- por un buscador en vivo.
-- ============================================================

CREATE OR REPLACE FUNCTION sp_buscar_destino(
  p_termino   text,
  p_centro_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_term text := '%' || lower(trim(p_termino)) || '%';
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(d) ORDER BY d.nombre), '[]'::jsonb)
    FROM (
      SELECT d.id, d.nombre, d.municipio, d.estado_geo, d.referencia,
             d.categoria_id, cd.nombre AS categoria
      FROM destino d
      LEFT JOIN categoria_destino cd ON cd.id = d.categoria_id
      WHERE d.activo = true
        AND d.centro_id = p_centro_id
        AND (
          lower(d.nombre)    LIKE v_term
          OR lower(d.municipio) LIKE v_term
        )
      ORDER BY d.nombre
      LIMIT 20
    ) d
  );
END;
$$;

REVOKE ALL ON FUNCTION sp_buscar_destino(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_buscar_destino(text, uuid) TO authenticated;
