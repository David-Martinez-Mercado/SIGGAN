"""
02_recortar_iris.py
Fase 2: Detección y recorte del iris en imágenes completas de ojo/cabeza de vaca.
Usa HoughCircles como método principal; recorte central como fallback.
Aplica escala de grises + CLAHE después del recorte.
"""

import cv2
import numpy as np
import csv
import traceback
from pathlib import Path

# ─────────────────────────── CONFIGURACIÓN ───────────────────────────
INPUT_CSV      = Path(__file__).parent / "dataset.csv"
OUTPUT_DIR     = Path(__file__).parent / "iris_recortados"
OUTPUT_CSV     = Path(__file__).parent / "dataset_recortado.csv"
IMG_SIZE       = 128          # Tamaño final cuadrado en píxeles
CLAHE_CLIP     = 2.0          # Límite de clip para CLAHE
CLAHE_GRID     = (8, 8)       # Tamaño de grilla para CLAHE
MAX_DIM        = 1000         # Redimensionar imagen antes de Hough (más rápido)
# ─────────────────────────────────────────────────────────────────────


def aplicar_clahe(gray: np.ndarray) -> np.ndarray:
    """Mejora el contraste local con CLAHE."""
    clahe = cv2.createCLAHE(clipLimit=CLAHE_CLIP, tileGridSize=CLAHE_GRID)
    return clahe.apply(gray)


def recortar_region(img: np.ndarray, cx: int, cy: int, r: int) -> np.ndarray:
    """Recorta una región cuadrada centrada en (cx, cy) con margen = r."""
    margen = int(r * 1.2)  # 20% extra alrededor del radio detectado
    h, w = img.shape[:2]
    x1 = max(0, cx - margen)
    y1 = max(0, cy - margen)
    x2 = min(w, cx + margen)
    y2 = min(h, cy + margen)
    return img[y1:y2, x1:x2]


def recorte_central(img: np.ndarray, fraccion: float = 0.5) -> np.ndarray:
    """Fallback: recorte del centro de la imagen (fraccion del tamaño)."""
    h, w = img.shape[:2]
    lado = int(min(h, w) * fraccion)
    cy, cx = h // 2, w // 2
    x1 = max(0, cx - lado // 2)
    y1 = max(0, cy - lado // 2)
    x2 = min(w, x1 + lado)
    y2 = min(h, y1 + lado)
    return img[y1:y2, x1:x2]


def detectar_iris_hough(gray: np.ndarray) -> tuple[int, int, int] | None:
    """
    Detecta el círculo más probable del iris usando HoughCircles.
    Retorna (cx, cy, radio) o None si no se detecta nada confiable.
    """
    h, w = gray.shape
    min_r = int(min(h, w) * 0.10)   # radio mínimo: 10% del lado corto
    max_r = int(min(h, w) * 0.45)   # radio máximo: 45% del lado corto

    # Suavizar antes de Hough para reducir ruido de celular
    blurred = cv2.GaussianBlur(gray, (9, 9), 2)

    circles = cv2.HoughCircles(
        blurred,
        cv2.HOUGH_GRADIENT,
        dp=1.2,
        minDist=int(min(h, w) * 0.3),
        param1=60,
        param2=30,
        minRadius=min_r,
        maxRadius=max_r,
    )

    if circles is None:
        return None

    circles = np.round(circles[0]).astype(int)
    # Tomar el círculo más grande detectado (suele ser el iris)
    mejor = sorted(circles, key=lambda c: c[2], reverse=True)[0]
    return int(mejor[0]), int(mejor[1]), int(mejor[2])


def procesar_imagen(ruta: str) -> np.ndarray | None:
    """
    Carga, detecta iris, recorta, redimensiona y aplica CLAHE.
    Retorna la imagen procesada o None si falla completamente.
    """
    img = cv2.imread(ruta)
    if img is None:
        return None

    # Reducir resolución antes de Hough para velocidad (fotos de celular son muy grandes)
    h, w = img.shape[:2]
    if max(h, w) > MAX_DIM:
        scale = MAX_DIM / max(h, w)
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    resultado = detectar_iris_hough(gray)

    if resultado is not None:
        cx, cy, r = resultado
        recorte = recortar_region(gray, cx, cy, r)
        metodo = "hough"
    else:
        recorte = recorte_central(gray, fraccion=0.45)
        metodo = "central"

    if recorte.size == 0:
        return None

    recorte_resized = cv2.resize(recorte, (IMG_SIZE, IMG_SIZE), interpolation=cv2.INTER_AREA)
    recorte_mejorado = aplicar_clahe(recorte_resized)
    return recorte_mejorado, metodo


def procesar_dataset(input_csv: Path, output_dir: Path, output_csv: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)

    with open(input_csv, "r", encoding="utf-8") as f:
        registros = list(csv.DictReader(f))

    print(f"Procesando {len(registros)} imágenes...\n")

    resultados = []
    ok = 0
    fallback = 0
    errores = 0

    for i, reg in enumerate(registros):
        ruta_orig = reg["ruta"]
        id_vaca   = reg["id_vaca"]
        ojo       = reg["ojo"]

        try:
            resultado = procesar_imagen(ruta_orig)
            if resultado is None:
                print(f"  [ERROR] No se pudo procesar: {Path(ruta_orig).name}")
                errores += 1
                continue

            img_proc, metodo = resultado

            # Carpeta de salida por vaca
            carpeta_salida = output_dir / f"Vaca{id_vaca}"
            carpeta_salida.mkdir(exist_ok=True)

            nombre_salida = f"{Path(ruta_orig).stem}_{metodo}.png"
            ruta_salida   = carpeta_salida / nombre_salida
            cv2.imwrite(str(ruta_salida), img_proc)

            resultados.append({
                "ruta":    str(ruta_salida),
                "id_vaca": id_vaca,
                "ojo":     ojo,
                "metodo":  metodo,
            })

            if metodo == "hough":
                ok += 1
            else:
                fallback += 1

            if (i + 1) % 20 == 0:
                print(f"  [{i+1}/{len(registros)}] ok={ok}  fallback={fallback}  err={errores}")

        except Exception:
            print(f"  [EXCEPCION] {Path(ruta_orig).name}")
            traceback.print_exc()
            errores += 1

    # Guardar CSV de recortados
    with open(output_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["ruta", "id_vaca", "ojo", "metodo"])
        writer.writeheader()
        writer.writerows(resultados)

    print(f"\n══════════════ RESULTADO ══════════════")
    print(f"  Detectados con Hough : {ok}")
    print(f"  Fallback central     : {fallback}")
    print(f"  Errores              : {errores}")
    print(f"  Total guardados      : {len(resultados)}")
    print(f"  CSV guardado en      : {output_csv}")
    print(f"  Imágenes en          : {output_dir}")
    print(f"═══════════════════════════════════════\n")


if __name__ == "__main__":
    procesar_dataset(INPUT_CSV, OUTPUT_DIR, OUTPUT_CSV)
