const buildMapSearchUrl = (query) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

export const SOUTH_CAPITAL_MOTEL_FALLBACK = [
  {
    id: "fallback-curitiba-le-ton",
    name: "MOTEL LE TON",
    address: "R. Bento Cego, 251 - Uberaba, Curitiba - PR, 81560-320",
    city: "Curitiba - PR",
    mapUrl: buildMapSearchUrl("Motel Le Ton R. Bento Cego, 251 Uberaba Curitiba PR"),
    logoUrl: "",
    phone: "(41) 99689-1733",
  },
  {
    id: "fallback-curitiba-deslize",
    name: "MOTEL DESLIZE",
    address: "",
    city: "Curitiba - PR",
    mapUrl: buildMapSearchUrl("Motel Deslize Curitiba PR"),
    logoUrl: "",
    phone: "(41) 3354-4041",
  },
  {
    id: "fallback-florianopolis-2001",
    name: "MOTEL 2001",
    address: "",
    city: "Florianopolis - SC",
    mapUrl: buildMapSearchUrl("Motel 2001 Florianopolis SC"),
    logoUrl: "",
    phone: "(48) 3258-1098",
  },
  {
    id: "fallback-florianopolis-dallas",
    name: "MOTEL DALLAS",
    address: "",
    city: "Florianopolis - SC",
    mapUrl: buildMapSearchUrl("Motel Dallas Florianopolis SC"),
    logoUrl: "",
    phone: "(48) 3243-6180",
  },
  {
    id: "fallback-porto-alegre-drops",
    name: "DROPS MOTEL POA",
    address: "",
    city: "Porto Alegre - RS",
    mapUrl: buildMapSearchUrl("Drops Motel Porto Alegre RS"),
    logoUrl: "",
    phone: "(51) 99865-6241",
  },
  {
    id: "fallback-porto-alegre-audace",
    name: "AUDACE MOTEL",
    address: "",
    city: "Porto Alegre - RS",
    mapUrl: buildMapSearchUrl("Audace Motel Porto Alegre RS"),
    logoUrl: "",
    phone: "(51) 3095-1010",
  },
];

export const normalizeMotelText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export const extractMotelCityName = (value) => {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.includes("-")) return text.split("-")[0].trim();
  if (text.includes(",")) return text.split(",")[0].trim();
  return text;
};

export const stripMotelUfSuffix = (value) =>
  String(value || "").replace(/\s*-\s*[A-Za-z]{2}$/, "").trim();

export const isMotelPartnerFromCity = (partnerCity, detectedCity) => {
  const partnerCityNorm = normalizeMotelText(extractMotelCityName(partnerCity));
  const detectedCityNorm = normalizeMotelText(detectedCity || "");
  if (!partnerCityNorm || !detectedCityNorm) return false;
  return (
    partnerCityNorm.includes(detectedCityNorm) ||
    detectedCityNorm.includes(partnerCityNorm)
  );
};

export const mergeSouthCapitalFallbackMotels = (partners = []) => {
  const apiPartners = Array.isArray(partners) ? partners : [];
  const apiByName = new Map(
    apiPartners
      .filter((partner) => partner?.name)
      .map((partner) => [normalizeMotelText(partner.name), partner])
  );

  return SOUTH_CAPITAL_MOTEL_FALLBACK.map((fallback) => {
    const savedPartner = apiByName.get(normalizeMotelText(fallback.name));
    if (!savedPartner) {
      return fallback;
    }

    return {
      ...fallback,
      id: savedPartner.id || fallback.id,
      address: savedPartner.address || fallback.address,
      city: savedPartner.city || fallback.city,
      mapUrl: savedPartner.mapUrl || fallback.mapUrl,
      logoUrl: savedPartner.logoUrl || fallback.logoUrl,
      phone: fallback.phone,
    };
  });
};

export const enrichSouthCapitalMotelPartners = (partners = []) => {
  const apiPartners = Array.isArray(partners) ? partners : [];
  const fallbackByName = new Map(
    SOUTH_CAPITAL_MOTEL_FALLBACK.map((fallback) => [
      normalizeMotelText(fallback.name),
      fallback,
    ])
  );

  return apiPartners.map((partner) => {
    const fallback = fallbackByName.get(normalizeMotelText(partner?.name));
    if (!fallback) {
      return partner;
    }

    return {
      ...partner,
      address: partner.address || fallback.address,
      city: partner.city || fallback.city,
      mapUrl: partner.mapUrl || fallback.mapUrl,
      logoUrl: partner.logoUrl || fallback.logoUrl,
      phone: fallback.phone,
    };
  });
};
