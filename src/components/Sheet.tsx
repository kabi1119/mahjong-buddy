import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
interface Props { title: string; onClose: () => void; children: ReactNode; className?: string }
export function Sheet({ title, onClose, children, className = '' }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current!
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    return () => { dialog.close(); document.body.style.overflow = overflow; if (previous instanceof HTMLElement) previous.focus() }
  }, [])
  return <dialog ref={ref} className={`player-dialog action-sheet ${className}`} aria-label={title} onCancel={(event) => { event.preventDefault(); onClose() }}>
    <div className="sheet-handle" aria-hidden="true" />
    <header className="editor-header"><h2>{title}</h2><button className="close-button" type="button" aria-label="關閉" onClick={onClose}>×</button></header>
    {children}
  </dialog>
}
