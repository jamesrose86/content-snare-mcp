#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = "https://api.contentsnare.com/partner_api/v1";

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

async function api(
  token: string,
  method: string,
  path: string,
  body?: unknown,
  query?: Record<string, string | string[] | undefined>
): Promise<{ status: number; data: unknown }> {
  const url = new URL(`${BASE_URL}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined) continue;
      if (Array.isArray(v)) {
        for (const item of v) url.searchParams.append(k, item);
      } else {
        url.searchParams.set(k, v);
      }
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
  if (body) headers["Content-Type"] = "application/json";

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return { status: 204, data: null };

  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (!res.ok) {
    const errMsg =
      typeof data === "object" && data && "errors" in data
        ? (data as { errors: string[] }).errors.join("; ")
        : typeof data === "string"
          ? data
          : JSON.stringify(data);
    throw new Error(`API ${res.status}: ${errMsg}`);
  }

  return { status: res.status, data };
}

function getToken(): string {
  const token = process.env.CONTENTSNARE_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "CONTENTSNARE_ACCESS_TOKEN environment variable is required. " +
        "Set it to your Content Snare OAuth2 access token."
    );
  }
  return token;
}

function formatResult(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

// ---------------------------------------------------------------------------
// Shared Zod schemas
// ---------------------------------------------------------------------------

const PaginationParams = {
  limit: z
    .number()
    .int()
    .optional()
    .describe("Maximum number of items to return (default 200)"),
  offset: z
    .number()
    .int()
    .optional()
    .describe("Number of items to skip from the beginning"),
};

const SortParams = {
  sort_by: z.string().optional().describe("Field to sort by"),
  sort_direction: z
    .enum(["asc", "desc"])
    .optional()
    .describe("Sort direction"),
};

const SearchParams = {
  q: z.string().optional().describe("Search query string"),
  q_by: z
    .array(z.string())
    .optional()
    .describe("Fields to search in (e.g. ['email', 'full_name'])"),
};

// Question schema for the undocumented create-request-with-fields endpoint
const ShowWhenCondition = z.object({
  question_number: z.number().int().describe("References another question's question_number"),
  condition: z
    .enum([
      "contains",
      "equals",
      "does not equal",
      "less than",
      "greater than",
      "is empty",
      "has a value",
    ])
    .describe("Comparison operator"),
  value: z.string().describe("Value to compare against"),
});

const ShowWhen = z.object({
  conditions: z.array(ShowWhenCondition).describe("Array of conditions"),
  logical_operator: z
    .enum(["and", "or"])
    .optional()
    .describe("Required when there are 2+ conditions"),
});

const QuestionDataType = z.enum([
  "single-line",
  "text",
  "multi-line text",
  "formatted text",
  "email",
  "url",
  "address",
  "country select",
  "single image upload",
  "multiple image upload",
  "single file upload",
  "multiple file upload",
  "signature",
  "phone",
  "number",
  "currency",
  "date/time",
  "numeric rating",
  "star rating",
  "single select option",
  "multi select options",
  "dropdown",
  "task list",
  "table",
  "date range",
  "button",
  "icon",
  "color picker",
]);

const Question = z.object({
  question: z.string().describe("The question text"),
  data_type: QuestionDataType.describe("Field type"),
  question_number: z.number().int().describe("Sequential number, starting from 1"),
  options: z
    .array(z.string())
    .nullable()
    .optional()
    .describe(
      "Array of option strings. Required for: single select option, multi select options, task list, dropdown"
    ),
  columns: z
    .array(z.string())
    .nullable()
    .optional()
    .describe("Array of column header strings. Required for: table"),
  show_when: ShowWhen.nullable()
    .optional()
    .describe("Conditional visibility logic"),
  instructions: z
    .string()
    .nullable()
    .optional()
    .describe("Guidance on how to complete the question"),
});

const SectionData = z.object({
  name: z.string().describe("Section name"),
  questions_data: z.array(Question).describe("Array of questions in this section"),
});

const PageData = z.object({
  name: z.string().describe("Page name"),
  sections_data: z.array(SectionData).describe("Array of sections in this page"),
});

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "contentsnare",
  version: "1.0.0",
  description:
    "MCP server for the Content Snare API. Manage clients, requests, templates, team members, webhooks, and more.",
});

// ---------------------------------------------------------------------------
// Tool: me
// ---------------------------------------------------------------------------

server.tool("get_current_user", "Get the current authenticated user's info", {}, async () => {
  const { data } = await api(getToken(), "GET", "/me");
  return { content: [{ type: "text", text: formatResult(data) }] };
});

// ---------------------------------------------------------------------------
// Tools: Clients
// ---------------------------------------------------------------------------

server.tool(
  "list_clients",
  "List active clients. Scopes: read_clients",
  {
    ...PaginationParams,
    ...SortParams,
    ...SearchParams,
    include_external: z
      .boolean()
      .optional()
      .describe("Include clients from external sources/integrations"),
  },
  async (params) => {
    const query: Record<string, string | string[] | undefined> = {};
    if (params.limit !== undefined) query.limit = String(params.limit);
    if (params.offset !== undefined) query.offset = String(params.offset);
    if (params.sort_by) query.sort_by = params.sort_by;
    if (params.sort_direction) query.sort_direction = params.sort_direction;
    if (params.q) query.q = params.q;
    if (params.q_by) query["q_by[]"] = params.q_by;
    if (params.include_external !== undefined)
      query.include_external = String(params.include_external);
    const { data } = await api(getToken(), "GET", "/clients", undefined, query);
    return { content: [{ type: "text", text: formatResult(data) }] };
  }
);

server.tool(
  "get_client",
  "Get a client by ID. Scopes: read_clients",
  { id: z.string().describe("Client ID") },
  async ({ id }) => {
    const { data } = await api(getToken(), "GET", `/clients/${id}`);
    return { content: [{ type: "text", text: formatResult(data) }] };
  }
);

server.tool(
  "create_client",
  "Create a new client. Scopes: write_clients",
  {
    email: z.string().describe("Client email address"),
    full_name: z.string().describe("Client full name"),
    phone: z.string().optional().describe("Phone number"),
    language_code: z
      .enum(["en", "en-gb", "es", "fr", "de", "nl", "pt-br"])
      .optional()
      .describe("Language code"),
    client_companies: z
      .array(z.object({ name: z.string().describe("Company name") }))
      .optional()
      .describe("Companies to associate with the client"),
  },
  async (params) => {
    const { data } = await api(getToken(), "POST", "/clients", params);
    return { content: [{ type: "text", text: formatResult(data) }] };
  }
);

server.tool(
  "update_client",
  "Update an existing client. Scopes: write_clients",
  {
    id: z.string().describe("Client ID"),
    email: z.string().optional().describe("Client email address"),
    full_name: z.string().optional().describe("Client full name"),
    phone: z.string().optional().describe("Phone number"),
    language_code: z
      .enum(["en", "en-gb", "es", "fr", "de", "nl", "pt-br"])
      .optional()
      .describe("Language code"),
    client_companies: z
      .array(z.object({ name: z.string().describe("Company name") }))
      .optional()
      .describe("Companies to associate with the client"),
  },
  async ({ id, ...body }) => {
    const { data } = await api(getToken(), "PUT", `/clients/${id}`, body);
    return { content: [{ type: "text", text: formatResult(data) }] };
  }
);

server.tool(
  "delete_client",
  "Delete a client. Scopes: write_clients",
  { id: z.string().describe("Client ID") },
  async ({ id }) => {
    await api(getToken(), "DELETE", `/clients/${id}`);
    return { content: [{ type: "text", text: "Client deleted successfully." }] };
  }
);

// ---------------------------------------------------------------------------
// Tools: Client Companies
// ---------------------------------------------------------------------------

server.tool(
  "list_client_companies",
  "List client companies. Scopes: read_clients",
  {
    ...PaginationParams,
    ...SortParams,
    ...SearchParams,
  },
  async (params) => {
    const query: Record<string, string | string[] | undefined> = {};
    if (params.limit !== undefined) query.limit = String(params.limit);
    if (params.offset !== undefined) query.offset = String(params.offset);
    if (params.sort_by) query.sort_by = params.sort_by;
    if (params.sort_direction) query.sort_direction = params.sort_direction;
    if (params.q) query.q = params.q;
    if (params.q_by) query["q_by[]"] = params.q_by;
    const { data } = await api(getToken(), "GET", "/client_companies", undefined, query);
    return { content: [{ type: "text", text: formatResult(data) }] };
  }
);

// ---------------------------------------------------------------------------
// Tools: Requests
// ---------------------------------------------------------------------------

server.tool(
  "list_requests",
  "List requests. Scopes: read_requests",
  {
    ...PaginationParams,
    ...SortParams,
    ...SearchParams,
    filter_statuses: z
      .array(z.enum(["published", "waiting", "scheduled", "draft", "completed", "archived"]))
      .optional()
      .describe("Filter by request statuses"),
    expand: z
      .array(z.enum(["request_template_name", "owner_email", "owner_name", "clients"]))
      .optional()
      .describe("Include additional data in response"),
  },
  async (params) => {
    const query: Record<string, string | string[] | undefined> = {};
    if (params.limit !== undefined) query.limit = String(params.limit);
    if (params.offset !== undefined) query.offset = String(params.offset);
    if (params.sort_by) query.sort_by = params.sort_by;
    if (params.sort_direction) query.sort_direction = params.sort_direction;
    if (params.q) query.q = params.q;
    if (params.q_by) query["q_by[]"] = params.q_by;
    if (params.filter_statuses) query["filter_by[statuses][]"] = params.filter_statuses;
    if (params.expand) query["expand[]"] = params.expand;
    const { data } = await api(getToken(), "GET", "/requests", undefined, query);
    return { content: [{ type: "text", text: formatResult(data) }] };
  }
);

server.tool(
  "get_request",
  "Get a request by ID, including its pages. Scopes: read_requests",
  { id: z.string().describe("Request ID") },
  async ({ id }) => {
    const { data } = await api(getToken(), "GET", `/requests/${id}`);
    return { content: [{ type: "text", text: formatResult(data) }] };
  }
);

server.tool(
  "create_request",
  "Create a new request from a template. Scopes: write_requests, write_clients (if client is new)",
  {
    name: z.string().describe("Request name"),
    client_email: z
      .string()
      .describe("Client email. Looks up existing client or creates a new one"),
    client_full_name: z
      .string()
      .optional()
      .describe("Required for new clients. Providing a value will overwrite existing name"),
    client_phone: z
      .string()
      .optional()
      .describe("Client phone. Providing a value will overwrite existing phone"),
    company_name: z
      .string()
      .optional()
      .describe("Company name. Will be created if not already associated with the client"),
    request_template_id: z
      .string()
      .optional()
      .describe("Request template ID (provide this or request_template_name)"),
    request_template_name: z
      .string()
      .optional()
      .describe("Request template name (provide this or request_template_id)"),
    due: z.string().optional().describe("Due date in yyyy-mm-dd format (default: 14 days)"),
    status: z
      .enum(["published", "draft"])
      .optional()
      .describe("Request status (default: draft)"),
    folder_id: z.string().optional().describe("Folder ID to group the request in"),
    folder_name: z.string().optional().describe("Folder name to group the request in"),
    owner_id: z.string().optional().describe("Request owner (team member) ID"),
    owner_email: z.string().optional().describe("Request owner (team member) email"),
    communication_template_id: z
      .string()
      .optional()
      .describe("Communications schedule ID"),
    communication_template_name: z
      .string()
      .optional()
      .describe("Communications schedule name"),
    comments_enabled: z.boolean().optional().describe("Enable client comments"),
    passcode_enabled: z
      .boolean()
      .optional()
      .describe("Require client to set a pin code"),
    share_via_link_enabled: z
      .boolean()
      .optional()
      .describe("Allow sharing via link without login"),
  },
  async (params) => {
    const { data } = await api(getToken(), "POST", "/requests", params);
    return { content: [{ type: "text", text: formatResult(data) }] };
  }
);

server.tool(
  "create_request_with_fields",
  "Create a request with inline pages, sections, and fields (no template needed). " +
    "Scopes: write_requests, write_clients (if client is new). " +
    "This allows building a complete request structure in a single call.",
  {
    name: z.string().describe("Request name"),
    client_email: z.string().describe("Client email"),
    client_full_name: z
      .string()
      .optional()
      .describe("Required for new clients"),
    company_name: z.string().optional().describe("Company name"),
    folder_name: z.string().optional().describe("Folder name"),
    due: z.string().optional().describe("Due date in yyyy-mm-dd format"),
    status: z
      .enum(["published", "draft"])
      .optional()
      .describe("Request status (default: draft)"),
    owner_id: z.string().optional().describe("Owner team member ID"),
    owner_email: z.string().optional().describe("Owner team member email"),
    communication_template_id: z.string().optional().describe("Communications schedule ID"),
    communication_template_name: z.string().optional().describe("Communications schedule name"),
    comments_enabled: z.boolean().optional().describe("Enable client comments"),
    passcode_enabled: z.boolean().optional().describe("Require pin code"),
    share_via_link_enabled: z.boolean().optional().describe("Allow sharing via link"),
    pages_data: z
      .array(PageData)
      .describe(
        "Array of pages, each containing sections with questions. " +
          "Field data_type options: single-line, text, multi-line text, formatted text, email, url, " +
          "address, country select, single image upload, multiple image upload, single file upload, " +
          "multiple file upload, signature, phone, number, currency, date/time, numeric rating, " +
          "star rating, single select option, multi select options, dropdown, task list, table, " +
          "date range, button, icon, color picker. " +
          "For option types (single select option, multi select options, dropdown, task list), provide the 'options' array. " +
          "For table type, provide the 'columns' array."
      ),
  },
  async (params) => {
    const { data } = await api(getToken(), "POST", "/requests", params);
    return { content: [{ type: "text", text: formatResult(data) }] };
  }
);

server.tool(
  "update_request",
  "Update an existing request. Scopes: write_requests",
  {
    id: z.string().describe("Request ID"),
    name: z.string().optional().describe("Request name"),
    due: z.string().optional().describe("Due date in yyyy-mm-dd format"),
    status: z
      .enum(["draft", "published", "completed", "archived"])
      .optional()
      .describe("Request status"),
    folder_id: z.string().optional().describe("Folder ID"),
    folder_name: z.string().optional().describe("Folder name"),
    owner_id: z.string().optional().describe("Owner team member ID"),
    owner_email: z.string().optional().describe("Owner team member email"),
    instruction_text: z
      .string()
      .optional()
      .describe("Request instructions (HTML supported)"),
    show_instruction: z.boolean().optional().describe("Show instructions to client"),
    communication_template_id: z
      .string()
      .nullable()
      .optional()
      .describe("Communications schedule ID (null to remove)"),
    communication_template_name: z
      .string()
      .nullable()
      .optional()
      .describe("Communications schedule name (null or 'None' to remove)"),
    comments_enabled: z.boolean().optional().describe("Enable client comments"),
    passcode_enabled: z.boolean().optional().describe("Require pin code"),
    share_via_link_enabled: z.boolean().optional().describe("Allow sharing via link"),
    client_assignments_ids: z
      .array(
        z.object({
          account_id: z.string().describe("Client ID"),
          client_company_id: z.string().optional().describe("Client company ID"),
          primary: z
            .boolean()
            .optional()
            .describe("Mark as primary client (only one per request)"),
        })
      )
      .optional()
      .describe("Client assignments"),
  },
  async ({ id, ...body }) => {
    const { data } = await api(getToken(), "PUT", `/requests/${id}`, body);
    return { content: [{ type: "text", text: formatResult(data) }] };
  }
);

server.tool(
  "delete_request",
  "Delete a request. Scopes: write_requests",
  { id: z.string().describe("Request ID") },
  async ({ id }) => {
    await api(getToken(), "DELETE", `/requests/${id}`);
    return { content: [{ type: "text", text: "Request deleted successfully." }] };
  }
);

// ---------------------------------------------------------------------------
// Tools: Request bulk actions
// ---------------------------------------------------------------------------

server.tool(
  "approve_all_submitted_fields",
  "Approve all submitted fields in a request, page, or section. Scopes: review_requests",
  {
    scope: z
      .enum(["request", "page", "section"])
      .describe("Whether to approve at request, page, or section level"),
    id: z.string().describe("ID of the request, page, or section"),
  },
  async ({ scope, id }) => {
    const pathMap = { request: "requests", page: "pages", section: "sections" };
    await api(
      getToken(),
      "PUT",
      `/${pathMap[scope]}/${id}/approve_all_submitted_fields`
    );
    return {
      content: [
        {
          type: "text",
          text: `All submitted fields in ${scope} ${id} have been approved.`,
        },
      ],
    };
  }
);

server.tool(
  "submit_all_fields",
  "Submit all fields for review in a request, page, or section. Scopes: review_requests",
  {
    scope: z
      .enum(["request", "page", "section"])
      .describe("Whether to submit at request, page, or section level"),
    id: z.string().describe("ID of the request, page, or section"),
  },
  async ({ scope, id }) => {
    const pathMap = { request: "requests", page: "pages", section: "sections" };
    await api(
      getToken(),
      "PUT",
      `/${pathMap[scope]}/${id}/submit_all_fields`
    );
    return {
      content: [
        {
          type: "text",
          text: `All fields in ${scope} ${id} have been submitted for review.`,
        },
      ],
    };
  }
);

server.tool(
  "run_integration_actions",
  "Run integration actions inside a request. Scopes: review_requests",
  { id: z.string().describe("Request ID") },
  async ({ id }) => {
    await api(getToken(), "PUT", `/requests/${id}/run_integration_actions`);
    return {
      content: [{ type: "text", text: `Integration actions run for request ${id}.` }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tools: Pages
// ---------------------------------------------------------------------------

server.tool(
  "get_page",
  "Get a page by ID, including its sections and fields. Scopes: read_requests",
  {
    id: z.string().describe("Page ID"),
    include_internal_fields: z
      .boolean()
      .optional()
      .describe("Include fields marked as internal (hidden from clients)"),
  },
  async ({ id, include_internal_fields }) => {
    const query: Record<string, string | undefined> = {};
    if (include_internal_fields !== undefined)
      query.include_internal_fields = String(include_internal_fields);
    const { data } = await api(getToken(), "GET", `/pages/${id}`, undefined, query);
    return { content: [{ type: "text", text: formatResult(data) }] };
  }
);

server.tool(
  "create_page",
  "Create a new page in a request from a template. Scopes: write_requests",
  {
    request_id: z.string().describe("Request ID to add the page to"),
    name: z.string().optional().describe("Page name (defaults to template name)"),
    source_template_id: z
      .string()
      .optional()
      .describe("Page template ID (provide this or source_template_name)"),
    source_template_name: z
      .string()
      .optional()
      .describe("Page template name (provide this or source_template_id)"),
  },
  async (params) => {
    const { data } = await api(getToken(), "POST", "/pages", params);
    return { content: [{ type: "text", text: formatResult(data) }] };
  }
);

// ---------------------------------------------------------------------------
// Tools: Sections
// ---------------------------------------------------------------------------

server.tool(
  "create_section",
  "Create a new section in a page from a template. Scopes: write_requests",
  {
    page_id: z.string().describe("Page ID to add the section to"),
    name: z.string().optional().describe("Section name (defaults to template name)"),
    source_template_id: z
      .string()
      .optional()
      .describe("Section template ID (provide this or source_template_name)"),
    source_template_name: z
      .string()
      .optional()
      .describe("Section template name (provide this or source_template_id)"),
  },
  async (params) => {
    const { data } = await api(getToken(), "POST", "/sections", params);
    return { content: [{ type: "text", text: formatResult(data) }] };
  }
);

// ---------------------------------------------------------------------------
// Tools: Fields
// ---------------------------------------------------------------------------

server.tool(
  "review_field",
  "Review a field - approve, reject, submit for review, or revise. Scopes: review_requests",
  {
    id: z.string().describe("Field ID"),
    status: z
      .enum(["approved", "done", "redo", "todo"])
      .describe(
        "Field status: 'approved' to approve, 'done' to submit for review, " +
          "'redo' to reject, 'todo' to revise/remove reject/remove approval"
      ),
    rejection_comment: z
      .string()
      .optional()
      .describe("Message to client explaining why the field was rejected"),
  },
  async ({ id, ...body }) => {
    const { data } = await api(getToken(), "PUT", `/fields/${id}/review`, body);
    return { content: [{ type: "text", text: formatResult(data) }] };
  }
);

// ---------------------------------------------------------------------------
// Tools: Templates
// ---------------------------------------------------------------------------

server.tool(
  "list_request_templates",
  "List request templates. Scopes: read_templates",
  PaginationParams,
  async (params) => {
    const query: Record<string, string | undefined> = {};
    if (params.limit !== undefined) query.limit = String(params.limit);
    if (params.offset !== undefined) query.offset = String(params.offset);
    const { data } = await api(getToken(), "GET", "/request_templates", undefined, query);
    return { content: [{ type: "text", text: formatResult(data) }] };
  }
);

server.tool(
  "list_page_templates",
  "List page templates. Scopes: read_templates",
  PaginationParams,
  async (params) => {
    const query: Record<string, string | undefined> = {};
    if (params.limit !== undefined) query.limit = String(params.limit);
    if (params.offset !== undefined) query.offset = String(params.offset);
    const { data } = await api(getToken(), "GET", "/page_templates", undefined, query);
    return { content: [{ type: "text", text: formatResult(data) }] };
  }
);

server.tool(
  "list_section_templates",
  "List section templates. Scopes: read_templates",
  PaginationParams,
  async (params) => {
    const query: Record<string, string | undefined> = {};
    if (params.limit !== undefined) query.limit = String(params.limit);
    if (params.offset !== undefined) query.offset = String(params.offset);
    const { data } = await api(getToken(), "GET", "/section_templates", undefined, query);
    return { content: [{ type: "text", text: formatResult(data) }] };
  }
);

// ---------------------------------------------------------------------------
// Tools: Communication Templates
// ---------------------------------------------------------------------------

server.tool(
  "list_communication_templates",
  "List communications schedules. Scopes: read_requests",
  PaginationParams,
  async (params) => {
    const query: Record<string, string | undefined> = {};
    if (params.limit !== undefined) query.limit = String(params.limit);
    if (params.offset !== undefined) query.offset = String(params.offset);
    const { data } = await api(
      getToken(),
      "GET",
      "/communication_templates",
      undefined,
      query
    );
    return { content: [{ type: "text", text: formatResult(data) }] };
  }
);

// ---------------------------------------------------------------------------
// Tools: Folders
// ---------------------------------------------------------------------------

server.tool(
  "list_folders",
  "List folders. Scopes: read_requests",
  PaginationParams,
  async (params) => {
    const query: Record<string, string | undefined> = {};
    if (params.limit !== undefined) query.limit = String(params.limit);
    if (params.offset !== undefined) query.offset = String(params.offset);
    const { data } = await api(getToken(), "GET", "/folders", undefined, query);
    return { content: [{ type: "text", text: formatResult(data) }] };
  }
);

// ---------------------------------------------------------------------------
// Tools: Team Members
// ---------------------------------------------------------------------------

server.tool(
  "list_team_members",
  "List team members. Scopes: read_team_members",
  {
    ...PaginationParams,
    ...SortParams,
    ...SearchParams,
  },
  async (params) => {
    const query: Record<string, string | string[] | undefined> = {};
    if (params.limit !== undefined) query.limit = String(params.limit);
    if (params.offset !== undefined) query.offset = String(params.offset);
    if (params.sort_by) query.sort_by = params.sort_by;
    if (params.sort_direction) query.sort_direction = params.sort_direction;
    if (params.q) query.q = params.q;
    if (params.q_by) query["q_by[]"] = params.q_by;
    const { data } = await api(getToken(), "GET", "/team_members", undefined, query);
    return { content: [{ type: "text", text: formatResult(data) }] };
  }
);

server.tool(
  "get_team_member",
  "Get a team member by ID. Scopes: read_team_members",
  { id: z.string().describe("Team member ID") },
  async ({ id }) => {
    const { data } = await api(getToken(), "GET", `/team_members/${id}`);
    return { content: [{ type: "text", text: formatResult(data) }] };
  }
);

server.tool(
  "create_team_member",
  "Create a new team member. Scopes: write_team_members",
  {
    email: z.string().describe("Email address"),
    full_name: z.string().describe("Full name"),
    role: z
      .enum(["admin", "editor", "reviewer", "viewer"])
      .describe("Team member role"),
    phone: z.string().optional().describe("Phone number"),
    personal_message: z
      .string()
      .optional()
      .describe("Message included in the invitation email"),
  },
  async (params) => {
    const { data } = await api(getToken(), "POST", "/team_members", params);
    return { content: [{ type: "text", text: formatResult(data) }] };
  }
);

server.tool(
  "update_team_member",
  "Update a team member. Scopes: write_team_members",
  {
    id: z.string().describe("Team member ID"),
    role: z
      .enum(["admin", "editor", "reviewer", "viewer"])
      .optional()
      .describe("Team member role"),
    active: z
      .boolean()
      .optional()
      .describe("Active (true) or inactive (false)"),
  },
  async ({ id, ...body }) => {
    const { data } = await api(getToken(), "PUT", `/team_members/${id}`, body);
    return { content: [{ type: "text", text: formatResult(data) }] };
  }
);

server.tool(
  "delete_team_member",
  "Delete a team member. Scopes: write_team_members",
  { id: z.string().describe("Team member ID") },
  async ({ id }) => {
    await api(getToken(), "DELETE", `/team_members/${id}`);
    return { content: [{ type: "text", text: "Team member deleted successfully." }] };
  }
);

// ---------------------------------------------------------------------------
// Tools: Webhooks
// ---------------------------------------------------------------------------

const WebhookEvent = z.enum([
  "all_fields_completed",
  "client_create_failed",
  "client_created",
  "client_destroy_failed",
  "client_destroyed",
  "client_portal_group_created",
  "client_portal_group_destroyed",
  "client_portal_group_updated",
  "client_portal_viewed",
  "client_update_failed",
  "client_updated",
  "comment_create_failed",
  "comment_created",
  "email_bounced",
  "email_delivered",
  "email_spam_complained",
  "field_approved",
  "field_completed",
  "field_rejected",
  "integration_action_failed",
  "integration_action_succeeded",
  "internal_comment_created",
  "page_completed",
  "product_item_auto_purchase",
  "product_item_exhausted",
  "product_item_manual_purchase",
  "product_item_purchase_failed",
  "product_item_returned",
  "product_item_used",
  "recurring_request_completed",
  "recurring_request_created",
  "recurring_request_destroyed",
  "recurring_request_executed",
  "recurring_request_failed",
  "request_archived",
  "request_archived_failed",
  "request_board_column_change_failed",
  "request_board_column_changed",
  "request_completed",
  "request_completed_failed",
  "request_create_failed",
  "request_created",
  "request_destroy_failed",
  "request_destroyed",
  "request_draft",
  "request_published",
  "request_published_failed",
  "request_reopened",
  "request_reopen_failed",
  "request_update_failed",
  "request_updated",
  "request_viewed",
  "section_completed",
]);

server.tool(
  "list_webhooks",
  "List webhooks. Scopes: administration",
  PaginationParams,
  async (params) => {
    const query: Record<string, string | undefined> = {};
    if (params.limit !== undefined) query.limit = String(params.limit);
    if (params.offset !== undefined) query.offset = String(params.offset);
    const { data } = await api(getToken(), "GET", "/webhooks", undefined, query);
    return { content: [{ type: "text", text: formatResult(data) }] };
  }
);

server.tool(
  "get_webhook",
  "Get a webhook by ID. Scopes: administration",
  { id: z.string().describe("Webhook ID") },
  async ({ id }) => {
    const { data } = await api(getToken(), "GET", `/webhooks/${id}`);
    return { content: [{ type: "text", text: formatResult(data) }] };
  }
);

server.tool(
  "create_webhook",
  "Create a new webhook. Scopes: administration",
  {
    url: z.string().describe("Webhook callback URL"),
    enabled: z.boolean().optional().describe("Whether the webhook is enabled (default: true)"),
    subscriptions: z.array(WebhookEvent).optional().describe("List of events to subscribe to"),
  },
  async (params) => {
    const { data } = await api(getToken(), "POST", "/webhooks", params);
    return { content: [{ type: "text", text: formatResult(data) }] };
  }
);

server.tool(
  "update_webhook",
  "Update a webhook. Scopes: administration",
  {
    id: z.string().describe("Webhook ID"),
    url: z.string().optional().describe("Webhook callback URL"),
    enabled: z.boolean().optional().describe("Whether the webhook is enabled"),
    subscriptions: z.array(WebhookEvent).optional().describe("List of events to subscribe to"),
  },
  async ({ id, ...body }) => {
    const { data } = await api(getToken(), "PUT", `/webhooks/${id}`, body);
    return { content: [{ type: "text", text: formatResult(data) }] };
  }
);

server.tool(
  "delete_webhook",
  "Delete a webhook. Scopes: administration",
  { id: z.string().describe("Webhook ID") },
  async ({ id }) => {
    await api(getToken(), "DELETE", `/webhooks/${id}`);
    return { content: [{ type: "text", text: "Webhook deleted successfully." }] };
  }
);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
