# Desktop Menu Prototype

This project demonstrates a hybrid desktop environment consisting of a Node.js backend that exposes HTTP and IPC APIs and a lightweight React-based launcher UI that can be embedded inside a native shell (e.g., a GTK 4 application).

## Prerequisites

- Node.js 18 or later (required for ESM support and `fetch` in Node)
- npm 9 or later
- (Optional) A native client capable of speaking to the Unix domain socket at `/tmp/desktop-menu.sock` for IPC integration.

## Installation

```bash
npm install
```

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Starts the backend in watch mode with hot reload for TypeScript changes. The frontend is served from the prebuilt assets in `src/frontend`. |
| `npm run build:backend` | Compiles the TypeScript backend into `dist/` using `tsc`. |
| `npm run build:frontend` | Bundles the React UI into `dist/public/` using `esbuild`. |
| `npm run build` | Runs both backend and frontend builds. |
| `npm start` | Runs the compiled backend from `dist/server.js`. |

## Project Layout

- `src/server.ts` – Express HTTP server that serves API endpoints and static frontend assets.
- `src/ipc.ts` – IPC helper that exposes a Unix socket for native clients to interact with the backend.
- `src/frontend/` – React single-page application that renders the application grid and communicates with the backend HTTP API.
- `scripts/build-frontend.mjs` – Custom build script for the frontend bundle.

## Development Workflow

1. Install dependencies with `npm install`.
2. Run `npm run build:frontend` once to generate the initial UI assets in `dist/public/`.
3. Start the backend in development mode with `npm run dev`.
4. Navigate to [http://localhost:5000](http://localhost:5000) to load the launcher UI.

## Production Build

```bash
npm run build
npm start
```

The frontend assets will be emitted to `dist/public/`, and the compiled backend will run from `dist/server.js`.

## IPC Integration

The backend exposes a Unix domain socket (default: `/tmp/desktop-menu.sock`) that native shells can connect to. Messages are newline-delimited JSON objects. For example, sending

```json
{"type":"launch-app","appId":"browser","origin":"gtk-shell"}
```

to the socket broadcasts a launch request to all connected clients and logs the request on the backend.

