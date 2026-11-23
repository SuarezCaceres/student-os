#!/usr/bin/env bash
# Prepara el entorno de desarrollo. Debe poder ejecutarse varias veces sin romper nada.
# Los agentes lo ejecutan al empezar una sesión si el entorno no está levantado.
set -euo pipefail
cd "$(dirname "$0")"

echo "▶ Configurando hooks de git (.githooks)"
git config core.hooksPath .githooks
chmod +x .githooks/* scripts/*.sh .claude/hooks/*.sh 2>/dev/null || true

echo "▶ Comprobando el enlace .claude/skills → .agents/skills"
if [ -L .claude/skills ] && [ -d .claude/skills ]; then
  echo "  ok"
else
  echo "  ⚠ .claude/skills no es un enlace válido. Claude Code no verá las skills."
  echo "    Solución: ln -s ../.agents/skills .claude/skills   (en Windows, ver README)"
fi

if [ ! -f .env ] && [ -f .env.example ]; then
  echo "▶ Creando .env a partir de .env.example (rellena los valores)"
  cp .env.example .env
fi

# ── RELLENAR según el stack (la skill init-stack lo completa) ──────────────
if [ ! -d node_modules ]; then
  echo "▶ Instalando dependencias (npm ci; el script prepare compila shared y genera el cliente Prisma)"
  npm ci
else
  echo "▶ Dependencias ya instaladas (si cambió package-lock.json, ejecuta: npm ci)"
fi
# No hay servicios que levantar: las pruebas de integración usan Postgres embebido y las E2E,
# Supabase y Google simulados (apps/api/test/e2e-harness).
# Migraciones: NO se aplican aquí. Las de producción son manuales (ver docs/rules/backend.md).
# Para las E2E la primera vez:  npx playwright install chromium
# ──────────────────────────────────────────────────────────────────────────

echo "✔ Entorno listo"
