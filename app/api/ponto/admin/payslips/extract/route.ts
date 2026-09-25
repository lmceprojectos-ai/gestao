import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/ponto/admin-guard";
import { iaConfigurada, perguntarIA } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Recebe um PDF de recibos e extrai, via LLM, os valores de cada colaborador.
export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok)
    return NextResponse.json({ message: guard.message }, { status: guard.status });

  try {
    if (!iaConfigurada()) {
      return NextResponse.json(
        { message: "Serviço de leitura indisponível (chave em falta)." },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ message: "Nenhum ficheiro recebido." }, { status: 400 });
    }
    if (file.type && !file.type.includes("pdf")) {
      return NextResponse.json({ message: "O ficheiro tem de ser um PDF." }, { status: 400 });
    }

    const buf = await file.arrayBuffer();
    const base64 = Buffer.from(buf).toString("base64");

    const instructions = `És um assistente que lê recibos de remunerações (folhas de salário) portugueses em PDF.
O PDF pode conter vários recibos (um por colaborador) e cada recibo pode aparecer repetido (duplicado). Considera cada colaborador UMA única vez.
Extrai, para cada colaborador, os seguintes valores (usa números com ponto decimal, sem símbolo de euro, sem separador de milhares):
- employeeNumber: número do colaborador no recibo (ex.: "00002"), ou null
- name: nome completo do colaborador
- category: função/categoria (ex.: "Ajudante Impressão", "Sócio-Gerente"), ou null
- salarioBase: valor do "Salário Base"
- vencimentoBase: valor do abono "Vencimento Base"
- subsAlimentacao: valor do "Subsídio Alimentação" (0 se não existir)
- subsFerias: valor do "Subsidio Ferias" (0 se não existir)
- subsNatal: valor do "Subsidio Natal" (0 se não existir)
- outrosAbonos: soma de outros abonos não incluídos acima (0 se não existir)
- totalFaltas: soma (em valor absoluto positivo) dos descontos por faltas (0 se não existir)
- segSocial: valor do desconto "Segurança Social"
- irs: valor total do desconto "Imposto s/Rendimento" (IRS); soma as linhas de IRS se houver mais do que uma
- outrosDescontos: outros descontos não incluídos acima (0 se não existir)
- totalIliquido: valor do "Total Ilíquido"
- totalDescontos: valor do "Total de Descontos"
- liquido: valor do "Líquido a receber"
Indica também o mês do recibo no formato AAAA-MM (campo "month"), a partir da data do recibo (ex.: 30/06/2026 -> 2026-06).
Responde APENAS com JSON puro, sem markdown nem texto adicional, com esta estrutura exata:
{
  "month": "AAAA-MM",
  "entries": [
    {"employeeNumber": "00002", "name": "Nome", "category": "Função", "salarioBase": 0, "vencimentoBase": 0, "subsAlimentacao": 0, "subsFerias": 0, "subsNatal": 0, "outrosAbonos": 0, "totalFaltas": 0, "segSocial": 0, "irs": 0, "outrosDescontos": 0, "totalIliquido": 0, "totalDescontos": 0, "liquido": 0}
  ]
}`;

    let content = "";
    try {
      content = await perguntarIA({ prompt: instructions, anexos: [{ tipo: "pdf", base64 }], esforco: "low" });
    } catch (e: any) {
      console.error("Erro do serviço de leitura de PDF:", e?.message);
      return NextResponse.json(
        { message: "Não foi possível ler o PDF. Tente novamente ou insira os valores manualmente." },
        { status: 502 }
      );
    }
    let parsed: any;
    try {
      const clean = String(content).replace(/```json/gi, "").replace(/```/g, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      console.error("Resposta não-JSON do serviço de leitura:", content);
      return NextResponse.json(
        { message: "Não foi possível interpretar o PDF. Insira os valores manualmente." },
        { status: 502 }
      );
    }

    const num = (v: any) => {
      const n = typeof v === "number" ? v : parseFloat(String(v ?? "0").replace(",", "."));
      return Number.isFinite(n) ? n : 0;
    };
    const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
    const normalized = entries
      .filter((e: any) => e?.name)
      .map((e: any) => ({
        employeeNumber: e.employeeNumber ?? null,
        name: String(e.name).trim(),
        category: e.category ?? null,
        salarioBase: num(e.salarioBase),
        vencimentoBase: num(e.vencimentoBase),
        subsAlimentacao: num(e.subsAlimentacao),
        subsFerias: num(e.subsFerias),
        subsNatal: num(e.subsNatal),
        outrosAbonos: num(e.outrosAbonos),
        totalFaltas: num(e.totalFaltas),
        segSocial: num(e.segSocial),
        irs: num(e.irs),
        outrosDescontos: num(e.outrosDescontos),
        totalIliquido: num(e.totalIliquido),
        totalDescontos: num(e.totalDescontos),
        liquido: num(e.liquido),
      }));

    return NextResponse.json({
      success: true,
      month: typeof parsed?.month === "string" ? parsed.month : "",
      entries: normalized,
    });
  } catch (e) {
    console.error("Erro ao extrair recibos:", e);
    return NextResponse.json({ message: "Erro ao processar o PDF." }, { status: 500 });
  }
}
