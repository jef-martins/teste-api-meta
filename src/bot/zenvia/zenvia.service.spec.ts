import { ZenviaService } from './zenvia.service';
import { MEMORY_SESSIONS } from '../meta/default-state-machine.config';

describe('ZenviaService', () => {
  let service: ZenviaService;

  beforeEach(() => {
    service = new ZenviaService();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('normaliza webhook interativo priorizando id/payload', () => {
    const normalized = (service as any).normalizarWebhook({
      from: '5511999999999',
      to: '5511888888888',
      message: {
        contents: [{ payload: 'OPCAO_1', text: 'Opcao 1' }],
      },
      metadata: { executionId: 'exec-1' },
    });

    expect(normalized).toEqual({
      from: '5511999999999',
      to: '5511888888888',
      text: 'OPCAO_1',
      executionId: 'exec-1',
      sourceType: 'interactive',
    });
  });

  it('normaliza webhook de botao via payload', () => {
    const normalized = (service as any).normalizarWebhook({
      message: {
        from: '5511777777777',
        to: '5511666666666',
        button: { payload: 'CONFIRMAR', text: 'Confirmar' },
      },
    });

    expect(normalized).toEqual({
      from: '5511777777777',
      to: '5511666666666',
      text: 'CONFIRMAR',
      executionId: null,
      sourceType: 'button',
    });
  });

  it('formata payload de lista como texto para envio no canal zenvia', () => {
    const texto = (service as any).formatarListPayloadComoTexto({
      description: 'Escolha uma opcao',
      sections: [
        {
          rows: [
            { rowId: '1', title: 'Primeira' },
            { rowId: '2', title: 'Segunda' },
          ],
        },
      ],
    });

    expect(texto).toBe('Escolha uma opcao\n\n*1* - Primeira\n*2* - Segunda');
  });

  it('encerra sessao ativa via executionId', () => {
    const executionId = 'exec-encerrar-1';
    const sessaoFake = {
      executionId,
      from: '5511999999999',
      to: '5511888888888',
      status: 'active',
      currentIndex: 0,
      itens: [],
      callbackUrl: null,
      callbackHeaders: {},
      npsHeaders: {},
      zenviaToken: 'token',
      zenviaBaseUrl: 'https://api.zenvia.com/v2/channels/whatsapp/messages',
      zenviaHeaders: {},
      webhookSecret: null,
      encerramentoExecutado: false,
      encerramentoExecutadoEm: null,
      resultadoNpsEnviado: false,
      npsPrimeiraTentativaEm: null,
      npsUltimaTentativaEm: null,
      npsEmEnvio: false,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      runtime: {},
    } as any;

    (service as any).sessoes.set(executionId, sessaoFake);
    (service as any).sessoesAtivasPorPar.set(
      '5511999999999::5511888888888',
      executionId,
    );
    MEMORY_SESSIONS[executionId] = {
      nome: 'Sessao teste',
      configs: {},
      transicoes: {},
    };

    const result = service.encerrarSessao(executionId);

    expect(result).toEqual({
      ok: true,
      executionId,
      mensagem: 'apagado com sucesso',
    });
    expect((service as any).sessoes.has(executionId)).toBe(false);
    expect((service as any).sessoesAtivasPorPar.size).toBe(0);
    expect(MEMORY_SESSIONS[executionId]).toBeUndefined();
  });

  it('retorna nao encontrado sem erro ao encerrar executionId inexistente', () => {
    const result = service.encerrarSessao('exec-inexistente');

    expect(result).toEqual({
      ok: true,
      executionId: 'exec-inexistente',
      mensagem: 'apagado com sucesso',
    });
  });
});
