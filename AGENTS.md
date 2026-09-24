# PROTOCOLO OBRIGATÓRIO DE EXECUÇÃO — FREELANCER DISCOS (SITE DA LOJA)

Em 100% das sessões, você DEVE consultar e acionar as skills e regras do projeto antes de qualquer resposta ou código:

1. **Início e Seleção de Skills:** Invocar `using-superpowers` no início de qualquer tarefa para determinar o fluxo correto antes de agir.
2. **Design e Criação:** Para novas seções, componentes ou mudanças visuais, invocar obrigatoriamente `brainstorming`, `ui-ux-pro-max` e `design-system`.
3. **Erros e Bugs:** Ao encontrar qualquer erro ou comportamento inesperado, invocar `systematic-debugging` antes de propor ou tentar qualquer correção.
4. **Planejamento e Execução:** Para tarefas de múltiplos passos, usar `writing-plans` seguido de `executing-plans` ou `subagent-driven-development`.
5. **Verificação Obrigatória:** Antes de declarar conclusão ou fazer commit/push, rodar `verification-before-completion` e executar os testes com Playwright (`node scripts/verify-site.js`).
6. **Regras Locais Obrigatórias:** Seguir sempre `.agents/rules/i-have-adhd.md`, `.agents/rules/mobile-first.md` e `.agents/rules/site-architecture.md`.

---

## Estrutura do Projeto (Site Estático de Alta Performance)
- **Localização:** `c:\Users\FREE LANCER\Documents\freelancer-discos-site`
- **Stack:** HTML5 Semântico, CSS Vanilla com 3 camadas de Design Tokens (`css/tokens.css` e `css/style.css`), JavaScript ES6+ modular (`js/config.js` e `js/app.js`).
- **Conexão em Tempo Real:** Consulta direta à REST API do Supabase com prioridade para `capa_url` e fallback offline para `data/discos.json`.
- **E-Commerce & Conversão:** Sacola de compras com subtotal automático em R$ e fechamento de pedido via WhatsApp pré-formatado.
