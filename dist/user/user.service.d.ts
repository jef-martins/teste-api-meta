import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserData } from './interfaces/update-user.interface';
export declare class UserService {
    private prisma;
    constructor(prisma: PrismaService);
    listar(): Promise<{
        id: string;
        papel: string;
        criadoEm: Date;
        nome: string | null;
        atualizadoEm: Date;
        email: string;
        ativo: boolean;
    }[]>;
    criar(email: string, senha: string, nome?: string, papel?: string): Promise<{
        id: string;
        papel: string;
        criadoEm: Date;
        nome: string | null;
        email: string;
        ativo: boolean;
    }>;
    atualizar(id: string, data: UpdateUserData): Promise<any>;
    excluir(id: string, usuarioAtualId: string): Promise<{
        ok: boolean;
    }>;
}
