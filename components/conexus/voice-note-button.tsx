'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Mic, Square } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface VoiceNoteButtonProps {
  onTranscription: (text: string) => void
  className?: string
  size?: 'sm' | 'md'
}

export function VoiceNoteButton({ onTranscription, className, size = 'sm' }: VoiceNoteButtonProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef<any>(null)
  // Accumulated final text across multiple utterance sessions
  const accumulatedRef = useRef('')
  // Whether the user wants to keep recording (hasn't pressed stop)
  const wantRecordingRef = useRef(false)
  const onTranscriptionRef = useRef(onTranscription)
  onTranscriptionRef.current = onTranscription

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    setIsSupported(!!SR)
  }, [])

  const createRecognition = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return null

    const recognition = new SR()
    recognition.lang = 'pt-PT'
    // Single-utterance mode: stops after a natural pause
    // This avoids the duplication bug in continuous mode
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    return recognition
  }, [])

  const startSession = useCallback(() => {
    const recognition = createRecognition()
    if (!recognition) {
      toast.error('O seu navegador não suporta gravação de voz')
      return
    }

    let sessionFinal = ''

    recognition.onresult = (event: any) => {
      let interim = ''
      let finalText = ''
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalText += result[0].transcript
        } else {
          interim += result[0].transcript
        }
      }
      sessionFinal = finalText
      // Show accumulated text from previous sessions + current session
      const display = (accumulatedRef.current + ' ' + (finalText || interim)).trim()
      setTranscript(display)
    }

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error)
      if (event.error === 'not-allowed') {
        toast.error('Permissão de microfone negada. Permita o acesso ao microfone nas definições do navegador.')
        wantRecordingRef.current = false
        setIsRecording(false)
      } else if (event.error === 'no-speech') {
        // Will auto-restart in onend if user still wants recording
      } else if (event.error !== 'aborted') {
        toast.error('Erro no reconhecimento de voz')
      }
    }

    recognition.onend = () => {
      // Append this session's final result to accumulated text
      if (sessionFinal.trim()) {
        accumulatedRef.current = (accumulatedRef.current + ' ' + sessionFinal).trim()
      }

      if (wantRecordingRef.current) {
        // User hasn't pressed stop — restart for next utterance
        // Small delay to avoid rapid restarts on errors
        setTimeout(() => {
          if (wantRecordingRef.current) {
            startSession()
          }
        }, 100)
      } else {
        // User pressed stop — deliver final result
        const text = accumulatedRef.current.trim()
        if (text) {
          onTranscriptionRef.current(text)
          toast.success('Nota de voz criada', {
            description: text.length > 60 ? text.substring(0, 60) + '...' : text,
          })
        } else {
          toast.info('Nenhuma fala detetada')
        }
        accumulatedRef.current = ''
        setTranscript('')
        setIsRecording(false)
        recognitionRef.current = null
      }
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [createRecognition])

  const handleClick = useCallback(() => {
    if (isRecording) {
      // User wants to stop
      wantRecordingRef.current = false
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    } else {
      // User wants to start
      accumulatedRef.current = ''
      wantRecordingRef.current = true
      setIsRecording(true)
      setTranscript('')
      startSession()
    }
  }, [isRecording, startSession])

  if (!isSupported) {
    return null
  }

  const sizeClasses = size === 'sm'
    ? 'h-9 w-9 min-w-[36px]'
    : 'h-10 w-10 min-w-[40px]'

  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        type="button"
        title={isRecording ? 'Parar gravação' : 'Nota de voz'}
        className={cn(
          'rounded-lg flex items-center justify-center transition-all duration-200',
          sizeClasses,
          isRecording
            ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30 animate-pulse'
            : 'bg-purple-100 hover:bg-purple-200 text-purple-700',
          className
        )}
      >
        {isRecording ? (
          <Square className={iconSize} />
        ) : (
          <Mic className={iconSize} />
        )}
      </button>

      {/* Floating transcript preview */}
      {isRecording && transcript && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-card border border-border rounded-lg shadow-xl p-3 min-w-[200px] max-w-[300px] z-50">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] font-medium text-red-600 uppercase tracking-wider">A gravar...</span>
          </div>
          <p className="text-sm text-foreground leading-relaxed">{transcript}</p>
        </div>
      )}
    </div>
  )
}
