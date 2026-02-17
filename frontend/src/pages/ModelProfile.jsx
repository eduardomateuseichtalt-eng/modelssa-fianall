import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { apiFetch } from "../lib/api";

export default function ModelProfile() {
  const { id } = useParams();
  const [model, setModel] = useState(null);
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactText, setContactText] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactError, setContactError] = useState("");
  const [contactLoading, setContactLoading] = useState(false);
  const contactSectionRef = useRef(null);

  useEffect(() => {
    apiFetch(`/api/models/${id}`)
      .then((data) => setModel(data))
      .catch(() => setModel(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    apiFetch(`/api/media/model/${id}`)
      .then((data) => setMedia(data))
      .catch(() => setMedia([]));
  }, [id]);

  if (loading) {
    return (
      <div className="page">
        <p>Carregando perfil...</p>
      </div>
    );
  }

  if (!model) {
    return (
      <div className="page">
        <p>Modelo nao encontrada.</p>
        <div className="form-actions">
          <Link to="/modelos" className="btn btn-outline">
            Voltar para modelos
          </Link>
        </div>
      </div>
    );
  }

  const wa = String(model.whatsapp || "").replace(/\D/g, "");
  const waMsg = encodeURIComponent(
    `Olá ${model.name}, vi seu perfil no Model's S.A e gostaria de falar com você.`
  );
  const waWebUrl = wa ? `https://wa.me/${wa}?text=${waMsg}` : "";
  const waAppUrl = wa ? `whatsapp://send?phone=${wa}&text=${waMsg}` : "";

  const handleOpenWhatsApp = (event) => {
    event.preventDefault();

    if (!waAppUrl || !waWebUrl) {
      return;
    }

    const fallbackTimer = window.setTimeout(() => {
      window.location.href = waWebUrl;
    }, 1200);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        window.clearTimeout(fallbackTimer);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange, {
      once: true,
    });

    window.location.href = waAppUrl;
  };

  return (
    <div className="page">
      <div className="profile">
        <div className="profile-cover">
          <img
            className="model-photo"
            src={model.coverUrl || model.avatarUrl || "/model-placeholder.svg"}
            alt={model.name}
          />
        </div>

        <div className="profile-card">
          <p className="pill">{model.city || "Brasil"}</p>
          <h1 style={{ marginTop: 12 }}>{model.name}</h1>
          <p className="muted" style={{ marginTop: 10 }}>
            {model.bio || "Perfil exclusivo. Entre em contato para mais detalhes."}
          </p>

          <div className="profile-stats">
            <div className="stat">
              <strong>{model.height || "--"}</strong>
              <span>Altura</span>
            </div>
            <div className="stat">
              <strong>{model.weight || "--"}</strong>
              <span>Peso</span>
            </div>
            <div className="stat">
              <strong>{model.priceHour || "--"}</strong>
              <span>Por hora</span>
            </div>
          </div>

          <div className="divider" />

          {media.length > 0 ? (
            <>
              <p className="muted" style={{ marginBottom: 12 }}>
                Midias aprovadas
              </p>
              <div className="models-grid">
                {media.map((item) =>
                  item.type === "VIDEO" ? (
                    <video
                      key={item.id}
                      src={item.url}
                      controls
                      style={{ width: "100%", borderRadius: 12 }}
                    />
                  ) : (
                    <img
                      key={item.id}
                      src={item.url}
                      alt="Midia da modelo"
                      style={{ width: "100%", borderRadius: 12 }}
                    />
                  )
                )}
              </div>
              <div className="divider" />
            </>
          ) : null}

          <p className="muted" style={{ marginBottom: 12 }}>
            Contato e redes
          </p>
          <div className="tag-list">
            <span className="pill">{model.instagram || "@model"}</span>
            <span className="pill">{model.whatsapp || "WhatsApp"}</span>
          </div>

          <div className="form-actions">
            <button
              className="btn"
              type="button"
              onClick={() =>
                contactSectionRef.current?.scrollIntoView({
                  behavior: "smooth",
                })
              }
            >
              Entrar em contato
            </button>
            {wa && wa.length >= 10 && (
              <a
                className="btn btn-outline"
                href={waWebUrl}
                onClick={handleOpenWhatsApp}
                target="_blank"
                rel="noopener noreferrer"
              >
                Falar no WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>

      <div
        className="section"
        style={{ marginTop: 32 }}
        ref={contactSectionRef}
      >
        <h2 className="section-title">Entrar em contato direto</h2>
        <p className="muted" style={{ marginTop: 10 }}>
          Envie uma mensagem para a modelo. As mensagens nao ficam salvas.
        </p>

        {contactMessage && <div className="notice">{contactMessage}</div>}
        {contactError && <div className="notice">{contactError}</div>}

        <div className="form-grid" style={{ marginTop: 16 }}>
          <input
            className="input"
            placeholder="Seu nome (opcional)"
            value={contactName}
            onChange={(event) => setContactName(event.target.value)}
          />
          <input
            className="input"
            placeholder="WhatsApp (opcional)"
            value={contactPhone}
            onChange={(event) => setContactPhone(event.target.value)}
          />
          <textarea
            className="textarea"
            placeholder="Escreva sua mensagem"
            value={contactText}
            onChange={(event) => setContactText(event.target.value)}
            rows={4}
          />
          <div className="form-actions">
            <button
              className="btn"
              type="button"
              disabled={contactLoading || contactText.trim().length === 0}
              onClick={async () => {
                setContactError("");
                setContactMessage("");
                const text = contactText.trim();
                if (!text) {
                  setContactError("Digite uma mensagem para enviar.");
                  return;
                }
                setContactLoading(true);
                try {
                  await apiFetch(`/api/messages/${id}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      text,
                      fromName: contactName.trim(),
                      fromPhone: contactPhone.trim(),
                    }),
                  });
                  setContactMessage("Mensagem enviada com sucesso.");
                  setContactText("");
                } catch (err) {
                  setContactError(err.message || "Erro ao enviar mensagem.");
                } finally {
                  setContactLoading(false);
                }
              }}
            >
              {contactLoading ? "Enviando..." : "Enviar mensagem"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

