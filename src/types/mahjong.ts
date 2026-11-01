export const VARIANTS = [{ id: 'hong-kong', label: '香港麻雀' }, { id: 'riichi', label: '日本麻雀' }] as const
export type MahjongVariant = (typeof VARIANTS)[number]['id']
export const POSITIONS = ['top', 'right', 'bottom', 'left'] as const
export type PlayerPosition = (typeof POSITIONS)[number]
export const POSITION_LABELS: Record<PlayerPosition, string> = { top: '上方', right: '右方', bottom: '下方', left: '左方' }
export const AVATARS = [
  { emoji: '🐱', label: '貓咪' }, { emoji: '🐶', label: '小狗' },
  { emoji: '🐼', label: '熊貓' }, { emoji: '🐰', label: '兔仔' },
  { emoji: '🦊', label: '狐狸' }, { emoji: '🐻', label: '小熊' },
  { emoji: '🐸', label: '青蛙' }, { emoji: '🐧', label: '企鵝' },
  { emoji: '🍑', label: '蜜桃' }, { emoji: '🍊', label: '橙仔' },
  { emoji: '🍙', label: '飯糰' }, { emoji: '🍮', label: '布甸' },
  { emoji: '🧋', label: '珍珠奶茶' }, { emoji: '🌻', label: '向日葵' },
  { emoji: '🍀', label: '四葉草' }, { emoji: '🚀', label: '火箭' },
] as const
export type AvatarSelection = (typeof AVATARS)[number]['emoji']
export interface Player { position: PlayerPosition; nickname: string; avatar: AvatarSelection }
