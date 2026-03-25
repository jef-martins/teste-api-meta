---
description: Instruções para o agente IA sobre arquivos e diretórios a serem ignorados
---

# Diretrizes de Análise de Código

Para garantir a eficiência e focar apenas no código-fonte original, siga estas regras estritamente:

1. **Ignorar Pasta `dist/`**: 
   - NUNCA analise, leia ou utilize arquivos dentro do diretório `/dist`.
   - Esta pasta contém apenas código compilado/transpilado que é gerado automaticamente a partir da pasta `/src`.
   - Qualquer modificação deve ser feita nos arquivos correspondentes dentro de `/src`.

2. **Foco em TypeScript**:
   - Sempre priorize a leitura e edição de arquivos `.ts` dentro de `/src`.

3. **Commits Automáticos**:
   - Sempre após realizar alterações ou correções de código que funcionem (build com sucesso), realize o commit das alterações localmente.
   - Use mensagens de commit claras e concisas seguindo o padrão Conventional Commits (ex: `feat:`, `fix:`, `refactor:`).
   - NUNCA execute `git push` automaticamente, a menos que solicitado explicitamente. Apenas realize o `git commit` local.

4. **Arquivos Temporários**:
   - Ignore pastas como `node_modules`, `tmp`, ou arquivos de log temporários.

5. **Testes**:
   - Sempre que possivel, crie e execute os testes antes de finalizar a tarefa.
   - Sempre que for realizar testes, utilize o comando `npm test`.
   - Sempre execute os testes após realizar alterações ou correções de código.

6. **Sempre me responda em portugues do brasil.**
   - Sempre que for me responder, faça em portugues do brasil.
