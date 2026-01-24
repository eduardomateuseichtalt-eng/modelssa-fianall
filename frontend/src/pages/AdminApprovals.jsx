import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

export default function AdminApprovals() {
  const [pendingModels, setPendingModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [metrics, setMetrics] = useState(null);
  const [metricsError, setMetricsError] = useState("");
  const [pendingMedia, setPendingMedia] = useState([]);
  const [mediaError, setMediaError] = useState("");

  useEffect(() => {
    setLoading(true);
    apiFetch("/api/models/pending")
      .then((data) => setPendingModels(data))
      .catch((err) => setError(err.message || "Erro ao carregar pendentes."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    apiFetch("/api/metrics/summary")
      .then((data) => setMetrics(data))
      .catch((err) =>
        setMetricsError(err.message || "Erro ao carregar metricas.")
      );
  }, []);

  useEffect(() => {
    apiFetch("/api/media/pending")
      .then((data) => setPendingMedia(data))
      .catch((err) => setMediaError(err.message || "Erro ao carregar midias."));
  }, []);

  const handleApprove = async (modelId) => {
    setMessage("");
    setError("");
    try {
      await apiFetch(`/api/models/${modelId}/approve`, { method: "PATCH" });
      setPendingModels((current) =>
        current.filter((model) => model.id !== modelId)
      );
      setMessage("Modelo aprovado com sucesso.");
    } catch (err) {
      setError(err.message || "Erro ao aprovar modelo.");
    }
  };

  const handleReject = async (modelId) => {
    const confirmed = window.confirm(
      "Tem certeza que deseja excluir este cadastro? Esta acao nao pode ser desfeita."
    );
    if (!confirmed) {
      return;
    }
    setMessage("");
    setError("");
    try {
      await apiFetch(`/api/models/${modelId}`, { method: "DELETE" });
      setPendingModels((current) =>
        current.filter((model) => model.id !== modelId)
      );
      setMessage("Cadastro excluido com sucesso.");
    } catch (err) {
      setError(err.message || "Erro ao excluir cadastro.");
    }
  };

  const handleApproveMedia = async (mediaId) => {
    setMessage("");
    setError("");
    try {
      await apiFetch(`/api/media/${mediaId}/approve`, { method: "PATCH" });
      setPendingMedia((current) =>
        current.filter((media) => media.id !== mediaId)
      );
      setMessage("Midia aprovada com sucesso.");
    } catch (err) {
      setError(err.message || "Erro ao aprovar midia.");
    }
  };

  const handleRejectMedia = async (mediaId) => {
    setMessage("");
    setError("");
    try {
      await apiFetch(`/api/media/${mediaId}/reject`, { method: "PATCH" });
      setPendingMedia((current) =>
        current.filter((media) => media.id !== mediaId)
      );
      setMessage("Midia rejeitada.");
    } catch (err) {
      setError(err.message || "Erro ao rejeitar midia.");
    }
  };

  const handlePurgeRejected = async () => {
    const confirmed = window.confirm(
      "Deseja remover midias rejeitadas com mais de 30 dias?"
    );
    if (!confirmed) {
      return;
    }
    setMessage("");
    setError("");
    try {
      const data = await apiFetch("/api/media/purge-rejected?days=30", {
        method: "DELETE",
      });
      if (data.errors && data.errors.length > 0) {
        setError(`Algumas midias nao foram removidas: ${data.errors[0]}`);
      }
      setMessage(`Midias removidas: ${data.deleted}`);
    } catch (err) {
      setError(err.message || "Erro ao limpar midias rejeitadas.");
    }
  };

  return (
    <div className="page">
      <h1 className="section-title">
        Aprovacoes de <span>modelos</span>
      </h1>
      <p className="muted" style={{ marginTop: 10 }}>
        Aprove cadastros pendentes para publica-los na vitrine.
      </p>

      {metricsError && <div className="notice">{metricsError}</div>}
      {metrics ? (
        <>
          <div className="cards" style={{ marginTop: 20 }}>
            <div className="card">
              <h4>Acessos dia</h4>
              <p className="muted">{metrics.day}</p>
            </div>
            <div className="card">
              <h4>Acessos semana</h4>
              <p className="muted">{metrics.week}</p>
            </div>
            <div className="card">
              <h4>Acessos mes</h4>
              <p className="muted">{metrics.month}</p>
            </div>
            <div className="card">
              <h4>Total</h4>
              <p className="muted">{metrics.total}</p>
            </div>
          </div>
          <div
            className="card"
            style={{ marginTop: 20, padding: 20, display: "grid", gap: 12 }}
          >
            <h4>Escala de acessos</h4>
            {(() => {
              const series = [
                { label: "Dia", value: metrics.day },
                { label: "Semana", value: metrics.week },
                { label: "Mes", value: metrics.month },
              ];
              const max = Math.max(...series.map((item) => item.value), 1);
              return series.map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "80px 1fr 60px",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <span className="muted">{item.label}</span>
                  <div
                    style={{
                      height: 10,
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.08)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.round((item.value / max) * 100)}%`,
                        background: "#d31a22",
                      }}
                    />
                  </div>
                  <span className="muted" style={{ textAlign: "right" }}>
                    {item.value}
                  </span>
                </div>
              ));
            })()}
          </div>
        </>
      ) : null}

      {message && <div className="notice">{message}</div>}
      {error && <div className="notice">{error}</div>}

      {mediaError && <div className="notice">{mediaError}</div>}
      {pendingMedia.length > 0 ? (
        <section className="section" style={{ marginTop: 32 }}>
          <h2 className="section-title">
            Midias <span>pendentes</span>
          </h2>
          <button
            className="btn btn-outline"
            type="button"
            style={{ marginTop: 12 }}
            onClick={handlePurgeRejected}
          >
            Limpar rejeitadas (30 dias)
          </button>
          <div className="cards" style={{ marginTop: 16 }}>
            {pendingMedia.map((media) => (
              <div className="card" key={media.id}>
                <h4>{media.model?.name || "Modelo"}</h4>
                {media.type === "VIDEO" ? (
                  <video
                    src={media.url}
                    controls
                    style={{ width: "100%", marginTop: 12 }}
                  />
                ) : (
                  <img
                    src={media.url}
                    alt="Midia enviada"
                    style={{ width: "100%", marginTop: 12, borderRadius: 12 }}
                  />
                )}
                <button
                  className="btn"
                  type="button"
                  style={{ marginTop: 12 }}
                  onClick={() => handleApproveMedia(media.id)}
                >
                  Aprovar midia
                </button>
                <button
                  className="btn btn-outline"
                  type="button"
                  style={{ marginTop: 10 }}
                  onClick={() => handleRejectMedia(media.id)}
                >
                  Rejeitar e excluir
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {loading ? (
        <p style={{ marginTop: 24 }}>Carregando pendentes...</p>
      ) : pendingModels.length === 0 ? (
        <p style={{ marginTop: 24 }} className="muted">
          Nenhum cadastro pendente no momento.
        </p>
      ) : (
        <div className="cards" style={{ marginTop: 24 }}>
          {pendingModels.map((model) => (
            <div className="card" key={model.id}>
              <h4>{model.name}</h4>
              <p className="muted">{model.email}</p>
              <p className="muted">{model.city || "Cidade nao informada"}</p>
              <button
                className="btn"
                type="button"
                onClick={() => handleApprove(model.id)}
              >
                Aprovar
              </button>
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => handleReject(model.id)}
                style={{ marginTop: 10 }}
              >
                Excluir
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
