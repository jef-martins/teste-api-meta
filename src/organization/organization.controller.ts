import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RequestWithUser } from '../auth/interfaces/request-with-user.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrganizationService } from './organization.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class OrganizationController {
  constructor(private orgService: OrganizationService) {}

  // ─── Sub-orgs acessíveis pelo usuário ────────────────────────────────────

  @Get('minhas-sub-orgs')
  minhasSubOrgs(@Req() req: RequestWithUser) {
    return this.orgService.getSubOrgsAcessiveis(req.user.id, req.user.master);
  }

  // ─── Organizações ─────────────────────────────────────────────────────────

  @Get('organizacoes')
  listar(@Req() req: RequestWithUser) {
    return this.orgService.listarOrganizacoes(
      req.user.id,
      req.user.master,
      req.user.papel,
    );
  }

  @Post('organizacoes')
  criar(
    @Req() req: RequestWithUser,
    @Body() body: { nome: string; slug?: string },
  ) {
    return this.orgService.criarOrganizacao(req.user.id, body);
  }

  @Get('organizacoes/:orgId')
  obter(@Param('orgId') orgId: string, @Req() req: RequestWithUser) {
    return this.orgService.obterOrganizacao(
      orgId,
      req.user.id,
      req.user.master,
    );
  }

  @Put('organizacoes/:orgId')
  atualizar(
    @Param('orgId') orgId: string,
    @Req() req: RequestWithUser,
    @Body() body: { nome?: string },
  ) {
    return this.orgService.atualizarOrganizacao(
      orgId,
      req.user.id,
      body,
      req.user.master,
    );
  }

  @Delete('organizacoes/:orgId')
  excluir(@Param('orgId') orgId: string, @Req() req: RequestWithUser) {
    return this.orgService.excluirOrganizacao(
      orgId,
      req.user.id,
      req.user.master,
    );
  }

  // ─── Membros da organização ───────────────────────────────────────────────

  @Get('organizacoes/:orgId/membros')
  listarMembros(@Param('orgId') orgId: string, @Req() req: RequestWithUser) {
    return this.orgService.listarMembros(orgId, req.user.id, req.user.master);
  }

  @Post('organizacoes/:orgId/membros')
  adicionarMembro(
    @Param('orgId') orgId: string,
    @Req() req: RequestWithUser,
    @Body() body: { email: string; papel?: string },
  ) {
    return this.orgService.adicionarMembro(
      orgId,
      req.user.id,
      body.email,
      body.papel,
      req.user.master,
    );
  }

  @Delete('organizacoes/:orgId/membros/:membroId')
  removerMembro(
    @Param('orgId') orgId: string,
    @Param('membroId') membroId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.orgService.removerMembro(
      orgId,
      req.user.id,
      membroId,
      req.user.master,
    );
  }

  // ─── Sub-organizações ─────────────────────────────────────────────────────

  @Get('organizacoes/:orgId/sub-orgs')
  listarSubOrgs(@Param('orgId') orgId: string, @Req() req: RequestWithUser) {
    return this.orgService.listarSubOrgs(orgId, req.user.id, req.user.master);
  }

  @Post('organizacoes/:orgId/sub-orgs')
  criarSubOrg(
    @Param('orgId') orgId: string,
    @Req() req: RequestWithUser,
    @Body() body: { nome: string; slug?: string },
  ) {
    return this.orgService.criarSubOrg(
      orgId,
      req.user.id,
      body,
      req.user.master,
    );
  }

  @Put('organizacoes/:orgId/sub-orgs/:subOrgId')
  atualizarSubOrg(
    @Param('orgId') orgId: string,
    @Param('subOrgId') subOrgId: string,
    @Req() req: RequestWithUser,
    @Body() body: { nome?: string },
  ) {
    return this.orgService.atualizarSubOrg(
      orgId,
      subOrgId,
      req.user.id,
      body,
      req.user.master,
    );
  }

  @Delete('organizacoes/:orgId/sub-orgs/:subOrgId')
  excluirSubOrg(
    @Param('orgId') orgId: string,
    @Param('subOrgId') subOrgId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.orgService.excluirSubOrg(
      orgId,
      subOrgId,
      req.user.id,
      req.user.master,
    );
  }

  @Post('organizacoes/:orgId/sub-orgs/:subOrgId/transferir')
  transferirSubOrg(
    @Param('subOrgId') subOrgId: string,
    @Req() req: RequestWithUser,
    @Body() body: { novaOrgId: string },
  ) {
    return this.orgService.transferirSubOrg(
      subOrgId,
      body.novaOrgId,
      req.user.id,
      req.user.master,
    );
  }

  // ─── Membros da sub-organização ───────────────────────────────────────────

  @Post('organizacoes/:orgId/sub-orgs/:subOrgId/membros')
  adicionarMembroSubOrg(
    @Param('orgId') orgId: string,
    @Param('subOrgId') subOrgId: string,
    @Req() req: RequestWithUser,
    @Body() body: { email: string; papel?: string },
  ) {
    return this.orgService.adicionarMembroSubOrg(
      orgId,
      subOrgId,
      req.user.id,
      body.email,
      body.papel,
      req.user.master,
    );
  }

  @Delete('organizacoes/:orgId/sub-orgs/:subOrgId/membros/:membroId')
  removerMembroSubOrg(
    @Param('orgId') orgId: string,
    @Param('subOrgId') subOrgId: string,
    @Param('membroId') membroId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.orgService.removerMembroSubOrg(
      orgId,
      subOrgId,
      req.user.id,
      membroId,
      req.user.master,
    );
  }

  @Get('organizacoes/:orgId/sub-orgs/:subOrgId/membros')
  listarMembrosSubOrg(
    @Param('orgId') orgId: string,
    @Param('subOrgId') subOrgId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.orgService.listarMembrosSubOrg(
      orgId,
      subOrgId,
      req.user.id,
      req.user.master,
    );
  }

  @Post('organizacoes/:orgId/convites')
  criarConviteOrg(
    @Param('orgId') orgId: string,
    @Body() body: { email: string; papel?: string },
    @Req() req: RequestWithUser,
  ) {
    return this.orgService.criarConviteOrg(
      orgId,
      req.user.id,
      body.email,
      body.papel,
      req.user.master,
    );
  }

  @Post('organizacoes/:orgId/sub-orgs/:subOrgId/convites')
  criarConviteSubOrg(
    @Param('orgId') orgId: string,
    @Param('subOrgId') subOrgId: string,
    @Body() body: { email: string; papel?: string },
    @Req() req: RequestWithUser,
  ) {
    return this.orgService.criarConviteSubOrg(
      orgId,
      subOrgId,
      req.user.id,
      body.email,
      body.papel,
      req.user.master,
    );
  }

  @Get('convites/meus')
  listarMeusConvites(@Req() req: RequestWithUser) {
    return this.orgService.listarMeusConvites(req.user.id);
  }

  @Patch('convites/:id/aceitar')
  aceitarConvite(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.orgService.aceitarConvite(id, req.user.id);
  }

  @Patch('convites/:id/rejeitar')
  rejeitarConvite(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.orgService.rejeitarConvite(id, req.user.id);
  }
}
