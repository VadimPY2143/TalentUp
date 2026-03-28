export interface ChatCreateRequest {
  vacancy_id: number
  resume_id: number
}

export interface ChatResponse {
  id: number
  vacancy_id: number
  resume_id: number | null
  employer_user_id: number
  worker_user_id: number
  last_message_at: string | null
  created_at: string
  updated_at: string
}

export interface MyChatResponse extends ChatResponse {
  unread_count: number
}

export interface MyChatsListResponse {
  chats: MyChatResponse[]
}

export interface ChatMessageResponse {
  id: number
  chat_id: number
  user_id: number
  message: string
  created_at: string
}

export interface ChatMessagesListResponse {
  messages: ChatMessageResponse[]
}

export interface ChatResumeResponse {
  id: number
  user_id: number
  title: string
  summary: string | null
  desired_role: string | null
  employment_type: string[] | null
  location: string | null
  salary_min: number | null
  salary_max: number | null
  salary_currency: string | null
  years_experience: number | null
  is_active: boolean
  pdf_file_path: string | null
  pdf_original_name: string | null
  pdf_size: number | null
  pdf_uploaded_at: string | null
  created_at: string
  updated_at: string
}

export interface ChatSocketMessage {
  type: "message"
  id: number
  chat_id: number
  from_user_id: number
  to_user_id: number
  text: string
  created_at: string
}

export interface ChatSocketError {
  type: "error"
  code: string
  detail: string
}

export interface ChatUiMessage {
  id: string
  serverId?: number
  chatId: number
  userId: number
  text: string
  createdAt: string
  optimistic: boolean
}
