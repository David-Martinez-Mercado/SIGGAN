"""
SIGGAN - Microservicio de Biometría de Iris v3 (CNN + ArcFace)
===============================================================
- Motor: IrisEmbeddingNet entrenada con ArcFace Loss (99.37% val_acc)
- Embeddings L2-normalizados de 128 dims → comparación por similitud coseno
- Validación de imagen: HoughCircles (¿es un ojo?)
- Unicidad: no permite registrar el mismo iris en 2 animales
- Fraude: detecta si iris no coincide con animal pero sí con otro
- Búsqueda 1:N por iris

Puerto: 5000
"""

import os, io, sys, cv2, numpy as np, hashlib, base64, traceback
from pathlib import Path
from datetime import datetime
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS

# ── PyTorch ──────────────────────────────────────────────────────────
import torch
import torch.nn as nn
import torch.nn.functional as F

app = Flask(__name__)
CORS(app)

MODEL_PATH = Path(__file__).parent / "models" / "model_iris.pth"

# ==================== ARQUITECTURA CNN ====================

class ConvBlock(nn.Module):
    def __init__(self, in_ch, out_ch, kernel=3, pool=True, dropout=0.0):
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

    def forward(self, x):
        return self.block(x)


class AtenciónEspacial(nn.Module):
    def __init__(self, in_ch):
        super().__init__()
        self.conv = nn.Conv2d(in_ch, 1, kernel_size=1, bias=False)

    def forward(self, x):
        return x * torch.sigmoid(self.conv(x))


class IrisEmbeddingNet(nn.Module):
    def __init__(self, embedding_dim=128):
        super().__init__()
        self.embedding_dim = embedding_dim
        self.features = nn.Sequential(
            ConvBlock(1,   32, pool=True),
            ConvBlock(32,  64, pool=True),
            ConvBlock(64, 128, pool=True),
            ConvBlock(128, 256, pool=True),
            ConvBlock(256, 256, pool=False, dropout=0.25),
        )
        self.atencion = AtenciónEspacial(256)
        self.gap = nn.AdaptiveAvgPool2d(1)
        self.embedding_head = nn.Sequential(
            nn.Flatten(),
            nn.Linear(256, 512),
            nn.BatchNorm1d(512),
            nn.ReLU(inplace=True),
            nn.Dropout(0.4),
            nn.Linear(512, embedding_dim),
            nn.BatchNorm1d(embedding_dim),
        )

    def forward(self, x):
        x = self.features(x)
        x = self.atencion(x)
        x = self.gap(x)
        x = self.embedding_head(x)
        return F.normalize(x, p=2, dim=1)


# ==================== MOTOR IA ====================

class IrisAIEngine:
    MATCH_THRESHOLD     = 0.65   # similitud coseno mínima para match
    DUPLICATE_THRESHOLD = 0.70   # más estricto para detectar duplicados

    def __init__(self):
        self.modelo = None
        self._cargar_modelo()

    def _cargar_modelo(self):
        if not MODEL_PATH.exists():
            print(f"[WARN] Modelo no encontrado en {MODEL_PATH} — usando Gabor como respaldo")
            return
        ckpt = torch.load(str(MODEL_PATH), map_location="cpu")
        emb_dim = ckpt.get("embedding_dim", 128)
        self.modelo = IrisEmbeddingNet(embedding_dim=emb_dim)
        self.modelo.load_state_dict(ckpt["model_state_dict"])
        self.modelo.eval()
        print(f"[IA] Modelo CNN cargado — embedding_dim={emb_dim}  val_acc={ckpt.get('val_acc', '?')}")

    # ── Preprocesado para CNN (igual que entrenamiento) ──
    def _preprocess_cnn(self, img_bytes):
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("No se pudo decodificar la imagen")

        # Reducir resolución si viene de celular
        h, w = img.shape[:2]
        if max(h, w) > 1000:
            scale = 1000 / max(h, w)
            img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # Detectar iris con Hough
        blurred = cv2.GaussianBlur(gray, (9, 9), 2)
        min_r = int(min(gray.shape) * 0.10)
        max_r = int(min(gray.shape) * 0.45)
        circles = cv2.HoughCircles(
            blurred, cv2.HOUGH_GRADIENT, dp=1.2,
            minDist=int(min(gray.shape) * 0.3),
            param1=60, param2=30, minRadius=min_r, maxRadius=max_r,
        )

        if circles is not None:
            cx, cy, r = np.round(circles[0][0]).astype(int)
            margen = int(r * 1.2)
            x1 = max(0, cx - margen); y1 = max(0, cy - margen)
            x2 = min(gray.shape[1], cx + margen); y2 = min(gray.shape[0], cy + margen)
            crop = gray[y1:y2, x1:x2]
        else:
            h2, w2 = gray.shape
            lado = int(min(h2, w2) * 0.45)
            cy2, cx2 = h2 // 2, w2 // 2
            crop = gray[cy2 - lado//2:cy2 + lado//2, cx2 - lado//2:cx2 + lado//2]

        if crop.size == 0:
            crop = gray

        crop = cv2.resize(crop, (128, 128), interpolation=cv2.INTER_AREA)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        crop = clahe.apply(crop)

        # Normalizar a [-1, 1] (igual que entrenamiento)
        tensor = torch.from_numpy(crop).float().unsqueeze(0).unsqueeze(0) / 127.5 - 1.0
        return tensor

    def get_embedding(self, img_bytes):
        """Retorna embedding numpy (128,) L2-normalizado."""
        if self.modelo is None:
            raise RuntimeError("Modelo CNN no disponible")
        tensor = self._preprocess_cnn(img_bytes)
        with torch.no_grad():
            emb = self.modelo(tensor)
        return emb.squeeze(0).numpy()

    def compare_embeddings(self, emb1, emb2):
        """Similitud coseno entre dos embeddings (ya L2-normalizados)."""
        sim = float(np.dot(emb1, emb2))
        match = sim >= self.MATCH_THRESHOLD
        return {
            'similitud': round(sim, 4),
            'match': match,
            'resultado': 'MATCH' if match else ('INCONCLUSO' if sim >= 0.50 else 'NO_MATCH'),
            'umbral': self.MATCH_THRESHOLD,
            'confianza': round(max(0.0, (sim - 0.3) / 0.7) * 100, 1),
        }

    def find_duplicate(self, new_emb, exclude_animal_id=None):
        for aid, reg in iris_db.items():
            if aid == exclude_animal_id:
                continue
            emb_stored = np.frombuffer(base64.b64decode(reg['embedding_b64']), dtype=np.float32)
            sim = float(np.dot(emb_stored, new_emb))
            if sim >= self.DUPLICATE_THRESHOLD:
                return aid, sim
        return None, None

    # ── Validación: ¿la imagen parece un ojo? ──
    def validate_iris_image(self, img_bytes):
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return False, 0.0, {'error': 'No se pudo decodificar'}
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        h, w = gray.shape

        blurred = cv2.GaussianBlur(gray, (9, 9), 2)
        circles = cv2.HoughCircles(
            blurred, cv2.HOUGH_GRADIENT, dp=1.2, minDist=30,
            param1=100, param2=25,
            minRadius=max(10, min(h, w) // 10), maxRadius=min(h, w) // 2,
        )
        circ_score = min(1.0, len(circles[0]) / 2.0) if circles is not None else 0.0

        center = gray[h//3:2*h//3, w//3:2*w//3]
        outer = np.concatenate([gray[:h//4].flatten(), gray[3*h//4:].flatten()])
        cm, om = float(np.mean(center)), float(np.mean(outer))
        dark_score = min(1.0, (om - cm) / 80.0) if cm < om else 0.0

        edges = cv2.Canny(blurred, 50, 150)
        ed = float(np.sum(edges > 0)) / (h * w)
        edge_score = max(0.0, min(1.0, 1.0 - abs(ed - 0.12) / 0.12)) if 0.03 <= ed <= 0.30 else 0.0

        contrast = min(1.0, float(np.std(gray)) / 60.0)
        total = circ_score * 0.35 + dark_score * 0.30 + edge_score * 0.20 + contrast * 0.15
        valid = bool(total >= 0.30)
        return valid, float(total), {
            'total_score': round(total, 3),
            'confidence': round(total * 100, 1),
            'is_valid': valid,
            'circles_found': int(len(circles[0])) if circles is not None else 0,
        }

    def generate_demo_image(self, seed=None):
        if seed is not None:
            np.random.seed(seed)
        size = 256
        img = np.zeros((size, size), dtype=np.uint8)
        img[:] = 30
        center = (size // 2, size // 2)
        cv2.circle(img, center, 100, 120, -1)
        for angle in np.linspace(0, 2 * np.pi, 60):
            r1 = 40 + np.random.randint(0, 20)
            r2 = 80 + np.random.randint(0, 25)
            x1 = int(center[0] + r1 * np.cos(angle))
            y1 = int(center[1] + r1 * np.sin(angle))
            x2 = int(center[0] + r2 * np.cos(angle))
            y2 = int(center[1] + r2 * np.sin(angle))
            cv2.line(img, (x1, y1), (x2, y2), int(np.random.randint(60, 180)), 1)
        cv2.circle(img, center, 35, 10, -1)
        cv2.circle(img, (center[0] - 10, center[1] - 15), 5, 220, -1)
        noise = np.random.normal(0, 8, img.shape).astype(np.int16)
        return np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)


# ==================== INIT ====================
engine = IrisAIEngine()

DB_PATH = Path(__file__).parent / "iris_db.json"

def _load_db():
    if DB_PATH.exists():
        import json
        try:
            with open(DB_PATH, 'r') as f:
                data = json.load(f)
            print(f"[DB] Cargados {len(data)} registros de iris desde {DB_PATH}")
            return data
        except Exception as e:
            print(f"[DB] Error leyendo iris_db.json: {e}")
    return {}

def _save_db():
    import json
    with open(DB_PATH, 'w') as f:
        json.dump(iris_db, f)

iris_db = _load_db()  # { animal_id: { embedding_b64, iris_hash, registrado_at, modo } }


def get_img_bytes(req):
    animal_id = None; img_bytes = None; modo = 'simulado'
    if req.content_type and 'multipart' in req.content_type:
        animal_id = req.form.get('animal_id')
        modo = req.form.get('modo', 'simulado')
        f = req.files.get('imagen')
        if f:
            img_bytes = f.read()
    else:
        data = req.get_json()
        animal_id = data.get('animal_id')
        modo = data.get('modo', 'simulado')
        b64 = data.get('imagen_base64')
        if b64:
            if ',' in b64:
                b64 = b64.split(',')[1]
            img_bytes = base64.b64decode(b64)
    return animal_id, img_bytes, modo


# ==================== ENDPOINTS ====================

@app.route('/api/iris/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'servicio': 'SIGGAN Iris Biometrics v3 (CNN+ArcFace)',
        'modelo_cargado': engine.modelo is not None,
        'iris_registrados': len(iris_db),
        'animales_registrados': list(iris_db.keys()),
        'timestamp': datetime.now().isoformat(),
    })


@app.route('/api/iris/registrar', methods=['POST'])
def registrar_iris():
    try:
        animal_id, img_bytes, modo = get_img_bytes(request)
        if not animal_id:
            return jsonify({'error': 'Se requiere animal_id'}), 400

        validacion_ia = None
        if modo == 'simulado' or not img_bytes:
            seed = int(hashlib.md5(animal_id.encode()).hexdigest()[:8], 16) % (2 ** 31)
            demo = engine.generate_demo_image(seed)
            _, buf = cv2.imencode('.png', demo)
            img_bytes = buf.tobytes()
            validacion_ia = {'is_valid': True, 'confidence': 100.0, 'modo': 'simulado_skip'}
        else:
            is_valid, score, validacion_ia = engine.validate_iris_image(img_bytes)
            if not is_valid:
                return jsonify({
                    'error': 'La imagen no parece ser un iris/ojo válido',
                    'validacion_ia': validacion_ia,
                    'sugerencias': [
                        'Asegúrate de que la foto muestre claramente el ojo del animal',
                        'La imagen debe tener buena iluminación y enfoque',
                        f'Score obtenido: {validacion_ia["confidence"]:.1f}% (mínimo: 30%)',
                    ],
                }), 400

        emb = engine.get_embedding(img_bytes)
        iris_hash = hashlib.sha256(emb.tobytes()).hexdigest()
        emb_b64 = base64.b64encode(emb.astype(np.float32).tobytes()).decode('utf-8')

        # Verificar unicidad
        dup_id, dup_sim = engine.find_duplicate(emb, exclude_animal_id=animal_id)
        if dup_id is not None:
            dup_reg = iris_db[dup_id]
            return jsonify({
                'error': 'IRIS DUPLICADO — Este patrón de iris ya está registrado en otro animal',
                'duplicado': True,
                'animal_existente': dup_id,
                'iris_hash_existente': dup_reg['iris_hash'],
                'similitud': dup_sim,
                'registrado_en': dup_reg.get('registrado_at', ''),
                'mensaje': (
                    f'Este iris ya pertenece al animal {dup_id}. '
                    'No se permite registrar el mismo iris en dos animales diferentes.'
                ),
                'accion_requerida': 'CONTACTAR_AUTORIDAD',
            }), 409

        iris_db[animal_id] = {
            'embedding_b64': emb_b64,
            'iris_hash': iris_hash,
            'registrado_at': datetime.now().isoformat(),
            'modo': modo,
        }
        _save_db()

        return jsonify({
            'success': True,
            'animal_id': animal_id,
            'modo': modo,
            'iris_hash': iris_hash,
            'validacion_ia': validacion_ia,
            'mensaje': f'Iris registrado ({modo}). Hash: {iris_hash[:16]}...',
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/iris/verificar', methods=['POST'])
def verificar_iris():
    try:
        animal_id, img_bytes, modo = get_img_bytes(request)
        if not animal_id:
            return jsonify({'error': 'Se requiere animal_id'}), 400
        if animal_id not in iris_db:
            return jsonify({'error': 'Este animal no tiene iris registrado', 'registrado': False}), 404

        validacion_ia = None
        if modo == 'simulado' or not img_bytes:
            seed = int(hashlib.md5(animal_id.encode()).hexdigest()[:8], 16) % (2 ** 31)
            demo = engine.generate_demo_image(seed)
            _, buf = cv2.imencode('.png', demo)
            img_bytes = buf.tobytes()
            validacion_ia = {'is_valid': True, 'confidence': 100.0, 'modo': 'simulado_skip'}
        else:
            is_valid, score, validacion_ia = engine.validate_iris_image(img_bytes)
            if not is_valid:
                return jsonify({
                    'error': 'La imagen no parece ser un iris/ojo válido',
                    'validacion_ia': validacion_ia,
                    'sugerencias': ['Sube una foto clara del ojo del animal'],
                }), 400

        emb_nuevo = engine.get_embedding(img_bytes)
        emb_registrado = np.frombuffer(
            base64.b64decode(iris_db[animal_id]['embedding_b64']), dtype=np.float32
        )
        comparacion = engine.compare_embeddings(emb_registrado, emb_nuevo)

        resp = {
            'success': True,
            'animal_id': animal_id,
            'modo': modo,
            'verificacion': comparacion,
            'validacion_ia': validacion_ia,
            'iris_hash_registrado': iris_db[animal_id]['iris_hash'],
        }

        if not comparacion['match']:
            match_id, match_sim = engine.find_duplicate(emb_nuevo)
            if match_id and match_id != animal_id:
                resp['alerta_fraude'] = {
                    'tipo': 'IRIS_NO_COINCIDE',
                    'mensaje': (
                        f'ALERTA: La iris escaneada NO coincide con el animal {animal_id}, '
                        f'pero SÍ coincide con el animal {match_id}. '
                        'Posible suplantación de identidad.'
                    ),
                    'animal_real': match_id,
                    'similitud_con_real': match_sim,
                    'accion_requerida': 'CONTACTAR_AUTORIDAD',
                }
            else:
                resp['alerta_fraude'] = {
                    'tipo': 'IRIS_DESCONOCIDA',
                    'mensaje': 'La iris no coincide con este animal ni con ningún otro registrado.',
                    'accion_requerida': 'VERIFICAR_MANUALMENTE',
                }

        return jsonify(resp)
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/iris/buscar', methods=['POST'])
def buscar_iris():
    try:
        _, img_bytes, modo = get_img_bytes(request)
        if modo == 'simulado' or not img_bytes:
            return jsonify({'error': 'Se requiere una imagen real para buscar'}), 400

        is_valid, score, val = engine.validate_iris_image(img_bytes)
        if not is_valid:
            return jsonify({'error': 'La imagen no parece un iris válido', 'validacion_ia': val}), 400

        emb_nuevo = engine.get_embedding(img_bytes)
        resultados = []
        for aid, reg in iris_db.items():
            emb_stored = np.frombuffer(base64.b64decode(reg['embedding_b64']), dtype=np.float32)
            comp = engine.compare_embeddings(emb_stored, emb_nuevo)
            resultados.append({
                'animal_id': aid,
                'similitud': comp['similitud'],
                'match': comp['match'],
                'confianza': comp['confianza'],
            })
        resultados.sort(key=lambda x: x['similitud'], reverse=True)

        return jsonify({
            'success': True,
            'total_comparados': len(resultados),
            'matches': [r for r in resultados if r['match']],
            'mejor_candidato': resultados[0] if resultados else None,
            'top_5': resultados[:5],
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/iris/validar-imagen', methods=['POST'])
def validar_imagen():
    try:
        _, img_bytes, _ = get_img_bytes(request)
        if not img_bytes:
            return jsonify({'error': 'Se requiere imagen'}), 400
        is_valid, score, det = engine.validate_iris_image(img_bytes)
        return jsonify({
            'es_iris_valido': is_valid,
            'score': round(score, 3),
            'confianza': round(score * 100, 1),
            'detalles': det,
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/iris/reset', methods=['DELETE'])
def reset_all():
    count = len(iris_db)
    iris_db.clear()
    _save_db()
    return jsonify({'success': True, 'eliminados': count, 'mensaje': f'{count} registros de iris eliminados'})


@app.route('/api/iris/reset/<animal_id>', methods=['DELETE'])
def reset_animal(animal_id):
    if animal_id in iris_db:
        del iris_db[animal_id]
        _save_db()
        return jsonify({'success': True, 'animal_id': animal_id, 'mensaje': f'Iris de {animal_id} eliminado'})
    return jsonify({'error': 'Animal no tiene iris registrado'}), 404


@app.route('/api/iris/registros', methods=['GET'])
def listar_registros():
    registros = [
        {
            'animal_id': aid,
            'iris_hash': reg['iris_hash'],
            'registrado_at': reg.get('registrado_at', ''),
            'modo': reg.get('modo', 'desconocido'),
        }
        for aid, reg in iris_db.items()
    ]
    return jsonify({'total': len(registros), 'registros': registros})


@app.route('/api/iris/demo-image/<animal_id>', methods=['GET'])
def demo_image(animal_id):
    seed = int(hashlib.md5(animal_id.encode()).hexdigest()[:8], 16) % (2 ** 31)
    img = engine.generate_demo_image(seed)
    img_color = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    img_color[:, :, 0] = img_color[:, :, 0] // 2
    img_color[:, :, 2] = img_color[:, :, 2] // 2
    _, buf = cv2.imencode('.png', img_color)
    return send_file(io.BytesIO(buf.tobytes()), mimetype='image/png')


if __name__ == '__main__':
    print("=" * 60)
    print("  SIGGAN - Microservicio de Biometría de Iris v3")
    print(f"  Modelo CNN: {'CARGADO' if engine.modelo is not None else 'NO ENCONTRADO'}")
    print(f"  Umbral match: {engine.MATCH_THRESHOLD}")
    print(f"  Umbral duplicado: {engine.DUPLICATE_THRESHOLD}")
    print("=" * 60)
    app.run(host='0.0.0.0', port=5000, debug=True)
