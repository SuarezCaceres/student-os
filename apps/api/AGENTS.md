# Backend (apps/api)

Antes de tocar código aquí, lee:
- `docs/stack/backend.md`: tecnologías y comandos
- `docs/rules/backend.md`: reglas obligatorias
- `docs/rules/security.md`: siempre que toques auth, datos de usuario o endpoints
- skill `backend-proyecto`

Específico de este proyecto:
- El guard JWT de Supabase es **global**: toda ruta está protegida salvo las marcadas con `@Public()`. El `userId` sale siempre de `@CurrentUser()`, nunca del body ni de la query.
- El dato de dominio viaja por `/sync` (`src/sync/`); los módulos `kanban`, `university`, `gym` y `calendar` son hoy controladores vacíos (ver `docs/TASKS.md`).
- **Zonas protegidas (pregunta antes de tocar):** borrado y exportación de cuenta (`src/public/`, `src/common/account-deletion.ts`) y el cifrado del token de Google (`src/google/token-cipher.ts`, variable `GOOGLE_TOKEN_ENC_KEY`).
- Migraciones: `prisma/migrations/` se aplica **a mano** contra Supabase. Nunca edites una migración aplicada; crear una nueva requiere aprobación.
- No registres PII ni tokens en los logs (`src/common/log-serializers.ts` y `src/common/security/pii.ts`).
- Pruebas: unitarias `*.spec.ts` junto al código (Jest) e integración en `test/*.e2e-spec.ts` con Postgres embebido. Comando: `npm run test:e2e -w @student-os/api`.
- Render no auto-despliega (`autoDeploy: false`): no cambies `render.yaml` sin avisar.

Las reglas generales siguen en el `AGENTS.md` de la raíz.
