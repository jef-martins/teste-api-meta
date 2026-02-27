const express = require('express');
const rotasConversas = require('./routes/conversas');

class AppServer {
    constructor() {
        this.app = express();
        this.porta = process.env.PORT || 4000;

        this._configurarMiddlewares();
        this._configurarRotas();
    }

    _configurarMiddlewares() {
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
    }

    _configurarRotas() {
        // Rotas da API
        this.app.use('/api', rotasConversas);

        // Health check
        this.app.get('/', (req, res) => {
            res.json({ status: 'online', mensagem: 'Venon Bot API rodando!', origin: 'AppServer Class' });
        });
    }

    iniciar() {
        this.app.listen(this.porta, () => {
            console.log(`[API] Servidor Express rodando na porta ${this.porta} → http://localhost:${this.porta}`);
        });
    }
}

module.exports = AppServer;
