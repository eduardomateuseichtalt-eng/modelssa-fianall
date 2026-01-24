import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";

export default function Home() {
  const [models, setModels] = useState([]);
  const [citySearch, setCitySearch] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const [citySuggestions, setCitySuggestions] = useState([]);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const debounceRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch("/api/models")
      .then((data) => setModels(data))
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
  const featuredModels = models.slice(0, 6);
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
            <h2 className="hero-title-alt">
              A MELHOR PLATAFORMA DE ACOMPANHANTES. AONDE A BELEZA SE CONECTA
              A MOMENTOS INESQUECIVEIS
            </h2>
            <p className="hero-stat">Cerca de 50 mil acessos por dia</p>
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
                <Link to="/contato" className="popular-item">
                  <span className="popular-icon" aria-hidden="true" />
                  <span>Atendimento virtual</span>
                  <span className="popular-chevron" aria-hidden="true" />
                </Link>
                <Link to="/seja-modelo" className="popular-item">
                  <span className="popular-icon" aria-hidden="true" />
                  <span>Cadastrar como acompanhante</span>
                  <span className="popular-chevron" aria-hidden="true" />
                </Link>
                <Link to="/anuncie" className="popular-item">
                  <span className="popular-icon" aria-hidden="true" />
                  <span>Calculadora de ganhos</span>
                  <span className="popular-chevron" aria-hidden="true" />
                </Link>
                <Link to="/sobre" className="popular-item">
                  <span className="popular-icon" aria-hidden="true" />
                  <span>Como e ser acompanhante</span>
                  <span className="popular-chevron" aria-hidden="true" />
                </Link>
                <Link to="/sobre" className="popular-item">
                  <span className="popular-icon" aria-hidden="true" />
                  <span>Saiba mais acompanhante</span>
                  <span className="popular-chevron" aria-hidden="true" />
                </Link>
              </div>
            </div>

            <div className="trust-section">
              <h3>Contrate com mais seguranca e praticidade</h3>
              <p className="muted">
                Na Models S.A, voce encontra mais de 6 mil anuncios verificados e
                contrata sem complicacoes.
              </p>
              <div className="trust-grid">
                <div className="trust-card">
                  <div className="trust-icon">◎</div>
                  <p>Midia de comparacao 360° atualizada</p>
                </div>
                <div className="trust-card">
                  <div className="trust-icon">✓</div>
                  <p>100% das acompanhantes com documentos verificados</p>
                </div>
                <div className="trust-card">
                  <div className="trust-icon">◯</div>
                  <p>Verificacao facial de rotina</p>
                </div>
                <div className="trust-card">
                  <div className="trust-icon">▣</div>
                  <p>Fotos e videos verificados</p>
                </div>
              </div>
            </div>

            <div className="promo-section">
              <div className="promo-card">
                <h3>Crie seu perfil de graca</h3>
                <p>no maior site de acompanhantes do Brasil</p>
                <Link to="/cadastro" className="btn promo-cta">
                  Cadastre-se gratis
                </Link>
              </div>

              <div className="promo-grid">
                <div className="promo-tile">
                  <span className="promo-icon">★</span>
                  <p>Um dos sites mais visitados do pais</p>
                </div>
                <div className="promo-tile">
                  <span className="promo-icon">◎</span>
                  <p>Anuncie de graca</p>
                </div>
                <div className="promo-tile">
                  <span className="promo-icon">◉</span>
                  <p>Escolha deixar seu perfil para todos ou so clientes premium</p>
                </div>
                <div className="promo-tile">
                  <span className="promo-icon">♡</span>
                  <p>+ de 9 milhoes de visitantes por mes</p>
                </div>
              </div>

              <div className="service-section">
                <h3>Acesse os servicos mais buscados na sua cidade</h3>
                <div className="service-tags">
                  <span>Com Local</span>
                  <span>Sexo Anal</span>
                  <span>Ate R$119,90</span>
                  <span>Em expediente</span>
                  <span>Jovem</span>
                  <span>Com audio</span>
                  <span>Madura</span>
                  <span>A domicilio</span>
                  <span>BDSM</span>
                  <span>Magrinha</span>
                </div>
                <Link to="/modelos" className="service-cta">
                  Buscar por cidade
                </Link>
              </div>

              <div className="city-section">
                <div className="city-icon">♀</div>
                <h3>Acompanhantes Femininas</h3>
                <p>
                  Encontre acompanhantes mulheres para atendimentos individuais,
                  casais, duplas, trios e em grupos.
                </p>
                <div className="city-divider" />
                <p className="city-links">
                  Porto Alegre, Ribeirao Preto, Goiania, Uberlandia, Sao Paulo,
                  Curitiba, Rio de Janeiro, Maceio, Cascavel, Belo Horizonte,
                  Caxias do Sul, Joinville, Belem, Porto Velho e Sete Lagoas.
                </p>
              </div>
            </div>
          </div>

        </div>

        <div className="hero-visual">
          <div className="hero-image">
            <img
              src="/foto/ChatGPT%20Image%209%20de%20jan.%20de%202026,%2015_38_16.png"
              alt="Modelo em destaque"
            />
          </div>
          <div className="hero-panel">
            <h3>Por que models S.A</h3>
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
          Em destaque <span>agora</span>
        </h2>
        <p className="muted" style={{ marginTop: 10 }}>
          Uma vitrine com os perfis mais acessados da semana.
        </p>
        <div className="models-grid">
          {featuredModels.length === 0 ? (
            <Link to="/seja-modelo" className="model-card">
              <img
                className="model-photo"
                src="/foto/ChatGPT Image 9 de jan. de 2026, 15_38_16.png"
                alt="Modelo em destaque"
                loading="lazy"
              />
              <div className="model-info">
                <h3>Modelo em destaque</h3>
                <p>Seja a primeira a criar um perfil premium</p>
              </div>
            </Link>
          ) : (
            featuredModels.map((model) => (
              <Link
                to={`/modelos/${model.id}`}
                key={model.id}
                className="model-card"
              >
                <img
                  className="model-photo"
                  src={model.coverUrl || model.avatarUrl || "/model-placeholder.svg"}
                  alt={model.name}
                  loading="lazy"
                />
                <div className="model-info">
                  <h3>{model.name}</h3>
                  <p>{model.city || "Brasil"}</p>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">
          <span>models</span>
        </h2>
        <div className="cards">
          <div className="card">
            <h4>Galeria premium</h4>
            <p className="muted">
              Portfolios com imagens grandes, destaques e lista completa de
              servicos.
            </p>
          </div>
          <div className="card">
            <h4>Cadastro rapido</h4>
            <p className="muted">
              Formulario direto, valida dados obrigatorios e envia para
              aprovacao.
            </p>
          </div>
          <div className="card">
            <h4>Perfis verificados</h4>
            <p className="muted">
              Publicacao somente apos aprovacao manual e confirmacao de idade.
            </p>
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
