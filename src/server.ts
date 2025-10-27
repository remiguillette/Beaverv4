import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import { existsSync } from 'node:fs';
import { DesktopIPC, IPCInboundMessage } from './ipc.js';

const app = express();
const PORT = 5000;
const ipc = new DesktopIPC();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolvePublicDir(): string | null {
  const candidates = [
    path.join(__dirname, 'public'),
    path.join(__dirname, 'frontend'),
    path.join(process.cwd(), 'dist', 'public'),
    path.join(process.cwd(), 'src', 'frontend')
  ];

  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, 'index.html'))) {
      return candidate;
    }
  }

  return null;
}

const publicDir = resolvePublicDir();

interface DesktopApp {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: string;
}

const desktopApps: DesktopApp[] = [
  {
    id: 'mail',
    name: 'Mail Station',
    icon: '✉️',
    description: 'Check and compose messages in a focused workspace.',
    category: 'Communication'
  },
  {
    id: 'browser',
    name: 'Skyline Browser',
    icon: '🌐',
    description: 'Browse the web with a lightweight and fast browser.',
    category: 'Internet'
  },
  {
    id: 'files',
    name: 'Archive Explorer',
    icon: '🗂️',
    description: 'Manage documents, photos, and downloads with ease.',
    category: 'Productivity'
  },
  {
    id: 'music',
    name: 'Waveform Studio',
    icon: '🎧',
    description: 'Stream playlists and manage your music library.',
    category: 'Media'
  }
];

app.use(express.json());
if (publicDir) {
  app.use(express.static(publicDir));
} else {
  console.warn('Static assets directory not found. Run "npm run build:frontend" to generate the React bundle.');
}

app.get('/api/apps', (_req, res) => {
  res.json({ apps: desktopApps });
});

app.get('/api/system', (_req, res) => {
  res.json({
    hostname: os.hostname(),
    platform: os.platform(),
    uptime: os.uptime(),
    battery: '82%',
    wifi: 'Connected'
  });
});

app.post('/api/apps/:id/launch', (req, res) => {
  const appId = req.params.id;
  const appInfo = desktopApps.find((item) => item.id === appId);

  if (!appInfo) {
    return res.status(404).json({ error: 'Application not found' });
  }

  ipc.broadcast({ type: 'launch-app', appId, timestamp: Date.now() });

  res.json({ status: 'ok', message: `${appInfo.name} requested` });
});

if (publicDir) {
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
} else {
  app.get('*', (_req, res) => {
    res.status(503).send('Frontend bundle not found. Run "npm run build:frontend" and restart the server.');
  });
}

ipc.on('message', (message: IPCInboundMessage) => {
  if (message.type === 'launch-app') {
    console.log(`[IPC] Launch requested from ${message.origin ?? 'client'}: ${message.appId}`);
  }
});

ipc.on('ready', (socketPath) => {
  console.log(`IPC server ready on ${socketPath}`);
});

ipc.on('error', (error) => {
  console.error('IPC server error:', error);
});

ipc.start();

app.listen(PORT, () => {
  console.log(`Desktop menu server listening on http://localhost:${PORT}`);
});
