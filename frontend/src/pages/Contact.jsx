export default function Contact() {
  const whatsappNumber = "5547991481477";
  const whatsappMessage = encodeURIComponent(
    "Ola! Seja bem-vindo(a) ao Whats da Models-Club. Por aqui voce consegue solucionar qualquer problema relacionado a nossa plataforma. Como podemos ajuda-lo hoje?"
  );
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
