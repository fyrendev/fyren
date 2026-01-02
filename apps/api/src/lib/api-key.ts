const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const KEY_LENGTH = 32;
const PREFIX = "fyr_";

function generateRandomString(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((byte) => CHARSET[byte % CHARSET.length])
    .join("");
}

export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyApiKey(key: string, hash: string): Promise<boolean> {
  const keyHash = await hashApiKey(key);
  return keyHash === hash;
}

export async function generateApiKey(): Promise<{
  key: string;
  keyHash: string;
  keyPrefix: string;
}> {
  const randomPart = generateRandomString(KEY_LENGTH);
  const key = `${PREFIX}${randomPart}`;
  const keyHash = await hashApiKey(key);
  const keyPrefix = key.slice(0, 12); // "fyr_" + first 8 chars

  return {
    key,
    keyHash,
    keyPrefix,
  };
}

export function extractKeyPrefix(key: string): string {
  return key.slice(0, 12);
}

export function isValidApiKeyFormat(key: string): boolean {
  return key.startsWith(PREFIX) && key.length === PREFIX.length + KEY_LENGTH;
}
