import { useMemo, useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { apiFetch } from "../lib/api";

const PARTNER_MOTEIS_TESTE = [
  {
    id: "motel-parceiro-teste",
    name: "Motel Parceiro (Teste)",
    address: "Endereco em validacao comercial",
    city: "Curitiba - PR",
    mapUrl: "https://maps.google.com",
    logoUrl: "",
  },
];

const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const extractCityName = (value) => {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.includes("-")) {
    return text.split("-")[0].trim();
  }
  if (text.includes(",")) {
    return text.split(",")[0].trim();
  }
  return text;
};

const stripUfSuffix = (value) => String(value || "").replace(/\s*-\s*[A-Za-z]{2}$/, "").trim();

const isPartnerFromCity = (partnerCity, detectedCity) => {
  const partnerCityNorm = normalizeText(extractCityName(partnerCity));
  const detectedCityNorm = normalizeText(detectedCity);
  if (!partnerCityNorm || !detectedCityNorm) {
    return false;
  }
  return (
    partnerCityNorm.includes(detectedCityNorm) ||
    detectedCityNorm.includes(partnerCityNorm)
  );
};

export default function Footer() {
  const location = useLocation();
  const [partners, setPartners] = useState(PARTNER_MOTEIS_TESTE);
  const [locationStatus, setLocationStatus] = useState("idle");
  const [detectedCity, setDetectedCity] = useState("");
  const [locationError, setLocationError] = useState("");

  const query = new URLSearchParams(location.search);
  const cityQuery = String(query.get("cidade") || query.get("city") || "").trim();
  const searchCity = stripUfSuffix(cityQuery) || detectedCity;

  const detectLocationAndFilter = () => {
    if (!navigator?.geolocation) {
      setDetectedCity("");
      setLocationStatus("unsupported");
      setLocationError("Geolocalizacao nao suportada neste navegador.");
      return;
    }

    setDetectedCity("");
    setLocationStatus("locating");
    setLocationError("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const lat = Number(position.coords.latitude);
          const lon = Number(position.coords.longitude);
          const params = new URLSearchParams({
            format: "jsonv2",
            lat: String(lat),
            lon: String(lon),
            zoom: "10",
            addressdetails: "1",
          });
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?${params.toString()}`
          );
          if (!response.ok) {
            throw new Error("Falha ao detectar cidade.");
          }
          const data = await response.json();
          const address = data?.address || {};
          const city =
            address.city ||
            address.town ||
            address.municipality ||
            address.village ||
            address.county ||
            "";

          if (!city) {
            throw new Error("Cidade nao identificada.");
          }

          const cityName = String(city);
          if (!cityQuery) {
            setDetectedCity(cityName);
          }
          setLocationStatus("ready");
        } catch (error) {
          setDetectedCity("");
          setLocationStatus("error");
          setLocationError(error?.message || "Nao foi possivel detectar a cidade.");
        }
      },
      (error) => {
        setDetectedCity("");
        setLocationStatus("denied");
        setLocationError(
          error?.code === 1
            ? "Permissao de localizacao negada."
            : "Nao foi possivel obter a localizacao."
        );
      },
      {
        enableHighAccuracy: false,
        timeout: 9000,
        maximumAge: 5 * 60 * 1000,
      }
    );
  };

  useEffect(() => {
    let mounted = true;
    apiFetch("/api/motel-partners")
      .then((data) => {
        if (!mounted) return;
        const safeData = Array.isArray(data) ? data : [];
        if (safeData.length === 0) {
          setPartners(PARTNER_MOTEIS_TESTE);
          return;
        }
        setPartners(
          safeData.map((partner) => ({
            id: partner.id,
            name: partner.name,
            address: partner.address || "",
            city: partner.city || "",
            mapUrl: partner.mapUrl || "",
            logoUrl: partner.photoUrl || "",
          }))
        );
      })
      .catch(() => {
        if (!mounted) return;
        setPartners(PARTNER_MOTEIS_TESTE);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    detectLocationAndFilter();
  }, []);

  const locationResult = useMemo(() => {
    if (!searchCity) {
      return {
        partnersToShow: partners,
        matchCount: partners.length,
      };
    }

    const matched = partners.filter((partner) =>
      isPartnerFromCity(partner.city, searchCity)
    );
    if (matched.length === 0) {
      return {
        partnersToShow: partners,
        matchCount: 0,
      };
    }
    return {
      partnersToShow: matched,
      matchCount: matched.length,
    };
  }, [partners, detectedCity, searchCity]);

  return (
    <footer className="footer">
      <div className="footer-grid">
        <div>
          <div className="brand">
            <span className="brand-mark">MS</span>
            <span className="notranslate" translate="no">
              models-club
            </span>
          </div>
          <p className="muted" style={{ marginTop: 12 }}>
            PLATAFORMA PREMIUM PARA ACOMPANHANTES
          </p>
        </div>

        <div>
          <h4 className="pill">Explorar</h4>
          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            <Link to="/modelos">Acompanhantes</Link>
            <Link to="/seja-modelo">Seja acompanhante</Link>
            <Link to="/anuncie">Anuncie</Link>
          </div>
        </div>

        <div>
          <h4 className="pill">Institucional</h4>
          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            <Link to="/sobre">Sobre</Link>
            <Link to="/contato">Contato</Link>
            <Link to="/faq">FAQ</Link>
          </div>
        </div>

        <div>
          <h4 className="pill">Legal</h4>
          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            <Link to="/termos">Termos</Link>
            <Link to="/privacidade">Privacidade</Link>
          </div>
        </div>
      </div>
      <div className="footer-partners">
        <h4 className="pill">Moteis Parceiros</h4>
        {locationStatus === "locating" ? (
          <p className="muted footer-partners-note">Buscando parceiros proximos...</p>
        ) : null}
        {locationStatus === "unsupported" ? (
          <p className="muted footer-partners-note">Geolocalizacao indisponivel neste navegador.</p>
        ) : null}
        {locationStatus === "ready" && searchCity ? (
          <p className="muted footer-partners-note">
            Cidade: {searchCity}
            {locationResult.matchCount > 0
              ? ` | ${locationResult.matchCount} parceiro(s) nesta cidade.`
              : " | sem parceiros na cidade, exibindo lista geral."}
          </p>
        ) : null}
        {locationStatus === "denied" ? (
          <p className="muted footer-partners-note">
            Localizacao bloqueada no navegador.
          </p>
        ) : null}
        {locationError && locationStatus !== "denied" && locationStatus !== "unsupported" ? (
          <p className="muted footer-partners-note">{locationError}</p>
        ) : null}
        <div className="footer-partners-grid">
          {locationResult.partnersToShow.map((partner) => (
            <article
              key={partner.id}
              className="footer-partner-card"
              title={`${partner.name}${partner.address ? ` | ${partner.address}` : ""}${partner.city ? ` | ${partner.city}` : ""}`}
            >
              <div className="footer-partner-logo-shell">
                {partner.logoUrl ? (
                  <img
                    src={partner.logoUrl}
                    alt={`Logo do ${partner.name}`}
                    className="footer-partner-logo"
                    loading="lazy"
                  />
                ) : (
                  <div className="footer-partner-logo-placeholder">
                    LOGO DO PARCEIRO
                  </div>
                )}
              </div>
              <strong style={{ color: "#ffffff" }}>{partner.name}</strong>
              <p className="muted footer-partner-meta" style={{ color: "rgba(255,255,255,0.85)" }}>{partner.city || partner.address}</p>
              {partner.mapUrl ? (
                <a
                  href={partner.mapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="footer-partner-link"
                >
                  Mapa
                </a>
              ) : null}
            </article>
          ))}
        </div>
      </div>
      <div className="muted" style={{ textAlign: "center", marginTop: 18 }}>
        &copy; 2026 Models-Club. Todos os direitos reservados.
      </div>
    </footer>
  );
}

