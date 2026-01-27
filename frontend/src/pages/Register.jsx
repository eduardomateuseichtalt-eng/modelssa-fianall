import { useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";

export default function Register() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function handleRegister(e) {
    e.preventDefault();
    setMessage("");

    try {
      await apiFetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, email, password }),
      });

      setMessage("Cadastro realizado com sucesso. Faca login.");
      setDisplayName("");
      setEmail("");
      setPassword("");
    } catch (err) {
      setMessage(err.message || "Erro no cadastro.");
    }
  }

  return (
    <div className="page-tight">
      <div className="form-shell">
        <h2>Criar conta</h2>
        <p className="muted">Acesso rapido para anunciantes e agencias.</p>

        {message && <div className="notice">{message}</div>}

        <form onSubmit={handleRegister} className="form-grid">
          <input
            className="input"
            placeholder="Nome"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
          <input
            className="input"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="input"
            placeholder="Senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button className="btn" type="submit">
            Cadastrar
          </button>
        </form>

        <div style={{ marginTop: 18 }}>
          <span className="muted">Ja tem conta?</span>{" "}
          <Link to="/login" className="pill">
            Fazer login
          </Link>
        </div>
      </div>
    </div>
  );
}
