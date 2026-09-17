#!/usr/bin/env python3
# PAR DE PUERTOS SERIALES VIRTUALES (AYUDANTE SIN INSTALACION)
#
# Crea dos pseudo-terminales (PTY) enlazados y los mantiene vivos, como hace
# socat, pero sin necesidad de instalar socat ni permisos de administrador.
# Se usa junto a gramera-platform.js para simular una gramera en Linux:
#
#   Terminal A:  python3 gramera-pair.py
#                (imprime dos rutas, ej. /dev/pts/5 y /dev/pts/6)
#   Terminal B:  node gramera-platform.js /dev/pts/5 9600
#   En la app:   Gramera -> activa "puerto manual" -> escribe /dev/pts/6 -> Conectar
#
# Ctrl+C cierra el par.
#
# NO forma parte del servidor; es solo una herramienta de pruebas.

import os
import pty
import select
import sys
import errno

AYUDA = """Uso: python3 gramera-pair.py

Crea un par de puertos seriales virtuales enlazados (dos /dev/pts/N) y los
mantiene abiertos hasta que pulses Ctrl+C. Usa una ruta para gramera-platform.js
y la otra para la gramera de la aplicacion (puerto manual)."""


def poner_raw(fd):
    try:
        import tty
        tty.setraw(fd)
    except Exception:
        pass


def main():
    if len(sys.argv) > 1 and sys.argv[1].lower() in ("-h", "--help", "help", "ayuda"):
        print(AYUDA)
        return

    master1, slave1 = pty.openpty()
    master2, slave2 = pty.openpty()

    for fd in (master1, slave1, master2, slave2):
        poner_raw(fd)

    ruta1 = os.ttyname(slave1)
    ruta2 = os.ttyname(slave2)

    print("Par de puertos seriales virtuales listo.")
    print("  PAR_VIRTUAL_1=" + ruta1)
    print("  PAR_VIRTUAL_2=" + ruta2)
    print("")
    print("1) Simulador : node gramera-platform.js " + ruta1 + " 9600")
    print("2) App       : gramera -> puerto manual -> " + ruta2 + " -> Conectar")
    print("")
    print("Ctrl+C para cerrar el par.")
    sys.stdout.flush()

    try:
        while True:
            try:
                listos, _, _ = select.select([master1, master2], [], [])
            except InterruptedError:
                continue

            for fd in listos:
                try:
                    datos = os.read(fd, 4096)
                except OSError as err:
                    if err.errno in (errno.EIO, errno.EBADF):
                        continue
                    raise
                if not datos:
                    continue
                salida = master2 if fd == master1 else master1
                try:
                    os.write(salida, datos)
                except OSError as err:
                    if err.errno not in (errno.EIO, errno.EBADF):
                        raise
    except KeyboardInterrupt:
        pass
    finally:
        for fd in (master1, slave1, master2, slave2):
            try:
                os.close(fd)
            except OSError:
                pass
        print("\nPar de puertos virtuales cerrado.")


if __name__ == "__main__":
    main()
