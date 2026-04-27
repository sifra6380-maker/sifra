import { useEffect, useRef, useCallback, useState } from 'react'
import type { WsFrame, ChatMessage } from '../types/chat'

interface UseChatSocketOptions {
  conversationId: string | null
  onMessage: (msg: ChatMessage) => void
  onMessageDeleted: (msgId: string) => void
  onReadReceipt: (readerId: string) => void
  onTyping: (userId: string, name: string) => void
  onStopTyping: (userId: string) => void
}

export function useChatSocket({
  conversationId,
  onMessage,
  onMessageDeleted,
  onReadReceipt,
  onTyping,
  onStopTyping,
}: UseChatSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [connected, setConnected] = useState(false)

  const connect = useCallback(() => {
    if (!conversationId) return

    const token = localStorage.getItem('access_token')
    if (!token) return

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    // In dev Vite proxies /ws → localhost:8000; in prod nginx handles it
    const url = `${proto}://${window.location.host}/ws/chat/${conversationId}?token=${token}`

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send('ping')
      }, 25000)
    }

    ws.onmessage = (event) => {
      try {
        const frame: WsFrame = JSON.parse(event.data)
        switch (frame.type) {
          case 'message':
            onMessage(frame.data)
            break
          case 'message_deleted':
            onMessageDeleted(frame.data.message_id)
            break
          case 'read_receipt':
            onReadReceipt(frame.data.reader_id)
            break
          case 'typing':
            onTyping(frame.data.user_id, frame.data.full_name)
            break
          case 'stop_typing':
            onStopTyping(frame.data.user_id)
            break
          case 'pong':
            break
          case 'error':
            console.warn('[Chat WS] Server error:', frame.data.detail)
            break
        }
      } catch (e) {
        console.warn('[Chat WS] Parse error', e)
      }
    }

    ws.onclose = () => {
      setConnected(false)
      if (pingRef.current) clearInterval(pingRef.current)
      // Auto-reconnect after 3s
      reconnectRef.current = setTimeout(connect, 3000)
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [conversationId])

  useEffect(() => {
    connect()
    return () => {
      if (wsRef.current) wsRef.current.close()
      if (pingRef.current) clearInterval(pingRef.current)
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
    }
  }, [connect])

  const sendFrame = useCallback((payload: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload))
    }
  }, [])

  const sendMessage = useCallback((content: string) => {
    sendFrame({ type: 'message', content })
  }, [sendFrame])

  const sendTyping = useCallback(() => {
    sendFrame({ type: 'typing' })
  }, [sendFrame])

  const sendStopTyping = useCallback(() => {
    sendFrame({ type: 'stop_typing' })
  }, [sendFrame])

  return { connected, sendMessage, sendTyping, sendStopTyping }
}
