import { useEffect, useRef, useState } from 'react'
import { AVATARS, POSITION_LABELS } from '../../types/mahjong'
import type { AvatarSelection, Player, PlayerPosition } from '../../types/mahjong'
interface Props { position: PlayerPosition; player?: Player; onSave: (player: Player) => void; onRemove: () => void; onClose: () => void }
export function PlayerEditor({ position, player, onSave, onRemove, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [nickname, setNickname] = useState(player?.nickname ?? '')
  const [avatar, setAvatar] = useState<AvatarSelection>(player?.avatar ?? AVATARS[0].emoji)
  useEffect(() => {
    const dialog = dialogRef.current!
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
      if (previousFocus instanceof HTMLElement) previousFocus.focus()
    }
  }, [])
  return <dialog className="player-dialog" ref={dialogRef} aria-labelledby="editor-heading" aria-describedby="editor-description" onCancel={(event) => { event.preventDefault(); onClose() }}>
    <div className="sheet-handle" aria-hidden="true" />
    <div className="editor-header"><div><p className="eyebrow">{POSITION_LABELS[position]}座位</p><h2 id="editor-heading">{player ? '編輯牌友' : '認識一下牌友'}</h2></div><button className="close-button" type="button" aria-label="取消並關閉" onClick={onClose}>×</button></div>
    <p id="editor-description" className="editor-description">揀個頭像，改個靚名，一齊開枱。</p>
    <form onSubmit={(event) => { event.preventDefault(); if (nickname.trim()) onSave({ position, nickname: nickname.trim(), avatar }) }}>
      <label className="input-label" htmlFor="nickname">牌友暱稱 <span>最多 12 個字</span></label>
      <input id="nickname" value={nickname} maxLength={12} required autoComplete="off" placeholder="例如：雀后、阿明" onChange={(event) => setNickname(event.target.value)} />
      <fieldset className="avatar-fieldset"><legend>揀選頭像</legend><div className="avatar-grid">{AVATARS.map((item) => <label className="avatar-option" key={item.emoji}><input type="radio" name="avatar" value={item.emoji} checked={avatar === item.emoji} onChange={() => setAvatar(item.emoji)} aria-label={item.label} /><span aria-hidden="true">{item.emoji}</span></label>)}</div></fieldset>
      <div className="editor-actions"><button type="button" className="secondary-button" onClick={onClose}>取消</button><button type="submit" className="primary-button" disabled={!nickname.trim()}>儲存牌友</button></div>
      {player && <button type="button" className="remove-player" onClick={onRemove}>移除此牌友</button>}
    </form>
  </dialog>
}
