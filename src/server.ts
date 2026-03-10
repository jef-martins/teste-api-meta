import express from 'express';
import cors from 'cors';
import path from 'path';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import rotasConversas from './routes/conversas';
import rotasAdmin from './routes/admin';
import rotasFluxos from './routes/fluxos';
import rotasMonitoramento from './routes/monitoramento';
import rotasAuth from './routes/auth';
import { autenticar } from './middleware/auth';

class AppServer {
    public app: express.Application;
    public porta: string | number;

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

export default AppServer;
