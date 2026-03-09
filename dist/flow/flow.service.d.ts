import { PrismaService } from '../prisma/prisma.service';
import { FlowConverterService } from './flow-converter.service';
export declare class FlowService {
    private prisma;
    private converter;
    constructor(prisma: PrismaService, converter: FlowConverterService);
    private aplicarPrefixo;
    listar(subOrganizacaoId?: number | null): Promise<{
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
    criar(data: {
        name: string;
        description?: string;
        nodes?: any[];
        connections?: any[];
        variables?: any[];
        subOrganizacaoId?: number | null;
    }): Promise<{
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
    atualizar(id: number, data: {
        name?: string;
        description?: string;
        nodes?: any[];
        connections?: any[];
        variables?: any[];
        version?: number;
    }): Promise<{
        ok: boolean;
    }>;
    excluir(id: number): Promise<{
        ok: boolean;
    }>;
    ativar(id: number): Promise<{
        ok: boolean;
        mensagem: string;
    }>;
    private limparEstados;
    private salvarEstados;
    private salvarTransicoes;
    private salvarVariaveis;
}
