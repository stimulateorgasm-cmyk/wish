/**
 * WISHLIST — ЧТО ПОДАРИТЬ.
 * Pure Vanilla JavaScript Client Application
 * Features:
 * - Live search & instant filtering (category, status, budget)
 * - Sorting (price, date, author order)
 * - Fullscreen Lightbox image quick-view
 * - Reservation workflow with API integration (GET /api/items, POST /api/reserve)
 * - Local storage of user's own reservations ("Забронировано вами")
 * - Wishlist progress bar
 * - Web Share API integration
 * - Smooth state transitions and toasts
 */

(function () {
  'use strict';

  // Local Storage Key for remembering user's own reserved items
  const STORAGE_KEY_MY_RESERVATIONS = 'wishlist_my_reservations_ids';

  // Load user's reservations from local storage
  function getStoredReservations() {
    try {
      const data = localStorage.getItem(STORAGE_KEY_MY_RESERVATIONS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  function saveStoredReservation(id) {
    try {
      const list = getStoredReservations();
      if (!list.includes(id)) {
        list.push(id);
        localStorage.setItem(STORAGE_KEY_MY_RESERVATIONS, JSON.stringify(list));
      }
    } catch (e) {
      console.warn('Не удалось сохранить бронь в localStorage:', e);
    }
  }

  // State Management
  const state = {
    items: [],
    loading: true,
    error: null,
    selectedCategory: 'all',
    selectedStatus: 'all', // 'all' | 'active' | 'reserved'
    sortBy: 'default',     // 'default' | 'price-asc' | 'price-desc' | 'date-desc'
    pricePreset: 'all',    // 'all' | 'under-10k' | '10k-30k' | 'above-30k' | 'priceless'
    searchQuery: '',
    myReservations: getStoredReservations(),
    activeModalItem: null,
    activeLightboxItem: null,
    isSubmitting: false,
  };

  // DOM Elements Cache
  const elements = {
    grid: document.getElementById('wishlist-grid'),
    categoriesScroll: document.getElementById('categories-scroll'),
    statusToggles: document.querySelectorAll('.status-toggle-btn'),
    sortSelect: document.getElementById('sort-select'),
    priceFilterSelect: document.getElementById('price-filter-select'),
    searchInput: document.getElementById('search-input'),
    searchClearBtn: document.getElementById('search-clear-btn'),
    totalCountEl: document.getElementById('total-items-count'),
    activeCountEl: document.getElementById('active-items-count'),
    progressBar: document.getElementById('wishlist-progress-bar'),
    btnShareWishlist: document.getElementById('btn-share-wishlist'),
    toastContainer: document.getElementById('toast-container'),
    // Reservation Modal
    modalBackdrop: document.getElementById('reserve-modal'),
    modalForm: document.getElementById('reserve-form'),
    modalThumb: document.getElementById('modal-item-thumb'),
    modalTitle: document.getElementById('modal-item-title'),
    modalPrice: document.getElementById('modal-item-price'),
    modalItemCategory: document.getElementById('modal-item-category'),
    inputName: document.getElementById('reserve-name'),
    inputNote: document.getElementById('reserve-note'),
    btnCancel: document.getElementById('btn-modal-cancel'),
    btnClose: document.getElementById('btn-modal-close'),
    btnSubmit: document.getElementById('btn-modal-submit'),
    // Lightbox Modal
    lightboxModal: document.getElementById('lightbox-modal'),
    lightboxImg: document.getElementById('lightbox-img'),
    lightboxCategory: document.getElementById('lightbox-category'),
    lightboxTitle: document.getElementById('lightbox-title'),
    lightboxDesc: document.getElementById('lightbox-desc'),
    lightboxPrice: document.getElementById('lightbox-price'),
    btnLightboxReserve: document.getElementById('btn-lightbox-reserve'),
    btnLightboxClose: document.getElementById('btn-lightbox-close'),
  };

  /**
   * Currency formatter helper
   */
  function formatPrice(price, currency) {
    if (price === null || price === undefined || isNaN(price)) {
      return { isPriceless: true, text: 'Бесценно' };
    }
    const curr = currency || 'RUB';
    let symbol = '₽';
    if (curr === 'USD') symbol = '$';
    else if (curr === 'EUR') symbol = '€';
    else if (curr !== 'RUB') symbol = curr;

    const formattedNum = new Intl.NumberFormat('ru-RU').format(price);
    return {
      isPriceless: false,
      text: `${formattedNum} ${symbol}`,
    };
  }

  /**
   * Safe HTML Escaping
   */
  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Toast notification engine
   */
  function showToast(title, message, isError = false) {
    if (!elements.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast ${isError ? 'is-error' : ''}`;
    toast.setAttribute('role', 'alert');

    const iconSvg = isError
      ? `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
      : `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;

    toast.innerHTML = `
      ${iconSvg}
      <div class="toast-body">
        <div class="toast-title">${escapeHTML(title)}</div>
        ${message ? `<div class="toast-msg">${escapeHTML(message)}</div>` : ''}
      </div>
      <button class="toast-close" type="button" aria-label="Закрыть">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;

    elements.toastContainer.appendChild(toast);

    function dismiss() {
      toast.classList.add('is-hiding');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 260);
    }

    toast.querySelector('.toast-close').addEventListener('click', dismiss);
    setTimeout(dismiss, 4200);
  }

  /**
   * Fetch items from API (GET /api/items)
   */
  async function fetchItems() {
    state.loading = true;
    state.error = null;
    renderSkeletons();

    try {
      const response = await fetch('/api/items', {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Сервер вернул статус ${response.status}`);
      }

      const data = await response.json();
      state.items = Array.isArray(data.items) ? data.items : [];
      state.loading = false;
      state.error = null;

      updateCategoryTabs();
      updateHeaderStats();
      renderItems();
    } catch (err) {
      console.error('Ошибка загрузки вишлиста:', err);
      state.loading = false;
      state.error = err.message || 'Не удалось связаться с сервером';
      renderErrorState();
    }
  }

  /**
   * Update header counters & progress bar
   */
  function updateHeaderStats() {
    const total = state.items.length;
    const active = state.items.filter((item) => item.status === 'active').length;
    const reserved = total - active;

    if (elements.totalCountEl) elements.totalCountEl.textContent = total;
    if (elements.activeCountEl) elements.activeCountEl.textContent = active;

    if (elements.progressBar) {
      const pct = total > 0 ? Math.round((reserved / total) * 100) : 0;
      elements.progressBar.style.width = `${pct}%`;
    }
  }

  /**
   * Render loading skeleton cards
   */
  function renderSkeletons() {
    if (!elements.grid) return;
    const skeletons = Array.from({ length: 6 })
      .map(
        () => `
        <div class="skeleton-card" aria-hidden="true">
          <div class="skeleton-img skeleton-shimmer"></div>
          <div class="skeleton-body">
            <div class="skeleton-line skeleton-shimmer" style="width: 35%;"></div>
            <div class="skeleton-line skeleton-shimmer" style="width: 85%; height: 18px;"></div>
            <div class="skeleton-line skeleton-shimmer" style="width: 65%;"></div>
            <div class="skeleton-line skeleton-shimmer" style="width: 45%; margin-top: 1rem; height: 22px;"></div>
          </div>
        </div>
      `
      )
      .join('');
    elements.grid.innerHTML = skeletons;
  }

  /**
   * Render Error State
   */
  function renderErrorState() {
    if (!elements.grid) return;
    elements.grid.innerHTML = `
      <div class="state-box" style="grid-column: 1 / -1;">
        <div class="state-icon error">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <h3 class="state-title">Не удалось открыть список</h3>
        <p class="state-desc">Произошла ошибка при загрузке данных: ${escapeHTML(state.error)}. Возможно, сервер временно недоступен.</p>
        <button id="btn-retry" class="btn btn-primary" type="button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
          Попробовать снова
        </button>
      </div>
    `;

    const retryBtn = document.getElementById('btn-retry');
    if (retryBtn) {
      retryBtn.addEventListener('click', fetchItems);
    }
  }

  /**
   * Update category filter buttons dynamically based on items
   */
  function updateCategoryTabs() {
    if (!elements.categoriesScroll) return;

    // Collect unique categories
    const categoriesMap = new Map();
    categoriesMap.set('all', { name: 'Все', count: state.items.length });

    state.items.forEach((item) => {
      const cat = item.category ? item.category.trim() : 'Другое';
      if (!categoriesMap.has(cat)) {
        categoriesMap.set(cat, { name: cat, count: 0 });
      }
      categoriesMap.get(cat).count += 1;
    });

    let html = '';
    categoriesMap.forEach((info, key) => {
      const isActive = state.selectedCategory === key;
      html += `
        <button 
          type="button" 
          class="filter-btn ${isActive ? 'active' : ''}" 
          data-category="${escapeHTML(key)}"
        >
          <span>${escapeHTML(info.name)}</span>
          <span class="count">${info.count}</span>
        </button>
      `;
    });

    elements.categoriesScroll.innerHTML = html;

    // Bind click events
    elements.categoriesScroll.querySelectorAll('.filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.selectedCategory = btn.getAttribute('data-category');
        elements.categoriesScroll.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        renderItems();
      });
    });
  }

  /**
   * Filter and Sort current items
   */
  function getFilteredAndSortedItems() {
    let result = [...state.items];

    // 1. Search Query Filter
    if (state.searchQuery.trim()) {
      const query = state.searchQuery.toLowerCase().trim();
      result = result.filter((item) => {
        const titleMatch = (item.title || '').toLowerCase().includes(query);
        const descMatch = (item.description || '').toLowerCase().includes(query);
        const sourceMatch = (item.source || '').toLowerCase().includes(query);
        const categoryMatch = (item.category || '').toLowerCase().includes(query);
        return titleMatch || descMatch || sourceMatch || categoryMatch;
      });
    }

    // 2. Budget / Price Preset Filter
    if (state.pricePreset !== 'all') {
      result = result.filter((item) => {
        const price = item.price;
        switch (state.pricePreset) {
          case 'under-10k':
            return price !== null && price !== undefined && price <= 10000;
          case '10k-30k':
            return price !== null && price !== undefined && price > 10000 && price <= 30000;
          case 'above-30k':
            return price !== null && price !== undefined && price > 30000;
          case 'priceless':
            return price === null || price === undefined;
          default:
            return true;
        }
      });
    }

    // 3. Category Filter
    if (state.selectedCategory !== 'all') {
      result = result.filter((item) => {
        const cat = item.category ? item.category.trim() : 'Другое';
        return cat === state.selectedCategory;
      });
    }

    // 4. Status Filter
    if (state.selectedStatus === 'active') {
      result = result.filter((item) => item.status === 'active');
    } else if (state.selectedStatus === 'reserved') {
      result = result.filter((item) => item.status === 'reserved');
    }

    // 5. Sorting
    switch (state.sortBy) {
      case 'price-asc':
        result.sort((a, b) => {
          if (a.price === null || a.price === undefined) return 1;
          if (b.price === null || b.price === undefined) return -1;
          return a.price - b.price;
        });
        break;

      case 'price-desc':
        result.sort((a, b) => {
          if (a.price === null || a.price === undefined) return 1;
          if (b.price === null || b.price === undefined) return -1;
          return b.price - a.price;
        });
        break;

      case 'date-desc':
        result.sort((a, b) => {
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          return dateB - dateA;
        });
        break;

      case 'date-asc':
        result.sort((a, b) => {
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          return dateA - dateB;
        });
        break;

      case 'default':
      default:
        result.sort((a, b) => {
          const orderA = typeof a.sort_order === 'number' ? a.sort_order : 9999;
          const orderB = typeof b.sort_order === 'number' ? b.sort_order : 9999;
          return orderA - orderB;
        });
        break;
    }

    return result;
  }

  /**
   * Render Wishlist Grid
   */
  function renderItems() {
    if (!elements.grid) return;

    if (state.loading) {
      renderSkeletons();
      return;
    }

    if (state.error) {
      renderErrorState();
      return;
    }

    const filtered = getFilteredAndSortedItems();

    if (filtered.length === 0) {
      elements.grid.innerHTML = `
        <div class="state-box" style="grid-column: 1 / -1;">
          <div class="state-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
          </div>
          <h3 class="state-title">Подарков не найдено</h3>
          <p class="state-desc">По заданным условиям или поисковому запросу ничего не найдено. Попробуйте сбросить фильтры.</p>
          <button id="btn-reset-filters" class="btn btn-secondary" type="button">Сбросить все фильтры</button>
        </div>
      `;

      const resetBtn = document.getElementById('btn-reset-filters');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          state.searchQuery = '';
          if (elements.searchInput) elements.searchInput.value = '';
          if (elements.searchClearBtn) elements.searchClearBtn.style.display = 'none';

          state.pricePreset = 'all';
          if (elements.priceFilterSelect) elements.priceFilterSelect.value = 'all';

          state.selectedCategory = 'all';
          state.selectedStatus = 'all';
          state.sortBy = 'default';
          if (elements.sortSelect) elements.sortSelect.value = 'default';

          elements.statusToggles.forEach((t) => {
            t.classList.toggle('active', t.getAttribute('data-status') === 'all');
          });

          updateCategoryTabs();
          renderItems();
        });
      }
      return;
    }

    const html = filtered
      .map((item) => {
        const isReserved = item.status === 'reserved';
        const isMyReservation = state.myReservations.includes(item.id);
        const priceObj = formatPrice(item.price, item.currency);
        const sourceText = item.source ? escapeHTML(item.source) : '';
        const categoryText = item.category ? escapeHTML(item.category) : 'Избранное';
        const hasImageUrl = Boolean(item.image_url && item.image_url.trim());

        let badgeStatusClass = 'is-active';
        let badgeStatusText = 'Свободно';

        if (isMyReservation) {
          badgeStatusClass = 'is-my-reservation';
          badgeStatusText = 'Забронировано вами';
        } else if (isReserved) {
          badgeStatusClass = 'is-reserved';
          badgeStatusText = 'Забронировано';
        }

        return `
        <article class="card ${isReserved ? 'is-reserved' : ''}" id="card-${item.id}" data-id="${item.id}">
          <div class="card-image-wrap" data-img-id="${item.id}" title="Нажмите, чтобы рассмотреть фото крупно">
            ${
              hasImageUrl
                ? `<img 
                    src="${escapeHTML(item.image_url)}" 
                    alt="${escapeHTML(item.title)}" 
                    class="card-img" 
                    loading="lazy" 
                    referrerpolicy="no-referrer"
                    onload="this.classList.add('is-loaded')"
                    onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'card-img-fallback\\'><svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\'><rect width=\\'18\\' height=\\'18\\' x=\\'3\\' y=\\'3\\' rx=\\'2\\'/><circle cx=\\'8.5\\' cy=\\'8.5\\' r=\\'1.5\\'/><path d=\\'m21 15-5-5L5 21\\'/></svg><span>Вишлист</span></div>';"
                  />`
                : `<div class="card-img-fallback">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <polyline points="20 12 20 22 4 22 4 12"/>
                      <rect width="20" height="5" x="2" y="7"/>
                      <line x1="12" y1="22" x2="12" y2="7"/>
                      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
                      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
                    </svg>
                    <span>Особый подарок</span>
                  </div>`
            }

            <div class="card-badge-top">
              ${sourceText ? `<span class="badge-source">${sourceText}</span>` : '<span></span>'}
              <span class="badge-status ${badgeStatusClass}">
                ${badgeStatusText}
              </span>
            </div>
          </div>

          <div class="card-content">
            <div class="card-category">${categoryText}</div>
            <h3 class="card-title" title="${escapeHTML(item.title)}">${escapeHTML(item.title)}</h3>
            <p class="card-desc" title="${escapeHTML(item.description || '')}">
              ${escapeHTML(item.description || 'Желанная вещь, проверенная на соответствие стилю и практичности.')}
            </p>

            <div class="card-price-row">
              <span class="card-price-label">Ориентир цены</span>
              <span class="card-price-value ${priceObj.isPriceless ? 'is-priceless' : ''}">
                ${priceObj.text}
              </span>
            </div>

            <div class="card-actions">
              ${
                item.product_url
                  ? `<a 
                      href="${escapeHTML(item.product_url)}" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      class="btn btn-secondary" 
                      title="Открыть страницу товара в магазине"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                      <span>Смотреть</span>
                    </a>`
                  : ''
              }

              ${
                isReserved
                  ? `<button type="button" class="btn btn-disabled" disabled>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      <span>${isMyReservation ? 'Ваш выбор' : 'Уже забрали'}</span>
                    </button>`
                  : `<button 
                      type="button" 
                      class="btn btn-primary btn-reserve" 
                      data-id="${item.id}"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 12 20 22 4 22 4 12"/><rect width="20" height="5" x="2" y="7"/><line x1="12" y1="22" x2="12" y2="7"/></svg>
                      <span>Забронировать</span>
                    </button>`
              }
            </div>

            ${
              isReserved
                ? `<div class="reserved-stamp-bar">
                    ${isMyReservation ? 'Вы взяли на себя этот приятный сюрприз ✨' : 'Кто-то из друзей уже взял на себя эту миссию'}
                   </div>`
                : ''
            }
          </div>
        </article>
      `;
      })
      .join('');

    elements.grid.innerHTML = html;

    // Attach Reservation Buttons Click Handlers
    elements.grid.querySelectorAll('.btn-reserve').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const itemId = btn.getAttribute('data-id');
        const item = state.items.find((it) => String(it.id) === String(itemId));
        if (item) {
          openReservationModal(item);
        }
      });
    });

    // Attach Lightbox click on image wrappers
    elements.grid.querySelectorAll('.card-image-wrap').forEach((wrap) => {
      wrap.addEventListener('click', (e) => {
        e.stopPropagation();
        const itemId = wrap.getAttribute('data-img-id');
        const item = state.items.find((it) => String(it.id) === String(itemId));
        if (item) {
          openLightboxModal(item);
        }
      });
    });
  }

  /**
   * Lightbox Modal Management
   */
  function openLightboxModal(item) {
    if (!elements.lightboxModal || !item) return;
    state.activeLightboxItem = item;

    if (elements.lightboxImg) {
      elements.lightboxImg.src = item.image_url || '';
      elements.lightboxImg.style.display = item.image_url ? 'block' : 'none';
    }
    if (elements.lightboxCategory) elements.lightboxCategory.textContent = item.category || 'Подарок';
    if (elements.lightboxTitle) elements.lightboxTitle.textContent = item.title;
    if (elements.lightboxDesc) {
      elements.lightboxDesc.textContent = item.description || 'Желанный подарок из личного списка.';
    }

    const priceObj = formatPrice(item.price, item.currency);
    if (elements.lightboxPrice) elements.lightboxPrice.textContent = priceObj.text;

    if (elements.btnLightboxReserve) {
      if (item.status === 'reserved') {
        elements.btnLightboxReserve.disabled = true;
        elements.btnLightboxReserve.className = 'btn btn-disabled';
        elements.btnLightboxReserve.textContent = 'Уже забрали';
      } else {
        elements.btnLightboxReserve.disabled = false;
        elements.btnLightboxReserve.className = 'btn btn-primary';
        elements.btnLightboxReserve.textContent = 'Забронировать';
        elements.btnLightboxReserve.onclick = () => {
          closeLightboxModal();
          openReservationModal(item);
        };
      }
    }

    elements.lightboxModal.classList.add('is-open');
    elements.lightboxModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeLightboxModal() {
    if (!elements.lightboxModal) return;
    elements.lightboxModal.classList.remove('is-open');
    elements.lightboxModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    state.activeLightboxItem = null;
  }

  /**
   * Reservation Modal Management
   */
  function openReservationModal(item) {
    if (!elements.modalBackdrop || !item) return;

    state.activeModalItem = item;

    // Populate modal preview
    if (elements.modalTitle) elements.modalTitle.textContent = item.title;
    if (elements.modalItemCategory) {
      elements.modalItemCategory.textContent = item.category || 'Подарок';
    }

    const priceObj = formatPrice(item.price, item.currency);
    if (elements.modalPrice) elements.modalPrice.textContent = priceObj.text;

    if (elements.modalThumb) {
      if (item.image_url) {
        elements.modalThumb.src = item.image_url;
        elements.modalThumb.style.display = 'block';
      } else {
        elements.modalThumb.style.display = 'none';
      }
    }

    if (elements.inputName) elements.inputName.value = '';
    if (elements.inputNote) elements.inputNote.value = '';

    elements.modalBackdrop.classList.add('is-open');
    elements.modalBackdrop.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    setTimeout(() => {
      if (elements.inputName) elements.inputName.focus();
    }, 150);
  }

  function closeReservationModal() {
    if (!elements.modalBackdrop) return;
    elements.modalBackdrop.classList.remove('is-open');
    elements.modalBackdrop.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    state.activeModalItem = null;
    state.isSubmitting = false;
    if (elements.btnSubmit) {
      elements.btnSubmit.disabled = false;
      elements.btnSubmit.innerHTML = `<span>Подтвердить бронь</span>`;
    }
  }

  /**
   * Handle reservation submission (POST /api/reserve)
   */
  async function handleReservationSubmit(e) {
    e.preventDefault();
    if (!state.activeModalItem || state.isSubmitting) return;

    const name = elements.inputName ? elements.inputName.value.trim() : '';
    const note = elements.inputNote ? elements.inputNote.value.trim() : '';

    if (!name) {
      showToast('Укажите ваше имя', 'Пожалуйста, напишите, как вас зовут, чтобы я знал, кого благодарить.', true);
      if (elements.inputName) elements.inputName.focus();
      return;
    }

    const targetItem = state.activeModalItem;
    state.isSubmitting = true;

    if (elements.btnSubmit) {
      elements.btnSubmit.disabled = true;
      elements.btnSubmit.innerHTML = `
        <svg class="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        <span>Бронируем...</span>
      `;
    }

    try {
      const response = await fetch('/api/reserve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          item_id: targetItem.id,
          name: name,
          note: note,
        }),
      });

      if (response.status === 201) {
        // Success
        closeReservationModal();

        // Update local item status smoothly
        targetItem.status = 'reserved';
        if (!targetItem.reservations) targetItem.reservations = [];
        targetItem.reservations.push({
          name: name,
          note: note,
          created_at: new Date().toISOString(),
        });

        // Remember that this user made this reservation
        saveStoredReservation(targetItem.id);
        state.myReservations.push(targetItem.id);

        // Re-render items and trigger celebratory card transition
        renderItems();
        updateHeaderStats();

        // Highlight updated card
        const cardElement = document.getElementById(`card-${targetItem.id}`);
        if (cardElement) {
          cardElement.classList.add('just-reserved');
          setTimeout(() => cardElement.classList.remove('just-reserved'), 1400);
        }

        showToast(
          'Подарок забронирован!',
          `Отлично, ${name}! Этот подарок закреплён за вами. Никто другой его уже не выберет.`
        );
      } else if (response.status === 409) {
        // Already reserved conflict
        closeReservationModal();
        targetItem.status = 'reserved';
        renderItems();
        updateHeaderStats();

        showToast(
          'Опоздали на секунду!',
          'Этот подарок буквально только что успел забронировать кто-то другой.',
          true
        );
      } else if (response.status === 404) {
        closeReservationModal();
        showToast('Подарок не найден', 'Кажется, этот пункт был удален из вишлиста.', true);
        fetchItems();
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Ошибка сервера (${response.status})`);
      }
    } catch (err) {
      console.error('Ошибка при бронировании:', err);
      showToast('Не удалось забронировать', err.message || 'Проверьте соединение с интернетом.', true);
      if (elements.btnSubmit) {
        elements.btnSubmit.disabled = false;
        elements.btnSubmit.innerHTML = `<span>Подтвердить бронь</span>`;
      }
      state.isSubmitting = false;
    }
  }

  /**
   * Share Wishlist Button (Web Share API with Clipboard Fallback)
   */
  async function handleShareWishlist() {
    const shareData = {
      title: 'Wishlist — Что подарить.',
      text: 'Мой личный список желаний. Выбирайте, бронируйте и приходите праздновать!',
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (e) {
        if (e.name === 'AbortError') return;
      }
    }

    // Fallback: Clipboard
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast('Ссылка скопирована', 'Адрес вишлиста скопирован в буфер обмена. Можно отправлять друзьям!');
    } catch {
      showToast('Поделиться', window.location.href);
    }
  }

  /**
   * Bind Static Events
   */
  function bindEvents() {
    // Share Button
    if (elements.btnShareWishlist) {
      elements.btnShareWishlist.addEventListener('click', handleShareWishlist);
    }

    // Search Input with Debounce
    if (elements.searchInput) {
      elements.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        if (elements.searchClearBtn) {
          elements.searchClearBtn.style.display = state.searchQuery ? 'flex' : 'none';
        }
        renderItems();
      });
    }

    // Search Clear Button
    if (elements.searchClearBtn) {
      elements.searchClearBtn.addEventListener('click', () => {
        state.searchQuery = '';
        if (elements.searchInput) {
          elements.searchInput.value = '';
          elements.searchInput.focus();
        }
        elements.searchClearBtn.style.display = 'none';
        renderItems();
      });
    }

    // Price Filter Select
    if (elements.priceFilterSelect) {
      elements.priceFilterSelect.addEventListener('change', (e) => {
        state.pricePreset = e.target.value;
        renderItems();
      });
    }

    // Status Filter Toggles (Все / Свободно / Занято)
    elements.statusToggles.forEach((btn) => {
      btn.addEventListener('click', () => {
        elements.statusToggles.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.selectedStatus = btn.getAttribute('data-status');
        renderItems();
      });
    });

    // Sort Dropdown
    if (elements.sortSelect) {
      elements.sortSelect.addEventListener('change', (e) => {
        state.sortBy = e.target.value;
        renderItems();
      });
    }

    // Reservation Modal Form Submit
    if (elements.modalForm) {
      elements.modalForm.addEventListener('submit', handleReservationSubmit);
    }

    // Reservation Modal Close Triggers
    if (elements.btnClose) {
      elements.btnClose.addEventListener('click', closeReservationModal);
    }
    if (elements.btnCancel) {
      elements.btnCancel.addEventListener('click', closeReservationModal);
    }
    if (elements.modalBackdrop) {
      elements.modalBackdrop.addEventListener('click', (e) => {
        if (e.target === elements.modalBackdrop) {
          closeReservationModal();
        }
      });
    }

    // Lightbox Modal Close Triggers
    if (elements.btnLightboxClose) {
      elements.btnLightboxClose.addEventListener('click', closeLightboxModal);
    }
    if (elements.lightboxModal) {
      elements.lightboxModal.addEventListener('click', (e) => {
        if (e.target === elements.lightboxModal) {
          closeLightboxModal();
        }
      });
    }

    // Global ESC key closes active modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (elements.modalBackdrop && elements.modalBackdrop.classList.contains('is-open')) {
          closeReservationModal();
        } else if (elements.lightboxModal && elements.lightboxModal.classList.contains('is-open')) {
          closeLightboxModal();
        }
      }
    });
  }

  // Initialize Application
  document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    fetchItems();
  });
})();
