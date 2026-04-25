import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { Send, FileText, Briefcase, Check, CheckCheck, MoreVertical, Phone, Video } from "lucide-react"
import type { ChatUiMessage } from "../../types/chat"

interface MessageThreadProps {
  participantLabel: string
  vacancyTitle: string | null
  messages: ChatUiMessage[]
  currentUserId: number | null
  draft: string
  isLoading: boolean
  isSocketReady: boolean
  participantAvatarUrl?: string | null
  isTyping?: boolean
  onOpenVacancy?: () => void
  onOpenResume?: () => void
  onDraftChange: (value: string) => void
  onSend: () => void
}

const formatMessageTime = (value: string) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ""
  return new Intl.DateTimeFormat("uk-UA", { hour: "2-digit", minute: "2-digit" }).format(parsed)
}

const formatMessageDate = (value: string) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ""
  
  const now = new Date()
  const isToday = parsed.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = parsed.toDateString() === yesterday.toDateString()
  
  if (isToday) return "Сьогодні"
  if (isYesterday) return "Вчора"
  
  return new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "long", year: "numeric" }).format(parsed)
}

const getInitials = (name: string) => {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
}

const groupMessagesByDate = (messages: ChatUiMessage[]) => {
  const groups: { date: string; messages: ChatUiMessage[] }[] = []
  let currentGroup: { date: string; messages: ChatUiMessage[] } | null = null
  
  messages.forEach((message) => {
    const date = formatMessageDate(message.createdAt)
    if (!currentGroup || currentGroup.date !== date) {
      currentGroup = { date, messages: [message] }
      groups.push(currentGroup)
    } else {
      currentGroup.messages.push(message)
    }
  })
  
  return groups
}

const MessageStatus = ({ status, isOptimistic }: { status?: string; isOptimistic: boolean }) => {
  if (isOptimistic) {
    return <span className="inline-flex h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />
  }
  if (status === "read") {
    return <CheckCheck className="h-3 w-3 text-emerald-400" />
  }
  if (status === "delivered") {
    return <CheckCheck className="h-3 w-3 text-white/60" />
  }
  return <Check className="h-3 w-3 text-white/60" />
}

const TypingIndicator = () => (
  <div className="flex items-center gap-1 px-1">
    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
    <span className="ml-1 text-xs text-slate-400">друкує...</span>
  </div>
)

export const MessageThread = ({
  participantLabel,
  vacancyTitle,
  messages,
  currentUserId,
  draft,
  isLoading,
  isSocketReady,
  participantAvatarUrl,
  isTyping = false,
  onOpenVacancy,
  onOpenResume,
  onDraftChange,
  onSend,
}: MessageThreadProps) => {
  const listRef = useRef<HTMLDivElement | null>(null)
  const [showOptions, setShowOptions] = useState(false)

  useEffect(() => {
    const node = listRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [messages, isTyping])

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return
    event.preventDefault()
    onSend()
  }

  const messageGroups = groupMessagesByDate(messages)

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-200 bg-white shadow-soft">
      {/* Enhanced Header */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
        <div className="flex items-center gap-3">
          {/* Participant Avatar */}
          <div className="relative">
            {participantAvatarUrl ? (
              <img
                src={participantAvatarUrl}
                alt={participantLabel}
                className="h-10 w-10 rounded-full object-cover border-2 border-slate-100"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#1f2f5e] to-[#3b4d7c] text-sm font-semibold text-white border-2 border-slate-100">
                {getInitials(participantLabel)}
              </div>
            )}
            {isSocketReady && (
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white" />
            )}
          </div>

          <div>
            <h2 className="text-base font-semibold text-slate-900">{participantLabel}</h2>
            <div className="flex items-center gap-2">
              {vacancyTitle && (
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <Briefcase className="h-3 w-3" />
                  {vacancyTitle}
                </p>
              )}
              <span className={`text-xs ${isSocketReady ? "text-emerald-600" : "text-slate-400"}`}>
                {isSocketReady ? "в мережі" : "офлайн"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenResume && (
            <button
              type="button"
              onClick={onOpenResume}
              className="flex items-center gap-1.5 rounded-full border border-[#1f2f5e]/20 bg-[#1f2f5e]/10 px-3 py-1.5 text-[11px] font-semibold text-[#1f2f5e] transition hover:border-[#1f2f5e]/30 hover:bg-[#1f2f5e]/15"
            >
              <FileText className="h-3 w-3" />
              Резюме
            </button>
          )}
          {onOpenVacancy && (
            <button
              type="button"
              onClick={onOpenVacancy}
              className="flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[11px] font-semibold text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100"
            >
              <Briefcase className="h-3 w-3" />
              Вакансія
            </button>
          )}
          
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowOptions(!showOptions)}
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div
        ref={listRef}
        className="min-h-[300px] flex-1 space-y-4 overflow-y-auto bg-gradient-to-b from-[#f6f8ff] to-[#f9fbff] px-4 py-4"
      >
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-orange-500" />
          </div>
        )}

        {!isLoading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-slate-100 p-4">
              <Send className="h-6 w-6 text-slate-400" />
            </div>
            <p className="mt-3 text-sm text-slate-500">Ще немає повідомлень</p>
            <p className="text-xs text-slate-400">Напишіть перше повідомлення</p>
          </div>
        )}

        {!isLoading &&
          messageGroups.map((group) => (
            <div key={group.date} className="space-y-3">
              {/* Date Divider */}
              <div className="flex items-center justify-center py-2">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="mx-3 text-xs font-medium text-slate-400">{group.date}</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              {/* Messages */}
              {group.messages.map((message) => {
                const isOwn = currentUserId !== null && message.userId === currentUserId
                return (
                  <div
                    key={message.id}
                    className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-soft ${
                        isOwn
                          ? "rounded-br-md bg-[#1f2f5e] text-white"
                          : "rounded-bl-md border border-slate-200 bg-white text-slate-800"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{message.text}</p>
                      <div className={`mt-1 flex items-center justify-end gap-1.5 text-[11px] ${isOwn ? "text-white/75" : "text-slate-500"}`}>
                        <span>{formatMessageTime(message.createdAt)}</span>
                        {isOwn && (
                          <MessageStatus status={message.status} isOptimistic={message.optimistic} />
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}

        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 shadow-soft">
              <TypingIndicator />
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-slate-200 p-4">
        <div className="flex items-end gap-3">
          <textarea
            className="min-h-[44px] flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-[#1f2f5e]/40 focus:ring-2 focus:ring-[#1f2f5e]/10"
            placeholder="Напишіть повідомлення... (Enter для відправки, Shift+Enter для нового рядка)"
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
          />
          <button
            type="button"
            onClick={onSend}
            disabled={!draft.trim() || !isSocketReady}
            className="flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            Надіслати
          </button>
        </div>
      </div>
    </section>
  )
}

export default MessageThread
