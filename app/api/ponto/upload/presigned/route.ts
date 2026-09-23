import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { generatePresignedUploadUrl } from "@/lib/ponto/s3";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
    }
    const body = await request.json();
    const fileName = body?.fileName ?? "comprovativo";
    const contentType = body?.contentType ?? "application/octet-stream";
    const { uploadUrl, cloud_storage_path } = await generatePresignedUploadUrl(
      fileName,
      contentType,
      false
    );
    return NextResponse.json({ uploadUrl, cloud_storage_path });
  } catch (e) {
    console.error("Erro ao gerar URL de upload:", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}
