"""
SIGGAN - Microservicio de Biometría de Iris v2
================================================
- Validación IA de imagen (¿es un ojo?)
- Extracción de features con Gabor (IrisCode 256 bits)
- Unicidad: no permite registrar misma iris en 2 animales
- Fraude: al verificar, detecta si iris no coincide con animal
- Búsqueda 1:N por iris
- Reset de registros

Puerto: 5000
"""

import os, io, cv2, numpy as np, hashlib, base64, json, traceback
from datetime import datetime
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# ==================== MOTOR IA ====================

class IrisAIEngine:
    GABOR_PARAMS = [
        {'ksize': 31, 'sigma': 4.0, 'theta': t, 'lambd': l, 'gamma': 0.5}
        for t in np.arange(0, np.pi, np.pi / 8)
        for l in [8, 12, 16]
    ]
    IRIS_CODE_BITS = 256
    MATCH_THRESHOLD = 0.32
    DUPLICATE_THRESHOLD = 0.28  # Más estricto para duplicados

    def __init__(self):
        self.gabor_filters = []
        for p in self.GABOR_PARAMS:
            k = cv2.getGaborKernel((p['ksize'], p['ksize']), p['sigma'], p['theta'], p['lambd'], p['gamma'], 0, ktype=cv2.CV_32F)
            self.gabor_filters.append(k)
        self._val_weights = {
            'circular_symmetry': 0.25, 'dark_center_ratio': 0.20,
            'radial_texture': 0.20, 'edge_density': 0.15,
            'contrast_range': 0.10, 'aspect_ratio': 0.10,
        }
        print(f"[IA] Motor inicializado: {len(self.gabor_filters)} filtros Gabor + validador")

    def validate_iris_image(self, img_bytes):
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return False, 0.0, {'error': 'No se pudo decodificar'}
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        h, w = gray.shape
        scores = {}

        blurred = cv2.GaussianBlur(gray, (9, 9), 2)
        circles = cv2.HoughCircles(blurred, cv2.HOUGH_GRADIENT, dp=1.2, minDist=30, param1=100, param2=25, minRadius=max(10, min(h,w)//10), maxRadius=min(h,w)//2)
        scores['circular_symmetry'] = min(1.0, len(circles[0]) / 2.0) if circles is not None else 0.0

        center_region = gray[h//3:2*h//3, w//3:2*w//3]
        outer = np.concatenate([gray[0:h//4,:].flatten(), gray[3*h//4:,:].flatten()])
        cm, om = float(np.mean(center_region)), float(np.mean(outer))
        scores['dark_center_ratio'] = min(1.0, (om - cm) / 80.0) if cm < om else 0.0

        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        enhanced = clahe.apply(gray)
        gabor_vars = [float(np.var(cv2.filter2D(enhanced.astype(np.float32)/255, cv2.CV_32F, k))) for k in self.gabor_filters[:8]]
        scores['radial_texture'] = min(1.0, float(np.mean(gabor_vars))*50 + float(np.var(gabor_vars))*100)

        edges = cv2.Canny(blurred, 50, 150)
        ed = float(np.sum(edges > 0)) / (h * w)
        scores['edge_density'] = max(0.0, min(1.0, 1.0 - abs(ed - 0.12)/0.12)) if 0.03 <= ed <= 0.30 else 0.0

        scores['contrast_range'] = min(1.0, float(np.std(gray)) / 60.0)
        scores['aspect_ratio'] = 1.0 if min(h,w)/max(h,w) > 0.5 else min(h,w)/max(h,w)/0.5

        total = sum(scores[f] * self._val_weights[f] for f in self._val_weights)
        valid = bool(total >= 0.35)
        return valid, float(total), {
            'scores': {k: round(v, 3) for k, v in scores.items()},
            'total_score': round(float(total), 3),
            'confidence': round(float(total * 100), 1),
            'is_valid': valid,
            'threshold': 0.35,
            'circles_found': int(len(circles[0])) if circles is not None else 0,
        }

    def preprocess_image(self, img_bytes):
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("No se pudo decodificar la imagen")
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        enhanced = clahe.apply(gray)
        denoised = cv2.bilateralFilter(enhanced, 9, 75, 75)

        circles = cv2.HoughCircles(denoised, cv2.HOUGH_GRADIENT, dp=1.2, minDist=50, param1=100, param2=30, minRadius=20, maxRadius=min(gray.shape)//3)
        if circles is not None:
            circles = np.round(circles[0]).astype(int)
            cx, cy, r = circles[0]
            ir = int(r * 2.5)
            y1, y2 = max(0, cy-ir), min(gray.shape[0], cy+ir)
            x1, x2 = max(0, cx-ir), min(gray.shape[1], cx+ir)
            roi = denoised[y1:y2, x1:x2]
        else:
            h, w = denoised.shape
            m = min(h, w) // 6
            roi = denoised[m:h-m, m:w-m]

        normalized = cv2.resize(roi, (512, 64), interpolation=cv2.INTER_LINEAR)
        return normalized, {
            'original_size': [int(x) for x in gray.shape],
            'circles_detected': bool(circles is not None),
        }

    def extract_features(self, normalized):
        features = []
        f = normalized.astype(np.float32) / 255.0
        for k in self.gabor_filters:
            filtered = cv2.filter2D(f, cv2.CV_32F, k)
            h, w = filtered.shape
            gh, gw = 4, 8
            rh, rw = h // gh, w // gw
            for i in range(gh):
                for j in range(gw):
                    region = filtered[i*rh:(i+1)*rh, j*rw:(j+1)*rw]
                    features.append(1 if np.mean(region) > 0 else 0)
        features = features[:self.IRIS_CODE_BITS]
        while len(features) < self.IRIS_CODE_BITS:
            features.append(0)
        return np.array(features, dtype=np.uint8)

    def generate_iris_code(self, img_bytes):
        normalized, info = self.preprocess_image(img_bytes)
        code = self.extract_features(normalized)
        code_bytes = code.tobytes()
        return {
            'iris_hash': hashlib.sha256(code_bytes).hexdigest(),
            'iris_code_b64': base64.b64encode(code_bytes).decode('utf-8'),
            'code_length': int(len(code)),
            'bits_activos': int(np.sum(code)),
            'preprocess_info': info,
        }

    def compare_codes(self, code1_b64, code2_b64):
        c1 = np.frombuffer(base64.b64decode(code1_b64), dtype=np.uint8)
        c2 = np.frombuffer(base64.b64decode(code2_b64), dtype=np.uint8)
        ml = min(len(c1), len(c2))
        hamming = float(np.sum(c1[:ml] != c2[:ml]) / ml)
        match = bool(hamming < self.MATCH_THRESHOLD)
        return {
            'distancia_hamming': hamming,
            'match': match,
            'resultado': 'MATCH' if match else ('INCONCLUSO' if hamming < 0.40 else 'NO_MATCH'),
            'umbral': float(self.MATCH_THRESHOLD),
            'confianza': float(max(0, (1 - hamming / 0.5)) * 100),
        }

    def find_duplicate(self, new_code_b64, exclude_animal_id=None):
        """Busca si este iris ya está registrado en otro animal."""
        for aid, reg in iris_db.items():
            if aid == exclude_animal_id:
                continue
            c1 = np.frombuffer(base64.b64decode(reg['iris_code_b64']), dtype=np.uint8)
            c2 = np.frombuffer(base64.b64decode(new_code_b64), dtype=np.uint8)
            ml = min(len(c1), len(c2))
            hamming = float(np.sum(c1[:ml] != c2[:ml]) / ml)
            if hamming < self.DUPLICATE_THRESHOLD:
                return aid, hamming
        return None, None

    def generate_demo_image(self, seed=None):
        if seed is not None:
            np.random.seed(seed)
        size = 256
        img = np.zeros((size, size), dtype=np.uint8)
        img[:] = 30
        center = (size//2, size//2)
        cv2.circle(img, center, 100, 120, -1)
        for angle in np.linspace(0, 2*np.pi, 60):
            r1, r2 = 40 + np.random.randint(0, 20), 80 + np.random.randint(0, 25)
            x1, y1 = int(center[0]+r1*np.cos(angle)), int(center[1]+r1*np.sin(angle))
            x2, y2 = int(center[0]+r2*np.cos(angle)), int(center[1]+r2*np.sin(angle))
            cv2.line(img, (x1,y1), (x2,y2), int(np.random.randint(60,180)), 1)
        cv2.circle(img, center, 35, 10, -1)
        cv2.circle(img, (center[0]-10, center[1]-15), 5, 220, -1)
        noise = np.random.normal(0, 8, img.shape).astype(np.int16)
        return np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)


# ==================== INIT ====================
engine = IrisAIEngine()
iris_db = {}  # { animal_id: { iris_hash, iris_code_b64, registrado_at, modo } }


def get_img_bytes(req):
    """Extrae imagen y metadata del request."""
    animal_id = None; img_bytes = None; modo = 'simulado'
    if req.content_type and 'multipart' in req.content_type:
        animal_id = req.form.get('animal_id')
        modo = req.form.get('modo', 'simulado')
        f = req.files.get('imagen')
        if f: img_bytes = f.read()
    else:
        data = req.get_json()
        animal_id = data.get('animal_id')
        modo = data.get('modo', 'simulado')
        b64 = data.get('imagen_base64')
        if b64:
            if ',' in b64: b64 = b64.split(',')[1]
            img_bytes = base64.b64decode(b64)
    return animal_id, img_bytes, modo


# ==================== ENDPOINTS ====================

@app.route('/api/iris/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok', 'servicio': 'SIGGAN Iris Biometrics AI v2',
        'filtros_gabor': len(engine.gabor_filters),
        'iris_registrados': len(iris_db),
        'animales_registrados': list(iris_db.keys()),
        'timestamp': datetime.now().isoformat(),
    })


@app.route('/api/iris/registrar', methods=['POST'])
def registrar_iris():
    """Registra iris. Verifica unicidad: si ya existe en otro animal, rechaza."""
    try:
        animal_id, img_bytes, modo = get_img_bytes(request)
        if not animal_id:
            return jsonify({'error': 'Se requiere animal_id'}), 400

        # Generar o validar imagen
        validacion_ia = None
        if modo == 'simulado' or not img_bytes:
            seed = int(hashlib.md5(animal_id.encode()).hexdigest()[:8], 16) % (2**31)
            demo_img = engine.generate_demo_image(seed)
            _, buf = cv2.imencode('.png', demo_img)
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
                        f'Score obtenido: {validacion_ia["confidence"]:.1f}% (mínimo: 35%)',
                    ],
                }), 400

        # Procesar iris
        resultado = engine.generate_iris_code(img_bytes)

        # VERIFICACIÓN DE UNICIDAD: ¿este iris ya existe en otro animal?
        dup_id, dup_dist = engine.find_duplicate(resultado['iris_code_b64'], exclude_animal_id=animal_id)
        if dup_id is not None:
            dup_reg = iris_db[dup_id]
            return jsonify({
                'error': 'IRIS DUPLICADO — Este patrón de iris ya está registrado en otro animal',
                'duplicado': True,
                'animal_existente': dup_id,
                'iris_hash_existente': dup_reg['iris_hash'],
                'distancia': dup_dist,
                'registrado_en': dup_reg.get('registrado_at', ''),
                'mensaje': (
                    f'Este iris ya pertenece al animal {dup_id}. '
                    'Si crees que es un error, contacta a una autoridad del sistema. '
                    'No se permite registrar el mismo iris en dos animales diferentes.'
                ),
                'accion_requerida': 'CONTACTAR_AUTORIDAD',
            }), 409  # Conflict

        # Registrar
        iris_db[animal_id] = {
            'iris_hash': resultado['iris_hash'],
            'iris_code_b64': resultado['iris_code_b64'],
            'registrado_at': datetime.now().isoformat(),
            'modo': modo,
        }

        return jsonify({
            'success': True, 'animal_id': animal_id, 'modo': modo,
            'iris_hash': resultado['iris_hash'],
            'code_length': resultado['code_length'],
            'bits_activos': resultado['bits_activos'],
            'preprocess_info': resultado['preprocess_info'],
            'validacion_ia': validacion_ia,
            'mensaje': f'Iris registrado ({modo}). Hash: {resultado["iris_hash"][:16]}...',
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/iris/verificar', methods=['POST'])
def verificar_iris():
    """
    Verifica iris contra registro.
    Si NO coincide con el animal solicitado pero SÍ con otro → alerta de fraude.
    """
    try:
        animal_id, img_bytes, modo = get_img_bytes(request)
        if not animal_id:
            return jsonify({'error': 'Se requiere animal_id'}), 400
        if animal_id not in iris_db:
            return jsonify({'error': 'Este animal no tiene iris registrado', 'registrado': False}), 404

        # Generar o validar imagen
        validacion_ia = None
        if modo == 'simulado' or not img_bytes:
            seed = int(hashlib.md5(animal_id.encode()).hexdigest()[:8], 16) % (2**31)
            demo_img = engine.generate_demo_image(seed)
            _, buf = cv2.imencode('.png', demo_img)
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

        # Procesar nueva imagen
        nuevo = engine.generate_iris_code(img_bytes)
        registrado = iris_db[animal_id]
        comparacion = engine.compare_codes(registrado['iris_code_b64'], nuevo['iris_code_b64'])

        resp = {
            'success': True, 'animal_id': animal_id, 'modo': modo,
            'verificacion': comparacion,
            'validacion_ia': validacion_ia,
            'iris_hash_registrado': registrado['iris_hash'],
            'iris_hash_nuevo': nuevo['iris_hash'],
        }

        # Si NO coincide con este animal, buscar si coincide con OTRO
        if not comparacion['match']:
            match_id, match_dist = engine.find_duplicate(nuevo['iris_code_b64'])
            if match_id and match_id != animal_id:
                resp['alerta_fraude'] = {
                    'tipo': 'IRIS_NO_COINCIDE',
                    'mensaje': (
                        f'⚠️ ALERTA: La iris escaneada NO coincide con el animal {animal_id}, '
                        f'pero SÍ coincide con el animal {match_id}. '
                        'Esto puede indicar suplantación de identidad. '
                        'Contacte inmediatamente a una autoridad.'
                    ),
                    'animal_real': match_id,
                    'distancia_con_real': match_dist,
                    'accion_requerida': 'CONTACTAR_AUTORIDAD',
                }
            else:
                resp['alerta_fraude'] = {
                    'tipo': 'IRIS_DESCONOCIDA',
                    'mensaje': (
                        'La iris escaneada no coincide con este animal ni con ningún otro registrado. '
                        'Puede ser un animal no registrado o una imagen de baja calidad.'
                    ),
                    'accion_requerida': 'VERIFICAR_MANUALMENTE',
                }

        return jsonify(resp)
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/iris/buscar', methods=['POST'])
def buscar_iris():
    """Busca animal por iris (1:N). Sube una foto → te dice a quién pertenece."""
    try:
        _, img_bytes, modo = get_img_bytes(request)

        if modo == 'simulado' or not img_bytes:
            return jsonify({'error': 'Se requiere una imagen real para buscar'}), 400

        is_valid, score, val = engine.validate_iris_image(img_bytes)
        if not is_valid:
            return jsonify({'error': 'La imagen no parece un iris válido', 'validacion_ia': val}), 400

        nuevo = engine.generate_iris_code(img_bytes)
        resultados = []
        for aid, reg in iris_db.items():
            comp = engine.compare_codes(reg['iris_code_b64'], nuevo['iris_code_b64'])
            resultados.append({
                'animal_id': aid, 'distancia': comp['distancia_hamming'],
                'match': comp['match'], 'confianza': comp['confianza'],
            })
        resultados.sort(key=lambda x: x['distancia'])

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
    """Pre-valida si una imagen es un iris."""
    try:
        _, img_bytes, _ = get_img_bytes(request)
        if not img_bytes:
            return jsonify({'error': 'Se requiere imagen'}), 400
        is_valid, score, det = engine.validate_iris_image(img_bytes)
        return jsonify({
            'es_iris_valido': is_valid, 'score': round(score, 3),
            'confianza': round(score * 100, 1), 'detalles': det,
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/iris/reset', methods=['DELETE'])
def reset_all():
    """Elimina TODOS los registros de iris."""
    count = len(iris_db)
    iris_db.clear()
    return jsonify({'success': True, 'eliminados': count, 'mensaje': f'{count} registros de iris eliminados'})


@app.route('/api/iris/reset/<animal_id>', methods=['DELETE'])
def reset_animal(animal_id):
    """Elimina el registro de iris de un animal específico."""
    if animal_id in iris_db:
        del iris_db[animal_id]
        return jsonify({'success': True, 'animal_id': animal_id, 'mensaje': f'Iris de {animal_id} eliminado'})
    return jsonify({'error': 'Animal no tiene iris registrado'}), 404


@app.route('/api/iris/registros', methods=['GET'])
def listar_registros():
    """Lista todos los iris registrados."""
    registros = []
    for aid, reg in iris_db.items():
        registros.append({
            'animal_id': aid,
            'iris_hash': reg['iris_hash'],
            'registrado_at': reg.get('registrado_at', ''),
            'modo': reg.get('modo', 'desconocido'),
        })
    return jsonify({'total': len(registros), 'registros': registros})


@app.route('/api/iris/demo-image/<animal_id>', methods=['GET'])
def demo_image(animal_id):
    seed = int(hashlib.md5(animal_id.encode()).hexdigest()[:8], 16) % (2**31)
    img = engine.generate_demo_image(seed)
    img_color = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    img_color[:,:,0] = img_color[:,:,0] // 2
    img_color[:,:,2] = img_color[:,:,2] // 2
    _, buf = cv2.imencode('.png', img_color)
    return send_file(io.BytesIO(buf.tobytes()), mimetype='image/png')


if __name__ == '__main__':
    print("=" * 60)
    print("  SIGGAN - Microservicio de Biometría de Iris v2 (IA)")
    print(f"  Filtros de Gabor: {len(engine.gabor_filters)}")
    print(f"  Código de iris: {engine.IRIS_CODE_BITS} bits")
    print(f"  Umbral match: {engine.MATCH_THRESHOLD}")
    print(f"  Umbral duplicado: {engine.DUPLICATE_THRESHOLD}")
    print("=" * 60)
    app.run(host='0.0.0.0', port=5000, debug=True)
