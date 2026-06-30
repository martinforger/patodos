-- ============================================================
-- Migración 24 · Categoría de destino, por centro
-- ------------------------------------------------------------
-- Contexto: se necesita clasificar cada destino (Hospitales/CDI,
-- Bomberos, etc.) para poder reportar "a dónde van los egresos"
-- agrupado por tipo de institución. Las categorías son propias de
-- cada centro (no un catálogo global) — mismo patrón que destino y
-- persona: cada centro arranca con 11 categorías precargadas y
-- puede agregar más desde el formulario.
--
-- Cambios:
--   1. Tabla categoria_destino, scopeada por centro_id (RLS con
--      fn_centros_del_usuario()/fn_es_admin(), mismo patrón que
--      persona/destino).
--   2. Seed de las 11 categorías para cada centro_acopio existente.
--   3. sp_registrar_centro_acopio siembra las mismas 11 categorías
--      al crear un centro nuevo.
--   4. sp_listar_categorias_destino / sp_crear_categoria_destino.
--   5. destino.categoria_id (nullable: los destinos existentes no
--      tienen categoría asignada, no se fuerza una adivinanza).
--   6. sp_crear_destino / sp_listar_destinos actualizados.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tabla categoria_destino
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categoria_destino (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centro_id  uuid NOT NULL REFERENCES centro_acopio(id),
  nombre     varchar(150) NOT NULL,
  activo     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (centro_id, nombre)
);

CREATE INDEX IF NOT EXISTS idx_categoria_destino_centro ON categoria_destino (centro_id);

ALTER TABLE categoria_destino ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS categoria_destino_select ON categoria_destino;
DROP POLICY IF EXISTS categoria_destino_insert ON categoria_destino;

CREATE POLICY categoria_destino_select ON categoria_destino FOR SELECT TO authenticated
  USING (centro_id IN (SELECT fn_centros_del_usuario()) OR fn_es_admin());

CREATE POLICY categoria_destino_insert ON categoria_destino FOR INSERT TO authenticated
  WITH CHECK (centro_id IN (SELECT fn_centros_del_usuario()) OR fn_es_admin());

-- ------------------------------------------------------------
-- 2. Seed para centros ya existentes
-- ------------------------------------------------------------
INSERT INTO categoria_destino (centro_id, nombre)
SELECT c.id, cat.nombre
FROM centro_acopio c
CROSS JOIN (VALUES
  ('Hospitales/CDI'),
  ('Instituciones de cuidado geriátrico'),
  ('Bomberos/grupos de rescate'),
  ('Organizaciones de la sociedad civil'),
  ('Instituciones públicas'),
  ('Refugios con centro de acopio'),
  ('Zonas de refugio improvisadas'),
  ('Centros de acopio'),
  ('Zonas de desastre'),
  ('Grupo familiar'),
  ('Ucabistas')
) AS cat(nombre)
ON CONFLICT (centro_id, nombre) DO NOTHING;

-- ------------------------------------------------------------
-- 3. sp_registrar_centro_acopio — sembrar categorías al crear centro
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_registrar_centro_acopio(
  p_nombre character varying,
  p_direccion text,
  p_municipio character varying,
  p_estado_geo character varying,
  p_telefono character varying DEFAULT NULL::character varying,
  p_correo character varying DEFAULT NULL::character varying,
  p_es_publico boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO centro_acopio(nombre, direccion, municipio, estado_geo, telefono, correo, es_publico)
  VALUES (p_nombre, p_direccion, p_municipio, p_estado_geo, p_telefono, p_correo, p_es_publico)
  RETURNING id INTO v_id;

  INSERT INTO categoria_destino (centro_id, nombre)
  SELECT v_id, cat.nombre
  FROM (VALUES
    ('Hospitales/CDI'),
    ('Instituciones de cuidado geriátrico'),
    ('Bomberos/grupos de rescate'),
    ('Organizaciones de la sociedad civil'),
    ('Instituciones públicas'),
    ('Refugios con centro de acopio'),
    ('Zonas de refugio improvisadas'),
    ('Centros de acopio'),
    ('Zonas de desastre'),
    ('Grupo familiar'),
    ('Ucabistas')
  ) AS cat(nombre);

  RETURN jsonb_build_object('id', v_id, 'ok', true);
END;
$function$;

-- ------------------------------------------------------------
-- 4. sp_listar_categorias_destino / sp_crear_categoria_destino
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_listar_categorias_destino(p_centro_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(c) ORDER BY c.nombre), '[]'::jsonb)
    FROM (
      SELECT id, nombre
      FROM categoria_destino
      WHERE centro_id = p_centro_id AND activo = true
      ORDER BY nombre
    ) c
  );
END;
$$;

REVOKE ALL ON FUNCTION sp_listar_categorias_destino(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_listar_categorias_destino(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION sp_crear_categoria_destino(p_centro_id uuid, p_nombre text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT (p_centro_id IN (SELECT fn_centros_del_usuario()) OR fn_es_admin()) THEN
    RAISE EXCEPTION 'No tiene acceso a este centro';
  END IF;

  INSERT INTO categoria_destino (centro_id, nombre)
  VALUES (p_centro_id, trim(p_nombre))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'nombre', trim(p_nombre), 'ok', true);
END;
$$;

REVOKE ALL ON FUNCTION sp_crear_categoria_destino(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_crear_categoria_destino(uuid, text) TO authenticated;

-- ------------------------------------------------------------
-- 5. destino.categoria_id (nullable — no se adivina en histórico)
-- ------------------------------------------------------------
ALTER TABLE destino
  ADD COLUMN IF NOT EXISTS categoria_id uuid REFERENCES categoria_destino(id);

-- ------------------------------------------------------------
-- 6. sp_crear_destino / sp_listar_destinos actualizados
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS sp_crear_destino(uuid, varchar, text, varchar, varchar, text);

CREATE OR REPLACE FUNCTION sp_crear_destino(
  p_centro_id    uuid,
  p_nombre       varchar,
  p_direccion    text,
  p_municipio    varchar,
  p_estado_geo   varchar,
  p_categoria_id uuid DEFAULT NULL,
  p_referencia   text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO destino(centro_id, nombre, direccion, municipio, estado_geo, categoria_id, referencia)
  VALUES (p_centro_id, p_nombre, p_direccion, p_municipio, p_estado_geo, p_categoria_id, p_referencia)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'ok', true);
END;
$$;

REVOKE ALL ON FUNCTION sp_crear_destino(uuid, varchar, text, varchar, varchar, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_crear_destino(uuid, varchar, text, varchar, varchar, uuid, text) TO authenticated;

DROP FUNCTION IF EXISTS sp_listar_destinos(uuid);

CREATE OR REPLACE FUNCTION sp_listar_destinos(p_centro_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(d) ORDER BY d.nombre), '[]'::jsonb)
    FROM (
      SELECT d.id, d.nombre, d.direccion, d.municipio, d.estado_geo, d.referencia,
             d.categoria_id, cd.nombre AS categoria
      FROM destino d
      LEFT JOIN categoria_destino cd ON cd.id = d.categoria_id
      WHERE d.activo = true
        AND d.centro_id = p_centro_id
      ORDER BY d.nombre
    ) d
  );
END;
$$;

REVOKE ALL ON FUNCTION sp_listar_destinos(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_listar_destinos(uuid) TO authenticated;
