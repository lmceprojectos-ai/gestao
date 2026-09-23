import { prisma } from "@/lib/db";

// IPs autorizados por defeito (rede da empresa)
export const DEFAULT_ALLOWED_IPS = [
  { address: "46.189.203.107", label: "Rede da empresa (IPv4)" },
  { address: "2001:4860:7:225::fc", label: "Rede da empresa (IPv6)" },
];

export function getClientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return normalizeIp(first);
  }
  const real = headers.get("x-real-ip");
  if (real) return normalizeIp(real.trim());
  return "desconhecido";
}

export function normalizeIp(ip: string): string {
  if (!ip) return ip;
  // remover prefixo IPv4-mapeado IPv6
  if (ip.startsWith("::ffff:")) return ip.substring(7);
  return ip.toLowerCase();
}

export async function isIpAllowed(ip: string): Promise<boolean> {
  const normalized = normalizeIp(ip);
  const allowed = await prisma.allowedIp.findMany();
  return allowed.some((a) => normalizeIp(a.address) === normalized);
}

export function parseDevice(userAgent: string | null): string {
  if (!userAgent) return "Desconhecido";
  const ua = userAgent;
  let os = "Desconhecido";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";
  let browser = "";
  if (/Edg/i.test(ua)) browser = "Edge";
  else if (/Chrome/i.test(ua)) browser = "Chrome";
  else if (/Firefox/i.test(ua)) browser = "Firefox";
  else if (/Safari/i.test(ua)) browser = "Safari";
  return browser ? `${os} · ${browser}` : os;
}
