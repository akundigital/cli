export const apiBaseUrl = "https://6cr9nj44pd.execute-api.ap-southeast-3.amazonaws.com";
export const defaultClientId = "6vcd500elmtpkiks9qp83vs8fh";

export type FetchLike = typeof fetch;

export type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
};

export const withQueryParam = (endpoint: string, name: string, value?: string): string =>
  value ? `${endpoint}?${name}=${encodeURIComponent(value)}` : endpoint;

export const withStatus = (endpoint: string, status?: string): string =>
  withQueryParam(endpoint, "status", status);
