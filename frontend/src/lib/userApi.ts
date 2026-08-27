import { apiFetch } from './api'
import type { AppUser } from '../types/user'

type MeResponse = {
  ok: boolean
  user: AppUser
}

export type UpdateCurrentUserPayload = {
  realName?: string
  email?: string
}

export async function fetchCurrentUser() {
  const data = await apiFetch<MeResponse>('/api/user/me')
  return data.user
}

export async function updateCurrentUser(payload: UpdateCurrentUserPayload) {
  const data = await apiFetch<MeResponse>('/api/user/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return data.user
}
