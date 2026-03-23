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

const FEATURED_PRIMARY_FILTER = { id: "WOMEN", label: "Mulheres" };
const FEATURED_OTHER_GENDER_FILTERS = [
  { id: "MEN", label: "Homens" },
  { id: "TRAVESTIS", label: "Travestis" },
  { id: "UNKNOWN", label: "Outros perfis" },
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
  const [featuredGenderFilter, setFeaturedGenderFilter] = useState(
    FEATURED_PRIMARY_FILTER.id
  );
  const [showOtherGenderFilters, setShowOtherGenderFilters] = useState(false);
  const [citySearch, setCitySearch] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const [citySuggestions, setCitySuggestions] = useState([]);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const debounceRef = useRef(null);
  const navigate = useNavigate();
  const otherFiltersRef = useRef(null);

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

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!otherFiltersRef.current) {
        return;
      }
      if (!otherFiltersRef.current.contains(event.target)) {
        setShowOtherGenderFilters(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
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
  const genderFilteredModels = models.filter((model) => {
    const category = normalizeGenderCategory(model.genderIdentity);
    if (featuredGenderFilter === "UNKNOWN") {
      return category === "UNKNOWN";
    }
    return category === featuredGenderFilter;
  });
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

  return (
    <div className="page">
      <section className="hero">
        <div>
          <div className="hero-spot">
            <div className="hero-announcement" role="status" aria-live="polite">
              aproveite 30 dias gr&aacute;tis para voc&ecirc; se surpreender
            </div>
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
            <div className="hero-search">
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
              />
              <button
                className="hero-search-button"
                type="button"
                onClick={handleSearch}
              >
                Buscar
              </button>
            </div>
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
                <Link to="/modelos#avaliacoes" className="popular-item">
                  <span className="popular-icon" aria-hidden="true" />
                  <span>Ler avaliacoes</span>
                  <span className="popular-chevron" aria-hidden="true" />
                </Link>
                <Link to="/shots" className="popular-item">
                  <span className="popular-icon" aria-hidden="true" />
                  <span>Models Shots</span>
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
          </div>

        </div>

        <div className="hero-visual">
          <div className="hero-image">
            <img
              src="/models-club-favicon.png"
              alt="Models-club"
              className="hero-logo"
            />
          </div>
          <div className="hero-panel">
            <h3>Por que models-club</h3>
            <ul>
              <li>Selecao curada e perfis completos.</li>
              <li>Contato direto e seguro.</li>
              <li>Experiencia premium para anunciantes.</li>
              <li>Ambiente 18+ com consentimento ativo.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">
          Acompanhantes em destaque
        </h2>
        <p className="muted" style={{ marginTop: 10 }}>
          Uma vitrine com os perfis mais acessados da semana.
        </p>
        <div className="home-gender-filter">
          <span className="home-gender-filter-label">Ver por categoria:</span>
          <div className="home-gender-filter-actions">
            <button
              type="button"
              className={`home-gender-filter-btn ${
                featuredGenderFilter === FEATURED_PRIMARY_FILTER.id ? "active" : ""
              }`}
              onClick={() => {
                setFeaturedGenderFilter(FEATURED_PRIMARY_FILTER.id);
                setShowOtherGenderFilters(false);
              }}
            >
              {FEATURED_PRIMARY_FILTER.label}
            </button>
            <div className="home-gender-filter-dropdown" ref={otherFiltersRef}>
              <button
                type="button"
                className={`home-gender-filter-btn ${
                  featuredGenderFilter !== FEATURED_PRIMARY_FILTER.id ? "active" : ""
                }`}
                onClick={() =>
                  setShowOtherGenderFilters((current) => !current)
                }
              >
                Outros
              </button>
              {showOtherGenderFilters ? (
                <div className="home-gender-filter-menu">
                  {FEATURED_OTHER_GENDER_FILTERS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={`home-gender-filter-menu-item ${
                        featuredGenderFilter === option.id ? "active" : ""
                      }`}
                      onClick={() => {
                        setFeaturedGenderFilter(option.id);
                        setShowOtherGenderFilters(false);
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="models-grid home-models-grid">
          {featuredModels.length === 0 ? (
            <Link to="/seja-modelo" className="model-card home-model-card">
              <img
                className="model-photo home-model-photo home-model-logo"
                src="/models-club-favicon.png"
                alt="Models-club"
                loading="lazy"
              />
              <div className="model-info">
                <h3>Acompanhante em destaque</h3>
                <p>Seja a primeira a criar um perfil premium</p>
              </div>
            </Link>
          ) : (
            featuredModels.map((model) => (
              <HomeFeaturedModelCard model={model} key={model.id} />
            ))
          )}
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






