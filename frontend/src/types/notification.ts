export interface Notification {
  id: number
  user_id: number
  type: string
  title: string
  body: string | null
  entity_type: string | null
  entity_id: number | null
  payload_json: Record<string, unknown> | null
  is_read: boolean
  read_at: string | null
  created_at: string
}

export interface NotificationListResponse {
  notifications: Notification[]
  next_cursor: string | null
}

export interface UnreadCountResponse {
  unread_count: number
}

export type NotificationSocketEvent =
  | { type: "notification_created"; notification: Notification }
  | { type: "notification_enqueued"; payload: Record<string, unknown> }
  | { type: string; [key: string]: unknown }

