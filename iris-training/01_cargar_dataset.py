"""
01_cargar_dataset.py
Fase 1: Carga y organización del dataset de iris de vacas.
Recorre la estructura Vaca{N}/Ojo{1,2}/ y genera un CSV con rutas y etiquetas.
"""

import os
import csv
import re
from pathlib import Path

# ─────────────────────────── CONFIGURACIÓN ───────────────────────────
DATASET_ROOT = Path(r"C:\Users\usuario\OneDrive\unipoli\Union ganaderaa\FOTOS")
OUTPUT_CSV   = Path(__file__).parent / "dataset.csv"
IMG_EXTS     = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"}
# ─────────────────────────────────────────────────────────────────────


def es_imagen(path: Path) -> bool:
    return path.suffix.lower() in IMG_EXTS


def extraer_id_vaca(nombre_carpeta: str) -> int | None:
    """Extrae el número de la carpeta 'VacaN'. Retorna None si no coincide."""
    m = re.fullmatch(r"[Vv]aca(\d+)", nombre_carpeta.strip())
    return int(m.group(1)) if m else None


def cargar_dataset(root: Path) -> list[dict]:
    registros = []

    if not root.exists():
        raise FileNotFoundError(f"No se encontró la carpeta raíz: {root}")

    carpetas_vaca = sorted(root.iterdir(), key=lambda p: p.name.lower())

    for carpeta_vaca in carpetas_vaca:
        if not carpeta_vaca.is_dir():
            continue

        id_vaca = extraer_id_vaca(carpeta_vaca.name)
        if id_vaca is None:
            print(f"  [SKIP] Carpeta ignorada (no coincide patrón VacaN): {carpeta_vaca.name}")
            continue

        # Buscar sub-carpetas Ojo1 / Ojo2
        subcarpetas_ojo = [
            d for d in sorted(carpeta_vaca.iterdir())
            if d.is_dir() and re.fullmatch(r"[Oo]jo\d+", d.name)
        ]

        if not subcarpetas_ojo:
            # También buscar imágenes directamente en la carpeta de la vaca
            imagenes_directas = [f for f in carpeta_vaca.iterdir() if es_imagen(f)]
            if imagenes_directas:
                for img in imagenes_directas:
                    registros.append({
                        "ruta":     str(img),
                        "id_vaca":  id_vaca,
                        "ojo":      "desconocido",
                    })
                print(f"  [OK] Vaca{id_vaca}: {len(imagenes_directas)} imágenes directas")
            else:
                print(f"  [WARN] Vaca{id_vaca}: sin sub-carpetas de ojo ni imágenes directas")
            continue

        total_vaca = 0
        for carpeta_ojo in subcarpetas_ojo:
            imagenes = [f for f in sorted(carpeta_ojo.iterdir()) if es_imagen(f)]
            for img in imagenes:
                registros.append({
                    "ruta":    str(img),
                    "id_vaca": id_vaca,
                    "ojo":     carpeta_ojo.name,
                })
            total_vaca += len(imagenes)

        print(f"  [OK] Vaca{id_vaca:02d}: {total_vaca} imágenes en {len(subcarpetas_ojo)} ojo(s)")

    return registros


def guardar_csv(registros: list[dict], salida: Path) -> None:
    salida.parent.mkdir(parents=True, exist_ok=True)
    with open(salida, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["ruta", "id_vaca", "ojo"])
        writer.writeheader()
        writer.writerows(registros)
    print(f"\n  CSV guardado en: {salida}")


def resumen(registros: list[dict]) -> None:
    vacas = sorted({r["id_vaca"] for r in registros})
    print("\n══════════════ RESUMEN ══════════════")
    print(f"  Total imágenes : {len(registros)}")
    print(f"  Total vacas    : {len(vacas)}")
    print(f"  IDs de vacas   : {vacas}")
    conteo = {}
    for r in registros:
        conteo[r["id_vaca"]] = conteo.get(r["id_vaca"], 0) + 1
    min_imgs = min(conteo.values())
    max_imgs = max(conteo.values())
    print(f"  Imágenes/vaca  : min={min_imgs}  max={max_imgs}")
    print("═════════════════════════════════════\n")


if __name__ == "__main__":
    print(f"Escaneando: {DATASET_ROOT}\n")
    registros = cargar_dataset(DATASET_ROOT)
    guardar_csv(registros, OUTPUT_CSV)
    resumen(registros)
