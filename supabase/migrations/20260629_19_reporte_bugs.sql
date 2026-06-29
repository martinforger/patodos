-- Tabla de reportes de bugs
CREATE TABLE IF NOT EXISTS reporte_bug (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    uuid REFERENCES usuario(id),
  titulo        varchar(200) NOT NULL,
  descripcion   text NOT NULL,
  pagina        varchar(300),
  estado        varchar(20) NOT NULL DEFAULT 'por_revisar'
                  CHECK (estado IN ('por_revisar', 'en_proceso', 'solucionado')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reporte_bug ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_updated_at_reporte_bug
  BEFORE UPDATE ON reporte_bug
  FOR EACH ROW EXECUTE FUNCTION fn_actualizar_updated_at();

-- Políticas RLS
-- Cualquier usuario autenticado puede insertar su propio reporte
CREATE POLICY "usuarios pueden insertar bugs"
  ON reporte_bug FOR INSERT TO authenticated
  WITH CHECK (
    usuario_id = (SELECT id FROM usuario WHERE auth_user_id = auth.uid() LIMIT 1)
  );

-- Cada usuario puede ver solo sus propios bugs
CREATE POLICY "usuarios ven sus bugs"
  ON reporte_bug FOR SELECT TO authenticated
  USING (
    usuario_id = (SELECT id FROM usuario WHERE auth_user_id = auth.uid() LIMIT 1)
    OR
    (SELECT uc.rol FROM usuario u JOIN usuario_centro uc ON uc.usuario_id = u.id
     WHERE u.auth_user_id = auth.uid() LIMIT 1) = 'administrador_sistema'
  );

-- Solo administrador puede actualizar estado
CREATE POLICY "admin puede actualizar bugs"
  ON reporte_bug FOR UPDATE TO authenticated
  USING (
    (SELECT uc.rol FROM usuario u JOIN usuario_centro uc ON uc.usuario_id = u.id
     WHERE u.auth_user_id = auth.uid() LIMIT 1) = 'administrador_sistema'
  );

-- =====================================================================
-- SP: crear reporte de bug (cualquier usuario autenticado)
-- =====================================================================
CREATE OR REPLACE FUNCTION sp_crear_reporte_bug(
  p_titulo      text,
  p_descripcion text,
  p_pagina      text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_usuario_id uuid;
  v_bug_id     uuid;
BEGIN
  SELECT id INTO v_usuario_id
  FROM usuario
  WHERE auth_user_id = auth.uid()
  LIMIT 1;

  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  INSERT INTO reporte_bug (usuario_id, titulo, descripcion, pagina)
  VALUES (v_usuario_id, trim(p_titulo), trim(p_descripcion), nullif(trim(coalesce(p_pagina,'')), ''))
  RETURNING id INTO v_bug_id;

  RETURN jsonb_build_object('id', v_bug_id);
END;
$$;

REVOKE ALL ON FUNCTION sp_crear_reporte_bug(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_crear_reporte_bug(text, text, text) TO authenticated;

-- =====================================================================
-- SP: listar todos los reportes de bugs (solo admin)
-- =====================================================================
CREATE OR REPLACE FUNCTION sp_listar_reportes_bug()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_rol text;
BEGIN
  SELECT uc.rol INTO v_rol
  FROM usuario u
  JOIN usuario_centro uc ON uc.usuario_id = u.id
  WHERE u.auth_user_id = auth.uid()
  LIMIT 1;

  IF v_rol != 'administrador_sistema' THEN
    RAISE EXCEPTION 'Sin permisos';
  END IF;

  RETURN (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id',          rb.id,
        'titulo',      rb.titulo,
        'descripcion', rb.descripcion,
        'pagina',      rb.pagina,
        'estado',      rb.estado,
        'created_at',  rb.created_at,
        'usuario',     jsonb_build_object(
                         'nombre',   u.nombre,
                         'apellido', u.apellido,
                         'correo',   u.correo
                       )
      )
      ORDER BY rb.created_at DESC
    )
    FROM reporte_bug rb
    JOIN usuario u ON u.id = rb.usuario_id
  );
END;
$$;

REVOKE ALL ON FUNCTION sp_listar_reportes_bug() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_listar_reportes_bug() TO authenticated;

-- =====================================================================
-- SP: actualizar estado de un bug (solo admin)
-- =====================================================================
CREATE OR REPLACE FUNCTION sp_actualizar_estado_bug(
  p_bug_id uuid,
  p_estado text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_rol text;
BEGIN
  IF p_estado NOT IN ('por_revisar', 'en_proceso', 'solucionado') THEN
    RAISE EXCEPTION 'Estado inválido: %', p_estado;
  END IF;

  SELECT uc.rol INTO v_rol
  FROM usuario u
  JOIN usuario_centro uc ON uc.usuario_id = u.id
  WHERE u.auth_user_id = auth.uid()
  LIMIT 1;

  IF v_rol != 'administrador_sistema' THEN
    RAISE EXCEPTION 'Sin permisos';
  END IF;

  UPDATE reporte_bug
  SET estado = p_estado
  WHERE id = p_bug_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION sp_actualizar_estado_bug(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sp_actualizar_estado_bug(uuid, text) TO authenticated;
