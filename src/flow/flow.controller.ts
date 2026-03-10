import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  Headers,
  ForbiddenException,
} from '@nestjs/common';
import { FlowService } from './flow.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrganizationService } from '../organization/organization.service';

@Controller('fluxos')
@UseGuards(JwtAuthGuard)
export class FlowController {
  constructor(
    private flowService: FlowService,
    private orgService: OrganizationService,
  ) {}

  private getSubOrgId(headers: Record<string, string>): string | null {
    const raw = headers['x-suborg-id'];
    return raw || null;
  }

  @Get()
  listar(@Headers() headers: Record<string, string>, @Req() req: any) {
    const subOrgId = this.getSubOrgId(headers);
    return this.flowService.listar(subOrgId, req.user.id);
  }

  @Get(':id')
  obter(@Param('id') id: string, @Req() req: any) {
    return this.flowService.obter(id, req.user.id);
  }

  @Post()
  async criar(
    @Body() body: any,
    @Headers() headers: Record<string, string>,
    @Req() req: any,
  ) {
    const subOrgId = this.getSubOrgId(headers);
    // Se subOrgId informado, verificar acesso
    if (subOrgId) {
      const temAcesso = await this.orgService.verificarAcessoSubOrg(
        req.user.id,
        subOrgId,
      );
      if (!temAcesso) {
        throw new ForbiddenException('Sem acesso a esta sub-organização');
      }
    }
    return this.flowService.criar({ ...body, subOrganizacaoId: subOrgId });
  }

  @Put(':id')
  atualizar(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.flowService.atualizar(id, body, req.user.id);
  }

  @Delete(':id')
  excluir(@Param('id') id: string, @Req() req: any) {
    return this.flowService.excluir(id, req.user.id);
  }

  @Post(':id/ativar')
  ativar(@Param('id') id: string, @Req() req: any) {
    return this.flowService.ativar(id, req.user.id);
  }
}
