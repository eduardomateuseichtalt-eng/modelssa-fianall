export default function Faq() {
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
    </div>
  );
}
