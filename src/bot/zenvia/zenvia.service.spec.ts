import { ZenviaService } from './zenvia.service';

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
});
