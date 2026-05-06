import { useMemo, useState } from "react"
import { MessageCircle, Search } from "lucide-react"
import type { ChatMessageResponse, MyChatResponse } from "../../types/chat"

interface ConversationListProps {
  chats: MyChatResponse[]
  selectedChatId: number | null
  previewByChatId: Record<number, ChatMessageResponse | null>
  isLoading: boolean
  onSelect: (chatId: number) => void
  getParticipantLabel: (chat: MyChatResponse) => string
  currentUserRole?: "employer" | "worker" | null
  onOpenWorkerProfile?: (workerUserId: number) => void
}

const formatConversationTime = (value?: string | null) => {
  if (!value) return ""
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ""

  const now = new Date()
  const isToday = parsed.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = yesterday.toDateString() === parsed.toDateString()

  if (isToday) {
    return new Intl.DateTimeFormat("uk-UA", { hour: "2-digit", minute: "2-digit" }).format(parsed)
  }
  if (isYesterday) {
    return "Вчора"
  }
  return new Intl.DateTimeFormat("uk-UA", { day: "2-digit", month: "short" }).format(parsed)
}

const getAvatarUrl = (chat: MyChatResponse, role?: "employer" | "worker" | null) => {
  if (role === "worker") {
    return chat.employer_avatar_url
  }
  return chat.worker_avatar_url
}

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

export const ConversationList = ({
  chats,
  selectedChatId,
  previewByChatId,
  isLoading,
  onSelect,
  getParticipantLabel,
  currentUserRole,
  onOpenWorkerProfile,
}: ConversationListProps) => {
  const [searchQuery, setSearchQuery] = useState("")

  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chats
    const query = searchQuery.toLowerCase()
    return chats.filter((chat) => {
      const label = getParticipantLabel(chat).toLowerCase()
      const preview = previewByChatId[chat.id]?.message?.toLowerCase() || ""
      return label.includes(query) || preview.includes(query)
    })
  }, [chats, searchQuery, previewByChatId, getParticipantLabel])

  const totalUnread = useMemo(() => chats.reduce((sum, chat) => sum + (chat.unread_count || 0), 0), [chats])

  return (
    <aside className="flex h-full min-h-0 w-full flex-col rounded-2xl border border-slate-200 bg-white shadow-soft">
      <div className="border-b border-slate-200 px-4 py-4">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-[#1f2f5e]" />
          <h2 className="text-lg font-semibold text-slate-900">Повідомлення</h2>
          {totalUnread > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 text-[11px] font-semibold text-white">
              {totalUnread}
            </span>
          )}
        </div>

        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Пошук чатів..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-[#1f2f5e]/30 focus:bg-white"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading && (
          <div className="px-4 py-6 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-orange-500" />
            <p className="mt-2 text-sm text-slate-500">Завантаження діалогів...</p>
          </div>
        )}

        {!isLoading && filteredChats.length === 0 && (
          <div className="px-4 py-6 text-center">
            <MessageCircle className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-2 text-sm text-slate-500">
              {searchQuery ? "Немає результатів пошуку" : "У вас ще немає чатів"}
            </p>
            {!searchQuery && (
              <p className="mt-1 text-xs text-slate-400">Почніть розмову з картки кандидата або вакансії</p>
            )}
          </div>
        )}

        {!isLoading &&
          filteredChats.map((chat) => {
            const isActive = chat.id === selectedChatId
            const preview = previewByChatId[chat.id]
            const previewText = preview?.message ?? "Немає повідомлень"
            const previewTimestamp = preview?.created_at ?? chat.last_message_at ?? chat.created_at
            const avatarUrl = getAvatarUrl(chat, currentUserRole)
            const label = getParticipantLabel(chat)
            const hasUnread = (chat.unread_count || 0) > 0

            return (
              <button
                key={chat.id}
                type="button"
                onClick={() => onSelect(chat.id)}
                className={`w-full border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 ${
                  isActive ? "bg-gradient-to-r from-[#eef3ff] to-[#f8faff]" : "bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={label}
                        className="h-11 w-11 rounded-full border-2 border-white object-cover shadow-sm"
                      />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-[#1f2f5e] to-[#3b4d7c] text-sm font-semibold text-white shadow-sm">
                        {getInitials(label)}
                      </div>
                    )}
                    {hasUnread && !isActive && (
                      <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-orange-500" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`truncate text-sm font-semibold ${hasUnread && !isActive ? "text-slate-900" : "text-slate-700"}`}>
                        {currentUserRole === "employer" && chat.worker_name && onOpenWorkerProfile ? (
                          <span
                            className="cursor-pointer text-indigo-700 underline underline-offset-2 transition hover:text-indigo-800"
                            role="button"
                            tabIndex={0}
                            onClick={(event) => {
                              event.stopPropagation()
                              onOpenWorkerProfile(chat.worker_user_id)
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault()
                                event.stopPropagation()
                                onOpenWorkerProfile(chat.worker_user_id)
                              }
                            }}
                          >
                            {chat.worker_name}
                          </span>
                        ) : (
                          label
                        )}
                      </p>
                      <span className="shrink-0 text-[11px] text-slate-400">{formatConversationTime(previewTimestamp)}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <p className={`line-clamp-1 text-xs ${hasUnread && !isActive ? "font-medium text-slate-700" : "text-slate-500"}`}>
                        {previewText}
                      </p>
                      {chat.unread_count > 0 && (
                        <span className="ml-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-orange-500 px-1.5 text-[10px] font-semibold text-white">
                          {chat.unread_count > 99 ? "99+" : chat.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
      </div>
    </aside>
  )
}

export default ConversationList
