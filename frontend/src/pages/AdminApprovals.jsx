import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { useNoIndex } from "../lib/useNoIndex";

export default function AdminApprovals() {
  useNoIndex();
  const formatDateBr = (value) => {
    if (!value) {
      return "-";
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return "-";
    }
    return parsed.toLocaleDateString("pt-BR");
  };

  const [pendingModels, setPendingModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [metrics, setMetrics] = useState(null);
  const [metricsError, setMetricsError] = useState("");
  const [pendingMedia, setPendingMedia] = useState([]);
  const [mediaError, setMediaError] = useState("");
  const [faqReports, setFaqReports] = useState([]);
  const [faqReportsLoading, setFaqReportsLoading] = useState(false);
  const [faqReportsError, setFaqReportsError] = useState("");
  const [faqReplyDrafts, setFaqReplyDrafts] = useState({});
  const [faqReplySavingId, setFaqReplySavingId] = useState("");
  const [explicitFlags, setExplicitFlags] = useState({});
  const [searchName, setSearchName] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [deleteLoadingId, setDeleteLoadingId] = useState("");
  const [planUpdateLoadingId, setPlanUpdateLoadingId] = useState("");
  const [planTierDrafts, setPlanTierDrafts] = useState({});
  const [roomListings, setRoomListings] = useState([]);
  const [roomLoading, setRoomLoading] = useState(false);
  const [roomError, setRoomError] = useState("");
  const [roomSaving, setRoomSaving] = useState(false);
  const [roomEditingId, setRoomEditingId] = useState("");
  const [roomForm, setRoomForm] = useState({
    city: "",
    title: "",
    address: "",
    priceText: "",
    contact: "",
    link: "",
    notes: "",
    active: true,
  });

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

  useEffect(() => {
    setFaqReportsLoading(true);
    apiFetch("/api/faq-reports/admin")
      .then((data) => {
        setFaqReports(Array.isArray(data) ? data : []);
        setFaqReplyDrafts(() => {
          const next = {};
          (Array.isArray(data) ? data : []).forEach((report) => {
            next[report.id] = report.adminResponse || "";
          });
          return next;
        });
      })
      .catch((err) =>
        setFaqReportsError(err.message || "Erro ao carregar relatos FAQ.")
      )
      .finally(() => setFaqReportsLoading(false));
  }, []);

  useEffect(() => {
    setRoomLoading(true);
    setRoomError("");
    apiFetch("/api/rooms/admin")
      .then((data) => setRoomListings(Array.isArray(data) ? data : []))
      .catch((err) =>
        setRoomError(err.message || "Erro ao carregar quartos.")
      )
      .finally(() => setRoomLoading(false));
  }, []);

  const handleApprove = async (modelId) => {
    setMessage("");
    setError("");
    try {
      await apiFetch(`/api/models/${modelId}/approve`, { method: "PATCH" });
      setPendingModels((current) =>
        current.filter((model) => model.id !== modelId)
      );
      setMessage("Acompanhante aprovada com sucesso.");
    } catch (err) {
      setError(err.message || "Erro ao aprovar acompanhante.");
    }
  };

  const handleReject = async (modelId) => {
    const target = pendingModels.find((model) => model.id === modelId) || null;
    const targetEmail = String(target?.email || "").trim();
    const confirmed = window.confirm(
      "Tem certeza que deseja excluir este cadastro? Esta acao nao pode ser desfeita."
    );
    if (!confirmed) {
      return;
    }
    setMessage("");
    setError("");
    try {
      if (targetEmail) {
        await apiFetch(
          `/api/models/by-email?email=${encodeURIComponent(targetEmail)}`,
          { method: "DELETE" }
        );
      } else {
        await apiFetch(`/api/models/${modelId}`, { method: "DELETE" });
      }
      setPendingModels((current) =>
        current.filter((model) => model.id !== modelId)
      );
      setSearchResults((current) =>
        current.filter((model) => model.id !== modelId)
      );
      setMessage("Cadastro excluido com sucesso.");
    } catch (err) {
      setError(err.message || "Erro ao excluir cadastro.");
    }
  };

  const handleSearchModelsByName = async () => {
    const name = String(searchName || "").trim();

    if (name.length < 2) {
      setError("Digite pelo menos 2 letras do nome para buscar.");
      return;
    }

    setSearchLoading(true);
    setMessage("");
    setError("");

    try {
      const data = await apiFetch(
        `/api/models/admin/search?name=${encodeURIComponent(name)}`
      );
      const safeResults = Array.isArray(data) ? data : [];
      setSearchResults(safeResults);
      setPlanTierDrafts(() => {
        const next = {};
        safeResults.forEach((model) => {
          next[model.id] = model.planTier === "PRO" ? "PRO" : "BASIC";
        });
        return next;
      });
      if (safeResults.length === 0) {
        setMessage("Nenhuma acompanhante encontrada para esse nome.");
      }
    } catch (err) {
      setError(err.message || "Erro ao buscar acompanhantes por nome.");
    } finally {
      setSearchLoading(false);
    }
  };

  const handleReleasePlan = async (model) => {
    const modelId = String(model?.id || "").trim();
    if (!modelId) {
      setError("Acompanhante invalida para liberar plano.");
      return;
    }
    if (!model.isVerified) {
      setError("A acompanhante precisa estar aprovada para liberar plano.");
      return;
    }

    const planTier =
      String(planTierDrafts[modelId] || model.planTier || "")
        .trim()
        .toUpperCase() === "PRO"
        ? "PRO"
        : "BASIC";

    setPlanUpdateLoadingId(modelId);
    setMessage("");
    setError("");

    try {
      const updated = await apiFetch(`/api/models/${modelId}/plan`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planTier,
          durationDays: 30,
        }),
      });

      setSearchResults((current) =>
        current.map((item) =>
          item.id === modelId
            ? {
                ...item,
                planTier: updated?.planTier || planTier,
                planExpiresAt: updated?.planExpiresAt || null,
              }
            : item
        )
      );
      setPlanTierDrafts((current) => ({
        ...current,
        [modelId]: updated?.planTier || planTier,
      }));
      setMessage(
        `Plano ${updated?.planTier || planTier} liberado por 30 dias para ${model.name}.`
      );
    } catch (err) {
      setError(err.message || "Erro ao liberar plano.");
    } finally {
      setPlanUpdateLoadingId("");
    }
  };

  const resetRoomForm = () => {
    setRoomForm({
      city: "",
      title: "",
      address: "",
      priceText: "",
      contact: "",
      link: "",
      notes: "",
      active: true,
    });
    setRoomEditingId("");
  };

  const handleRoomSubmit = async () => {
    const city = String(roomForm.city || "").trim();
    const title = String(roomForm.title || "").trim();

    if (city.length < 2) {
      setRoomError("Informe a cidade do quarto.");
      return;
    }
    if (title.length < 2) {
      setRoomError("Informe o titulo do quarto.");
      return;
    }

    setRoomSaving(true);
    setRoomError("");
    try {
      const payload = {
        city,
        title,
        address: roomForm.address,
        priceText: roomForm.priceText,
        contact: roomForm.contact,
        link: roomForm.link,
        notes: roomForm.notes,
        active: roomForm.active,
      };

      if (roomEditingId) {
        const updated = await apiFetch(`/api/rooms/admin/${roomEditingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setRoomListings((current) =>
          current.map((room) => (room.id === updated.id ? updated : room))
        );
        setMessage("Quarto atualizado com sucesso.");
      } else {
        const created = await apiFetch("/api/rooms/admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setRoomListings((current) => [created, ...current]);
        setMessage("Quarto cadastrado com sucesso.");
      }

      resetRoomForm();
    } catch (err) {
      setRoomError(err.message || "Erro ao salvar quarto.");
    } finally {
      setRoomSaving(false);
    }
  };

  const handleEditRoom = (room) => {
    setRoomEditingId(room.id);
    setRoomForm({
      city: room.city || "",
      title: room.title || "",
      address: room.address || "",
      priceText: room.priceText || "",
      contact: room.contact || "",
      link: room.link || "",
      notes: room.notes || "",
      active: room.active !== false,
    });
  };

  const handleToggleRoom = async (room) => {
    try {
      const updated = await apiFetch(`/api/rooms/admin/${room.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !room.active }),
      });
      setRoomListings((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
    } catch (err) {
      setRoomError(err.message || "Erro ao atualizar status do quarto.");
    }
  };

  const handleDeleteFoundModel = async (model) => {
    const email = String(model?.email || "").trim().toLowerCase();
    const id = String(model?.id || "").trim();

    if (!email && !id) {
      setError("Acompanhante invalida para exclusao.");
      return;
    }

    const label = model?.name || email || id;
    const confirmed = window.confirm(
      `Confirmar exclusao completa de ${label}? Essa acao remove cadastro, midias e dados relacionados.`
    );
    if (!confirmed) {
      return;
    }

    setDeleteLoadingId(id || email);
    setMessage("");
    setError("");

    try {
      if (email) {
        await apiFetch(`/api/models/by-email?email=${encodeURIComponent(email)}`, {
          method: "DELETE",
        });
      } else {
        await apiFetch(`/api/models/${id}`, { method: "DELETE" });
      }

      setPendingModels((current) =>
        current.filter((item) => {
          const sameId = id && item.id === id;
          const sameEmail =
            email &&
            String(item.email || "").trim().toLowerCase() === email;
          return !sameId && !sameEmail;
        })
      );
      setSearchResults((current) =>
        current.filter((item) => {
          const sameId = id && item.id === id;
          const sameEmail =
            email &&
            String(item.email || "").trim().toLowerCase() === email;
          return !sameId && !sameEmail;
        })
      );
      setMessage("Acompanhante removida com sucesso (cadastro + midias + email).");
    } catch (err) {
      setError(err.message || "Erro ao excluir acompanhante.");
    } finally {
      setDeleteLoadingId("");
    }
  };

  const handleApproveMedia = async (mediaId) => {
    setMessage("");
    setError("");
    try {
      const isExplicit = Boolean(explicitFlags[mediaId]);
      await apiFetch(`/api/media/${mediaId}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ explicit: isExplicit }),
      });
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

  const handleRespondFaqReport = async (reportId) => {
    const adminResponse = String(faqReplyDrafts[reportId] || "").trim();
    if (!adminResponse) {
      setError("Digite uma resposta antes de salvar.");
      return;
    }

    setMessage("");
    setError("");
    setFaqReplySavingId(reportId);
    try {
      const updated = await apiFetch(`/api/faq-reports/admin/${reportId}/respond`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminResponse }),
      });

      setFaqReports((current) =>
        current.map((report) =>
          report.id === reportId ? { ...report, ...updated } : report
        )
      );
      setFaqReplyDrafts((current) => ({
        ...current,
        [reportId]: updated.adminResponse || adminResponse,
      }));
      setMessage("Resposta do relato salva com sucesso.");
    } catch (err) {
      setError(err.message || "Erro ao responder relato.");
    } finally {
      setFaqReplySavingId("");
    }
  };

  return (
    <div className="page">
      <h1 className="section-title">
        Aprovacoes de <span>acompanhantes</span>
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
          <div className="card" style={{ marginTop: 12 }}>
            <h4>Visualizacoes totais desde 25/02/2026</h4>
            <p className="muted">148.783 visualizacoes</p>
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
      {faqReportsError && <div className="notice">{faqReportsError}</div>}

      <section className="section" style={{ marginTop: 24 }}>
        <h2 className="section-title">
          Gestao de <span>acompanhantes</span>
        </h2>
        <p className="muted" style={{ marginTop: 10 }}>
          Busque por nome para excluir cadastros ou liberar renovacao manual de plano por 30 dias apos pagamento.
        </p>

        <div className="card" style={{ marginTop: 16 }}>
          <div className="form-grid">
            <input
              className="input"
              type="text"
              placeholder="Nome da acompanhante para buscar"
              value={searchName}
              onChange={(event) => setSearchName(event.target.value)}
            />
            <div className="form-actions">
              <button
                className="btn btn-outline"
                type="button"
                onClick={handleSearchModelsByName}
                disabled={searchLoading}
              >
                {searchLoading ? "Buscando..." : "Buscar por nome"}
              </button>
            </div>
          </div>

          {searchResults.length > 0 ? (
            <div className="cards" style={{ marginTop: 16 }}>
              {searchResults.map((model) => (
                <div className="card" key={model.id}>
                  <h4>{model.name}</h4>
                  <p className="muted">{model.email}</p>
                  <p className="muted">{model.city || "Cidade nao informada"}</p>
                  <p className="muted">
                    Status: {model.isVerified ? "Aprovada" : "Pendente"}
                  </p>
                  <p className="muted">
                    Plano: {model.planTier === "PRO" ? "PRO" : "BASICO"}
                  </p>
                  <p className="muted">
                    Gratuidade ate: {formatDateBr(model.trialEndsAt)}
                  </p>
                  <p className="muted">
                    Plano pago ate: {formatDateBr(model.planExpiresAt)}
                  </p>
                  <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                    <select
                      className="input"
                      value={planTierDrafts[model.id] || (model.planTier === "PRO" ? "PRO" : "BASIC")}
                      onChange={(event) =>
                        setPlanTierDrafts((current) => ({
                          ...current,
                          [model.id]: event.target.value,
                        }))
                      }
                    >
                      <option value="BASIC">BASICO</option>
                      <option value="PRO">PRO</option>
                    </select>
                    <button
                      className="btn"
                      type="button"
                      onClick={() => handleReleasePlan(model)}
                      disabled={!model.isVerified || planUpdateLoadingId === model.id}
                    >
                      {planUpdateLoadingId === model.id
                        ? "Liberando..."
                        : "Liberar plano por 30 dias"}
                    </button>
                  </div>
                  <button
                    className="btn btn-outline"
                    type="button"
                    onClick={() => handleDeleteFoundModel(model)}
                    disabled={deleteLoadingId === model.id}
                    style={{ marginTop: 10 }}
                  >
                    {deleteLoadingId === model.id ? "Excluindo..." : "Excluir acompanhante"}
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="section" style={{ marginTop: 32 }}>
        <h2 className="section-title">
          Relatos do <span>FAQ</span>
        </h2>
        <p className="muted" style={{ marginTop: 10 }}>
          Relatos enviados pela area publica de FAQ para analise e resposta.
        </p>

        {faqReportsLoading ? (
          <p style={{ marginTop: 16 }}>Carregando relatos...</p>
        ) : faqReports.length === 0 ? (
          <p className="muted" style={{ marginTop: 16 }}>
            Nenhum relato recebido ainda.
          </p>
        ) : (
          <div className="cards" style={{ marginTop: 16 }}>
            {faqReports.map((report) => (
              <div className="card" key={report.id}>
                <h4>{report.status === "ANSWERED" ? "Respondido" : "Pendente"}</h4>
                <p className="muted" style={{ marginTop: 6 }}>
                  {new Date(report.createdAt).toLocaleString("pt-BR")}
                </p>
                <p className="muted" style={{ marginTop: 6 }}>
                  Origem: {report.origin === "MODEL" ? "Area da acompanhante" : "FAQ publico"}
                </p>
                {report.category ? (
                  <p className="muted" style={{ marginTop: 6 }}>
                    Categoria: {String(report.category).replace(/_/g, " ")}
                  </p>
                ) : null}
                {report.modelName ? (
                  <p className="muted" style={{ marginTop: 6 }}>
                    Acompanhante: {report.modelName}
                    {report.modelEmail ? ` (${report.modelEmail})` : ""}
                  </p>
                ) : null}
                {report.contact ? (
                  <p className="muted" style={{ marginTop: 6 }}>
                    Contato: {report.contact}
                  </p>
                ) : null}
                <p style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>{report.message}</p>

                <textarea
                  className="textarea"
                  rows={4}
                  style={{ marginTop: 12 }}
                  placeholder="Escreva sua resposta"
                  value={faqReplyDrafts[report.id] || ""}
                  onChange={(event) =>
                    setFaqReplyDrafts((current) => ({
                      ...current,
                      [report.id]: event.target.value,
                    }))
                  }
                />

                <button
                  className="btn"
                  type="button"
                  style={{ marginTop: 12 }}
                  onClick={() => handleRespondFaqReport(report.id)}
                  disabled={faqReplySavingId === report.id}
                >
                  {faqReplySavingId === report.id ? "Salvando..." : "Salvar resposta"}
                </button>

                {report.respondedAt ? (
                  <p className="muted" style={{ marginTop: 10 }}>
                    Respondido em {new Date(report.respondedAt).toLocaleString("pt-BR")}
                    {report.respondedBy ? ` por ${report.respondedBy}` : ""}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="section" style={{ marginTop: 32 }}>
        <h2 className="section-title">
          Quartos para <span>locacao</span>
        </h2>
        <p className="muted" style={{ marginTop: 10 }}>
          Cadastre quartos por cidade para aparecer na area da acompanhante.
        </p>
        {roomError ? <div className="notice">{roomError}</div> : null}
        <div className="card" style={{ marginTop: 16 }}>
          <div className="form-grid">
            <input
              className="input"
              type="text"
              placeholder="Cidade"
              value={roomForm.city}
              onChange={(event) =>
                setRoomForm((current) => ({ ...current, city: event.target.value }))
              }
            />
            <input
              className="input"
              type="text"
              placeholder="Titulo do quarto"
              value={roomForm.title}
              onChange={(event) =>
                setRoomForm((current) => ({ ...current, title: event.target.value }))
              }
            />
            <input
              className="input"
              type="text"
              placeholder="Endereco (opcional)"
              value={roomForm.address}
              onChange={(event) =>
                setRoomForm((current) => ({ ...current, address: event.target.value }))
              }
            />
            <input
              className="input"
              type="text"
              placeholder="Preco/diaria (ex: R$ 120)"
              value={roomForm.priceText}
              onChange={(event) =>
                setRoomForm((current) => ({ ...current, priceText: event.target.value }))
              }
            />
            <input
              className="input"
              type="text"
              placeholder="Contato (WhatsApp/telefone)"
              value={roomForm.contact}
              onChange={(event) =>
                setRoomForm((current) => ({ ...current, contact: event.target.value }))
              }
            />
            <input
              className="input"
              type="text"
              placeholder="Link externo (opcional)"
              value={roomForm.link}
              onChange={(event) =>
                setRoomForm((current) => ({ ...current, link: event.target.value }))
              }
            />
            <textarea
              className="textarea"
              rows={3}
              placeholder="Observacoes"
              value={roomForm.notes}
              onChange={(event) =>
                setRoomForm((current) => ({ ...current, notes: event.target.value }))
              }
            />
            <label className="model-register-check" style={{ alignItems: "center" }}>
              <input
                type="checkbox"
                checked={roomForm.active}
                onChange={(event) =>
                  setRoomForm((current) => ({
                    ...current,
                    active: event.target.checked,
                  }))
                }
              />
              <span>Ativo (aparece para acompanhantes)</span>
            </label>
          </div>
          <div className="form-actions" style={{ marginTop: 12 }}>
            <button
              className="btn"
              type="button"
              onClick={handleRoomSubmit}
              disabled={roomSaving}
            >
              {roomSaving
                ? "Salvando..."
                : roomEditingId
                ? "Atualizar quarto"
                : "Cadastrar quarto"}
            </button>
            {roomEditingId ? (
              <button
                className="btn btn-outline"
                type="button"
                onClick={resetRoomForm}
                disabled={roomSaving}
              >
                Cancelar edicao
              </button>
            ) : null}
          </div>
        </div>
        {roomLoading ? (
          <p style={{ marginTop: 16 }}>Carregando quartos...</p>
        ) : roomListings.length === 0 ? (
          <p className="muted" style={{ marginTop: 16 }}>
            Nenhum quarto cadastrado ainda.
          </p>
        ) : (
          <div className="cards" style={{ marginTop: 16 }}>
            {roomListings.map((room) => (
              <div className="card" key={room.id}>
                <h4>{room.title}</h4>
                <p className="muted">Cidade: {room.city}</p>
                {room.address ? <p className="muted">{room.address}</p> : null}
                {room.priceText ? (
                  <p className="muted">Preco: {room.priceText}</p>
                ) : null}
                {room.contact ? (
                  <p className="muted">Contato: {room.contact}</p>
                ) : null}
                {room.link ? (
                  <p className="muted">Link: {room.link}</p>
                ) : null}
                {room.notes ? <p className="muted">{room.notes}</p> : null}
                <div className="form-actions" style={{ marginTop: 10 }}>
                  <button
                    className="btn btn-outline"
                    type="button"
                    onClick={() => handleEditRoom(room)}
                  >
                    Editar
                  </button>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => handleToggleRoom(room)}
                  >
                    {room.active ? "Desativar" : "Ativar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

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
                <h4>{media.model?.name || "Acompanhante"}</h4>
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
                <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
                  <input
                    type="checkbox"
                    checked={Boolean(explicitFlags[media.id])}
                    onChange={(event) =>
                      setExplicitFlags((current) => ({
                        ...current,
                        [media.id]: event.target.checked,
                      }))
                    }
                  />
                  <span className="muted">Conteudo explicito</span>
                </label>
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
