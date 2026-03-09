import { EstadoRepository } from './estado.repository';
import { StateMachineEngine } from './state-machine.engine';
export declare class HandlerService {
    private estadoRepo;
    private readonly logger;
    client: any;
    constructor(estadoRepo: EstadoRepository);
    private enviarResposta;
    _handlerMensagem(message: any, chatId: string, corpo: string, engine: StateMachineEngine): Promise<void>;
    _handlerCapturar(message: any, chatId: string, corpo: string, engine: StateMachineEngine): Promise<void>;
    private _handlerCapturarMulti;
    _handlerLista(message: any, chatId: string, corpo: string, engine: StateMachineEngine): Promise<any>;
    _handlerBotoes(message: any, chatId: string, corpo: string, engine: StateMachineEngine): Promise<void>;
    _handlerRequisicao(message: any, chatId: string, corpo: string, engine: StateMachineEngine): Promise<void>;
    _handlerDelay(message: any, chatId: string, corpo: string, engine: StateMachineEngine): Promise<void>;
}
