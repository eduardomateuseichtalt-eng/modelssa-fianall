type SendModelRegisterOtpParams = {
  to: string;
  code: string;
};

function buildOtpEmailHtml(code: string) {
  return `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
      <h2 style="margin: 0 0 12px;">Confirmacao de e-mail</h2>
      <p style="margin: 0 0 12px;">
        Use o codigo abaixo para continuar seu cadastro de modelo no models-club:
      </p>
      <div
        style="
          display: inline-block;
          padding: 12px 18px;
          border-radius: 10px;
          background: #111827;
          color: #ffffff;
          font-size: 24px;
          font-weight: 700;
          letter-spacing: 0.2em;
        "
      >
        ${code}
      </div>
      <p style="margin: 14px 0 0; color: #6b7280; font-size: 13px;">
        Este codigo expira em alguns minutos. Se voce nao solicitou este cadastro, ignore este e-mail.
      </p>
    </div>
  `;
}

export async function sendModelRegisterOtpEmail({
  to,
  code,
}: SendModelRegisterOtpParams) {
  const resendApiKey = String(process.env.RESEND_API_KEY || "").trim();
  const from = String(process.env.EMAIL_FROM || "").trim();

  if (!resendApiKey || !from) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Provedor de e-mail nao configurado.");
    }
    console.log(`[DEV EMAIL OTP] models-club -> ${to}: codigo ${code}`);
    return { provider: "console-dev" as const };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: "Codigo de confirmacao - models-club",
        html: buildOtpEmailHtml(code),
        text: `Seu codigo de confirmacao no models-club e: ${code}`,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Falha ao enviar e-mail (${response.status}) ${body}`.trim());
    }

    return { provider: "resend" as const };
  } finally {
    clearTimeout(timeout);
  }
}
