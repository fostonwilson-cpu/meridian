import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  grokOAuthAccountId,
  legacyOAuthCallback,
  legacyOAuthCallbackURL,
} from "./legacy-oauth-callback.server.ts";

describe("legacy OAuth callback path", () => {
  it("rewrites the broker callback onto Better Auth 1.7's callback route", () => {
    const url = legacyOAuthCallbackURL(
      "https://preview.grok-sandbox.com/api/auth/oauth2/callback/grok-google?code=abc&state=xyz",
    );
    assert.ok(url);
    assert.equal(
      url.href,
      "https://preview.grok-sandbox.com/api/auth/callback/grok-google?code=abc&state=xyz",
    );
  });

  it("leaves every other auth path alone", () => {
    assert.equal(
      legacyOAuthCallbackURL("https://preview.grok-sandbox.com/api/auth/callback/grok-google"),
      null,
    );
    assert.equal(
      legacyOAuthCallbackURL("https://preview.grok-sandbox.com/api/auth/get-session"),
      null,
    );
  });

  it("points only the Grok providers at the broker callback path", () => {
    const plugin = legacyOAuthCallback();
    const init = plugin.init?.({
      socialProviders: [
        { id: "grok-google", name: "grok-google" },
        { id: "grok-x", name: "grok-x" },
        { id: "github", name: "GitHub" },
      ],
    } as never);
    assert.ok(init && !(init instanceof Promise));
    const providers = init.context?.socialProviders as { id: string; callbackPath?: string }[];
    assert.deepEqual(
      providers.map((provider) => [provider.id, provider.callbackPath ?? null]),
      [
        ["grok-google", "/oauth2/callback/grok-google"],
        ["grok-x", "/oauth2/callback/grok-x"],
        ["github", null],
      ],
    );
  });
});

describe("grok OAuth account id", () => {
  it("prefers id, then sub, matching Better Auth 1.6", () => {
    assert.equal(grokOAuthAccountId({ id: "oauth-id", sub: "oidc-sub" }), "oauth-id");
    assert.equal(grokOAuthAccountId({ id: "", sub: "oidc-sub" }), "oidc-sub");
    assert.equal(grokOAuthAccountId({ sub: 42 }), "42");
    assert.equal(grokOAuthAccountId({}), "");
  });
});
