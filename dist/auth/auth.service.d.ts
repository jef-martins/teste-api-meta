import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationService } from '../organization/organization.service';
export declare class AuthService {
    private prisma;
    private jwtService;
    private orgService;
    constructor(prisma: PrismaService, jwtService: JwtService, orgService: OrganizationService);
    login(email: string, senha: string): Promise<{
        token: string;
        usuario: {
            id: string;
            email: string;
            nome: string | null;
            papel: string;
        };
        subOrgsAcessiveis: any[];
    }>;
    setup(email: string, senha: string, nome?: string): Promise<{
        token: string;
        usuario: {
            id: string;
            papel: string;
            nome: string | null;
            email: string;
        };
    }>;
    register(email: string, senha: string, nome?: string): Promise<{
        token: string;
        usuario: {
            id: string;
            papel: string;
            nome: string | null;
            email: string;
        };
        subOrgsAcessiveis: any[];
    }>;
    getMe(userId: string): Promise<{
        id: string;
        papel: string;
        nome: string | null;
        email: string;
    }>;
    gerarToken(usuario: {
        id: string;
        email: string;
        papel: string;
    }): string;
    verifyToken(token: string): any;
}
