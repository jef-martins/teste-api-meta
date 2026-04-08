import { ZenviaService } from './zenvia.service';
import { MEMORY_SESSIONS } from '../meta/default-state-machine.config';

describe('ZenviaService', () => {
  let mockRedis: any;
  let service: ZenviaService;

  beforeEach(() => {
    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };
    service = new ZenviaService(mockRedis);
  });

  afterEach(() => {
    if (service) service.onModuleDestroy();
  });

  it('normaliza webhook interativo priorizando id/payload', () => {
    const normalized = (service as any).normalizarWebhook({
      from: '5511999999999',
      to: '5511888888888',
      message: {
        contents: [{ payload: 'OPCAO_1', text: 'Opcao 1' }],
      },
      metadata: { pesquisa_id: 'exec-1' },
    });

    expect(normalized).toEqual({
      from: '5511999999999',
      to: '5511888888888',
      text: 'OPCAO_1',
      pesquisa_id: 'exec-1',
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
      pesquisa_id: null,
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

  it('prioriza envio HTTP e usa SDK apenas como fallback', async () => {
    const enviarHttp = jest
      .spyOn(service as any, 'enviarMensagemViaHttp')
      .mockResolvedValue({ messageId: 'msg-http', payload: { ok: true } });
    const enviarSdk = jest
      .spyOn(service as any, 'enviarMensagemViaSdk')
      .mockResolvedValue({ messageId: 'msg-sdk', payload: { ok: true } });

    const result = await (service as any).enviarMensagem(
      '558599968524',
      '5514998089672',
      'teste',
      'token-teste',
      'https://api.zenvia.com/v2/channels/whatsapp/messages',
      {},
    );

    expect(result).toEqual({ messageId: 'msg-http', payload: { ok: true } });
    expect(enviarHttp).toHaveBeenCalledTimes(1);
    expect(enviarSdk).not.toHaveBeenCalled();
  });

  it('envia passo de botão como payload nativo da zenvia', async () => {
    const enviarConteudoSpy = jest
      .spyOn(service as any, 'enviarConteudoViaHttp')
      .mockResolvedValue({ messageId: 'msg-button', payload: { ok: true } });

    const snapshot = await service.iniciarFluxo({
      pesquisa_id: 'exec-button-native-1',
      conversa_id: 'conversa-button-native-1',
      from: '558599968524',
      to: '5514998089672',
      zenviaToken: 'token-teste',
      mensagens: [
        {
          ordem: 0,
          tipo: 'botao',
          texto: 'Você aceita os termos?',
          opcoes_validacao: 'Aceito,Não aceito',
        },
      ],
    });

    expect(enviarConteudoSpy).toHaveBeenCalled();
    const chamadaComBotao = enviarConteudoSpy.mock.calls.find(
      (call) =>
        call[2] &&
        typeof call[2] === 'object' &&
        (call[2] as Record<string, unknown>).type === 'button',
    );
    expect(chamadaComBotao).toBeDefined();
    expect(snapshot.itens[0].perguntaMessageId).toBe('msg-button');
  });

  it('envia passo de lista como payload nativo da zenvia', async () => {
    const enviarConteudoSpy = jest
      .spyOn(service as any, 'enviarConteudoViaHttp')
      .mockResolvedValue({ messageId: 'msg-list', payload: { ok: true } });

    const snapshot = await service.iniciarFluxo({
      pesquisa_id: 'exec-list-native-1',
      conversa_id: 'conversa-list-native-1',
      from: '558599968524',
      to: '5514998089672',
      zenviaToken: 'token-teste',
      mensagens: [
        {
          ordem: 0,
          tipo: 'lista',
          texto: 'Escolha uma opção:',
          opcoes_validacao: '2ª via de boleto,Suporte técnico',
        },
      ],
    });

    expect(enviarConteudoSpy).toHaveBeenCalled();
    const chamadaComLista = enviarConteudoSpy.mock.calls.find(
      (call) =>
        call[2] &&
        typeof call[2] === 'object' &&
        (call[2] as Record<string, unknown>).type === 'list',
    );
    expect(chamadaComLista).toBeDefined();
    expect(snapshot.itens[0].perguntaMessageId).toBe('msg-list');
  });

  it('envia a primeira pergunta ao iniciar o fluxo', async () => {
    const enviarMensagemSpy = jest
      .spyOn(service as any, 'enviarMensagem')
      .mockResolvedValue({ messageId: 'msg-1', payload: { ok: true } });

    const snapshot = await service.iniciarFluxo({
      pesquisa_id: 'exec-start-send-1',
      conversa_id: 'conversa-start-send-1',
      from: '558599968524',
      to: '5514998089672',
      zenviaToken: 'token-teste',
      mensagens: [
        {
          ordem: 0,
          tipo: 'descritiva',
          texto: 'Pergunta inicial',
        },
      ],
    });

    expect(enviarMensagemSpy).toHaveBeenCalledTimes(1);
    expect(snapshot.itens[0].perguntaMessageId).toBe('msg-1');
  });

  it('após resposta válida envia a próxima etapa (botão)', async () => {
    const enviarMensagemTextoSpy = jest
      .spyOn(service as any, 'enviarMensagem')
      .mockResolvedValue({ messageId: 'msg-ok', payload: { ok: true } });
    const enviarBotoesSpy = jest
      .spyOn(service as any, 'enviarBotoesViaHttp')
      .mockResolvedValue({ messageId: 'msg-btn', payload: { ok: true } });

    await service.iniciarFluxo({
      pesquisa_id: 'exec-next-step-1',
      conversa_id: 'conversa-next-step-1',
      from: '558599968524',
      to: '5514998089672',
      zenviaToken: 'token-teste',
      mensagens: [
        {
          ordem: 0,
          tipo: 'descritiva',
          texto: 'Responda OK',
          opcoes_validacao: 'OK',
        },
        {
          ordem: 1,
          tipo: 'botao',
          texto: 'Você confirma participação?',
          opcoes_validacao: 'Sim,Não',
        },
      ],
    });

    const snapshot = await service.registrarResposta('exec-next-step-1', 'OK');

    expect(enviarMensagemTextoSpy).toHaveBeenCalledTimes(1);
    expect(enviarBotoesSpy).toHaveBeenCalledTimes(1);
    expect(snapshot.currentIndex).toBe(1);
    expect(snapshot.itens[1].perguntaMessageId).toBe('msg-btn');
  });

  it('falha quando a próxima etapa não é enviada após resposta válida', async () => {
    const erroEtapa2 = new Error('provider indisponivel na etapa 2');
    const enviarMensagemTextoSpy = jest
      .spyOn(service as any, 'enviarMensagem')
      .mockResolvedValueOnce({ messageId: 'msg-1', payload: { ok: true } })
      .mockRejectedValue(erroEtapa2);
    const enviarBotoesSpy = jest
      .spyOn(service as any, 'enviarBotoesViaHttp')
      .mockRejectedValue(erroEtapa2);

    await service.iniciarFluxo({
      pesquisa_id: 'exec-next-step-fail-1',
      conversa_id: 'conversa-next-step-fail-1',
      from: '558599968524',
      to: '5514998089672',
      zenviaToken: 'token-teste',
      mensagens: [
        {
          ordem: 0,
          tipo: 'descritiva',
          texto: 'Responda OK',
          opcoes_validacao: 'OK',
        },
        {
          ordem: 1,
          tipo: 'botao',
          texto: 'Você confirma participação?',
          opcoes_validacao: 'Sim,Não',
        },
      ],
    });

    await expect(
      service.registrarResposta('exec-next-step-fail-1', 'OK'),
    ).rejects.toThrow('provider indisponivel na etapa 2');
    expect(enviarBotoesSpy).toHaveBeenCalledTimes(1);
    expect(enviarMensagemTextoSpy).toHaveBeenCalledTimes(2);
  });

  it('encerra sessao ativa via pesquisa_id', () => {
    const pesquisa_id = 'exec-encerrar-1';
    const sessaoFake = {
      pesquisa_id,
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

    (service as any).sessoes.set(pesquisa_id, sessaoFake);
    (service as any).sessoesAtivasPorPar.set(
      '5511999999999::5511888888888',
      pesquisa_id,
    );
    MEMORY_SESSIONS[pesquisa_id] = {
      nome: 'Sessao teste',
      configs: {},
      transicoes: {},
    };

    const result = service.encerrarSessao(pesquisa_id);

    expect(result).toEqual({
      ok: true,
      pesquisa_id,
      mensagem: 'apagado com sucesso',
    });
    expect((service as any).sessoes.has(pesquisa_id)).toBe(false);
    expect((service as any).sessoesAtivasPorPar.size).toBe(0);
    expect(MEMORY_SESSIONS[pesquisa_id]).toBeUndefined();
  });

  it('retorna nao encontrado sem erro ao encerrar pesquisa_id inexistente', () => {
    const result = service.encerrarSessao('exec-inexistente');

    expect(result).toEqual({
      ok: true,
      pesquisa_id: 'exec-inexistente',
      mensagem: 'apagado com sucesso',
    });
  });

  it('webhook usa fallback por par quando pesquisa_id inbound nao existe', async () => {
    const pesquisa_idAtivo = 'exec-ativo-par-1';
    const sessaoFake = {
      pesquisa_id: pesquisa_idAtivo,
      from: '558599968524',
      to: '5514998089672',
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

    (service as any).sessoes.set(pesquisa_idAtivo, sessaoFake);
    (service as any).sessoesAtivasPorPar.set(
      '558599968524::5514998089672',
      pesquisa_idAtivo,
    );

    const registrarSpy = jest
      .spyOn(service as any, 'registrarResposta')
      .mockResolvedValue({ status: 'active', currentIndex: 1 });

    const result = await service.processarWebhook(
      {
        pesquisa_id: 'exec-inbound-inexistente',
        from: '5514998089672',
        to: '558599968524',
        text: 'ok',
      },
      {},
    );

    expect(registrarSpy).toHaveBeenCalledWith(pesquisa_idAtivo, 'ok');
    expect(result).toEqual({
      ok: true,
      pesquisa_id: pesquisa_idAtivo,
      snapshot: { status: 'active', currentIndex: 1 },
    });
  });
});
