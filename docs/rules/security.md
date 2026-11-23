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

## Dependencias
- Pregunta antes de añadir una dependencia. Prefiere librerías mantenidas y populares.
- No ejecutes scripts descargados de fuentes desconocidas.

## Lecciones aprendidas
<!-- AAAA-MM-DD · Qué pasó → Qué hacer en su lugar. -->
