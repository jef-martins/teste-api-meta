declare class HttpService {
    baseUrl: string;
    constructor();
    enviarRequisicao(method: string, endpoint: string, body?: any, headers?: any): Promise<any>;
}
declare const _default: HttpService;
export default _default;
