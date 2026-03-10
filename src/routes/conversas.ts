import express from 'express';
import conversaController from '../controllers/conversaController';

class ConversaRoutes {
    public router: express.Router;

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

export default new ConversaRoutes().getRouter();
