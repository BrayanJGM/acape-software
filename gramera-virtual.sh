#!/usr/bin/env bash
# GRAMERA VIRTUAL - TODO EN UNO (Linux)
#
# Ejecuta este unico archivo y deja lista la gramera virtual:
#   1) crea un par de puertos seriales virtuales (/dev/pts/N <-> /dev/pts/M)
#   2) arranca el simulador de gramera en uno de los extremos
#   3) te muestra que puerto poner en la aplicacion (el otro extremo)
#
# Uso:
#   ./gramera-virtual.sh            (9600 baud por defecto)
#   ./gramera-virtual.sh 4800       (elige el baudRate)
#
# Ctrl+C cierra todo.
#
# NO forma parte del servidor; es solo una herramienta de pruebas.

set -u

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BAUD="${1:-9600}"

PAIR_PID=""
LOG_PAIR=""

limpiar() {
  if [ -n "$PAIR_PID" ] && kill -0 "$PAIR_PID" 2>/dev/null; then
    kill "$PAIR_PID" 2>/dev/null
    wait "$PAIR_PID" 2>/dev/null
  fi
  if [ -n "$LOG_PAIR" ] && [ -f "$LOG_PAIR" ]; then
    rm -f "$LOG_PAIR"
  fi
}

trap limpiar EXIT INT TERM

echo "=== Gramera virtual ACAPE ==="

if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: no se encontro python3 (necesario para crear el par de puertos)."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: no se encontro node (necesario para el simulador)."
  exit 1
fi

if [ ! -f "$DIR/gramera-pair.py" ] || [ ! -f "$DIR/gramera-platform.js" ]; then
  echo "ERROR: faltan gramera-pair.py o gramera-platform.js en $DIR"
  exit 1
fi

LOG_PAIR="$(mktemp -t gramera-pair.XXXXXX)"
python3 -u "$DIR/gramera-pair.py" > "$LOG_PAIR" 2>&1 &
PAIR_PID=$!

PAR1=""
PAR2=""
for _ in $(seq 1 50); do
  PAR1="$(grep -m1 'PAR_VIRTUAL_1=' "$LOG_PAIR" 2>/dev/null | cut -d= -f2- | tr -d '[:space:]')"
  PAR2="$(grep -m1 'PAR_VIRTUAL_2=' "$LOG_PAIR" 2>/dev/null | cut -d= -f2- | tr -d '[:space:]')"
  [ -n "$PAR1" ] && [ -n "$PAR2" ] && break
  if ! kill -0 "$PAIR_PID" 2>/dev/null; then
    break
  fi
  sleep 0.1
done

if [ -z "$PAR1" ] || [ -z "$PAR2" ]; then
  echo "ERROR: no se pudo crear el par de puertos virtuales."
  echo "--- salida del par ---"
  cat "$LOG_PAIR" 2>/dev/null
  exit 1
fi

echo ""
echo "Par virtual creado:"
echo "   simulador -> $PAR1"
echo ""
echo "======================================================"
echo " En la APP: Gramera -> activa \"puerto manual\""
echo " y escribe este puerto:  $PAR2"
echo " y pulsa Conectar."
echo "======================================================"
echo ""
echo "Escribe el peso aqui abajo (ej: 1.5 | 1500g | help). Ctrl+C para salir."
echo ""

node "$DIR/gramera-platform.js" "$PAR1" "$BAUD"
