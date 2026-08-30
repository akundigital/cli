import type { TokenStore } from "./token-store.js";
import type { ApiEnvelope, FetchLike } from "./http.js";
import { apiBaseUrl, defaultClientId, withQueryParam, withStatus } from "./http.js";
import { fetchAuthorized } from "./api-client.js";

const profileEndpoint = `${apiBaseUrl}/v1/profile`;
const ordersEndpoint = `${apiBaseUrl}/v1/orders`;
const adminOrdersEndpoint = `${apiBaseUrl}/v1/admin/orders`;
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

export type AdminOrder = Order & {
  source: string;
  user_name?: string;
  user_email?: string;
  user_phone?: string;
  total_payment: number;
  payment_received: boolean;
  payment_received_at?: string;
  expires_at?: string;
};

export const approveOrder = async (
  tokenStore: TokenStore,
  orderId: string,
  fetchImpl: FetchLike = fetch,
  clientId = defaultClientId,
  now = Date.now(),
): Promise<AdminOrder> => {
  const response = await fetchAuthorized(
    `${adminOrdersEndpoint}/${encodeURIComponent(orderId)}/status`,
    tokenStore,
    fetchImpl,
    clientId,
    now,
    { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "PAID" }) },
  );
  const body = await response.json() as ApiEnvelope<{ order: AdminOrder }>;
  if (!response.ok || !body.success || !body.data) {
    throw new Error(body.error ?? "Failed to approve order");
  }
  return body.data.order;
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

export type ArchiveSubscriptionsResult = {
  archived_count: number;
  subscriptions: Subscription[];
};

export const archiveSubscriptions = async (
  tokenStore: TokenStore,
  subscriptionIds: string[],
  fetchImpl: FetchLike = fetch,
  clientId = defaultClientId,
  now = Date.now(),
): Promise<ArchiveSubscriptionsResult> => {
  const response = await fetchAuthorized(
    `${subscriptionsEndpoint}/archive`,
    tokenStore,
    fetchImpl,
    clientId,
    now,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription_ids: subscriptionIds }),
    },
  );
  const body = await response.json() as ApiEnvelope<ArchiveSubscriptionsResult>;
  if (!response.ok || !body.success || !body.data) {
    throw new Error(body.error ?? "Failed to archive subscriptions");
  }
  return body.data;
};

export type Payment = {
  id: string;
  amount: number;
  provider: string;
  sender_name?: string;
  match_status: string;
  order_id?: string;
  candidate_order_ids?: string[];
  received_at: string;
};

export const maxPaymentsLimit = 5;

export const getPayments = async (
  tokenStore: TokenStore,
  fetchImpl: FetchLike = fetch,
  clientId = defaultClientId,
  now = Date.now(),
  limit = maxPaymentsLimit,
  matchStatus?: string,
): Promise<Payment[]> => {
  const response = await fetchAuthorized(withQueryParam(paymentsEndpoint, "match_status", matchStatus), tokenStore, fetchImpl, clientId, now);
  const body = await response.json() as ApiEnvelope<{ payments: Payment[] }>;
  if (!response.ok || !body.success || !body.data) {
    throw new Error(body.error ?? "Failed to get payments");
  }
  return body.data.payments.slice(0, limit);
};

export type Credential = {
  id: string;
  platform: string;
  credential_types: string[];
  has_password: boolean;
  email?: string;
  phone?: string;
  expiration_date: string;
  status: string;
  total_slots: number;
  used_slots: number;
  available_slots: number;
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
