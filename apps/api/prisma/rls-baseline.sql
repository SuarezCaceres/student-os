-- =============================================================================
-- StudentOS - Linea base de RLS (defensa en profundidad)
-- =============================================================================
-- La API NO usa PostgREST/Supabase Data API: se conecta con Prisma por conexion directa
-- (rol `postgres` o equivalente, que tiene BYPASSRLS) y aplica la autorizacion en el codigo
-- (siempre filtra por `userId` = `sub` del JWT).
--
-- Aun asi, TODAS las tablas del esquema `public` quedan expuestas por la Data API de Supabase
-- a los roles `anon` y `authenticated`. Si alguien filtrara la anon key, sin RLS podria leer o
-- escribir tablas. Por eso: RLS activada + SIN politicas para anon/authenticated = denegar todo.
--
-- QUIEN LO EJECUTA: el Integrador, DESPUES de aplicar las migraciones de Prisma (una vez por
-- ola, y cada vez que aparezcan tablas nuevas). Es idempotente: se puede reejecutar.
-- Los agentes NO lo ejecutan contra proyectos compartidos.
--
-- COMO: SQL Editor de Supabase, `psql "$DIRECT_URL" -f apps/api/prisma/rls-baseline.sql`
-- o la herramienta apply_migration del conector Supabase.
-- =============================================================================

-- 1) Activar RLS (y forzarla tambien para el dueno de la tabla) en TODAS las tablas de la app.
--    Excluye la tabla interna de Prisma. Usa el esquema configurado en DATABASE_URL (`public` por
--    defecto); para un esquema privado de pruebas cambia el valor de `target_schema`.
DO $$
DECLARE
  target_schema text := 'public';
  t record;
BEGIN
  FOR t IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = target_schema
      AND tablename <> '_prisma_migrations'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', target_schema, t.tablename);
    -- FORCE: el dueno de la tabla tambien se somete a RLS salvo que tenga BYPASSRLS
    -- (el rol postgres de Supabase lo tiene, por lo que la API sigue funcionando).
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', target_schema, t.tablename);
    -- Quitar cualquier privilegio directo de los roles de la Data API.
    EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM anon, authenticated', target_schema, t.tablename);
  END LOOP;
END
$$;

-- 2) Que las tablas FUTURAS no hereden privilegios para anon/authenticated.
--    (En Supabase, `public` concede por defecto ALL a anon/authenticated/service_role.)
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

-- 2b) Tablas conocidas hoy (Ola 2-3). El bucle del paso 1 ya las cubre; esta comprobacion las nombra
--     para que el script FALLE EN ALTO (en vez de dejar una tabla abierta) si alguna existe sin RLS forzada.
--       profiles         (base.prisma)   - perfil minimo del usuario
--       sync_records     (sync.prisma)   - datos de la app por usuario (jsonb)
--       user_sync_state  (sync.prisma)   - cursor y ultima sincronizacion
--     Si una tabla aun no existe en el esquema (migracion no aplicada) se omite sin error.
DO $$
DECLARE
  target_schema text := 'public';
  expected text[] := ARRAY['profiles', 'sync_records', 'user_sync_state'];
  t text;
  oid_ regclass;
  missing text[] := ARRAY[]::text[];
BEGIN
  FOREACH t IN ARRAY expected LOOP
    oid_ := to_regclass(format('%I.%I', target_schema, t));
    IF oid_ IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM pg_class WHERE oid = oid_ AND relrowsecurity AND relforcerowsecurity
    ) THEN
      missing := missing || t;
    END IF;
  END LOOP;
  IF array_length(missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'RLS no esta activa y forzada en: %', array_to_string(missing, ', ');
  END IF;
END
$$;

-- 2c) GOOGLE (Ola 3): tablas con secretos. DESCOMENTAR y ajustar los nombres a los que defina google.prisma
--     cuando se fusione. No requieren politicas: el bucle del paso 1 ya las deja en "denegar todo" para
--     anon/authenticated y la API (rol con BYPASSRLS) es la unica que las lee. Nunca se exponen por la Data API.
--       google_connections  (refresh token CIFRADO AES-256-GCM, correo de la cuenta, scopes, fecha de conexion)
--       google_oauth_states (state/PKCE verifier temporales del flujo de autorizacion)
--
-- DO $$
-- DECLARE
--   t text;
-- BEGIN
--   FOREACH t IN ARRAY ARRAY['google_connections', 'google_oauth_states'] LOOP
--     IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
--       EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
--       EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
--       EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t);
--     END IF;
--   END LOOP;
-- END
-- $$;

-- 3) Verificacion: debe devolver 0 filas (ninguna tabla de la app sin RLS).
--    SELECT schemaname, tablename FROM pg_tables
--    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' AND NOT rowsecurity;

-- -----------------------------------------------------------------------------
-- PATRON OPCIONAL por tabla: si algun dia el cliente web lee una tabla DIRECTAMENTE con
-- supabase-js (no es el plan: todo pasa por la API), en vez de dejarla cerrada crea politicas
-- por propietario. Ejemplo para una tabla con columna "userId" de tipo uuid (convencion del repo):
--
--   CREATE POLICY "owner_select" ON public.mi_tabla FOR SELECT TO authenticated
--     USING ((SELECT auth.uid()) = "userId");
--   CREATE POLICY "owner_modify" ON public.mi_tabla FOR ALL TO authenticated
--     USING ((SELECT auth.uid()) = "userId") WITH CHECK ((SELECT auth.uid()) = "userId");
--   GRANT SELECT, INSERT, UPDATE, DELETE ON public.mi_tabla TO authenticated;
--
-- (Usa `(SELECT auth.uid())` y no `auth.uid()` a secas: se evalua una vez por consulta.)
-- Cualquier excepcion asi debe quedar documentada en docs/agent-notes y revisada por el Integrador.
-- -----------------------------------------------------------------------------
