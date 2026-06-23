/**
 * Calcula o tempo de rotação (em ms) baseado no número de acompanhantes na cidade
 * Fórmula: 86.400 segundos / total de acompanhantes
 * @param {number} modelCountByCity - Número de acompanhantes na cidade
 * @returns {number} Tempo em milissegundos
 */
export function calculateRotationTimeMs(modelCountByCity) {
  const SECONDS_PER_DAY = 86400;
  
  if (!modelCountByCity || modelCountByCity <= 0) {
    return SECONDS_PER_DAY * 1000; // Fallback: 1 dia em ms
  }
  
  const secondsPerModel = SECONDS_PER_DAY / modelCountByCity;
  return secondsPerModel * 1000; // Converter para ms
}

/**
 * Formata o tempo de rotação para exibição legível
 * @param {number} timeMs - Tempo em milissegundos
 * @returns {string} Tempo formatado (ex: "7m 12s", "1h 36m", "2h 24m")
 */
export function formatRotationTime(timeMs) {
  const totalSeconds = Math.round(timeMs / 1000);
  
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  
  return `${seconds}s`;
}

/**
 * Agrupa modelos por cidade e conta quantos há em cada uma
 * @param {Array} models - Array de modelos
 * @returns {Map} Map com cidade como chave e contagem como valor
 */
export function groupModelsByCity(models) {
  const cityMap = new Map();
  
  models.forEach((model) => {
    const city = (model.city || "Unknown").trim();
    const current = cityMap.get(city) || 0;
    cityMap.set(city, current + 1);
  });
  
  return cityMap;
}

/**
 * Encontra a rotação mais frequente (menor tempo) entre os modelos
 * @param {Array} models - Array de modelos
 * @returns {object} { timeMs, formatted, modelsByCity }
 */
export function getRotationStrategy(models) {
  if (!models || models.length === 0) {
    return {
      timeMs: 86400000,
      formatted: "1d",
      modelsByCity: new Map(),
    };
  }
  
  const modelsByCity = groupModelsByCity(models);
  
  // Encontra a cidade com MAIS modelos (menor tempo de rotação)
  let maxCount = 0;
  let maxCity = null;
  
  for (const [city, count] of modelsByCity.entries()) {
    if (count > maxCount) {
      maxCount = count;
      maxCity = city;
    }
  }
  
  const timeMs = calculateRotationTimeMs(maxCount);
  
  return {
    timeMs,
    formatted: formatRotationTime(timeMs),
    modelsByCity,
    strategy: `${maxCount} acompanhantes - ${formatRotationTime(timeMs)} cada`,
  };
}
