import { prisma } from '@/lib/db'

/**
 * Envia uma mensagem para o Telegram configurado nas Settings.
 * Retorna true se enviou com sucesso, false caso contrário.
 * Não lança exceções — falhas são silenciosas (logged).
 */
export async function sendTelegramMessage(text: string): Promise<boolean> {
  try {
    const settings = await prisma.conexusSettings.findUnique({ where: { id: 'default' } })
    if (!settings?.telegramBotToken || !settings?.telegramChatId) {
      return false
    }
    const response = await fetch(
      `https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: settings.telegramChatId,
          text,
          parse_mode: 'Markdown',
        }),
      }
    )
    let result = await response.json()
    // Títulos com _ * [ ` partem o Markdown do Telegram: reenviar sem formatação.
    if (!result?.ok && /parse entities/i.test(String(result?.description ?? ''))) {
      const simples = await fetch(`https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: settings.telegramChatId, text: text.replace(/\*/g, '') }),
      })
      result = await simples.json()
    }
    if (!result?.ok) {
      console.error('Telegram sendMessage falhou:', result?.description)
    }
    return result?.ok === true
  } catch (err: any) {
    console.error('Erro ao enviar mensagem Telegram:', err?.message)
    return false
  }
}
