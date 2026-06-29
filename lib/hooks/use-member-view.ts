'use client'

import { useState, useEffect } from 'react'
import { MatchResult } from '@/lib/supabase/types'

export type PorraMember = { user_id: string; display_name: string; avatar_url: string | null }
export type ViewedPrediction = { match_id: string; prediction: MatchResult; advance_side?: '1' | '2' | null; is_correct: boolean | null; points_awarded: number | null }

// Estado y fetch para ver las predicciones de otro miembro de la porra.
// Las respuestas se cachean por usuario (un fetch por miembro).
export function useMemberView(porraId: string, currentUserId: string, members: PorraMember[], initialUserId?: string | null) {
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
  // Mapa match_id → lado que avanza (cascada de playoffs), para el miembro visto.
  const viewedAdvanceSides = viewedRows.reduce<Record<string, '1' | '2'>>(
    (acc, p) => (p.advance_side ? { ...acc, [p.match_id]: p.advance_side } : acc),
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

  // Preseleccionar un miembro al montar (p.ej. al llegar desde el leaderboard con ?member=).
  useEffect(() => {
    if (initialUserId && initialUserId !== currentUserId) {
      viewMember(initialUserId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUserId])

  return { viewingUserId, isViewingOther, viewedMember, viewedRows, viewedPredictions, viewedAdvanceSides, loadingMemberId, viewError, viewMember }
}
