"""
05_modelo.py
Fase 5: Arquitectura del modelo CNN de embeddings de iris.

El modelo NO clasifica directamente.
Genera embeddings de 128 dimensiones que representan la identidad del iris.
Se entrena con ArcFace Loss o Triplet Loss (ver 06_train.py).

Arquitectura:
  Input: (B, 1, 128, 128)  — escala de grises
  → 4 bloques convolucionales con BatchNorm + ReLU + MaxPool
  → Global Average Pooling
  → FC → embedding L2-normalizado de 128 dimensiones
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


# ─────────────────── BLOQUE CONVOLUCIONAL BÁSICO ─────────────────────

class ConvBlock(nn.Module):
    """Conv2d → BatchNorm → ReLU → MaxPool opcional."""

    def __init__(
        self,
        in_ch: int,
        out_ch: int,
        kernel: int = 3,
        pool: bool = True,
        dropout: float = 0.0,
    ):
        super().__init__()
        layers = [
            nn.Conv2d(in_ch, out_ch, kernel_size=kernel, padding=kernel // 2, bias=False),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
        ]
        if pool:
            layers.append(nn.MaxPool2d(2, 2))
        if dropout > 0:
            layers.append(nn.Dropout2d(dropout))
        self.block = nn.Sequential(*layers)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.block(x)


# ─────────────────── MÓDULO DE ATENCIÓN ESPACIAL ─────────────────────

class AtenciónEspacial(nn.Module):
    """
    Atención ligera que pondera qué regiones del mapa de características
    son más relevantes (útil para iris rodeado de fondo negro).
    """

    def __init__(self, in_ch: int):
        super().__init__()
        self.conv = nn.Conv2d(in_ch, 1, kernel_size=1, bias=False)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        mapa = torch.sigmoid(self.conv(x))   # (B, 1, H, W)
        return x * mapa


# ───────────────────── MODELO PRINCIPAL ──────────────────────────────

class IrisEmbeddingNet(nn.Module):
    """
    Red CNN que genera embeddings L2-normalizados de 128 dimensiones.

    Parámetros
    ----------
    embedding_dim : int
        Dimensión del vector de embedding de salida (por defecto 128).
    n_clases : int | None
        Si se indica, se añade una capa de clasificación auxiliar para
        permitir entrenamiento con CrossEntropy además de ArcFace.
        Durante inferencia usar solo el embedding.
    """

    def __init__(self, embedding_dim: int = 128, n_clases: int | None = None):
        super().__init__()
        self.embedding_dim = embedding_dim

        # ── Extractor de características ──
        # 128x128 → 64 → 32 → 16 → 8 → 4 (con 4 MaxPool)
        self.features = nn.Sequential(
            ConvBlock(1,   32, kernel=3, pool=True),    # (B,32,64,64)
            ConvBlock(32,  64, kernel=3, pool=True),    # (B,64,32,32)
            ConvBlock(64, 128, kernel=3, pool=True),    # (B,128,16,16)
            ConvBlock(128, 256, kernel=3, pool=True),   # (B,256,8,8)
            ConvBlock(256, 256, kernel=3, pool=False, dropout=0.25),  # (B,256,8,8)
        )

        # ── Atención espacial sobre el mapa final ──
        self.atencion = AtenciónEspacial(256)

        # ── Global Average Pooling ──
        self.gap = nn.AdaptiveAvgPool2d(1)   # (B,256,1,1)

        # ── Proyección a embedding ──
        self.embedding_head = nn.Sequential(
            nn.Flatten(),                             # (B,256)
            nn.Linear(256, 512),
            nn.BatchNorm1d(512),
            nn.ReLU(inplace=True),
            nn.Dropout(0.4),
            nn.Linear(512, embedding_dim),
            nn.BatchNorm1d(embedding_dim),
        )

        # ── Cabeza de clasificación auxiliar (opcional) ──
        self.clasificador = (
            nn.Linear(embedding_dim, n_clases) if n_clases else None
        )

        self._inicializar_pesos()

    def _inicializar_pesos(self) -> None:
        for m in self.modules():
            if isinstance(m, nn.Conv2d):
                nn.init.kaiming_normal_(m.weight, mode="fan_out", nonlinearity="relu")
            elif isinstance(m, nn.Linear):
                nn.init.xavier_normal_(m.weight)
                if m.bias is not None:
                    nn.init.zeros_(m.bias)
            elif isinstance(m, (nn.BatchNorm2d, nn.BatchNorm1d)):
                nn.init.ones_(m.weight)
                nn.init.zeros_(m.bias)

    def forward(
        self, x: torch.Tensor
    ) -> torch.Tensor | tuple[torch.Tensor, torch.Tensor]:
        feats = self.features(x)
        feats = self.atencion(feats)
        feats = self.gap(feats)
        emb   = self.embedding_head(feats)
        emb   = F.normalize(emb, p=2, dim=1)   # L2-normalización

        if self.clasificador is not None:
            logits = self.clasificador(emb)
            return emb, logits
        return emb

    def get_embedding(self, x: torch.Tensor) -> torch.Tensor:
        """Método explícito para inferencia — siempre retorna solo el embedding."""
        self.eval()
        with torch.no_grad():
            feats = self.features(x)
            feats = self.atencion(feats)
            feats = self.gap(feats)
            emb   = self.embedding_head(feats)
            return F.normalize(emb, p=2, dim=1)


# ───────────────────── ARCFACE LOSS ──────────────────────────────────

class ArcFaceLoss(nn.Module):
    """
    ArcFace (Additive Angular Margin Loss) para aprendizaje de métricas.
    Mucho más efectivo que CrossEntropy para reconocimiento de identidad.

    Referencia: Deng et al. "ArcFace: Additive Angular Margin Loss for
                Deep Face Recognition" (CVPR 2019)
    """

    def __init__(self, embedding_dim: int, n_clases: int, s: float = 64.0, m: float = 0.5):
        super().__init__()
        self.s = s
        self.m = m
        self.weight = nn.Parameter(torch.FloatTensor(n_clases, embedding_dim))
        nn.init.xavier_uniform_(self.weight)

        import math
        self.cos_m  = math.cos(m)
        self.sin_m  = math.sin(m)
        self.th     = math.cos(math.pi - m)
        self.mm     = math.sin(math.pi - m) * m

    def forward(self, emb: torch.Tensor, labels: torch.Tensor) -> torch.Tensor:
        import math
        # Cosine similarity
        cosine = F.linear(F.normalize(emb), F.normalize(self.weight))
        sine   = torch.sqrt(1.0 - torch.clamp(cosine ** 2, 0, 1))

        # cos(θ + m) = cos(θ)cos(m) - sin(θ)sin(m)
        phi = cosine * self.cos_m - sine * self.sin_m

        # Condición de seguridad: cuando θ + m > π
        phi = torch.where(cosine > self.th, phi, cosine - self.mm)

        # One-hot encoding
        one_hot = torch.zeros_like(cosine)
        one_hot.scatter_(1, labels.view(-1, 1).long(), 1)

        output = (one_hot * phi) + ((1.0 - one_hot) * cosine)
        output *= self.s

        return F.cross_entropy(output, labels)


# ──────────────────────── UTILIDADES ─────────────────────────────────

def contar_parametros(modelo: nn.Module) -> int:
    return sum(p.numel() for p in modelo.parameters() if p.requires_grad)


def crear_modelo(n_clases: int, embedding_dim: int = 128) -> tuple:
    """
    Crea y retorna (modelo, arcface_loss).
    Para usar durante el entrenamiento.
    """
    modelo    = IrisEmbeddingNet(embedding_dim=embedding_dim)
    arcface   = ArcFaceLoss(embedding_dim=embedding_dim, n_clases=n_clases)
    return modelo, arcface


# ──────────────────────── TEST RÁPIDO ────────────────────────────────

if __name__ == "__main__":
    n_clases = 33  # 35 vacas - 2 eliminadas

    modelo, arcface = crear_modelo(n_clases)
    modelo.eval()

    dummy = torch.randn(4, 1, 128, 128)
    emb   = modelo(dummy)

    print(f"Input shape    : {dummy.shape}")
    print(f"Embedding shape: {emb.shape}")        # (4, 128)
    print(f"Norma L2       : {emb.norm(dim=1)}")  # ~1.0 para todos
    print(f"Parámetros     : {contar_parametros(modelo):,}")

    labels = torch.randint(0, n_clases, (4,))
    loss   = arcface(emb, labels)
    print(f"ArcFace loss   : {loss.item():.4f}")
    print("Modelo OK")
