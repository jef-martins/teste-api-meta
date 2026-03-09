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
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';

@Controller('auth/usuarios')
@UseGuards(JwtAuthGuard, AdminGuard)
export class UserController {
  constructor(private userService: UserService) {}

  @Get()
  listar() {
    return this.userService.listar();
  }

  @Post()
  criar(@Body() body: { email: string; senha: string; nome?: string; papel?: string }) {
    if (!body.email || !body.senha) {
      throw new BadRequestException('Email e senha são obrigatórios');
    }
    return this.userService.criar(body.email, body.senha, body.nome, body.papel);
  }

  @Put(':id')
  atualizar(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.userService.atualizar(id, body);
  }

  @Delete(':id')
  excluir(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.userService.excluir(id, req.user.id);
  }
}
