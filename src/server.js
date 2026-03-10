const express = require('express');
const cors    = require('cors');
const path    = require('path');
const helmet  = require('helmet');
const rateLimit = require('express-rate-limit');
const rotasConversas = require('./routes/conversas');
const rotasAdmin     = require('./routes/admin');
const rotasFluxos        = require('./routes/fluxos');
const rotasMonitoramento = require('./routes/monitoramento');
const rotasAuth          = require('./routes/auth');
const { autenticar }     = require('./middleware/auth');

class AppServer {
    constructor() {
        this.app = express();
        this.porta = process.env.PORT || 4000;

        this._configurarMiddlewares();
        this._configurarRotas();
    }

    _configurarMiddlewares() {
        // Security headers
        this.app.use(helmet({ contentSecurityPolicy: false }));

        // CORS
        this.app.use(cors({
            origin: process.env.FRONTEND_URL || 'http://localhost:5173',
            credentials: true
        }));

        // Rate limiting
        this.app.use('/api/auth', rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 20,
            message: { erro: 'Muitas tentativas. Tente novamente em 15 minutos.' }
        }));

        this.app.use('/api', rateLimit({
            windowMs: 1 * 60 * 1000,
            max: 100,
            message: { erro: 'Limite de requisições atingido. Tente novamente em 1 minuto.' }
        }));

        this.app.use(express.json({ limit: '5mb' }));
        this.app.use(express.urlencoded({ extended: true }));
    }

    _configurarRotas() {
        // Serve frontend em produção (dist do Vue)
        const frontendPath = path.join(__dirname, '../../telebots-frontend/dist');
        this.app.use(express.static(frontendPath));

        // Serve o painel admin legado (arquivos estáticos da pasta /telas)
        this.app.use('/telas', express.static(path.join(__dirname, '../telas')));

        // Rotas públicas (auth)
        this.app.use('/api/auth', rotasAuth);

        // Rotas protegidas da API
        this.app.use('/api', autenticar, rotasConversas);
        this.app.use('/api', autenticar, rotasFluxos);
        this.app.use('/api', autenticar, rotasMonitoramento);
        this.app.use('/admin', autenticar, rotasAdmin);

        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ status: 'online', mensagem: 'WPPConnect Bot API rodando!', origem: 'AppServer' });
        });

        // SPA fallback — serve index.html para rotas do Vue Router
        this.app.get('/{*path}', (req, res, next) => {
            if (req.path.startsWith('/api') || req.path.startsWith('/admin') || req.path.startsWith('/telas')) {
                return next();
            }
            res.sendFile(path.join(frontendPath, 'index.html'), (err) => {
                if (err) next();
            });
        });
    }

    iniciar() {
        this.app.listen(this.porta, () => {
            console.log(`[API] Servidor Express rodando na porta ${this.porta} → http://localhost:${this.porta}`);
        });
    }
}

module.exports = AppServer;
