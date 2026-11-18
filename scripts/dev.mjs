import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const processes = [
  spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server/index.mjs'], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  }),
  spawn(process.execPath, [resolve(root, 'node_modules', 'vite', 'bin', 'vite.js')], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  }),
]

let stopping = false

function stop(code) {
  if (stopping) return
  stopping = true
  process.exitCode = code
  for (const child of processes) {
    if (child.exitCode === null && child.signalCode === null) child.kill()
  }
}

for (const child of processes) {
  child.once('error', (error) => {
    console.error('Could not start the PrintHub development services:', error.message)
    stop(1)
  })
  child.once('exit', (code) => stop(code ?? 1))
}

process.once('SIGINT', () => stop(130))
process.once('SIGTERM', () => stop(143))
