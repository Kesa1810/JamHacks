import { Suspense, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import cubeGlb from '../assets/cube_5.glb?url'
import type { GameSettings } from '../lib/settings'

useGLTF.preload(cubeGlb)

const FACE_GOLD = new THREE.Color('#ffb300')

function CubeModel() {
  const { scene } = useGLTF(cubeGlb)
  const model = useMemo(() => {
    const clone = scene.clone(true)
    const box = new THREE.Box3().setFromObject(clone)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size); box.getCenter(center)
    const s = 1.7 / (Math.max(size.x, size.y, size.z) || 1)
    clone.scale.setScalar(s)
    clone.position.set(-center.x * s, -center.y * s, -center.z * s)
    clone.rotation.set(0.32, -0.6, 0)
    clone.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      const mats = Array.isArray(child.material) ? child.material : [child.material]
      mats.forEach((mat) => {
        if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
          mat.emissive = mat.color.clone(); mat.emissiveIntensity = 0.18
          mat.metalness = 0.08; mat.roughness = 0.55
        }
      })
    })
    return clone
  }, [scene])
  return <primitive object={model} />
}

function ColorCubeModel({ color }: { color: string }) {
  return (
    <mesh rotation={[0.32, -0.6, 0]}>
      <boxGeometry args={[1.6, 1.6, 1.6]} />
      <meshStandardMaterial color={color} roughness={0.35} metalness={0.2} />
    </mesh>
  )
}

type BlockStyle = GameSettings['chosenBlock']

const FLAT_COLORS: Record<BlockStyle, { bg: string; glow: string }> = {
  face: { bg: '#ffb300', glow: 'rgba(255,179,0,0.7)' },
  blue: { bg: '#3b82f6', glow: 'rgba(59,130,246,0.7)' },
  red:  { bg: '#ef4444', glow: 'rgba(239,68,68,0.7)'  },
}

/** 2-D glowing square — no Three.js, fills the block container. */
export function FlatBlock({ blockStyle = 'face' }: { blockStyle?: BlockStyle }) {
  const { bg, glow } = FLAT_COLORS[blockStyle]
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: bg,
        borderRadius: '14%',
        boxShadow: `0 0 18px 6px ${glow}, 0 0 40px 12px ${glow.replace('0.7', '0.35')}`,
      }}
    />
  )
}

export function GlbCube({ blockStyle = 'face' }: { blockStyle?: BlockStyle }) {
  return (
    <Canvas
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0, 3], fov: 40 }}
      dpr={[1, 1.75]}
      style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
    >
      <ambientLight intensity={1.1} color="#fff8e1" />
      <directionalLight position={[2, 3, 6]} intensity={1.6} color="#fffde7" />
      <directionalLight position={[-3, -1, 3]} intensity={0.55} color={FACE_GOLD} />
      <Suspense fallback={null}>
        {blockStyle === 'face' && <CubeModel />}
        {blockStyle === 'blue' && <ColorCubeModel color="#3b82f6" />}
        {blockStyle === 'red'  && <ColorCubeModel color="#ef4444" />}
      </Suspense>
    </Canvas>
  )
}
