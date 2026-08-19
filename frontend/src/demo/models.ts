import europeModels from "../demo-data/models-europe.json";
import americanModels from "../demo-data/models-americas.json";

export const DEMO_MODEL_PREFIX = "demo-model-";
const DEMO_OFFLINE_STORAGE_KEY = "modelsClubDemoOfflineModels";
const DEMO_PHONE = "390000000000";

const demoSourceModels = [...europeModels, ...americanModels];

const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

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

const normalizePhotos = (photos) =>
  Array.from(new Set(Array.isArray(photos) ? photos.map((photo) => String(photo || "").trim()) : []))
    .filter(Boolean);

const normalizeDemoModel = (source, index, offlineIds) => {
  const photos = normalizePhotos(source.photos);
  if (!photos.length || !source?.name || !source?.city) {
    return null;
  }

  const id = `${DEMO_MODEL_PREFIX}${String(source.key || index + 1)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")}`;
  const isOffline = offlineIds.has(id);
  const attributes = source.attributes || {};
  const prices = source.prices || {};

  return {
    id,
    name: String(source.name),
    age: Number(source.age) || 25,
    city: String(source.city),
    country: String(source.country || "Brasil"),
    bio: String(source.bio || "Perfil demonstrativo com dados sinteticos."),
    avatarUrl: photos[0],
    coverUrl: photos[1] || photos[0],
    galleryPreviewPhotos: photos,
    demoPhotos: photos,
    whatsapp: DEMO_PHONE,
    email: "demo-model@example.invalid",
    phone: DEMO_PHONE,
    genderIdentity: String(source.genderIdentity || "Mulher"),
    nationality: String(source.nationality || source.country || "Nao informado"),
    ethnicity: String(attributes.ethnicity || "Nao informado"),
    height: Number(attributes.height) || null,
    hairStyle: String(attributes.hairStyle || "Nao informado"),
    hairLength: String(attributes.hairLength || "Nao informado"),
    eyeColor: String(attributes.eyeColor || "Nao informado"),
    offeredServices: Array.isArray(source.services) ? source.services : [],
    priceHour: Number(prices.hour) || 0,
    price30Min: Number(prices["30Min"]) || 0,
    price2Hours: Number(prices["2Hours"]) || 0,
    price15Min: 0,
    price4Hours: 0,
    priceOvernight: 0,
    paymentMethods: ["PIX", "DINHEIRO"],
    attendanceSchedule: null,
    planTier: "BASIC",
    isVerified: true,
    isDemo: true,
    isOnline: Boolean(source.isOnline) && !isOffline,
    demoSource: "synthetic-local-data",
  };
};

export const getDemoModels = () => {
  const offlineIds = readOfflineIds();
  return demoSourceModels.map((model, index) => normalizeDemoModel(model, index, offlineIds)).filter(Boolean);
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

