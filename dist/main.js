"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const core_1 = require("@nestjs/core");
const platform_socket_io_1 = require("@nestjs/platform-socket.io");
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
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
        message: { erro: 'Limite de requisições atingido. Tente novamente em 1 minuto.' },
    }));
    app.useWebSocketAdapter(new platform_socket_io_1.IoAdapter(app));
    app.setGlobalPrefix('api', { exclude: ['health'] });
    const port = process.env.PORT ?? 3000;
    await app.listen(port);
    console.log(`[API] Servidor NestJS rodando na porta ${port} → http://localhost:${port}`);
}
bootstrap();
//# sourceMappingURL=main.js.map