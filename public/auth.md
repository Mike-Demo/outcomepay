# OutcomePay — auth.md

You are an agent. OutcomePay uses **AgentID** for identity: discover → pick a method → authorize (register your inbox) → exchange the code for an `access_token` → call the API → handle errors and revocation. Follow the steps in order.

Hosts: resource server `https://outcomepay.view.fast`, authorization server `https://auth.agentid.com` (AgentID).

## Discover

Two well-known documents describe everything:

- Protected Resource Metadata (RFC 9728): `GET https://outcomepay.view.fast/.well-known/oauth-protected-resource` — names the `resource`, its `authorization_servers`, `scopes_supported`, and `bearer_methods_supported` (`header`).
- Authorization Server metadata (RFC 8414): `GET https://outcomepay.view.fast/.well-known/oauth-authorization-server` — the AgentID endpoints plus the `agent_auth` block (`agent_auth.skill` is this file; `agent_auth.identity_endpoint` is below).

Any protected endpoint answers an unauthenticated request with `401` and a spec-shaped header — this is your discovery shortcut:

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata="https://outcomepay.view.fast/.well-known/oauth-protected-resource", authorization_uri="https://auth.agentid.com/v0/authorize"
```

## Pick a method

`agent_auth.identity_types_supported` is `["identity_assertion", "service_auth"]`:

1. **identity_assertion** — you act for a human or agent identity known to AgentID. You complete the authorization-code flow (below) and present the resulting `access_token` as a Bearer token; OutcomePay asserts the identity by validating the token against the issuer. This is the normal path.
2. **service_auth** — a registered application calling with its own credentials. Applications authenticate at the token endpoint with `client_secret_basic` (the method is listed in the AS metadata). OutcomePay's own app credentials are held by the operator and are never distributed to third-party agents — if you are a third-party agent, use identity_assertion.

There is no anonymous tier for authenticated surfaces: the public REST reads (outcome state, ledger, receipts, search) are open to everyone. The REST pipeline writes are public in this prototype by design — the deterministic policy gates, not identity, guard settlement — while the MCP server and the identity endpoint require an AgentID identity, and approvals recorded via MCP are attributed to the caller's AgentID identity.

## Register

Agents do not register an application — applications are registered by the operator in the AgentID console. What you register is **your inbox**: an [AgentMail](https://agentmail.to) inbox (for example `your-name@agentmail.to`) is your AgentID identity. If you don't have one, create one with the AgentMail API first; the AgentID waiting page also links a one-step signup.

## Claim

Authorization happens on the issuer's waiting page:

1. Start: `GET https://outcomepay.view.fast/auth/login` → `302` to `https://auth.agentid.com/v0/authorize` (response_type `code`, PKCE `S256`, scopes `openid email profile`). The page title is "SIGN IN TO OUTCOMEPAY" and it shows an `auth_token` with a countdown (5 minutes).
2. Claim the session by authorizing your inbox — the page itself prints this command:

```bash
curl -X POST "https://api.agentmail.to/v0/inboxes/$AGENTMAIL_INBOX_ID/authorize" \
  -H "Authorization: Bearer $AGENTMAIL_API_KEY" \
  -H "Content-Type: application/json" \
  --data '{"auth_token":"<from the waiting page>","accept_disclosure":true}'
```

`HTTP 202 — "Authorization complete"` means the claim worked. Note: agent inboxes have no human AgentMail account, so the page's "sign in for humans" email-code path cannot work for an agent identity — the inbox authorization above is the agent path.

## Exchange

The waiting page redirects the browser to `https://outcomepay.view.fast/auth/callback?code=…&state=…`. The application exchanges the code at the token endpoint:

```http
POST https://auth.agentid.com/v0/token
Authorization: Basic base64(client_id:client_secret)
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&code=<code>&redirect_uri=https://outcomepay.view.fast/auth/callback&code_verifier=<pkce verifier>
```

Response: `{access_token, id_token, token_type: "Bearer", expires_in, scope}`. ID tokens are ES256-signed; verify against `https://auth.agentid.com/v0/jwks.json` (issuer `https://auth.agentid.com`, audience = your client_id).

If you drive the flow with your own client registration instead of OutcomePay's pages, the same exchange applies with your redirect URI.

## Use the access_token

Send it as a Bearer token (`bearer_methods_supported: ["header"]`):

- **MCP**: `POST https://outcomepay.view.fast/mcp` with `Authorization: Bearer <access_token>` (JSON-RPC 2.0, streamable HTTP). Tools mirror the REST pipeline.
- **Identity check**: `GET https://outcomepay.view.fast/agent/identity` with the same header returns the validated identity (name, email, actor type, owner) — this is the `agent_auth.identity_endpoint`. Without a token it returns the `401` + `WWW-Authenticate` discovery response above.
- **REST pipeline**: the pipeline endpoints are public, but settlement stays policy-gated (verification PASS + recorded approval) no matter which transport or token you use. Approvals recorded via MCP are attributed to your AgentID identity.

## Errors

Errors are JSON: `{"ok": false, "error": "<code>", "message": "<detail>"}`.

- `401 unauthorized` — missing/expired/invalid token on a protected endpoint; the `WWW-Authenticate` header tells you where to restart discovery.
- `token_exchange_failed:<oauth error>` — the callback could not exchange the code (expired, reused, or mismatched redirect URI / PKCE verifier). Restart from `/auth/login`; codes are single-use and short-lived.
- `policy_gated`, `already_settled`, `stale_verification`, `not_verified` — pipeline policy outcomes, not auth problems. See [llms.txt](https://outcomepay.view.fast/llms.txt).

## Revocation

Access tokens are short-lived JWTs issued by AgentID; there is nothing to revoke on OutcomePay (it stores no tokens or sessions — validation happens per request against the issuer's userinfo endpoint). To end access, let the token expire; to revoke at the source, use your AgentID console session. Inbox authorizations you granted can be reviewed in the AgentID console under your organization's applications.
