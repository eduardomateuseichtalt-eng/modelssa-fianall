import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../lib/api";

export default function Shots() {
  const [shots, setShots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [cityQuery, setCityQuery] = useState("");
  const [showVideos, setShowVideos] = useState(true);
  const [showPhotos, setShowPhotos] = useState(true);
  const [activeGroup, setActiveGroup] = useState("Mulheres");
  const [reelsOpen, setReelsOpen] = useState(false);
  const [reelsIndex, setReelsIndex] = useState(0);
  const reelsRef = useRef(null);

  const loadShots = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch("/api/shots");
      setShots(data);
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

  const filteredShots = useMemo(() => {
    return shots.filter((shot) => {
      const matchesCity = cityQuery.trim()
        ? (shot.model?.city || "")
            .toLowerCase()
            .includes(cityQuery.trim().toLowerCase())
        : true;
      const isVideo = shot.type === "VIDEO";
      const matchesType = (showVideos && isVideo) || (showPhotos && !isVideo);
      return matchesCity && matchesType;
    });
  }, [shots, cityQuery, showVideos, showPhotos]);

  const openReels = (index) => {
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
    } catch (err) {
      setActionMessage(err.message || "Nao foi possivel atualizar a curtida.");
    }
  };

  return (
    <div className="page shots-page">
      <div className="shots-header">
        <div className="shots-breadcrumb">
          <span>Pagina Inicial</span>
          <span>›</span>
          <span>Models Shots</span>
        </div>
        <h1 className="shots-title">
          Models Shots em <span>{cityQuery || "sua cidade"}</span>
        </h1>
        <div className="shots-search">
          <input
            className="input"
            placeholder="Digite sua cidade"
            value={cityQuery}
            onChange={(event) => setCityQuery(event.target.value)}
          />
          <span className="shots-search-icon">⌕</span>
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
        <p className="muted" style={{ marginTop: 24 }}>
          Nenhum shot encontrado para os filtros atuais.
        </p>
      ) : (
        <div className="shots-list">
          {filteredShots.map((shot, index) => (
            <button
              key={shot.id}
              type="button"
              className="shots-card"
              onClick={() => openReels(index)}
            >
              <div className="shots-card-thumb">
                {shot.type === "IMAGE" && shot.imageUrl ? (
                  <img src={shot.imageUrl} alt={`Shot de ${shot.model?.name || "Modelo"}`} />
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
                <h3>{shot.model?.name || "Modelo"}</h3>
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
            {filteredShots.map((shot, index) => (
              <div
                key={`reel-${shot.id}`}
                className="reels-item"
                data-reel-index={index}
              >
                {shot.type === "IMAGE" && shot.imageUrl ? (
                  <img src={shot.imageUrl} alt={`Shot de ${shot.model?.name || "Modelo"}`} />
                ) : shot.videoUrl ? (
                  <video
                    src={shot.videoUrl}
                    playsInline
                    controls
                    preload="metadata"
                  />
                ) : (
                  <div className="shot-placeholder">Shot indisponivel</div>
                )}
                <div className="reels-meta">
                  <div>
                    <strong>{shot.model?.name || "Modelo"}</strong>
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
