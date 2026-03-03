import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";

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

function formatDateBr(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleDateString("pt-BR");
}

export default function ModelLogin() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [recoverEmail, setRecoverEmail] = useState("");
  const [recoverCode, setRecoverCode] = useState("");
  const [recoverPassword, setRecoverPassword] = useState("");
  const [recoverConfirm, setRecoverConfirm] = useState("");
  const [showRecoverPassword, setShowRecoverPassword] = useState(false);
  const [recoverStep, setRecoverStep] = useState("request");
  const [recoverError, setRecoverError] = useState("");
  const [recoverMessage, setRecoverMessage] = useState("");
  const [recoverLoading, setRecoverLoading] = useState(false);
  const [paymentBlock, setPaymentBlock] = useState(null);
  const [paymentNotice, setPaymentNotice] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setPaymentNotice("");
    setPaymentBlock(null);
    setLoading(true);

    try {
      const data = await apiFetch("/api/models/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("user", JSON.stringify(data.user));

      navigate("/modelo/area");
    } catch (err) {
      const statusCode = Number(err?.status || 0);
      const paymentData = err?.data?.payment;

      if (
        statusCode === 402 &&
        err?.data?.code === "MODEL_TRIAL_EXPIRED" &&
        paymentData
      ) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");
        setPaymentBlock(paymentData);
        setError("");
        return;
      }

      setError(err.message || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendRecoverCode(event) {
    event.preventDefault();
    setRecoverError("");
    setRecoverMessage("");
    setRecoverLoading(true);

    try {
      await apiFetch("/api/models/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: recoverEmail }),
      });
      setRecoverStep("reset");
      setRecoverMessage("Codigo enviado para o WhatsApp cadastrado.");
    } catch (err) {
      setRecoverError(err.message || "Falha ao enviar codigo.");
    } finally {
      setRecoverLoading(false);
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault();
    setRecoverError("");
    setRecoverMessage("");

    if (recoverPassword.length < 6) {
      setRecoverError("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (recoverPassword !== recoverConfirm) {
      setRecoverError("As senhas nao conferem.");
      return;
    }

    setRecoverLoading(true);
    try {
      await apiFetch("/api/models/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: recoverEmail,
          code: recoverCode,
          newPassword: recoverPassword,
        }),
      });
      setRecoverMessage("Senha redefinida com sucesso. Faca login.");
      setMode("login");
      setEmail(recoverEmail);
      setPassword("");
      setRecoverCode("");
      setRecoverPassword("");
      setRecoverConfirm("");
      setRecoverStep("request");
    } catch (err) {
      setRecoverError(err.message || "Nao foi possivel redefinir a senha.");
    } finally {
      setRecoverLoading(false);
    }
  }

  return (
    <div className="page-tight">
      <div className="form-shell">
        {mode === "login" ? (
          <>
            <h2>Area da modelo</h2>
            <p className="muted">Acesse para atualizar suas midias.</p>
            {error && <div className="notice">{error}</div>}
            {recoverMessage && <div className="notice">{recoverMessage}</div>}
            {paymentBlock ? (
              <div
                className="card"
                style={{
                  marginTop: 14,
                  marginBottom: 14,
                  border: "1px solid rgba(225, 86, 86, 0.5)",
                }}
              >
                <h4 style={{ marginBottom: 10 }}>Gratuidade vencida</h4>
                <p className="muted" style={{ marginBottom: 8 }}>
                  Seu periodo de gratuidade venceu. Para acessar a area da modelo,
                  realize o pagamento do plano escolhido.
                </p>
                <p className="muted" style={{ marginBottom: 6 }}>
                  Plano selecionado:{" "}
                  <strong>{paymentBlock.planLabel || paymentBlock.planTier || "BASICO"}</strong>{" "}
                  {paymentBlock.priceText ? `(${paymentBlock.priceText})` : ""}
                </p>
                {paymentBlock.trialEndsAt ? (
                  <p className="muted" style={{ marginBottom: 10 }}>
                    Gratuidade encerrada em: {formatDateBr(paymentBlock.trialEndsAt)}
                  </p>
                ) : null}
                <p style={{ fontWeight: 700, marginBottom: 6 }}>
                  Chave Pix copia e cola
                </p>
                <div
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    marginBottom: 10,
                    wordBreak: "break-all",
                  }}
                >
                  {paymentBlock.pixKey || "-"}
                </div>
                <button
                  className="btn btn-outline"
                  type="button"
                  onClick={async () => {
                    const pixKey = String(paymentBlock.pixKey || "").trim();
                    if (!pixKey) {
                      setPaymentNotice("Chave Pix indisponivel no momento.");
                      return;
                    }
                    const ok = await copyToClipboard(pixKey);
                    setPaymentNotice(ok ? "Chave Pix copiada." : "Nao foi possivel copiar.");
                  }}
                >
                  Copiar chave Pix
                </button>
                {paymentNotice ? (
                  <p className="muted" style={{ marginTop: 8 }}>
                    {paymentNotice}
                  </p>
                ) : null}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="form-grid">
              <input
                className="input"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <div style={{ position: "relative" }}>
                <input
                  className="input"
                  type={showPassword ? "text" : "password"}
                  placeholder="Senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="pill"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                  }}
                >
                  {showPassword ? "Ocultar" : "Ver"}
                </button>
              </div>

              <button className="btn" type="submit" disabled={loading}>
                {loading ? "Entrando..." : "Entrar"}
              </button>
            </form>

            <div className="auth-row">
              <button
                type="button"
                className="auth-link"
                onClick={() => {
                  setMode("recover");
                  setPaymentBlock(null);
                  setPaymentNotice("");
                  setRecoverMessage("");
                  setRecoverError("");
                  setRecoverEmail(email);
                }}
              >
                Esqueci minha senha
              </button>
            </div>
          </>
        ) : (
          <>
            <h2>Recuperar senha</h2>
            <p className="muted">
              Informe seu email para receber um codigo no WhatsApp cadastrado.
            </p>
            {recoverError && <div className="notice">{recoverError}</div>}
            {recoverMessage && <div className="notice">{recoverMessage}</div>}

            {recoverStep === "request" ? (
              <form onSubmit={handleSendRecoverCode} className="form-grid">
                <input
                  className="input"
                  type="email"
                  placeholder="Email da conta"
                  value={recoverEmail}
                  onChange={(event) => setRecoverEmail(event.target.value)}
                  required
                />
                <button className="btn" type="submit" disabled={recoverLoading}>
                  {recoverLoading ? "Enviando..." : "Enviar codigo"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="form-grid">
                <input
                  className="input"
                  type="email"
                  placeholder="Email da conta"
                  value={recoverEmail}
                  onChange={(event) => setRecoverEmail(event.target.value)}
                  required
                />
                <input
                  className="input"
                  type="text"
                  inputMode="numeric"
                  placeholder="Codigo de 6 digitos"
                  value={recoverCode}
                  onChange={(event) => setRecoverCode(event.target.value)}
                  maxLength={6}
                  required
                />
                <div style={{ position: "relative" }}>
                  <input
                    className="input"
                    type={showRecoverPassword ? "text" : "password"}
                    placeholder="Nova senha"
                    value={recoverPassword}
                    onChange={(event) => setRecoverPassword(event.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="pill"
                    onClick={() => setShowRecoverPassword(!showRecoverPassword)}
                    style={{
                      position: "absolute",
                      right: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                    }}
                  >
                    {showRecoverPassword ? "Ocultar" : "Ver"}
                  </button>
                </div>
                <input
                  className="input"
                  type={showRecoverPassword ? "text" : "password"}
                  placeholder="Confirmar nova senha"
                  value={recoverConfirm}
                  onChange={(event) => setRecoverConfirm(event.target.value)}
                  required
                />
                <button className="btn" type="submit" disabled={recoverLoading}>
                  {recoverLoading ? "Redefinindo..." : "Redefinir senha"}
                </button>
              </form>
            )}

            <div className="auth-row">
              {recoverStep === "reset" ? (
                <button
                  type="button"
                  className="auth-link"
                  onClick={() => setRecoverStep("request")}
                >
                  Reenviar codigo
                </button>
              ) : null}
              <button
                type="button"
                className="auth-link"
                onClick={() => {
                  setMode("login");
                  setRecoverError("");
                }}
              >
                Voltar ao login
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
