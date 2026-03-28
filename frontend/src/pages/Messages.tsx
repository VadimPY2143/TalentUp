import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import ConversationList from "../components/chat/ConversationList"
import MessageThread from "../components/chat/MessageThread"
import ResumeModal from "../components/ResumeModal"
import VacancyModal from "../components/VacancyModal"
import Navbar from "../components/layout/Navbar"
import { buildChatWebSocketUrl, createChat, getChatWorkerResume, listChatMessages, listMyChats } from "../api/chat"
import { listCompanies } from "../api/companies"
import { openResumePdf } from "../api/resumes"
import { getVacancyById, listCompanyVacancies } from "../api/vacancies"
import { useAuth } from "../auth/useAuth"
import type {
  ChatMessageResponse,
  ChatResumeResponse,
  ChatSocketMessage,
  ChatUiMessage,
  MyChatResponse,
} from "../types/chat"
import type { VacancyResponse } from "../types/vacancy"

const sortChatsByRecent = (chats: MyChatResponse[]) => {
  return [...chats].sort((a, b) => {
    const aTime = Date.parse(a.last_message_at ?? a.created_at) || 0
    const bTime = Date.parse(b.last_message_at ?? b.created_at) || 0
    return bTime - aTime
  })
}

const currentUserIdByRole = (chat: MyChatResponse, role: "employer" | "worker" | null) => {
  return role === "worker" ? chat.worker_user_id : chat.employer_user_id
}

const participantUserIdByRole = (chat: MyChatResponse, role: "employer" | "worker" | null) => {
  return role === "worker" ? chat.employer_user_id : chat.worker_user_id
}

const toUiMessages = (chatId: number, messages: ChatMessageResponse[]): ChatUiMessage[] => {
  return [...messages]
    .reverse()
    .map((item) => ({
      id: `server-${item.id}`,
      serverId: item.id,
      chatId,
      userId: item.user_id,
      text: item.message,
      createdAt: item.created_at,
      optimistic: false,
    }))
}

const toPreviewMessage = (payload: ChatSocketMessage): ChatMessageResponse => ({
  id: payload.id,
  chat_id: payload.chat_id,
  user_id: payload.from_user_id,
  message: payload.text,
  created_at: payload.created_at,
})

const Messages = () => {
  const { role, token } = useAuth()
  const isEmployer = role === "employer"
  const [searchParams] = useSearchParams()
  const resumeId = Number(searchParams.get("resumeId"))
  const vacancyId = Number(searchParams.get("vacancyId"))
  const normalizedResumeId =
    Number.isFinite(resumeId) && resumeId > 0 ? resumeId : null
  const normalizedVacancyId =
    Number.isFinite(vacancyId) && vacancyId > 0 ? vacancyId : null

  const [chats, setChats] = useState<MyChatResponse[]>([])
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null)
  const [previewByChatId, setPreviewByChatId] = useState<Record<number, ChatMessageResponse | null>>({})
  const [messagesByChatId, setMessagesByChatId] = useState<Record<number, ChatUiMessage[]>>({})
  const [vacancies, setVacancies] = useState<VacancyResponse[]>([])
  const [chatVacancyById, setChatVacancyById] = useState<Record<number, VacancyResponse>>({})
  const [selectedVacancyId, setSelectedVacancyId] = useState<number | null>(null)
  const [draft, setDraft] = useState("")
  const [chatError, setChatError] = useState<string | null>(null)
  const [isChatsLoading, setIsChatsLoading] = useState(false)
  const [isMessagesLoading, setIsMessagesLoading] = useState(false)
  const [isVacanciesLoading, setIsVacanciesLoading] = useState(false)
  const [isSocketReady, setIsSocketReady] = useState(false)
  const [openedVacancy, setOpenedVacancy] = useState<VacancyResponse | null>(null)
  const [openedResume, setOpenedResume] = useState<ChatResumeResponse | null>(null)

  const socketRef = useRef<WebSocket | null>(null)
  const chatsRef = useRef<MyChatResponse[]>([])
  const vacancyMapRef = useRef<Record<number, VacancyResponse>>({})
  const autoOpenHandledRef = useRef<number | null>(null)

  useEffect(() => {
    chatsRef.current = chats
  }, [chats])

  useEffect(() => {
    vacancyMapRef.current = chatVacancyById
  }, [chatVacancyById])

  const loadVacancyContextForChats = useCallback(async (nextChats: MyChatResponse[]) => {
    const vacancyIds = Array.from(new Set(nextChats.map((chat) => chat.vacancy_id)))
    const missingIds = vacancyIds.filter((vacancyId) => !vacancyMapRef.current[vacancyId])
    if (!missingIds.length) {
      return
    }
    const resolved = await Promise.all(
      missingIds.map(async (vacancyId) => {
        try {
          const vacancy = await getVacancyById(vacancyId)
          return vacancy
        } catch {
          return null
        }
      }),
    )
    const mapped = resolved.filter((item): item is VacancyResponse => item !== null)
    if (!mapped.length) {
      return
    }
    setChatVacancyById((prev) => {
      const next = { ...prev }
      for (const vacancy of mapped) {
        next[vacancy.id] = vacancy
      }
      return next
    })
  }, [])

  const getParticipantLabel = useCallback(
    (chat: MyChatResponse) => {
      const participantId = participantUserIdByRole(chat, role)
      const vacancyTitle = chatVacancyById[chat.vacancy_id]?.title
      if (role === "worker") {
        return vacancyTitle || `Employer #${participantId}`
      }
      return vacancyTitle ? `${vacancyTitle} · Candidate #${participantId}` : `Candidate #${participantId}`
    },
    [chatVacancyById, role],
  )

  const visibleChats = useMemo(() => {
    if (!isEmployer || selectedVacancyId === null) {
      return chats
    }
    return chats.filter((chat) => chat.vacancy_id === selectedVacancyId)
  }, [chats, isEmployer, selectedVacancyId])

  const selectedChat = useMemo(
    () => visibleChats.find((chat) => chat.id === selectedChatId) ?? null,
    [visibleChats, selectedChatId],
  )

  const activeMessages = useMemo(() => {
    if (!selectedChatId) {
      return []
    }
    return messagesByChatId[selectedChatId] ?? []
  }, [messagesByChatId, selectedChatId])

  const loadChatsAndPreviews = useCallback(async () => {
    setIsChatsLoading(true)
    setChatError(null)
    try {
      const fetchedChats = await listMyChats()
      const sortedChats = sortChatsByRecent(fetchedChats)
      setChats(sortedChats)
      void loadVacancyContextForChats(sortedChats)
      setSelectedChatId((prev) => prev ?? sortedChats[0]?.id ?? null)

      const previewEntries = await Promise.all(
        sortedChats.map(async (chat) => {
          try {
            const data = await listChatMessages(chat.id, 1, 0)
            return [chat.id, data.messages[0] ?? null] as const
          } catch {
            return [chat.id, null] as const
          }
        }),
      )

      const nextPreviewMap: Record<number, ChatMessageResponse | null> = {}
      for (const [chatId, preview] of previewEntries) {
        nextPreviewMap[chatId] = preview
      }
      setPreviewByChatId(nextPreviewMap)
      return sortedChats
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не вдалося завантажити чати"
      setChatError(message)
      return []
    } finally {
      setIsChatsLoading(false)
    }
  }, [loadVacancyContextForChats])

  const openOrCreateConversation = useCallback(
    async (resumeIdToOpen: number) => {
      if (!isEmployer) {
        return null
      }
      const existingChat = chatsRef.current.find(
        (chat) => chat.resume_id === resumeIdToOpen && chat.vacancy_id === selectedVacancyId,
      )
      if (existingChat) {
        setSelectedChatId(existingChat.id)
        return existingChat.id
      }

      if (!selectedVacancyId) {
        setChatError("Щоб почати чат, створіть вакансію та оберіть її зверху.")
        return null
      }

      try {
        const created = await createChat({
          vacancy_id: selectedVacancyId,
          resume_id: resumeIdToOpen,
        })
        const createdChat: MyChatResponse = {
          ...created,
          unread_count: 0,
        }
        setChats((prev) => sortChatsByRecent([createdChat, ...prev.filter((chat) => chat.id !== created.id)]))
        void loadVacancyContextForChats([createdChat])
        setPreviewByChatId((prev) => ({ ...prev, [created.id]: null }))
        setSelectedChatId(created.id)
        return created.id
      } catch (err) {
        const detail = err instanceof Error ? err.message : "Не вдалося створити чат"
        if (detail === "Chat already exists") {
          const refreshedChats = await loadChatsAndPreviews()
          const matched = refreshedChats.find(
            (chat) => chat.resume_id === resumeIdToOpen && chat.vacancy_id === selectedVacancyId,
          )
          if (matched) {
            setSelectedChatId(matched.id)
            return matched.id
          }
        }
        setChatError(detail)
        return null
      }
    },
    [isEmployer, loadChatsAndPreviews, loadVacancyContextForChats, selectedVacancyId],
  )

  useEffect(() => {
    void loadChatsAndPreviews()
  }, [loadChatsAndPreviews])

  useEffect(() => {
    let isMounted = true
    if (!isEmployer) {
      setVacancies([])
      setSelectedVacancyId(null)
      setIsVacanciesLoading(false)
      return () => {
        isMounted = false
      }
    }
    const loadVacancies = async () => {
      setIsVacanciesLoading(true)
      try {
        const companies = await listCompanies()
        if (!isMounted) {
          return
        }
        const primaryCompanyId = companies[0]?.id
        if (!primaryCompanyId) {
          setVacancies([])
          setSelectedVacancyId(null)
          return
        }
        const companyVacancies = await listCompanyVacancies(primaryCompanyId)
        if (!isMounted) {
          return
        }
        setVacancies(companyVacancies)
        const vacancyFromQueryExists =
          normalizedVacancyId !== null && companyVacancies.some((vacancy) => vacancy.id === normalizedVacancyId)
        setSelectedVacancyId(vacancyFromQueryExists ? normalizedVacancyId : (companyVacancies[0]?.id ?? null))
      } catch (err) {
        if (!isMounted) {
          return
        }
        const message = err instanceof Error ? err.message : "Не вдалося завантажити вакансії"
        setChatError(message)
      } finally {
        if (isMounted) {
          setIsVacanciesLoading(false)
        }
      }
    }

    void loadVacancies()
    return () => {
      isMounted = false
    }
  }, [isEmployer, normalizedVacancyId])

  useEffect(() => {
    if (!selectedChatId) {
      return
    }
    let isMounted = true
    setIsMessagesLoading(true)
    setChatError(null)

    const loadHistory = async () => {
      try {
        const data = await listChatMessages(selectedChatId, 100, 0)
        if (!isMounted) {
          return
        }
        setMessagesByChatId((prev) => ({
          ...prev,
          [selectedChatId]: toUiMessages(selectedChatId, data.messages),
        }))
        setPreviewByChatId((prev) => ({
          ...prev,
          [selectedChatId]: data.messages[0] ?? null,
        }))
        setChats((prev) =>
          sortChatsByRecent(
            prev.map((chat) => (chat.id === selectedChatId ? { ...chat, unread_count: 0 } : chat)),
          ),
        )
      } catch (err) {
        if (!isMounted) {
          return
        }
        const message = err instanceof Error ? err.message : "Не вдалося завантажити повідомлення"
        setChatError(message)
      } finally {
        if (isMounted) {
          setIsMessagesLoading(false)
        }
      }
    }

    void loadHistory()
    return () => {
      isMounted = false
    }
  }, [selectedChatId])

  useEffect(() => {
    if (!isEmployer) {
      return
    }
    if (!normalizedResumeId) {
      return
    }
    if (!selectedVacancyId) {
      return
    }
    if (autoOpenHandledRef.current === normalizedResumeId) {
      return
    }
    if (isChatsLoading || isVacanciesLoading) {
      return
    }
    void (async () => {
      const chatId = await openOrCreateConversation(normalizedResumeId)
      if (chatId) {
        autoOpenHandledRef.current = normalizedResumeId
      }
    })()
  }, [
    isChatsLoading,
    isEmployer,
    isVacanciesLoading,
    normalizedResumeId,
    openOrCreateConversation,
    selectedVacancyId,
  ])

  useEffect(() => {
    if (!visibleChats.length) {
      if (selectedChatId !== null) {
        setSelectedChatId(null)
      }
      return
    }
    if (selectedChatId === null) {
      setSelectedChatId(visibleChats[0].id)
      return
    }
    const isSelectedVisible = visibleChats.some((chat) => chat.id === selectedChatId)
    if (!isSelectedVisible) {
      setSelectedChatId(visibleChats[0].id)
    }
  }, [selectedChatId, visibleChats])

  useEffect(() => {
    if (!selectedChatId || !token) {
      setIsSocketReady(false)
      return
    }

    const ws = new WebSocket(buildChatWebSocketUrl(selectedChatId, token))
    socketRef.current = ws

    ws.onopen = () => {
      setIsSocketReady(true)
      setChatError(null)
    }

    ws.onmessage = (event) => {
      let payload: unknown
      try {
        payload = JSON.parse(event.data)
      } catch {
        return
      }

      if (!payload || typeof payload !== "object") {
        return
      }

      const envelope = payload as { type?: string; detail?: string }
      if (envelope.type === "error") {
        if (typeof envelope.detail === "string") {
          setChatError(envelope.detail)
        }
        return
      }

      if (envelope.type !== "message") {
        return
      }

      const messagePayload = payload as ChatSocketMessage
      const chat = chatsRef.current.find((item) => item.id === messagePayload.chat_id)
      if (!chat) {
        void loadChatsAndPreviews()
        return
      }

      const ownUserId = currentUserIdByRole(chat, role)
      const isOwnMessage = messagePayload.from_user_id === ownUserId
      const incoming: ChatUiMessage = {
        id: `server-${messagePayload.id}`,
        serverId: messagePayload.id,
        chatId: messagePayload.chat_id,
        userId: messagePayload.from_user_id,
        text: messagePayload.text,
        createdAt: messagePayload.created_at,
        optimistic: false,
      }

      setMessagesByChatId((prev) => {
        const current = prev[messagePayload.chat_id] ?? []
        if (current.some((item) => item.serverId === incoming.serverId)) {
          return prev
        }
        const next = [...current]
        if (isOwnMessage) {
          const optimisticIndex = next.findIndex(
            (item) =>
              item.optimistic &&
              item.userId === incoming.userId &&
              item.chatId === incoming.chatId &&
              item.text === incoming.text,
          )
          if (optimisticIndex >= 0) {
            next[optimisticIndex] = incoming
          } else {
            next.push(incoming)
          }
        } else {
          next.push(incoming)
        }
        next.sort((a, b) => (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0))
        return { ...prev, [messagePayload.chat_id]: next }
      })

      setPreviewByChatId((prev) => ({
        ...prev,
        [messagePayload.chat_id]: toPreviewMessage(messagePayload),
      }))

      setChats((prev) =>
        sortChatsByRecent(
          prev.map((item) => {
            if (item.id !== messagePayload.chat_id) {
              return item
            }
            const nextUnread =
              selectedChatId === messagePayload.chat_id || isOwnMessage
                ? 0
                : item.unread_count + 1
            return {
              ...item,
              unread_count: nextUnread,
              last_message_at: messagePayload.created_at,
            }
          }),
        ),
      )
    }

    ws.onclose = () => {
      setIsSocketReady(false)
    }

    ws.onerror = () => {
      setIsSocketReady(false)
    }

    return () => {
      ws.close()
      if (socketRef.current === ws) {
        socketRef.current = null
      }
      setIsSocketReady(false)
    }
  }, [loadChatsAndPreviews, role, selectedChatId, token])

  const handleSend = () => {
    if (!selectedChat || !selectedChatId) {
      return
    }
    const text = draft.trim()
    if (!text) {
      return
    }
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setChatError("Немає активного зʼєднання. Спробуйте ще раз за кілька секунд.")
      return
    }

    const ownUserId = currentUserIdByRole(selectedChat, role)
    const peerUserId = participantUserIdByRole(selectedChat, role)
    const optimisticMessage: ChatUiMessage = {
      id: `temp-${Date.now()}`,
      chatId: selectedChatId,
      userId: ownUserId,
      text,
      createdAt: new Date().toISOString(),
      optimistic: true,
    }

    setMessagesByChatId((prev) => {
      const current = prev[selectedChatId] ?? []
      return {
        ...prev,
        [selectedChatId]: [...current, optimisticMessage],
      }
    })

    setPreviewByChatId((prev) => ({
      ...prev,
      [selectedChatId]: {
        id: 0,
        chat_id: selectedChatId,
        user_id: ownUserId,
        message: text,
        created_at: optimisticMessage.createdAt,
      },
    }))

    setChats((prev) =>
      sortChatsByRecent(
        prev.map((chat) =>
          chat.id === selectedChatId
            ? {
                ...chat,
                last_message_at: optimisticMessage.createdAt,
              }
            : chat,
        ),
      ),
    )
    setDraft("")
    setChatError(null)

    socket.send(
      JSON.stringify({
        type: "message",
        text,
        to_user_id: peerUserId,
      }),
    )
  }

  const selectedParticipantLabel = selectedChat ? getParticipantLabel(selectedChat) : "Select conversation"
  const currentUserId = selectedChat ? currentUserIdByRole(selectedChat, role) : null
  const selectedVacancy = selectedChat ? chatVacancyById[selectedChat.vacancy_id] ?? null : null

  const handleOpenVacancy = async () => {
    if (!selectedChat) {
      return
    }
    if (selectedVacancy) {
      setOpenedVacancy(selectedVacancy)
      return
    }
    try {
      const vacancy = await getVacancyById(selectedChat.vacancy_id)
      setChatVacancyById((prev) => ({ ...prev, [vacancy.id]: vacancy }))
      setOpenedVacancy(vacancy)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не вдалося відкрити вакансію"
      setChatError(message)
    }
  }

  const handleOpenResume = async () => {
    if (!selectedChat) {
      return
    }
    try {
      const resume = await getChatWorkerResume(selectedChat.id)
      setOpenedResume(resume)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не вдалося відкрити резюме"
      setChatError(message)
    }
  }

  const handleOpenResumePdf = async () => {
    if (!openedResume?.pdf_file_path) {
      return
    }
    try {
      await openResumePdf(openedResume.id)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не вдалося відкрити PDF"
      setChatError(message)
    }
  }

  return (
    <div className="min-h-screen bg-[#e9edf4]">
      <Navbar />
      <main className="mx-auto max-w-[1240px] px-4 pb-10 pt-8">
        <section className="rounded-[28px] bg-gradient-to-r from-[#0b1736] via-[#13244d] to-[#243b77] p-6 text-white shadow-medium">
          <p className="text-xs uppercase tracking-[0.35em] text-white/60">
            {isEmployer ? "Employer inbox" : "Candidate inbox"}
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold md:text-3xl">
            {isEmployer ? "Messaging with candidates" : "Messaging with employers"}
          </h1>
          <p className="mt-2 text-sm text-white/75">
            {isEmployer
              ? "Починайте діалоги з картки кандидата, ведіть переписку та перемикайтеся між усіма розмовами в одному місці."
              : "Відповідайте роботодавцям у реальному часі та переглядайте всю історію листування в одному місці."}
          </p>
          {isEmployer ? (
            <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
              <label className="text-xs font-semibold uppercase tracking-wide text-white/75">
                Вакансія для нового чату
              </label>
              <select
                className="max-w-full rounded-xl border border-white/30 bg-white/95 px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400/70 md:min-w-[320px]"
                value={selectedVacancyId ?? ""}
                onChange={(event) => setSelectedVacancyId(event.target.value ? Number(event.target.value) : null)}
                disabled={isVacanciesLoading}
              >
                <option value="">Всі вакансії</option>
                {!vacancies.length && <option value="">Немає доступних вакансій</option>}
                {vacancies.map((vacancy) => (
                  <option key={vacancy.id} value={vacancy.id}>
                    {vacancy.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void loadChatsAndPreviews()}
                className="rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                Оновити чати
              </button>
            </div>
          ) : (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => void loadChatsAndPreviews()}
                className="rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                Оновити чати
              </button>
            </div>
          )}
        </section>

        {chatError && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {chatError}
          </div>
        )}

        <section className="mt-6 grid gap-4 lg:grid-cols-[360px,1fr]">
          <ConversationList
            chats={visibleChats}
            selectedChatId={selectedChatId}
            previewByChatId={previewByChatId}
            isLoading={isChatsLoading}
            onSelect={setSelectedChatId}
            getParticipantLabel={getParticipantLabel}
          />
          {selectedChat ? (
            <MessageThread
              participantLabel={selectedParticipantLabel}
              vacancyTitle={selectedVacancy?.title ?? null}
              messages={activeMessages}
              currentUserId={currentUserId}
              draft={draft}
              isLoading={isMessagesLoading}
              isSocketReady={isSocketReady}
              onOpenVacancy={role === "worker" ? () => void handleOpenVacancy() : undefined}
              onOpenResume={role === "employer" ? () => void handleOpenResume() : undefined}
              onDraftChange={setDraft}
              onSend={handleSend}
            />
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-soft">
              Оберіть діалог зліва або відкрийте його з картки кандидата.
            </div>
          )}
        </section>
      </main>
      <VacancyModal
        vacancy={openedVacancy}
        onClose={() => setOpenedVacancy(null)}
        onApply={() => setOpenedVacancy(null)}
        showApplyButton={false}
      />
      <ResumeModal
        resume={openedResume}
        onClose={() => setOpenedResume(null)}
        onOpenPdf={() => void handleOpenResumePdf()}
      />
    </div>
  )
}

export default Messages
