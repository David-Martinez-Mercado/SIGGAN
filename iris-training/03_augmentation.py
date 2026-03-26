"""
03_augmentation.py
Fase 3: Data augmentation offline.
Lee las imágenes recortadas y genera al menos 5x más ejemplos por imagen.
Las transformaciones preservan la estructura circular del iris.
"""

import cv2
import numpy as np
import csv
import random
import traceback
from pathlib import Path

# ─────────────────────────── CONFIGURACIÓN ───────────────────────────
INPUT_CSV    = Path(__file__).parent / "dataset_recortado.csv"
OUTPUT_DIR   = Path(__file__).parent / "iris_augmented"
OUTPUT_CSV   = Path(__file__).parent / "dataset_augmented.csv"
SEED         = 42
# Número de versiones aumentadas a generar POR imagen original (sin contar el original)
N_AUGMENTS   = 6
# ─────────────────────────────────────────────────────────────────────

random.seed(SEED)
np.random.seed(SEED)


# ────────────────────── TRANSFORMACIONES INDIVIDUALES ────────────────────────

def flip_horizontal(img: np.ndarray) -> np.ndarray:
    return cv2.flip(img, 1)


def rotar(img: np.ndarray, angulo_max: float = 10.0) -> np.ndarray:
    """Rotación aleatoria ±angulo_max grados alrededor del centro."""
    h, w = img.shape[:2]
    angulo = random.uniform(-angulo_max, angulo_max)
    M = cv2.getRotationMatrix2D((w / 2, h / 2), angulo, 1.0)
    return cv2.warpAffine(img, M, (w, h), borderMode=cv2.BORDER_REFLECT)


def ajustar_brillo(img: np.ndarray, factor_min: float = 0.6, factor_max: float = 1.5) -> np.ndarray:
    """Multiplica el brillo por un factor aleatorio, recortando a [0,255]."""
    factor = random.uniform(factor_min, factor_max)
    resultado = img.astype(np.float32) * factor
    return np.clip(resultado, 0, 255).astype(np.uint8)


def zoom(img: np.ndarray, factor_min: float = 0.85, factor_max: float = 1.15) -> np.ndarray:
    """Zoom in/out manteniendo el tamaño de salida igual al de entrada."""
    h, w = img.shape[:2]
    factor = random.uniform(factor_min, factor_max)
    nuevo_h = int(h * factor)
    nuevo_w = int(w * factor)

    if factor > 1.0:
        # Zoom in: recortar al centro
        resized = cv2.resize(img, (nuevo_w, nuevo_h), interpolation=cv2.INTER_LINEAR)
        y1 = (nuevo_h - h) // 2
        x1 = (nuevo_w - w) // 2
        return resized[y1:y1 + h, x1:x1 + w]
    else:
        # Zoom out: pegar sobre fondo con reflejo
        resized = cv2.resize(img, (nuevo_w, nuevo_h), interpolation=cv2.INTER_AREA)
        canvas = np.zeros((h, w), dtype=np.uint8)
        y1 = (h - nuevo_h) // 2
        x1 = (w - nuevo_w) // 2
        canvas[y1:y1 + nuevo_h, x1:x1 + nuevo_w] = resized
        # Rellenar bordes negros con reflect
        canvas = cv2.copyMakeBorder(
            resized,
            y1, h - nuevo_h - y1,
            x1, w - nuevo_w - x1,
            cv2.BORDER_REFLECT,
        )
        return cv2.resize(canvas, (w, h))


def desplazar(img: np.ndarray, max_px: int = 8) -> np.ndarray:
    """Desplazamiento aleatorio en X e Y (shift)."""
    h, w = img.shape[:2]
    dx = random.randint(-max_px, max_px)
    dy = random.randint(-max_px, max_px)
    M = np.float32([[1, 0, dx], [0, 1, dy]])
    return cv2.warpAffine(img, M, (w, h), borderMode=cv2.BORDER_REFLECT)


def agregar_ruido(img: np.ndarray, intensidad: float = 8.0) -> np.ndarray:
    """Ruido gaussiano suave (simula condiciones de celular)."""
    ruido = np.random.normal(0, intensidad, img.shape).astype(np.float32)
    return np.clip(img.astype(np.float32) + ruido, 0, 255).astype(np.uint8)


# ────────────────────── PIPELINE DE AUGMENTATION ────────────────────────────

TRANSFORMACIONES = [
    ("flip",     flip_horizontal),
    ("rot",      rotar),
    ("bright",   ajustar_brillo),
    ("zoom",     zoom),
    ("shift",    desplazar),
    ("noise",    agregar_ruido),
    ("flip_rot", lambda img: rotar(flip_horizontal(img))),
]


def generar_augments(img: np.ndarray, n: int) -> list[tuple[str, np.ndarray]]:
    """Genera n versiones aumentadas de la imagen. Combina transformaciones."""
    resultado = []
    nombres_usados = set()

    # Primero usar cada transformación básica una vez (hasta n)
    for nombre, fn in TRANSFORMACIONES[:n]:
        try:
            aug = fn(img)
            resultado.append((nombre, aug))
            nombres_usados.add(nombre)
        except Exception:
            pass
        if len(resultado) >= n:
            break

    # Si se necesitan más, combinar aleatoriamente
    extras = 0
    while len(resultado) < n:
        fns = random.sample(TRANSFORMACIONES, k=min(2, len(TRANSFORMACIONES)))
        aug = img.copy()
        nombre = "_".join(f[0] for f in fns) + f"_x{extras}"
        for _, fn in fns:
            try:
                aug = fn(aug)
            except Exception:
                pass
        resultado.append((nombre, aug))
        extras += 1

    return resultado


def augmentar_dataset(input_csv: Path, output_dir: Path, output_csv: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)

    with open(input_csv, "r", encoding="utf-8") as f:
        registros = list(csv.DictReader(f))

    print(f"Augmentando {len(registros)} imágenes (x{N_AUGMENTS + 1} total)...\n")

    resultados = []
    errores = 0

    for i, reg in enumerate(registros):
        ruta_orig = reg["ruta"]
        id_vaca   = reg["id_vaca"]
        ojo       = reg["ojo"]

        img = cv2.imread(ruta_orig, cv2.IMREAD_GRAYSCALE)
        if img is None:
            print(f"  [ERROR] No se pudo leer: {Path(ruta_orig).name}")
            errores += 1
            continue

        carpeta_salida = output_dir / f"Vaca{id_vaca}"
        carpeta_salida.mkdir(exist_ok=True)

        stem = Path(ruta_orig).stem

        # Guardar la imagen original también
        ruta_orig_copia = carpeta_salida / f"{stem}_orig.png"
        cv2.imwrite(str(ruta_orig_copia), img)
        resultados.append({
            "ruta":    str(ruta_orig_copia),
            "id_vaca": id_vaca,
            "ojo":     ojo,
            "aug":     "orig",
        })

        # Generar aumentadas
        try:
            augments = generar_augments(img, N_AUGMENTS)
            for nombre_aug, img_aug in augments:
                ruta_aug = carpeta_salida / f"{stem}_{nombre_aug}.png"
                cv2.imwrite(str(ruta_aug), img_aug)
                resultados.append({
                    "ruta":    str(ruta_aug),
                    "id_vaca": id_vaca,
                    "ojo":     ojo,
                    "aug":     nombre_aug,
                })
        except Exception:
            print(f"  [EXCEPCION] {Path(ruta_orig).name}")
            traceback.print_exc()
            errores += 1

        if (i + 1) % 20 == 0:
            print(f"  [{i+1}/{len(registros)}] generadas={len(resultados)}  err={errores}")

    with open(output_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["ruta", "id_vaca", "ojo", "aug"])
        writer.writeheader()
        writer.writerows(resultados)

    print(f"\n══════════════ RESULTADO ══════════════")
    print(f"  Imágenes originales : {len(registros)}")
    print(f"  Total generadas     : {len(resultados)}")
    print(f"  Factor real         : {len(resultados) / max(len(registros), 1):.1f}x")
    print(f"  Errores             : {errores}")
    print(f"  CSV guardado en     : {output_csv}")
    print(f"  Imágenes en         : {output_dir}")
    print(f"═══════════════════════════════════════\n")


if __name__ == "__main__":
    augmentar_dataset(INPUT_CSV, OUTPUT_DIR, OUTPUT_CSV)
