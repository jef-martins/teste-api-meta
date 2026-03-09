import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
  Req,
  Headers,
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

  private getSubOrgId(headers: Record<string, string>): number | null {
    const raw = headers['x-suborg-id'];
    const parsed = raw ? parseInt(raw) : NaN;
    return isNaN(parsed) ? null : parsed;
  }

  @Get()
  listar(@Headers() headers: Record<string, string>) {
    const subOrgId = this.getSubOrgId(headers);
    return this.flowService.listar(subOrgId);
  }

  @Get(':id')
  obter(@Param('id', ParseIntPipe) id: number) {
    return this.flowService.obter(id);
  }

  @Post()
  async criar(@Body() body: any, @Headers() headers: Record<string, string>, @Req() req: any) {
    const subOrgId = this.getSubOrgId(headers);
    // Se subOrgId informado, verificar acesso
    if (subOrgId) {
      const temAcesso = await this.orgService.verificarAcessoSubOrg(req.user.id, subOrgId);
      if (!temAcesso) {
        throw new Error('Sem acesso a esta sub-organização');
      }
    }
    return this.flowService.criar({ ...body, subOrganizacaoId: subOrgId });
  }

  @Put(':id')
  atualizar(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.flowService.atualizar(id, body);
  }

  @Delete(':id')
  excluir(@Param('id', ParseIntPipe) id: number) {
    return this.flowService.excluir(id);
  }

  @Post(':id/ativar')
  ativar(@Param('id', ParseIntPipe) id: number) {
    return this.flowService.ativar(id);
  }
}
