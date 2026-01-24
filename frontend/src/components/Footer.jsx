import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div>
          <div className="brand">
            <span className="brand-mark">MS</span>
            <span>models S.A</span>
          </div>
          <p className="muted" style={{ marginTop: 12 }}>
            Plataforma premium para talentos, agencias e anunciantes.
          </p>
        </div>

        <div>
          <h4 className="pill">Explorar</h4>
          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            <Link to="/modelos">Modelos</Link>
            <Link to="/seja-modelo">Seja modelo</Link>
            <Link to="/anuncie">Anuncie</Link>
          </div>
        </div>

        <div>
          <h4 className="pill">Institucional</h4>
          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            <Link to="/sobre">Sobre</Link>
            <Link to="/contato">Contato</Link>
            <Link to="/faq">FAQ</Link>
          </div>
        </div>

        <div>
          <h4 className="pill">Legal</h4>
          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            <Link to="/termos">Termos</Link>
            <Link to="/privacidade">Privacidade</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
