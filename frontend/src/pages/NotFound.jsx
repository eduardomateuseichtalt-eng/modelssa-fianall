import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="page">
      <h1 className="section-title">
        Pagina <span>nao encontrada</span>
      </h1>
      <p className="muted" style={{ marginTop: 12 }}>
        A rota solicitada nao existe ou foi movida.
      </p>
      <div className="form-actions">
        <Link to="/" className="btn">
          Voltar para home
        </Link>
      </div>
    </div>
  );
}
