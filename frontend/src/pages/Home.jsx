import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";

function HomeFeaturedModelCard({ model }) {
  const fallbackPhoto = model.coverUrl || model.avatarUrl || "/model-placeholder.svg";
  const galleryPhotos = Array.isArray(model.galleryPreviewPhotos)
    ? model.galleryPreviewPhotos.filter(Boolean)
    : [];
  const photos = (galleryPhotos.length > 0 ? galleryPhotos : [fallbackPhoto]).slice(0, 3);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const touchStartXRef = useRef(0);
  const touchDeltaXRef = useRef(0);
  const blockNextClickRef = useRef(false);
  const hasWebcam = Array.isArray(model.offeredServices)
    ? model.offeredServices.some((service) =>
        String(service || "").toLowerCase().includes("webcam")
      )
    : false;

  const handleTouchStart = (event) => {
    if (photos.length <= 1 || !event.touches?.length) {
      return;
    }
    touchStartXRef.current = event.touches[0].clientX;
    touchDeltaXRef.current = 0;
  };

  const handleTouchMove = (event) => {
    if (photos.length <= 1 || !event.touches?.length) {
      return;
    }
    touchDeltaXRef.current = event.touches[0].clientX - touchStartXRef.current;
  };

  const handleTouchEnd = () => {
    if (photos.length <= 1) {
      return;
    }
    const deltaX = touchDeltaXRef.current;
    touchStartXRef.current = 0;
    touchDeltaXRef.current = 0;
    if (Math.abs(deltaX) < 35) {
      return;
    }

    blockNextClickRef.current = true;
    setActivePhotoIndex((current) => {
      if (deltaX < 0) {
        return current + 1 >= photos.length ? 0 : current + 1;
      }
      return current - 1 < 0 ? photos.length - 1 : current - 1;
    });
  };

  const handleCardClick = (event) => {
    if (!blockNextClickRef.current) {
      return;
    }
    event.preventDefault();
    blockNextClickRef.current = false;
  };

  return (
    <Link
      to={`/modelos/${model.id}`}
      className="model-card home-model-card"
      onClick={handleCardClick}
    >
      <div
        className="home-model-photo-frame"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <img
          className="model-photo home-model-photo"
          src={photos[activePhotoIndex] || fallbackPhoto}
          alt={model.name}
          loading="lazy"
        />
        {hasWebcam ? (
          <span className="model-badge model-badge-webcam">Virtual</span>
        ) : null}
        {photos.length > 1 ? (
          <div className="home-model-photo-dots" aria-hidden="true">
            {photos.map((_, index) => (
              <span
                key={`${model.id}-dot-${index}`}
                className={`home-model-photo-dot ${index === activePhotoIndex ? "active" : ""}`}
              />
            ))}
          </div>
        ) : null}
      </div>
      <div className="model-info">
        <h3>{model.name}</h3>
        <p>{model.city || "Brasil"}</p>
      </div>
    </Link>
  );
}

const FEATURED_GENDER_FILTERS = [
  { id: "WOMEN", label: "Mulheres" },
  { id: "TRAVESTIS", label: "Travestis" },
  { id: "MEN", label: "Homens" },
];

const normalizeGenderCategory = (genderIdentity) => {
  const normalized = String(genderIdentity || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  if (!normalized) {
    return "UNKNOWN";
  }

  if (
    normalized.includes("travesti") ||
    normalized.includes("mulher trans") ||
    normalized.includes("transfemin")
  ) {
    return "TRAVESTIS";
  }

  if (normalized.includes("homem")) {
    return "MEN";
  }

  if (normalized.includes("mulher")) {
    return "WOMEN";
  }

  return "UNKNOWN";
};

export default function Home() {
  const [models, setModels] = useState([]);
  const [featuredGenderFilter, setFeaturedGenderFilter] = useState("WOMEN");
  const [citySearch, setCitySearch] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const [motelPartners, setMotelPartners] = useState([]);
  const [detectedMotelCity, setDetectedMotelCity] = useState("");
  const [citySuggestions, setCitySuggestions] = useState([]);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const debounceRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch("/api/models?page=1&limit=60")
      .then((data) => {
        const items = Array.isArray(data)
          ? data
          : Array.isArray(data?.items)
          ? data.items
          : [];
        setModels(items);
      })
      .catch(() => setModels([]));
  }, []);

  

  const normalizeText = (value) =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const stripUfSuffix = (value) =>
    value.replace(/\s*-\s*[A-Za-z]{2}$/, "").trim();
  const extractCityNameFromPartner = (value) => {
    const text = String(value || "").trim();
    if (!text) return "";
    if (text.includes("-")) return text.split("-")[0].trim();
    if (text.includes(",")) return text.split(",")[0].trim();
    return text;
  };
  const isPartnerFromCity = (partnerCity, detectedCity) => {
    const partnerCityNorm = normalizeText(extractCityNameFromPartner(partnerCity));
    const detectedCityNorm = normalizeText(detectedCity || "");
    if (!partnerCityNorm || !detectedCityNorm) return false;
    return (
      partnerCityNorm.includes(detectedCityNorm) ||
      detectedCityNorm.includes(partnerCityNorm)
    );
  };
  const formatCitySuggestion = (city) =>
    city.uf ? `${city.name} - ${city.uf}` : city.name;
  const selectSuggestion = (suggestion) => {
    const label = formatCitySuggestion(suggestion);
    setCitySearch(label);
    setCitySuggestions([]);
    setActiveSuggestion(-1);
    setIsSuggesting(false);
    navigate(`/modelos?cidade=${encodeURIComponent(suggestion.name)}`);
  };
  const trimmedCity = citySearch.trim();
  const cityQuery = stripUfSuffix(trimmedCity);
  const normalizedCitySearch = normalizeText(cityQuery);
  const cityLookup = new Map();
  models.forEach((model) => {
    const city = (model.city || "").trim();
    if (!city) {
      return;
    }
    const key = normalizeText(city);
    if (!cityLookup.has(key)) {
      cityLookup.set(key, city);
    }
  });
  const normalizePlanTier = (value) => String(value || "").trim().toUpperCase();
  const genderFilteredModels = models.filter(
    (model) => normalizeGenderCategory(model.genderIdentity) === featuredGenderFilter
  );
  const proModels = genderFilteredModels.filter(
    (model) => normalizePlanTier(model.planTier) === "PRO"
  );
  const basicModels = genderFilteredModels.filter(
    (model) => normalizePlanTier(model.planTier) !== "PRO"
  );
  const featuredProModels = proModels.slice(0, 10);
  const remainingSlots = Math.max(15 - featuredProModels.length, 0);
  const featuredBasicModels = basicModels.slice(0, remainingSlots);
  const featuredModels = [...featuredProModels, ...featuredBasicModels].slice(0, 15);
  
  

  const modelosLink = cityQuery
    ? `/modelos?cidade=${encodeURIComponent(cityQuery)}`
    : "/modelos";

  const handleSearch = () => {
    navigate(modelosLink);
  };

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    if (normalizedCitySearch.length < 2) {
      setCitySuggestions([]);
      setActiveSuggestion(-1);
      setIsSuggesting(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;
      setIsSuggesting(true);

      fetch(
        `https://servicodados.ibge.gov.br/api/v1/localidades/municipios?nome=${encodeURIComponent(
          cityQuery
        )}`,
        { signal: controller.signal }
      )
        .then((response) => (response.ok ? response.json() : []))
        .then((data) => {
          if (!Array.isArray(data)) {
            setCitySuggestions([]);
            setActiveSuggestion(-1);
            return;
          }
          const seen = new Set();
          const nextSuggestions = data
            .map((item) => {
              const name = item?.nome;
              const uf =
                item?.microrregiao?.mesorregiao?.UF?.sigla ||
                item?.microrregiao?.mesorregiao?.UF?.regiao?.sigla ||
                item?.regiao?.sigla ||
                "";
              return name ? { id: item.id, name, uf } : null;
            })
            .filter(Boolean)
            .filter((item) =>
              normalizeText(item.name).startsWith(normalizedCitySearch)
            )
            .filter((item) => {
              const key = `${normalizeText(item.name)}-${item.uf}`;
              if (seen.has(key)) {
                return false;
              }
              seen.add(key);
              return true;
            })
            .slice(0, 8);
          setCitySuggestions(nextSuggestions);
          setActiveSuggestion(nextSuggestions.length ? 0 : -1);
        })
        .catch((error) => {
          if (error?.name !== "AbortError") {
            setCitySuggestions([]);
            setActiveSuggestion(-1);
          }
        })
        .finally(() => {
          setIsSuggesting(false);
        });
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
  }, [normalizedCitySearch]);

  // Fetch motel partners once
  useEffect(() => {
    let mounted = true;
    apiFetch("/api/motel-partners")
      .then((data) => {
        if (!mounted) return;
        const safeData = Array.isArray(data) ? data : [];
        setMotelPartners(
          safeData.map((p) => ({
            id: p.id,
            name: p.name,
            city: p.city || "",
            mapUrl: p.mapUrl || "",
            logoUrl: p.photoUrl || "",
          }))
        );
      })
      .catch(() => setMotelPartners([]));
    return () => {
      mounted = false;
    };
  }, []);

  // Detect geolocation to get city for motels (fallback if user doesn't search)
  useEffect(() => {
    if (!navigator?.geolocation) {
      setDetectedMotelCity("");
      return;
    }

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
            return setDetectedMotelCity("");
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
          if (city) setDetectedMotelCity(String(city));
        } catch (e) {
          setDetectedMotelCity("");
        }
      },
      () => {
        setDetectedMotelCity("");
      },
      { enableHighAccuracy: false, timeout: 9000, maximumAge: 5 * 60 * 1000 }
    );
  }, []);

  // Inicializa reconhecimento de voz para busca por cidade
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.language = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join("")
        .trim();
      if (transcript) {
        setCitySearch(transcript);
        setCitySuggestions([]);
        setActiveSuggestion(-1);
        try {
          inputRef?.current?.focus();
        } catch (e) {}
        // preenche o campo; usuário clica em Buscar para navegar
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch (e) {}
      recognitionRef.current = null;
    };
  }, [navigate]);

  return (
    <div className="page">
      <section className="hero">
        <div>
          <div className="hero-spot">
            <h2 className="hero-title-alt">
              A MELHOR PLATAFORMA DE ACOMPANHANTES. PERMITA-SE VIVER MOMENTOS
              INESQUECIVEIS.
            </h2>
            <div className="hero-actions hero-actions-alt">
              <Link to="/seja-modelo" className="btn">
                Anunciar como acompanhante
              </Link>
              <Link to="/cadastro" className="btn btn-outline btn-outline-red">
                Cadastrar como cliente
              </Link>
            </div>
              <div className="hero-search" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="text"
                className="hero-search-input"
                placeholder="Buscar acompanhantes por cidade"
                aria-label="Buscar acompanhantes por cidade"
                ref={inputRef}
                value={citySearch}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={(event) => {
                  setIsComposing(false);
                  setCitySearch(event.currentTarget.value);
                  setActiveSuggestion(-1);
                }}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  if (isComposing || event.nativeEvent?.isComposing) {
                    setCitySearch(nextValue);
                    setActiveSuggestion(-1);
                    return;
                  }
                  const normalizedInput = normalizeText(
                    stripUfSuffix(nextValue)
                  );
                  setCitySearch(nextValue);
                  if (normalizedInput.length < 2) {
                    setCitySuggestions([]);
                    setActiveSuggestion(-1);
                  }
                }}
                onKeyDown={(event) => {
                  if (isComposing) {
                    return;
                  }
                  if (citySuggestions.length > 0) {
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      setActiveSuggestion((index) =>
                        index + 1 < citySuggestions.length ? index + 1 : 0
                      );
                      return;
                    }
                    if (event.key === "ArrowUp") {
                      event.preventDefault();
                      setActiveSuggestion((index) =>
                        index > 0 ? index - 1 : citySuggestions.length - 1
                      );
                      return;
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setCitySuggestions([]);
                      setActiveSuggestion(-1);
                      return;
                    }
                  }
                  if (event.key === "Enter") {
                    if (citySuggestions.length > 0 && activeSuggestion >= 0) {
                      event.preventDefault();
                      selectSuggestion(citySuggestions[activeSuggestion]);
                      return;
                    }
                    handleSearch();
                  }
                }}
                style={{ flex: 1 }}
              />
              {window.SpeechRecognition || window.webkitSpeechRecognition ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    if (recognitionRef.current) {
                      if (isListening) {
                        recognitionRef.current.stop();
                        setIsListening(false);
                      } else {
                        setIsListening(false);
                        try {
                          recognitionRef.current.start();
                        } catch (e) {
                          // ignore
                        }
                      }
                    }
                  }}
                  title={isListening ? "Clique para parar" : "Clique para falar"}
                  style={{ padding: '8px 12px' }}
                >
                  {isListening ? '🛑' : '🎤'}
                </button>
              ) : null}
              <button
                className="hero-search-button"
                type="button"
                onClick={handleSearch}
              >
                Buscar
              </button>
            </div>
            {isListening && (
              <p className="muted" style={{ marginTop: 8, textAlign: "center", fontSize: 13 }}>
                🎤 Ouvindo...
              </p>
            )}

            {citySuggestions.length > 0 ? (
              <div
                className="hero-search-suggestions"
                style={{
                  marginTop: 8,
                  display: "grid",
                  gap: 6,
                  maxWidth: 420,
                }}
                role="listbox"
              >
                {citySuggestions.map((suggestion, index) => (
                  <button
                    key={suggestion.id || suggestion.name}
                    type="button"
                    className="hero-search-suggestion"
                    style={{
                      textAlign: "left",
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: "1px solid rgba(255, 255, 255, 0.2)",
                      background:
                        index === activeSuggestion
                          ? "rgba(255, 255, 255, 0.15)"
                          : "rgba(0, 0, 0, 0.4)",
                      color: "inherit",
                      cursor: "pointer",
                    }}
                    onMouseEnter={() => setActiveSuggestion(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectSuggestion(suggestion)}
                  >
                    {formatCitySuggestion(suggestion)}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="popular-links">
              <h3 className="popular-title">Links populares</h3>
              <div className="popular-list">
                <Link to="/avaliacoes" className="popular-item">
                  <span className="popular-icon" aria-hidden="true" />
                  <span>Ler avaliacoes</span>
                  <span className="popular-chevron" aria-hidden="true" />
                </Link>
                <Link to="/shots" className="popular-item">
                  <span className="popular-icon" aria-hidden="true" />
                  <span>Models Shots</span>
                  <span className="popular-chevron" aria-hidden="true" />
                </Link>
                <Link to="/modelos?atendimento=online" className="popular-item">
                  <span className="popular-icon" aria-hidden="true" />
                  <span>Atendimento online (videochamadas)</span>
                  <span className="popular-chevron" aria-hidden="true" />
                </Link>
                <Link to={modelosLink} className="popular-item">
                  <span className="popular-icon" aria-hidden="true" />
                  <span>Ver acompanhantes</span>
                  <span className="popular-chevron" aria-hidden="true" />
                </Link>
              </div>
            </div>

            <div className="trust-section">
              <h3>Contrate com mais seguranca e praticidade</h3>
              <p className="muted">
                na models-club, voce encontra anúncios verificados e contrata sem complicações
              </p>
              <div className="trust-grid">
                <div className="trust-card">
                  <div className="trust-icon">▣</div>
                  <p>Fotos e videos verificados</p>
                </div>
              </div>
            </div>

            {(() => {
              const searchCity = stripUfSuffix((citySearch || "").trim()) || detectedMotelCity;
              if (!searchCity) return null;
              const matched = motelPartners.filter((p) => isPartnerFromCity(p.city, searchCity));
              if (!matched || matched.length === 0) return null;
              return (
                <div style={{ marginTop: 24, marginBottom: 12 }}>
                  <h4 className="pill">Moteis nesta cidade</h4>
                  <div style={{ display: "flex", gap: 12, marginTop: 8, overflowX: "auto" }}>
                    {matched.map((m) => (
                      <a
                        key={m.id}
                        href={m.mapUrl || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="model-card"
                        style={{ minWidth: 220, padding: 12, display: "block" }}
                      >
                        <strong style={{ color: "#ffffff" }}>{m.name}</strong>
                        <p className="muted" style={{ marginTop: 6, color: "rgba(255,255,255,0.85)" }}>{m.city}</p>
                      </a>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

        </div>

      </section>

      

      <section className="section">
        <h2 className="section-title">
          Para <span>marcas</span>
        </h2>
        <p className="muted" style={{ marginTop: 10 }}>
          Solucoes exclusivas para marcas que queiram anunciar na plataforma.
        </p>
        <div className="hero-actions">
          <a
            className="btn"
            href="https://wa.me/554984170134"
            target="_blank"
            rel="noreferrer"
          >
            Falar com equipe
          </a>
          <Link to="/anuncie" className="btn btn-outline">
            Ver planos
          </Link>
        </div>
      </section>

    </div>
  );
}






