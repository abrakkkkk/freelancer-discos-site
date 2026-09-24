# Diretriz de Desenvolvimento: Mobile-First Obrigatório

> **REGRA FUNDAMENTAL DO PROJETO:**
> Este sistema é operado prioritariamente em dispositivos móveis (smartphones e tablets) no balcão e no estoque físico das lojas.
> **Toda e qualquer alteração, tela, modal ou componente DEVE ser planejado, desenhado e otimizado PRIMEIRO para celulares (Mobile-First).**

---

## Princípios Obrigatórios de UI/UX Mobile

1. **Áreas de Toque (Touch Targets):**
   - Todos os botões, ícones clicáveis e links devem ter área de toque mínima de **44x44px** (padrão iOS HIG e Android Material).
   - Espaçamento adequado entre botões adjacentes para evitar toques acidentais.

2. **Modais e Diálogos:**
   - Devem ocupar até `100%` da largura útil em telas pequenas (com margens laterais seguras de 12px a 16px).
   - Devem conter `max-height: calc(100vh - 32px)` e rolagem vertical suave (`overflow-y: auto`) para nunca quebrar em telas menores, rotação horizontal ou quando o teclado virtual estiver aberto.
   - Botões de confirmação/cancelamento grandes e de fácil alcance para os polegares.

3. **Formulários e Teclado Virtual:**
   - Campos de texto (`input`, `select`, `textarea`) devem ter `font-size: 16px` em mobile para evitar o zoom automático indesejado no Safari/iOS.
   - Tipos de input adequados (`inputmode="numeric"` para preços, códigos e quantidades) para acionar o teclado correto.

4. **Safe Area & Barra de Navegação Inferior (`BottomNav`):**
   - Respeitar sempre a área segura de aparelhos modernos (`env(safe-area-inset-bottom)`).
   - O conteúdo das páginas deve ter padding inferior suficiente (`padding-bottom: calc(var(--bottom-nav-height) + 24px)`) para que nenhum botão fique oculto atrás da `BottomNav`.

5. **Interações sem Dependência de Hover:**
   - Não depender de `:hover` para revelar informações críticas ou botões de ação (celulares usam toque).

6. **Performance e Conexões Móveis:**
   - Evitar transferências pesadas de dados pela rede móvel (3G/4G/5G).
   - Usar cache em memória e `sessionStorage` para navegação instantânea.

7. **Isolamento de Ajustes de Layout (Zero Efeito Colateral):**
   - NUNCA alterar o padding ou margin de containers globais (`.pageContainer`, `.mainCard`, `.topHeader`) para atender ao ajuste visual de um único componente ou tela.
   - Todo ajuste de largura/espaçamento específico deve ser feito localmente no wrapper do próprio componente (ex: `.tableContainer`), garantindo que nenhuma outra página seja afetada.

8. **Integridade de Bordas em Cards e Tabelas Mobile:**
   - NUNCA aplicar margens negativas diretamente em linhas de tabela (`tr`) ou cards filhos quando estiverem dentro de tabelas ou blocos com corte.
   - Se for necessário expandir a largura horizontal de cards, aplique a expansão no wrapper pai (`.tableContainer`), garantindo que os cards mantenham `width: 100%`, `box-sizing: border-box` e todas as 4 bordas (topo, direita, fundo, esquerda) perfeitamente visíveis.

9. **Escala e Presença dos Títulos de Página:**
   - Os títulos principais de página (`h1`, `.page-title`) devem sempre manter hierarquia forte e peso visual:
     - **Desktop:** `26px` a `28px`, peso `700`, ícones em `30px`.
     - **Mobile:** `22px` a `23px` (piso de `21px` em telas muito pequenas), ícones em `26px`.
   - Utilizar tracking compacto moderno (`letter-spacing: -0.025em`) e `line-height: 1.25` para garantir que caibam em uma única linha no mobile sem perder imponência.

10. **Modais de Câmera e Scanners (Código de Barras / Capas):**
   - Visores de câmera devem ter dimensões travadas antes da inicialização do stream de vídeo para evitar saltos verticais de layout (layout shift) no mobile.
   - O botão de captura/obturador e controles devem manter posição fixa e visível, com dimensões mínimas de 64x64px para o obturador, acessível ao polegar sem sobrepor o visor.

11. **Ciclo de Vida de Feedback e Banners Visuais (Auto-Dismiss):**
   - Banners e mensagens de feedback (`AlertMessage`, toasts de confirmação ou alertas de scanner) NUNCA devem permanecer indefinidamente na tela ocupando espaço vertical útil do celular.
   - Mensagens transitórias de sucesso ou informação devem possuir auto-dismiss de **4 a 5 segundos** ou botão explícito de fechamento rápido.
   - Ao desmontar o componente ou disparar nova ação, limpar timers ativos (`clearTimeout`) para evitar vazamento de memória ou atualizações em componentes desmontados.

