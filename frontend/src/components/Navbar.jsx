import { NavLink, Link, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const readUser = () => {
    try {
      const storedUser = localStorage.getItem("user");
      if (storedUser && storedUser !== "undefined") {
        setUser(JSON.parse(storedUser));
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    readUser();
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === "user") {
        readUser();
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileMenuOpen]);

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    setUser(null);
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
          <NavLink to="/modelos">Modelos</NavLink>
          <NavLink to="/seja-modelo">Seja modelo</NavLink>
          <NavLink to="/anuncie">Anuncie</NavLink>
          <NavLink to="/contato">Contato</NavLink>
        </nav>

        <div className="nav-links">
          {user ? (
            <>
              <span className="pill">Ola, {user.displayName || "Usuario"}</span>
              {user.role === "ADMIN" ? (
                <NavLink to="/admin/aprovacoes">Admin</NavLink>
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
              <NavLink to="/modelo/login">Area da modelo</NavLink>
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

      <button
        type="button"
        className={`mobile-nav-overlay ${mobileMenuOpen ? "open" : ""}`}
        aria-hidden={!mobileMenuOpen}
        tabIndex={mobileMenuOpen ? 0 : -1}
        onClick={() => setMobileMenuOpen(false)}
      />

      <aside className={`mobile-nav ${mobileMenuOpen ? "open" : ""}`} aria-hidden={!mobileMenuOpen}>
        <nav className="mobile-nav-section">
          <NavLink to="/" onClick={() => setMobileMenuOpen(false)}>
            Inicio
          </NavLink>
          <NavLink to="/modelos" onClick={() => setMobileMenuOpen(false)}>
            Modelos
          </NavLink>
          <NavLink to="/seja-modelo" onClick={() => setMobileMenuOpen(false)}>
            Seja modelo
          </NavLink>
          <NavLink to="/anuncie" onClick={() => setMobileMenuOpen(false)}>
            Anuncie
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
                <NavLink
                  to="/admin/aprovacoes"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Admin
                </NavLink>
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
                Area da modelo
              </NavLink>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

