import { useMemo, useState } from "react";
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

const appendAgeTokenToReturnPath = (path, token, expiresAt) => {
  const rawPath = String(path || "/modelos");
  const [withoutHash, hashPart] = rawPath.split("#");
  const [pathnamePart, searchPart] = withoutHash.split("?");
  const params = new URLSearchParams(searchPart || "");
  params.set("ageToken", token);
  if (expiresAt) {
    params.set("ageTokenExpiresAt", String(expiresAt));
  }
  const query = params.toString();
  const hash = hashPart ? `#${hashPart}` : "";
  return `${pathnamePart || "/modelos"}${query ? `?${query}` : ""}${hash}`;
};

export default function AgeVerification() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const returnPath = useMemo(() => getReturnPath(search), [search]);
  const [step, setStep] = useState("intro");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [verifiedToken, setVerifiedToken] = useState("");
  const [verifiedTokenExpiresAt, setVerifiedTokenExpiresAt] = useState("");
  const verifiedReturnPath = useMemo(() => {
    if (!verifiedToken) {
      return returnPath;
    }
    return appendAgeTokenToReturnPath(returnPath, verifiedToken, verifiedTokenExpiresAt);
  }, [returnPath, verifiedToken, verifiedTokenExpiresAt]);

  const handleConfirmAge = async () => {
    setIsSaving(true);
    setErrorMessage("");

    try {
      const data = await apiFetch("/api/media/age-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmedAdult: true }),
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

      setVerifiedToken(String(data.token));
      setVerifiedTokenExpiresAt(String(data.expiresAt || ""));
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
            <h1>Confirmacao de maioridade</h1>
            <span className="age-verify-legal">Conteudo destinado a maiores de 18 anos</span>
          </div>
        </div>

        {step === "intro" ? (
          <>
            <h2>Voce tem 18 anos ou mais?</h2>
            <p className="age-verify-description">
              Para acessar o conteudo adulto, confirme que voce e maior de idade.
            </p>
            <ul className="age-verify-list">
              <li>Nenhuma foto ou documento sera solicitado</li>
              <li>Sua confirmacao fica valida neste dispositivo</li>
              <li>O acesso e proibido para menores de 18 anos</li>
            </ul>
            <button
              type="button"
              className="btn age-verify-button"
              onClick={handleConfirmAge}
              disabled={isSaving}
            >
              {isSaving ? "Confirmando..." : "Declaro que tenho 18 anos ou mais"}
            </button>
            <button
              type="button"
              className="btn btn-outline age-verify-secondary"
              onClick={() => navigate("/")}
              disabled={isSaving}
            >
              Sair
            </button>
            {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
          </>
        ) : null}

        {step === "done" ? (
          <>
            <h2>Idade confirmada</h2>
            <p className="age-verify-description">
              Tudo certo. Agora voce pode acessar as fotos e videos.
            </p>
            <button
              type="button"
              className="btn age-verify-button"
              onClick={() => navigate(verifiedReturnPath)}
            >
              Voltar ao perfil
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
