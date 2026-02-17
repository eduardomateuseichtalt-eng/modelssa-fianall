export async function sendWhatsAppText(toDigits: string, body: string) {
  const token = process.env.WHATSAPP_TOKEN!;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!;

  if (!token || !phoneNumberId) {
    throw new Error("WhatsApp não configurado (WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID).");
  }

  const payload = {
    messaging_product: "whatsapp",
    to: toDigits,
    type: "text",
    text: { body },
  };

  const r = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const out = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(`Falha WhatsApp: ${JSON.stringify(out)}`);
  }

  return out;
}
