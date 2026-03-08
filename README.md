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

## Prerequisites

- Node.js 18+
- A Content Snare OAuth2 access token (see [Authorization](#authorization))

## Installation

### From npm (when published)

```bash
npm install -g contentsnare-mcp
```

### From source

```bash
git clone https://github.com/YOUR_USERNAME/contentsnare-mcp.git
cd contentsnare-mcp
npm install
npm run build
```

## Configuration

Set your Content Snare OAuth2 access token as an environment variable:

```bash
export CONTENTSNARE_ACCESS_TOKEN="your-access-token-here"
```

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "contentsnare": {
      "command": "node",
      "args": ["/absolute/path/to/contentsnare-mcp/dist/index.js"],
      "env": {
        "CONTENTSNARE_ACCESS_TOKEN": "your-access-token-here"
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
        "CONTENTSNARE_ACCESS_TOKEN": "your-access-token-here"
      }
    }
  }
}
```

### VS Code / Claude Code

Add to your MCP settings:

```json
{
  "contentsnare": {
    "command": "node",
    "args": ["/absolute/path/to/contentsnare-mcp/dist/index.js"],
    "env": {
      "CONTENTSNARE_ACCESS_TOKEN": "your-access-token-here"
    }
  }
}
```

## Authorization

The Content Snare API uses OAuth 2.0. You need to:

1. Create an API application in Content Snare under **Settings > API**
2. Complete the OAuth authorization code flow to obtain an access token
3. Access tokens expire after 2 hours - use the refresh token to obtain new ones

See the [Content Snare API docs](https://api.contentsnare.com/partner_api/v1/documentation) for full details on the OAuth flow.

### Required Scopes

Different tools require different OAuth scopes:

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
