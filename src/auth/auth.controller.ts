import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private prisma: PrismaService,
  ) {}

  @Get('setup-status')
  async setupStatus() {
    const count = await this.prisma.botUsuario.count();
    return { needsSetup: count === 0 };
  }

  @Post('login')
  async login(@Body() body: { email: string; senha: string }, @Req() req: any) {
    if (!body.email || !body.senha) {
      throw new BadRequestException('Email e senha são obrigatórios');
    }
    return this.authService.login(body.email, body.senha, req.ip);
  }

  @Post('setup')
  async setup(@Body() body: { email: string; senha: string; nome?: string }) {
    if (!body.email || !body.senha) {
      throw new BadRequestException('Email e senha são obrigatórios');
    }
    return this.authService.setup(body.email, body.senha, body.nome);
  }

  @Post('register')
  async register(
    @Body() body: { email: string; senha: string; nome?: string },
  ) {
    if (!body.email || !body.senha) {
      throw new BadRequestException('Email e senha são obrigatórios');
    }
    return this.authService.register(body.email, body.senha, body.nome);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: any) {
    return this.authService.getMe(req.user.id);
  }
}
