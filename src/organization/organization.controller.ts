import {
  Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrganizationService } from './organization.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class OrganizationController {
  constructor(private orgService: OrganizationService) {}

  // ─── Sub-orgs acessíveis pelo usuário ────────────────────────────────────

  @Get('minhas-sub-orgs')
  minhasSubOrgs(@Req() req: any) {
    return this.orgService.getSubOrgsAcessiveis(req.user.id);
  }

  // ─── Organizações ─────────────────────────────────────────────────────────

  @Get('organizacoes')
  listar(@Req() req: any) {
    return this.orgService.listarOrganizacoes(req.user.id);
  }

  @Post('organizacoes')
  criar(@Req() req: any, @Body() body: { nome: string; slug?: string }) {
    return this.orgService.criarOrganizacao(req.user.id, body);
  }

  @Get('organizacoes/:orgId')
  obter(@Param('orgId', ParseIntPipe) orgId: number, @Req() req: any) {
    return this.orgService.obterOrganizacao(orgId, req.user.id);
  }

  @Put('organizacoes/:orgId')
  atualizar(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Req() req: any,
    @Body() body: { nome?: string },
  ) {
    return this.orgService.atualizarOrganizacao(orgId, req.user.id, body);
  }

  @Delete('organizacoes/:orgId')
  excluir(@Param('orgId', ParseIntPipe) orgId: number, @Req() req: any) {
    return this.orgService.excluirOrganizacao(orgId, req.user.id);
  }

  // ─── Membros da organização ───────────────────────────────────────────────

  @Get('organizacoes/:orgId/membros')
  listarMembros(@Param('orgId', ParseIntPipe) orgId: number, @Req() req: any) {
    return this.orgService.listarMembros(orgId, req.user.id);
  }

  @Post('organizacoes/:orgId/membros')
  adicionarMembro(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Req() req: any,
    @Body() body: { email: string; papel?: string },
  ) {
    return this.orgService.adicionarMembro(orgId, req.user.id, body.email, body.papel);
  }

  @Delete('organizacoes/:orgId/membros/:membroId')
  removerMembro(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Param('membroId', ParseIntPipe) membroId: number,
    @Req() req: any,
  ) {
    return this.orgService.removerMembro(orgId, req.user.id, membroId);
  }

  // ─── Sub-organizações ─────────────────────────────────────────────────────

  @Get('organizacoes/:orgId/sub-orgs')
  listarSubOrgs(@Param('orgId', ParseIntPipe) orgId: number, @Req() req: any) {
    return this.orgService.listarSubOrgs(orgId, req.user.id);
  }

  @Post('organizacoes/:orgId/sub-orgs')
  criarSubOrg(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Req() req: any,
    @Body() body: { nome: string; slug?: string },
  ) {
    return this.orgService.criarSubOrg(orgId, req.user.id, body);
  }

  @Put('organizacoes/:orgId/sub-orgs/:subOrgId')
  atualizarSubOrg(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Param('subOrgId', ParseIntPipe) subOrgId: number,
    @Req() req: any,
    @Body() body: { nome?: string },
  ) {
    return this.orgService.atualizarSubOrg(orgId, subOrgId, req.user.id, body);
  }

  @Delete('organizacoes/:orgId/sub-orgs/:subOrgId')
  excluirSubOrg(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Param('subOrgId', ParseIntPipe) subOrgId: number,
    @Req() req: any,
  ) {
    return this.orgService.excluirSubOrg(orgId, subOrgId, req.user.id);
  }

  @Post('organizacoes/:orgId/sub-orgs/:subOrgId/transferir')
  transferirSubOrg(
    @Param('subOrgId', ParseIntPipe) subOrgId: number,
    @Req() req: any,
    @Body() body: { novaOrgId: number },
  ) {
    return this.orgService.transferirSubOrg(subOrgId, body.novaOrgId, req.user.id);
  }

  // ─── Membros da sub-organização ───────────────────────────────────────────

  @Post('organizacoes/:orgId/sub-orgs/:subOrgId/membros')
  adicionarMembroSubOrg(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Param('subOrgId', ParseIntPipe) subOrgId: number,
    @Req() req: any,
    @Body() body: { email: string; papel?: string },
  ) {
    return this.orgService.adicionarMembroSubOrg(orgId, subOrgId, req.user.id, body.email, body.papel);
  }

  @Delete('organizacoes/:orgId/sub-orgs/:subOrgId/membros/:membroId')
  removerMembroSubOrg(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Param('subOrgId', ParseIntPipe) subOrgId: number,
    @Param('membroId', ParseIntPipe) membroId: number,
    @Req() req: any,
  ) {
    return this.orgService.removerMembroSubOrg(orgId, subOrgId, req.user.id, membroId);
  }
}
