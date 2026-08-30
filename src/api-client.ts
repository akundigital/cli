import type { TokenStore } from "./token-store.js";
import { isTokenExpired } from "./token-store.js";
import type { FetchLike } from "./http.js";
import { refresh } from "./cognito.js";

export const fetchAuthorized = async (
  url: string,
  tokenStore: TokenStore,
  fetchImpl: FetchLike,
  clientId: string,
  now: number,
  init?: RequestInit,
): Promise<Response> => {
  const loadedTokens = await tokenStore.load();
  if (!loadedTokens) {
    throw new Error("Not logged in. Run `akundigital login <email> <password>` first.");
  }
  let tokens = isTokenExpired(loadedTokens, now)
    ? await refresh(loadedTokens, tokenStore, fetchImpl, clientId)
    : loadedTokens;

  const request = () => fetchImpl(url, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${tokens.accessToken}` },
  });

  let response = await request();
  if (response.status === 401) {
    tokens = await refresh(tokens, tokenStore, fetchImpl, clientId);
    response = await request();
  }
  return response;
};
