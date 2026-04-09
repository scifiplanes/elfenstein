import type { ItemDef } from '../../game/content/contentDb'

export function EquipIcon(props: { def: ItemDef; emojiClass: string; imgClass: string }) {
  const { def, emojiClass, imgClass } = props
  if (def.icon.kind === 'emoji') {
    return <span className={emojiClass}>{def.icon.value}</span>
  }
  return <img className={imgClass} src={def.icon.path} alt="" draggable={false} />
}
