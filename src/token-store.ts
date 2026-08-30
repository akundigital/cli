import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export type TokenSet = {
  accessToken: string;
  idToken?: string;
  refreshToken: string;
  issuedAt: string;
  expiresAt: string;
  clientId?: string;
};

export type TokenStore = {
  load: () => Promise<TokenSet | undefined>;
  save: (tokens: TokenSet) => Promise<void>;
};

const tokenDirectory = join(homedir(), ".config", "akundigital");
const tokenPath = join(tokenDirectory, "tokens.json");

export const createTokenStore = (path = tokenPath): TokenStore => ({
  async load() {
    try {
      const content = await readFile(path, "utf8");
      return JSON.parse(content) as TokenSet;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return undefined;
      }
      throw error;
    }
  },

  async save(tokens) {
    const directory = join(path, "..");
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const temporaryPath = `${path}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(tokens, null, 2)}\n`, { mode: 0o600 });
    await rename(temporaryPath, path);
  },
});

export const isTokenExpired = (tokens: TokenSet, now = Date.now()): boolean =>
  new Date(tokens.expiresAt).getTime() <= now;

const decodeJwtClientId = (jwt: string): string | undefined => {
  try {
    const payload = jwt.split(".")[1];
    const decoded = Buffer.from(payload, "base64").toString("utf8");
    return (JSON.parse(decoded) as { client_id?: string }).client_id;
  } catch {
    return undefined;
  }
};

export const createTokenSet = (
  result: { AccessToken: string; IdToken?: string; RefreshToken?: string; ExpiresIn?: number },
  refreshToken: string | undefined,
  now = new Date(),
): TokenSet => ({
  accessToken: result.AccessToken,
  idToken: result.IdToken,
  refreshToken: result.RefreshToken ?? refreshToken ?? "",
  issuedAt: now.toISOString(),
  expiresAt: new Date(now.getTime() + (result.ExpiresIn ?? 3600) * 1000).toISOString(),
  clientId: decodeJwtClientId(result.AccessToken),
});
