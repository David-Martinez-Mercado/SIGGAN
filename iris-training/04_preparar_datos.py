"""
04_preparar_datos.py
Fase 4: Preparación del dataset para PyTorch.
- Carga imágenes desde el CSV augmentado
- Normaliza píxeles a [0, 1]
- Divide en train/val/test (70/15/15)
- Exporta splits como CSVs separados
- Incluye IrisDataset listo para ser importado en el script de entrenamiento
"""

import csv
import random
from pathlib import Path
from collections import defaultdict

import numpy as np
import torch
from torch.utils.data import Dataset, DataLoader
from PIL import Image
import torchvision.transforms as T

# ─────────────────────────── CONFIGURACIÓN ───────────────────────────
INPUT_CSV   = Path(__file__).parent / "dataset_augmented.csv"
SPLITS_DIR  = Path(__file__).parent / "splits"
IMG_SIZE    = 128
SEED        = 42
TRAIN_RATIO = 0.70
VAL_RATIO   = 0.15
# TEST_RATIO  = 1 - TRAIN_RATIO - VAL_RATIO  (implícito)
# ─────────────────────────────────────────────────────────────────────

random.seed(SEED)


# ──────────────────────── DIVISIÓN DEL DATASET ───────────────────────

def dividir_por_vaca(registros: list[dict]) -> dict[str, list[dict]]:
    """
    Divide los registros en train/val/test asegurando que TODAS las imágenes
    de una vaca queden en el mismo split (evita data leakage).
    """
    # Agrupar por vaca
    por_vaca: dict[str, list[dict]] = defaultdict(list)
    for r in registros:
        por_vaca[r["id_vaca"]].append(r)

    vacas = sorted(por_vaca.keys(), key=lambda x: int(x))
    random.shuffle(vacas)

    n = len(vacas)
    n_train = int(n * TRAIN_RATIO)
    n_val   = int(n * VAL_RATIO)

    vacas_train = vacas[:n_train]
    vacas_val   = vacas[n_train:n_train + n_val]
    vacas_test  = vacas[n_train + n_val:]

    splits = {"train": [], "val": [], "test": []}
    for vaca in vacas_train:
        splits["train"].extend(por_vaca[vaca])
    for vaca in vacas_val:
        splits["val"].extend(por_vaca[vaca])
    for vaca in vacas_test:
        splits["test"].extend(por_vaca[vaca])

    return splits


def guardar_splits(splits: dict, salida: Path) -> None:
    salida.mkdir(parents=True, exist_ok=True)
    for nombre, registros in splits.items():
        ruta = salida / f"{nombre}.csv"
        with open(ruta, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["ruta", "id_vaca", "ojo", "aug"])
            writer.writeheader()
            writer.writerows(registros)
        print(f"  {nombre:5s}: {len(registros):5d} imágenes → {ruta}")


# ──────────────────────── MAPEO DE ETIQUETAS ─────────────────────────

def construir_mapa_etiquetas(registros: list[dict]) -> dict[str, int]:
    """Crea un mapa {id_vaca_str → indice_entero}."""
    ids = sorted({r["id_vaca"] for r in registros}, key=lambda x: int(x))
    return {id_vaca: idx for idx, id_vaca in enumerate(ids)}


def guardar_mapa_etiquetas(mapa: dict, salida: Path) -> None:
    with open(salida, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["id_vaca", "label"])
        for id_vaca, label in sorted(mapa.items(), key=lambda x: x[1]):
            writer.writerow([id_vaca, label])
    print(f"  Mapa de etiquetas → {salida}")


# ──────────────────────── PYTORCH DATASET ────────────────────────────

class IrisDataset(Dataset):
    """
    Dataset de PyTorch para imágenes de iris de vacas.
    Recibe la ruta al CSV del split y el mapa de etiquetas.
    Retorna (tensor_imagen, label_int).
    """

    def __init__(
        self,
        csv_path: str | Path,
        label_map: dict[str, int],
        transform=None,
        img_size: int = IMG_SIZE,
    ):
        self.label_map = label_map
        self.img_size  = img_size
        self.transform = transform

        with open(csv_path, "r", encoding="utf-8") as f:
            self.registros = list(csv.DictReader(f))

        # Filtrar imágenes que no existen en disco
        antes = len(self.registros)
        self.registros = [r for r in self.registros if Path(r["ruta"]).exists()]
        despues = len(self.registros)
        if antes != despues:
            print(f"  [WARN] Se excluyeron {antes - despues} imágenes no encontradas en disco")

    def __len__(self) -> int:
        return len(self.registros)

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, int]:
        reg   = self.registros[idx]
        label = self.label_map[reg["id_vaca"]]

        try:
            img = Image.open(reg["ruta"]).convert("L")  # Escala de grises
        except Exception:
            # Imagen corrupta: devolver tensor negro
            img = Image.fromarray(np.zeros((self.img_size, self.img_size), dtype=np.uint8))

        if self.transform:
            img = self.transform(img)
        else:
            img = T.ToTensor()(img)  # [0,1] automáticamente

        return img, label


def construir_transforms(entrenamiento: bool = True) -> T.Compose:
    """
    Transformaciones para carga en tiempo de entrenamiento.
    Las de augmentation ya se aplicaron offline; aquí solo normalizamos.
    """
    ops = [
        T.Resize((IMG_SIZE, IMG_SIZE)),
        T.ToTensor(),           # Convierte PIL [0,255] → tensor [0.0,1.0]
        T.Normalize(mean=[0.5], std=[0.5]),  # Normaliza a [-1, 1]
    ]
    if entrenamiento:
        # Pequeña augmentation adicional en línea para mayor variedad
        ops = [
            T.Resize((IMG_SIZE, IMG_SIZE)),
            T.RandomHorizontalFlip(p=0.5),
            T.RandomRotation(degrees=5),
            T.ColorJitter(brightness=0.2, contrast=0.2),
            T.ToTensor(),
            T.Normalize(mean=[0.5], std=[0.5]),
        ]
    return T.Compose(ops)


# ──────────────────────────── MAIN ───────────────────────────────────

def preparar(input_csv: Path = INPUT_CSV, splits_dir: Path = SPLITS_DIR) -> None:
    with open(input_csv, "r", encoding="utf-8") as f:
        registros = list(csv.DictReader(f))

    print(f"Total imágenes en dataset augmentado: {len(registros)}")

    splits = dividir_por_vaca(registros)
    print("\nDivisión train/val/test (por vaca, sin data leakage):")
    guardar_splits(splits, splits_dir)

    mapa = construir_mapa_etiquetas(registros)
    guardar_mapa_etiquetas(mapa, splits_dir / "label_map.csv")

    print(f"\nClases totales: {len(mapa)}")
    print("Preparación completa.\n")

    # ── Demo: verificar que el Dataset carga correctamente ──
    print("Verificando IrisDataset...")
    ds = IrisDataset(
        csv_path  = splits_dir / "train.csv",
        label_map = mapa,
        transform = construir_transforms(entrenamiento=True),
    )
    loader = DataLoader(ds, batch_size=4, shuffle=True)
    batch_img, batch_lbl = next(iter(loader))
    print(f"  Batch shape  : {batch_img.shape}")   # (4, 1, 128, 128)
    print(f"  Batch labels : {batch_lbl.tolist()}")
    print(f"  Pixel range  : [{batch_img.min():.2f}, {batch_img.max():.2f}]")
    print("  Dataset OK\n")


if __name__ == "__main__":
    preparar()
