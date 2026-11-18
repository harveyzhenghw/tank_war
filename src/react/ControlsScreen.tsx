interface Props {
  onBack: () => void
}

export function ControlsScreen({ onBack }: Props) {
  return (
    <div className="screen">
      <div className="topbar">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>
          ← Menu
        </button>
        <h2>Controls</h2>
      </div>

      <div className="two-col">
        <div className="panel">
          <div className="panel-title">Desktop · Player 1</div>
          <table className="control-table">
            <tbody>
              <tr>
                <td>Drive</td>
                <td>
                  <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> — the hull turns toward
                  the direction you press
                </td>
              </tr>
              <tr>
                <td>Aim</td>
                <td>Mouse — turret is independent of the hull</td>
              </tr>
              <tr>
                <td>Manual turret</td>
                <td>
                  <kbd>Q</kbd> / <kbd>E</kbd>
                </td>
              </tr>
              <tr>
                <td>Fire</td>
                <td>
                  <kbd>Left mouse</kbd> or <kbd>Space</kbd>
                </td>
              </tr>
              <tr>
                <td>Overdrive</td>
                <td>
                  <kbd>Right mouse</kbd> or <kbd>Left Shift</kbd> — 1.5s speed burst
                </td>
              </tr>
              <tr>
                <td>Weapons</td>
                <td>
                  <kbd>1</kbd> cannon · <kbd>2</kbd> MG · <kbd>3</kbd> rocket · <kbd>4</kbd>{' '}
                  scatter
                </td>
              </tr>
              <tr>
                <td>Cycle</td>
                <td>
                  <kbd>Tab</kbd>
                </td>
              </tr>
              <tr>
                <td>Pause</td>
                <td>
                  <kbd>Esc</kbd> or <kbd>P</kbd>
                </td>
              </tr>
            </tbody>
          </table>

          <div className="panel-title" style={{ marginTop: 20 }}>
            Desktop · Player 2 (local versus)
          </div>
          <table className="control-table">
            <tbody>
              <tr>
                <td>Drive</td>
                <td>
                  <kbd>↑</kbd> <kbd>←</kbd> <kbd>↓</kbd> <kbd>→</kbd>
                </td>
              </tr>
              <tr>
                <td>Turret</td>
                <td>
                  <kbd>,</kbd> / <kbd>.</kbd>
                </td>
              </tr>
              <tr>
                <td>Fire</td>
                <td>
                  <kbd>/</kbd> or <kbd>Num 0</kbd>
                </td>
              </tr>
              <tr>
                <td>Overdrive</td>
                <td>
                  <kbd>Right Shift</kbd>
                </td>
              </tr>
              <tr>
                <td>Cycle</td>
                <td>
                  <kbd>M</kbd>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="panel">
            <div className="panel-title">Gamepad</div>
            <table className="control-table">
              <tbody>
                <tr>
                  <td>Drive</td>
                  <td>Left stick or D-pad</td>
                </tr>
                <tr>
                  <td>Aim</td>
                  <td>Right stick</td>
                </tr>
                <tr>
                  <td>Fire</td>
                  <td>A / right trigger</td>
                </tr>
                <tr>
                  <td>Overdrive</td>
                  <td>B</td>
                </tr>
                <tr>
                  <td>Weapons</td>
                  <td>Bumpers cycle · X cannon · Y machine gun</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="panel">
            <div className="panel-title">Touch</div>
            <table className="control-table">
              <tbody>
                <tr>
                  <td>Left stick</td>
                  <td>Drive the hull</td>
                </tr>
                <tr>
                  <td>Right stick</td>
                  <td>Aim the turret and fire while held</td>
                </tr>
                <tr>
                  <td>BOOST</td>
                  <td>Overdrive speed burst</td>
                </tr>
                <tr>
                  <td>SWAP</td>
                  <td>Cycle weapon</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="panel">
            <div className="panel-title">Field manual</div>
            <p style={{ color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.65 }}>
              Crates break — walls and rocks do not. Rockets splash, scatter shreds up close,
              and the machine gun chews through armour at range. Pickups restore health, ammo,
              armour, damage, speed or a temporary shield. Holding a capture zone is contested
              while an enemy is inside it.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}