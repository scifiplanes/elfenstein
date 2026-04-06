import type { GameState } from '../../game/types'

export function NavigationPanel(_props: { state: GameState }) {
  return (
    <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
      <div>Movement is stubbed for now.</div>
      <div style={{ marginTop: 8 }}>Drag items onto:</div>
      <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
        <li>inventory slots (reorder)</li>
        <li>empty space (drop to floor)</li>
        <li>portrait eyes (inspect)</li>
        <li>portrait mouth (feed)</li>
        <li>POIs in viewport (use)</li>
      </ul>
      <div style={{ marginTop: 8 }}>Press <span style={{ color: 'rgba(255,255,255,0.92)' }}>F2</span> for debug.</div>
    </div>
  )
}

