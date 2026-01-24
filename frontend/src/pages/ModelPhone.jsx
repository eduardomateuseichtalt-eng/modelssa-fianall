import { useState } from "react";
import { useNavigate } from "react-router-dom";

const STORAGE_KEY = "model-register-phone";

export default function ModelPhone() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState(
    () => sessionStorage.getItem(STORAGE_KEY) || ""
  );
  const [error, setError] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    setError("");
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setError("Informe um numero valido com DDD.");
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, phone.trim());
    navigate("/seja-modelo/validacao");
  };

  return (
    <div className="page-tight">
      <div className="form-shell">
        <div className="step-indicator">
          <span>Etapa 1</span>
          <span className="muted">Telefone profissional</span>
        </div>
        <h2>Confirme seu numero</h2>
        <p className="muted">
          Use um numero profissional para validacao e contato com clientes.
        </p>

        {error ? <div className="notice">{error}</div> : null}

        <form onSubmit={handleSubmit} className="form-grid">
          <input
            className="input"
            name="phone"
            type="tel"
            placeholder="(11) 99999-9999"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            required
          />
          <div className="form-actions">
            <button className="btn" type="submit">
              Continuar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
