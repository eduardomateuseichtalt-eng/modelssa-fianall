import { Link } from "react-router-dom";

const PARTNER_MOTEIS = [
  {
    id: "motel-parceiro-teste",
    name: "Motel Parceiro (Teste)",
    address: "Endereço em validação comercial",
    city: "Curitiba - PR",
    mapUrl: "https://maps.google.com",
    logoUrl: "",
  },
];

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div>
          <div className="brand">
            <span className="brand-mark">MS</span>
            <span className="notranslate" translate="no">
              models-club
            </span>
          </div>
          <p className="muted" style={{ marginTop: 12 }}>
            PLATAFORMA PREMIUM PARA ACOMPANHANTES
          </p>
        </div>

        <div>
          <h4 className="pill">Explorar</h4>
          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            <Link to="/modelos">Acompanhantes</Link>
            <Link to="/seja-modelo">Seja acompanhante</Link>
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
      <div className="footer-partners">
        <h4 className="pill">Motéis Parceiros</h4>
        <p className="muted footer-partners-note">
          Espaço de teste para exibir logo e endereço dos parceiros.
        </p>
        <div className="footer-partners-grid">
          {PARTNER_MOTEIS.map((partner) => (
            <article key={partner.id} className="footer-partner-card">
              <div className="footer-partner-logo-shell">
                {partner.logoUrl ? (
                  <img
                    src={partner.logoUrl}
                    alt={`Logo do ${partner.name}`}
                    className="footer-partner-logo"
                    loading="lazy"
                  />
                ) : (
                  <div className="footer-partner-logo-placeholder">
                    LOGO DO PARCEIRO
                  </div>
                )}
              </div>
              <strong>{partner.name}</strong>
              <p className="muted">
                {partner.address}
                <br />
                {partner.city}
              </p>
              <a
                href={partner.mapUrl}
                target="_blank"
                rel="noreferrer"
                className="footer-partner-link"
              >
                Ver no mapa
              </a>
            </article>
          ))}
        </div>
      </div>
      <div className="muted" style={{ textAlign: "center", marginTop: 18 }}>
        &copy; 2026 Models-Club. Todos os direitos reservados.
      </div>
    </footer>
  );
}

