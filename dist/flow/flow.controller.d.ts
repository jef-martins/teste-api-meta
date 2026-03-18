import { FlowService } from './flow.service';
import { OrganizationService } from '../organization/organization.service';
export declare class FlowController {
    private flowService;
    private orgService;
    constructor(flowService: FlowService, orgService: OrganizationService);
    private getSubOrgId;
    listar(headers: Record<string, string>, req: any): Promise<{
        id: string;
        criadoEm: Date;
        nome: string;
        atualizadoEm: Date;
        subOrganizacaoId: string | null;
        ativo: boolean;
        descricao: string | null;
        versao: number;
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
            criadoEm: Date;
            nome: string;
            atualizadoEm: Date;
            subOrganizacaoId: string | null;
            ativo: boolean;
            descricao: string | null;
            versao: number;
            flowJson: import("@prisma/client/runtime/library").JsonValue | null;
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
