import React, { useEffect, useMemo, useState } from 'react';

interface DesktopApp {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: string;
}

interface AppsResponse {
  apps: DesktopApp[];
}

interface SystemInfo {
  hostname: string;
  platform: string;
  uptime: number;
  battery: string;
  wifi: string;
}

const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  if (hours >= 24) {
    const days = Math.round(hours / 24);
    return formatter.format(-days, 'day');
  }
  if (hours >= 1) {
    return formatter.format(-hours, 'hour');
  }
  const minutes = Math.max(1, Math.round(seconds / 60));
  return formatter.format(-minutes, 'minute');
}

const App: React.FC = () => {
  const [apps, setApps] = useState<DesktopApp[]>([]);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Select an app to launch');
  const [pendingAppId, setPendingAppId] = useState<string | null>(null);

  useEffect(() => {
    async function loadApps() {
      const response = await fetch('/api/apps');
      const data: AppsResponse = await response.json();
      setApps(data.apps);
    }

    async function loadSystemInfo() {
      const response = await fetch('/api/system');
      const data: SystemInfo = await response.json();
      setSystemInfo(data);
    }

    loadApps();
    loadSystemInfo();
  }, []);

  const groupedApps = useMemo(() => {
    const groups = new Map<string, DesktopApp[]>();
    for (const app of apps) {
      if (!groups.has(app.category)) {
        groups.set(app.category, []);
      }
      groups.get(app.category)!.push(app);
    }
    return Array.from(groups.entries());
  }, [apps]);

  async function handleLaunch(app: DesktopApp) {
    try {
      setPendingAppId(app.id);
      const response = await fetch(`/api/apps/${app.id}/launch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to launch');
      }
      setStatusMessage(`${app.name} is launching...`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to launch app');
    } finally {
      setPendingAppId(null);
    }
  }

  return (
    <div className="desktop-shell">
      <header className="desktop-shell__header">
        <div>
          <h1>Orion Desktop</h1>
          <p className="desktop-shell__subtitle">Quick-launch your favorite tools</p>
        </div>
        {systemInfo && (
          <div className="desktop-shell__status">
            <span>{systemInfo.hostname}</span>
            <span>{systemInfo.platform}</span>
            <span>Uptime {formatUptime(systemInfo.uptime)}</span>
            <span>Battery {systemInfo.battery}</span>
            <span>Wi-Fi {systemInfo.wifi}</span>
          </div>
        )}
      </header>
      <main className="desktop-shell__content">
        {groupedApps.map(([category, group]) => (
          <section key={category} className="desktop-shell__section">
            <h2>{category}</h2>
            <div className="desktop-shell__grid">
              {group.map((app) => (
                <button
                  key={app.id}
                  className="desktop-shell__tile"
                  onClick={() => handleLaunch(app)}
                  disabled={pendingAppId === app.id}
                >
                  <span className="desktop-shell__tile-icon" aria-hidden="true">
                    {app.icon}
                  </span>
                  <span className="desktop-shell__tile-label">{app.name}</span>
                  <span className="desktop-shell__tile-description">{app.description}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </main>
      <footer className="desktop-shell__footer">
        <span>{statusMessage}</span>
      </footer>
    </div>
  );
};

export default App;
