import { Suspense, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useNavigate } from 'react-router-dom'
import cubeGlb from '../assets/cube_5.glb?url'
import { loadSettings, saveSettings } from '../lib/settings'
import type { GameSettings } from '../lib/settings'
import './ChooseBlocksPage.css'

useGLTF.preload(cubeGlb)

type BlockType = GameSettings['chosenBlock']
type BlockMode = GameSettings['blockMode']

// ── Colour/glow map ───────────────────────────────────────────────────────────
const BLOCK_META: Record<BlockType, { label: string; desc: string; emoji: string; color: string; glow: string }> = {
  face: { label: 'Face Block',  desc: 'The original Blender design with a friendly face', emoji: '😊', color: '#ffb300', glow: 'rgba(255,179,0,0.65)' },
  blue: { label: 'Blue Block',  desc: 'A smooth cobalt cube — cool and crisp',            emoji: '🔵', color: '#3b82f6', glow: 'rgba(59,130,246,0.65)' },
  red:  { label: 'Red Block',   desc: 'A bold crimson cube — fiery and sharp',            emoji: '🔴', color: '#ef4444', glow: 'rgba(239,68,68,0.65)'  },
}

// ── Three.js models ───────────────────────────────────────────────────────────
function FaceModel({ spin = false }: { spin?: boolean }) {
  const { scene } = useGLTF(cubeGlb)
  const groupRef  = useRef<THREE.Group>(null)
  const modelRef  = useRef<THREE.Group | null>(null)

  if (!modelRef.current) {
    const clone = scene.clone(true)
    const box   = new THREE.Box3().setFromObject(clone)
    const size  = new THREE.Vector3(); const center = new THREE.Vector3()
    box.getSize(size); box.getCenter(center)
    const s = 1.6 / (Math.max(size.x, size.y, size.z) || 1)
    clone.scale.setScalar(s)
    clone.position.set(-center.x * s, -center.y * s, -center.z * s)
    clone.rotation.set(0.32, -0.6, 0)
    clone.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      const mats = Array.isArray(child.material) ? child.material : [child.material]
      mats.forEach((m) => {
        if (m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshPhysicalMaterial) {
          m.emissive = m.color.clone(); m.emissiveIntensity = 0.15
        }
      })
    })
    modelRef.current = clone
  }

  useFrame((_, dt) => { if (spin && groupRef.current) groupRef.current.rotation.y += dt * 1.0 })
  return <group ref={groupRef}><primitive object={modelRef.current} /></group>
}

function ColorCube({ color, spin = false }: { color: string; spin?: boolean }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame((_, dt) => { if (spin && ref.current) ref.current.rotation.y += dt * 1.0 })
  return (
    <mesh ref={ref} rotation={[0.32, -0.6, 0]}>
      <boxGeometry args={[1.5, 1.5, 1.5]} />
      <meshStandardMaterial color={color} roughness={0.38} metalness={0.18} />
    </mesh>
  )
}

function Lights() {
  return (
    <>
      <ambientLight intensity={1.4} color="#fff8e1" />
      <directionalLight position={[3, 4, 6]} intensity={1.8} color="#fffde7" />
      <directionalLight position={[-3, -1, 4]} intensity={0.5} color="#c8e6c9" />
    </>
  )
}

// ── Flat square preview ───────────────────────────────────────────────────────
function FlatPreview({ color, glow, size = 120 }: { color: string; glow: string; size?: number }) {
  return (
    <div className="cbp-flat-preview" style={{ width: size, height: size }}>
      <div
        className="cbp-flat-square"
        style={{
          background: color,
          boxShadow: `0 0 24px 8px ${glow}, 0 0 56px 20px ${glow.replace('0.65', '0.3')}`,
        }}
      />
    </div>
  )
}

// ── Card (one block option) ───────────────────────────────────────────────────
function BlockCard({ type, mode, selected, onClick }: {
  type: BlockType; mode: BlockMode; selected: boolean; onClick: () => void
}) {
  const { label, desc, emoji, color, glow } = BLOCK_META[type]
  return (
    <button
      type="button"
      className={`cbp-card ${selected ? 'cbp-card--active' : ''}`}
      onClick={onClick}
    >
      <div className="cbp-card-canvas">
        {mode === '3d' ? (
          <Canvas
            gl={{ alpha: true, antialias: true }}
            camera={{ position: [0, 0, 3.4], fov: 38 }}
            dpr={[1, 1.5]}
            style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
          >
            <Lights />
            <Suspense fallback={null}>
              {type === 'face' && <FaceModel spin />}
              {type === 'blue' && <ColorCube color={color} spin />}
              {type === 'red'  && <ColorCube color={color} spin />}
            </Suspense>
          </Canvas>
        ) : (
          <FlatPreview color={color} glow={glow} size={80} />
        )}
      </div>
      <div className="cbp-card-info">
        <p className="cbp-card-emoji">{emoji}</p>
        <p className="cbp-card-label">{label}</p>
        <p className="cbp-card-desc">{desc}</p>
      </div>
      {selected && <span className="cbp-card-check">✓ selected</span>}
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function ChooseBlocksPage() {
  const navigate = useNavigate()
  const init = loadSettings()
  const [chosen, setChosen] = useState<BlockType>(init.chosenBlock)
  const [mode,   setMode]   = useState<BlockMode>(init.blockMode)

  const select = (t: BlockType) => { setChosen(t); saveSettings({ chosenBlock: t }) }
  const toggleMode = (m: BlockMode) => { setMode(m); saveSettings({ blockMode: m }) }

  const { label, desc, emoji, color, glow } = BLOCK_META[chosen]

  return (
    <div className="cbp-page">
      <button className="cbp-back" onClick={() => navigate('/')} type="button">← back</button>
      <h1 className="cbp-title">Choose Your Block</h1>

      {/* 3D / Flat toggle */}
      <div className="cbp-mode-toggle">
        <button
          type="button"
          className={`cbp-mode-btn ${mode === '3d' ? 'cbp-mode-btn--active' : ''}`}
          onClick={() => toggleMode('3d')}
        >
          ◈ 3D
        </button>
        <button
          type="button"
          className={`cbp-mode-btn ${mode === 'flat' ? 'cbp-mode-btn--active' : ''}`}
          onClick={() => toggleMode('flat')}
        >
          ◻ Flat
        </button>
      </div>

      <div className="cbp-layout">
        {/* Left: big viewer */}
        <div className="cbp-viewer-wrap">
          <div className="cbp-canvas-box">
            {mode === '3d' ? (
              <Canvas
                gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
                camera={{ position: [0, 0, 4], fov: 42 }}
                dpr={[1, 2]}
                style={{ width: '100%', height: '100%' }}
              >
                <Lights />
                <Suspense fallback={null}>
                  {chosen === 'face' && <FaceModel />}
                  {chosen === 'blue' && <ColorCube color={color} />}
                  {chosen === 'red'  && <ColorCube color={color} />}
                </Suspense>
                <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={1.5} />
              </Canvas>
            ) : (
              <FlatPreview color={color} glow={glow} size={220} />
            )}
          </div>
          {mode === '3d' && <p className="cbp-drag-hint">✦ drag to spin · auto-rotating</p>}
          {mode === 'flat' && <p className="cbp-drag-hint">glowing · grows as it approaches</p>}

          <div className="cbp-selected-info">
            <span className="cbp-selected-emoji">{emoji}</span>
            <div>
              <p className="cbp-selected-name">{label}</p>
              <p className="cbp-selected-desc">{desc}</p>
            </div>
          </div>
        </div>

        {/* Right: option cards */}
        <div className="cbp-options">
          <p className="cbp-options-heading">Select a style</p>
          {(['face', 'blue', 'red'] as BlockType[]).map((t) => (
            <BlockCard key={t} type={t} mode={mode} selected={chosen === t} onClick={() => select(t)} />
          ))}
        </div>
      </div>
    </div>
  )
}
