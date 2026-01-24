export default function About() {
  return (
    <div className="page">
      <p className="pill">Institucional</p>
      <h1 className="section-title" style={{ marginTop: 12 }}>
        Sobre a <span>models S.A</span>
      </h1>
      <p className="muted" style={{ marginTop: 12, maxWidth: 720 }}>
        Somos uma plataforma premium inspirada no mercado de anuncios de alto
        padrao. Conectamos modelos, agencias e anunciantes em um ambiente seguro,
        com verificacao manual e foco em experiencia.
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
              padrao visual.
            </p>
          </div>
          <div className="card">
            <h4>Seguranca</h4>
            <p className="muted">
              Conteudo 18+ com consentimento ativo e politicas claras.
            </p>
          </div>
          <div className="card">
            <h4>Performance</h4>
            <p className="muted">
              Layout pensado para facilitar conversoes e contato direto.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
