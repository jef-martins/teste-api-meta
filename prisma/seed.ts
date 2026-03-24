import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const masterEmail = 'master@telecontrol.com.br';
  const existing = await prisma.botUsuario.findUnique({ where: { email: masterEmail } });

  if (!existing) {
    const senhaHash = await bcrypt.hash('Tele@#6588', 10);
    await prisma.botUsuario.create({
      data: {
        email: masterEmail,
        senhaHash,
        nome: 'Master',
        papel: 'admin',
        master: true,
        ativo: true,
      },
    });
    console.log('✅ Usuário master criado: master@telecontrol.com.br');
  } else {
    console.log('ℹ️  Usuário master já existe.');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
