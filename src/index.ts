import express from 'express';
import { randomUUID } from 'crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { validateMcpKey } from './middleware/auth';
import { createMcpServer } from './mcp/server';
import config from './config';
import { db } from './db/client';

const app = express();
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const { method, path } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const level = status >= 500 ? 'ERROR' : status >= 400 ? 'WARN' : 'INFO';
    console.log(
      `[${level}] ${method} ${path} ${status} ${duration}ms`
    );
  });

  next();
});

// Session management
const sessions = new Map<string, { server: McpServer; transport: StreamableHTTPServerTransport }>();

// Health check (public)
app.get('/health', async (_req, res) => {
  try {
    const dbOk = await db.testConnection();
    res.json({
      status: dbOk ? 'ok' : 'degraded',
      database: dbOk ? 'connected' : 'disconnected',
    });
  } catch (error) {
    console.error(`[ERROR] GET /health - ${(error as Error).message}`);
    res.status(500).json({ error: 'Health check failed' });
  }
});

// MCP routes (authenticated)
app.post('/mcp', validateMcpKey, async (req, res) => {
  try {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (sessionId && sessions.has(sessionId)) {
      const session = sessions.get(sessionId)!;
      await session.transport.handleRequest(req, res, req.body);
      return;
    }

    // New session: create transport, server, and connect
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        console.log(`[SESSION] New session created: ${id}`);
        sessions.set(id, { server, transport });
      },
    });

    transport.onclose = () => {
      const id = transport.sessionId;
      if (id) {
        console.log(`[SESSION] Session closed: ${id}`);
        sessions.delete(id);
      }
    };

    const server = createMcpServer();
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error(`[ERROR] POST /mcp - ${(error as Error).message}`, (error as Error).stack);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

app.get('/mcp', validateMcpKey, async (req, res) => {
  try {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !sessions.has(sessionId)) {
      console.warn(`[WARN] GET /mcp - Invalid or missing session ID: ${sessionId ?? '(none)'}`);
      res.status(400).json({ error: 'Invalid or missing session ID' });
      return;
    }
    const session = sessions.get(sessionId)!;
    await session.transport.handleRequest(req, res);
  } catch (error) {
    console.error(`[ERROR] GET /mcp - ${(error as Error).message}`, (error as Error).stack);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

app.delete('/mcp', validateMcpKey, async (req, res) => {
  try {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !sessions.has(sessionId)) {
      console.warn(`[WARN] DELETE /mcp - Invalid or missing session ID: ${sessionId ?? '(none)'}`);
      res.status(400).json({ error: 'Invalid or missing session ID' });
      return;
    }
    const session = sessions.get(sessionId)!;
    await session.transport.handleRequest(req, res);
    console.log(`[SESSION] Session deleted: ${sessionId}`);
    sessions.delete(sessionId);
  } catch (error) {
    console.error(`[ERROR] DELETE /mcp - ${(error as Error).message}`, (error as Error).stack);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Startup checks: verify config, database connection, and data access
async function startupChecks(): Promise<void> {
  console.log('Running startup checks...');

  // 1. Check required environment variables
  const required = ['DATABASE_URL', 'MCP_SERVICE_KEY'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
  console.log('Environment variables: OK');

  // 2. Test database connection
  const dbOk = await db.testConnection();
  if (!dbOk) {
    console.error('Cannot connect to database. Exiting.');
    process.exit(1);
  }
  console.log('Database connection: OK');

  // 3. Verify we can read from the units table
  try {
    const result = await db.query('SELECT COUNT(*) AS count FROM units');
    const unitCount = parseInt(result.rows[0].count, 10);
    console.log(`Units table: OK (${unitCount} units found)`);
  } catch (error) {
    console.error('Failed to read units table:', error);
    process.exit(1);
  }
}

// Start server after startup checks pass
let httpServer: ReturnType<typeof app.listen>;

startupChecks()
  .then(() => {
    httpServer = app.listen(config.server.port, () => {
      console.log(`MCP server listening on port ${config.server.port}`);
      console.log(`Health check: http://localhost:${config.server.port}/health`);
    });
  })
  .catch((err) => {
    console.error('Startup checks failed:', err);
    process.exit(1);
  });

// Graceful shutdown
async function shutdown() {
  console.log('Shutting down...');
  for (const [id, session] of sessions) {
    await session.server.close();
    sessions.delete(id);
  }
  await db.close();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
