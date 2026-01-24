import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const PHONE_KEY = "model-register-phone";

const steps = [
  'Aperte o botao "Autenticar agora";',
  "Permita o uso da camera no navegador do seu smartphone;",
  "Apos pressionar o botao de iniciar, evite clicar ou arrastar em qualquer outro local da tela;",
  "Mantenha o seu rosto dentro do circulo, depois clique em Estou pronto para iniciar.",
];

export default function ModelFaceAuth() {
  const navigate = useNavigate();
  const [phone] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return sessionStorage.getItem(PHONE_KEY) || "";
  });

  useEffect(() => {
    if (!phone) {
      navigate("/seja-modelo", { replace: true });
    }
  }, [navigate, phone]);

  return (
    <div className="page">
      <div className="face-auth-shell">
        <div className="step-indicator">
          <span>Etapa 4</span>
          <span className="muted">Autenticacao facial</span>
        </div>
        <h2 className="face-auth-title">Autenticacao facial</h2>
        <p className="face-auth-lead">
          A seguranca do seu anuncio em primeiro lugar. Apenas o(a) proprietario(a) pode acessar e
          fazer alteracoes neste anuncio. Faca uma rapida filmagem do seu rosto para verificacao.
        </p>

        <div className="face-auth-steps">
          {steps.map((step, index) => (
            <div key={`step-${index}`} className="face-auth-step">
              <div className="step-badge">{index + 1}</div>
              <p>{step}</p>
            </div>
          ))}
        </div>

        <div className="face-auth-permission">
          <div className="face-auth-permission-header">
            <div className="camera-dot" />
            <div>
              <h3>Permitir camera</h3>
              <p>Usaremos sua camera apenas para a gravacao da autenticacao facial.</p>
            </div>
          </div>
          <button className="btn face-auth-cta" type="button" onClick={() => navigate("/seja-modelo/cadastro")}>
            Quero permitir!
          </button>
        </div>

        <div className="form-actions">
          <button className="btn btn-outline" type="button" onClick={() => navigate("/seja-modelo/codigo")}>
            Voltar
          </button>
          <button className="btn btn-outline" type="button" onClick={() => navigate("/seja-modelo/cadastro")}>
            Pular por agora
          </button>
        </div>
      </div>
    </div>
  );
}
