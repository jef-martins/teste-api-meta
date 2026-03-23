import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { GlobalKeywordService } from './global-keyword.service';

@Controller('admin/keywords-globais')
export class GlobalKeywordController {
  constructor(private readonly service: GlobalKeywordService) {}

  @Get()
  listar() {
    return this.service.listar();
  }

  @Post()
  criar(@Body() body: any) {
    return this.service.criar(body);
  }

  @Put(':id')
  atualizar(@Param('id') id: string, @Body() body: any) {
    return this.service.atualizar(id, body);
  }

  @Patch(':id/ativo')
  atualizarAtivo(@Param('id') id: string, @Body() body: any) {
    return this.service.atualizarAtivo(id, body?.ativo !== false);
  }

  @Delete(':id')
  excluir(@Param('id') id: string) {
    return this.service.excluir(id);
  }
}
