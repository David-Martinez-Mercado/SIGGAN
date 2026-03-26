/**
 * generador_gps.js
 * Genera coordenadas GPS realistas para ganado bovino.
 * Movimiento suave dentro del perímetro del rancho.
 * Usa fórmula Haversine para calcular distancias.
 */

// Historial de posiciones: Map<animalId, {lat, lon}>
const historialPos = new Map();

/**
 * Fórmula Haversine — distancia entre dos puntos en metros.
 */
export function haversineMetros(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Convierte metros a grados aproximados en latitud y longitud.
 */
function metrosAGrados(metros, latRef) {
  const mPorGradoLat = 111320;
  const mPorGradoLon = 111320 * Math.cos((latRef * Math.PI) / 180);
  return {
    lat: metros / mPorGradoLat,
    lon: metros / mPorGradoLon,
  };
}

/**
 * Posición inicial aleatoria dentro del 60% interno del radio
 */
function posicionInicial(epicLat, epicLon, radioM) {
  const angulo = Math.random() * 2 * Math.PI;
  const dist = Math.random() * radioM * 0.6;
  const g = metrosAGrados(dist, epicLat);
  return {
    lat: epicLat + g.lat * Math.sin(angulo),
    lon: epicLon + g.lon * Math.cos(angulo),
  };
}

/**
 * Genera coordenadas GPS para un animal.
 *
 * @param {string} animalId
 * @param {string} actividad   'reposo' | 'caminando' | 'comiendo' | 'corriendo'
 * @param {object} config      Sección config.sensores.gps del config.json
 * @param {number} probFuera   Probabilidad de moverse fuera de geocerca (0–1)
 * @returns {object}           { latitud, longitud, precision, distanciaCentroMetros, fueraGeocerca }
 */
export function generarGPS(animalId, actividad, config, probFuera = 0) {
  const epicLat  = config?.epicentro_lat  ?? 24.0277;
  const epicLon  = config?.epicentro_lon  ?? -104.6532;
  const radioM   = config?.radio_metros   ?? 5000;

  // Velocidades máximas de desplazamiento por ciclo de 30 s (metros)
  const velocidades = {
    reposo:    2,
    comiendo:  8,
    caminando: 40,
    corriendo: 180,
  };
  const velMax = velocidades[actividad] ?? 15;

  const prev = historialPos.get(animalId);
  let pos;

  if (!prev) {
    pos = posicionInicial(epicLat, epicLon, radioM);
  } else {
    const dist   = Math.random() * velMax;
    const angulo = Math.random() * 2 * Math.PI;
    const g      = metrosAGrados(dist, prev.lat);

    pos = {
      lat: prev.lat + g.lat * Math.sin(angulo),
      lon: prev.lon + g.lon * Math.cos(angulo),
    };

    // Si el animal sale de la geocerca y NO es el evento de salida intencional, rebotar
    const distCentro = haversineMetros(pos.lat, pos.lon, epicLat, epicLon);
    if (distCentro > radioM && Math.random() > probFuera) {
      // Devolver suavemente hacia el centro
      const dLat = epicLat - pos.lat;
      const dLon = epicLon - pos.lon;
      const norma = Math.sqrt(dLat * dLat + dLon * dLon) || 1;
      const paso = 0.0008;
      pos.lat += (dLat / norma) * paso;
      pos.lon += (dLon / norma) * paso;
    }
  }

  const distCentro = haversineMetros(pos.lat, pos.lon, epicLat, epicLon);
  const precision  = parseFloat((3 + Math.random() * 7).toFixed(1)); // 3–10 m

  historialPos.set(animalId, { lat: pos.lat, lon: pos.lon });

  return {
    latitud:              parseFloat(pos.lat.toFixed(6)),
    longitud:             parseFloat(pos.lon.toFixed(6)),
    precision,
    distanciaCentroMetros: parseFloat(distCentro.toFixed(0)),
    fueraGeocerca:        distCentro > radioM,
  };
}

export function limpiarHistorialGPS(animalId) {
  if (animalId) historialPos.delete(animalId);
  else historialPos.clear();
}

export function obtenerUltimaPosicion(animalId) {
  return historialPos.get(animalId) ?? null;
}
