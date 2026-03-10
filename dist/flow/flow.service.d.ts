import { PrismaService } from '../prisma/prisma.service';
import { FlowConverterService } from './flow-converter.service';
import { OrganizationService } from '../organization/organization.service';
export declare class FlowService {
    private prisma;
    private converter;
    private orgService;
    constructor(prisma: PrismaService, converter: FlowConverterService, orgService: OrganizationService);
    private aplicarPrefixo;
    private verificarAcessoFluxo;
    listar(subOrganizacaoId: string | null, usuarioId: string): Promise<{
        id: string;
        criadoEm: Date;
        nome: string;
        atualizadoEm: Date;
        subOrganizacaoId: string | null;
        ativo: boolean;
        descricao: string | null;
        versao: number;
    }[]>;
    obter(id: string, usuarioId: string): Promise<{
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
    criar(data: {
        name: string;
        description?: string;
        nodes?: any[];
        connections?: any[];
        variables?: any[];
        subOrganizacaoId?: string | null;
    }): Promise<{
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
    atualizar(id: string, data: {
        name?: string;
        description?: string;
        nodes?: any[];
        connections?: any[];
        variables?: any[];
        version?: number;
    }, usuarioId: string): Promise<{
        ok: boolean;
    }>;
    excluir(id: string, usuarioId: string): Promise<{
        ok: boolean;
    }>;
    ativar(id: string, usuarioId: string): Promise<{
        ok: boolean;
        mensagem: string;
    }>;
    private limparEstados;
    private salvarEstados;
    private salvarTransicoes;
    private salvarVariaveis;
}
