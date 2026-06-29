-- ============================================================
-- Migración 08 · Limpieza de superficie de ejecución (advisors de seguridad)
-- ------------------------------------------------------------
-- - Revoca EXECUTE de funciones que NO deben ser invocables vía REST:
--   los triggers de sistema y el event-trigger rls_auto_enable siguen
--   disparándose por el motor independientemente de estos GRANT.
-- - Elimina fn_usuario_actual() (helper sin uso).
--
-- NOTA: fn_es_admin() y fn_centros_del_usuario() permanecen ejecutables por
-- 'authenticated' a propósito: son referenciadas dentro de políticas RLS y
-- PostgreSQL exige EXECUTE sobre ellas para evaluar las políticas. Igual que
-- sp_bootstrap_inicial(), que debe ser invocable (está protegido internamente).
-- ============================================================

-- Triggers de sistema: el motor los ejecuta sin pasar por GRANT
REVOKE ALL ON FUNCTION fn_actualizar_stock()            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION fn_actualizar_estado_solicitud() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION fn_actualizar_updated_at()       FROM PUBLIC, anon, authenticated;

-- Event trigger de Supabase (secure-by-default): no debe exponerse por REST
REVOKE ALL ON FUNCTION rls_auto_enable() FROM PUBLIC, anon, authenticated;

-- Helper sin uso
DROP FUNCTION IF EXISTS fn_usuario_actual();
