const { app, BrowserWindow, shell } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const net = require('net')

const PORT = 5173
let serverProcess = null
let mainWindow = null

function waitForPort(port, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeout
    const tryConnect = () => {
      const socket = new net.Socket()
      socket.setTimeout(500)
      socket
        .on('connect', () => { socket.destroy(); resolve() })
        .on('timeout', retry)
        .on('error', retry)
        .connect(port, '127.0.0.1')
    }
    const retry = () => {
      if (Date.now() >= deadline) return reject(new Error(`Port ${port} not ready in time`))
      setTimeout(tryConnect, 300)
    }
    tryConnect()
  })
}

function startServer() {
  const serverPath = path.join(__dirname, '..', 'server.mjs')
  serverProcess = spawn(process.execPath, [serverPath], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    env: { ...process.env, ELECTRON: '1' },
  })
  serverProcess.on('error', (err) => console.error('Server error:', err))
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#0f1f17',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  mainWindow.loadURL(`http://localhost:${PORT}`)

  // Open external links in the default browser, not Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => { mainWindow = null })
}

app.whenReady().then(async () => {
  startServer()
  try {
    await waitForPort(PORT)
  } catch (e) {
    console.error('Server failed to start:', e.message)
    app.quit()
    return
  }
  createWindow()
})

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill()
    serverProcess = null
  }
  app.quit()
})

app.on('activate', () => {
  if (mainWindow === null) createWindow()
})
