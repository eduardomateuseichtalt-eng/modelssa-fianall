import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";

const PARTNER_MOTEIS_TESTE = [
  {
    id: "motel-parceiro-teste",
    name: "Motel Parceiro (Teste)",
    address: "Endereco em validacao comercial",
    city: "Curitiba - PR",
    mapUrl: "https://maps.google.com",
    logoUrl: "",
  },
];

export default function Footer() {
  const [partners, setPartners] = useState(PARTNER_MOTEIS_TESTE);

  useEffect(() => {
    let mounted = true;
    apiFetch("/api/motel-partners")
      .then((data) => {
        if (!mounted) return;
        const safeData = Array.isArray(data) ? data : [];
        if (safeData.length === 0) {
          setPartners(PARTNER_MOTEIS_TESTE);
          return;
        }
        setPartners(
          safeData.map((partner) => ({
            id: partner.id,
            name: partner.name,
            address: partner.address || "",
            city: partner.city || "",
            mapUrl: partner.mapUrl || "",
            logoUrl: partner.photoUrl || "",
          }))
        );
      })
      .catch(() => {
        if (!mounted) return;
        setPartners(PARTNER_MOTEIS_TESTE);
      });

    return () => {
      mounted = false;
    };
  }, []);

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
        <h4 className="pill">Moteis Parceiros</h4>
        <p className="muted footer-partners-note">
          Logos e enderecos de parceiros comerciais.
        </p>
        <div className="footer-partners-grid">
          {partners.map((partner) => (
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
              {partner.mapUrl ? (
                <a
                  href={partner.mapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="footer-partner-link"
                >
                  Ver no mapa
                </a>
              ) : null}
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

