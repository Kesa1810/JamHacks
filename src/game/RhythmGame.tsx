import { useCallback, useEffect, useRef, useState } from 'react'
import type { MotionData, SliceDirection } from '../types/motion'
import { createSliceTracker, enrichWithSlice } from '../lib/sliceMotion'
import {
  loadProfile,
  saveProfile,
  resetProfile,
  updateOnHit,
  updateOnNearMiss,
  blendGlobalProfile,
  submitSessionToServer,
  type MotionProfile,
} from '../lib/adaptiveProfile'
import './RhythmGame.css'

// --- Tunable constants --------------------------------------------------------
const LEAD_TIME       = 2.6   // seconds a block is visible before its hit time
const HIT_WINDOW      = 0.35  // +/- seconds that count as a hit
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
  left: '<-', right: '->', up: '^', down: 'v',
}

// Block colour per direction
const DIR_COLOR: Record<NoteDir, { border: string; bg: string; glow: string }> = {
  left:  { border: '#ce93d8', bg: '#1a0030', glow: '#ce93d888' },
  right: { border: '#80d8ff', bg: '#001a30', glow: '#80d8ff88' },
  up:    { border: '#b9f6ca', bg: '#0a2000', glow: '#b9f6ca88' },
  down:  { border: '#ffcc80', bg: '#2a1000', glow: '#ffcc8088' },
}

let noteIdCounter = 0

// --- Saber - free-moving, tracks phone position AND orientation ---------------
interface SaberProps {
  motion: MotionData | null
  lastSwingDir: NoteDir | null
}

function FreeSaber({ motion, lastSwingDir }: SaberProps) {
  const tiltX = motion?.tiltX ?? 0   // dGamma: right tilt = positive
  const tiltY = motion?.tiltY ?? 0   // -dBeta: upward tilt = positive
  const speed = motion?.swingSpeed ?? 0
  const glow  = 24 + Math.min(speed * 8, 50)

  // -- Screen position --------------------------------------------------------
  // Map phone tilt angles to % position on screen.
  // Horizontal: tiltX +/-60 deg -> 20% - 80% of width
  // Vertical:   tiltY +/-45 deg -> 30% - 85% of height (inverted: tilt up -> saber moves up)
  const clampedX = Math.max(-60, Math.min(60, tiltX))
  const clampedY = Math.max(-45, Math.min(45, tiltY))
  const screenLeft = 50 + clampedX * (30 / 60)          // 20-80%
  const screenTop  = 70 - clampedY * (35 / 45)          // 35-85% (up = lower % = higher on page)

  // -- Rotation ---------------------------------------------------------------
  // Saber rotates to match phone angle - 1:1 with tilt
  const baseRotZ = Math.max(-75, Math.min(75, tiltX))
  const baseRotX = Math.max(-45, Math.min(45, tiltY * 0.5))

  // On swing: snap to dramatic angle
  const swingRotZ = lastSwingDir === 'left'  ? -70
                  : lastSwingDir === 'right' ?  70
                  : 0
  const swingRotX = lastSwingDir === 'up'   ? -55
                  : lastSwingDir === 'down' ?  55
                  : 0

  const finalRotZ = lastSwingDir ? swingRotZ : baseRotZ
  const finalRotX = lastSwingDir ? swingRotX : baseRotX

  return (
    <div
      className="rg-saber-anchor"
      style={{ left: `${screenLeft}%`, top: `${screenTop}%` }}
    >
      <div
        className="rg-saber-rig"
        style={{ transform: `rotateZ(${finalRotZ}deg) rotateX(${finalRotX}deg)` }}
      >
        <div className="rg-saber-blade">
          <div className="rg-blade-core" style={{ boxShadow: `0 0 ${glow}px #c4aaff` }} />
          <div className="rg-blade-glow" />
        </div>
        <div className="rg-saber-guard" />
        <div className="rg-saber-handle" />
      </div>
    </div>
  )
}

// --- Main game component ------------------------------------------------------
interface Props {
  motion: MotionData | null
}

export function RhythmGame({ motion }: Props) {
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
  const [profile, setProfile]       = useState<MotionProfile>(loadProfile)

  const audioRef          = useRef<HTMLAudioElement | null>(null)
  const nextNoteIndexRef  = useRef(0)
  const rafRef            = useRef<number>(0)
  const swingArmedRef     = useRef(true)
  const sliceStateRef     = useRef(createSliceTracker())
  const comboRef          = useRef(0)
  const multRef           = useRef(1)
  const activeNotesRef    = useRef<ActiveNote[]>([])
  const profileRef        = useRef<MotionProfile>(profile)
  profileRef.current = profile

  comboRef.current = combo
  multRef.current  = multiplier
  activeNotesRef.current = activeNotes

  useEffect(() => {
    fetch('/beatmap.json')
      .then((r) => r.json())
      .then((data: Beatmap) => setBeatmap(data))
      .catch(() => console.error('Could not load /beatmap.json'))
  }, [])

  // Blend crowd-sourced global profile into local on mount
  useEffect(() => {
    blendGlobalProfile(profileRef.current).then((blended) => {
      setProfile(blended)
    })
  }, [])

  const showFeedback = useCallback((text: string, ok: boolean) => {
    setFeedback({ text, ok })
    setTimeout(() => setFeedback(null), 600)
  }, [])

  // -- Hit handler ------------------------------------------------------------
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

  // -- Keyboard fallback ------------------------------------------------------
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

  // -- Phone motion -> swing ---------------------------------------------------
  useEffect(() => {
    if (!motion || phase !== 'playing') return

    const { data: enriched, state: next, angSpeed } = enrichWithSlice(
      motion,
      sliceStateRef.current,
      profileRef.current.threshold,
    )
    sliceStateRef.current = next

    const dir   = enriched.sliceDirection as SliceDirection
    const power = enriched.slicePower ?? 0

    if (swingArmedRef.current && power >= SWING_ARM_POWER && dir !== 'none') {
      swingArmedRef.current = false
      // Record this swing speed for adaptive calibration
      const updated = updateOnHit(profileRef.current, angSpeed)
      setProfile(updated)
      saveProfile(updated)
      handleSwing(dir as NoteDir)
    } else if (!swingArmedRef.current && power < SWING_RESET_POW) {
      swingArmedRef.current = true
    }

    // Near-miss: phone moved fast but didn't cross threshold - loosen it
    if (
      swingArmedRef.current &&
      motion.swingSpeed > 14 &&
      angSpeed > profileRef.current.threshold * 0.65 &&
      power < SWING_ARM_POWER
    ) {
      const updated = updateOnNearMiss(profileRef.current)
      setProfile(updated)
      saveProfile(updated)
    }
  }, [motion, phase, handleSwing])

  // -- Game loop --------------------------------------------------------------
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
        submitSessionToServer(profileRef.current)
        return
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [phase, beatmap, showFeedback])

  // -- Start ------------------------------------------------------------------
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

  // -- Block position: scale + translate for "coming at you" illusion ---------
  // progress 0 = just spawned (far, tiny), 1 = at hit zone (close, full size)
  // hit zone is at bottom 20% of arena
  const getBlockStyle = (note: ActiveNote): React.CSSProperties => {
    const progress = Math.min(
      (audioTime - (note.time - LEAD_TIME)) / LEAD_TIME,
      1,
    )
    // Scale from 0.15 (far) to 1.1 (close)
    const scale = 0.15 + progress * 0.95
    // Y: start at 15% from top, end at 78% (hit zone = 22% from bottom)
    const top = 15 + progress * 63
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
      {/* -- HUD -- */}
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
            <span className={`rg-stat-val rg-mult-${multiplier}`}>x{multiplier}</span>
          </div>
          <div className="rg-stat">
            <span className="rg-stat-label">Acc</span>
            <span className="rg-stat-val">{accuracy}%</span>
          </div>
          <div className="rg-stat" title={`Adaptive threshold: ${Math.round(profile.threshold)} deg/s (${profile.hitCount} swings learned)`}>
            <span className="rg-stat-label">Sens</span>
            <span className="rg-stat-val rg-sens">{Math.round(180 / profile.threshold * 10)}%</span>
          </div>
        </div>
      )}

      {/* -- Feedback -- */}
      {feedback && (
        <div className={`rg-feedback ${feedback.ok ? 'rg-feedback--hit' : 'rg-feedback--miss'}`}>
          {feedback.text}
        </div>
      )}

      {/* -- Idle screen -- */}
      {phase === 'idle' && (
        <div className="rg-overlay">
          <div className="rg-grid-floor" />
          <h2 className="rg-title">Forest Beats</h2>
          <p className="rg-sub">
            {beatmap ? `${beatmap.notes.length} notes - ${beatmap.song}` : 'loading beatmap...'}
          </p>
          <p className="rg-crowd-note">
            {profile.hitCount > 0
              ? `your style - ${profile.hitCount} swings learned`
              : 'swing detection adapts to you as you play'
            }
          </p>
          <p className="rg-hint">swing your phone or use arrow keys</p>
          <button className="rg-start-btn" onClick={startGame} disabled={!beatmap}>
            {'> play'}
          </button>
          {profile.hitCount > 0 && (
            <p className="rg-calibration-note">
              calibrated from {profile.hitCount} swing{profile.hitCount !== 1 ? 's' : ''} *{' '}
              <button className="rg-reset-cal" onClick={() => setProfile(resetProfile())}>
                reset
              </button>
            </p>
          )}
        </div>
      )}

      {/* -- Done screen -- */}
      {phase === 'done' && (
        <div className="rg-overlay">
          <h2 className="rg-title">Complete!</h2>
          <div className="rg-results">
            <div><span>Score</span>     <strong>{score.toLocaleString()}</strong></div>
            <div><span>Accuracy</span>  <strong>{accuracy}%</strong></div>
            <div><span>Hits</span>      <strong>{hits}</strong></div>
            <div><span>Misses</span>    <strong>{misses}</strong></div>
          </div>
          <button className="rg-start-btn" onClick={startGame}>{'> Play Again'}</button>
        </div>
      )}

      {/* -- Arena -- */}
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

          {/* Saber - free-moving */}
          <FreeSaber motion={motion} lastSwingDir={lastSwingDir} />
        </div>
      )}
    </div>
  )
}
