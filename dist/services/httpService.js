"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
class HttpService {
    baseUrl;
    constructor() {
        this.baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
    }
    async enviarRequisicao(method, endpoint, body = null, headers = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        try {
            const resposta = await (0, axios_1.default)({
                method,
                url,
                data: body,
                headers: {
                    'Content-Type': 'application/json',
                    ...headers,
                },
            });
            return resposta.data;
        }
        catch (err) {
            const status = err.response?.status;
            const msg = err.response?.data || err.message;
            console.error(`[HTTP] Erro na requisição ${method} ${url} — Status: ${status}`, msg);
            throw err;
        }
    }
}
exports.default = new HttpService();
//# sourceMappingURL=httpService.js.map