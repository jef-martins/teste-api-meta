import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MasterGuard } from '../auth/master.guard';
import type { RequestWithUser } from '../auth/interfaces/request-with-user.interface';
import type { UpdateUserData } from './interfaces/update-user.interface';

@Controller('auth/usuarios')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private userService: UserService) {}

  @Get()
  listar(@Req() req: RequestWithUser) {
    if (req.user.master) {
      return this.userService.listar();
    }
    if (req.user.papel === 'admin') {
      return this.userService.listarPorAdmin(req.user.id);
    }
    throw new ForbiddenException('Sem acesso');
  }

  @Post()
  criar(
    @Body()
    body: {
      email: string;
      senha: string;
      nome?: string;
      papel?: string;
      organizacaoId?: string;
      subOrganizacaoId?: string;
    },
    @Req() req: RequestWithUser,
  ) {
    if (!req.user.master && req.user.papel !== 'admin') {
      throw new ForbiddenException('Sem permissão para criar usuários');
    }
    if (!body.email || !body.senha) {
      throw new BadRequestException('Email e senha são obrigatórios');
    }

    const papel = req.user.master ? body.papel || 'user' : 'user';

    if (!req.user.master && !body.subOrganizacaoId) {
      throw new BadRequestException(
        'Sub-organização é obrigatória ao criar usuário comum',
      );
    }
    if (req.user.master && papel === 'admin' && !body.organizacaoId) {
      throw new BadRequestException(
        'Organização é obrigatória ao criar usuário admin',
      );
    }

    return this.userService.criar(
      body.email,
      body.senha,
      body.nome,
      papel,
      body.organizacaoId,
      body.subOrganizacaoId,
      req.user.id,
    );
  }

  @Put(':id')
  @UseGuards(MasterGuard)
  atualizar(@Param('id') id: string, @Body() body: UpdateUserData) {
    return this.userService.atualizar(id, body);
  }

  @Delete(':id')
  @UseGuards(MasterGuard)
  excluir(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.userService.excluir(id, req.user.id);
  }
}
