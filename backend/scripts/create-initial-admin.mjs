/**
 * Cria o super admin a partir de INITIAL_ADMIN_* no .env (mesma lógica do AuthService).
 * Uso: node scripts/create-initial-admin.mjs  (a partir da pasta backend)
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const email = process.env.INITIAL_ADMIN_EMAIL?.trim();
const password = process.env.INITIAL_ADMIN_PASSWORD;
const name = process.env.INITIAL_ADMIN_NAME?.trim() || 'Super Admin';

if (!email || !password) {
  console.error('Defina INITIAL_ADMIN_EMAIL e INITIAL_ADMIN_PASSWORD no .env');
  process.exit(1);
}

const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
if (adminCount > 0) {
  console.log('Já existe pelo menos um utilizador ADMIN. Nada a fazer.');
  await prisma.$disconnect();
  process.exit(0);
}

const passwordHash = await bcrypt.hash(password, 12);
await prisma.user.create({
  data: { email, passwordHash, name, role: 'ADMIN' },
});
console.log(`Super admin criado: ${email}`);
await prisma.$disconnect();
