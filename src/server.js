const express = require('express');
const path    = require('path');
const rotasConversas = require('./routes/conversas');
const rotasAdmin     = require('./routes/admin');

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
        // Serve o painel admin (arquivos estáticos da pasta /telas)
        this.app.use('/telas', express.static(path.join(__dirname, '../telas')));

        // Rotas da API
        this.app.use('/api', rotasConversas);
        this.app.use('/admin', rotasAdmin);

        // Health check
        this.app.get('/', (req, res) => {
            res.json({ status: 'online', mensagem: 'WPPConnect Bot API rodando!', origem: 'AppServer' });
        });
    }

    iniciar() {
        this.app.listen(this.porta, () => {
            console.log(`[API] Servidor Express rodando na porta ${this.porta} → http://localhost:${this.porta}`);
        });
    }
}

module.exports = AppServer;
