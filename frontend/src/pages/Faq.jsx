import { useState } from "react";
import { apiFetch } from "../lib/api";

export default function Faq() {
  const [reportMessage, setReportMessage] = useState("");
  const [reportContact, setReportContact] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportNotice, setReportNotice] = useState("");
  const [reportError, setReportError] = useState("");

  const handleSubmitReport = async (event) => {
    event.preventDefault();
    setReportNotice("");
    setReportError("");

    const message = reportMessage.trim();
    if (!message) {
      setReportError("Descreva o problema para enviar.");
      return;
    }

    setReportLoading(true);
    try {
      await apiFetch("/api/faq-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          contact: reportContact.trim(),
        }),
      });
      setReportNotice("Relato enviado com sucesso.");
      setReportMessage("");
      setReportContact("");
    } catch (err) {
      setReportError(err.message || "Erro ao enviar relato.");
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <div className="page">
      <p className="pill">FAQ</p>
      <h1 className="section-title" style={{ marginTop: 12 }}>
        Perguntas <span>frequentes</span>
      </h1>

      <div className="cards">
        <div className="card">
          <h4>Como funciona a aprovacao?</h4>
          <p className="muted">
            Todos os cadastros passam por avaliacao manual e validacao de idade.
          </p>
        </div>
        <div className="card">
          <h4>Posso editar meu perfil?</h4>
          <p className="muted">
            Sim, apos login voce pode atualizar fotos e dados principais.
          </p>
        </div>
        <div className="card">
          <h4>Quais dados aparecem no publico?</h4>
          <p className="muted">
            Somente informacoes aprovadas e os canais de contato informados.
          </p>
        </div>
      </div>

      <section className="section" style={{ marginTop: 32 }}>
        <div className="card" style={{ maxWidth: 820 }}>
          <h4>Relatar denuncia</h4>
          <p className="muted">
            Descreva o problema para a equipe analisar. Seu relato aparecera na
            area administrativa.
          </p>

          {reportNotice ? <div className="notice" style={{ marginTop: 12 }}>{reportNotice}</div> : null}
          {reportError ? <div className="notice" style={{ marginTop: 12 }}>{reportError}</div> : null}

          <form onSubmit={handleSubmitReport} className="form-grid" style={{ marginTop: 14 }}>
            <textarea
              className="textarea"
              placeholder="Descreva o problema"
              value={reportMessage}
              onChange={(event) => setReportMessage(event.target.value)}
              rows={5}
              maxLength={2000}
              required
            />
            <input
              className="input"
              placeholder="Contato (opcional: email ou WhatsApp)"
              value={reportContact}
              onChange={(event) => setReportContact(event.target.value)}
              maxLength={255}
            />
            <div className="form-actions" style={{ marginTop: 0 }}>
              <button className="btn" type="submit" disabled={reportLoading}>
                {reportLoading ? "Enviando..." : "Enviar relato"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
