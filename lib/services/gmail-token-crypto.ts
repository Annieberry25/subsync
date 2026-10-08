/**
 * AES-256-GCM encryption for Gmail OAuth tokens at rest.
 *
 * Server-only. The `gmail_connections.credentials` column stores the user's
 * Google refresh token; encrypting it keeps the account grant unreadable if the
 * database or a service-role client is ever leaked.
 *
 * ## Blob format
 *
 * `v1:<iv>:<authTag>:<ciphertext>` — all three base64url-encoded. Nonce is 12
 * bytes (the GCM standard default), the auth tag 16 bytes, and the key is the
 * SHA-256 of `GMAIL_TOKEN_ENCRYPTION_KEY` so any sufficiently long secret works
 * without projecting key-length constraints onto the env var.
 *
 * ## Degraded mode
 *
 * No `GMAIL_TOKEN_ENCRYPTION_KEY` configured -> plaintext storage, matching the
 * pre-encryption behaviour, so an existing deployment keeps working until the
 * key is set. A console warning is emitted once. Once the key is present, new
 * writes are encrypted and legacy plaintext rows are re-encrypted on their next
 * read (`getAuthedGmailClient`).
 */

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

const BLOB_VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const MIN_KEY_LENGTH = 16;

let warnedAboutMissingKey = false;

/** Fields we are willing to persist. The access_token itself is never stored. */
export interface StoredGmailCredentials {
  refresh_token?: string;
  scope?: string;
  token_type?: string;
}

export function isGmailTokenEncryptionConfigured(): boolean {
  const secret = process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
  return Boolean(secret && secret.trim().length >= MIN_KEY_LENGTH);
}

function getKey(): Buffer {
  const secret = process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
  if (!secret || secret.trim().length < MIN_KEY_LENGTH) {
    throw new Error('GMAIL_TOKEN_ENCRYPTION_KEY is not configured.');
  }
  return createHash('sha256').update(secret.trim()).digest();
}

export function warnMissingEncryptionKey(): void {
  if (warnedAboutMissingKey) return;
  warnedAboutMissingKey = true;
  console.warn(
    '[gmail-token-crypto] GMAIL_TOKEN_ENCRYPTION_KEY is not set; Gmail credentials will be stored in plaintext. Set it to encrypt tokens at rest.'
  );
}

function isValidBlob(value: string): boolean {
  if (!value.startsWith(`${BLOB_VERSION}:`)) return false;
  const parts = value.slice(BLOB_VERSION.length + 1).split(':');
  return parts.length === 3 && parts.every((p) => p.length > 0);
}

export function encryptGmailCredentials(credentials: StoredGmailCredentials): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const plaintext = Buffer.from(JSON.stringify(credentials), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    BLOB_VERSION,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':');
}

export function decryptGmailCredentials(blob: string): StoredGmailCredentials {
  if (!isValidBlob(blob)) {
    throw new Error('Stored Gmail credentials are malformed.');
  }
  const [, ivB64, tagB64, dataB64] = blob.split(':');
  const key = getKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64url')),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString('utf8')) as StoredGmailCredentials;
}

export function looksEncrypted(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(`${BLOB_VERSION}:`);
}