import { useEffect, useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useSocket } from '../hooks/useSocket'
import { createSessionId } from '../lib/session'
import type { MotionData, NetworkInfo } from '../types/motion'
import { LightsaberView } from '../components/LightsaberView'
import { RhythmGame } from '../game/RhythmGame'
import './HostPage.css'

export function HostPage() {
  const [sessionId] = useState(createSessionId)
  const [network, setNetwork] = useState<NetworkInfo | null>(null)
  const [selectedIp, setSelectedIp] = useState('')
  const [copied, setCopied] = useState(false)
  const [controllerConnected, setControllerConnected] = useState(false)
  const [motion, setMotion] = useState<MotionData | null>(null)
  const { socketRef, connected: socketConnected } = useSocket(sessionId, 'host')

  const usableAddresses = useMemo(
    () => network?.addresses?.filter((a) => !a.virtual) ?? [],
    [network],
  )

  useEffect(() => {
    const root = document.documentElement
    if (controllerConnected) {
      root.classList.add('sabersync-playing')
      document.body.classList.add('sabersync-playing')
    } else {
      root.classList.remove('sabersync-playing')
      document.body.classList.remove('sabersync-playing')
    }
    return () => {
      root.classList.remove('sabersync-playing')
      document.body.classList.remove('sabersync-playing')
    }
  }, [controllerConnected])

  useEffect(() => {
    let interval: number | undefined

    const refreshNetwork = () =>
      fetch('/api/network')
        .then((r) => r.json())
        .then((data: NetworkInfo) => {
          setNetwork(data)
          setSelectedIp((current) => {
            const stillValid = data.addresses?.some((a) => a.ip === current && !a.virtual)
            return stillValid ? current : data.ip
          })
          if (data.tunnelUrl && interval) {
            window.clearInterval(interval)
            interval = undefined
          } else if (!data.tunnelUrl && data.tunnelPending && !interval) {
            interval = window.setInterval(refreshNetwork, 1000)
          }
        })
        .catch(() => {
          setNetwork((current) =>
            current ?? { ip: window.location.hostname, port: 5173, tunnelPending: true },
          )
          setSelectedIp((current) => current || window.location.hostname)
        })

    refreshNetwork()
    interval = window.setInterval(refreshNetwork, 1000)

    return () => {
      if (interval) window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    const socket = socketRef.current
    if (!socket || !socketConnected) return

    const onMotion = (data: MotionData) => setMotion(data)
    const onConnected = () => setControllerConnected(true)
    const onDisconnected = () => {
      setControllerConnected(false)
      setMotion(null)
    }
    const onTunnelReady = ({ tunnelUrl: url }: { tunnelUrl: string }) => {
      setNetwork((current) =>
        current ? { ...current, tunnelUrl: url, tunnelPending: false } : current,
      )
    }
    const onTunnelLost = () => {
      setNetwork((current) =>
        current ? { ...current, tunnelUrl: null, tunnelPending: true } : current,
      )
    }

    socket.on('motion', onMotion)
    socket.on('controller-connected', onConnected)
    socket.on('controller-disconnected', onDisconnected)
    socket.on('tunnel-ready', onTunnelReady)
    socket.on('tunnel-lost', onTunnelLost)

    return () => {
      socket.off('motion', onMotion)
      socket.off('controller-connected', onConnected)
      socket.off('controller-disconnected', onDisconnected)
      socket.off('tunnel-ready', onTunnelReady)
      socket.off('tunnel-lost', onTunnelLost)
    }
  }, [socketRef, socketConnected, sessionId])

  const localUrl = network && selectedIp && sessionId
    ? `http://${selectedIp}:${network.port}/controller/${sessionId}`
    : ''

  const qrUrl =
    network?.tunnelUrl && sessionId ? `${network.tunnelUrl}/controller/${sessionId}` : ''

  const copyUrl = async () => {
    if (!qrUrl) return
    await navigator.clipboard.writeText(qrUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`host-page ${controllerConnected ? 'host-page--playing' : ''}`}>
      {!controllerConnected && (
        <header className="host-header">
          <div>
            <p className="eyebrow">JamHacks · SaberSync</p>
            <h1>Phone Lightsaber</h1>
            <p className="subtitle">
              Anyone can scan the QR code — any phone, any network. No Wi‑Fi setup needed.
            </p>
          </div>
          <div className="status-pill">
            <span className="status-dot" />
            Waiting for phone…
          </div>
        </header>
      )}

      {controllerConnected && (
        <div className="playing-hud">
          <p className="eyebrow">SaberSync · Live</p>
          <div className="status-pill online">
            <span className="status-dot" />
            Phone connected
          </div>
        </div>
      )}

      <div className={`host-layout ${controllerConnected ? 'host-layout--playing' : ''}`}>
        {!controllerConnected && (
        <aside className="qr-panel">
          <div className="qr-card">
            {qrUrl ? (
              <QRCodeSVG value={qrUrl} size={220} level="M" includeMargin />
            ) : (
              <div className="qr-placeholder">
                {network ? 'Starting secure link…' : 'Loading…'}
              </div>
            )}
          </div>

          <p className="session-label">Session</p>
          <p className="session-id">{sessionId}</p>

          {usableAddresses.length > 1 && !qrUrl && (
            <label className="ip-picker">
              <span>Network IP for phone</span>
              <select value={selectedIp} onChange={(e) => setSelectedIp(e.target.value)}>
                {usableAddresses.map((a) => (
                  <option key={a.ip} value={a.ip}>
                    {a.ip} ({a.name})
                  </option>
                ))}
              </select>
            </label>
          )}

          {qrUrl ? (
            <p className="network-note tunnel-active">
              Public https link — share or scan from any phone. Motion permission is asked when
              they open the link.
            </p>
          ) : (
            <p className="network-note warn">
              {network?.tunnelPending
                ? 'Tunnel expired — getting a new link… QR will update automatically.'
                : 'Starting public link… QR appears in about 10–20 seconds.'}
            </p>
          )}

          {qrUrl && (
            <>
              <div className="url-row">
                <code className="controller-link">{qrUrl}</code>
                <button type="button" className="copy-btn" onClick={copyUrl}>
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="phone-hint">
                Scan with your phone&apos;s Camera app, or paste this https link into Safari or
                Chrome on your phone.
              </p>
            </>
          )}

          {localUrl && !qrUrl && (
            <p className="local-url-note">
              Same-Wi‑Fi fallback only: <code>{localUrl}</code>
            </p>
          )}

          <ul className="tips">
            <li><strong>Don&apos;t refresh</strong> the computer page — it changes the session code</li>
            <li>Phone opens controller page → tap <strong>Allow Motion &amp; Orientation</strong></li>
            <li>Swing <strong>right</strong> → saber goes right. Swing <strong>up</strong> → saber goes up</li>
            <li>Beat blocks in the lanes are coming next</li>
          </ul>
        </aside>
        )}

        <main className="arena">
          {controllerConnected ? (
            <RhythmGame motion={motion} />
          ) : (
            <LightsaberView
              motion={motion}
              connected={controllerConnected}
              beatMode={false}
            />
          )}
        </main>
      </div>
    </div>
  )
}
