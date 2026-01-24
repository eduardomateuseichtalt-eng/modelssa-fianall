import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";

const PHONE_KEY = "model-register-phone";
const METHOD_KEY = "model-register-method";

export default function ModelCode() {
  const navigate = useNavigate();
  const [phone] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return sessionStorage.getItem(PHONE_KEY) || "";
  });
  const [method] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return sessionStorage.getItem(METHOD_KEY) || "";
  });
  const [code, setCode] = useState(["", "", "", ""]);
  const [cooldown, setCooldown] = useState(45);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const inputsRef = useRef([]);

  useEffect(() => {
    if (!phone || !method) {
      navigate("/seja-modelo", { replace: true });
    }
  }, [navigate, phone, method]);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }
    const interval = setInterval(() => {
      setCooldown((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleChange = (index, value) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    setCode((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && inputsRef.current[index + 1]) {
      inputsRef.current[index + 1].focus();
    }
  };

  const handleKeyDown = (index, event) => {
    if (event.key === "Backspace" && !code[index] && inputsRef.current[index - 1]) {
      inputsRef.current[index - 1].focus();
    }
  };

  const handlePaste = (event) => {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (!pasted) {
      return;
    }
    setCode(pasted.split("").concat(Array(4).fill("")).slice(0, 4));
    const nextIndex = Math.min(pasted.length, 3);
    if (inputsRef.current[nextIndex]) {
      inputsRef.current[nextIndex].focus();
    }
    event.preventDefault();
  };

  const codeFilled = useMemo(() => code.every((value) => value.length === 1), [code]);

  const handleResend = async () => {
    setError("");
    setInfo("");
    setSending(true);
    try {
      await apiFetch("/api/phone/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, channel: method }),
      });
      setCooldown(45);
      setInfo("Codigo reenviado com sucesso.");
    } catch (err) {
      setError(err.message || "Falha ao reenviar o codigo.");
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    setInfo("");
    setVerifying(true);
    try {
      await apiFetch("/api/phone/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: code.join("") }),
      });
      navigate("/seja-modelo/autenticacao-facial");
    } catch (err) {
      setError(err.message || "Codigo invalido.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="page-tight">
      <div className="form-shell">
        <div className="step-indicator">
          <span>Etapa 3</span>
          <span className="muted">Confirmacao do codigo</span>
        </div>
        <h2>Digite o codigo</h2>
        <p className="muted">
          Enviamos um codigo por {method === "whatsapp" ? "WhatsApp" : "SMS"} para {phone}.
        </p>

        {error ? <div className="notice">{error}</div> : null}
        {info ? <div className="notice">{info}</div> : null}

        <div className="code-grid" onPaste={handlePaste}>
          {code.map((value, index) => (
            <input
              key={`code-${index}`}
              className="code-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={value}
              onChange={(event) => handleChange(index, event.target.value)}
              onKeyDown={(event) => handleKeyDown(index, event)}
              ref={(node) => {
                inputsRef.current[index] = node;
              }}
            />
          ))}
        </div>

        <div className="resend-row">
          <button
            className="btn btn-outline"
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || sending}
          >
            {sending ? "Enviando..." : "Reenviar codigo"}
          </button>
          {cooldown > 0 ? (
            <span className="muted">Disponivel em {cooldown}s</span>
          ) : (
            <span className="muted">Voce pode solicitar um novo codigo.</span>
          )}
        </div>

        <div className="form-actions">
          <button
            className="btn"
            type="button"
            disabled={!codeFilled || verifying}
            onClick={handleVerify}
          >
            {verifying ? "Validando..." : "Confirmar e continuar"}
          </button>
          <button
            className="btn btn-outline"
            type="button"
            onClick={() => navigate("/seja-modelo/validacao")}
          >
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
}
