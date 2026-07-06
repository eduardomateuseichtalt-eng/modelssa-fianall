import { NavLink, Link, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    setMobileMenuOpen(false);
    navigate("/");
  };

  return (
    <>
      <div className="nav-wrap">
        <Link to="/" className="brand">
          <span className="brand-mark">MS</span>
          <span className="notranslate" translate="no">
            models-club
          </span>
        </Link>

        <nav className="nav-links">
          <NavLink to="/">Inicio</NavLink>
          <NavLink to="/modelos">Acompanhantes</NavLink>
          <NavLink to="/contato">Contato</NavLink>
        </nav>

        <div className="nav-links">
          {user ? (
            <>
              <span className="pill">Ola, {user.displayName || "Usuario"}</span>
              {user.role === "ADMIN" ? (
                <>
                  <NavLink to="/admin/aprovacoes">Aprovacoes</NavLink>
                  <NavLink to="/admin/parceiros">Parceiros</NavLink>
                </>
              ) : null}
              {user.role === "MODEL" ? (
                <>
                  <NavLink to="/modelo/area">Minha conta</NavLink>
                  <NavLink to="/modelo/estatisticas">Estatisticas</NavLink>
                </>
              ) : null}
              <button className="pill" type="button" onClick={handleLogout}>
                Sair
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login">Entrar</NavLink>
              <NavLink to="/cadastro">Cadastro</NavLink>
              <NavLink to="/modelo/login">Area da acompanhante</NavLink>
            </>
          )}
        </div>

        <button
          type="button"
          className="nav-hamburger"
          aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen((prev) => !prev)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      <div className={`mobile-nav ${mobileMenuOpen ? "open" : ""}`}>
        <nav className="mobile-nav-section">
          <NavLink to="/" onClick={() => setMobileMenuOpen(false)}>
            Inicio
          </NavLink>
          <NavLink to="/modelos" onClick={() => setMobileMenuOpen(false)}>
            Acompanhantes
          </NavLink>
          <NavLink to="/contato" onClick={() => setMobileMenuOpen(false)}>
            Contato
          </NavLink>
        </nav>

        <div className="mobile-nav-section">
          {user ? (
            <>
              <span className="pill">Ola, {user.displayName || "Usuario"}</span>
              {user.role === "ADMIN" ? (
                <>
                  <NavLink
                    to="/admin/aprovacoes"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Aprovacoes
                  </NavLink>
                  <NavLink
                    to="/admin/parceiros"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Parceiros
                  </NavLink>
                </>
              ) : null}
              {user.role === "MODEL" ? (
                <>
                  <NavLink to="/modelo/area" onClick={() => setMobileMenuOpen(false)}>
                    Minha conta
                  </NavLink>
                  <NavLink
                    to="/modelo/estatisticas"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Estatisticas
                  </NavLink>
                </>
              ) : null}
              <button className="pill" type="button" onClick={handleLogout}>
                Sair
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" onClick={() => setMobileMenuOpen(false)}>
                Entrar
              </NavLink>
              <NavLink to="/cadastro" onClick={() => setMobileMenuOpen(false)}>
                Cadastro
              </NavLink>
              <NavLink to="/modelo/login" onClick={() => setMobileMenuOpen(false)}>
                Area da acompanhante
              </NavLink>
            </>
          )}
        </div>
      </div>
    </>
  );
}

