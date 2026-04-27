// ─── Chat types ─────────────────────────────────────────────────────────────

export interface ChatUser {
  id: string
  full_name: string
  avatar_url?: string
}

export interface ChatMessage {
  id: string
  conversation_id: string
  sender_id: string
  sender?: ChatUser
  content: string
  type: 'text' | 'image' | 'file'
  file_url?: string
  is_read: boolean
  is_deleted: boolean
  created_at: string
}

export interface Conversation {
  id: string
  client_id: string
  participant_id: string
  other_user?: ChatUser
  task_id?: string
  task_title?: string
  last_message?: ChatMessage
  unread_count: number
  last_message_at: string
  created_at: string
}

// WebSocket frame types received from backend
export type WsFrame =
  | { type: 'message';        data: ChatMessage }
  | { type: 'message_deleted'; data: { message_id: string } }
  | { type: 'read_receipt';   data: { conversation_id: string; reader_id: string } }
  | { type: 'typing';         data: { user_id: string; full_name: string } }
  | { type: 'stop_typing';    data: { user_id: string } }
  | { type: 'error';          data: { detail: string } }
  | { type: 'pong' }
