import { EstadoRepository } from './estado.repository';
export declare class StateMachineEngine {
    private estadoRepo;
    private readonly logger;
    estadosUsuarios: Map<string, string>;
    dadosCapturados: Map<string, Record<string, string>>;
    mensagemAtual: string;
    nomeAtual: string | null;
    private estadosAvisados;
    constructor(estadoRepo: EstadoRepository);
    interpolar(texto: string, variaveis?: Record<string, any>): string;
    private resolverExprPath;
    extrairValorPath(obj: any, path: string): any;
    salvarDado(chatId: string, campo: string, valor: string): void;
    obterDados(chatId: string): Record<string, string>;
    limparDados(chatId: string): void;
    process(message: any, chatId: string, entrada: string, nome: string | null, actionDelegate: any): Promise<void>;
    avancarEstado(chatId: string, proximo: string, gatilho?: string | null, nome?: string | null): Promise<void>;
    transitarPorEntrada(chatId: string, estadoAtual: string, entrada: string, message: any, executarHandler?: boolean, nome?: string | null, actionDelegate?: any): Promise<string | null>;
}
