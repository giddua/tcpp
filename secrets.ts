import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

export const SECRETS_FILE = path.join(process.cwd(), 'secrets.json');

// Pre-load secrets from secrets.json into process.env if they exist
let storedSecrets: Record<string, any> = {};
if (fs.existsSync(SECRETS_FILE)) {
  try {
    storedSecrets = JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf8'));
  } catch (e) {
    console.error('Failed to pre-load secrets.json into process.env on startup:', e);
  }
}

for (const [key, val] of Object.entries(storedSecrets)) {
  if (val !== undefined && val !== null) {
    process.env[key] = String(val);
  }
}

// Helper to get secrets (merging env and stored secrets)
export function getSecrets(): any {
  let storedSecrets = {};
  if (fs.existsSync(SECRETS_FILE)) {
    try {
      storedSecrets = JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf8'));
    } catch (e) {
      console.error('Failed to read secrets file:', e);
    }
  }
  return {  ...process.env, ...storedSecrets };
}

// Helper function to get the current JWT secret phrase from secrets.json or process.env
export function getJwtSecret(): string {
  const secrets = getSecrets();
  return (secrets.JWT_PHRASE || process.env.JWT_PHRASE).trim();
}
