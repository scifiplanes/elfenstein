import type { ItemDef } from '../../game/content/contentDb'
import { ItemEmoji } from '../item/ItemEmoji'

export function EquipIcon(props: { def: ItemDef; emojiClass: string; imgClass: string }) {
  const { def, emojiClass, imgClass } = props
  if (def.icon.kind === 'emoji') {
    return <ItemEmoji icon={def.icon} className={emojiClass} />
  }
  return <img className={imgClass} src={def.icon.path} alt="" draggable={false} />
}
