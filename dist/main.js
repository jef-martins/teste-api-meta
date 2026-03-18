"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const core_1 = require("@nestjs/core");
const platform_socket_io_1 = require("@nestjs/platform-socket.io");
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const express = __importStar(require("express"));
const path = __importStar(require("path"));
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.enableShutdownHooks();
    app.use(express.json({ limit: '5mb' }));
    app.use(express.urlencoded({ extended: true, limit: '5mb' }));
    app.use((0, helmet_1.default)({ contentSecurityPolicy: false }));
    app.enableCors({
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        credentials: true,
    });
    app.use('/api/auth', (0, express_rate_limit_1.default)({
        windowMs: 15 * 60 * 1000,
        max: 20,
        message: { erro: 'Muitas tentativas. Tente novamente em 15 minutos.' },
    }));
    app.use('/api', (0, express_rate_limit_1.default)({
        windowMs: 1 * 60 * 1000,
        max: 100,
        message: {
            erro: 'Limite de requisições atingido. Tente novamente em 1 minuto.',
        },
    }));
    app.useWebSocketAdapter(new platform_socket_io_1.IoAdapter(app));
    app.setGlobalPrefix('api', { exclude: ['health'] });
    const frontendPath = path.join(__dirname, '../../telebots-frontend/dist');
    app.useStaticAssets(frontendPath);
    app.useStaticAssets(path.join(__dirname, '../telas'), { prefix: '/telas/' });
    app.getHttpAdapter().get('/{*path}', (req, res, next) => {
        if (req.path.startsWith('/api') ||
            req.path.startsWith('/admin') ||
            req.path.startsWith('/telas')) {
            return next();
        }
        res.sendFile(path.join(frontendPath, 'index.html'), (err) => {
            if (err)
                next();
        });
    });
    const port = process.env.PORT ?? 3000;
    await app.listen(port);
    console.log(`[API] Servidor NestJS rodando na porta ${port} → http://localhost:${port}`);
}
bootstrap();
//# sourceMappingURL=main.js.map