"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const conversaRepository_1 = __importDefault(require("../database/conversaRepository"));
class ConversaController {
    async listar(req, res) {
        try {
            const conversas = await conversaRepository_1.default.listarConversas();
            return res.json({ sucesso: true, dados: conversas });
        }
        catch (err) {
            return res.status(500).json({ sucesso: false, erro: err.message });
        }
    }
}
exports.default = new ConversaController();
//# sourceMappingURL=conversaController.js.map