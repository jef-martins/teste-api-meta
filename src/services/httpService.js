const axios = require('axios').default;

class HttpService {
    constructor() {
        // Base URL da API externa (configure no .env ou diretamente aqui)
        this.baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
    }

    /**
     * Realiza uma requisição HTTP para uma URL externa.
     *
     * @param {'GET'|'POST'|'PUT'|'PATCH'|'DELETE'} method - Método HTTP
     * @param {string} endpoint - Caminho da rota (ex: '/api/mensagens')
     * @param {object|null} body - Corpo da requisição (para POST/PUT/PATCH)
     * @param {object} headers - Headers adicionais (opcional)
     * @returns {Promise<object>} - Dados retornados pela API
     */
    async enviarRequisicao(method, endpoint, body = null, headers = {}) {
        const url = `${this.baseUrl}${endpoint}`;

        try {
            const resposta = await axios({
                method,
                url,
                data: body,
                headers: {
                    'Content-Type': 'application/json',
                    ...headers,
                },
            });

            return resposta.data;
        } catch (err) {
            const status = err.response?.status;
            const msg = err.response?.data || err.message;
            console.error(`[HTTP] Erro na requisição ${method} ${url} — Status: ${status}`, msg);
            throw err;
        }
    }
}

// Exportamos uma instância (padrão Singleton)
module.exports = new HttpService();
