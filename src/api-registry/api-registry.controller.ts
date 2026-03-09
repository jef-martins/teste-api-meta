import {
  Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe, Req, UseGuards, Headers,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiRegistryService } from './api-registry.service';

@Controller('api-registry')
@UseGuards(JwtAuthGuard)
export class ApiRegistryController {
  constructor(private service: ApiRegistryService) {}

  private getSubOrgId(headers: Record<string, string>): number | null {
    const raw = headers['x-suborg-id'];
    const parsed = raw ? parseInt(raw) : NaN;
    return isNaN(parsed) ? null : parsed;
  }

  private getOrgId(headers: Record<string, string>): number | null {
    const raw = headers['x-org-id'];
    const parsed = raw ? parseInt(raw) : NaN;
    return isNaN(parsed) ? null : parsed;
  }

  // ─── APIs ─────────────────────────────────────────────────────────────────

  @Get()
  listar(@Req() req: any, @Headers() headers: Record<string, string>) {
    const subOrgId = this.getSubOrgId(headers);
    return this.service.listarApis(req.user.id, subOrgId);
  }

  @Post()
  criar(
    @Req() req: any,
    @Headers() headers: Record<string, string>,
    @Body() body: { nome: string; urlBase: string; headers?: object },
  ) {
    const orgId = this.getOrgId(headers);
    if (!orgId) throw new Error('Header X-Org-Id é obrigatório para criar uma API');
    return this.service.criarApi(req.user.id, orgId, body);
  }

  @Put(':id')
  atualizar(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Body() body: { nome?: string; urlBase?: string; headers?: object },
  ) {
    return this.service.atualizarApi(id, req.user.id, body);
  }

  @Delete(':id')
  excluir(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.excluirApi(id, req.user.id);
  }

  // ─── Token por Sub-organização ────────────────────────────────────────────

  @Post(':apiId/token')
  salvarToken(
    @Param('apiId', ParseIntPipe) apiId: number,
    @Headers() headers: Record<string, string>,
    @Req() req: any,
    @Body() body: { token: string; headers?: object },
  ) {
    const subOrgId = this.getSubOrgId(headers);
    if (!subOrgId) throw new Error('Header X-SubOrg-Id é obrigatório');
    return this.service.salvarTokenSubOrg(apiId, subOrgId, req.user.id, body);
  }

  @Delete(':apiId/token')
  removerToken(
    @Param('apiId', ParseIntPipe) apiId: number,
    @Headers() headers: Record<string, string>,
    @Req() req: any,
  ) {
    const subOrgId = this.getSubOrgId(headers);
    if (!subOrgId) throw new Error('Header X-SubOrg-Id é obrigatório');
    return this.service.removerTokenSubOrg(apiId, subOrgId, req.user.id);
  }

  // ─── Rotas ────────────────────────────────────────────────────────────────

  @Get(':apiId/rotas')
  listarRotas(@Param('apiId', ParseIntPipe) apiId: number, @Req() req: any) {
    return this.service.listarRotas(apiId, req.user.id);
  }

  @Post(':apiId/rotas')
  criarRota(
    @Param('apiId', ParseIntPipe) apiId: number,
    @Req() req: any,
    @Body() body: { path: string; metodo?: string; descricao?: string; parametros?: object[]; bodyTemplate?: object },
  ) {
    return this.service.criarRota(apiId, req.user.id, body);
  }

  @Put(':apiId/rotas/:rotaId')
  atualizarRota(
    @Param('apiId', ParseIntPipe) apiId: number,
    @Param('rotaId', ParseIntPipe) rotaId: number,
    @Req() req: any,
    @Body() body: { path?: string; metodo?: string; descricao?: string; parametros?: object[]; bodyTemplate?: object },
  ) {
    return this.service.atualizarRota(rotaId, apiId, req.user.id, body);
  }

  @Delete(':apiId/rotas/:rotaId')
  excluirRota(
    @Param('apiId', ParseIntPipe) apiId: number,
    @Param('rotaId', ParseIntPipe) rotaId: number,
    @Req() req: any,
  ) {
    return this.service.excluirRota(rotaId, apiId, req.user.id);
  }
}
