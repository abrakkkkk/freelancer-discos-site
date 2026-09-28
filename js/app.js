/**
 * app.js - Lógica interativa da Freelancer Discos
 * Refatorado seguindo práticas de Clean Code:
 * - Responsabilidade Única (SRP) e separação de camadas
 * - Funções pequenas (<20 linhas) e descritivas
 * - Eliminação de duplicação e código morto
 */

// ============================================================================
// 1. CONSTANTES E CONFIGURAÇÕES
// ============================================================================
const CONFIG = {
  PAGE_SIZE: 24,
  SEARCH_DEBOUNCE_MS: 120,
  SWIPE_THRESHOLD_PX: 40,
  STORAGE_KEYS: {
    CART: 'freelancer_cart',
    COVERS: 'freelancer_covers'
  }
};

// ============================================================================
// 2. FORMATAÇÃO E UTILITÁRIOS PUROS
// ============================================================================
const Formatters = {
  formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  },

  normalizeSearchText(text) {
    if (!text) return '';
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  },

  generateAlbumColor(seedText) {
    const palette = [
      '#8e1f18', '#14285e', '#d9772b', '#1f5a34',
      '#6c3483', '#b03a2e', '#196f3d', '#283747', '#78281f'
    ];
    let hash = 0;
    for (let i = 0; i < seedText.length; i++) {
      hash = seedText.charCodeAt(i) + ((hash << 5) - hash);
    }
    return palette[Math.abs(hash) % palette.length];
  }
};

// ============================================================================
// 3. CAMADA DE ARMAZENAMENTO LOCAL (STORAGE SERVICE)
// ============================================================================
const StorageService = {
  loadCart() {
    try {
      return JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.CART) || '[]');
    } catch (_) {
      return [];
    }
  },

  saveCart(cartItems) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.CART, JSON.stringify(cartItems));
  },

  loadCoverCache() {
    try {
      return JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.COVERS) || '{}');
    } catch (_) {
      return {};
    }
  }
};

// ============================================================================
// 4. CAMADA DE DADOS E CATÁLOGO (CATALOG SERVICE)
// ============================================================================
const CatalogService = {
  async fetchLocalDiscos() {
    try {
      const res = await fetch('data/discos.json');
      return res.ok ? await res.json() : [];
    } catch (_) {
      return [];
    }
  },

  buildCoverMap(fallbackRecords) {
    const coverMap = {};
    fallbackRecords.forEach(d => {
      if (d.capa_url) {
        coverMap[d.id] = d.capa_url;
        const queryKey = `${d.artista}_${d.titulo}`.toLowerCase();
        coverMap[queryKey] = d.capa_url;
      }
    });
    return { ...coverMap, ...StorageService.loadCoverCache() };
  },

  async querySupabase(supabaseUrl, anonKey) {
    const baseFields = 'id,artista,titulo,preco,caixa,ano,observacao,ativo,deletado';
    const filterParams = '&caixa=in.(49,50,51,Caixa%2049,Caixa%2050,Caixa%2051)&deletado=eq.false&ativo=eq.true&order=artista.asc';
    const headers = {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Accept-Profile': 'public'
    };

    try {
      const urlWithCover = `${supabaseUrl}/rest/v1/discos?select=${baseFields},capa_url${filterParams}`;
      const res = await fetch(urlWithCover, { headers });
      if (res.ok) return await res.json();

      const urlWithoutCover = `${supabaseUrl}/rest/v1/discos?select=${baseFields}${filterParams}`;
      const fallbackRes = await fetch(urlWithoutCover, { headers });
      return fallbackRes.ok ? await fallbackRes.json() : null;
    } catch (err) {
      console.warn('Conexão ao Supabase falhou, usando acervo local:', err);
      return null;
    }
  },

  normalizeRecord(item, index, coverMap) {
    const queryKey = `${item.artista || ''}_${item.titulo || ''}`.toLowerCase();
    const resolvedCover = item.capa_url || coverMap[item.id] || coverMap[queryKey] || null;

    return {
      id: item.id,
      numero: index + 1,
      artista: (item.artista || 'Artista Desconhecido').trim(),
      titulo: (item.titulo || 'Sem Título').trim(),
      preco: Number(item.preco) || 0,
      caixa: item.caixa ? String(item.caixa) : 'Caixa 50',
      ano: item.ano ? String(item.ano).trim() : null,
      capa_url: resolvedCover,
      observacao: item.observacao ? item.observacao.trim() : null
    };
  },

  async loadAllRecords() {
    const localRecords = await this.fetchLocalDiscos();
    const coverMap = this.buildCoverMap(localRecords);

    const cfg = window.STORE_CONFIG || {};
    let liveRecords = null;
    if (cfg.supabaseUrl && cfg.supabaseAnonKey) {
      liveRecords = await this.querySupabase(cfg.supabaseUrl, cfg.supabaseAnonKey);
    }

    if (liveRecords && liveRecords.length > 0) {
      return liveRecords.map((item, idx) => this.normalizeRecord(item, idx, coverMap));
    }
    if (localRecords.length > 0) {
      return localRecords;
    }
    throw new Error('Nenhum acervo disponível (Supabase e local falharam).');
  }
};

// ============================================================================
// 5. GESTÃO DO ESTADO DA SACOLA (CART MANAGER)
// ============================================================================
class CartManager {
  constructor(initialItems = []) {
    this.items = initialItems;
  }

  has(id) {
    return this.items.some(item => item.id === id);
  }

  add(record) {
    if (this.has(record.id)) return false;
    this.items.push({
      id: record.id,
      artista: record.artista,
      titulo: record.titulo,
      preco: record.preco,
      caixa: record.caixa,
      capa_url: record.capa_url
    });
    return true;
  }

  remove(id) {
    this.items = this.items.filter(item => item.id !== id);
  }

  clear() {
    this.items = [];
  }

  calculateTotal() {
    return this.items.reduce((acc, item) => acc + (Number(item.preco) || 0), 0);
  }

  getCount() {
    return this.items.length;
  }
}

// ============================================================================
// 6. SERVIÇO DE CHECKOUT WHATSAPP (ORDER SERVICE)
// ============================================================================
const OrderService = {
  buildOrderMessage(items, totalFormatted, customerName, customerCity, greeting) {
    let msg = `${greeting}\n\n`;
    items.forEach((item, idx) => {
      msg += `${idx + 1}. *${item.artista}* — _${item.titulo}_ (${item.caixa}) • ${Formatters.formatCurrency(item.preco)}\n`;
    });
    msg += `\n*Total dos Discos:* ${totalFormatted}\n`;

    if (customerName) msg += `*Nome:* ${customerName}\n`;
    if (customerCity) msg += `*Local/Frete:* ${customerCity}\n`;

    msg += `\nAguardo a confirmação dos dados e dados para pagamento via Pix. Obrigado!`;
    return msg;
  },

  buildCheckoutUrl(cartManager, customerName, customerCity) {
    const cfg = window.STORE_CONFIG || {};
    const rawNumber = cfg.whatsappNumber || '5585987879214';
    const cleanNumber = rawNumber.replace(/\D/g, '');
    const greeting = cfg.orderGreeting || 'Olá, Freelancer Discos! Gostaria de comprar os seguintes vinis:';

    const totalText = Formatters.formatCurrency(cartManager.calculateTotal());
    const message = this.buildOrderMessage(cartManager.items, totalText, customerName, customerCity, greeting);

    return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
  }
};

// ============================================================================
// 7. RENDERIZADOR DO CATÁLOGO (CATALOG VIEW)
// ============================================================================
const CatalogView = {
  grid: null,
  counter: null,
  loadMoreContainer: null,
  loadMoreBtn: null,

  init() {
    this.grid = document.getElementById('catalogGrid');
    this.counter = document.getElementById('catalogCount');
    this.loadMoreContainer = document.getElementById('loadMoreContainer');
    this.loadMoreBtn = document.getElementById('loadMoreBtn');
  },

  renderLoading() {
    if (this.counter) this.counter.textContent = 'Sincronizando acervo em tempo real...';
  },

  renderError(message = 'Não foi possível carregar os discos no momento.') {
    if (this.grid) {
      this.grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px var(--space-4); color: var(--color-text-muted);">
          <p style="font-size: 18px; margin-bottom: 12px; color: var(--color-brand-primary);">${message}</p>
        </div>
      `;
    }
    if (this.counter) this.counter.textContent = 'Erro ao carregar catálogo';
    if (this.loadMoreContainer) this.loadMoreContainer.style.display = 'none';
  },

  createCardElement(record, inCart) {
    const fallbackColor = Formatters.generateAlbumColor(record.artista + record.titulo);
    const coverHtml = record.capa_url
      ? `<img src="${record.capa_url}" 
              alt="${record.titulo} - ${record.artista}" 
              class="record-cover-img" 
              loading="lazy" 
              onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';">
         <div class="record-fallback-art" style="display: none; --album-color: ${fallbackColor};">
           <i></i>
         </div>`
      : `<div class="record-fallback-art" style="--album-color: ${fallbackColor};">
           <i></i>
         </div>`;

    const card = document.createElement('article');
    card.className = 'record-card';
    card.setAttribute('data-id', record.id);
    card.innerHTML = `
      <div class="record-top-meta">
        <span class="record-num">#${String(record.numero).padStart(2, '0')}</span>
        ${record.caixa ? `<span class="record-badge">${record.caixa}</span>` : ''}
      </div>
      <div class="record-artwork">
        ${coverHtml}
      </div>
      <div class="record-info">
        <span class="record-artist">${record.artista}</span>
        <h3 class="record-title">${record.titulo}</h3>
        <div class="record-price-row">
          <span class="record-price">${Formatters.formatCurrency(record.preco)}</span>
          <button type="button" 
                  class="btn-add-cart ${inCart ? 'added' : ''}" 
                  data-action="add-cart" 
                  data-id="${record.id}" 
                  aria-label="${inCart ? 'Disco na sacola' : 'Adicionar à Sacola'}">
            ${inCart ? 'Na Sacola ✓' : '+ Sacola'}
          </button>
        </div>
      </div>
    `;
    return card;
  },

  renderEmptyState() {
    if (!this.grid) return;
    this.grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 56px var(--space-4); color: var(--color-text-muted);">
        <p style="font-size: 20px; font-family: var(--font-editorial-title); font-style: italic; margin-bottom: 8px;">Nenhum disco encontrado para esta busca.</p>
        <p style="font-size: 14px;">Tente pesquisar outro artista ou nome do álbum.</p>
      </div>
    `;
    if (this.counter) this.counter.textContent = '0 discos encontrados';
    if (this.loadMoreContainer) this.loadMoreContainer.style.display = 'none';
  },

  renderRecords(records, cartManager, displayedCount) {
    if (!this.grid) return;
    this.grid.innerHTML = '';

    if (records.length === 0) {
      this.renderEmptyState();
      return;
    }

    const visibleBatch = records.slice(0, displayedCount);
    visibleBatch.forEach(record => {
      const inCart = cartManager.has(record.id);
      const card = this.createCardElement(record, inCart);
      this.grid.appendChild(card);
    });

    const isSingle = records.length === 1;
    this.counter.textContent = isSingle
      ? '1 disco encontrado'
      : `${records.length} discos encontrados (exibindo ${visibleBatch.length})`;

    this.updateLoadMore(records.length, displayedCount);
  },

  updateLoadMore(totalCount, displayedCount) {
    if (totalCount > displayedCount) {
      this.loadMoreContainer.style.display = 'flex';
      const remaining = totalCount - displayedCount;
      const nextBatch = Math.min(CONFIG.PAGE_SIZE, remaining);
      this.loadMoreBtn.textContent = `Carregar mais vinis (+${nextBatch})`;
    } else {
      this.loadMoreContainer.style.display = 'none';
    }
  }
};

// ============================================================================
// 8. RENDERIZADOR DA SACOLA (CART VIEW)
// ============================================================================
const CartView = {
  drawer: null,
  overlay: null,
  itemsList: null,
  footer: null,
  subtotal: null,
  badge: null,
  floatingBadge: null,
  itemCount: null,
  triggerBtn: null,
  floatingBtn: null,

  init() {
    this.drawer = document.getElementById('cartDrawer');
    this.overlay = document.getElementById('cartOverlay');
    this.itemsList = document.getElementById('cartItemsList');
    this.footer = document.getElementById('drawerFooter');
    this.subtotal = document.getElementById('cartSubtotal');
    this.badge = document.getElementById('cartBadge');
    this.floatingBadge = document.getElementById('floatingCartBadge');
    this.itemCount = document.getElementById('drawerItemCount');
    this.triggerBtn = document.getElementById('cartTrigger');
    this.floatingBtn = document.getElementById('floatingCartBtn');
  },

  open() {
    this.drawer.classList.add('open');
    this.overlay.classList.add('open');
    this.drawer.setAttribute('aria-hidden', 'false');
    this.overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  },

  close() {
    this.drawer.classList.remove('open');
    this.overlay.classList.remove('open');
    this.drawer.setAttribute('aria-hidden', 'true');
    this.overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  },

  pulseButtons() {
    this.triggerBtn?.classList.add('pulse');
    this.floatingBtn?.classList.add('pulse');
    setTimeout(() => {
      this.triggerBtn?.classList.remove('pulse');
      this.floatingBtn?.classList.remove('pulse');
    }, 600);
  },

  updateBadges(totalItems, cartManager) {
    if (this.badge) this.badge.textContent = totalItems;
    if (this.floatingBadge) this.floatingBadge.textContent = totalItems;

    document.querySelectorAll('.btn-add-cart').forEach(btn => {
      const id = Number(btn.getAttribute('data-id'));
      const inCart = cartManager.has(id);
      btn.classList.toggle('added', inCart);
      btn.textContent = inCart ? 'Na Sacola ✓' : '+ Sacola';
      btn.setAttribute('aria-label', inCart ? 'Disco na sacola' : 'Adicionar à Sacola');
    });
  },

  createCartItemElement(item) {
    const itemEl = document.createElement('div');
    itemEl.className = 'cart-item-card';

    const thumbHtml = item.capa_url
      ? `<img src="${item.capa_url}" alt="${item.titulo}" class="cart-item-thumb">`
      : `<div class="cart-item-thumb" style="background: ${Formatters.generateAlbumColor(item.artista)}; display: grid; place-items: center; color: #fff; font-size: 11px; font-weight: 700;">VINIL</div>`;

    itemEl.innerHTML = `
      ${thumbHtml}
      <div class="cart-item-details">
        <span class="cart-item-artist">${item.artista} (${item.caixa})</span>
        <h4 class="cart-item-title">${item.titulo}</h4>
        <span class="cart-item-price">${Formatters.formatCurrency(item.preco)}</span>
      </div>
      <button type="button" class="cart-item-remove-btn" data-action="remove-item" data-id="${item.id}" aria-label="Remover disco">
        &times;
      </button>
    `;
    return itemEl;
  },

  renderEmptyState() {
    this.footer.style.display = 'none';
    this.itemsList.innerHTML = `
      <div class="cart-empty-state">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <path d="M16 10a4 4 0 0 1-8 0"></path>
        </svg>
        <p>Sua sacola de vinis está vazia.</p>
        <button class="btn btn-outline" onclick="document.getElementById('drawerCloseBtn').click(); window.location.hash='#catalogo';">
          Explorar Novidades
        </button>
      </div>
    `;
  },

  render(cartManager) {
    this.itemsList.innerHTML = '';
    const totalItems = cartManager.getCount();
    this.itemCount.textContent = totalItems === 1 ? '1 disco selecionado' : `${totalItems} discos selecionados`;

    if (totalItems === 0) {
      this.renderEmptyState();
      return;
    }

    this.footer.style.display = 'block';
    cartManager.items.forEach(item => {
      this.itemsList.appendChild(this.createCartItemElement(item));
    });
    this.subtotal.textContent = Formatters.formatCurrency(cartManager.calculateTotal());
  }
};

// ============================================================================
// 9. COMPONENTE: CARROSSEL DE FOTOS (QUEM SOMOS)
// ============================================================================
const CarouselComponent = {
  init() {
    const track = document.getElementById('carouselTrack');
    const slides = document.querySelectorAll('.carousel-slide');
    const prevBtn = document.getElementById('carouselPrevBtn');
    const nextBtn = document.getElementById('carouselNextBtn');
    const dots = document.querySelectorAll('.carousel-dot');
    const counterNum = document.getElementById('currentSlideNum');

    if (!track || slides.length === 0) return;

    let currentIndex = 0;
    const totalSlides = slides.length;

    const goToSlide = (targetIndex) => {
      if (targetIndex < 0) currentIndex = totalSlides - 1;
      else if (targetIndex >= totalSlides) currentIndex = 0;
      else currentIndex = targetIndex;

      track.style.transform = `translateX(-${currentIndex * 100}%)`;

      slides.forEach((slide, i) => {
        const isActive = i === currentIndex;
        slide.classList.toggle('is-active', isActive);
        slide.setAttribute('aria-hidden', isActive ? 'false' : 'true');
      });

      dots.forEach((dot, i) => {
        const isActive = i === currentIndex;
        dot.classList.toggle('is-active', isActive);
        dot.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });

      if (counterNum) {
        counterNum.textContent = String(currentIndex + 1).padStart(2, '0');
      }
    };

    prevBtn?.addEventListener('click', () => goToSlide(currentIndex - 1));
    nextBtn?.addEventListener('click', () => goToSlide(currentIndex + 1));
    dots.forEach((dot, i) => dot.addEventListener('click', () => goToSlide(i)));

    // Suporte a swipe em tela sensível ao toque
    let touchStartX = 0;
    track.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    track.addEventListener('touchend', (e) => {
      const distance = touchStartX - e.changedTouches[0].screenX;
      if (distance > CONFIG.SWIPE_THRESHOLD_PX) goToSlide(currentIndex + 1);
      else if (distance < -CONFIG.SWIPE_THRESHOLD_PX) goToSlide(currentIndex - 1);
    }, { passive: true });

    goToSlide(0);
  }
};

// ============================================================================
// 10. COMPONENTE: CONFIGURAÇÃO INSTITUCIONAL DA LOJA
// ============================================================================
const StoreConfigComponent = {
  apply() {
    const cfg = window.STORE_CONFIG || {};

    this.setText('footerWhatsappText', cfg.whatsappFormatted ? `WhatsApp: ${cfg.whatsappFormatted}` : null);
    this.setText('storeEmail', cfg.email);
    this.setText('footerEmailText', cfg.email);
    this.setText('storeInstagram', cfg.instagram ? `${cfg.instagram} no Instagram →` : null);
    this.setText('footerInstagramText', cfg.instagram);
    const storeIgLink = document.getElementById('storeInstagram');
    if (storeIgLink && cfg.instagramUrl) {
      storeIgLink.href = cfg.instagramUrl;
    }
    this.setText('storeAddress', cfg.address);

    const directBtn = document.getElementById('directWhatsappBtn');
    if (directBtn) {
      if (cfg.whatsappDirectUrl) {
        directBtn.href = cfg.whatsappDirectUrl;
      } else if (cfg.whatsappNumber) {
        const phone = cfg.whatsappNumber.replace(/\D/g, '');
        const msg = encodeURIComponent('Olá, Freelancer Discos! Estava navegando no site e gostaria de falar com a equipe de curadoria.');
        directBtn.href = `https://wa.me/${phone}?text=${msg}`;
      }
    }
  },

  setText(id, value) {
    if (!value) return;
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }
};

// ============================================================================
// 11. INICIALIZAÇÃO DA APLICAÇÃO (APP CONTROLLER)
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  // Estado
  let allRecords = [];
  let filteredRecords = [];
  let displayedCount = CONFIG.PAGE_SIZE;
  let searchTerm = '';

  const cartManager = new CartManager(StorageService.loadCart());

  // Inicializa Views
  CatalogView.init();
  CartView.init();
  CarouselComponent.init();
  StoreConfigComponent.apply();

  // Helper para persistir e sincronizar sacola
  const syncCartState = () => {
    StorageService.saveCart(cartManager.items);
    CartView.updateBadges(cartManager.getCount(), cartManager);
    CartView.render(cartManager);
  };

  // Filtragem de catálogo
  const applyCatalogFilter = () => {
    const cleanSearch = Formatters.normalizeSearchText(searchTerm);
    filteredRecords = allRecords.filter(record => {
      if (!cleanSearch) return true;
      const cleanArtist = Formatters.normalizeSearchText(record.artista);
      const cleanTitle = Formatters.normalizeSearchText(record.titulo);
      return cleanArtist.includes(cleanSearch) || cleanTitle.includes(cleanSearch);
    });

    displayedCount = CONFIG.PAGE_SIZE;
    CatalogView.renderRecords(filteredRecords, cartManager, displayedCount);
  };

  // Carregamento de dados (se a página tiver grade de catálogo)
  if (CatalogView.grid) {
    CatalogView.renderLoading();
    try {
      allRecords = await CatalogService.loadAllRecords();
      filteredRecords = [...allRecords];
      CatalogView.renderRecords(filteredRecords, cartManager, displayedCount);
    } catch (err) {
      console.error('Erro ao carregar catálogo:', err);
      CatalogView.renderError();
    }
  }

  // Sincroniza visual inicial da sacola
  syncCartState();

  // Busca e debounce
  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');
  let debounceTimer = null;

  searchInput?.addEventListener('input', (e) => {
    searchTerm = e.target.value;
    if (searchClear) searchClear.style.display = searchTerm ? 'grid' : 'none';

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(applyCatalogFilter, CONFIG.SEARCH_DEBOUNCE_MS);
  });

  searchClear?.addEventListener('click', () => {
    searchInput.value = '';
    searchTerm = '';
    searchClear.style.display = 'none';
    applyCatalogFilter();
    searchInput.focus();
  });

  // Paginação
  document.getElementById('loadMoreBtn')?.addEventListener('click', () => {
    displayedCount += CONFIG.PAGE_SIZE;
    CatalogView.renderRecords(filteredRecords, cartManager, displayedCount);
  });

  // Ações da Sacola
  const handleAddToCart = (recordId) => {
    const record = allRecords.find(r => r.id === recordId);
    if (!record) return;

    if (cartManager.has(recordId)) {
      CartView.open();
      return;
    }

    cartManager.add(record);
    syncCartState();
    CartView.pulseButtons();
  };

  const handleRemoveFromCart = (recordId) => {
    cartManager.remove(recordId);
    syncCartState();
  };

  // Eventos delegados de clique (Adicionar / Remover)
  document.addEventListener('click', (e) => {
    const addBtn = e.target.closest('[data-action="add-cart"]');
    if (addBtn) {
      handleAddToCart(Number(addBtn.getAttribute('data-id')));
      return;
    }

    const removeBtn = e.target.closest('[data-action="remove-item"]');
    if (removeBtn) {
      handleRemoveFromCart(Number(removeBtn.getAttribute('data-id')));
      return;
    }
  });

  // Controles do Drawer
  document.getElementById('cartTrigger')?.addEventListener('click', () => CartView.open());
  document.getElementById('floatingCartBtn')?.addEventListener('click', () => CartView.open());
  document.getElementById('drawerCloseBtn')?.addEventListener('click', () => CartView.close());
  document.getElementById('cartOverlay')?.addEventListener('click', () => CartView.close());
  document.getElementById('clearCartBtn')?.addEventListener('click', () => {
    cartManager.clear();
    syncCartState();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && CartView.drawer?.classList.contains('open')) {
      CartView.close();
    }
  });

  // Finalização do Pedido via WhatsApp
  document.getElementById('checkoutWhatsappBtn')?.addEventListener('click', () => {
    if (cartManager.getCount() === 0) return;

    const customerName = document.getElementById('customerName')?.value.trim() || '';
    const customerCity = document.getElementById('customerCity')?.value.trim() || '';
    const checkoutUrl = OrderService.buildCheckoutUrl(cartManager, customerName, customerCity);

    window.open(checkoutUrl, '_blank', 'noopener');
  });

  // Menu Mobile
  const menuToggle = document.getElementById('menuToggle');
  const mobileMenu = document.getElementById('mobileMenu');
  menuToggle?.addEventListener('click', () => mobileMenu?.classList.toggle('open'));
  document.querySelectorAll('.mobile-link').forEach(link => {
    link.addEventListener('click', () => mobileMenu?.classList.remove('open'));
  });
});
