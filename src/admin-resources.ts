import type { TokenStore } from "./token-store.js";
import type { ApiEnvelope, FetchLike } from "./http.js";
import { apiBaseUrl, defaultClientId, withStatus } from "./http.js";
import { fetchAuthorized } from "./api-client.js";

const profileEndpoint = `${apiBaseUrl}/v1/profile`;
const ordersEndpoint = `${apiBaseUrl}/v1/orders`;
const subscriptionsEndpoint = `${apiBaseUrl}/v1/admin/subscriptions`;
const paymentsEndpoint = `${apiBaseUrl}/v1/admin/payments`;
const credentialsEndpoint = `${apiBaseUrl}/v1/admin/credentials`;

export const getProfile = async (
  tokenStore: TokenStore,
  fetchImpl: FetchLike = fetch,
  clientId = defaultClientId,
  now = Date.now(),
): Promise<unknown> => {
  const response = await fetchAuthorized(profileEndpoint, tokenStore, fetchImpl, clientId, now);
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

export const maxOrdersLimit = 5;

export const getOrders = async (
  tokenStore: TokenStore,
  fetchImpl: FetchLike = fetch,
  clientId = defaultClientId,
  now = Date.now(),
  limit = maxOrdersLimit,
  status?: string,
): Promise<Order[]> => {
  const response = await fetchAuthorized(withStatus(ordersEndpoint, status), tokenStore, fetchImpl, clientId, now);
  const body = await response.json() as ApiEnvelope<{ orders: Order[] }>;
  if (!response.ok || !body.success || !body.data) {
    throw new Error(body.error ?? "Failed to get orders");
  }
  return body.data.orders.slice(0, limit);
};

export type Subscription = {
  id: string;
  user_id: string;
  platform_slug: string;
  platform_name: string;
  order_id: string;
  plan_type: string;
  plan_duration: number;
  status: string;
  credential_id?: string;
  credential_slot_id?: string;
  subscription_expires_at?: string;
  created_at: string;
  updated_at: string;
};

export const maxSubscriptionsLimit = 5;

export const getSubscriptions = async (
  tokenStore: TokenStore,
  fetchImpl: FetchLike = fetch,
  clientId = defaultClientId,
  now = Date.now(),
  limit = maxSubscriptionsLimit,
  status?: string,
): Promise<Subscription[]> => {
  const response = await fetchAuthorized(withStatus(subscriptionsEndpoint, status), tokenStore, fetchImpl, clientId, now);
  const body = await response.json() as ApiEnvelope<{ subscriptions: Subscription[] }>;
  if (!response.ok || !body.success || !body.data) {
    throw new Error(body.error ?? "Failed to get subscriptions");
  }
  return body.data.subscriptions.slice(0, limit);
};

export type Payment = {
  id: string;
  user_id: string;
  order_id: string;
  amount: number;
  status: string;
  payment_method?: string;
  created_at: string;
  updated_at: string;
};

export const maxPaymentsLimit = 5;

export const getPayments = async (
  tokenStore: TokenStore,
  fetchImpl: FetchLike = fetch,
  clientId = defaultClientId,
  now = Date.now(),
  limit = maxPaymentsLimit,
): Promise<Payment[]> => {
  const response = await fetchAuthorized(paymentsEndpoint, tokenStore, fetchImpl, clientId, now);
  const body = await response.json() as ApiEnvelope<{ payments: Payment[] }>;
  if (!response.ok || !body.success || !body.data) {
    throw new Error(body.error ?? "Failed to get payments");
  }
  return body.data.payments.slice(0, limit);
};

export type Credential = {
  id: string;
  platform_slug: string;
  platform_name: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export const maxCredentialsLimit = 5;

export const getCredentials = async (
  tokenStore: TokenStore,
  fetchImpl: FetchLike = fetch,
  clientId = defaultClientId,
  now = Date.now(),
  limit = maxCredentialsLimit,
  status?: string,
): Promise<Credential[]> => {
  const response = await fetchAuthorized(withStatus(credentialsEndpoint, status), tokenStore, fetchImpl, clientId, now);
  const body = await response.json() as ApiEnvelope<{ credentials: Credential[] }>;
  if (!response.ok || !body.success || !body.data) {
    throw new Error(body.error ?? "Failed to get credentials");
  }
  return body.data.credentials.slice(0, limit);
};
