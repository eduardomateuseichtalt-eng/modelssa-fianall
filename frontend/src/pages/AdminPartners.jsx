import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { useNoIndex } from "../lib/useNoIndex";

const INITIAL_FORM = {
  name: "",
  address: "",
  city: "",
  phone: "",
  priceText: "",
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

const normalizeSearchText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export default function AdminPartners() {
  useNoIndex();

  const [partners, setPartners] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(INITIAL_FORM);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const photoInputRef = useRef(null);
  const editorRef = useRef(null);
  const nameInputRef = useRef(null);

  const filteredPartners = useMemo(() => {
    const term = normalizeSearchText(search);
    if (!term) {
      return partners;
    }

    return partners.filter((partner) =>
      [partner.name, partner.city, partner.address, partner.phone]
        .map(normalizeSearchText)
        .some((value) => value.includes(term))
    );
  }, [partners, search]);

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

  const scrollToEditor = () => {
    window.requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      nameInputRef.current?.focus({ preventScroll: true });
    });
  };

  const handleNewPartner = () => {
    resetForm();
    setMessage("");
    setError("");
    scrollToEditor();
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
      phone: form.phone,
      priceText: form.priceText,
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
    setMessage("");
    setError("");
    setPhotoError("");
    setEditingId(partner.id);
    setForm({
      name: partner.name || "",
      address: partner.address || "",
      city: partner.city || "",
      phone: partner.phone || "",
      priceText: partner.priceText || "",
      zipCode: extractZipCodeFromMapUrl(partner.mapUrl || ""),
      photoUrl: partner.photoUrl || "",
      mapUrl: partner.mapUrl || "",
      displayOrder: String(partner.displayOrder ?? 0),
      active: partner.active !== false,
    });
    scrollToEditor();
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
        Pesquise, cadastre e edite os parceiros exibidos no rodape do site.
      </p>

      <div className="form-actions" style={{ marginTop: 12 }}>
        <Link to="/admin/aprovacoes" className="btn btn-outline">
          Ir para aprovacoes
        </Link>
      </div>

      {message ? <div className="notice">{message}</div> : null}
      {error ? <div className="notice">{error}</div> : null}
      {photoError ? <div className="notice">{photoError}</div> : null}

      <section className="section admin-partners-list" style={{ marginTop: 24 }}>
        <div className="admin-partners-toolbar card">
          <div>
            <h4>Todos os moteis parceiros</h4>
            <p className="muted">
              Digite o nome do motel para encontra-lo e fazer alteracoes.
            </p>
          </div>
          <button className="btn" type="button" onClick={handleNewPartner}>
            Cadastrar novo motel
          </button>
        </div>

        <div className="admin-partners-search">
          <label htmlFor="partner-search">Pesquisar motel parceiro</label>
          <div className="admin-partners-search-row">
            <input
              id="partner-search"
              className="input"
              type="search"
              placeholder="Digite o nome, cidade ou endereco..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              autoComplete="off"
            />
            {search ? (
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => setSearch("")}
              >
                Limpar busca
              </button>
            ) : null}
          </div>
          {!loading && partners.length > 0 ? (
            <p className="muted admin-partners-result-count" aria-live="polite">
              {filteredPartners.length === partners.length
                ? `${partners.length} parceiro(s) cadastrado(s)`
                : `${filteredPartners.length} de ${partners.length} parceiro(s) encontrado(s)`}
            </p>
          ) : null}
        </div>

        {loading ? (
          <p>Carregando parceiros...</p>
        ) : partners.length === 0 ? (
          <p className="muted admin-partners-empty">
            Nenhum motel parceiro cadastrado ainda.
          </p>
        ) : filteredPartners.length === 0 ? (
          <div className="card admin-partners-empty">
            <h4>Nenhum motel encontrado</h4>
            <p className="muted">
              Confira o nome digitado ou limpe a busca para ver todos os parceiros.
            </p>
            <button
              className="btn btn-outline"
              type="button"
              onClick={() => setSearch("")}
            >
              Ver todos os moteis
            </button>
          </div>
        ) : (
          <div className="cards admin-partners-grid">
            {filteredPartners.map((partner) => (
              <div
                className={`card admin-partner-card ${
                  editingId === partner.id ? "admin-partner-card--editing" : ""
                }`}
                key={partner.id}
              >
                <div className="admin-partner-card-heading">
                  <h4>{partner.name}</h4>
                  <span
                    className={`admin-partner-status ${
                      partner.active ? "is-active" : "is-inactive"
                    }`}
                  >
                    {partner.active ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <p className="muted">Ordem de exibicao: {partner.displayOrder}</p>
                {partner.address ? <p className="muted">{partner.address}</p> : null}
                {partner.city ? <p className="muted">{partner.city}</p> : null}
                {partner.phone ? (
                  <p className="muted">Telefone/WhatsApp: {partner.phone}</p>
                ) : null}
                {partner.priceText ? (
                  <p className="muted">Valor: {partner.priceText}</p>
                ) : null}
                {partner.photoUrl ? (
                  <img
                    src={partner.photoUrl}
                    alt={`Foto de ${partner.name}`}
                    className="admin-partner-photo"
                  />
                ) : null}
                <div className="form-actions admin-partner-actions">
                  <button
                    className="btn btn-outline"
                    type="button"
                    onClick={() => handleEdit(partner)}
                  >
                    Editar dados
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

      <section
        ref={editorRef}
        className="section admin-partner-editor"
        style={{ marginTop: 24 }}
      >
        <div className="card">
          <h4>{editingId ? "Editar motel parceiro" : "Novo motel parceiro"}</h4>
          {editingId ? (
            <p className="muted">
              Altere os campos desejados e clique em atualizar parceiro.
            </p>
          ) : null}
          <div className="form-grid" style={{ marginTop: 12 }}>
            <input
              ref={nameInputRef}
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
              placeholder="Telefone/WhatsApp (ex.: (41) 99999-9999)"
              value={form.phone}
              onChange={(event) =>
                setForm((current) => ({ ...current, phone: event.target.value }))
              }
            />
            <input
              className="input"
              type="text"
              placeholder="Valor (ex.: a partir de R$ 120)"
              value={form.priceText}
              onChange={(event) =>
                setForm((current) => ({ ...current, priceText: event.target.value }))
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
    </div>
  );
}
