import Twilio from "twilio";

const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } =
  process.env;

let twilioClient: ReturnType<typeof Twilio> | null = null;

function getTwilioClient() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    throw new Error("SMS provider not configured.");
  }
  if (!twilioClient) {
    twilioClient = Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  }
  return { client: twilioClient, from: TWILIO_FROM_NUMBER };
}

export async function sendSmsCode(phone: string, code: string) {
  const { client, from } = getTwilioClient();
  const body = `Seu codigo de verificacao e ${code}. Ele expira em 5 minutos.`;
  await client.messages.create({ to: phone, from, body });
}
