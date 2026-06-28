export default function About() {
  return (
    <div className="page">
      <p className="pill">Institucional</p>
      <h1 className="section-title" style={{ marginTop: 12 }}>
        Sobre a Models-Club LTDA
      </h1>
      <p className="muted" style={{ marginTop: 12, maxWidth: 720 }}>
        {
          "Somos uma plataforma premium inspirada no mercado de anúncios de acompanhantes de alto padrão. Conectamos acompanhantes e anunciantes em um ambiente seguro, com verificação manual e foco em experiência."
        }
      </p>

      <div className="section">
        <h2 className="section-title">
          Nossos <span>pilares</span>
        </h2>
        <div className="cards">
          <div className="card">
            <h4>Exclusividade</h4>
            <p className="muted">
              Selecionamos perfis completos e atualizados para garantir alto
              padrão visual.
            </p>
          </div>
          <div className="card">
            <h4>Segurança</h4>
            <p className="muted">
              Conteúdo 18+ com consentimento ativo e políticas claras.
            </p>
          </div>
          <div className="card">
            <h4>Performance</h4>
            <p className="muted">
              Layout pensado para facilitar conversões e contato direto.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
