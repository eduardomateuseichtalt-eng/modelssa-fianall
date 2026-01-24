import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { apiFetch } from "../lib/api";

const colorOptions = [
  { value: "BLACK", label: "Negras", color: "#2d2a2a" },
  { value: "BROWN", label: "Pardas", color: "#7a5332" },
  { value: "WHITE", label: "Brancas", color: "#e6d8c9" },
  { value: "INDIGENOUS", label: "Indigenas", color: "#c85d3a" },
  { value: "ASIAN", label: "Asiaticas", color: "#d1a26a" },
  { value: "OTHER", label: "Outras", color: "#8b8b8b" },
];

const defaultCity = "";

const buildSegments = (breakdown) => {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return breakdown.map((item) => {
    const length = circumference * (item.percentage / 100);
    const dasharray = `${length} ${circumference - length}`;
    const dashoffset = -offset;
    offset += length;
    return {
      ...item,
      dasharray,
      dashoffset,
    };
  });
};

export default function ModelCityStats() {
  let user = null;
  try {
    const stored = localStorage.getItem("user");
    if (stored && stored !== "undefined") {
      user = JSON.parse(stored);
    }
  } catch {
    user = null;
  }

  if (!user || user.role !== "MODEL") {
    return <Navigate to="/modelo/login" replace />;
  }

  const [form, setForm] = useState({
    city: defaultCity,
    color: colorOptions[0].value,
    count: "",
    days: "",
  });
  const [searchCity, setSearchCity] = useState(defaultCity);
  const [stats, setStats] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const colorMap = useMemo(() => {
    return colorOptions.reduce((acc, item) => {
      acc[item.value] = item;
      return acc;
    }, {});
  }, []);

  const segments = useMemo(() => {
    if (!stats || !stats.breakdown || stats.breakdown.length === 0) {
      return [];
    }
    return buildSegments(
      stats.breakdown.map((item) => ({
        ...item,
        color: colorMap[item.color]?.color || "#666",
        label: colorMap[item.color]?.label || item.color,
      }))
    );
  }, [stats, colorMap]);

  const handleChange = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const loadStats = async (city) => {
    if (!city) {
      setStats(null);
      return;
    }
    setError("");
    try {
      const data = await apiFetch(`/api/city-stats?city=${encodeURIComponent(city)}`);
      setStats(data);
    } catch (err) {
      setError(err.message || "Erro ao carregar estatisticas.");
    }
  };

  useEffect(() => {
    if (!searchCity.trim()) {
      setStats(null);
      return;
    }
    const handler = setTimeout(() => {
      loadStats(searchCity.trim());
    }, 400);
    return () => clearTimeout(handler);
  }, [searchCity]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!form.city || !form.count || !form.days) {
      setError("Preencha cidade, atendimentos e dias.");
      return;
    }

    setLoading(true);
    try {
      await apiFetch("/api/city-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city: form.city,
          color: form.color,
          count: Number(form.count),
          days: Number(form.days),
        }),
      });
      setMessage("Relatorio enviado com sucesso.");
      setSearchCity(form.city.trim());
      await loadStats(form.city.trim());
      setForm((prev) => ({ ...prev, count: "", days: "" }));
    } catch (err) {
      setError(err.message || "Erro ao enviar relatorio.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <h1 className="section-title">
        Estatisticas <span>por cidade</span>
      </h1>
      <p className="muted" style={{ marginTop: 10 }}>
        Registre seus atendimentos e veja a distribuicao por cor na cidade.
      </p>

      {message && <div className="notice">{message}</div>}
      {error && <div className="notice">{error}</div>}

      <div className="stats-grid">
        <form className="card stats-card" onSubmit={handleSubmit}>
          <h3>Enviar relatorio</h3>
          <input
            className="input"
            name="city"
            placeholder="Cidade (ex.: Sao Paulo - SP)"
            value={form.city}
            onChange={handleChange}
            required
          />
          <select
            className="select"
            name="color"
            value={form.color}
            onChange={handleChange}
          >
            {colorOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            className="input"
            name="count"
            type="number"
            min="1"
            placeholder="Quantidade de atendimentos"
            value={form.count}
            onChange={handleChange}
            required
          />
          <input
            className="input"
            name="days"
            type="number"
            min="1"
            placeholder="Periodo em dias"
            value={form.days}
            onChange={handleChange}
            required
          />
          <button className="btn" type="submit" disabled={loading}>
            {loading ? "Enviando..." : "Enviar relatorio"}
          </button>
        </form>

        <div className="card stats-card">
          <h3>Preferencias na cidade</h3>
          <input
            className="input"
            placeholder="Digite a cidade para consultar"
            value={searchCity}
            onChange={(event) => setSearchCity(event.target.value)}
          />
          {stats && stats.total > 0 ? (
            <div className="stats-chart">
              <svg viewBox="0 0 120 120" className="donut">
                <circle
                  cx="60"
                  cy="60"
                  r="45"
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="18"
                />
                {segments.map((segment) => (
                  <circle
                    key={segment.color}
                    cx="60"
                    cy="60"
                    r="45"
                    fill="none"
                    stroke={segment.color}
                    strokeWidth="18"
                    strokeDasharray={segment.dasharray}
                    strokeDashoffset={segment.dashoffset}
                    strokeLinecap="round"
                  />
                ))}
              </svg>
              <div className="stats-total">
                <span>Total</span>
                <strong>{stats.total}</strong>
              </div>
              <div className="stats-legend">
                {segments.map((item) => (
                  <div className="stats-legend-row" key={item.color}>
                    <span className="legend-dot" style={{ background: item.color }} />
                    <span>{item.label}</span>
                    <span>{item.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="muted" style={{ marginTop: 12 }}>
              Nenhum dado para esta cidade.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
