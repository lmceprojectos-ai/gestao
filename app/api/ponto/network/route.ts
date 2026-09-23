import { NextResponse } from "next/server";
import { getClientIp, isIpAllowed, parseDevice } from "@/lib/ponto/ip";
import { isQrRequired } from "@/lib/ponto/presence";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const ip = getClientIp(request.headers);
    const allowed = await isIpAllowed(ip);
    const device = parseDevice(request.headers.get("user-agent"));
    const requireQr = await isQrRequired();
    return NextResponse.json({ ip, allowed, device, requireQr });
  } catch (e) {
    console.error("Erro ao verificar rede:", e);
    return NextResponse.json(
      { ip: "desconhecido", allowed: false, device: "Desconhecido", requireQr: false },
      { status: 200 }
    );
  }
}
