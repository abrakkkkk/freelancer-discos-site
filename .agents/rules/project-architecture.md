# Diretrizes Arquiteturais e Regras de Negócio do Projeto

Este documento define os padrões de domínio, banco de dados, regras de estoque e convenções arquiteturais obrigatórias para o sistema Freelancer Discos.

---

## 1. Gestão de Estoque e Status (Ativo vs. Inativo)

1. **Nomenclatura Obrigatória:**
   - O estoque opera sob dois status estritos: **`Ativo`** (disponível no chão de loja para venda) e **`Inativo`** (reserva no Estoque Superior).
   - Não inventar outros termos ("Reserva", "Em estoque") na interface.

2. **Regra de Exclusão e Movimentações:**
   - **Excluir item ATIVO:** Representa uma saída real de estoque. **DEVE** registrar movimentação de saída (`tipo: 'saida'`) em `movimentacoes`.
   - **Excluir item INATIVO:** Representa apenas a limpeza de um item reserva. **NUNCA** registrar movimentação de saída; apenas marcar `deletado: true`.

3. **Fluxo de Reposição Automática:**
   - Sempre que um item Ativo sofrer saída, o sistema busca automaticamente por equivalentes Inativos no Estoque Superior (`itemService.findReplacements`).
   - Se houver reserva, gerar tarefa de reposição e notificar o usuário para promover o item reserva para a caixa da loja.

4. **Cadastro Rápido em Sequência:**
   - Na página `/adicionar`, o formulário deve reter automaticamente a última Caixa e Loja selecionadas para evitar preenchimento redundante em cadastros sucessivos. Para itens Inativos, a Loja é opcional.

---

## 2. Nomenclatura e Tratamento de Caixas e Lojas

1. **Loja 1:**
   - Caixas numéricas simples (`1`, `2`, `3`...). O display deve formatar como `Caixa 1`, `Caixa 2`.

2. **Loja 2:**
   - Nomenclatura obrigatória com sufixo "B" (`Caixa 1B` até `Caixa 20B`).
   - O `caixaService` deve garantir que todas as 20 caixas estejam sempre listadas nos filtros e seletores, mesmo se vazias no banco de dados.

3. **Cache de Metadados:**
   - O mapeamento de caixas é mantido em `sessionStorage` com TTL de 10 minutos para performance móvel instantânea.

4. **Normalização Obrigatória de Entrada (`normalizeCaixa`):**
   - Todos os inputs de caixa (em `/adicionar`, `/editar`, `/lote`) devem aplicar `normalizeCaixa()` de `src/utils/stringUtils.js`.
   - Digitações abreviadas como `5b`, `19b`, `c5b`, `caixa 5b` devem ser convertidas imediatamente para o padrão `Caixa 5B`.
   - Para Loja 1, números puros (`5`) são persistidos como string numérica (`"5"`) e exibidos como `"Caixa 5"`.


---

## 3. Banco de Dados e Supabase

1. **Soft Delete Padrão:**
   - Nenhuma tabela de catálogo (`discos`, `cds`, `dvds`, `vhs`) sofre exclusão física (`DELETE`). Sempre atualizar `deletado: true`.
   - Toda consulta pública deve conter `.eq('deletado', false)`.

2. **Normalização e Busca Resiliente:**
   - Toda busca de texto deve utilizar remoção de acentos (`removeAcentos`) e tratamento de curingas `_` em vogais para garantir que limitações de paginação do Supabase não ocultem itens cadastrados com grafias ligeiramente diferentes.

3. **Ações Destrutivas:**
   - Toda exclusão ou alteração em massa deve obrigatoriamente acionar o componente `ConfirmModal` antes de enviar mutations ao banco.

---

## 4. Sistema de Capas de Álbuns (Cover Cache)

1. **Rota `/api/cover`:**
   - Utiliza cache em memória em tempo de execução (`runtimeMemoryCache`) com sincronização em `covers_cache.json` no ambiente local.
2. **Invalidação Obrigatória:**
   - Ao alterar o `artista` ou `titulo` de um disco em `/editar` ou `/lote`, o cache de capa antigo deve ser invalidado e nova sincronização disparada.
3. **Respostas Nulas:**
   - Não persistir cache permanente de erros 404/nulos do Discogs para permitir que futuras buscas encontrem a capa quando disponível.

---

## 5. Padrão Estético e Anti-Poluição Visual

1. **Sem Emojis em Botões e Labels:**
   - Utilizar ícones vetoriais SVG limpos de `react-icons` (`Fi`, `Md`, `Pi`, `Tb`). Nunca usar emojis em interfaces operacionais.
2. **Harmonia Dark Mode:**
   - Fundo base: `#09090b`. Cards: `#18181b`. Acento suave: `#c53030`.
   - Bordas e divisores: `rgba(255, 255, 255, 0.15)` a `0.16`.
3. **Clareza Operacional:**
   - Telas de relatório (ex: Histórico de Movimentações) devem focar em contadores minimalistas e filtros rápidos sem blocos de texto redundantes.

---

## 6. Scanners e Reconhecimento Visual de Capas (Vision OCR)

1. **Captura Fiel para Modelos de Visão:**
   - Nunca aplicar binarização ou filtros de contraste agressivos em fotos enviadas ao Gemini Vision; manter fidelidade de cores e nitidez para que fontes estilizadas e artísticas de álbuns sejam interpretadas corretamente.
2. **Proporção Real 1:1:**
   - Capas de discos de vinil e CDs são quadradas. Visores e enquadramentos de câmera de capa devem manter `aspectRatio: '1 / 1'` sem restrições de altura que achatem ou distorçam a área de enquadramento.

---

## 7. Pensamento Sistêmico e Coerência de Estado 360°

Toda implementação ou ajuste DEVE ser analisado considerando o ecossistema completo da tela e do sistema, e não apenas o componente isolado:

1. **Ciclo Completo da Interação:**
   - Avaliar a experiência do início ao fim: o que acontece antes da ação, durante o carregamento/leitura e após o término (ex: onde o foco vai, quanto tempo a mensagem persiste, se a lista atualiza).
2. **Coerência de Filtros, Paginação e Contexto:**
   - Ações de busca ou escaneamento devem sempre sincronizar a paginação (resetar para a página 1), respeitar o contexto da loja ativa (`activeStore`) e prever estados vazios com orientação clara ao usuário.
3. **Limpeza e Descarte de Estados Residuais:**
   - Ao trocar de aba, fechar um modal ou limpar um campo de busca, estados temporários (mensagens de erro/sucesso antigas, previews de câmera, listas de sugestão) devem ser limpos imediatamente, evitando poluição visual residual.


