# CLAUDE.md - Content Snare MCP Server

## Project Overview

This is a TypeScript MCP (Model Context Protocol) server for the Content Snare API. It exposes all Content Snare API endpoints as MCP tools that AI assistants can call.

## Build & Run

```bash
npm install        # Install dependencies
npm run build      # Compile TypeScript to dist/
npm start          # Run the MCP server (requires OAuth tokens or CONTENTSNARE_ACCESS_TOKEN)
npm run dev        # Watch mode for development
```

## First-time auth setup

```bash
CONTENTSNARE_CLIENT_ID=xxx CONTENTSNARE_CLIENT_SECRET=yyy npx contentsnare-mcp auth
```

This opens a browser for OAuth, saves tokens to `~/.contentsnare/tokens.json`.

## Project Structure

```
contentsnare-mcp/
  src/index.ts     # Entire MCP server - tools, API client, schemas
  dist/            # Compiled output (gitignored)
  package.json
  tsconfig.json
```

## Architecture

- Single-file server using `@modelcontextprotocol/sdk`
- Communicates via stdio (standard MCP transport)
- Auth: OAuth2 with auto-refresh (tokens stored in `~/.contentsnare/tokens.json`), or direct token via `CONTENTSNARE_ACCESS_TOKEN` env var
- CLI subcommand: `contentsnare-mcp auth` runs manual OAuth flow (prints auth URL, user pastes back the authorization code)
- Base URL: `https://api.contentsnare.com/partner_api/v1`
- All tools use a shared `api()` helper for HTTP requests

## Key Design Decisions

- **Single file**: All tools in one file for simplicity. The API surface is moderate (~30 tools) and doesn't warrant splitting.
- **Zod schemas**: Tool parameters are defined with Zod, which the MCP SDK uses for validation and schema generation.
- **`create_request_with_fields`**: An undocumented endpoint that accepts `pages_data` with nested sections and questions inline. This is separate from `create_request` (which uses templates) for clarity.
- **Bulk actions consolidated**: `approve_all_submitted_fields` and `submit_all_fields` each handle request/page/section scope via a `scope` parameter rather than having 6 separate tools.

## Content Snare API Notes

- OAuth2 authorization code flow. Tokens expire after 2 hours; use refresh tokens.
- Rate limits: 50 reads / 20 writes per 10 seconds.
- The API uses string IDs with prefixes (e.g. `req_`, `acc_`, `pag_`, `sec_`, `fld_`).
- Pages are called "tabs" internally in the API but "pages" in the user-facing docs.
- The `new_request` schema has `email` as required but the actual property is `client_email`.
