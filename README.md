# Content Snare MCP Server

An MCP (Model Context Protocol) server that provides AI assistants with full access to the [Content Snare API](https://api.contentsnare.com/partner_api/v1/documentation). Manage clients, requests, templates, team members, webhooks, and build complete request forms programmatically.

## Features

- **Clients** - List, create, update, delete clients and list client companies
- **Requests** - Full CRUD, plus create requests with inline fields (no template needed)
- **Pages & Sections** - Create pages/sections from templates, get page details with fields
- **Field Review** - Approve, reject, submit, or revise individual fields
- **Bulk Actions** - Approve all submitted fields or submit all fields at request/page/section level
- **Templates** - List request, page, and section templates
- **Team Members** - Full CRUD for team members
- **Webhooks** - Full CRUD with granular event subscriptions
- **Folders & Schedules** - List folders and communication schedules
- **OAuth with auto-refresh** - Built-in browser-based OAuth flow with automatic token refresh

## Prerequisites

- Node.js 18+
- A Content Snare API application (Client ID and Client Secret)

## Installation

### From npm (when published)

```bash
npm install -g contentsnare-mcp
```

### From source

```bash
git clone https://github.com/jamesrose86/content-snare-mcp.git
cd content-snare-mcp
npm install
npm run build
```

## Setup

### 1. Enable API access on your Content Snare account

API access is not enabled by default. Contact Content Snare support at [support@contentsnare.com](mailto:support@contentsnare.com) to request API access for your account.

### 2. Create an API application in Content Snare

Once API access is enabled, go to **Settings > API** in your Content Snare account and create a new API application. Set the redirect URI to any HTTPS URL you control (e.g. `https://your-domain.com/callback`). The URL doesn't need to serve anything — you'll just copy the authorization code from the URL bar after redirect.

Note down your **Client ID**, **Client Secret**, and the **Redirect URI** you configured.

### 3. Authorize

Set your credentials and run the auth command:

```bash
export CONTENTSNARE_CLIENT_ID="your-client-id"
export CONTENTSNARE_CLIENT_SECRET="your-client-secret"
export CONTENTSNARE_REDIRECT_URI="https://your-domain.com/callback"

npx contentsnare-mcp auth
```

This prints an authorization URL. Open it in your browser, approve access, then copy the `code` parameter from the redirect URL and paste it back into the terminal.

Tokens are saved to `~/.contentsnare/tokens.json` and automatically refreshed when they expire. You only need to do this once.

### 4. Configure your MCP client

#### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "contentsnare": {
      "command": "node",
      "args": ["/absolute/path/to/content-snare-mcp/dist/index.js"],
      "env": {
        "CONTENTSNARE_CLIENT_ID": "your-client-id",
        "CONTENTSNARE_CLIENT_SECRET": "your-client-secret"
      }
    }
  }
}
```

Or if installed globally via npm:

```json
{
  "mcpServers": {
    "contentsnare": {
      "command": "contentsnare-mcp",
      "env": {
        "CONTENTSNARE_CLIENT_ID": "your-client-id",
        "CONTENTSNARE_CLIENT_SECRET": "your-client-secret"
      }
    }
  }
}
```

#### VS Code / Claude Code

Add to your MCP settings:

```json
{
  "contentsnare": {
    "command": "node",
    "args": ["/absolute/path/to/content-snare-mcp/dist/index.js"],
    "env": {
      "CONTENTSNARE_CLIENT_ID": "your-client-id",
      "CONTENTSNARE_CLIENT_SECRET": "your-client-secret"
    }
  }
}
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CONTENTSNARE_CLIENT_ID` | Yes | OAuth Client ID from your Content Snare API application |
| `CONTENTSNARE_CLIENT_SECRET` | Yes | OAuth Client Secret from your Content Snare API application |
| `CONTENTSNARE_REDIRECT_URI` | Auth only | The redirect URI configured in your Content Snare API application (needed for `auth` command) |
| `CONTENTSNARE_ACCESS_TOKEN` | No | Skip OAuth flow and use a token directly (advanced) |

If `CONTENTSNARE_ACCESS_TOKEN` is set, it takes precedence and the OAuth flow is bypassed. This is useful for testing or if you manage tokens yourself.

## Required Scopes

The authorization flow requests all available scopes. Different tools require different scopes:

| Scope | Tools |
|-------|-------|
| `read_clients` | list_clients, get_client, list_client_companies |
| `write_clients` | create_client, update_client, delete_client |
| `read_requests` | list_requests, get_request, get_page, list_folders, list_communication_templates |
| `write_requests` | create_request, create_request_with_fields, update_request, delete_request, create_page, create_section |
| `review_requests` | review_field, approve_all_submitted_fields, submit_all_fields, run_integration_actions |
| `read_templates` | list_request_templates, list_page_templates, list_section_templates |
| `read_team_members` | list_team_members, get_team_member |
| `write_team_members` | create_team_member, update_team_member, delete_team_member |
| `administration` | list_webhooks, get_webhook, create_webhook, update_webhook, delete_webhook |

## Available Tools

### Clients
- `list_clients` - List active clients with search, sort, and pagination
- `get_client` - Get a client by ID
- `create_client` - Create a new client
- `update_client` - Update an existing client
- `delete_client` - Delete a client
- `list_client_companies` - List client companies

### Requests
- `list_requests` - List requests with filtering, search, sort, and pagination
- `get_request` - Get a request by ID (includes pages)
- `create_request` - Create a request from a template
- `create_request_with_fields` - Create a request with inline pages, sections, and fields
- `update_request` - Update a request
- `delete_request` - Delete a request

### Pages & Sections
- `get_page` - Get a page by ID (includes sections and fields)
- `create_page` - Create a page from a template
- `create_section` - Create a section from a template

### Review & Bulk Actions
- `review_field` - Approve, reject, submit, or revise a field
- `approve_all_submitted_fields` - Approve all submitted fields (request/page/section level)
- `submit_all_fields` - Submit all fields for review (request/page/section level)
- `run_integration_actions` - Run integration actions for a request

### Templates
- `list_request_templates` - List request templates
- `list_page_templates` - List page templates
- `list_section_templates` - List section templates

### Other
- `get_current_user` - Get the current authenticated user
- `list_communication_templates` - List communication schedules
- `list_folders` - List folders
- `list_team_members` / `get_team_member` / `create_team_member` / `update_team_member` / `delete_team_member`
- `list_webhooks` / `get_webhook` / `create_webhook` / `update_webhook` / `delete_webhook`

## Creating Requests with Inline Fields

The `create_request_with_fields` tool lets you build a complete request in a single call, without needing a pre-existing template. This is useful for dynamically generated forms.

### Supported Field Types

| Category | data_type values |
|----------|-----------------|
| **Text** | `single-line`, `text`, `multi-line text`, `formatted text`, `email`, `url`, `address`, `country select` |
| **File** | `single image upload`, `multiple image upload`, `single file upload`, `multiple file upload`, `signature` |
| **Numeric** | `phone`, `number`, `currency`, `date/time`, `numeric rating`, `star rating` |
| **Options** | `single select option`, `multi select options`, `dropdown`, `task list` (require `options` array) |
| **Special** | `table` (requires `columns` array), `date range`, `button`, `icon`, `color picker` |

### Conditional Visibility

Fields can be shown/hidden based on answers to other fields using `show_when`:

```json
{
  "show_when": {
    "conditions": [
      {
        "question_number": 1,
        "condition": "equals",
        "value": "Yes"
      }
    ]
  }
}
```

Available operators: `contains`, `equals`, `does not equal`, `less than`, `greater than`, `is empty`, `has a value`

## API Rate Limits

Content Snare enforces rate limits of 50 read and 20 write requests per 10 seconds. If you hit a rate limit, the API will return HTTP 429 with a `Retry-After` header.

## License

MIT
