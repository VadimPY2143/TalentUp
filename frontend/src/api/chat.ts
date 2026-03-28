import { API_URL, apiFetch } from "./client"
import type {
  ChatCreateRequest,
  ChatMessagesListResponse,
  ChatResumeResponse,
  ChatResponse,
  MyChatResponse,
  MyChatsListResponse,
} from "../types/chat"

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "")

export const listMyChats = async (): Promise<MyChatResponse[]> => {
  const data = await apiFetch<MyChatsListResponse>("/chat/my")
  return data?.chats ?? []
}

export const createChat = (payload: ChatCreateRequest) => {
  return apiFetch<ChatResponse>("/chat", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export const listChatMessages = (
  chatId: number,
  limit = 50,
  offset = 0,
) => {
  return apiFetch<ChatMessagesListResponse>(`/chat/${chatId}/messages?limit=${limit}&offset=${offset}`)
}

export const getChatWorkerResume = (chatId: number) => {
  return apiFetch<ChatResumeResponse>(`/chat/${chatId}/resume`)
}

export const buildChatWebSocketUrl = (chatId: number, token: string) => {
  const httpBase = trimTrailingSlash(API_URL)
  const wsBase = httpBase.startsWith("https://")
    ? `wss://${httpBase.slice("https://".length)}`
    : httpBase.startsWith("http://")
      ? `ws://${httpBase.slice("http://".length)}`
      : httpBase
  return `${wsBase}/chat/ws/${chatId}?token=${encodeURIComponent(token)}`
}
