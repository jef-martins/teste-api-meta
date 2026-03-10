---
description: como fazer commit e push das alterações no GitHub
---

// turbo-all

1. Verificar arquivos modificados
```
git status --short
```

2. Adicionar todos os arquivos relevantes ao stage
```
git add .
```

3. Fazer o commit com mensagem descritiva no padrão convencional:
   - `feat:` para novas funcionalidades
   - `fix:` para correções de bugs  
   - `chore:` para mudanças de configuração/SQL/infra
   - `refactor:` para refatorações
```
git commit -m "<tipo>: <descrição resumida>"
```

4. Fazer o push para o GitHub
```
git push origin main 2>&1
```
