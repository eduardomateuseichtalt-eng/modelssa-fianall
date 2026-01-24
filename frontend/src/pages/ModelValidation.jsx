import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";

const STORAGE_KEY = "model-register-phone";
const METHOD_KEY = "model-register-method";

export default function ModelValidation() {
  const navigate = useNavigate();
  const [phone] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return sessionStorage.getItem(STORAGE_KEY) || "";
  });
  const [method, setMethod] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return sessionStorage.getItem(METHOD_KEY) || "";
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!phone) {
      navigate("/seja-modelo", { replace: true });
    }
  }, [navigate, phone]);

  const handleChoose = (nextMethod) => {
    setMethod(nextMethod);
    sessionStorage.setItem(METHOD_KEY, nextMethod);
  };

  const handleContinue = async () => {
    setError("");
    setLoading(true);
    try {
      await apiFetch("/api/phone/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, channel: method }),
      });
      navigate("/seja-modelo/codigo");
    } catch (err) {
      setError(err.message || "Falha ao enviar o codigo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-tight">
      <div className="form-shell">
        <div className="step-indicator">
          <span>Etapa 2</span>
          <span className="muted">Metodo de validacao</span>
        </div>
        <h2>Escolha a validacao</h2>
        <p className="muted">
          Usaremos o numero informado para enviar o codigo de confirmacao.
        </p>
        <div className="phone-pill">Numero: {phone}</div>

        {error ? <div className="notice">{error}</div> : null}

        <div className="verify-options">
          <div className="verify-option">
            <div>
              <strong>WhatsApp</strong>
              <p className="muted">Receba o codigo pelo aplicativo.</p>
            </div>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => handleChoose("whatsapp")}
            >
              Escolher
            </button>
          </div>
          <div className="verify-option">
            <div>
              <strong>SMS</strong>
              <p className="muted">Receba o codigo por mensagem.</p>
            </div>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => handleChoose("sms")}
            >
              Escolher
            </button>
          </div>
        </div>

        {method ? (
          <div className="notice">
            Metodo selecionado: {method === "whatsapp" ? "WhatsApp" : "SMS"}.
            Continue para concluir o cadastro.
          </div>
        ) : null}

        <div className="form-actions">
          <button
            className="btn"
            type="button"
            disabled={!method || loading}
            onClick={handleContinue}
          >
            {loading ? "Enviando..." : "Continuar cadastro"}
          </button>
          <button
            className="btn btn-outline"
            type="button"
            onClick={() => navigate("/seja-modelo")}
          >
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
}
