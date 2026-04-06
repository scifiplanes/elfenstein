export function StatuePanel(props: { side: 'left' | 'right' }) {
  return (
    <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
      Slot: {props.side}
    </div>
  )
}

