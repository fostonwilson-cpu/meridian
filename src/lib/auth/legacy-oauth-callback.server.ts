import type { BetterAuthPlugin } from "better-auth";
import { GROK_PROVIDERS } from "./providers.ts";

const LEGACY_CALLBACK_MARKER = "/oauth2/callback/";

/**
 * Better Auth 1.7 serves generic-OAuth callbacks at `/callback/:id`.
 * The Grok broker allowlists `/api/auth/oauth2/callback/*` (see `preview.ts`),
 * so rewrite that legacy path onto the 1.7 route before routing.
 *
 * Returns null when the request is not a legacy callback.
 */
export function legacyOAuthCallbackURL(requestUrl: string): URL | null {
  const url = new URL(requestUrl);
  const index = url.pathname.indexOf(LEGACY_CALLBACK_MARKER);
  if (index === -1) return null;
  const providerPath = url.pathname.slice(index + LEGACY_CALLBACK_MARKER.length);
  url.pathname = `${url.pathname.slice(0, index)}/callback/${providerPath}`;
  return url;
}

/**
 * 1.6 stored whichever of OAuth `id` or OIDC `sub` the profile carried.
 * 1.7 plain (non-discovery) providers read only `id`, but the broker userinfo
 * document identifies the user with `sub`.
 */
export function grokOAuthAccountId(profile: {
  id?: string | number | null;
  sub?: string | number | null;
}): string {
  for (const value of [profile.id, profile.sub]) {
    if (value === undefined || value === null || value === "") continue;
    return String(value);
  }
  return "";
}

/**
 * Keep the 1.6 callback path for providers registered with the Grok broker.
 * Must be listed after `genericOAuth`, which publishes `socialProviders`.
 */
export function legacyOAuthCallback(): BetterAuthPlugin {
  const providerIds = new Set(GROK_PROVIDERS.map((provider) => provider.providerId));
  return {
    id: "grok-legacy-oauth-callback",
    init(ctx) {
      return {
        context: {
          socialProviders: ctx.socialProviders.map((provider) =>
            providerIds.has(provider.id)
              ? { ...provider, callbackPath: `/oauth2/callback/${provider.id}` }
              : provider,
          ),
        },
      };
    },
    async onRequest(request) {
      const url = legacyOAuthCallbackURL(request.url);
      if (!url) return;
      return { request: new Request(url, request) };
    },
  };
}
