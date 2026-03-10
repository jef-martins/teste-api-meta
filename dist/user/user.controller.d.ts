import { UserService } from './user.service';
export declare class UserController {
    private userService;
    constructor(userService: UserService);
    listar(): Promise<{
        id: string;
        papel: string;
        criadoEm: Date;
        nome: string | null;
        atualizadoEm: Date;
        email: string;
        ativo: boolean;
    }[]>;
    criar(body: {
        email: string;
        senha: string;
        nome?: string;
        papel?: string;
    }): Promise<{
        id: string;
        papel: string;
        criadoEm: Date;
        nome: string | null;
        email: string;
        ativo: boolean;
    }>;
    atualizar(id: string, body: any): Promise<{
        id: string;
        papel: string;
        criadoEm: Date;
        nome: string | null;
        atualizadoEm: Date;
        email: string;
        ativo: boolean;
    }>;
    excluir(id: string, req: any): Promise<{
        ok: boolean;
    }>;
}
