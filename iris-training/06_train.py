"""
06_train.py
Fase 6: Entrenamiento del modelo de embeddings de iris.

Flujo:
  1. Carga los splits train/val del CSV
  2. Entrena con ArcFace Loss
  3. Valida con accuracy@1 (vecino más cercano en el espacio de embeddings)
  4. Guarda el mejor modelo como model_iris.pth
"""

import csv
import sys
import time
import importlib.util
from pathlib import Path

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader


def _importar_modulo(nombre: str, archivo: str):
    """Carga un módulo cuyo nombre empieza con número (no importable con import)."""
    ruta = Path(__file__).parent / archivo
    spec = importlib.util.spec_from_file_location(nombre, ruta)
    mod  = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_mod04 = _importar_modulo("preparar_datos", "04_preparar_datos.py")
_mod05 = _importar_modulo("modelo",         "05_modelo.py")

IrisDataset       = _mod04.IrisDataset
construir_transforms = _mod04.construir_transforms
IrisEmbeddingNet  = _mod05.IrisEmbeddingNet
ArcFaceLoss       = _mod05.ArcFaceLoss
contar_parametros = _mod05.contar_parametros

# ─────────────────────────── CONFIGURACIÓN ───────────────────────────
SPLITS_DIR     = Path(__file__).parent / "splits"
LABEL_MAP_CSV  = SPLITS_DIR / "label_map.csv"

# Ruta final del modelo (dentro del Backend)
MODEL_SAVE_PATH = Path(
    r"C:\Users\usuario\OneDrive\unipoli\Union ganaderaa\Nueva carpeta"
    r"\siggan-proyecto\Backend\models\model_iris.pth"
)
# También guardar localmente como checkpoint
CHECKPOINT_DIR = Path(__file__).parent / "checkpoints"

EMBEDDING_DIM  = 128
IMG_SIZE       = 128
BATCH_SIZE     = 16
EPOCHS         = 60
LR             = 1e-3
WEIGHT_DECAY   = 5e-4
LR_PATIENCE    = 8       # Reducir LR si val no mejora en N épocas
EARLY_STOP     = 15      # Parar si no mejora en N épocas

ARCFACE_S      = 32.0    # Escala (s); menor porque dataset es pequeño
ARCFACE_M      = 0.35    # Margen angular

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
# ─────────────────────────────────────────────────────────────────────


# ──────────────────────── UTILIDADES ─────────────────────────────────

def cargar_label_map(csv_path: Path) -> dict[str, int]:
    mapa = {}
    with open(csv_path, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            mapa[row["id_vaca"]] = int(row["label"])
    return mapa


def accuracy_knn(embeddings: torch.Tensor, labels: torch.Tensor) -> float:
    """
    Accuracy@1 usando vecino más cercano (cosine similarity).
    Para cada muestra, busca el embedding más cercano (excluyéndose a sí mismo)
    y verifica si es de la misma clase.
    """
    n = embeddings.size(0)
    if n < 2:
        return 0.0
    sim = torch.mm(embeddings, embeddings.T)  # (n, n) — ya están L2-norm
    sim.fill_diagonal_(-float("inf"))         # excluir self
    pred = sim.argmax(dim=1)
    correctos = (labels[pred] == labels).sum().item()
    return correctos / n


# ──────────────────────── ENTRENAMIENTO ──────────────────────────────

def entrenar_epoca(
    modelo: nn.Module,
    arcface: ArcFaceLoss,
    loader: DataLoader,
    optimizador: optim.Optimizer,
    device: torch.device,
) -> float:
    modelo.train()
    arcface.train()
    total_loss = 0.0

    for imgs, labels in loader:
        imgs   = imgs.to(device)
        labels = labels.to(device)

        optimizador.zero_grad()
        emb  = modelo(imgs)
        loss = arcface(emb, labels)
        loss.backward()
        nn.utils.clip_grad_norm_(
            list(modelo.parameters()) + list(arcface.parameters()), max_norm=5.0
        )
        optimizador.step()
        total_loss += loss.item() * imgs.size(0)

    return total_loss / len(loader.dataset)


@torch.no_grad()
def validar(
    modelo: nn.Module,
    loader: DataLoader,
    device: torch.device,
) -> tuple[float, list[torch.Tensor], list[torch.Tensor]]:
    modelo.eval()
    todos_emb    = []
    todos_labels = []

    for imgs, labels in loader:
        imgs = imgs.to(device)
        emb  = modelo(imgs)
        todos_emb.append(emb.cpu())
        todos_labels.append(labels)

    emb_all    = torch.cat(todos_emb,    dim=0)
    labels_all = torch.cat(todos_labels, dim=0)
    acc        = accuracy_knn(emb_all, labels_all)
    return acc, emb_all, labels_all


# ──────────────────────── GUARDAR MODELO ─────────────────────────────

def guardar_modelo(
    modelo: nn.Module,
    label_map: dict,
    n_clases: int,
    ruta: Path,
) -> None:
    ruta.parent.mkdir(parents=True, exist_ok=True)
    torch.save(
        {
            "model_state_dict": modelo.state_dict(),
            "label_map":        label_map,
            "n_clases":         n_clases,
            "embedding_dim":    modelo.embedding_dim,
            "img_size":         IMG_SIZE,
        },
        ruta,
    )
    print(f"  Modelo guardado en: {ruta}")


# ──────────────────────────── MAIN ───────────────────────────────────

def main() -> None:
    print(f"Dispositivo : {DEVICE}")
    print(f"Batch size  : {BATCH_SIZE}")
    print(f"Épocas      : {EPOCHS}\n")

    # ── Cargar mapa de etiquetas ──
    label_map = cargar_label_map(LABEL_MAP_CSV)
    n_clases  = len(label_map)
    print(f"Clases (vacas): {n_clases}\n")

    # ── Datasets y loaders ──
    ds_train = IrisDataset(
        SPLITS_DIR / "train.csv",
        label_map,
        transform=construir_transforms(entrenamiento=True),
    )
    ds_val = IrisDataset(
        SPLITS_DIR / "val.csv",
        label_map,
        transform=construir_transforms(entrenamiento=False),
    )

    loader_train = DataLoader(ds_train, batch_size=BATCH_SIZE, shuffle=True,  num_workers=0, pin_memory=True)
    loader_val   = DataLoader(ds_val,   batch_size=BATCH_SIZE, shuffle=False, num_workers=0, pin_memory=True)

    print(f"Train : {len(ds_train)} imágenes")
    print(f"Val   : {len(ds_val)} imágenes\n")

    if len(ds_train) == 0:
        raise RuntimeError("Dataset de entrenamiento vacío. Ejecuta los scripts 01-04 primero.")

    # ── Modelo y pérdida ──
    modelo  = IrisEmbeddingNet(embedding_dim=EMBEDDING_DIM).to(DEVICE)
    arcface = ArcFaceLoss(
        embedding_dim=EMBEDDING_DIM,
        n_clases=n_clases,
        s=ARCFACE_S,
        m=ARCFACE_M,
    ).to(DEVICE)

    print(f"Parámetros del modelo : {contar_parametros(modelo):,}")
    print(f"Parámetros ArcFace    : {contar_parametros(arcface):,}\n")

    # ── Optimizador y scheduler ──
    todos_params = list(modelo.parameters()) + list(arcface.parameters())
    optimizador  = optim.AdamW(todos_params, lr=LR, weight_decay=WEIGHT_DECAY)
    scheduler    = optim.lr_scheduler.ReduceLROnPlateau(
        optimizador, mode="max", patience=LR_PATIENCE, factor=0.5
    )

    # ── Warmup simple (5 épocas) ──
    WARMUP_EPOCHS = 5
    def get_lr(epoch):
        if epoch < WARMUP_EPOCHS:
            return (epoch + 1) / WARMUP_EPOCHS
        return 1.0
    warmup = optim.lr_scheduler.LambdaLR(optimizador, lr_lambda=get_lr)

    # ── Variables de tracking ──
    mejor_val_acc  = -1.0
    sin_mejora     = 0
    CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)
    log_path = Path(__file__).parent / "training_log.csv"

    with open(log_path, "w", newline="", encoding="utf-8") as log_f:
        log_writer = csv.writer(log_f)
        log_writer.writerow(["epoca", "train_loss", "val_acc", "lr"])

        print("═" * 55)
        print(f"{'Época':>6}  {'Loss':>10}  {'Val Acc':>10}  {'LR':>12}")
        print("─" * 55)

        for epoch in range(1, EPOCHS + 1):
            t0 = time.time()

            train_loss = entrenar_epoca(modelo, arcface, loader_train, optimizador, DEVICE)
            val_acc, _, _ = validar(modelo, loader_val, DEVICE)

            lr_actual = optimizador.param_groups[0]["lr"]

            # Scheduler
            if epoch <= WARMUP_EPOCHS:
                warmup.step()
            else:
                scheduler.step(val_acc)

            duracion = time.time() - t0
            print(
                f"{epoch:>6}  {train_loss:>10.4f}  {val_acc:>9.2%}  "
                f"{lr_actual:>12.2e}  ({duracion:.1f}s)"
            )
            log_writer.writerow([epoch, f"{train_loss:.6f}", f"{val_acc:.6f}", f"{lr_actual:.2e}"])

            # Guardar checkpoint si mejora
            if val_acc > mejor_val_acc:
                mejor_val_acc = val_acc
                sin_mejora = 0
                ckpt = CHECKPOINT_DIR / "best_model.pth"
                guardar_modelo(modelo, label_map, n_clases, ckpt)
                print(f"  ✓ Nuevo mejor val_acc: {mejor_val_acc:.2%}")
            else:
                sin_mejora += 1
                if sin_mejora >= EARLY_STOP:
                    print(f"\nEarly stopping en época {epoch} (sin mejora por {EARLY_STOP} épocas)")
                    break

    print("═" * 55)
    print(f"\nEntrenamiento completo. Mejor val_acc: {mejor_val_acc:.2%}")

    # ── Copiar mejor checkpoint al destino final ──
    mejor_ckpt = CHECKPOINT_DIR / "best_model.pth"
    if mejor_ckpt.exists():
        # Re-cargar estado mejor y guardar en la ruta del Backend
        ckpt_data = torch.load(mejor_ckpt, map_location="cpu")
        modelo.load_state_dict(ckpt_data["model_state_dict"])
        guardar_modelo(modelo, label_map, n_clases, MODEL_SAVE_PATH)
        print(f"\nModelo final guardado en:\n  {MODEL_SAVE_PATH}")
    else:
        print("[WARN] No se encontró checkpoint. El modelo no se guardó en el Backend.")


if __name__ == "__main__":
    main()
