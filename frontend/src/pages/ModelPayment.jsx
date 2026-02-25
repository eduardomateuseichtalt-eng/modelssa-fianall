import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../lib/api";

const PIX_KEY = "faa9aca1-3e24-4437-abcb-ae58ae550979";
const WHATSAPP_NUMBER_E164 = "5549999836511";

const PLANS = [
  {
    id: "basic",
    name: "BASICO",
    priceText: "R$ 29,90/mes",
    benefits: [
      "Perfil publico",
      "Upload de fotos e videos (limite do plano)",
      "Suporte basico",
    ],
  },
  {
    id: "pro",
    name: "PRO",
    priceText: "R$ 59,90/mes",
    benefits: [
      "Tudo do Basico",
      "Mais midia e destaque leve",
      "Prioridade na aprovacao",
      "Insights simples",
    ],
  },
];

function buildWhatsAppLink({ planName, planPriceText, modelId, name, email }) {
  const identifier = `MODELO-${modelId}`;

  const msg =
    `Ola! Quero ativar o PLANO ${planName} (${planPriceText}) no models-club.\n\n` +
    `Meu ID: ${modelId}\n` +
    `Nome: ${name || "-"}\n` +
    `Email: ${email || "-"}\n\n` +
    `Chave Pix usada: ${PIX_KEY}\n` +
    `Identificador no Pix: ${identifier}\n\n` +
    `Vou enviar o comprovante aqui.`;

  return `https://wa.me/${WHATSAPP_NUMBER_E164}?text=${encodeURIComponent(msg)}`;
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  }
}

function loadStoredUser() {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function ModelPayment() {
  const storedUser = useMemo(() => loadStoredUser(), []);
  const [planId, setPlanId] = useState("pro");
  const [toast, setToast] = useState("");
  const [profileData, setProfileData] = useState(null);
  const [profileError, setProfileError] = useState("");
  const toastTimerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    apiFetch("/api/models/self/profile")
      .then((data) => {
        if (cancelled) {
          return;
        }
        setProfileData(data || null);
        setProfileError("");
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        setProfileError(err.message || "Nao foi possivel carregar os dados da conta.");
      });

    return () => {
      cancelled = true;
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const plan = useMemo(
    () => PLANS.find((p) => p.id === planId) || PLANS[0],
    [planId]
  );

  const modelId = profileData?.id || storedUser?.id || "";
  const modelName =
    profileData?.name || storedUser?.displayName || storedUser?.name || "";
  const modelEmail = profileData?.email || storedUser?.email || "";

  const identifier = useMemo(() => {
    const safeId = modelId || "SEU_ID_AQUI";
    return `MODELO-${safeId}`;
  }, [modelId]);

  const whatsappLink = useMemo(() => {
    const safeId = modelId || "SEU_ID_AQUI";
    return buildWhatsAppLink({
      planName: plan.name,
      planPriceText: plan.priceText,
      modelId: safeId,
      name: modelName,
      email: modelEmail,
    });
  }, [plan, modelId, modelName, modelEmail]);

  async function handleCopy(label, value) {
    const ok = await copyToClipboard(value);
    setToast(ok ? `${label} copiado!` : `Nao consegui copiar ${label}. Copie manualmente.`);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => setToast(""), 2500);
  }

  return (
    <div className="page-tight">
      <div className="form-shell" style={{ maxWidth: 860 }}>
        <h2>Ativar plano</h2>
        <p className="muted" style={{ marginBottom: 18 }}>
          Faca o Pix e envie o comprovante no WhatsApp para ativarmos seu plano.
        </p>

        {profileError ? <div className="notice">{profileError}</div> : null}

        {!modelId ? (
          <div
            style={{
              padding: 12,
              border: "1px solid #f5c2c7",
              background: "#f8d7da",
              borderRadius: 10,
              marginBottom: 16,
              color: "#842029",
            }}
          >
            Atencao: <b>modelId</b> nao foi informado. O identificador ficara como{" "}
            <b>MODELO-SEU_ID_AQUI</b>. Conecte esta tela ao ID real da modelo antes de publicar.
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 14,
            marginBottom: 16,
          }}
        >
          {PLANS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPlanId(p.id)}
              style={{
                textAlign: "left",
                padding: 16,
                borderRadius: 14,
                border: p.id === planId ? "2px solid #111" : "1px solid #ddd",
                background: "#fff",
                color: "#111",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, letterSpacing: 0.5 }}>{p.name}</div>
                  <div style={{ opacity: 0.85, marginTop: 4 }}>{p.priceText}</div>
                </div>
                <div style={{ fontSize: 12, opacity: 0.7, alignSelf: "center" }}>
                  {p.id === planId ? "Selecionado" : "Selecionar"}
                </div>
              </div>
              <ul style={{ marginTop: 10, paddingLeft: 18, opacity: 0.9 }}>
                {p.benefits.map((b) => (
                  <li key={b} style={{ marginBottom: 6 }}>
                    {b}
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>

        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: 16,
            background: "#fff",
            color: "#111",
          }}
        >
          <h3 style={{ fontSize: 18, marginBottom: 12 }}>Dados do Pix</h3>

          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontWeight: 700 }}>Chave Pix (copia e cola)</div>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <code style={{ padding: "8px 10px", borderRadius: 10, background: "#f3f4f6" }}>
                  {PIX_KEY}
                </code>
                <button
                  type="button"
                  onClick={() => handleCopy("Chave Pix", PIX_KEY)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Copiar chave
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontWeight: 700 }}>Identificador (coloque na descricao do Pix)</div>
              <div style={{ opacity: 0.8, fontSize: 13 }}>
                Isso ajuda a identificar seu pagamento no extrato.
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <code style={{ padding: "8px 10px", borderRadius: 10, background: "#f3f4f6" }}>
                  {identifier}
                </code>
                <button
                  type="button"
                  onClick={() => handleCopy("Identificador", identifier)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Copiar identificador
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontWeight: 700 }}>Plano selecionado</div>
              <div style={{ opacity: 0.9 }}>
                <b>{plan.name}</b> - {plan.priceText}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
              <a
                href={whatsappLink}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-block",
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: "#111",
                  color: "#fff",
                  textDecoration: "none",
                  fontWeight: 700,
                }}
              >
                Enviar comprovante no WhatsApp
              </a>

              <button
                type="button"
                onClick={() =>
                  handleCopy(
                    "Mensagem do WhatsApp",
                    decodeURIComponent(whatsappLink.split("text=")[1] || "")
                  )
                }
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid #ddd",
                  background: "#fff",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Copiar mensagem do WhatsApp
              </button>
            </div>

            {toast ? (
              <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85 }}>{toast}</div>
            ) : null}

            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.75, lineHeight: 1.4 }}>
              <b>Apos o pagamento:</b> envie o comprovante no WhatsApp. Assim que confirmarmos, seu
              plano sera ativado por 30 dias.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
