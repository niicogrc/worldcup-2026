import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export default async function Page() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: todos } = await (supabase.from('todos') as any).select()

  return (
    <ul className="p-8 space-y-2">
      {todos?.map((todo: any) => (
        <li key={todo.id} className="text-slate-200">
          {todo.name}
        </li>
      ))}
    </ul>
  )
}
