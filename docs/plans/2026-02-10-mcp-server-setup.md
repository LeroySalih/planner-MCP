# MCP Server with PostgreSQL Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a production-ready MCP server in Node.js + Express with PostgreSQL, using raw SQL and the @modelcontextprotocol/sdk package with HTTP streaming transport.

**Architecture:** Express server hosts an MCP endpoint at `/mcp` using the SDK's streaming HTTP transport. Database access via `pg` connection pool with raw SQL queries. Clean separation between Express routing, MCP server logic, and database layer for easy extension.

**Tech Stack:** Node.js, Express.js, TypeScript, PostgreSQL (pg package), @modelcontextprotocol/sdk, ts-node, nodemon

---

## Task 1: Project Foundation

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `.env.example`

**Step 1: Initialize package.json**

Run: `npm init -y`
Expected: package.json created

**Step 2: Edit package.json with project configuration**

```json
{
  "name": "planner-mcp",
  "version": "1.0.0",
  "description": "MCP server with PostgreSQL using Express and streaming HTTP transport",
  "main": "dist/index.js",
  "scripts": {
    "dev": "nodemon --watch src --ext ts --exec ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "migrate": "node -e \"console.log('Run migrations manually: psql -d your_database -f src/db/migrations/001_initial.sql')\""
  },
  "keywords": ["mcp", "model-context-protocol", "postgresql", "express"],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.4",
    "express": "^4.21.2",
    "pg": "^8.13.1",
    "dotenv": "^16.4.7"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/node": "^22.10.5",
    "@types/pg": "^8.11.10",
    "nodemon": "^3.1.9",
    "ts-node": "^10.9.2",
    "typescript": "^5.7.3"
  }
}
```

**Step 3: Install dependencies**

Run: `npm install`
Expected: node_modules created, package-lock.json created

**Step 4: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 5: Create .gitignore**

```
# Dependencies
node_modules/
package-lock.json

# Build output
dist/

# Environment
.env
.env.local

# Logs
*.log
npm-debug.log*

# OS
.DS_Store

# IDE
.vscode/
.idea/
*.swp
*.swo
```

**Step 6: Create .env.example**

```
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/planner_mcp

# Server
PORT=3001
NODE_ENV=development

# MCP
MCP_SERVER_NAME=planner-mcp
MCP_SERVER_VERSION=1.0.0
```

**Step 7: Commit project foundation**

```bash
git add package.json tsconfig.json .gitignore .env.example
git commit -m "feat: initialize project with TypeScript, Express, and dependencies"
```

---

## Task 2: Configuration Module

**Files:**
- Create: `src/config/index.ts`

**Step 1: Create src/config directory**

Run: `mkdir -p src/config`
Expected: Directory created

**Step 2: Write config module**

```typescript
import dotenv from 'dotenv';

dotenv.config();

interface Config {
  database: {
    connectionString: string;
  };
  server: {
    port: number;
    nodeEnv: string;
  };
  mcp: {
    serverName: string;
    serverVersion: string;
  };
}

const config: Config = {
  database: {
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/planner_mcp',
  },
  server: {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  mcp: {
    serverName: process.env.MCP_SERVER_NAME || 'planner-mcp',
    serverVersion: process.env.MCP_SERVER_VERSION || '1.0.0',
  },
};

export default config;
```

**Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit config module**

```bash
git add src/config/
git commit -m "feat: add configuration module with environment variables"
```

---

## Task 3: TypeScript Type Definitions

**Files:**
- Create: `src/types/index.ts`

**Step 1: Create src/types directory**

Run: `mkdir -p src/types`
Expected: Directory created

**Step 2: Write shared type definitions**

```typescript
// Database types
export interface DbTask {
  id: number;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'completed';
  created_at: Date;
  updated_at: Date;
}

// MCP Tool types
export interface ToolResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}
```

**Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit types**

```bash
git add src/types/
git commit -m "feat: add TypeScript type definitions"
```

---

## Task 4: Database Client Setup

**Files:**
- Create: `src/db/client.ts`
- Create: `src/db/migrations/001_initial.sql`

**Step 1: Create database directories**

Run: `mkdir -p src/db/migrations`
Expected: Directories created

**Step 2: Write database client with connection pool**

```typescript
import { Pool } from 'pg';
import config from '../config';

class DatabaseClient {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: config.database.connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
      process.exit(-1);
    });
  }

  async query(text: string, params?: any[]) {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      console.log('Executed query', { text, duration, rows: result.rowCount });
      return result;
    } catch (error) {
      console.error('Database query error', { text, error });
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const result = await this.query('SELECT NOW()');
      console.log('Database connected successfully:', result.rows[0]);
      return true;
    } catch (error) {
      console.error('Database connection failed:', error);
      return false;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
    console.log('Database pool closed');
  }
}

export const db = new DatabaseClient();
```

**Step 3: Create initial migration file**

```sql
-- Migration: 001_initial.sql
-- Description: Create initial tasks table

CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data
INSERT INTO tasks (title, description, status) VALUES
  ('Sample Task 1', 'This is a sample task', 'pending'),
  ('Sample Task 2', 'Another example task', 'in_progress'),
  ('Sample Task 3', 'A completed task', 'completed');
```

**Step 4: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit database layer**

```bash
git add src/db/
git commit -m "feat: add database client with pg Pool and initial migration"
```

---

## Task 5: Database Query Functions

**Files:**
- Create: `src/db/queries/index.ts`

**Step 1: Create queries directory**

Run: `mkdir -p src/db/queries`
Expected: Directory created

**Step 2: Write query functions**

```typescript
import { db } from '../client';
import { DbTask } from '../../types';

export const taskQueries = {
  async getAll(): Promise<DbTask[]> {
    const result = await db.query(
      'SELECT * FROM tasks ORDER BY created_at DESC'
    );
    return result.rows;
  },

  async getById(id: number): Promise<DbTask | null> {
    const result = await db.query(
      'SELECT * FROM tasks WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  },

  async create(title: string, description?: string): Promise<DbTask> {
    const result = await db.query(
      'INSERT INTO tasks (title, description) VALUES ($1, $2) RETURNING *',
      [title, description || null]
    );
    return result.rows[0];
  },

  async updateStatus(id: number, status: 'pending' | 'in_progress' | 'completed'): Promise<DbTask | null> {
    const result = await db.query(
      'UPDATE tasks SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    return result.rows[0] || null;
  },

  async delete(id: number): Promise<boolean> {
    const result = await db.query(
      'DELETE FROM tasks WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  },

  async getStats(): Promise<{ total: number; pending: number; in_progress: number; completed: number }> {
    const result = await db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE status = 'completed') as completed
      FROM tasks
    `);
    return {
      total: parseInt(result.rows[0].total, 10),
      pending: parseInt(result.rows[0].pending, 10),
      in_progress: parseInt(result.rows[0].in_progress, 10),
      completed: parseInt(result.rows[0].completed, 10),
    };
  },
};
```

**Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit queries**

```bash
git add src/db/queries/
git commit -m "feat: add database query functions for tasks"
```

---

## Task 6: MCP Tools Implementation

**Files:**
- Create: `src/mcp/tools/index.ts`

**Step 1: Create MCP tools directory**

Run: `mkdir -p src/mcp/tools`
Expected: Directory created

**Step 2: Write MCP tools**

```typescript
import { taskQueries } from '../../db/queries';
import { ToolResult } from '../../types';

export const tools = {
  ping: {
    definition: {
      name: 'ping',
      description: 'Simple ping tool to test MCP server connectivity',
      inputSchema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'Optional message to echo back',
          },
        },
      },
    },
    handler: async (args: { message?: string }): Promise<ToolResult> => {
      const timestamp = new Date().toISOString();
      const echoMessage = args.message || 'pong';

      return {
        content: [
          {
            type: 'text',
            text: `🏓 ${echoMessage} (timestamp: ${timestamp})`,
          },
        ],
      };
    },
  },

  list_tasks: {
    definition: {
      name: 'list_tasks',
      description: 'List all tasks from the database',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    handler: async (): Promise<ToolResult> => {
      const tasks = await taskQueries.getAll();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(tasks, null, 2),
          },
        ],
      };
    },
  },

  get_task_stats: {
    definition: {
      name: 'get_task_stats',
      description: 'Get statistics about tasks (total, pending, in progress, completed)',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    handler: async (): Promise<ToolResult> => {
      const stats = await taskQueries.getStats();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(stats, null, 2),
          },
        ],
      };
    },
  },

  create_task: {
    definition: {
      name: 'create_task',
      description: 'Create a new task',
      inputSchema: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Task title',
          },
          description: {
            type: 'string',
            description: 'Task description (optional)',
          },
        },
        required: ['title'],
      },
    },
    handler: async (args: { title: string; description?: string }): Promise<ToolResult> => {
      const task = await taskQueries.create(args.title, args.description);

      return {
        content: [
          {
            type: 'text',
            text: `Task created: ${JSON.stringify(task, null, 2)}`,
          },
        ],
      };
    },
  },
};
```

**Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit MCP tools**

```bash
git add src/mcp/tools/
git commit -m "feat: add MCP tools (ping, list_tasks, get_task_stats, create_task)"
```

---

## Task 7: MCP Resources Implementation

**Files:**
- Create: `src/mcp/resources/index.ts`

**Step 1: Create MCP resources directory**

Run: `mkdir -p src/mcp/resources`
Expected: Directory created

**Step 2: Write MCP resources**

```typescript
import { db } from '../../db/client';
import config from '../../config';

export const resources = {
  status: {
    definition: {
      uri: 'mcp://status',
      name: 'Server Status',
      description: 'Current status of the MCP server and database connection',
      mimeType: 'application/json',
    },
    handler: async () => {
      const dbConnected = await db.testConnection();

      const status = {
        server: {
          name: config.mcp.serverName,
          version: config.mcp.serverVersion,
          uptime: process.uptime(),
          environment: config.server.nodeEnv,
        },
        database: {
          connected: dbConnected,
          connectionString: config.database.connectionString.replace(/:[^:@]+@/, ':****@'), // Hide password
        },
        timestamp: new Date().toISOString(),
      };

      return {
        contents: [
          {
            uri: 'mcp://status',
            mimeType: 'application/json',
            text: JSON.stringify(status, null, 2),
          },
        ],
      };
    },
  },

  health: {
    definition: {
      uri: 'mcp://health',
      name: 'Health Check',
      description: 'Simple health check endpoint',
      mimeType: 'text/plain',
    },
    handler: async () => {
      return {
        contents: [
          {
            uri: 'mcp://health',
            mimeType: 'text/plain',
            text: 'OK',
          },
        ],
      };
    },
  },
};
```

**Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit MCP resources**

```bash
git add src/mcp/resources/
git commit -m "feat: add MCP resources (status, health)"
```

---

## Task 8: MCP Server Setup

**Files:**
- Create: `src/mcp/server.ts`

**Step 1: Write MCP server module**

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import config from '../config';
import { tools } from './tools';
import { resources } from './resources';

export class MCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: config.mcp.serverName,
        version: config.mcp.serverVersion,
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: Object.values(tools).map((tool) => tool.definition),
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      const tool = tools[toolName as keyof typeof tools];

      if (!tool) {
        throw new Error(`Unknown tool: ${toolName}`);
      }

      try {
        const result = await tool.handler(request.params.arguments || {});
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [
            {
              type: 'text',
              text: `Error executing tool ${toolName}: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });

    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: Object.values(resources).map((resource) => resource.definition),
      };
    });

    // Handle resource reads
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;
      const resource = Object.values(resources).find(
        (r) => r.definition.uri === uri
      );

      if (!resource) {
        throw new Error(`Unknown resource: ${uri}`);
      }

      try {
        const result = await resource.handler();
        return result;
      } catch (error) {
        throw new Error(`Error reading resource ${uri}: ${error}`);
      }
    });
  }

  getServer(): Server {
    return this.server;
  }

  async connect(transport: StdioServerTransport): Promise<void> {
    await this.server.connect(transport);
    console.log('MCP Server connected');
  }
}

export const mcpServer = new MCPServer();
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors (may have warnings about SDK types, that's OK)

**Step 3: Commit MCP server**

```bash
git add src/mcp/server.ts
git commit -m "feat: add MCP server with tools and resources handlers"
```

---

## Task 9: Express Server with MCP Integration

**Files:**
- Create: `src/index.ts`

**Step 1: Write Express server with MCP endpoint**

```typescript
import express, { Request, Response, NextFunction } from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import config from './config';
import { db } from './db/client';
import { mcpServer } from './mcp/server';

const app = express();

// Middleware
app.use(express.json());

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// MCP endpoint using SSE transport
app.get('/mcp', async (req: Request, res: Response) => {
  console.log('MCP client connected via SSE');

  const transport = new SSEServerTransport('/mcp', res);
  await mcpServer.connect(transport);
});

app.post('/mcp', async (req: Request, res: Response) => {
  console.log('MCP client message received');

  const transport = new SSEServerTransport('/mcp', res);
  await mcpServer.connect(transport);
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Express error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: config.server.nodeEnv === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`${signal} received, shutting down gracefully...`);

  try {
    await db.close();
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start server
const startServer = async () => {
  try {
    // Test database connection
    const dbConnected = await db.testConnection();
    if (!dbConnected) {
      throw new Error('Failed to connect to database');
    }

    // Start Express server
    app.listen(config.server.port, () => {
      console.log(`
========================================
🚀 MCP Server running
========================================
Environment: ${config.server.nodeEnv}
Port: ${config.server.port}
MCP Endpoint: http://localhost:${config.server.port}/mcp
Health Check: http://localhost:${config.server.port}/health
Database: Connected
========================================
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors (may have warnings about SDK types)

**Step 3: Commit Express server**

```bash
git add src/index.ts
git commit -m "feat: add Express server with MCP SSE endpoint integration"
```

---

## Task 10: README Documentation

**Files:**
- Modify: `README.md`

**Step 1: Read current README**

Run: `cat README.md`
Expected: Shows current content (likely minimal)

**Step 2: Write comprehensive README**

```markdown
# Planner MCP Server

A production-ready Model Context Protocol (MCP) server built with Node.js, Express, TypeScript, and PostgreSQL. This server exposes MCP tools and resources over HTTP using Server-Sent Events (SSE) streaming transport.

## Features

- 🔌 **MCP over HTTP**: SSE-based streaming transport on `/mcp` endpoint
- 🗄️ **PostgreSQL Integration**: Raw SQL queries via `pg` connection pool
- 🛠️ **MCP Tools**: `ping`, `list_tasks`, `get_task_stats`, `create_task`
- 📚 **MCP Resources**: `status`, `health`
- 🔒 **Production Ready**: Error handling, logging, graceful shutdown
- 📦 **TypeScript**: Full type safety throughout the codebase

## Prerequisites

- Node.js >= 18
- PostgreSQL >= 13
- npm or yarn

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd planner-MCP
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

4. **Set up database**
   ```bash
   # Create database
   createdb planner_mcp

   # Run migrations
   psql -d planner_mcp -f src/db/migrations/001_initial.sql
   ```

## Usage

### Development Mode
```bash
npm run dev
```
This starts the server with auto-reload on file changes.

### Production Mode
```bash
npm run build
npm start
```

### Running Migrations
```bash
# Manually run migration files
psql -d your_database -f src/db/migrations/001_initial.sql
```

## API Endpoints

### Health Check
```bash
GET http://localhost:3001/health
```

### MCP Endpoint
```bash
GET/POST http://localhost:3001/mcp
```

The MCP endpoint uses Server-Sent Events (SSE) for streaming communication.

## MCP Tools

### 1. `ping`
Simple connectivity test.

**Input:**
```json
{
  "message": "optional message"
}
```

**Output:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "🏓 pong (timestamp: 2024-01-01T00:00:00.000Z)"
    }
  ]
}
```

### 2. `list_tasks`
Retrieve all tasks from the database.

**Input:** None

**Output:** JSON array of tasks

### 3. `get_task_stats`
Get task statistics (total, pending, in_progress, completed).

**Input:** None

**Output:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"total\": 10, \"pending\": 5, \"in_progress\": 3, \"completed\": 2}"
    }
  ]
}
```

### 4. `create_task`
Create a new task.

**Input:**
```json
{
  "title": "Task title",
  "description": "Optional description"
}
```

**Output:** Created task object

## MCP Resources

### 1. `mcp://status`
Server status including database connection info.

### 2. `mcp://health`
Simple health check resource.

## Project Structure

```
planner-MCP/
├── src/
│   ├── index.ts              # Express server entry point
│   ├── mcp/
│   │   ├── server.ts         # MCP server setup
│   │   ├── tools/            # MCP tool handlers
│   │   │   └── index.ts
│   │   └── resources/        # MCP resource handlers
│   │       └── index.ts
│   ├── db/
│   │   ├── client.ts         # PostgreSQL Pool setup
│   │   ├── queries/          # Raw SQL queries
│   │   │   └── index.ts
│   │   └── migrations/       # SQL migration files
│   │       └── 001_initial.sql
│   ├── config/
│   │   └── index.ts          # Environment configuration
│   └── types/
│       └── index.ts          # TypeScript types
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## Testing the MCP Server

### Using curl
```bash
# Health check
curl http://localhost:3001/health

# Test MCP endpoint (basic connectivity)
curl http://localhost:3001/mcp
```

### Using MCP Inspector
```bash
# Install MCP Inspector globally
npm install -g @modelcontextprotocol/inspector

# Run inspector
mcp-inspector http://localhost:3001/mcp
```

### Using Claude Desktop or other MCP clients
Add to your MCP client configuration:
```json
{
  "mcpServers": {
    "planner-mcp": {
      "url": "http://localhost:3001/mcp",
      "transport": "sse"
    }
  }
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://localhost:5432/planner_mcp` |
| `PORT` | Server port | `3001` |
| `NODE_ENV` | Environment (development/production) | `development` |
| `MCP_SERVER_NAME` | MCP server name | `planner-mcp` |
| `MCP_SERVER_VERSION` | MCP server version | `1.0.0` |

## Database Schema

### `tasks` Table
```sql
CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## Development

### Adding New Tools
1. Add tool definition and handler in `src/mcp/tools/index.ts`
2. Export from tools object
3. MCP server will automatically register it

### Adding New Resources
1. Add resource definition and handler in `src/mcp/resources/index.ts`
2. Export from resources object
3. MCP server will automatically register it

### Adding New Queries
1. Add query functions in `src/db/queries/index.ts`
2. Use raw SQL with parameterized queries
3. Return properly typed results

## License

ISC
```

**Step 3: Commit README**

```bash
git add README.md
git commit -m "docs: add comprehensive README with setup and usage instructions"
```

---

## Task 11: Build and Verify

**Step 1: Build the project**

Run: `npm run build`
Expected: `dist/` directory created with compiled JavaScript

**Step 2: Check build output**

Run: `ls -la dist/`
Expected: Shows compiled files matching src structure

**Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit if any fixes were needed**

```bash
git add .
git commit -m "fix: resolve any build issues"
```

---

## Task 12: Create .env for Testing

**Step 1: Copy .env.example**

Run: `cp .env.example .env`
Expected: .env file created

**Step 2: Note about database setup**

The user needs to:
1. Create a PostgreSQL database
2. Update .env with correct DATABASE_URL
3. Run the migration: `psql -d planner_mcp -f src/db/migrations/001_initial.sql`

These steps are documented in the README and must be done before testing.

---

## Implementation Complete

All files have been created with:
- ✅ Project configuration (package.json, tsconfig.json)
- ✅ Environment setup (.env.example, .gitignore)
- ✅ TypeScript types and config module
- ✅ Database client with pg Pool
- ✅ SQL migration with sample schema
- ✅ Database query functions (raw SQL)
- ✅ MCP tools (ping, list_tasks, get_task_stats, create_task)
- ✅ MCP resources (status, health)
- ✅ MCP server with SDK integration
- ✅ Express server with SSE transport on /mcp
- ✅ Comprehensive README with setup instructions
- ✅ Production-ready error handling and logging

**Next Steps for User:**
1. Create PostgreSQL database
2. Update .env file with database credentials
3. Run migration: `psql -d planner_mcp -f src/db/migrations/001_initial.sql`
4. Start server: `npm run dev`
5. Test endpoints: `curl http://localhost:3001/health`
