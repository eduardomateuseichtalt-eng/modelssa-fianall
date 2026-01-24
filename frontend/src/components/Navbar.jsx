import { NavLink, Link, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);

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

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    setUser(null);
    navigate("/");
  };

  return (
    <div className="nav-wrap">
      <Link to="/" className="brand">
        <span className="brand-mark">MS</span>
        <span>models S.A</span>
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
        <NavLink to="/seja-modelo" className="nav-cta">
          Quero anunciar
        </NavLink>
      </div>
    </div>
  );
}
