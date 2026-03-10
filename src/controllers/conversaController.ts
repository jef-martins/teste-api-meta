import conversaRepository from '../database/conversaRepository';

class ConversaController {
  /**
   * Controlador que solicita todas as conversas do banco e envia como JSON
   */
  async listar(req, res) {
    try {
      const conversas = await conversaRepository.listarConversas();
      return res.json({ sucesso: true, dados: conversas });
    } catch (err) {
      return res.status(500).json({ sucesso: false, erro: err.message });
    }
  }
}

export default new ConversaController();
