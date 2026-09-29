'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'

/**
 * Componente invisível que corre enquanto a app está aberta no navegador.
 * Substitui as tarefas agendadas pagas, mantendo a mesma funcionalidade a custo zero.
 *
 * Faz duas coisas:
 * 1. A cada 60 segundos verifica e envia lembretes pendentes (POST /api/telegram/reminders).
 * 2. Uma vez por dia (na primeira abertura) dispara o resumo diário
 *    (POST /api/telegram/daily-digest), que também executa a passagem automática
 *    de tarefas e notas pessoais em atraso.
 *
 * Usa localStorage para garantir que o resumo diário só é enviado 1× por dia,
 * mesmo que vários separadores estejam abertos.
 */
export function ReminderChecker() {
  const { data: session } = useSession()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const checkReminders = useCallback(async () => {
    try {
      await fetch('/api/conexus/telegram/reminders', { method: 'POST' })
    } catch {
      // silencioso
    }
  }, [])

  const checkDailyDigest = useCallback(async () => {
    try {
      const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Lisbon' })
      const lastDigest = localStorage.getItem('lastDailyDigest')
      if (lastDigest === todayStr) return // já enviado hoje

      const res = await fetch('/api/conexus/telegram/daily-digest', { method: 'POST' })
      if (res.ok) {
        localStorage.setItem('lastDailyDigest', todayStr)
      }
    } catch {
      // silencioso — tenta novamente no próximo ciclo
    }
  }, [])

  useEffect(() => {
    if (!session?.user) return

    // Verificar imediatamente ao montar
    checkReminders()
    checkDailyDigest()

    // Depois verificar a cada 60 segundos
    intervalRef.current = setInterval(() => {
      checkReminders()
      checkDailyDigest()
    }, 60_000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [session?.user, checkReminders, checkDailyDigest])

  return null // componente invisível
}
