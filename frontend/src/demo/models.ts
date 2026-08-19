import happyEscortsMultiModels from "../../modelos.fake/happyescorts_multi_perfis (1).json";
import happyEscortsRomeModels from "../../modelos.fake/happyescorts_roma_perfis.json";
import orhidiSpainModels from "../../modelos.fake/orhidi_es_perfis.json";
import orhidiItalyModels from "../../modelos.fake/orhidi_it_perfis.json";
import orhidiMoreModels from "../../modelos.fake/orhidi_more_perfis.json";
import orhidiMore2Models from "../../modelos.fake/orhidi_more2_perfis.json";
import orhidiMore3Models from "../../modelos.fake/orhidi_more3_perfis.json";

export const DEMO_MODEL_PREFIX = "demo-model-";
const DEMO_OFFLINE_STORAGE_KEY = "modelsClubDemoOfflineModels";
const DEMO_PHONE = "390000000000";

// URLs mantidas nos JSONs de origem para auditoria, mas que falharam na validação
// HTTP e não devem ser exibidas no frontend.
const BROKEN_DEMO_PHOTO_URLS = new Set([
  "https://www.happyescorts.com/images/com_escorts/gallery/167/167761/Escort__moqea.jpeg",
  "https://www.happyescorts.com/images/com_escorts/gallery/167/167761/Escort__jvsho.jpeg",
  "https://www.happyescorts.com/images/com_escorts/gallery/201/201157/Escort__pxomo.jpeg",
  "https://www.happyescorts.com/images/com_escorts/gallery/201/201157/Escort__ulizx.jpeg",
  "https://www.happyescorts.com/images/com_escorts/gallery/201/201157/Escort__vmgza.jpeg",
  "https://www.happyescorts.com/images/com_escorts/gallery/201/201157/Escort__pzubu.jpeg",
  "https://www.happyescorts.com/images/com_escorts/gallery/201/201157/Escort__qmhzc.jpeg",
  "https://www.happyescorts.com/images/com_escorts/gallery/228/228551/Escort__fhvfj.jpg",
  "https://www.happyescorts.com/images/com_escorts/gallery/226/226961/Escort__easht.jpg",
  "https://www.happyescorts.com/images/com_escorts/gallery/228/228800/Escort__luelu.jpeg",
]);

const demoSourceModels = [
  ...happyEscortsMultiModels,
  ...happyEscortsRomeModels,
  ...orhidiSpainModels,
  ...orhidiItalyModels,
  ...orhidiMoreModels,
  ...orhidiMore2Models,
  ...orhidiMore3Models,
];

const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const repairMojibake = (value) =>
  String(value || "")
    .replace(/Ã¡/g, "á")
    .replace(/Ã©/g, "é")
    .replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó")
    .replace(/Ãº/g, "ú")
    .replace(/Ã£/g, "ã")
    .replace(/Ãµ/g, "õ")
    .replace(/Ã§/g, "ç")
    .replace(/Ã‰/g, "É")
    .replace(/Ã‡/g, "Ç")
    .replace(/Â°/g, "°")
    .replace(/Â/g, "")
    .replace(/â€“/g, "–")
    .replace(/â€”/g, "—")
    .replace(/â€™/g, "’")
    .replace(/â€œ/g, "“")
    .replace(/â€/g, "”");

const readOfflineIds = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(DEMO_OFFLINE_STORAGE_KEY) || "[]");
    return new Set(Array.isArray(stored) ? stored.map(String) : []);
  } catch {
    return new Set();
  }
};

export const isDemoModelId = (id) => String(id || "").startsWith(DEMO_MODEL_PREFIX);
export const isDemoModel = (model) => isDemoModelId(model?.id);

const normalizeImageUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw || BROKEN_DEMO_PHOTO_URLS.has(raw) || /placeholder|no[-_ ]?photo|sem[-_ ]?foto/i.test(raw)) {
    return "";
  }

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    if (!/\.(?:jpe?g|png|webp)$/i.test(parsed.pathname)) {
      return "";
    }
    return parsed.toString();
  } catch {
    return "";
  }
};

const normalizePhotos = (photos) =>
  Array.from(
    new Set(
      (Array.isArray(photos) ? photos : [])
        .map(normalizeImageUrl)
        .filter(Boolean)
    )
  );

const uniqueSourceModels = (() => {
  const profileUrls = new Set();
  const firstPhotos = new Set();

  return demoSourceModels.filter((source) => {
    const profileUrl = String(source?.profileUrl || "").trim().toLowerCase();
    const photos = normalizePhotos(source?.photos);
    const firstPhoto = photos[0] || "";
    if (!profileUrl || !firstPhoto || profileUrls.has(profileUrl) || firstPhotos.has(firstPhoto)) {
      return false;
    }
    profileUrls.add(profileUrl);
    firstPhotos.add(firstPhoto);
    return true;
  });
})();

const normalizeDemoModel = (source, index, offlineIds) => {
  const photos = normalizePhotos(source.photos);
  if (!photos.length || !source?.name || !source?.city || !source?.profileUrl) {
    return null;
  }

  const id = `${DEMO_MODEL_PREFIX}${String(source.id || source.profileUrl || index + 1)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")}`;
  const isOffline = offlineIds.has(id);
  const services = Array.isArray(source.services) && source.services.length
    ? source.services
    : Array.isArray(source.tags)
      ? source.tags
      : ["Acompanhante"];
  const price = Number(source.price) || 0;

  return {
    id,
    name: repairMojibake(source.name),
    age: Number(source.age) || 25,
    city: repairMojibake(source.city),
    country: repairMojibake(source.country || "Brasil"),
    profileUrl: String(source.profileUrl),
    bio: "Perfil demonstrativo com dados importados para visualizacao no frontend.",
    avatarUrl: photos[0],
    coverUrl: photos[1] || photos[0],
    galleryPreviewPhotos: photos,
    demoPhotos: photos,
    whatsapp: DEMO_PHONE,
    email: "demo-model@example.invalid",
    phone: DEMO_PHONE,
    genderIdentity: "Mulher",
    nationality: repairMojibake(source.nationalityLabel || source.country || "Nao informado"),
    ethnicity: repairMojibake(source.bodyLabel || "Nao informado"),
    height: Number(source.heightCm) || null,
    hairStyle: repairMojibake(source.hairLabel || "Nao informado"),
    hairLength: "Nao informado",
    eyeColor: repairMojibake(source.eyeLabel || "Nao informado"),
    offeredServices: services.map((service) => repairMojibake(service)),
    priceHour: price,
    price30Min: price ? Math.round(price * 0.65) : 0,
    price2Hours: price ? price * 2 : 0,
    price15Min: 0,
    price4Hours: 0,
    priceOvernight: 0,
    paymentMethods: ["PIX", "DINHEIRO"],
    attendanceSchedule: null,
    planTier: "BASIC",
    isVerified: true,
    isDemo: true,
    isOnline: index % 20 === 0 && !isOffline,
    isDemoSourceUrl: true,
    demoSource: repairMojibake(source.source || new URL(source.profileUrl).hostname),
  };
};

export const getDemoModels = () => {
  const offlineIds = readOfflineIds();
  return uniqueSourceModels.map((model, index) => normalizeDemoModel(model, index, offlineIds)).filter(Boolean);
};

export const getDemoModelById = (id) =>
  getDemoModels().find((model) => model.id === String(id || "")) || null;

export const markDemoModelOffline = (id) => {
  if (!isDemoModelId(id)) return;
  const offlineIds = readOfflineIds();
  offlineIds.add(String(id));
  try {
    localStorage.setItem(DEMO_OFFLINE_STORAGE_KEY, JSON.stringify([...offlineIds]));
  } catch {
    // O status demo continua valido durante a sessao mesmo se o storage estiver bloqueado.
  }
};

const matchesDemoFilters = (model, { city = "", service = "" } = {}) => {
  const cityTerm = normalizeText(city);
  const serviceTerm = normalizeText(service);
  const cityMatches = !cityTerm || normalizeText(model.city).includes(cityTerm);
  const serviceMatches =
    !serviceTerm || model.offeredServices.some((item) => normalizeText(item).includes(serviceTerm));
  return cityMatches && serviceMatches;
};

export const mergeModelsWithDemo = (realModels, options = {}) => {
  const real = Array.isArray(realModels) ? realModels.filter(Boolean) : [];
  const limit = Number.isFinite(Number(options.limit)) ? Math.max(1, Number(options.limit)) : 24;
  const filteredDemo = getDemoModels()
    .filter((model) => matchesDemoFilters(model, options))
    .sort((left, right) => right.galleryPreviewPhotos.length - left.galleryPreviewPhotos.length);
  const existingIds = new Set(real.map((model) => String(model?.id || "")));
  const demosNeeded = Math.max(0, limit - real.length);
  const demos = filteredDemo.filter((model) => !existingIds.has(model.id)).slice(0, demosNeeded);
  return [...real.slice(0, limit), ...demos];
};

export const preloadDemoImages = (models, count = 8) => {
  if (typeof window === "undefined") return;
  const urls = (Array.isArray(models) ? models : [])
    .filter(isDemoModel)
    .flatMap((model) => model.galleryPreviewPhotos || [])
    .filter(Boolean)
    .slice(0, count * 3);
  urls.forEach((url) => {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
  });
};
