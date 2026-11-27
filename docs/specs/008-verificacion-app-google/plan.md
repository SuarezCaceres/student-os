# Plan · 008 · Verificación de la app StudentOS en Google

> Estado: **aprobado** por el humano el 2026-11-25. Se empieza por el bloque A.
> Se escribe después de aprobar la spec (aprobada el 2026-11-24). Dice **cómo**.

## Enfoque
Esta funcionalidad es en su mayor parte **trabajo del humano en Google Cloud Console**; el repositorio solo prepara lo que Google va a leer y fija con pruebas lo que no debe cambiar sin avisar. El plan separa tres tipos de pasos:
- **A · Repo, ya** (no dependen de nadie): documentos de scopes y justificación, guion del vídeo, registro de rondas y la prueba que fija los scopes.
- **B · Repo, con datos o decisiones del humano**: páginas legales sin marcadores y alineadas con la 009 (necesitan Q2, Q10 y que la 009 salga a producción a la vez), explicación en la landing.
- **H · Humano**: dominio, Search Console, consola, vídeo, envío y respuestas a Google. El agente solo los prepara, los guía y registra las evidencias.

Alternativa descartada: automatizar la consola de Google desde el repo. No existe API para enviar la verificación y el checklist ya la marca como compuerta humana.

**No requiere migración de BD ni dependencias nuevas.** No toca `apps/web/src/sync/` ni el borrado/exportación de cuenta (solo se **prueba** en producción, C15). Si el paso A1 concluye que hay que cambiar scopes (Q9), eso **sí** necesita tu aprobación expresa antes de tocar `GOOGLE_SCOPES`, 009-C4 y el ADR 0005.

## Cambios por área
| Área | Archivos / módulos | Qué cambia |
|---|---|---|
| Documentos | `docs/specs/008-verificacion-app-google/scopes.md` (nuevo) | Tabla endpoint → scope mínimo con enlace a la referencia oficial (C9). |
| Documentos | `docs/specs/008-verificacion-app-google/justificaciones.md` (nuevo) | Un texto en inglés por permiso y, junto a cada afirmación, la prueba o el archivo que la respalda (C11). |
| Documentos | `docs/specs/008-verificacion-app-google/video-guion.md` (nuevo) | Guion final del vídeo a partir del Anexo A de la spec, con una columna «existe en la app tras 009» (C12). |
| Documentos | `docs/specs/008-verificacion-app-google/rondas-google.md` (nuevo) | Registro de rondas con Google: fecha, qué pidieron, qué se respondió, quién (C16, C17). |
| Documentos | `docs/google-verification-checklist.md` | Se actualiza para que coincida con esta spec y la 009: scopes sin `profile`, sin paso de «desconectar», con enlaces a los documentos anteriores y un solo origen de verdad (C1). |
| Backend (prueba) | `apps/api/src/google/scopes-verificados.spec.ts` (nuevo) | Fija `GOOGLE_SCOPES` contra una lista de «scopes verificados»; si difieren, falla con un mensaje que explica que cambiar scopes obliga a reverificar (C8). No cambia código de producción. |
| Frontend (páginas legales) | `apps/web/public/legal/privacidad.html`, `terminos.html` | Rellenar marcadores; lista exacta de permisos sin `profile`; Calendar como parte del acceso; cómo se retira el permiso; conservar la declaración de uso limitado (C4, C5). **Texto con efecto jurídico: lo revisa el humano (Q10).** |
| Frontend (landing) | `apps/web/src/components/landing/` | Texto que explique qué es StudentOS y para qué usa los datos de Google, con el nombre exacto de la consola; `LegalLinks` ya está montado en el pie (C6). |
| Frontend (prueba) | `apps/web/src/components/legal/legalPages.test.ts` (nuevo) | Lee los HTML: sin marcadores, sin `profile`, con la declaración de uso limitado y el enlace a la política de Google (C4, C5). |
| Frontend (assets) | `apps/web/public/` | Logotipo definitivo de 120×120 sin marcas de Google, si Q5 lo confirma. No se renombra el actual sin avisar. |
| Datos | — | Sin migración. |
| Contrato | — | Sin cambios en `packages/shared` ni en endpoints. |

## Pruebas
| Criterio | Tipo | Dónde / evidencia |
|---|---|---|
| C1 | Revisión | Checklist sin casillas abiertas, tras el último paso. |
| C2 | Evidencia (humano) | Correo o estado «Verified» de Google y entrada con cuenta ajena sin aviso (también 009-C12). |
| C3 | Evidencia + comprobación HTTP | Capturas de Search Console y `curl -I` de la home y las dos páginas legales. |
| C4 | Unitaria (web) | `legalPages.test.ts`. **Solo se añade cuando el humano entrega los datos (Q2)**: si no, fallaría para siempre y no se puede desactivar una prueba para que pase. |
| C5 | Unitaria + revisión | `legalPages.test.ts` comprueba «sin `profile`» y «declaración de uso limitado»; el resto (coherencia con la 009) se revisa leyendo el texto. |
| C6 | Unitaria + E2E | `LegalLinks.test.tsx` ya existe; se amplía el E2E de la landing con los enlaces y el texto explicativo. Revisión del texto. |
| C7 | Evidencia | Capturas de Branding, Audience y Data access en `docs/qa/evidence/`. |
| C8 | Unitaria (api) | `scopes-verificados.spec.ts`. |
| C9 | Revisión + evidencia | `scopes.md` + captura de la consola con la clasificación «sensible». |
| C10 | Evidencia | Captura de las URIs del cliente OAuth de producción. |
| C11 | Revisión contrastada | `justificaciones.md`: cada afirmación enlaza a código, ADR 0005 o prueba (por ejemplo, 005-C1 y el proxy `google.controller.ts`). |
| C12 | Revisión | `video-guion.md` contrastado con la app tras la 009. |
| C13 | Evidencia (humano) | URL del vídeo en `docs/PROGRESS.md` y revisión del vídeo contra el guion. |
| C14 | Evidencia (humano) | Cuenta ajena en producción: login y conexión viva tras más de 7 días (también 005-C3 y 009-C5). |
| C15 | Evidencia (humano) | Exportar y borrar cuenta real en producción y ver desaparecer el permiso en `myaccount.google.com/permissions`. Las pruebas automáticas ya existen (006, 009-C13). |
| C16 | Revisión | `rondas-google.md` y entrada en `docs/PROGRESS.md`. |
| C17 | Revisión | `rondas-google.md` y los PR enlazados. |

## Pasos
Cada paso deja el proyecto en verde (`./scripts/check.sh` pasa) y acaba en un commit en su propia rama `feat/008-…` o `docs/008-…`, nunca en `main`.

**Bloque A · ya, sin esperar a nadie**
1. **A1 · Tabla de scopes (C9).** Escribir `scopes.md` con cada endpoint del proxy y el scope que la referencia oficial de Google acepta. Cerrar la duda de `calendars.get`. Si el resultado exige quitar o cambiar un scope (por ejemplo, uno más estrecho que `calendar.readonly`): **parar y preguntarte (Q9)** antes de tocar código.
2. **A2 · Prueba que fija los scopes (C8).** `scopes-verificados.spec.ts`. Es una prueba nueva sobre código existente; se escribe antes de cualquier cambio y debe pasar con los cuatro scopes actuales.
3. **A3 · Justificaciones (C11).** `justificaciones.md` en inglés, una por permiso, con la afirmación y su respaldo. Antes de dar por buena «no guardamos eventos de Calendar», comprobar en `google.controller.ts` y los adaptadores de sync que ningún cuerpo de evento se persiste; si se persiste, se corrige el texto, no el código.
4. **A4 · Guion y registro (C12, C16, C17).** `video-guion.md` y `rondas-google.md` (vacío con su formato).
5. **A5 · Checklist (C1).** Reescribir `docs/google-verification-checklist.md` para que remita a estos documentos y quede una sola fuente de verdad.

**Bloque H1 · humano, con 007 desplegada** (el agente guía, tú ejecutas)
6. **H1 · Dominio y Search Console (C3).** Elegir y comprar el dominio (Q1), asignarlo en Vercel y verificarlo con la cuenta propietaria del proyecto de Cloud.
7. **H2 · Consola de Google (C7, C10).** Branding, Audience, Data access y URIs del cliente de producción (Q3, Q4, Q5). Declarar solo los scopes de A2.
8. **H3 · Pasar a *In production* sin verificar (C14).** Para que el refresh token no caduque a los 7 días. Probar con una cuenta ajena.

**Bloque B · repo, cuando haya datos y la 009 esté lista**
9. **B1 · Páginas legales (C4, C5).** Con los datos de Q2 y el texto revisado (Q10): rellenar marcadores, quitar `profile`, ajustar «opcional/desconectar» a lo que decida la 009. Añadir `legalPages.test.ts`. **Se despliega a la vez que la 009**: si no, la política describiría un comportamiento que aún no existe.
10. **B2 · Landing (C6).** Texto explicativo y prueba E2E de los enlaces.

**Bloque H2 · humano, con 009 en producción**
11. **H4 · Prueba en producción (C15).** Exportar y borrar cuenta real; comprobar la revocación.
12. **H5 · Grabar el vídeo (C13).** Con el guion de A4 y una cuenta ajena, en el dominio de producción. Publicarlo «No listado» y anotar la URL.
13. **H6 · Enviar la verificación (C16).** Rellenar el formulario con dominio, URLs, justificaciones y vídeo; anotar la fecha en `PROGRESS.md`.

**Seguimiento**
14. **S · Rondas con Google (C17, C2).** Cada correo se registra en `rondas-google.md` y se responde en el mismo hilo. Los cambios que toquen el repo van en un PR enlazado a la spec. Cuando Google apruebe: comprobar que el aviso desapareció, marcar `pasa: true` solo en los criterios con evidencia y estado → `revision` → `hecho`.

## Riesgos
- **Legal y 009 desfasadas:** publicar la política nueva antes que la 009 la haría falsa; publicarla después deja a Google leyendo una política que contradice el flujo. Mitigación: B1 sale en el mismo despliegue que la 009.
- **El vídeo queda obsoleto** si el flujo cambia después de grabarlo (spec, casos límite). Mitigación: grabar solo con la 009 en producción (Q7).
- **Datos del humano que faltan** (Q1–Q5, Q10) bloquean H1–H3 y B1; el bloque A no depende de ellos, por eso va primero.
- **Scopes:** si A1 demuestra que hace falta cambiar alguno, se reabre 009-C4 y el ADR 0005 y hay que repetir justificaciones y vídeo. Se decide antes de H2 para no declarar en la consola algo que luego cambie.
- **Google cuestiona Calendar obligatorio:** plan B de la spec (hacerlo opcional, reabre 009-C9); decisión tuya.
- **Rondas largas:** la aprobación no depende de nosotros; hasta entonces el producto sigue con el tope de 100 usuarios y el aviso de «no verificada».
- **Cuenta o dominio equivocados:** el dominio debe verificarse con la misma cuenta que posee el proyecto de Cloud; revisarlo en H1 antes de comprar nada más.
