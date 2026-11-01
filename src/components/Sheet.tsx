import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
interface Props { title: string; onClose: () => void; children: ReactNode; className?: string; hideClose?: boolean }
export function Sheet({ title, onClose, children, className = '', hideClose = false }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current!
    const previous = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    if (hideClose) { const heading = dialog.querySelector('h2')!; heading.tabIndex = -1; heading.focus({ preventScroll: true }); dialog.scrollTop = 0 }
    return () => { dialog.close(); document.body.style.overflow = overflow; if (previous instanceof HTMLElement) previous.focus() }
  }, [hideClose])
  return <dialog ref={ref} className={`player-dialog action-sheet ${className}`} aria-label={title} onCancel={(event) => { event.preventDefault(); onClose() }}>
    <div className="sheet-handle" aria-hidden="true" />
    <header className="editor-header"><h2>{title}</h2>{!hideClose && <button className="close-button" type="button" aria-label="關閉" onClick={onClose}>×</button>}</header>
    {children}
  </dialog>
}
