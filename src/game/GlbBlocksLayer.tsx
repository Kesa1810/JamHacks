import { Suspense, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import cubeGlb from '../assets/cube_5.glb?url'

useGLTF.preload(cubeGlb)

const FACE_GOLD = new THREE.Color('#ffb300')

/** Real GLB cube — keeps its baked face design, faces the camera, no spin. */
function CubeModel() {
  const { scene } = useGLTF(cubeGlb)

  const model = useMemo(() => {
    const clone = scene.clone(true)

    // Normalize size so the cube always fills the block the same way
    const box = new THREE.Box3().setFromObject(clone)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)
    const maxDim = Math.max(size.x, size.y, size.z) || 1
    const scale = 1.7 / maxDim
    clone.scale.setScalar(scale)
    clone.position.set(-center.x * scale, -center.y * scale, -center.z * scale)

    // Tilt so the front + top + side faces all read — the 3D box look
    clone.rotation.set(0.32, -0.6, 0)

    // Keep the model's own face textures/colors; just make them pop a bit
    clone.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      const mats = Array.isArray(child.material) ? child.material : [child.material]
      mats.forEach((mat) => {
        if (
          mat instanceof THREE.MeshStandardMaterial ||
          mat instanceof THREE.MeshPhysicalMaterial
        ) {
          mat.emissive = mat.color.clone()
          mat.emissiveIntensity = 0.18
          mat.metalness = 0.08
          mat.roughness = 0.55
        }
      })
    })

    return clone
  }, [scene])

  return <primitive object={model} />
}

/** GLB cube facing front; grows small→big via the arena's CSS perspective. */
export function GlbCube() {
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
        <CubeModel />
      </Suspense>
    </Canvas>
  )
}
