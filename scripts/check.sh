#!/usr/bin/env bash
# Sensor principal del harness: lint + tipos + pruebas.
# Uso:  ./scripts/check.sh            → verificación completa
#       ./scripts/check.sh --rapido   → sin E2E (lo usa el hook pre-commit)
# Sale con código distinto de 0 si algo falla.
set -uo pipefail
cd "$(dirname "$0")/.."

# ── RELLENAR según el stack (la skill init-stack lo completa) ──────────────
LINT_CMD=""          # p. ej.: "npm run lint"
TYPECHECK_CMD=""     # p. ej.: "npm run typecheck"   |  "mypy ."
TEST_UNIT_CMD=""     # p. ej.: "npm run test:unit"   |  "pytest tests/unit"
TEST_INT_CMD=""      # p. ej.: "npm run test:int"    |  "pytest tests/integration"
TEST_E2E_CMD=""      # p. ej.: "npx playwright test"
# ──────────────────────────────────────────────────────────────────────────

RAPIDO=false
[ "${1:-}" = "--rapido" ] && RAPIDO=true

fallos=0
sin_configurar=0

run() {
  local nombre="$1" cmd="$2"
  if [ -z "$cmd" ]; then
    echo "⚠ $nombre: sin configurar (rellena scripts/check.sh)"
    sin_configurar=$((sin_configurar + 1))
    return
  fi
  echo "▶ $nombre: $cmd"
  if eval "$cmd"; then
    echo "✔ $nombre"
  else
    echo "✘ $nombre FALLÓ"
    fallos=$((fallos + 1))
  fi
}

run "Lint"        "$LINT_CMD"
run "Tipos"       "$TYPECHECK_CMD"
run "Unitarias"   "$TEST_UNIT_CMD"
run "Integración" "$TEST_INT_CMD"
if [ "$RAPIDO" = false ]; then
  run "E2E" "$TEST_E2E_CMD"
fi

echo "────────────────────────"
if [ "$fallos" -gt 0 ]; then
  echo "✘ $fallos verificación(es) fallaron. No está terminado."
  exit 1
fi
if [ "$sin_configurar" -gt 0 ]; then
  echo "⚠ Pasa, pero hay $sin_configurar verificación(es) sin configurar."
else
  echo "✔ Todo pasa."
fi
