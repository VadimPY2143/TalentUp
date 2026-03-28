import type { ChatMessageResponse, MyChatResponse } from "../../types/chat"

interface ConversationListProps {
  chats: MyChatResponse[]
  selectedChatId: number | null
  previewByChatId: Record<number, ChatMessageResponse | null>
  isLoading: boolean
  onSelect: (chatId: number) => void
  getParticipantLabel: (chat: MyChatResponse) => string
}

const formatConversationTime = (value?: string | null) => {
  if (!value) {
    return ""
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return ""
  }
  return new Intl.DateTimeFormat("uk-UA", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  }).format(parsed)
}

export const ConversationList = ({
  chats,
  selectedChatId,
  previewByChatId,
  isLoading,
  onSelect,
  getParticipantLabel,
}: ConversationListProps) => {
  return (
    <aside className="flex h-full min-h-0 w-full max-w-full flex-col rounded-2xl border border-slate-200 bg-white shadow-soft lg:max-w-[360px]">
      <div className="border-b border-slate-200 px-4 py-3">
        <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Messages</p>
        <h2 className="mt-1 font-display text-lg font-semibold text-slate-900">Conversations</h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading && (
          <div className="px-4 py-4 text-sm text-slate-500">Завантаження діалогів...</div>
        )}
        {!isLoading && chats.length === 0 && (
          <div className="px-4 py-4 text-sm text-slate-500">
            У вас ще немає чатів. Почніть розмову з картки кандидата.
          </div>
        )}
        {!isLoading &&
          chats.map((chat) => {
            const isActive = chat.id === selectedChatId
            const preview = previewByChatId[chat.id]
            const previewText = preview?.message ?? "Немає повідомлень"
            const previewTimestamp = preview?.created_at ?? chat.last_message_at ?? chat.created_at
            return (
              <button
                key={chat.id}
                type="button"
                onClick={() => onSelect(chat.id)}
                className={`w-full border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 ${
                  isActive
                    ? "bg-[#eef3ff]"
                    : "bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-slate-900">{getParticipantLabel(chat)}</p>
                  <span className="shrink-0 text-[11px] text-slate-500">
                    {formatConversationTime(previewTimestamp)}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <p className="line-clamp-1 text-xs text-slate-600">{previewText}</p>
                  {chat.unread_count > 0 && (
                    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 text-[10px] font-semibold text-white">
                      {chat.unread_count}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
      </div>
    </aside>
  )
}

export default ConversationList
