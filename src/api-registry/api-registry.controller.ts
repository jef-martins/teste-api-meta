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
  Headers,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiRegistryService } from './api-registry.service';

@Controller('api-registry')
@UseGuards(JwtAuthGuard)
export class ApiRegistryController {
  constructor(private service: ApiRegistryService) {}

  private getSubOrgId(headers: Record<string, string>): string | null {
    const raw = headers['x-suborg-id'];
    return raw || null;
  }

  private getOrgId(headers: Record<string, string>): string | null {
    const raw = headers['x-org-id'];
    return raw || null;
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
    if (!orgId)
      throw new Error('Header X-Org-Id é obrigatório para criar uma API');
    return this.service.criarApi(req.user.id, orgId, body);
  }

  @Put(':id')
  atualizar(
    @Param('id') id: string,
    @Req() req: any,
    @Body() body: { nome?: string; urlBase?: string; headers?: object },
  ) {
    return this.service.atualizarApi(id, req.user.id, body);
  }

  @Delete(':id')
  excluir(@Param('id') id: string, @Req() req: any) {
    return this.service.excluirApi(id, req.user.id);
  }

  // ─── Token por Sub-organização ────────────────────────────────────────────

  @Post(':apiId/token')
  salvarToken(
    @Param('apiId') apiId: string,
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
    @Param('apiId') apiId: string,
    @Headers() headers: Record<string, string>,
    @Req() req: any,
  ) {
    const subOrgId = this.getSubOrgId(headers);
    if (!subOrgId) throw new Error('Header X-SubOrg-Id é obrigatório');
    return this.service.removerTokenSubOrg(apiId, subOrgId, req.user.id);
  }

  // ─── Rotas ────────────────────────────────────────────────────────────────

  @Get(':apiId/rotas')
  listarRotas(@Param('apiId') apiId: string, @Req() req: any) {
    return this.service.listarRotas(apiId, req.user.id);
  }

  @Post(':apiId/rotas')
  criarRota(
    @Param('apiId') apiId: string,
    @Req() req: any,
    @Body()
    body: {
      path: string;
      metodo?: string;
      descricao?: string;
      parametros?: object[];
      bodyTemplate?: object;
    },
  ) {
    return this.service.criarRota(apiId, req.user.id, body);
  }

  @Put(':apiId/rotas/:rotaId')
  atualizarRota(
    @Param('apiId') apiId: string,
    @Param('rotaId') rotaId: string,
    @Req() req: any,
    @Body()
    body: {
      path?: string;
      metodo?: string;
      descricao?: string;
      parametros?: object[];
      bodyTemplate?: object;
    },
  ) {
    return this.service.atualizarRota(rotaId, apiId, req.user.id, body);
  }

  @Delete(':apiId/rotas/:rotaId')
  excluirRota(
    @Param('apiId') apiId: string,
    @Param('rotaId') rotaId: string,
    @Req() req: any,
  ) {
    return this.service.excluirRota(rotaId, apiId, req.user.id);
  }
}
