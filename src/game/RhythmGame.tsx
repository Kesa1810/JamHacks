import { useCallback, useEffect, useRef, useState } from 'react'
import type { MotionData, SliceDirection } from '../types/motion'
import { createSliceTracker, enrichWithSlice } from '../lib/sliceMotion'
import './RhythmGame.css'

// ─── Tunable constants ────────────────────────────────────────────────────────
const LEAD_TIME       = 2.6   // seconds a note is visible before its hit time
const HIT_WINDOW      = 0.35  // ± seconds that count as a hit
const PERFECT_WINDOW  = 0.09  // tighter "perfect" highlight
const BASE_POINTS     = 100
const SWING_ARM_POWER = 0.4   // slicePower above this fires a swing
const SWING_RESET_POW = 0.1   // slicePower must drop below this to re-arm

// ─── Types ────────────────────────────────────────────────────────────────────
type NoteDir = 'left' | 'right' | 'up' | 'down'

interface BeatmapNote {
  time: number
  lane: number   // 0 | 1 | 2
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

let noteIdCounter = 0

// ─── Component ────────────────────────────────────────────────────────────────
interface Props {
  motion: MotionData | null
}

export function RhythmGame({ motion }: Props) {
  const [phase, setPhase] = useState<'idle' | 'playing' | 'done'>('idle')
  const [beatmap, setBeatmap] = useState<Beatmap | null>(null)
  const [activeNotes, setActiveNotes] = useState<ActiveNote[]>([])
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [hits, setHits] = useState(0)
  const [misses, setMisses] = useState(0)
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null)
  const [multiplier, setMultiplier] = useState(1)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const nextNoteIndexRef = useRef(0)
  const rafRef = useRef<number>(0)
  const swingArmedRef = useRef(true)
  const sliceStateRef = useRef(createSliceTracker())
  const comboRef = useRef(0)
  const multiplierRef = useRef(1)

  // Keep refs in sync with state for use inside RAF
  comboRef.current = combo
  multiplierRef.current = multiplier

  // Load beatmap on mount
  useEffect(() => {
    fetch('/beatmap.json')
      .then((r) => r.json())
      .then((data: Beatmap) => setBeatmap(data))
      .catch(() => console.error('Could not load /beatmap.json'))
  }, [])

  // ── Show brief feedback text ──────────────────────────────────────────────
  const showFeedback = useCallback((text: string, ok: boolean) => {
    setFeedback({ text, ok })
    setTimeout(() => setFeedback(null), 600)
  }, [])

  // ── Core hit handler ──────────────────────────────────────────────────────
  const handleSwing = useCallback((direction: NoteDir) => {
    const audio = audioRef.current
    if (!audio || phase !== 'playing') return
    const now = audio.currentTime

    setActiveNotes((prev) => {
      // Find nearest un-hit, un-missed note matching direction within HIT_WINDOW
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
        // Miss
        setCombo(0)
        setMisses((m) => m + 1)
        setMultiplier(1)
        showFeedback('Miss', false)
        return prev
      }

      // Hit
      const perfect = bestDist <= PERFECT_WINDOW
      const newCombo = comboRef.current + 1
      const newMult = newCombo >= 8 ? 4 : newCombo >= 4 ? 2 : 1
      setCombo(newCombo)
      setMultiplier(newMult)
      setScore((s) => s + BASE_POINTS * newMult)
      setHits((h) => h + 1)
      showFeedback(perfect ? 'Perfect!' : 'Hit', true)

      // Mark as exploding, then remove after animation
      const updated = prev.map((n, i) =>
        i === bestIdx ? { ...n, hit: true, exploding: true } : n,
      )
      setTimeout(() => {
        setActiveNotes((cur) => cur.filter((n) => n.id !== updated[bestIdx].id))
      }, 350)
      return updated
    })
  }, [phase, showFeedback])

  // ── Keyboard fallback: arrow keys ─────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing') return
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, NoteDir> = {
        ArrowLeft: 'left', ArrowRight: 'right',
        ArrowUp: 'up', ArrowDown: 'down',
      }
      const dir = map[e.key]
      if (dir) { e.preventDefault(); handleSwing(dir) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, handleSwing])

  // ── Phone motion → swing detection ───────────────────────────────────────
  useEffect(() => {
    if (!motion || phase !== 'playing') return
    const { data: enriched, state: nextState } = enrichWithSlice(motion, sliceStateRef.current)
    sliceStateRef.current = nextState

    const dir = enriched.sliceDirection as SliceDirection
    const power = enriched.slicePower ?? 0

    if (swingArmedRef.current && power >= SWING_ARM_POWER && dir !== 'none') {
      swingArmedRef.current = false
      handleSwing(dir as NoteDir)
    } else if (!swingArmedRef.current && power < SWING_RESET_POW) {
      swingArmedRef.current = true
    }
  }, [motion, phase, handleSwing])

  // ── Game loop: spawn notes + check misses ─────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing' || !beatmap) return
    const audio = audioRef.current
    if (!audio) return

    const tick = () => {
      const now = audio.currentTime

      // Spawn notes whose spawn time has arrived (note.time - LEAD_TIME)
      const notes = beatmap.notes
      while (
        nextNoteIndexRef.current < notes.length &&
        notes[nextNoteIndexRef.current].time - LEAD_TIME <= now
      ) {
        const note = notes[nextNoteIndexRef.current]
        const newNote: ActiveNote = {
          ...note,
          id: ++noteIdCounter,
          hit: false,
          missed: false,
          exploding: false,
        }
        setActiveNotes((prev) => [...prev, newNote])
        nextNoteIndexRef.current++
      }

      // Mark notes past the hit window as missed
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
          setCombo(0)
          setMultiplier(1)
          setMisses((m) => m + 1)
          showFeedback('Miss', false)
          // Remove missed notes after brief flash
          setTimeout(() => {
            setActiveNotes((cur) => cur.filter((n) => !n.missed))
          }, 300)
        }
        return updated
      })

      // End game when song ends
      if (audio.ended || (nextNoteIndexRef.current >= notes.length && activeNotes.length === 0 && now > (notes[notes.length - 1]?.time ?? 0) + 2)) {
        setPhase('done')
        return
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [phase, beatmap, showFeedback, activeNotes.length])

  // ── Start game ────────────────────────────────────────────────────────────
  const startGame = useCallback(async () => {
    if (!beatmap) return
    const audio = new Audio('/song.mp3')
    audioRef.current = audio
    nextNoteIndexRef.current = 0
    setActiveNotes([])
    setScore(0)
    setCombo(0)
    setHits(0)
    setMisses(0)
    setMultiplier(1)
    setPhase('playing')
    await audio.play()
  }, [beatmap])

  // ── Note position: % down the lane based on time remaining ───────────────
  const getNoteStyle = (note: ActiveNote, audioTime: number) => {
    const audio = audioRef.current
    const now = audio ? audioTime : 0
    // 0% = top (just spawned), 85% = hit line
    const progress = (now - (note.time - LEAD_TIME)) / LEAD_TIME
    const top = Math.min(progress * 85, 85)
    return { top: `${top}%` }
  }

  // We need audio time in render — track it via state updated in RAF
  const [audioTime, setAudioTime] = useState(0)
  useEffect(() => {
    if (phase !== 'playing') return
    const id = setInterval(() => {
      if (audioRef.current) setAudioTime(audioRef.current.currentTime)
    }, 16)
    return () => clearInterval(id)
  }, [phase])

  const accuracy = hits + misses > 0 ? Math.round((hits / (hits + misses)) * 100) : 0

  return (
    <div className="rg-root">
      {/* ── HUD ── */}
      {phase === 'playing' && (
        <div className="rg-hud">
          <div className="rg-hud-score">
            <span className="rg-hud-label">Score</span>
            <span className="rg-hud-value">{score.toLocaleString()}</span>
          </div>
          <div className="rg-hud-combo">
            <span className="rg-hud-label">Combo</span>
            <span className="rg-hud-value rg-combo">{combo}x</span>
          </div>
          <div className="rg-hud-mult">
            <span className="rg-hud-label">Mult</span>
            <span className={`rg-hud-value rg-mult-${multiplier}`}>×{multiplier}</span>
          </div>
        </div>
      )}

      {/* ── Feedback flash ── */}
      {feedback && (
        <div className={`rg-feedback ${feedback.ok ? 'rg-feedback--hit' : 'rg-feedback--miss'}`}>
          {feedback.text}
        </div>
      )}

      {/* ── Idle / start screen ── */}
      {phase === 'idle' && (
        <div className="rg-overlay">
          <h2 className="rg-title">Beat Saber</h2>
          <p className="rg-sub">
            {beatmap ? `${beatmap.notes.length} notes · ${beatmap.song}` : 'Loading beatmap…'}
          </p>
          <p className="rg-keys">Arrow keys or swing your phone</p>
          <button className="rg-start-btn" onClick={startGame} disabled={!beatmap}>
            Start Game
          </button>
        </div>
      )}

      {/* ── Done screen ── */}
      {phase === 'done' && (
        <div className="rg-overlay">
          <h2 className="rg-title">Done!</h2>
          <div className="rg-results">
            <div><span>Score</span><strong>{score.toLocaleString()}</strong></div>
            <div><span>Accuracy</span><strong>{accuracy}%</strong></div>
            <div><span>Hits</span><strong>{hits}</strong></div>
            <div><span>Misses</span><strong>{misses}</strong></div>
            <div><span>Max combo</span><strong>{combo}x</strong></div>
          </div>
          <button className="rg-start-btn" onClick={startGame}>Play Again</button>
        </div>
      )}

      {/* ── Lane arena ── */}
      {phase === 'playing' && (
        <div className="rg-arena">
          {[0, 1, 2].map((lane) => (
            <div key={lane} className="rg-lane">
              <div className="rg-hit-line" />
              {activeNotes
                .filter((n) => n.lane === lane)
                .map((note) => (
                  <div
                    key={note.id}
                    className={`rg-note rg-note--${note.direction}
                      ${note.exploding ? 'rg-note--explode' : ''}
                      ${note.missed ? 'rg-note--missed' : ''}`}
                    style={getNoteStyle(note, audioTime)}
                  >
                    <span className="rg-note-arrow">{DIR_ARROW[note.direction]}</span>
                  </div>
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
