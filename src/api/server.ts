// HTTP + WebSocket server for Seed. REST endpoints in docs/API.md; the WebSocket
// protocol is defined in docs/SOUL_INTERFACE.md.

import express, { type Request, type Response } from 'express';
import { WebSocketServer, type WebSocket } from 'ws';
import { createServer } from 'node:http';
import { WorldEngine } from '../engine/WorldEngine.js';
import { InputValidator } from '../security/InputValidator.js';
import { PermissionSystem } from '../security/PermissionSystem.js';
import { RateLimiter } from '../security/RateLimiter.js';
import { apiKeyAuth } from '../security/ApiKeyAuth.js';
import { sanitizeString } from '../security/sanitize.js';
import { SoulClient } from './soulClient.js';
import { Logger } from '../reliability/Logger.js';

const log = Logger.for('api');

export interface ServerDeps {
  engine: WorldEngine;
  soulClient: SoulClient;
  port?: number;
}

const actionValidator = new InputValidator();
const permissions = new PermissionSystem();
const limiter = new RateLimiter(100);

export function createApp(deps: ServerDeps) {
  const app = express();
  app.use(express.json({ limit: '256kb' }));
  app.use(
    apiKeyAuth({
      enabled: process.env.SEED_AUTH === 'on',
      validKeys: (process.env.SEED_API_KEYS ?? 'dev-seed-key').split(','),
    }),
  );

  // ---- System ------------------------------------------------------------
  app.get('/api/world/status', (_req: Request, res: Response) => {
    const w = deps.engine.currentWorld;
    res.json({
      world: w?.config.name ?? null,
      running: deps.engine.isRunning,
      tick: w?.tick ?? 0,
      worldTime: w?.worldTime ?? 0,
      entityCount: w?.entities.size ?? 0,
    });
  });

  // ---- Entities ----------------------------------------------------------
  app.get('/api/entities', (_req: Request, res: Response) => {
    const w = deps.engine.currentWorld;
    if (!w) return res.json({ entities: [] });
    res.json({ entities: [...w.entities.values()].map((e) => e.toJSON()) });
  });

  app.get('/api/entities/:id', (req: Request, res: Response) => {
    const e = deps.engine.currentWorld?.getEntity(req.params.id);
    if (!e) return res.status(404).json({ error: 'not_found' });
    res.json({ entity: e.toJSON() });
  });

  app.post('/api/entities', (req: Request, res: Response) => {
    const w = deps.engine.currentWorld;
    if (!w) return res.status(503).json({ error: 'no_world' });
    const result = actionValidator.validate(
      {
        name: { type: 'string', required: true, max: 64 },
        x: { type: 'number', required: true },
        y: { type: 'number', required: true },
        z: { type: 'number', required: true },
      },
      req.body,
    );
    if (!result.ok) return res.status(400).json({ error: 'validation_failed', errors: result.errors });
    // Defer to the SDK in real usage; for the API we register a placeholder body.
    res.status(201).json({ ok: true, note: 'entity creation via SDK; see docs/SDK.md' });
  });

  // ---- Soul actions ------------------------------------------------------
  app.post('/api/souls/:id/action', (req: Request, res: Response) => {
    const w = deps.engine.currentWorld;
    if (!w) return res.status(503).json({ error: 'no_world' });
    const clientId = req.ip ?? 'anonymous';
    const rl = limiter.check(clientId);
    if (!rl.allowed) return res.status(429).json({ error: 'rate_limited', retryAfterMs: rl.retryAfterMs });

    const result = actionValidator.validate(
      {
        action: { type: 'string', required: true, enum: ['move', 'speak', 'interact', 'attack', 'use'] },
        payload: { type: 'object', required: false },
      },
      req.body,
    );
    if (!result.ok) return res.status(400).json({ error: 'validation_failed', errors: result.errors });

    const proxyId = `soul_${req.params.id}`;
    const proxy = w.getEntity(proxyId);
    if (!proxy) return res.status(404).json({ error: 'soul_not_in_world', soulId: req.params.id });

    permissions.ensure('soul', 'entity', 'interact');
    const action = String((result.value as { action: string }).action);
    if (action === 'speak') {
      const text = sanitizeString(String((result.value as { payload?: { text?: string } }).payload?.text ?? ''));
      log.info({ soulId: req.params.id, text }, 'soul speak');
    }
    res.json({ ok: true, action, soulId: req.params.id, tick: w.tick });
  });

  // ---- Soul roster (proxy to SoulArena) ----------------------------------
  app.get('/api/souls', async (_req: Request, res: Response) => {
    const { souls, usedMock } = await deps.soulClient.listSouls();
    res.json({ souls, source: usedMock ? 'mock' : 'soul-arena' });
  });

  return app;
}

export async function startServer(deps: ServerDeps): Promise<{ close: () => void }> {
  const port = deps.port ?? Number(process.env.PORT ?? 3100);
  const app = createApp(deps);
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (socket: WebSocket) => {
    log.info('ws client connected');
    socket.send(JSON.stringify({ type: 'hello', payload: { protocol: 'seed-soul', version: '0.1.0' }, timestamp: Date.now() }));
    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as { type: string; payload?: unknown; soulId?: string };
        log.info({ type: msg.type, soulId: msg.soulId }, 'ws message');
        socket.send(JSON.stringify({ type: 'ack', payload: { echo: msg.type }, timestamp: Date.now() }));
      } catch (err) {
        socket.send(JSON.stringify({ type: 'error', payload: { message: 'invalid json' }, timestamp: Date.now() }));
      }
    });
  });

  await new Promise<void>((resolve) => httpServer.listen(port, () => {
    log.info({ port }, 'Seed API listening');
    resolve();
  }));

  return {
    close: () => {
      wss.close();
      httpServer.close();
    },
  };
}
