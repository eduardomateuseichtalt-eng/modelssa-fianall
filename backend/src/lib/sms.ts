// src/lib/sms.ts
const {
  WA_TOKEN,
  WA_PHONE_NUMBER_ID,
  WA_TEMPLATE_NAME,
  WA_TEMPLATE_LANG,
} = process.env;

function assertConfig() {
  if (!WA_TOKEN || !WA_PHONE_NUMBER_ID || !WA_TEMPLATE_NAME || !WA_TEMPLATE_LANG) {
    throw new Error("WhatsApp provider not configured.");
  }
}

/**
 * Mantemos o nome sendSmsCode para não mexer em mais nada do sistema.
 * Aqui, "phone" deve vir em E.164, exemplo: +5549999999999
 */
export async function sendSmsCode(phone: string, code: string) {
  assertConfig();

  // Cloud API espera número sem "+" na maioria dos casos como string, mas aceita com.
  // Vamos padronizar removendo o "+".
  const to = phone.replace(/^\+/, "");

  const url = `https://graph.facebook.com/v20.0/${WA_PHONE_NUMBER_ID}/messages`;

  // IMPORTANTE: template precisa existir e estar aprovado na WABA
  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: WA_TEMPLATE_NAME,
      language: { code: WA_TEMPLATE_LANG },
      components: [
        {
          type: "body",
          parameters: [{ type: "text", text: code }],
        },
      ],
    },
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`WhatsApp send failed: ${resp.status} ${text}`);
  }
}
