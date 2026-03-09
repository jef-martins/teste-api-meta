import { FlowService } from './flow.service';
import { OrganizationService } from '../organization/organization.service';
export declare class FlowController {
    private flowService;
    private orgService;
    constructor(flowService: FlowService, orgService: OrganizationService);
    private getSubOrgId;
    listar(headers: Record<string, string>): Promise<{
        id: number;
        criadoEm: Date;
        nome: string;
        atualizadoEm: Date;
        subOrganizacaoId: number | null;
        ativo: boolean;
        descricao: string | null;
        versao: number;
    }[]>;
    obter(id: number): Promise<{
        id: number;
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
        id: number;
        name: string;
        description: string | null;
        version: number;
        ativo: boolean;
    }>;
    criar(body: any, headers: Record<string, string>, req: any): Promise<{
        ok: boolean;
        id: number;
        fluxo: {
            id: number;
            criadoEm: Date;
            nome: string;
            atualizadoEm: Date;
            subOrganizacaoId: number | null;
            ativo: boolean;
            descricao: string | null;
            versao: number;
            flowJson: import("@prisma/client/runtime/library").JsonValue | null;
        };
    }>;
    atualizar(id: number, body: any): Promise<{
        ok: boolean;
    }>;
    excluir(id: number): Promise<{
        ok: boolean;
    }>;
    ativar(id: number): Promise<{
        ok: boolean;
        mensagem: string;
    }>;
}
