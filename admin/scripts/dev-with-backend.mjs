import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const adminDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nodeDir = path.resolve(adminDir, '../node');
const backendPort = Number(process.env.BACKEND_PORT || 3456);

function isListening(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' }, () => {
      socket.end();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
  });
}

const children = [];

function spawnInherit(command, args, cwd) {
  const child = spawn(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  children.push(child);
  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 0);
  });
}

if (await isListening(backendPort)) {
  console.log(`Node API already listening on ${backendPort}`);
} else {
  console.log(`Starting Node API (npm run local) on ${backendPort}...`);
  spawnInherit('npm', ['run', 'local'], nodeDir);
}

spawnInherit('npx', ['next', 'dev', ...process.argv.slice(2)], adminDir);

function shutdown() {
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
