import { Injectable, UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationService } from '../organization/organization.service';

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class AuthService {
  private failedAttempts = new Map<string, { count: number; lastAttempt: number }>();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private orgService: OrganizationService,
  ) {}

  private checkRateLimit(key: string): void {
    const entry = this.failedAttempts.get(key);
    if (!entry) return;
    const now = Date.now();
    if (now - entry.lastAttempt > WINDOW_MS) {
      this.failedAttempts.delete(key);
      return;
    }
    if (entry.count >= MAX_ATTEMPTS) {
      throw new HttpException(
        { erro: 'Muitas tentativas com senha incorreta. Tente novamente em 15 minutos.' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private recordFailedAttempt(key: string): void {
    const now = Date.now();
    const entry = this.failedAttempts.get(key);
    if (!entry || now - entry.lastAttempt > WINDOW_MS) {
      this.failedAttempts.set(key, { count: 1, lastAttempt: now });
    } else {
      entry.count += 1;
      entry.lastAttempt = now;
    }
  }

  private clearFailedAttempts(key: string): void {
    this.failedAttempts.delete(key);
  }

  async login(email: string, senha: string, ip?: string) {
    const key = ip || email;
    this.checkRateLimit(key);

    const usuario = await this.prisma.botUsuario.findUnique({
      where: { email },
    });
    if (!usuario) throw new UnauthorizedException('Credenciais inválidas');
    if (!usuario.ativo) throw new UnauthorizedException('Usuário inativo');

    const senhaCorreta = await bcrypt.compare(senha, usuario.senhaHash);
    if (!senhaCorreta) {
      this.recordFailedAttempt(key);
      throw new UnauthorizedException('Credenciais inválidas');
    }

    this.clearFailedAttempts(key);
    const token = this.gerarToken(usuario);
    const subOrgsAcessiveis = await this.orgService.getSubOrgsAcessiveis(
      usuario.id,
    );

    return {
      token,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nome: usuario.nome,
        papel: usuario.papel,
        master: usuario.master,
      },
      subOrgsAcessiveis,
    };
  }

  async setup(email: string, senha: string, nome?: string) {
    const count = await this.prisma.botUsuario.count();
    if (count > 0) {
      throw new UnauthorizedException('Setup já realizado. Use login.');
    }

    const senhaHash = await bcrypt.hash(senha, 10);
    const usuario = await this.prisma.botUsuario.create({
      data: { email, senhaHash, nome: nome || 'Admin', papel: 'admin' },
      select: { id: true, email: true, nome: true, papel: true, master: true },
    });

    const token = this.gerarToken(usuario);
    return { token, usuario };
  }

  async register(email: string, senha: string, nome?: string) {
    const senhaHash = await bcrypt.hash(senha, 10);
    const usuario = await this.prisma.botUsuario.create({
      data: { email, senhaHash, nome: nome || 'Admin', papel: 'admin' },
      select: { id: true, email: true, nome: true, papel: true, master: true },
    });

    const token = this.gerarToken(usuario);
    const subOrgsAcessiveis = await this.orgService.getSubOrgsAcessiveis(
      usuario.id,
    );
    return { token, usuario, subOrgsAcessiveis };
  }

  async getMe(userId: string) {
    const usuario = await this.prisma.botUsuario.findUnique({
      where: { id: userId },
      select: { id: true, email: true, nome: true, papel: true, master: true },
    });
    if (!usuario) throw new UnauthorizedException('Usuário não encontrado');
    return usuario;
  }

  gerarToken(usuario: { id: string; email: string; papel: string; master?: boolean }) {
    return this.jwtService.sign({
      id: usuario.id,
      email: usuario.email,
      papel: usuario.papel,
      master: usuario.master ?? false,
    });
  }

  verifyToken(token: string) {
    return this.jwtService.verify(token);
  }
}
