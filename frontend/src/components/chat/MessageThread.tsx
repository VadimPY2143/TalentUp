import { useEffect, useRef, type KeyboardEvent } from "react"
import type { ChatUiMessage } from "../../types/chat"

interface MessageThreadProps {
  participantLabel: string
  vacancyTitle: string | null
  messages: ChatUiMessage[]
  currentUserId: number | null
  draft: string
  isLoading: boolean
  isSocketReady: boolean
  onOpenVacancy?: () => void
  onOpenResume?: () => void
  onDraftChange: (value: string) => void
  onSend: () => void
}

const formatMessageTime = (value: string) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return ""
  }
  return new Intl.DateTimeFormat("uk-UA", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed)
}

export const MessageThread = ({
  participantLabel,
  vacancyTitle,
  messages,
  currentUserId,
  draft,
  isLoading,
  isSocketReady,
  onOpenVacancy,
  onOpenResume,
  onDraftChange,
  onSend,
}: MessageThreadProps) => {
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const node = listRef.current
    if (!node) {
      return
    }
    node.scrollTop = node.scrollHeight
  }, [messages])

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return
    }
    event.preventDefault()
    onSend()
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-200 bg-white shadow-soft">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Direct chat</p>
          <h2 className="mt-1 text-base font-semibold text-slate-900">{participantLabel}</h2>
          {vacancyTitle && (
            <p className="mt-1 text-xs text-slate-500">
              Вакансія: {vacancyTitle}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onOpenResume && (
            <button
              type="button"
              onClick={onOpenResume}
              className="rounded-full border border-[#1f2f5e]/20 bg-[#1f2f5e]/10 px-3 py-1 text-[11px] font-semibold text-[#1f2f5e] transition hover:border-[#1f2f5e]/30 hover:bg-[#1f2f5e]/15"
            >
              Відкрити резюме
            </button>
          )}
          {onOpenVacancy && (
            <button
              type="button"
              onClick={onOpenVacancy}
              className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100"
            >
              Відкрити вакансію
            </button>
          )}
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              isSocketReady
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isSocketReady ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
            {isSocketReady ? "Online" : "Connecting"}
          </span>
        </div>
      </div>

      <div
        ref={listRef}
        className="min-h-[300px] flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-[#f6f8ff] to-[#f9fbff] px-4 py-4"
      >
        {isLoading && <div className="text-sm text-slate-500">Завантаження історії...</div>}
        {!isLoading && messages.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 px-4 py-6 text-center text-sm text-slate-500">
            Ще немає повідомлень. Напишіть перше повідомлення кандидату.
          </div>
        )}
        {!isLoading &&
          messages.map((message) => {
            const isOwn = currentUserId !== null && message.userId === currentUserId
            return (
              <div
                key={message.id}
                className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm shadow-soft ${
                    isOwn
                      ? "rounded-br-md bg-[#1f2f5e] text-white"
                      : "rounded-bl-md border border-slate-200 bg-white text-slate-800"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{message.text}</p>
                  <div
                    className={`mt-1 flex items-center justify-end gap-1 text-[11px] ${
                      isOwn ? "text-white/75" : "text-slate-500"
                    }`}
                  >
                    {message.optimistic && (
                      <span className="inline-flex h-1.5 w-1.5 rounded-full bg-orange-400" />
                    )}
                    <span>{formatMessageTime(message.createdAt)}</span>
                  </div>
                </div>
              </div>
            )
          })}
      </div>

      <div className="border-t border-slate-200 p-4">
        <div className="flex items-end gap-3">
          <textarea
            className="min-h-[44px] flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-orange-400/70"
            placeholder="Напишіть повідомлення..."
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
          />
          <button
            type="button"
            onClick={onSend}
            disabled={!draft.trim() || !isSocketReady}
            className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Надіслати
          </button>
        </div>
      </div>
    </section>
  )
}

export default MessageThread
