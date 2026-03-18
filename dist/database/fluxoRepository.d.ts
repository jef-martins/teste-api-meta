declare class FluxoRepository {
    criarFluxo(nome: any, descricao: any, flowJson: any): Promise<any>;
    obterFluxo(id: any): Promise<any>;
    listarFluxos(): Promise<any[]>;
    atualizarFluxo(id: any, { nome, descricao, flowJson, versao }: {
        nome: any;
        descricao: any;
        flowJson: any;
        versao: any;
    }): Promise<any>;
    excluirFluxo(id: any): Promise<void>;
    ativarFluxo(id: any): Promise<{
        estadoInicial: any;
    }>;
    limparEstadosDoFluxo(flowId: any): Promise<void>;
    salvarEstadosDoFluxo(flowId: any, estados: any): Promise<void>;
    salvarTransicoesDoFluxo(transicoes: any): Promise<void>;
    obterEstadosDoFluxo(flowId: any): Promise<any[]>;
    obterTransicoesDoFluxo(flowId: any): Promise<any[]>;
    salvarVariaveisDoFluxo(flowId: any, variaveis: any): Promise<void>;
    obterVariaveisDoFluxo(flowId: any): Promise<any[]>;
}
declare const _default: FluxoRepository;
export default _default;
