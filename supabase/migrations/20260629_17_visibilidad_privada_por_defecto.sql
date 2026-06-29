-- ============================================================
-- Migración 17 · Centros privados por defecto + SP cambiar visibilidad
-- ------------------------------------------------------------
-- Los centros que existían al crear la migración 16 quedaron como
-- públicos (DEFAULT true). Esta migración los pasa todos a privado
-- y cambia el DEFAULT para que los nuevos centros nazcan privados.
-- ============================================================

-- 1. Todos los centros existentes pasan a privado
UPDATE centro_acopio SET es_publico = false;

-- 2. Cambiar DEFAULT a false (más conservador)
ALTER TABLE centro_acopio ALTER COLUMN es_publico SET DEFAULT false;

-- 3. SP para que admin o coordinador del centro cambie la visibilidad
CREATE OR REPLACE FUNCTION sp_cambiar_visibilidad_centro(
  p_centro_id  uuid,
  p_es_publico boolean
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT fn_es_coordinador(p_centro_id) THEN
    RAISE EXCEPTION 'Solo el coordinador o administrador del centro puede cambiar su visibilidad';
  END IF;

  UPDATE centro_acopio
  SET es_publico = p_es_publico, updated_at = now()
  WHERE id = p_centro_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION sp_cambiar_visibilidad_centro(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_cambiar_visibilidad_centro(uuid, boolean) TO authenticated;
