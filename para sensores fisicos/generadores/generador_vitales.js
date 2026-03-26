/**
 * generador_vitales.js
 * Genera signos vitales realistas para ganado bovino.
 * Mantiene historial por animal para cambios graduales entre ciclos.
 */

const ACTIVIDADES = ['reposo', 'caminando', 'comiendo', 'corriendo'];
const PROB_ACTIVIDADES = [0.50, 0.25, 0.20, 0.05];

// Estado persistente entre ciclos: Map<animalId, vitales>
const historial = new Map();

/**
 * Distribución normal usando Box-Muller transform
 */
function gaussRandom(media, desviacion) {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1 || 1e-10)) * Math.cos(2 * Math.PI * u2);
  return media + desviacion * z;
}

/**
 * Elige actividad: 70% probabilidad de mantener la actividad anterior
 */
function elegirActividad(prev) {
  if (prev && Math.random() < 0.70) return prev;
  const r = Math.random();
  let acum = 0;
  for (let i = 0; i < ACTIVIDADES.length; i++) {
    acum += PROB_ACTIVIDADES[i];
    if (r < acum) return ACTIVIDADES[i];
  }
  return 'reposo';
}

/**
 * Temperatura corporal bovina (°C)
 * Normal: 38.0 – 39.5 | Fiebre: > 40.5
 */
function calcTemperatura(actividad, prevTemp, cfg) {
  const ajuste = { reposo: -0.20, caminando: 0.10, comiendo: 0.00, corriendo: 0.40 };
  const media = (cfg?.media ?? 38.5) + (ajuste[actividad] ?? 0);

  let temp;
  if (prevTemp !== undefined) {
    // Cambio gradual: máximo ±0.3°C por ciclo
    temp = prevTemp + gaussRandom(0, 0.12);
    // Deriva lenta hacia la media fisiológica
    temp = temp + (media - temp) * 0.05;
  } else {
    temp = gaussRandom(media, (cfg?.desviacion ?? 0.8) * 0.5);
  }

  const min = cfg?.min ?? 36.5;
  const max = 42.5; // máximo fisiológico
  return parseFloat(Math.max(min, Math.min(max, temp)).toFixed(1));
}

/**
 * Ritmo cardíaco bovino (BPM)
 * Reposo: 40-70 | Activo: hasta 120
 */
function calcRitmoCardiaco(actividad, prevBPM) {
  const params = {
    reposo:    { media: 52, sigma: 5 },
    caminando: { media: 68, sigma: 8 },
    comiendo:  { media: 58, sigma: 6 },
    corriendo: { media: 95, sigma: 12 },
  };
  const p = params[actividad] ?? params.reposo;

  let bpm;
  if (prevBPM !== undefined) {
    bpm = prevBPM + gaussRandom(0, 3);
    bpm = bpm + (p.media - bpm) * 0.1; // deriva hacia media de la actividad
  } else {
    bpm = gaussRandom(p.media, p.sigma);
  }
  return Math.round(Math.max(35, Math.min(135, bpm)));
}

/**
 * Nivel de estrés (0–100%)
 */
function calcEstres(actividad, temperatura, prevEstres) {
  const base = { reposo: 8, caminando: 20, comiendo: 12, corriendo: 65 };
  let target = base[actividad] ?? 10;

  // Estrés por temperatura elevada
  if (temperatura > 40.0) target += (temperatura - 40.0) * 18;

  // Ruido
  target += gaussRandom(0, 4);

  let estres;
  if (prevEstres !== undefined) {
    estres = prevEstres * 0.65 + target * 0.35;
  } else {
    estres = target;
  }
  return Math.round(Math.max(0, Math.min(100, estres)));
}

/**
 * Saturación de oxígeno en sangre (%)
 * Normal bovina: 95–100%
 */
function calcSaturacionO2(actividad, estres) {
  let base = 98.5;
  if (actividad === 'corriendo') base -= 2.0;
  if (estres > 70) base -= (estres - 70) * 0.08;
  return parseFloat(Math.max(90, Math.min(100, gaussRandom(base, 0.4))).toFixed(1));
}

/**
 * Genera lectura de vitales para un animal.
 * @param {string} animalId
 * @param {object} config  Sección config.sensores del config.json
 * @returns {object} vitales
 */
export function generarVitales(animalId, config) {
  const prev = historial.get(animalId) ?? {};

  const actividad     = elegirActividad(prev.actividad);
  const temperatura   = calcTemperatura(actividad, prev.temperatura, config?.temperatura);
  const ritmoCardiaco = calcRitmoCardiaco(actividad, prev.ritmoCardiaco);
  const estres        = calcEstres(actividad, temperatura, prev.estres);
  const saturacionO2  = calcSaturacionO2(actividad, estres);
  const umbralFiebre  = config?.temperatura?.umbral_alerta ?? 40.5;

  const vitales = {
    actividad,
    temperatura,
    ritmoCardiaco,
    estres,
    saturacionO2,
    esFiebre:    temperatura >= umbralFiebre,
    esEstresAlto: estres >= 75,
  };

  historial.set(animalId, vitales);
  return vitales;
}

export function limpiarHistorial(animalId) {
  if (animalId) historial.delete(animalId);
  else historial.clear();
}

export function obtenerHistorial(animalId) {
  return historial.get(animalId) ?? null;
}
