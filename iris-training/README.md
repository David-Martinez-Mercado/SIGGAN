# iris-training — Pipeline de entrenamiento de reconocimiento de iris bovino

## Instalación

```bash
pip install -r requirements.txt
```

> Se recomienda usar un entorno virtual: `python -m venv venv && venv\Scripts\activate`

---

## Orden de ejecución

Ejecutar los scripts **en orden**, uno por uno:

```bash
python 01_cargar_dataset.py     # Escanea el dataset y genera dataset.csv
python 02_recortar_iris.py      # Detecta y recorta el iris → dataset_recortado.csv
python 03_augmentation.py       # Aumenta el dataset x7 → dataset_augmented.csv
python 04_preparar_datos.py     # Divide en train/val/test → splits/
python 06_train.py              # Entrena el modelo → model_iris.pth
```

---

## Estructura de archivos generada

```
iris-training/
├── dataset.csv                 # Generado por 01
├── dataset_recortado.csv       # Generado por 02
├── dataset_augmented.csv       # Generado por 03
├── iris_recortados/            # Imágenes recortadas (128x128, grises, CLAHE)
├── iris_augmented/             # Imágenes aumentadas
├── splits/
│   ├── train.csv
│   ├── val.csv
│   ├── test.csv
│   └── label_map.csv           # Mapeo id_vaca → índice entero
├── checkpoints/
│   └── best_model.pth          # Mejor checkpoint durante el entrenamiento
└── training_log.csv            # Historial de loss y accuracy por época
```

El modelo final se copia automáticamente a:
```
Backend/models/model_iris.pth
```

---

## Descripción del modelo

- **Arquitectura**: CNN con 5 bloques convolucionales + atención espacial + GAP
- **Salida**: embedding L2-normalizado de **128 dimensiones**
- **Pérdida**: ArcFace Loss (mejor que CrossEntropy para reconocimiento de identidad)
- **Validación**: Accuracy@1 con k-NN en el espacio de embeddings
- **Input**: imagen de **128×128** en escala de grises

El modelo **no clasifica directamente**. Aprende a representar el iris como un vector,
permitiendo comparar cualquier nueva imagen contra las imágenes registradas.

---

## Consideraciones del dataset

- Vacas 10 y 11 no existen → ignoradas automáticamente
- Ojo1 y Ojo2 de la misma vaca comparten la misma etiqueta (misma identidad)
- Si Ojo2 no existe para alguna vaca, se procesa solo Ojo1
- Imágenes defectuosas se omiten sin interrumpir el proceso

---

## Detección de iris (Fase 2)

| Método        | Descripción                                        |
|---------------|----------------------------------------------------|
| HoughCircles  | Detecta el círculo del iris en la imagen completa  |
| Fallback      | Recorte central del 45% de la imagen si no detecta |

Después del recorte se aplica **CLAHE** para mejorar el contraste local,
especialmente útil en fotos tomadas con celular con iluminación variable.

---

## Integración con el Backend (después del entrenamiento)

Una vez generado `model_iris.pth`, el microservicio Flask (`iris_service.py`)
puede cargarlo así:

```python
import torch
from modelo import IrisEmbeddingNet

ckpt = torch.load("models/model_iris.pth", map_location="cpu")
modelo = IrisEmbeddingNet(embedding_dim=ckpt["embedding_dim"])
modelo.load_state_dict(ckpt["model_state_dict"])
modelo.eval()
```

**No re-entrenar dentro del servidor.** El entrenamiento es offline.
