import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../lib/api";

function normalizeCityText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export default function Shots() {
  const [shots, setShots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [cityQuery, setCityQuery] = useState("");
  const [searchCity, setSearchCity] = useState("");
  const [showVideos, setShowVideos] = useState(true);
  const [showPhotos, setShowPhotos] = useState(true);
  const [activeGroup, setActiveGroup] = useState("Mulheres");
  const [nearbyShots, setNearbyShots] = useState([]);
  const [nearbyCities, setNearbyCities] = useState([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState("");
  const [reelsOpen, setReelsOpen] = useState(false);
  const [reelsIndex, setReelsIndex] = useState(0);
  const [reelsSource, setReelsSource] = useState("filtered");
  const reelsRef = useRef(null);
  const nearbyCacheRef = useRef(new Map());

  const loadShots = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch("/api/shots");
      setShots(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Nao foi possivel carregar os shots.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShots();
  }, []);

  useEffect(() => {
    if (!reelsOpen) {
      document.body.style.overflow = "";
      return;
    }
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [reelsOpen]);

  const matchesTypeFilter = (shot) => {
    const isVideo = shot.type === "VIDEO";
    return (showVideos && isVideo) || (showPhotos && !isVideo);
  };

  const filteredShots = useMemo(() => {
    return shots.filter((shot) => {
      const matchesCity = searchCity.trim()
        ? (shot.model?.city || "")
            .toLowerCase()
            .includes(searchCity.trim().toLowerCase())
        : true;
      return matchesCity && matchesTypeFilter(shot);
    });
  }, [shots, searchCity, showVideos, showPhotos]);

  const nearbyFilteredShots = useMemo(
    () => nearbyShots.filter(matchesTypeFilter),
    [nearbyShots, showVideos, showPhotos]
  );

  const reelsShots = reelsSource === "nearby" ? nearbyFilteredShots : filteredShots;

  useEffect(() => {
    const targetCity = searchCity.trim();
    const shouldSearchNearby =
      targetCity.length > 0 &&
      filteredShots.length === 0 &&
      (showVideos || showPhotos);

    if (!shouldSearchNearby) {
      setNearbyLoading(false);
      setNearbyError("");
      setNearbyShots([]);
      setNearbyCities([]);
      return;
    }

    const cacheKey = `${normalizeCityText(targetCity)}|50`;
    const cached = nearbyCacheRef.current.get(cacheKey);
    if (cached) {
      setNearbyError("");
      setNearbyShots(Array.isArray(cached.items) ? cached.items : []);
      setNearbyCities(Array.isArray(cached.nearbyCities) ? cached.nearbyCities : []);
      return;
    }

    let canceled = false;
    const loadNearbyShots = async () => {
      setNearbyLoading(true);
      setNearbyError("");
      try {
        const data = await apiFetch(
          `/api/shots/nearby?city=${encodeURIComponent(targetCity)}&radiusKm=50`
        );
        if (canceled) {
          return;
        }

        const items = Array.isArray(data?.items) ? data.items : [];
        const nearbyCitiesList = Array.isArray(data?.nearbyCities)
          ? data.nearbyCities
          : [];

        nearbyCacheRef.current.set(cacheKey, {
          items,
          nearbyCities: nearbyCitiesList,
        });

        setNearbyShots(items);
        setNearbyCities(nearbyCitiesList);
      } catch (err) {
        if (canceled) {
          return;
        }
        setNearbyShots([]);
        setNearbyCities([]);
        setNearbyError(
          err.message || "Nao foi possivel carregar shots de cidades proximas."
        );
      } finally {
        if (!canceled) {
          setNearbyLoading(false);
        }
      }
    };

    loadNearbyShots();
    return () => {
      canceled = true;
    };
  }, [searchCity, filteredShots.length, showVideos, showPhotos]);

  const handleSearch = () => {
    setSearchCity(cityQuery.trim());
  };

  const openReels = (source, index) => {
    setReelsSource(source);
    setReelsIndex(index);
    setReelsOpen(true);
    requestAnimationFrame(() => {
      const container = reelsRef.current;
      if (!container) {
        return;
      }
      const target = container.querySelector(`[data-reel-index="${index}"]`);
      if (target && target.scrollIntoView) {
        target.scrollIntoView({ block: "start" });
      }
    });
  };

  const toggleLike = async (shotId, likedByUser) => {
    setActionMessage("");
    const token = localStorage.getItem("accessToken");

    if (!token) {
      try {
        const response = await apiFetch(`/api/shots/${shotId}/like-guest`, {
          method: "POST",
        });

        setShots((prev) =>
          prev.map((shot) =>
            shot.id === shotId
              ? {
                  ...shot,
                  likeCount: response.likeCount,
                }
              : shot
          )
        );
        setNearbyShots((prev) =>
          prev.map((shot) =>
            shot.id === shotId
              ? {
                  ...shot,
                  likeCount: response.likeCount,
                }
              : shot
          )
        );
      } catch (err) {
        setActionMessage(err.message || "Nao foi possivel curtir o shot.");
      }
      return;
    }

    try {
      const response = await apiFetch(`/api/shots/${shotId}/like`, {
        method: likedByUser ? "DELETE" : "POST",
      });

      setShots((prev) =>
        prev.map((shot) =>
          shot.id === shotId
            ? {
                ...shot,
                likedByUser: response.liked,
                likeCount: response.likeCount,
              }
            : shot
        )
      );
      setNearbyShots((prev) =>
        prev.map((shot) =>
          shot.id === shotId
            ? {
                ...shot,
                likedByUser: response.liked,
                likeCount: response.likeCount,
              }
            : shot
        )
      );
    } catch (err) {
      setActionMessage(err.message || "Nao foi possivel atualizar a curtida.");
    }
  };

  return (
    <div className="page shots-page">
      <div className="shots-header">
        <div className="shots-breadcrumb">
          <span>Pagina Inicial</span>
          <span>&gt;</span>
          <span>Models Shots</span>
        </div>
        <h1 className="shots-title">
          Models Shots em <span>{searchCity || "sua cidade"}</span>
        </h1>
        <div className="shots-search">
          <input
            className="input"
            placeholder="Digite sua cidade"
            value={cityQuery}
            onChange={(event) => setCityQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleSearch();
              }
            }}
          />
          <button type="button" className="shots-search-btn" onClick={handleSearch}>
            Buscar
          </button>
        </div>
        <div className="shots-filters">
          {["Mulheres", "Homens", "Trans"].map((label) => (
            <button
              key={label}
              type="button"
              className={`shots-chip ${activeGroup === label ? "active" : ""}`}
              onClick={() => setActiveGroup(label)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="shots-toggle-row">
          <button
            type="button"
            className={`shots-toggle ${showVideos ? "active" : ""}`}
            onClick={() => setShowVideos((prev) => !prev)}
          >
            Videos
          </button>
          <button
            type="button"
            className={`shots-toggle ${showPhotos ? "active" : ""}`}
            onClick={() => setShowPhotos((prev) => !prev)}
          >
            Fotos
          </button>
        </div>
      </div>

      {actionMessage && <p className="notice">{actionMessage}</p>}

      {loading ? (
        <p style={{ marginTop: 24 }}>Carregando shots...</p>
      ) : error ? (
        <p className="notice">{error}</p>
      ) : filteredShots.length === 0 ? (
        <>
          <p className="muted" style={{ marginTop: 24 }}>
            Nenhum shot encontrado para os filtros atuais.
          </p>

          {nearbyLoading ? (
            <p className="muted" style={{ marginTop: 12 }}>
              Buscando shots em cidades proximas (50 km)...
            </p>
          ) : null}

          {nearbyError ? (
            <p className="notice" style={{ marginTop: 12 }}>
              {nearbyError}
            </p>
          ) : null}

          {!nearbyLoading && !nearbyError && nearbyFilteredShots.length > 0 ? (
            <section className="shots-nearby">
              <p className="muted" style={{ marginTop: 12 }}>
                Mostrando shots de cidades proximas em ate 50 km.
              </p>
              {nearbyCities.length > 0 ? (
                <p className="muted shots-nearby-cities">
                  Cidades encontradas:{" "}
                  {nearbyCities
                    .slice(0, 6)
                    .map((city) => `${city.city} (${city.distanceKm} km)`)
                    .join(", ")}
                </p>
              ) : null}
              <div className="shots-list">
                {nearbyFilteredShots.map((shot, index) => (
                  <button
                    key={`nearby-${shot.id}`}
                    type="button"
                    className="shots-card"
                    onClick={() => openReels("nearby", index)}
                  >
                    <div className="shots-card-thumb">
                      {shot.type === "IMAGE" && shot.imageUrl ? (
                        <img
                          src={shot.imageUrl}
                          alt={`Shot de ${shot.model?.name || "Acompanhante"}`}
                        />
                      ) : shot.videoUrl ? (
                        <video
                          src={shot.videoUrl}
                          muted
                          loop
                          playsInline
                          preload="metadata"
                        />
                      ) : (
                        <div className="shot-placeholder">Shot indisponivel</div>
                      )}
                    </div>
                    <div className="shots-card-meta">
                      <h3>{shot.model?.name || "Acompanhante"}</h3>
                      <p>{shot.model?.city || "Brasil"}</p>
                      <span>
                        {shot.likeCount} curtidas
                        {typeof shot.nearbyDistanceKm === "number"
                          ? ` - ${shot.nearbyDistanceKm} km`
                          : ""}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {!nearbyLoading &&
          !nearbyError &&
          searchCity.trim() &&
          nearbyFilteredShots.length === 0 ? (
            <p className="muted" style={{ marginTop: 12 }}>
              Tambem nao encontramos shots em cidades proximas (50 km).
            </p>
          ) : null}
        </>
      ) : (
        <div className="shots-list">
          {filteredShots.map((shot, index) => (
            <button
              key={shot.id}
              type="button"
              className="shots-card"
              onClick={() => openReels("filtered", index)}
            >
              <div className="shots-card-thumb">
                {shot.type === "IMAGE" && shot.imageUrl ? (
                  <img
                    src={shot.imageUrl}
                    alt={`Shot de ${shot.model?.name || "Acompanhante"}`}
                  />
                ) : shot.videoUrl ? (
                  <video src={shot.videoUrl} muted loop playsInline preload="metadata" />
                ) : (
                  <div className="shot-placeholder">Shot indisponivel</div>
                )}
              </div>
              <div className="shots-card-meta">
                <h3>{shot.model?.name || "Acompanhante"}</h3>
                <p>{shot.model?.city || "Brasil"}</p>
                <span>{shot.likeCount} curtidas</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {reelsOpen ? (
        <div className="reels-overlay">
          <button
            type="button"
            className="reels-close"
            onClick={() => setReelsOpen(false)}
          >
            Fechar
          </button>
          <div className="reels-container" ref={reelsRef}>
            {reelsShots.map((shot, index) => (
              <div
                key={`reel-${shot.id}`}
                className="reels-item"
                data-reel-index={index}
              >
                {shot.type === "IMAGE" && shot.imageUrl ? (
                  <img
                    src={shot.imageUrl}
                    alt={`Shot de ${shot.model?.name || "Acompanhante"}`}
                  />
                ) : shot.videoUrl ? (
                  <video src={shot.videoUrl} playsInline controls preload="metadata" />
                ) : (
                  <div className="shot-placeholder">Shot indisponivel</div>
                )}
                <div className="reels-meta">
                  <div>
                    <strong>{shot.model?.name || "Acompanhante"}</strong>
                    <span>{shot.model?.city || "Brasil"}</span>
                  </div>
                  <button
                    className={`btn ${shot.likedByUser ? "" : "btn-outline"}`}
                    type="button"
                    onClick={() => toggleLike(shot.id, shot.likedByUser)}
                  >
                    {shot.likedByUser ? "Curtido" : "Curtir"}
                  </button>
                  <span>{shot.likeCount} curtidas</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
