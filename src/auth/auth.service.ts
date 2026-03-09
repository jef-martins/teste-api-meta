import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationService } from '../organization/organization.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private orgService: OrganizationService,
  ) {}

  async login(email: string, senha: string) {
    const usuario = await this.prisma.botUsuario.findUnique({ where: { email } });
    if (!usuario) throw new UnauthorizedException('Credenciais inválidas');
    if (!usuario.ativo) throw new UnauthorizedException('Usuário inativo');

    const senhaCorreta = await bcrypt.compare(senha, usuario.senhaHash);
    if (!senhaCorreta) throw new UnauthorizedException('Credenciais inválidas');

    const token = this.gerarToken(usuario);
    const subOrgsAcessiveis = await this.orgService.getSubOrgsAcessiveis(usuario.id);

    return {
      token,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nome: usuario.nome,
        papel: usuario.papel,
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
      select: { id: true, email: true, nome: true, papel: true },
    });

    const token = this.gerarToken(usuario);
    return { token, usuario };
  }

  async register(email: string, senha: string, nome?: string) {
    const senhaHash = await bcrypt.hash(senha, 10);
    const usuario = await this.prisma.botUsuario.create({
      data: { email, senhaHash, nome: nome || 'Admin', papel: 'admin' },
      select: { id: true, email: true, nome: true, papel: true },
    });

    const token = this.gerarToken(usuario);
    const subOrgsAcessiveis = await this.orgService.getSubOrgsAcessiveis(usuario.id);
    return { token, usuario, subOrgsAcessiveis };
  }

  async getMe(userId: number) {
    const usuario = await this.prisma.botUsuario.findUnique({
      where: { id: userId },
      select: { id: true, email: true, nome: true, papel: true },
    });
    if (!usuario) throw new UnauthorizedException('Usuário não encontrado');
    return usuario;
  }

  gerarToken(usuario: { id: number; email: string; papel: string }) {
    return this.jwtService.sign({
      id: usuario.id,
      email: usuario.email,
      papel: usuario.papel,
    });
  }

  verifyToken(token: string) {
    return this.jwtService.verify(token);
  }
}
