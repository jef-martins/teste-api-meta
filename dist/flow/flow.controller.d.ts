import { FlowService } from './flow.service';
import { OrganizationService } from '../organization/organization.service';
export declare class FlowController {
    private flowService;
    private orgService;
    constructor(flowService: FlowService, orgService: OrganizationService);
    private getSubOrgId;
    listar(headers: Record<string, string>, req: any): Promise<{
        id: string;
        nome: string;
        descricao: string | null;
        versao: number;
        ativo: boolean;
        subOrganizacaoId: string | null;
        criadoEm: Date;
        atualizadoEm: Date;
    }[]>;
    obter(id: string, req: any): Promise<{
        id: string;
        name: string;
        description: string | null;
        version: number;
        ativo: boolean;
    } | {
        nodes: {
            id: any;
            type: any;
            position: any;
            properties: any;
        }[];
        connections: ({
            id: string;
            sourceNodeId: string;
            targetNodeId: string;
            sourcePort: string;
            targetPort: string;
            label: any;
            condition: null;
        } | null)[];
        variables: {
            id: string;
            key: any;
            value: any;
        }[];
        id: string;
        name: string;
        description: string | null;
        version: number;
        ativo: boolean;
    }>;
    criar(body: any, headers: Record<string, string>, req: any): Promise<{
        ok: boolean;
        id: string;
        fluxo: {
            id: string;
            nome: string;
            descricao: string | null;
            versao: number;
            ativo: boolean;
            flowJson: import("@prisma/client/runtime/library").JsonValue | null;
            subOrganizacaoId: string | null;
            criadoEm: Date;
            atualizadoEm: Date;
        };
    }>;
    atualizar(id: string, body: any, req: any): Promise<{
        ok: boolean;
    }>;
    excluir(id: string, req: any): Promise<{
        ok: boolean;
    }>;
    ativar(id: string, req: any): Promise<{
        ok: boolean;
        mensagem: string;
    }>;
}
