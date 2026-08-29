import type { TokenSet, TokenStore } from "./token-store.js";
import { createTokenSet, isTokenExpired } from "./token-store.js";

const cognitoEndpoint = "https://cognito-idp.ap-southeast-3.amazonaws.com/";
const defaultClientId = "6vcd500elmtpkiks9qp83vs8fh";
const profileEndpoint = "https://6cr9nj44pd.execute-api.ap-southeast-3.amazonaws.com/v1/profile";

type FetchLike = typeof fetch;

type CognitoResponse = {
  AuthenticationResult?: {
    AccessToken?: string;
    IdToken?: string;
    RefreshToken?: string;
    ExpiresIn?: number;
  };
  ChallengeName?: string;
  ChallengeParameters?: Record<string, string>;
  __type?: string;
  message?: string;
};

const requestCognito = async (
  target: "USER_PASSWORD_AUTH" | "REFRESH_TOKEN_AUTH",
  parameters: Record<string, string>,
  fetchImpl: FetchLike,
  clientId: string,
): Promise<CognitoResponse> => {
  const response = await fetchImpl(cognitoEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": `AWSCognitoIdentityProviderService.InitiateAuth`,
    },
    body: JSON.stringify({ AuthFlow: target, ClientId: clientId, AuthParameters: parameters }),
  });
  const body = await response.json() as CognitoResponse;
  if (!response.ok) {
    throw new Error(body.message ?? "Authentication failed");
  }
  return body;
};

const getAuthenticationResult = (response: CognitoResponse): {
  AccessToken: string;
  IdToken?: string;
  RefreshToken?: string;
  ExpiresIn?: number;
} => {
  if (!response.AuthenticationResult?.AccessToken) {
    throw new Error(response.message ?? response.ChallengeName ?? "Authentication did not return tokens");
  }
  return {
    AccessToken: response.AuthenticationResult.AccessToken,
    IdToken: response.AuthenticationResult.IdToken,
    RefreshToken: response.AuthenticationResult.RefreshToken,
    ExpiresIn: response.AuthenticationResult.ExpiresIn,
  };
};

export const login = async (
  email: string,
  password: string,
  tokenStore: TokenStore,
  fetchImpl: FetchLike = fetch,
  clientId = defaultClientId,
): Promise<TokenSet> => {
  const response = await requestCognito("USER_PASSWORD_AUTH", { USERNAME: email, PASSWORD: password }, fetchImpl, clientId);
  const result = getAuthenticationResult(response);
  const tokens = createTokenSet(result, result.RefreshToken);
  await tokenStore.save(tokens);
  return tokens;
};

const refresh = async (
  tokens: TokenSet,
  tokenStore: TokenStore,
  fetchImpl: FetchLike,
  clientId: string,
): Promise<TokenSet> => {
  const response = await requestCognito("REFRESH_TOKEN_AUTH", { REFRESH_TOKEN: tokens.refreshToken }, fetchImpl, clientId);
  const result = getAuthenticationResult(response);
  const refreshedTokens = createTokenSet(result, tokens.refreshToken);
  await tokenStore.save(refreshedTokens);
  return refreshedTokens;
};

export const getProfile = async (
  tokenStore: TokenStore,
  fetchImpl: FetchLike = fetch,
  clientId = defaultClientId,
  now = Date.now(),
): Promise<unknown> => {
  let tokens = await tokenStore.load();
  if (!tokens) {
    throw new Error("Not logged in. Run `akundigital login <email> <password>` first.");
  }
  if (isTokenExpired(tokens, now)) {
    tokens = await refresh(tokens, tokenStore, fetchImpl, clientId);
  }

  let response = await fetchImpl(profileEndpoint, {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });
  if (response.status === 401) {
    tokens = await refresh(tokens, tokenStore, fetchImpl, clientId);
    response = await fetchImpl(profileEndpoint, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
  }
  const body = await response.json() as { data?: unknown; error?: string };
  if (!response.ok) {
    throw new Error(body.error ?? "Failed to get profile");
  }
  return body.data ?? body;
};
