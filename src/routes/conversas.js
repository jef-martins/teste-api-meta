const express = require('express');
const conversaController = require('../controllers/conversaController');

class ConversaRoutes {
    constructor() {
        this.router = express.Router();
        this._inicializarRotas();
    }

    _inicializarRotas() {
        // GET /api/conversas
        this.router.get('/conversas', conversaController.listar.bind(conversaController));
    }

    getRouter() {
        return this.router;
    }
}

module.exports = new ConversaRoutes().getRouter();
