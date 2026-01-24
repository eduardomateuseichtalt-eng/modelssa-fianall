import { useMemo, useState } from "react";

const formatCurrency = (value) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);

export default function Pricing() {
  const [rate, setRate] = useState(200);
  const [dailyCount, setDailyCount] = useState(4);
  const [weeklyDays, setWeeklyDays] = useState(5);
  const [city, setCity] = useState("");

  const monthlyTotal = useMemo(
    () => rate * dailyCount * weeklyDays * 4,
    [rate, dailyCount, weeklyDays]
  );

  return (
    <div className="page">
      <section className="section">
        <h2 className="section-title">
          Ver <span>planos</span>
        </h2>
        <div className="cards" style={{ marginTop: 16 }}>
          <div className="card">
            <h4 style={{ color: "#d4af37" }}>Premium</h4>
            <p className="muted">Acesso completo com destaque</p>
            <p>
              <strong>R$ 39,99</strong>
            </p>
          </div>
        </div>
      </section>

      <p className="pill">Calculadora</p>
      <h1 className="section-title" style={{ marginTop: 12 }}>
        Quanto voce pode <span>ganhar</span>
      </h1>
      <p className="muted" style={{ marginTop: 12 }}>
        Planeje sua rotina com uma simulacao simples de ganhos mensais.
      </p>

      <div className="calc-shell">
        <div className="calc-card">
          <h2>Calcule seus ganhos</h2>
          <p className="muted">Valor de cada atendimento</p>

          <div className="calc-rate">
            <button
              type="button"
              className="calc-step"
              onClick={() => setRate((prev) => Math.max(50, prev - 50))}
            >
              -
            </button>
            <div className="calc-amount">
              <strong>{formatCurrency(rate)}</strong>
              <span>/h</span>
            </div>
            <button
              type="button"
              className="calc-step"
              onClick={() => setRate((prev) => Math.min(2000, prev + 50))}
            >
              +
            </button>
          </div>

          <div className="calc-highlight">
            100% do valor de atendimento e seu
          </div>

          <div className="calc-range">
            <div className="calc-range-head">
              <span>{dailyCount} atendimentos por dia</span>
            </div>
            <input
              type="range"
              min="1"
              max="12"
              value={dailyCount}
              onChange={(event) => setDailyCount(Number(event.target.value))}
            />
          </div>

          <div className="calc-range">
            <div className="calc-range-head">
              <span>{weeklyDays} dias por semana</span>
            </div>
            <input
              type="range"
              min="1"
              max="7"
              value={weeklyDays}
              onChange={(event) => setWeeklyDays(Number(event.target.value))}
            />
          </div>

          <div className="calc-total">
            <p>Total de ganhos por mes</p>
            <h3>{formatCurrency(monthlyTotal)}/mes</h3>
          </div>
        </div>

        <div className="calc-card calc-secondary">
          <h2>Dicas personalizadas</h2>
          <p className="muted">Insira sua cidade abaixo</p>
          <div className="calc-city">
            <input
              className="input"
              type="text"
              placeholder="Ex.: Sao Paulo - SP"
              value={city}
              onChange={(event) => setCity(event.target.value)}
            />
          </div>
          <p className="calc-note">
            {city
              ? `Com a media de ${formatCurrency(rate)} por atendimento em ${city},
              voce pode simular ate ${formatCurrency(monthlyTotal)} por mes.`
              : "Digite sua cidade para comparar com a media local."}
          </p>
          <p className="muted" style={{ marginTop: 18 }}>
            Esta calculadora e uma simulacao. Os valores estimados nao
            representam garantia de faturamento.
          </p>
        </div>
      </div>
    </div>
  );
}
