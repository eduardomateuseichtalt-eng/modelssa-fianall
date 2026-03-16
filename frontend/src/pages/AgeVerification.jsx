import { useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";

const AGE_TOKEN_STORAGE_KEY = "modelsClubAgeToken";
const AGE_TOKEN_EXP_STORAGE_KEY = "modelsClubAgeTokenExpiresAt";

const getReturnPath = (search) => {
  const params = new URLSearchParams(search || "");
  const rawReturn = params.get("return");
  if (!rawReturn) {
    return "/modelos";
  }
  if (!rawReturn.startsWith("/")) {
    return "/modelos";
  }
  return rawReturn;
};

export default function AgeVerification() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const returnPath = useMemo(() => getReturnPath(search), [search]);
  const [step, setStep] = useState("intro");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef(null);

  const handleConfirmAge = () => {
    setErrorMessage("");
    setStep("photo");
  };

  const requestCameraPhoto = () => {
    setErrorMessage("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handlePhotoSelected = async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      setErrorMessage("Precisamos da sua foto para liberar o conteudo.");
      return;
    }
    setIsSaving(true);
    setErrorMessage("");

    try {
      const formData = new FormData();
      formData.append("photo", file);
      const data = await apiFetch("/api/media/age-verification", {
        method: "POST",
        body: formData,
      });

      if (!data?.token) {
        throw new Error("Nao foi possivel confirmar a idade.");
      }

      try {
        localStorage.setItem(AGE_TOKEN_STORAGE_KEY, String(data.token));
        if (data.expiresAt) {
          localStorage.setItem(AGE_TOKEN_EXP_STORAGE_KEY, String(data.expiresAt));
        }
      } catch {
        // ignore localStorage errors
      }

      setStep("done");
    } catch (err) {
      setErrorMessage(err?.message || "Nao foi possivel confirmar a idade.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="page age-verify-page">
      <div className="age-verify-card">
        <div className="age-verify-header">
          <span className="age-verify-badge">18+</span>
          <div className="age-verify-title">
            <h1>Verificacao de idade</h1>
            <span className="age-verify-legal">Lei ECA / n&deg; 15.211</span>
          </div>
        </div>

        {step === "intro" ? (
          <>
            <h2>Vamos confirmar a sua idade?</h2>
            <p className="age-verify-description">
              Para acessar todo o conteudo do models-club, precisamos realizar uma
              verificacao facial e confirmar sua idade.
            </p>
            <ul className="age-verify-list">
              <li>Processo rapido (leva poucos segundos)</li>
              <li>Seguro e criptografado</li>
              <li>Nao armazenamos nenhum dado seu</li>
              <li>E totalmente anonimo</li>
            </ul>
            <button type="button" className="btn age-verify-button" onClick={handleConfirmAge}>
              Confirmar idade
            </button>
          </>
        ) : null}

        {step === "photo" ? (
          <>
            <h2>Precisamos de uma foto</h2>
            <p className="age-verify-description">
              Para liberar o conteudo, permita o acesso a camera e envie uma foto
              do momento atual.
            </p>
            <div className="age-verify-actions">
              <button
                type="button"
                className="btn age-verify-button"
                onClick={requestCameraPhoto}
                disabled={isSaving}
              >
                {isSaving ? "Processando..." : "Enviar foto"}
              </button>
              <button
                type="button"
                className="btn btn-outline age-verify-secondary"
                onClick={() => navigate(returnPath)}
                disabled={isSaving}
              >
                Voltar
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="user"
              onChange={handlePhotoSelected}
              style={{ display: "none" }}
            />
            {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
          </>
        ) : null}

        {step === "done" ? (
          <>
            <h2>Idade confirmada</h2>
            <p className="age-verify-description">
              Tudo certo. Agora voce pode acessar as fotos e videos.
            </p>
            <button type="button" className="btn age-verify-button" onClick={() => navigate(returnPath)}>
              Voltar ao perfil
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
