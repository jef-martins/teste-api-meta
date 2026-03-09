import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
export declare class AuthController {
    private authService;
    private prisma;
    constructor(authService: AuthService, prisma: PrismaService);
    setupStatus(): Promise<{
        needsSetup: boolean;
    }>;
    login(body: {
        email: string;
        senha: string;
    }): Promise<{
        token: string;
        usuario: {
            id: number;
            email: string;
            nome: string | null;
            papel: string;
        };
        subOrgsAcessiveis: any[];
    }>;
    setup(body: {
        email: string;
        senha: string;
        nome?: string;
    }): Promise<{
        token: string;
        usuario: {
            id: number;
            papel: string;
            nome: string | null;
            email: string;
        };
    }>;
    register(body: {
        email: string;
        senha: string;
        nome?: string;
    }): Promise<{
        token: string;
        usuario: {
            id: number;
            papel: string;
            nome: string | null;
            email: string;
        };
        subOrgsAcessiveis: any[];
    }>;
    me(req: any): Promise<{
        id: number;
        papel: string;
        nome: string | null;
        email: string;
    }>;
}
