import { useCallback, useEffect, useRef, useState } from 'react'
import type { MotionData, SliceDirection } from '../types/motion'
import { createSliceTracker, enrichWithSlice } from '../lib/sliceMotion'
import './RhythmGame.css'

// ─── Tunable constants ────────────────────────────────────────────────────────
const LEAD_TIME       = 2.6   // seconds a block is visible before its hit time
const HIT_WINDOW      = 0.35  // ± seconds that count as a hit
const PERFECT_WINDOW  = 0.09  // tighter perfect window
const BASE_POINTS     = 100
const SWING_ARM_POWER = 0.4   // slicePower above this fires a swing
const SWING_RESET_POW = 0.1   // must drop below this to re-arm

// Lane X positions (% of arena width, 3 lanes)
const LANE_X = [22, 50, 78]

type NoteDir = 'left' | 'right' | 'up' | 'down'

interface BeatmapNote {
  time: number
  lane: number
  direction: NoteDir
}
interface Beatmap {
  song: string
  laneCount: number
  notes: BeatmapNote[]
}
interface ActiveNote extends BeatmapNote {
  id: number
  hit: boolean
  missed: boolean
  exploding: boolean
}

const DIR_ARROW: Record<NoteDir, string> = {
  left: '←', right: '→', up: '↑', down: '↓',
}

// Block colour per direction
const DIR_COLOR: Record<NoteDir, { border: string; bg: string; glow: string }> = {
  left:  { border: '#ce93d8', bg: '#1a0030', glow: '#ce93d888' },
  right: { border: '#80d8ff', bg: '#001a30', glow: '#80d8ff88' },
  up:    { border: '#b9f6ca', bg: '#0a2000', glow: '#b9f6ca88' },
  down:  { border: '#ffcc80', bg: '#2a1000', glow: '#ffcc8088' },
}

let noteIdCounter = 0

// ─── Saber component (bottom-right, reacts to motion) ────────────────────────
interface SaberProps {
  motion: MotionData | null
  lastSwingDir: NoteDir | null
}

function BottomRightSaber({ motion, lastSwingDir }: SaberProps) {
  // Pivot the saber based on phone tilt/swing
  const posX  = motion?.posX  ?? 0
  const posY  = motion?.posY  ?? 0
  const speed = motion?.swingSpeed ?? 0
  const glow  = 28 + Math.min(speed * 10, 60)

  // Tilt the saber: rotateZ from posX, rotateX from posY
  const rotZ = posX * 0.18
  const rotX = posY * 0.12

  // On swing, snap to a dramatic angle then release
  const swingRotZ = lastSwingDir === 'left'  ? -55
                  : lastSwingDir === 'right' ?  55
                  : lastSwingDir === 'up'    ?  0
                  : lastSwingDir === 'down'  ?  0
                  : 0
  const swingRotX = lastSwingDir === 'up'   ? -40
                  : lastSwingDir === 'down' ?  40
                  : 0

  const finalRotZ = rotZ + swingRotZ
  const finalRotX = rotX + swingRotX

  return (
    <div className="rg-saber-anchor">
      <div
        className="rg-saber-rig"
        style={{ transform: `rotateZ(${finalRotZ}deg) rotateX(${finalRotX}deg)` }}
      >
        <div className="rg-saber-blade">
          <div className="rg-blade-core" style={{ boxShadow: `0 0 ${glow}px #00e5ff` }} />
          <div className="rg-blade-glow" />
        </div>
        <div className="rg-saber-guard" />
        <div className="rg-saber-handle" />
      </div>
    </div>
  )
}

// ─── Main game component ──────────────────────────────────────────────────────
interface Props {
  motion: MotionData | null
  controllerConnected?: boolean
}

export function RhythmGame({ motion, controllerConnected = false }: Props) {
  const [phase, setPhase]           = useState<'idle' | 'playing' | 'done'>('idle')
  const [beatmap, setBeatmap]       = useState<Beatmap | null>(null)
  const [activeNotes, setActiveNotes] = useState<ActiveNote[]>([])
  const [score, setScore]           = useState(0)
  const [combo, setCombo]           = useState(0)
  const [hits, setHits]             = useState(0)
  const [misses, setMisses]         = useState(0)
  const [multiplier, setMultiplier] = useState(1)
  const [audioTime, setAudioTime]   = useState(0)
  const [feedback, setFeedback]     = useState<{ text: string; ok: boolean } | null>(null)
  const [lastSwingDir, setLastSwingDir] = useState<NoteDir | null>(null)

  const audioRef          = useRef<HTMLAudioElement | null>(null)
  const nextNoteIndexRef  = useRef(0)
  const rafRef            = useRef<number>(0)
  const swingArmedRef     = useRef(true)
  const sliceStateRef     = useRef(createSliceTracker())
  const comboRef          = useRef(0)
  const multRef           = useRef(1)
  const activeNotesRef    = useRef<ActiveNote[]>([])

  comboRef.current = combo
  multRef.current  = multiplier
  activeNotesRef.current = activeNotes

  useEffect(() => {
    fetch('/beatmap.json')
      .then((r) => r.json())
      .then((data: Beatmap) => setBeatmap(data))
      .catch(() => console.error('Could not load /beatmap.json'))
  }, [])

  const showFeedback = useCallback((text: string, ok: boolean) => {
    setFeedback({ text, ok })
    setTimeout(() => setFeedback(null), 600)
  }, [])

  // ── Hit handler ────────────────────────────────────────────────────────────
  const handleSwing = useCallback((direction: NoteDir) => {
    const audio = audioRef.current
    if (!audio || phase !== 'playing') return

    // Visual saber swing
    setLastSwingDir(direction)
    setTimeout(() => setLastSwingDir(null), 250)

    const now = audio.currentTime

    setActiveNotes((prev) => {
      let bestIdx = -1
      let bestDist = Infinity
      prev.forEach((n, i) => {
        if (n.hit || n.missed) return
        const dist = Math.abs(n.time - now)
        if (dist <= HIT_WINDOW && n.direction === direction && dist < bestDist) {
          bestDist = dist
          bestIdx = i
        }
      })

      if (bestIdx === -1) {
        setCombo(0); setMisses((m) => m + 1); setMultiplier(1)
        showFeedback('Miss', false)
        return prev
      }

      const perfect = bestDist <= PERFECT_WINDOW
      const newCombo = comboRef.current + 1
      const newMult  = newCombo >= 8 ? 4 : newCombo >= 4 ? 2 : 1
      setCombo(newCombo); setMultiplier(newMult)
      setScore((s) => s + BASE_POINTS * newMult)
      setHits((h) => h + 1)
      showFeedback(perfect ? 'Perfect!' : 'Hit!', true)

      const updated = prev.map((n, i) =>
        i === bestIdx ? { ...n, hit: true, exploding: true } : n,
      )
      const hitId = updated[bestIdx].id
      setTimeout(() => setActiveNotes((cur) => cur.filter((n) => n.id !== hitId)), 350)
      return updated
    })
  }, [phase, showFeedback])

  // ── Keyboard fallback ──────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing') return
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, NoteDir> = {
        ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
      }
      const dir = map[e.key]
      if (dir) { e.preventDefault(); handleSwing(dir) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, handleSwing])

  // ── Phone motion → swing ───────────────────────────────────────────────────
  useEffect(() => {
    if (!motion || phase !== 'playing') return
    const { data: enriched, state: next } = enrichWithSlice(motion, sliceStateRef.current)
    sliceStateRef.current = next
    const dir   = enriched.sliceDirection as SliceDirection
    const power = enriched.slicePower ?? 0
    if (swingArmedRef.current && power >= SWING_ARM_POWER && dir !== 'none') {
      swingArmedRef.current = false
      handleSwing(dir as NoteDir)
    } else if (!swingArmedRef.current && power < SWING_RESET_POW) {
      swingArmedRef.current = true
    }
  }, [motion, phase, handleSwing])

  // ── Game loop ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing' || !beatmap) return
    const audio = audioRef.current
    if (!audio) return

    const tick = () => {
      const now = audio.currentTime
      setAudioTime(now)

      // Spawn notes
      const notes = beatmap.notes
      while (
        nextNoteIndexRef.current < notes.length &&
        notes[nextNoteIndexRef.current].time - LEAD_TIME <= now
      ) {
        const note = notes[nextNoteIndexRef.current]
        setActiveNotes((prev) => [
          ...prev,
          { ...note, id: ++noteIdCounter, hit: false, missed: false, exploding: false },
        ])
        nextNoteIndexRef.current++
      }

      // Expire missed notes
      setActiveNotes((prev) => {
        let anyMissed = false
        const updated = prev.map((n) => {
          if (!n.hit && !n.missed && now > n.time + HIT_WINDOW) {
            anyMissed = true
            return { ...n, missed: true }
          }
          return n
        })
        if (anyMissed) {
          setCombo(0); setMultiplier(1); setMisses((m) => m + 1)
          showFeedback('Miss', false)
          setTimeout(() => setActiveNotes((cur) => cur.filter((n) => !n.missed)), 300)
        }
        return updated
      })

      if (
        audio.ended ||
        (nextNoteIndexRef.current >= notes.length &&
          activeNotesRef.current.length === 0 &&
          now > (notes[notes.length - 1]?.time ?? 0) + 2)
      ) {
        setPhase('done')
        return
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [phase, beatmap, showFeedback])

  // ── Start ──────────────────────────────────────────────────────────────────
  const startGame = useCallback(async () => {
    if (!beatmap) return
    const audio = new Audio('/song.mp3')
    audioRef.current = audio
    nextNoteIndexRef.current = 0
    setActiveNotes([]); setScore(0); setCombo(0)
    setHits(0); setMisses(0); setMultiplier(1); setAudioTime(0)
    setPhase('playing')
    await audio.play()
  }, [beatmap])

  // ── Block position: scale + translate for "coming at you" illusion ─────────
  // progress 0 = just spawned (far, tiny), 1 = at hit zone (close, full size)
  // hit zone is at bottom 20% of arena
  const getBlockStyle = (note: ActiveNote): React.CSSProperties => {
    const progress = Math.min(
      (audioTime - (note.time - LEAD_TIME)) / LEAD_TIME,
      1,
    )
    // Scale from 0.15 (far) to 1.1 (close)
    const scale = 0.15 + progress * 0.95
    // Y: start at 15% from top, end at 72% (hit zone)
    const top = 15 + progress * 57
    // X: lane position (converge slightly from center as they approach)
    const laneX = LANE_X[note.lane] ?? 50
    // Perspective: lanes start tighter near center, spread out as they approach
    const startX = 50
    const x = startX + (laneX - startX) * progress

    const c = DIR_COLOR[note.direction]
    return {
      position: 'absolute',
      left: `${x}%`,
      top: `${top}%`,
      transform: `translate(-50%, -50%) scale(${scale})`,
      width: '90px',
      height: '90px',
      borderRadius: '12px',
      border: `3px solid ${c.border}`,
      background: c.bg,
      boxShadow: `0 0 ${14 * scale}px ${c.glow}, inset 0 0 ${8 * scale}px ${c.glow}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: `${36 * scale}px`,
      fontWeight: 900,
      color: c.border,
      zIndex: Math.round(progress * 10),
      opacity: note.missed ? 0 : 1,
    }
  }

  const accuracy = hits + misses > 0 ? Math.round((hits / (hits + misses)) * 100) : 0

  return (
    <div className="rg-root">
      {/* ── HUD ── */}
      {phase === 'playing' && (
        <div className="rg-hud">
          <div className="rg-stat">
            <span className="rg-stat-label">Score</span>
            <span className="rg-stat-val">{score.toLocaleString()}</span>
          </div>
          <div className="rg-stat">
            <span className="rg-stat-label">Combo</span>
            <span className="rg-stat-val rg-combo">{combo}x</span>
          </div>
          <div className="rg-stat">
            <span className="rg-stat-label">Mult</span>
            <span className={`rg-stat-val rg-mult-${multiplier}`}>×{multiplier}</span>
          </div>
          <div className="rg-stat">
            <span className="rg-stat-label">Acc</span>
            <span className="rg-stat-val">{accuracy}%</span>
          </div>
        </div>
      )}

      {/* ── Feedback ── */}
      {feedback && (
        <div className={`rg-feedback ${feedback.ok ? 'rg-feedback--hit' : 'rg-feedback--miss'}`}>
          {feedback.text}
        </div>
      )}

      {/* ── Idle screen ── */}
      {phase === 'idle' && (
        <div className="rg-overlay">
          <div className="rg-grid-floor" />
          <h2 className="rg-title">Beat Saber</h2>
          <p className="rg-sub">
            {beatmap ? `${beatmap.notes.length} notes · ${beatmap.song}` : 'Loading beatmap…'}
          </p>
          <p className="rg-hint">
            {controllerConnected ? 'Arrow keys or swing your phone' : 'Scan QR to connect phone · or use arrow keys'}
          </p>
          <button className="rg-start-btn" onClick={startGame} disabled={!beatmap}>
            ▶ Start Game
          </button>
        </div>
      )}

      {/* ── Done screen ── */}
      {phase === 'done' && (
        <div className="rg-overlay">
          <h2 className="rg-title">Complete!</h2>
          <div className="rg-results">
            <div><span>Score</span>     <strong>{score.toLocaleString()}</strong></div>
            <div><span>Accuracy</span>  <strong>{accuracy}%</strong></div>
            <div><span>Hits</span>      <strong>{hits}</strong></div>
            <div><span>Misses</span>    <strong>{misses}</strong></div>
          </div>
          <button className="rg-start-btn" onClick={startGame}>▶ Play Again</button>
        </div>
      )}

      {/* ── Arena ── */}
      {phase === 'playing' && (
        <div className="rg-arena">
          {/* Perspective grid floor */}
          <div className="rg-grid-floor" />

          {/* Vanishing-point guide lines per lane */}
          {LANE_X.map((x, i) => (
            <div key={i} className="rg-lane-guide" style={{ left: `${x}%` }} />
          ))}

          {/* Hit zone line */}
          <div className="rg-hit-zone" />

          {/* Approaching blocks */}
          {activeNotes.map((note) => (
            <div
              key={note.id}
              className={`rg-block ${note.exploding ? 'rg-block--explode' : ''} ${note.missed ? 'rg-block--missed' : ''}`}
              style={getBlockStyle(note)}
            >
              {DIR_ARROW[note.direction]}
            </div>
          ))}

          {/* Saber — bottom right */}
          <BottomRightSaber motion={motion} lastSwingDir={lastSwingDir} />
        </div>
      )}
    </div>
  )
}
