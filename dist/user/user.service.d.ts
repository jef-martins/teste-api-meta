import { PrismaService } from '../prisma/prisma.service';
export declare class UserService {
    private prisma;
    constructor(prisma: PrismaService);
    listar(): Promise<{
        id: number;
        papel: string;
        criadoEm: Date;
        nome: string | null;
        atualizadoEm: Date;
        email: string;
        ativo: boolean;
    }[]>;
    criar(email: string, senha: string, nome?: string, papel?: string): Promise<{
        id: number;
        papel: string;
        criadoEm: Date;
        nome: string | null;
        email: string;
        ativo: boolean;
    }>;
    atualizar(id: number, data: {
        nome?: string;
        email?: string;
        papel?: string;
        ativo?: boolean;
        senha?: string;
    }): Promise<{
        id: number;
        papel: string;
        criadoEm: Date;
        nome: string | null;
        atualizadoEm: Date;
        email: string;
        ativo: boolean;
    }>;
    excluir(id: number, usuarioAtualId: number): Promise<{
        ok: boolean;
    }>;
}
