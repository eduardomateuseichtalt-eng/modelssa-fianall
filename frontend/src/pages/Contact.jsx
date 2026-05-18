export default function Contact() {
  const whatsappNumber = "5547991481477";
  const whatsappMessage = encodeURIComponent("Ola! Vim pela pagina de contato e gostaria de mais informacoes.");
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;

  return (
    <div className="page">
      <p className="pill">Contato</p>
      <h1 className="section-title" style={{ marginTop: 12 }}>
        Fale com a <span>equipe</span>
      </h1>
      <p className="muted" style={{ marginTop: 12 }}>
        atendimento aprimorado para anunciantes e acompanhantes.
      </p>
      <a className="btn contact-whatsapp-btn" href={whatsappUrl} target="_blank" rel="noreferrer">
        Chamar no WhatsApp
      </a>

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
