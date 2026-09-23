import { NextResponse } from "next/server";
import { requirePresenceViewer } from "@/lib/ponto/admin-guard";
import {
  currentQrToken,
  isQrRequired,
  setQrRequired,
  regeneratePresenceSecret,
  QR_WINDOW_MS,
} from "@/lib/ponto/presence";

export const dynamic = "force-dynamic";

// Devolve o estado atual do controlo de presença e o token QR em vigor.
export async function GET() {
  const guard = await requirePresenceViewer();
  if (!guard.ok)
    return NextResponse.json({ message: guard.message }, { status: guard.status });
  const [{ token, window }, requireQr] = await Promise.all([
    currentQrToken(),
    isQrRequired(),
  ]);
  // Milissegundos restantes até o QR mudar.
  const msLeft = QR_WINDOW_MS - (Date.now() % QR_WINDOW_MS);
  return NextResponse.json({
    token,
    window,
    requireQr,
    windowMs: QR_WINDOW_MS,
    msLeft,
  });
}

// Atualiza as definições do controlo de presença.
export async function PATCH(request: Request) {
  const guard = await requirePresenceViewer();
  if (!guard.ok)
    return NextResponse.json({ message: guard.message }, { status: guard.status });
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body?.requireQr === "boolean") {
      await setQrRequired(body.requireQr);
    }
    if (body?.regenerate === true) {
      await regeneratePresenceSecret();
    }
    const requireQr = await isQrRequired();
    return NextResponse.json({ success: true, requireQr });
  } catch (e) {
    console.error("Erro ao atualizar definições de presença:", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}
