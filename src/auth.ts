import type { TokenSet, TokenStore } from "./token-store.js";
import { createTokenSet, isTokenExpired } from "./token-store.js";

const cognitoEndpoint = "https://cognito-idp.ap-southeast-3.amazonaws.com/";
const defaultClientId = "6vcd500elmtpkiks9qp83vs8fh";
const apiBaseUrl = "https://6cr9nj44pd.execute-api.ap-southeast-3.amazonaws.com";
const profileEndpoint = `${apiBaseUrl}/v1/profile`;
const ordersEndpoint = `${apiBaseUrl}/v1/orders`;
const deviceStartEndpoint = `${apiBaseUrl}/v1/auth/cli/device`;
const deviceTokenEndpoint = `${apiBaseUrl}/v1/auth/cli/token`;

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

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
};

type DeviceStartResponse = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
};

type DeviceTokenResponse = {
  access_token: string;
  id_token?: string;
  refresh_token?: string;
  expires_in?: number;
};

export type DevicePrompt = {
  verificationUri: string;
  userCode: string;
};

const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const startDeviceLogin = async (fetchImpl: FetchLike): Promise<DeviceStartResponse> => {
  const response = await fetchImpl(deviceStartEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const body = await response.json() as ApiEnvelope<DeviceStartResponse>;
  if (!response.ok || !body.success || !body.data) {
    throw new Error(body.error ?? "Failed to start device login");
  }
  return body.data;
};

const pollDeviceToken = async (deviceCode: string, fetchImpl: FetchLike): Promise<DeviceTokenResponse | undefined> => {
  const response = await fetchImpl(deviceTokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ device_code: deviceCode }),
  });
  const body = await response.json() as ApiEnvelope<DeviceTokenResponse>;
  if (body.success && body.data) {
    return body.data;
  }
  if (body.code === "AUTHORIZATION_PENDING") {
    return undefined;
  }
  throw new Error(body.error ?? "Device login failed");
};

export const loginWithDevice = async (
  tokenStore: TokenStore,
  fetchImpl: FetchLike = fetch,
  onPrompt?: (prompt: DevicePrompt) => void,
  sleepImpl: (milliseconds: number) => Promise<void> = sleep,
): Promise<TokenSet> => {
  const session = await startDeviceLogin(fetchImpl);
  onPrompt?.({ verificationUri: session.verification_uri, userCode: session.user_code });

  const deadline = Date.now() + session.expires_in * 1000;
  while (Date.now() < deadline) {
    await sleepImpl(session.interval * 1000);
    const result = await pollDeviceToken(session.device_code, fetchImpl);
    if (result) {
      const tokens = createTokenSet({
        AccessToken: result.access_token,
        IdToken: result.id_token,
        RefreshToken: result.refresh_token,
        ExpiresIn: result.expires_in,
      }, result.refresh_token);
      await tokenStore.save(tokens);
      return tokens;
    }
  }
  throw new Error("Device login timed out. Run `akundigital login --device` again.");
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

export type Order = {
  id: string;
  platform_name: string;
  plan_type: string;
  plan_duration: number;
  status: string;
  total_amount?: number;
  created_at: string;
};

export const maxOrdersLimit = 10;

export const getOrders = async (
  tokenStore: TokenStore,
  fetchImpl: FetchLike = fetch,
  clientId = defaultClientId,
  now = Date.now(),
): Promise<Order[]> => {
  let tokens = await tokenStore.load();
  if (!tokens) {
    throw new Error("Not logged in. Run `akundigital login <email> <password>` first.");
  }
  if (isTokenExpired(tokens, now)) {
    tokens = await refresh(tokens, tokenStore, fetchImpl, clientId);
  }

  let response = await fetchImpl(ordersEndpoint, {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });
  if (response.status === 401) {
    tokens = await refresh(tokens, tokenStore, fetchImpl, clientId);
    response = await fetchImpl(ordersEndpoint, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
  }
  const body = await response.json() as ApiEnvelope<{ orders: Order[] }>;
  if (!response.ok || !body.success || !body.data) {
    throw new Error(body.error ?? "Failed to get orders");
  }
  return body.data.orders.slice(0, maxOrdersLimit);
};
