import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const RAW_KEY = process.env.ENCRYPTION_KEY ?? 'robo-auto-bullex-dev-key-change-in-env';
const KEY     = scryptSync(RAW_KEY, 'ct-salt-v1', 32);

export function encrypt(plaintext: string): string {
  const iv      = randomBytes(16);
  const cipher  = createCipheriv('aes-256-cbc', KEY, iv);
  const enc     = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${enc.toString('hex')}`;
}

export function decrypt(ciphertext: string): string {
  const [ivHex, encHex] = ciphertext.split(':');
  const iv  = Buffer.from(ivHex, 'hex');
  const enc = Buffer.from(encHex, 'hex');
  const dec = createDecipheriv('aes-256-cbc', KEY, iv);
  return Buffer.concat([dec.update(enc), dec.final()]).toString('utf8');
}
