declare class EstadoRepository {
    constructor();
    carregarConfiguracoes(): Promise<void>;
    obterConfigEstado(estado: any): Promise<{
        handler: any;
        descricao: any;
        config: any;
    } | null>;
    listarEstados(): Promise<any[]>;
    buscarProximoEstado(estadoAtual: any, entrada: any): Promise<any>;
    listarTransicoes(estadoOrigem: any): Promise<any[]>;
    obterEstadoUsuario(chatId: any): Promise<any>;
    salvarEstadoUsuario(chatId: string, estado: string, nome?: string | null): Promise<void>;
    registrarTransicao(chatId: string, estadoAnterior: string, estadoNovo: string, mensagemGatilho?: string | null): Promise<void>;
    listarHistorico(chatId: any): Promise<any[]>;
}
declare const _default: EstadoRepository;
export default _default;
