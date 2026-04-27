import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import { authApi } from '../api/client'

export function useAuth() {
  const { user, isAuthenticated, setUser, logout } = useAuthStore()

  const { data, isLoading, error } = useQuery({
    queryKey: ['me'],
    queryFn: () => authApi.getMe().then((r) => r.data),
    enabled: isAuthenticated,
    retry: false,
  })

  useEffect(() => {
    if (data) setUser(data)
    if (error) logout()
  }, [data, error, setUser, logout])

  return { user, isAuthenticated, isLoading }
}

export function useWebSocket(userId?: string) {
  useEffect(() => {
    if (!userId) return

    const token = localStorage.getItem('access_token')
    if (!token) return

    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/notifications?token=${token}`
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => console.log('WS connected')
    ws.onclose = () => console.log('WS disconnected')

    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send('ping')
    }, 30000)

    return () => {
      clearInterval(ping)
      ws.close()
    }
  }, [userId])
}
