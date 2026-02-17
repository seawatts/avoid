# AGENTS.md

## Project Overview

This is **avoid** -- a local CLI tool that helps identify and overcome task avoidance using AI-powered behavioral analysis. Built with OpenTUI (terminal UI), Vercel AI SDK, Drizzle ORM with bun:sqlite for local persistence, and OpenAI embeddings for semantic memory.

## Architecture

- **Monorepo**: Bun workspaces + Turborepo
- **CLI app**: `apps/cli/` -- OpenTUI React terminal interface
- **AI package**: `packages/ai/` -- AI SDK integration, avoidance analysis, agentic loop
- **Memory package**: `packages/memory/` -- Memory system with embeddings, decay scoring, pattern analysis, context building
- **DB package**: `packages/db/` -- Drizzle ORM + bun:sqlite schema, client, queries
- **ID package**: `packages/id/` -- cuid2 and nanoid ID generation
- **Analytics**: `packages/analytics/` -- local analytics tracking
- **Tooling**: `tooling/typescript`, `tooling/commitlint`, `tooling/npm`, `tooling/testing`
- **Runtime**: Bun (required for OpenTUI and bun:sqlite)

## Key Patterns

- OpenTUI React components for terminal UI (`@opentui/react`)
- AI SDK `generateObject` with Zod schemas for structured AI output
- AI SDK `embed` with `text-embedding-3-small` for memory embeddings
- Drizzle ORM with bun:sqlite for local persistence in `~/.avoid/avoid.db`
- Enhanced decay scoring (time decay + access bonus + keyword/tag/type matching)
- Cosine similarity vector search over embedded memories
- Semi-agentic conversation loop where AI decides next action via structured output
- Workspace packages imported as `@seawatts/db`, `@seawatts/ai`, `@seawatts/memory`, `@seawatts/id`, etc.

## Package Dependencies

```
apps/cli -> @seawatts/ai, @seawatts/memory, @seawatts/db, @seawatts/analytics
packages/ai -> @seawatts/db, @seawatts/memory
packages/memory -> @seawatts/db
packages/db -> @seawatts/id
packages/analytics -> @seawatts/db
```

## Commands

```bash
bun install          # Install dependencies
bun run build        # Build all packages
bun run cli          # Run the avoid CLI
bun run dev          # Watch mode
bun run typecheck    # Type check
bun run test         # Run tests
bun run format:fix   # Format code with Biome
```

## Code Conventions

- TypeScript strict mode
- ESM only (`"type": "module"`)
- Biome for formatting (single quotes, semicolons, trailing commas)
- Kebab-case filenames
- No emojis in user-facing output
- Workspace packages use `@seawatts/` scope
