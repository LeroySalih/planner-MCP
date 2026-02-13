# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCP (Model Context Protocol) server for managing educational curriculum — units, lessons, and activities (questions). Built with Express, TypeScript, PostgreSQL, and the `@modelcontextprotocol/sdk`.

## Commands

```bash
pnpm install          # Install dependencies (project uses pnpm)
pnpm run dev          # Dev server with nodemon auto-reload (ts-node, watches src/)
pnpm run build        # Compile TypeScript to dist/
pnpm start            # Run compiled dist/index.js
```

No test framework is configured yet.

## Architecture

**Layered structure** — config → db → middleware → (planned) MCP tools → Express server:

- **`src/config/`** — Loads `.env` via dotenv, exports typed `config` object. Fails fast if `MCP_SERVICE_KEY` is missing.
- **`src/db/client.ts`** — Singleton `DatabaseClient` wrapping a `pg.Pool` (max 20 connections). Exports `db` instance used by all queries.
- **`src/db/queries/`** — Raw parameterized SQL functions organized by domain: `unitQueries`, `lessonQueries`, `activityQueries`. All async, return typed results.
- **`src/types/`** — TypeScript interfaces for DB models (`DbUnit`, `DbLesson`, `DbActivity`), API responses (`ToolResult`, `ApiResponse<T>`), and input types.
- **`src/middleware/auth.ts`** — `validateMcpKey` Express middleware. Checks `Authorization: Bearer <key>` or `x-mcp-key` header against `config.mcp.serviceKey`.
- **`docs/plans/`** — Detailed implementation plans. The `2026-02-12-mcp-lesson-server.md` plan describes the full target architecture including 9 MCP tools and SSE transport.

### Not yet implemented

The main server entry point (`src/index.ts`), MCP server module (`src/mcp/server.ts`), MCP tools (`src/mcp/tools/`), and MCP resources (`src/mcp/resources/`) are planned but not yet created. See `docs/plans/` for the full specification.

## Key Patterns

- **Singleton DB client** — import `db` from `src/db/client.ts`; don't create new Pool instances.
- **Parameterized queries** — all SQL uses `$1, $2` positional parameters via `pg`; never interpolate values into SQL strings.
- **Soft deletes** — `activityQueries.delete()` sets `active=false` rather than removing rows.
- **Activities use JSONB** — `body_data` column stores question content as JSON; typed as `Record<string, unknown>`.
- **Activity types** — `multiple-choice-question`, `short-text-question`, `upload-file`.

## Environment Variables

Required in `.env`:
- `DATABASE_URL` — PostgreSQL connection string
- `MCP_SERVICE_KEY` — API key for authenticating MCP clients (validated at startup)
- `PORT` — Server port (defaults to 3001)
- `NODE_ENV` — `development` or `production`
