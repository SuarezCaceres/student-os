# Reglas de seguridad

## Secretos
- Los secretos viven en `.env` (nunca commiteado). En `.env.example` solo van los nombres.
- No leas `.env` ni imprimas secretos en logs, pruebas o respuestas.
- Nunca escribas claves, tokens ni contraseñas directamente en el código.

## Entrada y salida
- Valida y sanea toda entrada externa. Usa consultas parametrizadas, nunca SQL concatenado.
- Escapa la salida en el frontend. No uses inserciones de HTML sin sanear.

## Autenticación y autorización
- Cada endpoint protegido comprueba la autenticación **y** que el usuario tenga permiso sobre ese recurso concreto.
- Las contraseñas se guardan con un hash robusto (bcrypt/argon2), nunca en claro.

## Reglas específicas de StudentOS
StudentOS es un producto público: trata los datos de cada usuario como si ya hubiera usuarios externos, aunque el estado sea prototipo.

- **Exportar y borrar cuenta cubren todo dato nuevo.** Toda colección de sync o tabla nueva que guarde datos de usuario debe entrar en `GET /account/export` (`registerAccountExportContributor`, `apps/api/src/public/account-export.registry.ts`) y en el borrado de cuenta (`registerAccountDeletionHook`, `apps/api/src/common/account-deletion.ts`), con una prueba que lo compruebe (aislamiento entre usuarios A y B incluido).
- **Tablas nuevas con RLS.** Ninguna tabla nueva sin política de acceso por usuario. Tras cada migración se ejecuta `apps/api/prisma/rls-baseline.sql`, que falla si una tabla existe sin RLS activa; añade ahí las tablas nuevas.
- **Google: tokens y secretos nunca en logs ni en el cliente.** El navegador no ve ningún token de Google; el *refresh token* vive solo cifrado en el servidor (AES-256-GCM, `apps/api/src/google/token-cipher.ts`). No imprimas `GOOGLE_CLIENT_SECRET` ni `GOOGLE_TOKEN_ENC_KEY` ni los uses en pruebas con valores reales. **Rotar `GOOGLE_TOKEN_ENC_KEY` requiere aprobación del humano**: deja ilegibles los tokens guardados.
- **Límites de uso por usuario.** Todo endpoint nuevo pasa por el limitador por usuario (`UserThrottlerGuard`, `apps/api/src/common/security/user-throttler.guard.ts`). Los controladores de cuenta ya lo aplican.
- **Logs sin datos personales.** Usa los serializadores de `apps/api/src/common/log-serializers.ts` y `common/security/pii.ts`; registra `userRef`, nunca el id ni el correo.

## Dependencias
- Pregunta antes de añadir una dependencia. Prefiere librerías mantenidas y populares.
- No ejecutes scripts descargados de fuentes desconocidas.

## Lecciones aprendidas
<!-- AAAA-MM-DD · Qué pasó → Qué hacer en su lugar. -->
