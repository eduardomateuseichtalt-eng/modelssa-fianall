import { useState } from "react";
import { Link } from "react-router-dom";

export default function AgeConsentModal() {
  const [visible, setVisible] = useState(true);

  function accept() {
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="age-modal">
      <div className="age-card">
        <div className="age-title">
          <span className="age-badge">18+</span>
          <div>
            <h2>CONTEUDO ADULTO</h2>
            <p className="age-lead">
              Entendo que o site models S.A apresenta conteudo explicito
              destinado a adultos.{" "}
              <Link to="/termos" className="age-link">
                Termos de uso
              </Link>
            </p>
          </div>
        </div>

        <div className="age-divider" />

        <h3>AVISO DE COOKIES</h3>
        <p className="age-text">
          Nos usamos cookies e outras tecnologias semelhantes para melhorar a
          sua experiencia em nosso site.
        </p>

        <div className="age-divider" />

        <p className="age-text">
          A profissao de acompanhante e legalizada no Brasil e deve ser
          respeitada.{" "}
          <Link to="/sobre" className="age-link">
            Saiba mais
          </Link>
        </p>

        <button className="age-button" onClick={accept}>
          Concordo
        </button>
      </div>
    </div>
  );
}
