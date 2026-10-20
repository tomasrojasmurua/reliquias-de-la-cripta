"""Genera datos/pistas.js desde fuentes/banco-pistas.json.

Respuesta y explicación van ofuscadas (XOR + base64) para que no se lean
mirando el código del sitio. No es cifrado de verdad: solo evita spoilers.
Uso: python3 herramientas/generar-pistas.py
"""
import base64, json, pathlib

RAIZ = pathlib.Path(__file__).resolve().parent.parent
CLAVE = b"reliquias-de-la-cripta"


def ofuscar(texto):
    b = texto.encode("utf-8")
    x = bytes(c ^ CLAVE[i % len(CLAVE)] for i, c in enumerate(b))
    return base64.b64encode(x).decode("ascii")


banco = json.loads((RAIZ / "fuentes" / "banco-pistas.json").read_text("utf-8"))
filas = []
for p in banco["pistas"]:
    filas.append([
        p["id"], p["fecha"], p["pista"], p["longitud"], p["tipo"],
        p["definicion"], p["indicador"], p["relleno"], p["dificultad"],
        ofuscar(p["respuesta"]), ofuscar(p["explicacion"]),
    ])

js = ("// Generado por herramientas/generar-pistas.py. No editar a mano.\n"
      "// [id, fecha, pista, longitud, tipo, definicion[], indicador[], relleno[], dificultad, respuesta*, explicacion*]\n"
      "export const PISTAS = [\n"
      + ",\n".join(json.dumps(f, ensure_ascii=False) for f in filas)
      + "\n];\n")
(RAIZ / "datos" / "pistas.js").write_text(js, "utf-8")
print(len(filas), "pistas escritas en datos/pistas.js")
