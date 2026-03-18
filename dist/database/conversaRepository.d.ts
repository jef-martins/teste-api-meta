declare class ConversaRepository {
    salvarMensagem(nome: any, dados: any, quemEnviou: any, paraQuem: any, mensagem: any): Promise<any>;
    listarConversas(): Promise<any[]>;
}
declare const _default: ConversaRepository;
export default _default;
