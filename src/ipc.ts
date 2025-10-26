import net, { Server, Socket } from 'net';
import { EventEmitter } from 'events';
import fs from 'fs';

export type IPCInboundMessage =
  | { type: 'hello'; client: string }
  | { type: 'launch-app'; appId: string; origin?: string }
  | { type: string; [key: string]: unknown };

export type IPCOutboundMessage =
  | { type: 'launch-app'; appId: string; timestamp: number }
  | { type: 'ack'; action: string; status: 'ok' | 'error'; detail?: string }
  | { type: string; [key: string]: unknown };

export interface DesktopIPCOptions {
  socketPath?: string;
}

export class DesktopIPC extends EventEmitter {
  private sockets = new Set<Socket>();
  private server: Server | null = null;
  private readonly socketPath: string;

  constructor(options: DesktopIPCOptions = {}) {
    super();
    this.socketPath = options.socketPath ?? '/tmp/desktop-menu.sock';
  }

  start(): void {
    if (this.server) {
      return;
    }

    if (fs.existsSync(this.socketPath)) {
      fs.unlinkSync(this.socketPath);
    }

    this.server = net.createServer((socket) => this.onConnection(socket));
    this.server.on('error', (error) => {
      this.emit('error', error);
    });
    this.server.listen(this.socketPath, () => {
      this.emit('ready', this.socketPath);
    });
  }

  stop(): void {
    for (const socket of this.sockets) {
      socket.destroy();
    }
    this.sockets.clear();
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    if (fs.existsSync(this.socketPath)) {
      fs.unlinkSync(this.socketPath);
    }
  }

  broadcast(message: IPCOutboundMessage): void {
    const payload = `${JSON.stringify(message)}\n`;
    for (const socket of this.sockets) {
      if (!socket.destroyed) {
        socket.write(payload);
      }
    }
  }

  private onConnection(socket: Socket): void {
    this.sockets.add(socket);
    this.emit('connection', socket);

    socket.setEncoding('utf-8');
    let buffer = '';

    socket.on('data', (chunk) => {
      buffer += chunk;
      let newlineIndex = buffer.indexOf('\n');
      while (newlineIndex !== -1) {
        const rawMessage = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (rawMessage.length > 0) {
          this.processMessage(rawMessage, socket);
        }
        newlineIndex = buffer.indexOf('\n');
      }
    });

    socket.on('close', () => {
      this.sockets.delete(socket);
      this.emit('disconnect', socket);
    });

    socket.on('error', (error) => {
      this.emit('client-error', error);
    });
  }

  private processMessage(rawMessage: string, socket: Socket): void {
    try {
      const message = JSON.parse(rawMessage) as IPCInboundMessage;
      this.emit('message', message, socket);
    } catch (error) {
      this.emit('client-error', error);
      socket.write(
        `${JSON.stringify({
          type: 'ack',
          action: 'parse',
          status: 'error',
          detail: 'Invalid JSON payload'
        })}\n`
      );
    }
  }
}
