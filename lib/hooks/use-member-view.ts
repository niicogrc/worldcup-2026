'use client'

import { useState } from 'react'
import { MatchResult } from '@/lib/supabase/types'

export type PorraMember = { user_id: string; display_name: string; avatar_url: string | null }
export type ViewedPrediction = { match_id: string; prediction: MatchResult; is_correct: boolean | null; points_awarded: number | null }

// Estado y fetch para ver las predicciones de otro miembro de la porra.
// Las respuestas se cachean por usuario (un fetch por miembro).
export function useMemberView(porraId: string, currentUserId: string, members: PorraMember[]) {
  const [viewingUserId, setViewingUserId] = useState<string | null>(null)
  const [viewedCache, setViewedCache] = useState<Record<string, ViewedPrediction[]>>({})
  const [loadingMemberId, setLoadingMemberId] = useState<string | null>(null)
  const [viewError, setViewError] = useState<string | null>(null)

  const isViewingOther = viewingUserId !== null && viewingUserId !== currentUserId
  const viewedMember = isViewingOther ? members.find((m) => m.user_id === viewingUserId) ?? null : null
  const viewedRows = isViewingOther ? (viewedCache[viewingUserId!] ?? []) : []
  const viewedPredictions = viewedRows.reduce<Record<string, MatchResult>>(
    (acc, p) => ({ ...acc, [p.match_id]: p.prediction }),
    {}
  )

  const viewMember = async (userId: string | null) => {
    setViewError(null)
    if (userId === null || userId === currentUserId) {
      setViewingUserId(null)
      return
    }
    setViewingUserId(userId)
    if (viewedCache[userId]) return

    setLoadingMemberId(userId)
    try {
      const res = await fetch(`/api/porras/${porraId}/predictions?userId=${userId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al cargar las predicciones')
      setViewedCache((c) => ({ ...c, [userId]: data }))
    } catch (err: any) {
      setViewError(err.message)
      setViewingUserId(null)
    } finally {
      setLoadingMemberId(null)
    }
  }

  return { viewingUserId, isViewingOther, viewedMember, viewedRows, viewedPredictions, loadingMemberId, viewError, viewMember }
}
