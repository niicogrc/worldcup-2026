'use client'

import React from 'react'
import { Eye, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import { PorraMember } from '@/lib/hooks/use-member-view'

interface MemberViewBarProps {
  members: PorraMember[]
  currentUserId: string
  viewingUserId: string | null
  loadingMemberId: string | null
  onView: (userId: string | null) => void
  /** Nombre del miembro que se está viendo (para el banner informativo) */
  viewedName?: string | null
}

// Selector "Viendo predicciones de: Tú / <miembro>" + banner informativo.
// Solo se renderiza si hay más miembros en la porra además del usuario actual.
export default function MemberViewBar({ members, currentUserId, viewingUserId, loadingMemberId, onView, viewedName }: MemberViewBarProps) {
  const otherMembers = members.filter((m) => m.user_id !== currentUserId)
  if (otherMembers.length === 0) return null

  const isViewingOther = viewingUserId !== null && viewingUserId !== currentUserId

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="flex items-center gap-1.5 text-xs text-zinc-500">
          <Eye className="w-3.5 h-3.5" />
          Viendo predicciones de
        </span>
        <button
          onClick={() => onView(null)}
          className={clsx(
            'px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer',
            !isViewingOther
              ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/20'
              : 'bg-[#13151c] border border-[#1f2333] text-zinc-400 hover:text-white hover:border-zinc-600'
          )}
        >
          Tú
        </button>
        {otherMembers.map((m) => (
          <button
            key={m.user_id}
            onClick={() => onView(m.user_id)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer',
              viewingUserId === m.user_id
                ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/20'
                : 'bg-[#13151c] border border-[#1f2333] text-zinc-400 hover:text-white hover:border-zinc-600'
            )}
          >
            {loadingMemberId === m.user_id && <Loader2 className="w-3 h-3 animate-spin" />}
            {m.display_name}
          </button>
        ))}
      </div>

      {isViewingOther && (
        <div className="px-4 py-3 bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded-lg text-sm flex items-center gap-2">
          <Eye className="w-4 h-4 flex-shrink-0" />
          <span>
            Estás viendo las predicciones de <strong>{viewedName}</strong>. Solo se muestran las de partidos ya empezados; las demás permanecen ocultas hasta el kick-off.
          </span>
        </div>
      )}
    </div>
  )
}
