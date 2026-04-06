import { useContext } from 'react'
import { CursorContext } from './CursorContext'

export function useCursor() {
  const api = useContext(CursorContext)
  if (!api) throw new Error('CursorProvider missing')
  return api
}

