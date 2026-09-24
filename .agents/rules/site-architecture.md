# Arquitetura e Diretrizes do Site Institucional Freelancer Discos

Este documento estabelece os padrões arquiteturais, de design e de integração para o site institucional/loja da Freelancer Discos.

---

## 1. Princípios Arquiteturais
1. **Zero Build Dependency no Cliente:** O site é 100% estático no frontend (HTML5, Vanilla CSS com Tokens, Vanilla JS ES6+). Não adicionar frameworks pesados (React, Next.js ou Tailwind) neste repositório.
2. **Alta Velocidade e Resiliência:** Carregamento ultra-rápido com fallback duplo (Supabase REST API ao vivo + espelho local `data/discos.json`). Se o banco falhar ou o usuário estiver offline, a loja não cai.
3. **Sincronização em Tempo Real:** 
   - Ao carregar a página, `js/app.js` consulta o Supabase (`discos` com `deletado=eq.false` e `ativo=eq.true`).
   - Preços, títulos, novos discos e exclusões refletem instantaneamente.
   - A coluna `capa_url` tem prioridade #1 na exibição das capas.

---

## 2. Design System Editorial & Mobile-First
1. **Paleta de Cores e Tokens:**
   - Fundo base escuro analógico: `#0a0a0a` (Primitive Black)
   - Cor de destaque fonográfica: `#c0392b` (Deep Crimson / Vinil Red)
   - Cartões e Superfícies: `#141414` e `#1e1e1e`
   - Bordas e divisores: `rgba(255, 255, 255, 0.08)`
2. **Tipografia:**
   - Títulos de impacto e numerais: *Bebas Neue*
   - Títulos editoriais e itálicos poéticos: *Playfair Display*
   - Textos de leitura e UI: *Inter*
3. **Mobile-First Obrigatório:**
   - Touch targets de no mínimo 44x44px (`var(--touch-target-min)`).
   - Inputs com `font-size: 16px` para evitar zoom automático no iOS Safari.
   - Respeito a `safe-area-inset-*` em dispositivos com entalhe/Dynamic Island.
   - Suporte a toque/arraste (*swipe*) no carrossel de fotos.

---

## 3. Fluxo de E-Commerce & WhatsApp
1. **Sacola de Compras:** 
   - Persistida no navegador via `localStorage`.
   - Permite adicionar múltiplos itens sem bloquear a navegação.
   - Cálculo automático de subtotal em R$.
2. **Checkout via WhatsApp:**
   - Gera link `https://wa.me/...` com mensagem pré-formatada contendo lista de itens, subtotal, nome e cidade do comprador.
   - Todas as configurações de contato ficam centralizadas em `js/config.js`.

---

## 4. Testes e Validação Obrigatória
- Todo pull request ou alteração visual/funcional deve ser validado com o script E2E Playwright:
  ```bash
  node scripts/verify-site.js
  ```
- O script testa resolução Desktop (1440x900) e Mobile (iPhone 14), verificando busca, filtros, carrossel e drawer da sacola.
