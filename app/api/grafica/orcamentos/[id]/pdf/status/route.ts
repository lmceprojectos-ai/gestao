export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const { request_id } = await req.json();
    const statusResponse = await fetch('https://apps.abacus.ai/api/getConvertHtmlToPdfStatus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_id, deployment_token: process.env.ABACUSAI_API_KEY }),
    });
    const statusResult = await statusResponse.json();
    const status = statusResult?.status || 'FAILED';
    const result = statusResult?.result || null;
    if (status === 'SUCCESS') {
      if (result && result.result) {
        return NextResponse.json({ status, pdf_base64: result.result });
      }
      return NextResponse.json({ status: 'FAILED', error: 'PDF gerado sem dados' });
    }
    if (status === 'FAILED') {
      return NextResponse.json({ status, error: result?.error || 'Falha na geração do PDF' });
    }
    return NextResponse.json({ status });
  } catch (error: any) {
    console.error('PDF status error:', error);
    return NextResponse.json({ status: 'FAILED', error: 'Falha ao verificar estado do PDF' }, { status: 500 });
  }
}
