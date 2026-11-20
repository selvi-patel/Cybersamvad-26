// Custom-cursor state. DOM hover states are detected in <Cursor/>; the 3D scene reports its own
// (selectable zone / light / rack, or danger when the thing under the cursor is critical).
export const cur = { scene: null, label: '' }
export function sceneCursor(state, label = '') {
  cur.scene = state; cur.label = label
  window.dispatchEvent(new Event('citadel-cursor'))
}
