import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { useNoIndex } from "../lib/useNoIndex";

const INITIAL_FORM = {
  name: "",
  address: "",
  city: "",
  zipCode: "",
  photoUrl: "",
  mapUrl: "",
  displayOrder: "0",
  active: true,
};

const normalizeZipCode = (value) => String(value || "").replace(/\D/g, "").slice(0, 8);
const formatZipCode = (value) => {
  const zip = normalizeZipCode(value);
  if (zip.length !== 8) {
    return "";
  }
  return `${zip.slice(0, 5)}-${zip.slice(5)}`;
};

const buildMapUrlFromZipCode = (zipCode, address = "", city = "") => {
  const normalized = normalizeZipCode(zipCode);
  if (normalized.length !== 8) {
    return "";
  }
  const query = [
    formatZipCode(normalized),
    String(address || "").trim(),
    String(city || "").trim(),
    "Brasil",
  ]
    .filter(Boolean)
    .join(", ");
  return `https://maps.google.com/?q=${encodeURIComponent(query)}`;
};

const extractZipCodeFromMapUrl = (mapUrlValue) => {
  const raw = String(mapUrlValue || "").trim();
  if (!raw) {
    return "";
  }
  try {
    const parsed = new URL(raw);
    const query =
      parsed.searchParams.get("query") ||
      parsed.searchParams.get("q") ||
      "";
    const digits = normalizeZipCode(query);
    return digits.length === 8 ? digits : "";
  } catch {
    return "";
  }
};

export default function AdminPartners() {
  useNoIndex();

  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(INITIAL_FORM);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const photoInputRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    setError("");
    apiFetch("/api/motel-partners/admin")
      .then((data) => setPartners(Array.isArray(data) ? data : []))
      .catch((err) =>
        setError(err.message || "Erro ao carregar moteis parceiros.")
      )
      .finally(() => setLoading(false));
  }, []);

  const resetForm = () => {
    setEditingId("");
    setForm(INITIAL_FORM);
    setPhotoError("");
  };

  const handlePickPhoto = () => {
    setPhotoError("");
    photoInputRef.current?.click();
  };

  const handlePhotoInput = async (event) => {
    const selected = event.target.files?.[0];
    event.target.value = "";

    if (!selected) {
      return;
    }

    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(selected.type)) {
      setPhotoError("Use apenas JPG, PNG ou WEBP.");
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      setPhotoError("A imagem deve ter no maximo 10 MB.");
      return;
    }

    const formData = new FormData();
    formData.append("file", selected);

    setPhotoUploading(true);
    setPhotoError("");
    setMessage("");
    setError("");
    try {
      const data = await apiFetch("/api/motel-partners/admin/upload-photo", {
        method: "POST",
        body: formData,
      });
      const uploadedUrl = String(data?.url || "").trim();
      if (!uploadedUrl) {
        throw new Error("Upload sem URL retornada.");
      }
      setForm((current) => ({ ...current, photoUrl: uploadedUrl }));
      setMessage("Foto enviada com sucesso.");
    } catch (err) {
      setPhotoError(err.message || "Erro ao enviar foto.");
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleSubmit = async () => {
    const name = String(form.name || "").trim();
    if (name.length < 2) {
      setError("Informe o nome do motel parceiro.");
      return;
    }

    const displayOrderRaw = Number(form.displayOrder);
    const displayOrder = Number.isFinite(displayOrderRaw)
      ? Math.max(0, Math.min(9999, Math.trunc(displayOrderRaw)))
      : 0;

    setSaving(true);
    setMessage("");
    setError("");

    const payload = {
      name,
      address: form.address,
      city: form.city,
      photoUrl: form.photoUrl,
      mapUrl:
        buildMapUrlFromZipCode(form.zipCode, form.address, form.city) ||
        String(form.mapUrl || "").trim(),
      displayOrder,
      active: form.active,
    };

    try {
      if (editingId) {
        const updated = await apiFetch(`/api/motel-partners/admin/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setPartners((current) =>
          current
            .map((partner) => (partner.id === updated.id ? updated : partner))
            .sort((a, b) => {
              if (a.displayOrder !== b.displayOrder) {
                return a.displayOrder - b.displayOrder;
              }
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            })
        );
        setMessage("Motel parceiro atualizado com sucesso.");
      } else {
        const created = await apiFetch("/api/motel-partners/admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setPartners((current) =>
          [created, ...current].sort((a, b) => {
            if (a.displayOrder !== b.displayOrder) {
              return a.displayOrder - b.displayOrder;
            }
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          })
        );
        setMessage("Motel parceiro cadastrado com sucesso.");
      }
      resetForm();
    } catch (err) {
      setError(err.message || "Erro ao salvar motel parceiro.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (partner) => {
    setEditingId(partner.id);
    setForm({
      name: partner.name || "",
      address: partner.address || "",
      city: partner.city || "",
      zipCode: extractZipCodeFromMapUrl(partner.mapUrl || ""),
      photoUrl: partner.photoUrl || "",
      mapUrl: partner.mapUrl || "",
      displayOrder: String(partner.displayOrder ?? 0),
      active: partner.active !== false,
    });
  };

  const handleToggleActive = async (partner) => {
    setMessage("");
    setError("");
    try {
      const updated = await apiFetch(`/api/motel-partners/admin/${partner.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !partner.active }),
      });
      setPartners((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
    } catch (err) {
      setError(err.message || "Erro ao atualizar status.");
    }
  };

  return (
    <div className="page">
      <h1 className="section-title">
        Moteis <span>parceiros</span>
      </h1>
      <p className="muted" style={{ marginTop: 10 }}>
        Cadastre e edite os parceiros exibidos no rodape do site.
      </p>

      <div className="form-actions" style={{ marginTop: 12 }}>
        <Link to="/admin/aprovacoes" className="btn btn-outline">
          Ir para aprovacoes
        </Link>
      </div>

      {message ? <div className="notice">{message}</div> : null}
      {error ? <div className="notice">{error}</div> : null}
      {photoError ? <div className="notice">{photoError}</div> : null}

      <section className="section" style={{ marginTop: 24 }}>
        <div className="card">
          <h4>{editingId ? "Editar parceiro" : "Novo parceiro"}</h4>
          <div className="form-grid" style={{ marginTop: 12 }}>
            <input
              className="input"
              type="text"
              placeholder="Nome do motel parceiro"
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
            />
            <input
              className="input"
              type="text"
              placeholder="Endereco"
              value={form.address}
              onChange={(event) =>
                setForm((current) => ({ ...current, address: event.target.value }))
              }
            />
            <input
              className="input"
              type="text"
              placeholder="Cidade (ex.: Curitiba - PR)"
              value={form.city}
              onChange={(event) =>
                setForm((current) => ({ ...current, city: event.target.value }))
              }
            />
            <input
              className="input"
              type="text"
              inputMode="numeric"
              placeholder="CEP (somente numeros, opcional)"
              value={form.zipCode}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  zipCode: normalizeZipCode(event.target.value),
                }))
              }
            />
            <input
              className="input"
              type="url"
              placeholder="URL da foto/logo (https://...)"
              value={form.photoUrl}
              onChange={(event) =>
                setForm((current) => ({ ...current, photoUrl: event.target.value }))
              }
            />
            <div style={{ display: "grid", gap: 10 }}>
              <input
                ref={photoInputRef}
                className="media-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoInput}
              />
              <button
                className="btn btn-outline"
                type="button"
                onClick={handlePickPhoto}
                disabled={photoUploading}
              >
                {photoUploading ? "Enviando foto..." : "Escolher foto da galeria"}
              </button>
              <p className="muted">
                Opcional: voce pode colar URL acima ou enviar direto da galeria.
              </p>
            </div>
            <input
              className="input"
              type="url"
              placeholder="URL do mapa (Google Maps). Se vazio, usa o CEP."
              value={form.mapUrl}
              onChange={(event) =>
                setForm((current) => ({ ...current, mapUrl: event.target.value }))
              }
            />
            <input
              className="input"
              type="number"
              min="0"
              max="9999"
              placeholder="Ordem de exibicao"
              value={form.displayOrder}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  displayOrder: event.target.value,
                }))
              }
            />
            <label className="model-register-check" style={{ alignItems: "center" }}>
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    active: event.target.checked,
                  }))
                }
              />
              <span>Ativo (aparece no rodape)</span>
            </label>
          </div>

          <div className="form-actions" style={{ marginTop: 12 }}>
            <button
              className="btn"
              type="button"
              onClick={handleSubmit}
              disabled={saving || photoUploading}
            >
              {saving
                ? "Salvando..."
                : editingId
                ? "Atualizar parceiro"
                : "Cadastrar parceiro"}
            </button>
            {editingId ? (
              <button
                className="btn btn-outline"
                type="button"
                onClick={resetForm}
                disabled={saving}
              >
                Cancelar edicao
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="section" style={{ marginTop: 24 }}>
        {loading ? (
          <p>Carregando parceiros...</p>
        ) : partners.length === 0 ? (
          <p className="muted">Nenhum motel parceiro cadastrado ainda.</p>
        ) : (
          <div className="cards">
            {partners.map((partner) => (
              <div className="card" key={partner.id}>
                <h4>{partner.name}</h4>
                <p className="muted">
                  Ordem: {partner.displayOrder} | {partner.active ? "Ativo" : "Inativo"}
                </p>
                {partner.address ? <p className="muted">{partner.address}</p> : null}
                {partner.city ? <p className="muted">{partner.city}</p> : null}
                {partner.photoUrl ? (
                  <img
                    src={partner.photoUrl}
                    alt={`Foto de ${partner.name}`}
                    style={{ marginTop: 12, borderRadius: 12, maxHeight: 140, objectFit: "cover" }}
                  />
                ) : null}
                {partner.mapUrl ? <p className="muted">Mapa: {partner.mapUrl}</p> : null}
                <div className="form-actions" style={{ marginTop: 10 }}>
                  <button
                    className="btn btn-outline"
                    type="button"
                    onClick={() => handleEdit(partner)}
                  >
                    Editar
                  </button>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => handleToggleActive(partner)}
                  >
                    {partner.active ? "Desativar" : "Ativar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
