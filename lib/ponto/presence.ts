import crypto from "crypto";
import { prisma } from "@/lib/db";

// Controlo de presença por QR code rotativo.
// O administrador mostra um QR num ecrã/tablet à entrada da empresa.
// O QR muda a cada 30 segundos, impedindo que uma fotografia do código
// seja reutilizada mais tarde ou fora das instalações.

const SECRET_KEY = "presence_secret";
export const REQUIRE_QR_KEY = "require_qr";

// Janela de tempo de cada código (em milissegundos).
export const QR_WINDOW_MS = 30 * 1000;

// Obtém (ou cria) o segredo usado para assinar os tokens de presença.
export async function getPresenceSecret(): Promise<string> {
  const existing = await prisma.setting.findUnique({ where: { key: SECRET_KEY } });
  if (existing?.value) return existing.value;
  const secret = crypto.randomBytes(32).toString("hex");
  await prisma.setting.upsert({
    where: { key: SECRET_KEY },
    update: { value: secret },
    create: { key: SECRET_KEY, value: secret },
  });
  return secret;
}

// Gera um novo segredo (invalida imediatamente todos os QR anteriores).
export async function regeneratePresenceSecret(): Promise<string> {
  const secret = crypto.randomBytes(32).toString("hex");
  await prisma.setting.upsert({
    where: { key: SECRET_KEY },
    update: { value: secret },
    create: { key: SECRET_KEY, value: secret },
  });
  return secret;
}

function windowToken(secret: string, windowIndex: number): string {
  return crypto
    .createHmac("sha256", secret)
    .update(String(windowIndex))
    .digest("hex")
    .slice(0, 24);
}

// Token correspondente à janela de tempo atual.
export async function currentQrToken(): Promise<{ token: string; window: number }> {
  const secret = await getPresenceSecret();
  const windowIndex = Math.floor(Date.now() / QR_WINDOW_MS);
  return { token: windowToken(secret, windowIndex), window: windowIndex };
}

// Verifica um token aceitando a janela atual e a imediatamente anterior
// (tolerância de ~30-60s para o tempo que o colaborador demora a marcar).
export async function verifyQrToken(token: string | undefined | null): Promise<boolean> {
  if (!token || typeof token !== "string") return false;
  const secret = await getPresenceSecret();
  const windowIndex = Math.floor(Date.now() / QR_WINDOW_MS);
  for (const w of [windowIndex, windowIndex - 1, windowIndex - 2]) {
    const expected = windowToken(secret, w);
    if (
      expected.length === token.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token))
    ) {
      return true;
    }
  }
  return false;
}

// Indica se é obrigatório marcar através de QR.
export async function isQrRequired(): Promise<boolean> {
  const s = await prisma.setting.findUnique({ where: { key: REQUIRE_QR_KEY } });
  return s?.value === "true";
}

export async function setQrRequired(value: boolean): Promise<void> {
  await prisma.setting.upsert({
    where: { key: REQUIRE_QR_KEY },
    update: { value: value ? "true" : "false" },
    create: { key: REQUIRE_QR_KEY, value: value ? "true" : "false" },
  });
}
