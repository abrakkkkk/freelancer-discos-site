/**
 * app.js - Lógica interativa da Freelancer Discos
 * - Estante generativa
 * - Catálogo das Caixas 50 e 51 com busca instantânea e filtros
 * - Sacola de compras persistente e checkout direto no WhatsApp
 */

document.addEventListener('DOMContentLoaded', () => {
  // ==========================================================================
  // 1. ESTADO GLOBAL DA APLICAÇÃO
  // ==========================================================================
  let allRecords = [];
  let filteredRecords = [];
  let displayedCount = 24;
  const PAGE_SIZE = 24;
  let activeFilter = 'all';
  let searchTerm = '';

  // Sacola recuperada do localStorage
  let cart = [];
  try {
    cart = JSON.parse(localStorage.getItem('freelancer_cart') || '[]');
  } catch (_) {
    cart = [];
  }

  // ==========================================================================
  // 2. ELEMENTOS DO DOM
  // ==========================================================================
  const catalogGrid = document.getElementById('catalogGrid');
  const catalogCount = document.getElementById('catalogCount');
  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');
  const filterPills = document.querySelectorAll('.pill-btn');
  const loadMoreContainer = document.getElementById('loadMoreContainer');
  const loadMoreBtn = document.getElementById('loadMoreBtn');

  // Sacola
  const cartTrigger = document.getElementById('cartTrigger');
  const floatingCartBtn = document.getElementById('floatingCartBtn');
  const cartDrawer = document.getElementById('cartDrawer');
  const cartOverlay = document.getElementById('cartOverlay');
  const drawerCloseBtn = document.getElementById('drawerCloseBtn');
  const cartItemsList = document.getElementById('cartItemsList');
  const drawerFooter = document.getElementById('drawerFooter');
  const cartSubtotal = document.getElementById('cartSubtotal');
  const cartBadge = document.getElementById('cartBadge');
  const floatingCartBadge = document.getElementById('floatingCartBadge');
  const drawerItemCount = document.getElementById('drawerItemCount');
  const checkoutWhatsappBtn = document.getElementById('checkoutWhatsappBtn');
  const clearCartBtn = document.getElementById('clearCartBtn');
  const customerName = document.getElementById('customerName');
  const customerCity = document.getElementById('customerCity');

  // Navegação Mobile
  const menuToggle = document.getElementById('menuToggle');
  const mobileMenu = document.getElementById('mobileMenu');
  const mobileLinks = document.querySelectorAll('.mobile-link');

  // Informações de Contato Dinâmicas
  applyStoreConfig();

  // ==========================================================================
  // 3. ESTANTE GENERATIVA VIVA (SEÇÃO QUEM SOMOS)
  // ==========================================================================
  function initGenerativeShelf() {
    const shelfEl = document.getElementById('shelf');
    if (!shelfEl) return;
    shelfEl.innerHTML = '';

    // Gerador pseudo-aleatório determinístico para manter harmonia visual
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

    for (let i = 0; i < 3; i++) {
      const row = document.createElement('div');
      row.className = 'row';
      const count = window.innerWidth < 640 ? 18 : 28;

      for (let j = 0; j < count; j++) {
        const spine = document.createElement('b');
        const width = 8 + rnd() * 14;
        const height = 60 + rnd() * 40;
        const hue = 10 + rnd() * 45; // Tons quentes vintage (terracota, âmbar, mogno)
        const sat = 28 + rnd() * 32;
        const lum = 20 + rnd() * 38;

        spine.style.width = `${width}px`;
        spine.style.height = `${height}%`;
        spine.style.background = `hsl(${hue}, ${sat}%, ${lum}%)`;
        row.appendChild(spine);
      }
      shelfEl.appendChild(row);
    }
  }

  // ==========================================================================
  // 4. UTILITÁRIOS E FORMATAÇÃO
  // ==========================================================================
  function formatPrice(value) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  function normalizeText(text) {
    if (!text) return '';
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function generateAlbumColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
      '#8e1f18', '#14285e', '#d9772b', '#1f5a34', 
      '#6c3483', '#b03a2e', '#196f3d', '#283747', '#78281f'
    ];
    return colors[Math.abs(hash) % colors.length];
  }

  function applyStoreConfig() {
    const cfg = window.STORE_CONFIG || {};
    if (cfg.whatsappFormatted) {
      const footerWa = document.getElementById('footerWhatsappText');
      if (footerWa) footerWa.textContent = `WhatsApp: ${cfg.whatsappFormatted}`;
    }
    if (cfg.email) {
      const storeEmail = document.getElementById('storeEmail');
      const footerEmail = document.getElementById('footerEmailText');
      if (storeEmail) storeEmail.textContent = cfg.email;
      if (footerEmail) footerEmail.textContent = cfg.email;
    }
    if (cfg.instagram) {
      const storeIg = document.getElementById('storeInstagram');
      const footerIg = document.getElementById('footerInstagramText');
      if (storeIg) storeIg.textContent = `${cfg.instagram} no Instagram →`;
      if (footerIg) footerIg.textContent = cfg.instagram;
    }
    if (cfg.address) {
      const storeAddr = document.getElementById('storeAddress');
      if (storeAddr) storeAddr.textContent = cfg.address;
    }

    const directBtn = document.getElementById('directWhatsappBtn');
    if (directBtn && cfg.whatsappNumber) {
      const cleanPhone = cfg.whatsappNumber.replace(/\D/g, '');
      const msg = encodeURIComponent(`Olá, Freelancer Discos! Estava navegando no site e gostaria de falar com a equipe de curadoria.`);
      directBtn.href = `https://wa.me/${cleanPhone}?text=${msg}`;
    }
  }

  // ==========================================================================
  // 5. CARREGAMENTO DO CATÁLOGO DE DISCOS (TEMPO REAL SUPABASE + FALLBACK LOCAL)
  // ==========================================================================
  async function loadCatalog() {
    try {
      catalogCount.textContent = 'Sincronizando acervo em tempo real...';

      // 1. Carrega o mapa base de capas a partir de data/discos.json
      let coverMap = {};
      let localFallbackRecords = [];
      try {
        const localRes = await fetch('data/discos.json');
        if (localRes.ok) {
          localFallbackRecords = await localRes.json();
          localFallbackRecords.forEach(d => {
            if (d.capa_url) {
              coverMap[d.id] = d.capa_url;
              const qKey = `${d.artista}_${d.titulo}`.toLowerCase();
              coverMap[qKey] = d.capa_url;
            }
          });
        }
      } catch (_) {}

      // Recupera cache adicional salvo no navegador
      try {
        const clientCoverCache = JSON.parse(localStorage.getItem('freelancer_covers') || '{}');
        coverMap = { ...coverMap, ...clientCoverCache };
      } catch (_) {}

      // 2. Consulta ao vivo o Supabase (com suporte a capa_url em tempo real)
      const cfg = window.STORE_CONFIG || {};
      const supabaseUrl = cfg.supabaseUrl;
      const anonKey = cfg.supabaseAnonKey;
      let liveRecords = null;

      if (supabaseUrl && anonKey) {
        try {
          // Tenta consultar incluindo capa_url ao vivo
          let queryUrl = `${supabaseUrl}/rest/v1/discos?select=id,artista,titulo,preco,caixa,ano,observacao,ativo,deletado,capa_url&caixa=in.(49,50,51,Caixa%2049,Caixa%2050,Caixa%2051)&deletado=eq.false&ativo=eq.true&order=artista.asc`;
          let res = await fetch(queryUrl, {
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${anonKey}`,
              'Accept-Profile': 'public'
            }
          });

          // Se a coluna capa_url ainda não foi criada no Supabase, consulta sem ela
          if (!res.ok) {
            queryUrl = `${supabaseUrl}/rest/v1/discos?select=id,artista,titulo,preco,caixa,ano,observacao,ativo,deletado&caixa=in.(49,50,51,Caixa%2049,Caixa%2050,Caixa%2051)&deletado=eq.false&ativo=eq.true&order=artista.asc`;
            res = await fetch(queryUrl, {
              headers: {
                apikey: anonKey,
                Authorization: `Bearer ${anonKey}`,
                'Accept-Profile': 'public'
              }
            });
          }

          if (res.ok) {
            liveRecords = await res.json();
          }
        } catch (err) {
          console.warn('Conexão ao Supabase falhou, usando acervo local:', err);
        }
      }

      // 3. Monta o catálogo (dando prioridade à capa_url em tempo real)
      if (liveRecords && liveRecords.length > 0) {
        allRecords = liveRecords.map((item, idx) => {
          const qKey = `${item.artista || ''}_${item.titulo || ''}`.toLowerCase();
          const capa = item.capa_url || coverMap[item.id] || coverMap[qKey] || null;

          return {
            id: item.id,
            numero: idx + 1,
            artista: (item.artista || 'Artista Desconhecido').trim(),
            titulo: (item.titulo || 'Sem Título').trim(),
            preco: Number(item.preco) || 0,
            caixa: item.caixa ? String(item.caixa) : 'Caixa 50',
            ano: item.ano ? String(item.ano).trim() : null,
            capa_url: capa,
            observacao: item.observacao ? item.observacao.trim() : null
          };
        });
      } else if (localFallbackRecords.length > 0) {
        allRecords = localFallbackRecords;
      } else {
        catalogGrid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 48px var(--space-4); color: var(--color-text-muted);">
            <p style="font-size: 18px; margin-bottom: 12px; color: var(--color-brand-primary);">Não foi possível carregar os discos no momento.</p>
          </div>
        `;
        catalogCount.textContent = 'Erro ao carregar catálogo';
        return;
      }

      filteredRecords = [...allRecords];
      displayedCount = PAGE_SIZE;
      renderCatalog();
    } catch (err) {
      console.error('Erro ao carregar catálogo:', err);
      catalogGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px var(--space-4); color: var(--color-text-muted);">
          <p style="font-size: 18px; margin-bottom: 12px; color: var(--color-brand-primary);">Não foi possível carregar os discos no momento.</p>
        </div>
      `;
      catalogCount.textContent = 'Erro ao carregar catálogo';
    }
  }

  // ==========================================================================
  // 6. RENDERIZAÇÃO DO GRID DE DISCOS
  // ==========================================================================
  function renderCatalog() {
    catalogGrid.innerHTML = '';

    if (filteredRecords.length === 0) {
      catalogGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 56px var(--space-4); color: var(--color-text-muted);">
          <p style="font-size: 20px; font-family: var(--font-editorial-title); font-style: italic; margin-bottom: 8px;">Nenhum disco encontrado para esta busca.</p>
          <p style="font-size: 14px;">Tente pesquisar outro artista ou nome do álbum.</p>
        </div>
      `;
      catalogCount.textContent = '0 discos encontrados';
      loadMoreContainer.style.display = 'none';
      return;
    }

    const toRender = filteredRecords.slice(0, displayedCount);

    toRender.forEach(record => {
      const inCart = cart.some(item => item.id === record.id);
      const fallbackColor = generateAlbumColor(record.artista + record.titulo);

      // Tratamento da Capa: se tiver capa_url usa <img> com fallback on error; se não, usa arte vetorial
      let coverHtml = '';
      if (record.capa_url) {
        coverHtml = `
          <img src="${record.capa_url}" 
               alt="${record.titulo} - ${record.artista}" 
               class="record-cover-img" 
               loading="lazy" 
               onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';">
          <div class="record-fallback-art" style="display: none; --album-color: ${fallbackColor};">
            <i></i>
          </div>
        `;
      } else {
        coverHtml = `
          <div class="record-fallback-art" style="--album-color: ${fallbackColor};">
            <i></i>
          </div>
        `;
      }

      const card = document.createElement('article');
      card.className = 'record-card';
      card.setAttribute('data-id', record.id);

      card.innerHTML = `
        <div class="record-top-meta">
          <span class="record-num">${String(record.numero).padStart(2, '0')}</span>
          <span class="record-badge">Vinil LP</span>
        </div>

        <div class="record-artwork">
          ${coverHtml}
        </div>

        <div class="record-info">
          <span class="record-artist">${record.artista}</span>
          <h3 class="record-title">${record.titulo}</h3>
          
          <div class="record-price-row">
            <span class="record-price">${formatPrice(record.preco)}</span>
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

      catalogGrid.appendChild(card);
    });

    // Atualiza contadores
    const countText = filteredRecords.length === 1 
      ? '1 disco encontrado' 
      : `${filteredRecords.length} discos encontrados (exibindo ${toRender.length})`;
    catalogCount.textContent = countText;

    // Controle do Botão Carregar Mais
    if (filteredRecords.length > displayedCount) {
      loadMoreContainer.style.display = 'flex';
      const remaining = filteredRecords.length - displayedCount;
      loadMoreBtn.textContent = `Carregar mais vinis (+${Math.min(PAGE_SIZE, remaining)})`;
    } else {
      loadMoreContainer.style.display = 'none';
    }
  }

  // ==========================================================================
  // 7. FILTROS E BUSCA EM TEMPO REAL
  // ==========================================================================
  function filterCatalog() {
    const termClean = normalizeText(searchTerm);

    filteredRecords = allRecords.filter(record => {
      if (!termClean) return true;
      const artistClean = normalizeText(record.artista);
      const titleClean = normalizeText(record.titulo);

      return artistClean.includes(termClean) || titleClean.includes(termClean);
    });

    displayedCount = PAGE_SIZE;
    renderCatalog();
  }

  // Evento de Digitação na Busca (com resposta imediata)
  let searchTimer = null;
  searchInput.addEventListener('input', (e) => {
    searchTerm = e.target.value;
    searchClear.style.display = searchTerm ? 'grid' : 'none';

    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      filterCatalog();
    }, 120);
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchTerm = '';
    searchClear.style.display = 'none';
    filterCatalog();
    searchInput.focus();
  });

  // Evento das Pílulas de Filtro (Caixas 50 / 51)
  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => {
        p.classList.remove('active');
        p.setAttribute('aria-selected', 'false');
      });
      pill.classList.add('active');
      pill.setAttribute('aria-selected', 'true');

      activeFilter = pill.getAttribute('data-filter');
      filterCatalog();
    });
  });

  // Botão Carregar Mais
  loadMoreBtn.addEventListener('click', () => {
    displayedCount += PAGE_SIZE;
    renderCatalog();
  });

  // ==========================================================================
  // 8. GERENCIAMENTO DA SACOLA DE COMPRAS (CART)
  // ==========================================================================
  function saveCart() {
    localStorage.setItem('freelancer_cart', JSON.stringify(cart));
    updateCartBadges();
    renderCartDrawer();
  }

  function updateCartBadges() {
    const totalItems = cart.length;
    cartBadge.textContent = totalItems;
    floatingCartBadge.textContent = totalItems;

    // Atualiza estado dos botões nos cards já renderizados
    const addButtons = document.querySelectorAll('.btn-add-cart');
    addButtons.forEach(btn => {
      const id = Number(btn.getAttribute('data-id'));
      const inCart = cart.some(item => item.id === id);
      if (inCart) {
        btn.classList.add('added');
        btn.textContent = 'Na Sacola ✓';
      } else {
        btn.classList.remove('added');
        btn.textContent = '+ Sacola';
      }
    });
  }

  function addToCart(recordId) {
    const record = allRecords.find(r => r.id === recordId);
    if (!record) return;

    const existingIndex = cart.findIndex(item => item.id === recordId);
    if (existingIndex > -1) {
      // Já está na sacola: abre a sacola para visualizar
      openCart();
      return;
    }

    // Adiciona o item à sacola
    cart.push({
      id: record.id,
      artista: record.artista,
      titulo: record.titulo,
      preco: record.preco,
      caixa: record.caixa,
      capa_url: record.capa_url
    });

    saveCart();

    // Feedback visual animado no botão da sacola
    cartTrigger.classList.add('pulse');
    floatingCartBtn.classList.add('pulse');
    setTimeout(() => {
      cartTrigger.classList.remove('pulse');
      floatingCartBtn.classList.remove('pulse');
    }, 600);
  }

  function removeFromCart(recordId) {
    cart = cart.filter(item => item.id !== recordId);
    saveCart();
  }

  function clearCart() {
    cart = [];
    saveCart();
  }

  function calculateCartTotal() {
    return cart.reduce((acc, item) => acc + (Number(item.preco) || 0), 0);
  }

  function renderCartDrawer() {
    cartItemsList.innerHTML = '';
    const totalCount = cart.length;
    drawerItemCount.textContent = totalCount === 1 ? '1 disco selecionado' : `${totalCount} discos selecionados`;

    if (totalCount === 0) {
      drawerFooter.style.display = 'none';
      cartItemsList.innerHTML = `
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
      return;
    }

    drawerFooter.style.display = 'block';

    cart.forEach(item => {
      const itemEl = document.createElement('div');
      itemEl.className = 'cart-item-card';

      const thumbImg = item.capa_url 
        ? `<img src="${item.capa_url}" alt="${item.titulo}" class="cart-item-thumb">`
        : `<div class="cart-item-thumb" style="background: ${generateAlbumColor(item.artista)}; display: grid; place-items: center; color: #fff; font-size: 11px; font-weight: 700;">VINIL</div>`;

      itemEl.innerHTML = `
        ${thumbImg}
        <div class="cart-item-details">
          <span class="cart-item-artist">${item.artista} (${item.caixa})</span>
          <h4 class="cart-item-title">${item.titulo}</h4>
          <span class="cart-item-price">${formatPrice(item.preco)}</span>
        </div>
        <button type="button" class="cart-item-remove-btn" data-action="remove-item" data-id="${item.id}" aria-label="Remover disco">
          &times;
        </button>
      `;

      cartItemsList.appendChild(itemEl);
    });

    cartSubtotal.textContent = formatPrice(calculateCartTotal());
  }

  function openCart() {
    cartDrawer.classList.add('open');
    cartOverlay.classList.add('open');
    cartDrawer.setAttribute('aria-hidden', 'false');
    cartOverlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeCart() {
    cartDrawer.classList.remove('open');
    cartOverlay.classList.remove('open');
    cartDrawer.setAttribute('aria-hidden', 'true');
    cartOverlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  // Eventos de clique na Sacola
  cartTrigger.addEventListener('click', openCart);
  floatingCartBtn.addEventListener('click', openCart);
  drawerCloseBtn.addEventListener('click', closeCart);
  cartOverlay.addEventListener('click', closeCart);
  clearCartBtn.addEventListener('click', clearCart);

  // Escuta tecla Escape para fechar sacola
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && cartDrawer.classList.contains('open')) {
      closeCart();
    }
  });

  // Evento delegado para botões no Catálogo e na Sacola
  document.addEventListener('click', (e) => {
    const addBtn = e.target.closest('[data-action="add-cart"]');
    if (addBtn) {
      const id = Number(addBtn.getAttribute('data-id'));
      addToCart(id);
      return;
    }

    const removeBtn = e.target.closest('[data-action="remove-item"]');
    if (removeBtn) {
      const id = Number(removeBtn.getAttribute('data-id'));
      removeFromCart(id);
      return;
    }
  });

  // ==========================================================================
  // 9. CHECKOUT E FINALIZAÇÃO NO WHATSAPP
  // ==========================================================================
  checkoutWhatsappBtn.addEventListener('click', () => {
    if (cart.length === 0) return;

    const cfg = window.STORE_CONFIG || {};
    const rawNumber = cfg.whatsappNumber || '5511999999999';
    const cleanNumber = rawNumber.replace(/\D/g, '');

    const name = customerName.value.trim();
    const city = customerCity.value.trim();
    const total = formatPrice(calculateCartTotal());

    let message = `${cfg.orderGreeting || 'Olá, Freelancer Discos! Gostaria de comprar os seguintes vinis:'}\n\n`;

    cart.forEach((item, index) => {
      message += `${index + 1}. *${item.artista}* — _${item.titulo}_ (${item.caixa}) • ${formatPrice(item.preco)}\n`;
    });

    message += `\n*Total dos Discos:* ${total}\n`;

    if (name) {
      message += `*Nome:* ${name}\n`;
    }
    if (city) {
      message += `*Local/Frete:* ${city}\n`;
    }

    message += `\nAguardo a confirmação dos dados e dados para pagamento via Pix. Obrigado!`;

    const encodedMsg = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodedMsg}`;

    window.open(whatsappUrl, '_blank', 'noopener');
  });

  // ==========================================================================
  // 10. MENU MOBILE (HAMBURGUER)
  // ==========================================================================
  if (menuToggle && mobileMenu) {
    menuToggle.addEventListener('click', () => {
      mobileMenu.classList.toggle('open');
    });

    mobileLinks.forEach(link => {
      link.addEventListener('click', () => {
        mobileMenu.classList.remove('open');
      });
    });
  }

  // ==========================================================================
  // 11. CARROSSEL DE FOTOS DO ESPAÇO (QUEM SOMOS)
  // ==========================================================================
  function initAboutCarousel() {
    const track = document.getElementById('carouselTrack');
    const slides = document.querySelectorAll('.carousel-slide');
    const prevBtn = document.getElementById('carouselPrevBtn');
    const nextBtn = document.getElementById('carouselNextBtn');
    const dots = document.querySelectorAll('.carousel-dot');
    const counterNum = document.getElementById('currentSlideNum');
    
    if (!track || slides.length === 0) return;

    let currentIndex = 0;
    const totalSlides = slides.length;

    function goToSlide(index) {
      if (index < 0) {
        currentIndex = totalSlides - 1;
      } else if (index >= totalSlides) {
        currentIndex = 0;
      } else {
        currentIndex = index;
      }

      // Desloca o trilho com animação CSS suave
      track.style.transform = `translateX(-${currentIndex * 100}%)`;

      // Atualiza classes ativas nos slides
      slides.forEach((slide, i) => {
        slide.classList.toggle('is-active', i === currentIndex);
        slide.setAttribute('aria-hidden', i !== currentIndex ? 'true' : 'false');
      });

      // Atualiza dots indicadores
      dots.forEach((dot, i) => {
        dot.classList.toggle('is-active', i === currentIndex);
        dot.setAttribute('aria-selected', i === currentIndex ? 'true' : 'false');
      });

      // Atualiza badge numérico editorial (ex: 01, 02, 03)
      if (counterNum) {
        counterNum.textContent = String(currentIndex + 1).padStart(2, '0');
      }
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', () => goToSlide(currentIndex - 1));
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => goToSlide(currentIndex + 1));
    }

    dots.forEach((dot, i) => {
      dot.addEventListener('click', () => goToSlide(i));
    });

    // Suporte a Touch Swipe no Mobile
    let touchStartX = 0;
    let touchEndX = 0;

    track.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    track.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      const swipeDistance = touchStartX - touchEndX;
      if (swipeDistance > 40) {
        goToSlide(currentIndex + 1);
      } else if (swipeDistance < -40) {
        goToSlide(currentIndex - 1);
      }
    }, { passive: true });

    goToSlide(0);
  }

  // ==========================================================================
  // 12. INICIALIZAÇÃO
  // ==========================================================================
  initAboutCarousel();
  loadCatalog();
  updateCartBadges();
  renderCartDrawer();
});
