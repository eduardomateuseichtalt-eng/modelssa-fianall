export default function Contact() {
  return (
    <div className="page">
      <p className="pill">Contato</p>
      <h1 className="section-title" style={{ marginTop: 12 }}>
        Fale com a <span>equipe</span>
      </h1>
      <p className="muted" style={{ marginTop: 12 }}>
        Atendimento premium para agencias, anunciantes e modelos.
      </p>

      <div className="section">
        <div className="form-shell">
          <h2>Enviar mensagem</h2>
          <form className="form-grid">
            <input className="input" placeholder="Nome completo" />
            <input className="input" placeholder="Email" />
            <input className="input" placeholder="Assunto" />
            <textarea className="textarea" placeholder="Mensagem" />
            <button className="btn" type="button">
              Enviar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
