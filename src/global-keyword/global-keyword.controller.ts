import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { GlobalKeywordService } from './global-keyword.service';
import type { GlobalKeywordData } from './interfaces/global-keyword.interface';

@Controller('admin/atalhos-navegacao')
export class GlobalKeywordController {
  constructor(private readonly service: GlobalKeywordService) { }

  @Get()
  listar() {
    return this.service.listar();
  }

  @Post()
  criar(@Body() body: GlobalKeywordData) {
    return this.service.criar(body);
  }

  @Put(':id')
  atualizar(@Param('id') id: string, @Body() body: GlobalKeywordData) {
    return this.service.atualizar(id, body);
  }

  @Patch(':id/ativo')
  atualizarAtivo(@Param('id') id: string, @Body() body: { ativo: boolean }) {
    return this.service.atualizarAtivo(id, body?.ativo !== false);
  }

  @Delete(':id')
  excluir(@Param('id') id: string) {
    return this.service.excluir(id);
  }
}
