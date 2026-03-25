# Guia de Refatoração para Alta Escala: Cache de Fluxo e Sessão Redis

Este guia detalha os passos técnicos para implementar a **Abordagem Híbrida** no Venon Bot, preparando o sistema para suportar de 5.000 a 10.000 estados e alta concorrência de usuários.

---

## 1. Implementação do Cache de Definições (Flow Config) em Memória

O objetivo é evitar queries repetitivas às tabelas `bot_estado_config` e `bot_estado_transicao`, que são dados estáticos durante a conversação.

### Passo 1.1: Atualizar o `EstadoRepository`

Modifique o `src/bot/estado.repository.ts` para incluir Maps que servirão como cache.

```typescript
@Injectable()
export class EstadoRepository implements OnModuleInit {
  // Cache de configurações de nós
  private configCache = new Map<string, any>();
  // Cache de transições indexado pelo estado de origem
  private transicoesCache = new Map<string, any[]>();

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.warmUpCache();
  }

  /**
   * Carrega todas as definições ativas para a memória
   */
  async warmUpCache() {
    const [configs, transicoes] = await Promise.all([
      this.prisma.botEstadoConfig.findMany({ where: { ativo: true } }),
      this.prisma.botEstadoTransicao.findMany({ where: { ativo: true } })
    ]);

    this.configCache.clear();
    configs.forEach(c => this.configCache.set(c.estado, c));

    this.transicoesCache.clear();
    transicoes.forEach(t => {
      const lista = this.transicoesCache.get(t.estadoOrigem) || [];
      lista.push(t);
      this.transicoesCache.set(t.estadoOrigem, lista);
    });
  }

  // Atualizar o método de busca para ler do Map
  async obterConfigEstado(estado: string) {
    const cached = this.configCache.get(estado);
    if (cached) return cached;
    
    // Fallback apenas se não estiver no cache (segurança)
    return this.prisma.botEstadoConfig.findFirst({ where: { estado, ativo: true } });
  }
}
```

### Passo 1.2: Invalidação de Cache ao Atualizar o Banco
No NestJS, você deve garantir que, sempre que o Admin salvar um fluxo, o repositório seja notificado para recarregar sua memória.

**Opção A: Chamada Direta no FlowService**
Ao salvar o JSON do fluxo no dashboard:
```typescript
async saveFlow(flowId: string, data: any) {
  await this.prisma.botFluxo.update({ where: { id: flowId }, data });
  // Chama o warm-up para atualizar os Maps em memória imediatamente
  await this.estadoRepo.warmUpCache();
}
```

**Opção B: Eventos (Desacoplado)**
Se você tiver vários serviços, use o `@nestjs/event-emitter`:
```typescript
@OnEvent('flow.updated')
async handleFlowUpdatedEvent() {
  await this.estadoRepo.warmUpCache();
}
```

---

## 2. Migração e Recuperação de Sessões (Não Reiniciar do Início)

Para garantir que o usuário **nunca** volte para o estado inicial ("START"), a chave é persistir o `chat_id -> estadoAtual` de forma robusta.

### Passo 2.1: Instalação e Arquitetura Redis
O Redis deve ser usado como "fonte da verdade" rápida, mas o PostgreSQL continua como backup.

```bash
npm install ioredis
```

### Passo 2.2: Implementação da Persistência de Sessão
Ao salvar, você atualiza ambos (ou apenas o Redis se quiser máxima performance).

```typescript
// No EstadoRepository (ou SessionService)
async salvarEstadoUsuario(chatId: string, estado: string, contexto?: any) {
    // 1. Atualizar Redis (Expira em 7 dias se o usuário sumir)
    await this.redis.set(`session:${chatId}`, JSON.stringify({ estado, contexto }), 'EX', 604800);

    // 2. Atualizar PG em background (opcional para relatórios)
    this.prisma.botEstadoUsuario.upsert({
      where: { chatId },
      update: { estadoAtual: estado, contexto: contexto || {} },
      create: { chatId, estadoAtual: estado, contexto: contexto || {} }
    }).catch(err => console.error('Erro ao salvar no banco:', err));
}
```

### Passo 2.3: Recuperação Automática de Estado
Ao receber uma mensagem, o motor do bot sempre consulta o cache primeiro:

```typescript
async process(message, chatId) {
    // Tenta recuperar do Redis primeiro
    const sessao = await this.redis.get(`session:${chatId}`);
    
    // Se não existir, tenta o banco (recuperação de desastre)
    let estadoAtual = sessao ? JSON.parse(sessao).estado : await this.obterEstadoDoBanco(chatId);

    if (!estadoAtual) {
      estadoAtual = 'START'; // Apenas se for um usuário COMPLETAMENTE novo
    }
    
    // Continua o fluxo de onde o usuário parou
    // ...
}
```

---

## 3. Benefícios Esperados

1.  **Redução de Carga no DB**: O PostgreSQL deixará de receber centenas de SELECTs de leitura de fluxo por segundo.
2.  **Latência de Resposta**: A decisão de "qual o próximo nó" cairá de ~50ms para < 1ms.
3.  **Escalabilidade**: Você poderá rodar 5 instâncias deste backend simultaneamente, e todas compartilharão as sessões via Redis e terão seus próprios caches de fluxo (que são leves).

---

## 4. Próximos Passos Sugeridos
1.  Implementar o `RedisService` centralizado.
2.  Criar um endpoint `GET /admin/cache/reload` para forçar a atualização da memória sem precisar reiniciar o serviço.
3.  Monitorar o uso de memória do Node.js conforme o número de estados cresce.
