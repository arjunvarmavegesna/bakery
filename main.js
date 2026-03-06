/* ════════════════════════════════════════════
   Sri Ramu Sweets — Main JavaScript
   Est. 1965 · Bhimavaram
   ════════════════════════════════════════════ */

'use strict';

// ── GLOBAL STATE ──
let products = [];
let cart = {};
let searchVisible = false;
let wishlist = new Set();
let purchasedProducts = new Set();
let deliveredProducts = new Set();
let currentFilterCat = 'all';
let currentSort = null;
let currentProductId = null;
let ppQty = 1;
let ppSelectedWeight = null;
const userReviews = {};

// ── DELIVERY CHARGE CALCULATOR ──
// AP & Telangana: ₹100 up to 1kg. Other states: ₹140. FREE above ₹1000.
const AP_TG_STATES = ['andhra pradesh', 'telangana'];

function getDeliveryCharge(state, subtotal) {
  if (subtotal >= 1000) return 0;
  const stateLower = (state || '').toLowerCase().trim();
  if (AP_TG_STATES.some(s => stateLower.includes(s))) return 100;
  return 140;
}

// ── REVIEWS DATA ──
const reviewsData = {
  1: { avg: 4.9, total: 128, dist: [2,3,8,24,91], reviews: [
    { name:'Tejeswini', loc:'Vijayawada', rating:5, text:'Best Mysore Pak in Vijayawada! Just like my grandmother used to make.', date:'12 Feb 2025', color:'#E8650A', verified:true },
    { name:'Arjun Varma', loc:'Bhimavaram', rating:5, text:'Pure ghee taste is unmatched. Perfectly sweet.', date:'08 Jan 2025', color:'#B84D00', verified:true },
  ]},
  2: { avg: 4.8, total: 95, dist: [1,2,6,20,66], reviews: [
    { name:'Ravi Shankar', loc:'Hyderabad', rating:5, text:'Ordered for Diwali gifting. Everyone at office was impressed!', date:'15 Nov 2024', color:'#E8650A', verified:true },
  ]},
};

// ── WEIGHT VARIANT HELPERS ──
function getWeightVariants(p) {
  const variants = [];
  // Only add 250g if price250 is explicitly set (not just legacy p.price)
  if (p.price250) {
    variants.push({ size: '250g', price: p.price250, oldPrice: p.oldPrice250 || null });
  }
  if (p.price500) {
    variants.push({ size: '500g', price: p.price500, oldPrice: p.oldPrice500 || null });
  }
  if (p.price1kg) {
    variants.push({ size: '1 kg', price: p.price1kg, oldPrice: p.oldPrice1kg || null });
  }
  // Fallback for legacy products that only have p.price (old format, no price250)
  if (variants.length === 0 && p.price) {
    variants.push({ size: p.weight || '250g', price: p.price, oldPrice: p.oldPrice || null });
  }
  return variants;
}

function renderWeightDropdown(variants) {
  const select = document.getElementById('ppWeightSelect');
  const group = document.getElementById('ppWeightGroup');
  select.innerHTML = variants.map((v, i) =>
    `<option value="${i}">  ${v.size}  —  ₹${v.price}${v.oldPrice ? '  (MRP ₹'+v.oldPrice+')' : ''}</option>`
  ).join('');
  group.style.display = variants.length > 0 ? 'block' : 'none';
}

function onWeightSelectChange(sel) {
  const p = products.find(x => x.id === currentProductId);
  if (!p) return;
  selectWeightVariant(parseInt(sel.value));
}

function selectWeightVariant(index) {
  const p = products.find(x => x.id === currentProductId);
  if (!p) return;
  const variants = getWeightVariants(p);
  const v = variants[index];
  if (!v) return;
  ppSelectedWeight = v;
  const sel = document.getElementById('ppWeightSelect');
  if (sel) sel.value = String(index);
  document.getElementById('ppPrice').textContent = '₹' + v.price;
  const oldPriceEl = document.getElementById('ppOldPrice');
  const savingEl = document.getElementById('ppSaving');
  if (v.oldPrice) {
    oldPriceEl.textContent = '₹' + v.oldPrice;
    const saving = Math.round((v.oldPrice - v.price) / v.oldPrice * 100);
    savingEl.textContent = saving + '% OFF';
    oldPriceEl.style.display = 'block';
    savingEl.style.display = 'block';
  } else {
    oldPriceEl.style.display = 'none';
    savingEl.style.display = 'none';
  }
}

// ── CATALOGUE ──
function openCatalogue() {
  document.getElementById('catalogueOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCatalogue() {
  document.getElementById('catalogueOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

function catalogueGoTo(cat) {
  closeCatalogue();
  // Small delay so the overlay closes before categories page opens
  setTimeout(() => {
    if (cat === 'all') {
      openCategoriesPage();
    } else {
      filterCategory(cat);
      scrollToProducts();
    }
  }, 300);
}

// ── WISHLIST ──
function toggleWishlist(id, btn) {
  if (wishlist.has(id)) {
    wishlist.delete(id);
    if (btn) btn.textContent = '🤍';
    showToast('Removed from wishlist');
    if (window.saveWishlistToFirebase) window.saveWishlistToFirebase(id, false);
  } else {
    wishlist.add(id);
    if (btn) btn.textContent = '❤️';
    showToast('Added to wishlist!');
    if (window.saveWishlistToFirebase) window.saveWishlistToFirebase(id, true);
  }
  updateWishlistBadge();
}

function updateWishlistBadge() {
  const el = document.getElementById('wishlistCountBadge');
  if (el) el.textContent = wishlist.size;
}

function openWishlistPage() {
  updateWishlistBadge();
  renderWishlist();
  document.getElementById('wishlistPage').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeWishlistPage() {
  document.getElementById('wishlistPage').classList.remove('open');
  document.body.style.overflow = '';
}

function renderWishlist() {
  const content = document.getElementById('wishlistContent');
  const items = products.filter(p => wishlist.has(p.id));
  if (items.length === 0) {
    content.innerHTML = `<div class="wishlist-empty"><div>🤍</div><p>Your wishlist is empty!<br><small>Tap the heart on any product to save it here.</small></p></div>`;
    return;
  }
  content.innerHTML = `<div class="wishlist-grid">${items.map(p => `
    <div class="wishlist-card" onclick="closeWishlistPage();setTimeout(()=>openProductPage('${p.id}'),300)">
      <div class="wishlist-card-img" style="background:${p.bg||'#FFF0E0'}">${p.photoUrl ? `<img src="${p.photoUrl}" style="width:100%;height:100%;object-fit:cover;" alt="${p.name}">` : '🍬'}</div>
      <button class="wishlist-remove" onclick="event.stopPropagation();removeFromWishlist('${p.id}')">✕</button>
      <div class="wishlist-card-info">
        <div class="wishlist-card-name">${p.name}</div>
        <div class="wishlist-card-price">₹${p.price250 || p.price500 || p.price1kg || p.price}</div>
        <button class="wishlist-add-btn" onclick="event.stopPropagation();openProductPage('${p.id}')">🛒 Add to Cart</button>
      </div>
    </div>
  `).join('')}</div>`;
}

function removeFromWishlist(id) {
  wishlist.delete(id);
  updateWishlistBadge();
  renderWishlist();
}

// ── TODAY'S SPECIALS ──
function renderSpecials() {
  const container = document.getElementById('specialsScroll');
  if (!container) return;
  let specials = products.filter(p => p.special === true);
  if (specials.length === 0) specials = products.filter(p => p.popular === true || p.bestseller === true);
  if (specials.length === 0) specials = products.slice(0, 6);
  if (specials.length === 0) {
    container.innerHTML = '<div style="padding:1.5rem 1rem;color:#aaa;font-size:0.82rem;text-align:center;">No specials today. Check back soon! 🍬</div>';
    document.getElementById('specialsHint').style.display = 'block';
    return;
  }
  container.innerHTML = specials.map(p => {
    const displayPrice = p.price250 || p.price500 || p.price1kg || p.price;
    const oldPrice = (p.price250 ? p.oldPrice250 : p.price500 ? p.oldPrice500 : p.oldPrice1kg) || p.oldPrice || null;
    const discount = oldPrice ? Math.round((oldPrice - displayPrice) / oldPrice * 100) : null;
    return `
    <div class="special-card" onclick="openProductPage('${p.id}')" style="cursor:pointer;position:relative;">
      ${discount ? `<div style="position:absolute;top:8px;left:8px;background:#E8650A;color:white;font-size:0.58rem;font-weight:700;padding:2px 7px;border-radius:10px;letter-spacing:0.5px;z-index:2;">${discount}% OFF</div>` : (p.badge ? `<div style="position:absolute;top:8px;left:8px;background:#E8650A;color:white;font-size:0.58rem;font-weight:700;padding:2px 7px;border-radius:10px;letter-spacing:0.5px;z-index:2;">${p.badge}</div>` : '')}
      <div class="special-img" style="background:${p.bg||'#FFF0E0'}">
        ${p.photoUrl ? `<img src="${p.photoUrl}" alt="${p.name}">` : `<span style="font-size:2.8rem">🍬</span>`}
      </div>
      <div class="special-info">
        <div class="special-name">${p.name}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:0.3rem;margin-top:0.35rem;">
          <div class="special-price">
            ₹${displayPrice}
            ${oldPrice ? `<small style="color:#aaa;text-decoration:line-through;font-weight:400;font-size:0.68rem;margin-left:2px;">₹${oldPrice}</small>` : ''}
          </div>
          <button
            onclick="event.stopPropagation();quickAddSpecial('${p.id}')"
            style="background:var(--deep-red);color:white;border:none;border-radius:8px;padding:0.28rem 0.55rem;font-size:0.68rem;font-weight:700;cursor:pointer;font-family:'Poppins',sans-serif;white-space:nowrap;flex-shrink:0;transition:background 0.2s;"
            onmouseover="this.style.background='var(--brown)'" onmouseout="this.style.background='var(--deep-red)'"
          >+ Cart</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function quickAddSpecial(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const variants = getWeightVariants(p);
  const v = variants[0];
  if (!v) return;
  const cartKey = id + '_' + v.size;
  if (!cart[cartKey]) cart[cartKey] = { ...p, qty: 0, selectedWeight: v.size, selectedPrice: v.price };
  cart[cartKey].qty++;
  updateCartBadge();
  showToast(`${p.name} (${v.size}) added! 🛒`);
}

// ── CATEGORIES PAGE ──
function openCategoriesPage() {
  backToCatGrid();
  document.getElementById('categoriesPage').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCategoriesPage() {
  document.getElementById('categoriesPage').classList.remove('open');
  document.body.style.overflow = '';
}

function showCatProducts(cat, title) {
  const filtered = cat === 'all' ? products : products.filter(p => p.cat === cat);
  document.getElementById('catPageContent').style.display = 'none';
  document.getElementById('catProductsSection').style.display = 'block';
  document.getElementById('catProductsTitle').textContent = title;
  renderProducts(filtered, 'catProductsGrid');
}

function backToCatGrid() {
  document.getElementById('catPageContent').style.display = 'block';
  document.getElementById('catProductsSection').style.display = 'none';
}

// ── PRODUCT RENDERING ──
function renderProducts(list, containerId = 'productsGrid') {
  if (list === undefined) list = products;
  const grid = document.getElementById(containerId);
  if (!grid) return;
  if (!list.length) {
    grid.innerHTML = `<div style="text-align:center;padding:3rem;color:#aaa;grid-column:1/-1;"><div style="font-size:3rem;margin-bottom:1rem;">🍬</div><p>No products found</p></div>`;
    return;
  }
  grid.innerHTML = list.map(p => {
    const displayPrice = p.price250 || p.price500 || p.price1kg || p.price;
    const displayOldPrice = (p.price250 ? p.oldPrice250 : p.price500 ? p.oldPrice500 : p.oldPrice1kg) || p.oldPrice || null;
    // Build weight label showing only available sizes
    const sizes = [];
    if (p.price250) sizes.push('250g');
    if (p.price500) sizes.push('500g');
    if (p.price1kg) sizes.push('1kg');
    const weightLabel = sizes.length > 1 ? sizes.join(' / ') : (p.weight || sizes[0] || '');
    return `
    <div class="product-card" onclick="openProductPage('${p.id}')">
      <div class="product-img" style="background:${p.bg||'#FFF0E0'}">
        ${p.photoUrl ? `<img src="${p.photoUrl}" alt="${p.name}" loading="lazy">` : `<span style="font-size:3.2rem">🍬</span>`}
        ${p.badge ? `<div class="product-badge">${p.badge}</div>` : ''}
        <button class="product-fav" onclick="event.stopPropagation();toggleWishlist('${p.id}',this)" id="fav-${containerId}-${p.id}">${wishlist.has(p.id) ? '❤️' : '🤍'}</button>
      </div>
      <div class="product-info">
        <div class="product-name">${p.name}</div>
        <div class="product-desc">${p.desc}</div>
        <div class="product-weight">${weightLabel}</div>
        <div class="product-footer">
          <div class="product-price">
            ${displayOldPrice ? `<span>₹${displayOldPrice}</span>` : ''}
            ₹${displayPrice}
          </div>
          <div style="font-size:0.65rem;color:var(--deep-red);font-weight:600;">View →</div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function addToCart(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const variants = getWeightVariants(p);
  const v = variants[0];
  const cartKey = id + '_' + v.size;
  if (!cart[cartKey]) cart[cartKey] = { ...p, qty: 0, selectedWeight: v.size, selectedPrice: v.price };
  cart[cartKey].qty++;
  updateCartBadge();
  showToast(`${p.name} (${v.size}) added to cart!`);
}

function updateCartBadge() {
  const total = Object.values(cart).reduce((s, i) => s + i.qty, 0);
  document.getElementById('cartCount').textContent = total;
}

// ── CART ──
function openCart() {
  const items = Object.values(cart);
  const cartItemsEl = document.getElementById('cartItems');
  const cartTotalEl = document.getElementById('cartTotal');
  const currentState = shippingData && shippingData.state ? shippingData.state : '';

  if (items.length === 0) {
    cartItemsEl.innerHTML = `<div class="empty-cart"><div>🛒</div><p>Your cart is empty!<br><small>Add some delicious sweets 😋</small></p></div>`;
    cartTotalEl.innerHTML = '';
  } else {
    cartItemsEl.innerHTML = items.map(item => `
      <div class="cart-item">
        <div class="cart-item-img" style="background:${item.bg||'#FFF0E0'};">${item.photoUrl ? `<img src="${item.photoUrl}" alt="${item.name}">` : '🍬'}</div>
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-weight">📦 ${item.selectedWeight || '250g'}</div>
          <div class="cart-item-price">₹${item.selectedPrice * item.qty}</div>
        </div>
        <div class="qty-ctrl">
          <button class="qty-btn" onclick="changeQty('${item.id}_${item.selectedWeight}',-1)">−</button>
          <span class="qty-val">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty('${item.id}_${item.selectedWeight}',1)">+</button>
        </div>
      </div>
    `).join('');

    const subtotal = items.reduce((s,i) => s + i.selectedPrice * i.qty, 0);
    const delivery = getDeliveryCharge(currentState, subtotal);
    const isAP_TG = AP_TG_STATES.some(s => currentState.toLowerCase().includes(s));
    const deliveryNote = subtotal >= 1000 ? '' : (isAP_TG || !currentState ? ' (AP/TG rate)' : ' (Other state rate)');
    cartTotalEl.innerHTML = `
      <div class="cart-total">
        <div class="total-row"><span>Subtotal</span><span>₹${subtotal}</span></div>
        <div class="total-row"><span>Delivery${deliveryNote ? `<br><small style="color:#aaa;font-size:0.6rem;">${deliveryNote}</small>` : ''}</span><span>${delivery === 0 ? '<span style="color:green">FREE</span>' : '₹' + delivery}</span></div>
        ${!currentState ? `<div class="total-row"><span style="font-size:0.68rem;color:#aaa;">📍 Delivery: ₹100 AP/TG · ₹140 Other States · FREE above ₹1000</span></div>` : ''}
        <div class="total-row grand"><span>Total</span><span>₹${subtotal + delivery}</span></div>
        <button class="checkout-btn" onclick="openShipping()">Proceed to Checkout 📍</button>
      </div>
    `;
  }

  document.getElementById('overlay').classList.add('open');
  document.getElementById('cartDrawer').classList.add('open');
}

function changeQty(cartKey, delta) {
  if (!cart[cartKey]) return;
  cart[cartKey].qty += delta;
  if (cart[cartKey].qty <= 0) delete cart[cartKey];
  updateCartBadge();
  openCart();
}

// ── OVERLAYS & DRAWERS ──
function closeAll() {
  document.getElementById('overlay').classList.remove('open');
  document.getElementById('cartDrawer').classList.remove('open');
  document.getElementById('ordersDrawer').classList.remove('open');
  document.getElementById('shippingDrawer').classList.remove('open');
  document.getElementById('accountDrawer').classList.remove('open');
  document.getElementById('helpDrawer').classList.remove('open');
  closeProductPage();
  closeCategoriesPage();
  closeWishlistPage();
  closeReviewsPage();
  closeCatalogue();
}

function openOrders() {
  document.getElementById('overlay').classList.add('open');
  document.getElementById('ordersDrawer').classList.add('open');
  const list = document.getElementById('ordersList');
  if (window.loadOrders) window.loadOrders(list);
}

// ── SEARCH ──
function toggleSearch() {
  searchVisible = !searchVisible;
  document.getElementById('searchBar').style.display = searchVisible ? 'block' : 'none';
  if (searchVisible) document.getElementById('searchInput').focus();
}

document.addEventListener('DOMContentLoaded', function() {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      const q = this.value.toLowerCase();
      const filtered = q ? products.filter(p => p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q)) : products;
      renderProducts(filtered);
      document.getElementById('products').scrollIntoView({ behavior: 'smooth' });
    });
  }
});

// ── CATEGORY FILTER ──
function filterCategory(cat) {
  currentFilterCat = cat;
  document.querySelectorAll('.cat-pill').forEach(el => el.classList.remove('active'));
  const activePill = event && event.currentTarget;
  if (activePill) activePill.classList.add('active');
  if (currentSort) {
    renderSorted();
  } else {
    const filtered = cat === 'all' ? products : products.filter(p => p.cat === cat);
    renderProducts(filtered);
  }
  document.getElementById('products').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── HELP & SUPPORT ──
function openHelpSupport() {
  document.getElementById('accountDrawer').classList.remove('open');
  setTimeout(() => {
    document.getElementById('overlay').classList.add('open');
    document.getElementById('helpDrawer').classList.add('open');
  }, 250);
}

// ── SORT ──
function toggleSortMenu() {
  const menu = document.getElementById('sortMenu');
  const chevron = document.getElementById('sortChevron');
  const isOpen = menu.style.display === 'block';
  menu.style.display = isOpen ? 'none' : 'block';
  chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
  if (!isOpen) {
    setTimeout(() => document.addEventListener('click', closeSortOnOutside, { once: true }), 10);
  }
}

function closeSortOnOutside(e) {
  const menu = document.getElementById('sortMenu');
  const btn = document.getElementById('sortBtn');
  if (menu && !menu.contains(e.target) && !btn.contains(e.target)) {
    menu.style.display = 'none';
    document.getElementById('sortChevron').style.transform = 'rotate(0deg)';
  }
}

function applySort(key) {
  currentSort = key;
  const labels = { bestsellers: '🏆 Best Sellers', popular: '🔥 Popular', lowtohigh: 'Low → High', hightolow: 'High → Low' };
  document.getElementById('sortLabel').textContent = labels[key];
  document.querySelectorAll('.sort-option').forEach(el => {
    el.classList.toggle('active', el.dataset.key === key);
  });
  document.getElementById('sortMenu').style.display = 'none';
  document.getElementById('sortChevron').style.transform = 'rotate(0deg)';
  renderSorted();
}

function renderSorted() {
  let list = currentFilterCat === 'all' ? [...products] : products.filter(p => p.cat === currentFilterCat);
  if (currentSort === 'bestsellers') {
    list = list.filter(p => p.bestseller === true || p.special === true).concat(list.filter(p => !p.bestseller && !p.special));
  } else if (currentSort === 'popular') {
    list = list.filter(p => p.popular === true || p.special === true).concat(list.filter(p => !p.popular && !p.special));
  } else if (currentSort === 'lowtohigh') {
    list.sort((a, b) => (a.price250||a.price500||a.price1kg||a.price||0) - (b.price250||b.price500||b.price1kg||b.price||0));
  } else if (currentSort === 'hightolow') {
    list.sort((a, b) => (b.price250||b.price500||b.price1kg||b.price||0) - (a.price250||a.price500||a.price1kg||a.price||0));
  }
  renderProducts(list);
}

function scrollToProducts() {
  document.getElementById('products').scrollIntoView({ behavior: 'smooth' });
}

// ── TOAST ──
let toastTimeout;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => t.classList.remove('show'), 2500);
}

// ── PRODUCT PAGE ──
function openProductPage(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  currentProductId = id;
  ppQty = 1;

  document.getElementById('categoriesPage').classList.remove('open');
  document.getElementById('wishlistPage').classList.remove('open');
  document.getElementById('catalogueOverlay').classList.remove('open');

  document.getElementById('ppHeaderTitle').textContent = p.name;

  // ── Build photo gallery ──
  const photos = Array.isArray(p.photoUrls) && p.photoUrls.length
    ? p.photoUrls
    : (p.photoUrl ? [p.photoUrl] : []);

  const heroEl = document.getElementById('ppHero');
  heroEl.style.background = p.bg || '#FFF0E0';

  if (photos.length <= 1) {
    // Single photo — original layout
    heroEl.innerHTML = `
      ${photos[0] ? `<img src="${photos[0]}" alt="${p.name}">` : `<span style="font-size:7rem">🍬</span>`}
      ${p.badge ? `<div class="pp-badge">${p.badge}</div>` : ''}
      <button class="product-fav" style="position:absolute;top:12px;right:12px;width:36px;height:36px;font-size:1.1rem;" onclick="toggleWishlist('${p.id}',this)">${wishlist.has(p.id) ? '❤️' : '🤍'}</button>
    `;
    heroEl.classList.remove('pp-has-gallery');
  } else {
    // Multi-photo gallery
    heroEl.classList.add('pp-has-gallery');
    heroEl.innerHTML = `
      <div class="pp-gallery-track" id="ppGalleryTrack">
        ${photos.map((url, i) => `
          <div class="pp-gallery-slide" style="background:${p.bg||'#FFF0E0'}">
            <img src="${url}" alt="${p.name} photo ${i+1}">
          </div>`).join('')}
      </div>
      ${p.badge ? `<div class="pp-badge">${p.badge}</div>` : ''}
      <button class="product-fav" style="position:absolute;top:12px;right:12px;width:36px;height:36px;font-size:1.1rem;z-index:3;" onclick="toggleWishlist('${p.id}',this)">${wishlist.has(p.id) ? '❤️' : '🤍'}</button>
      <button class="pp-gallery-arrow pp-gallery-arrow-left" id="ppArrowLeft" onclick="ppGalleryGoTo(_galleryIndex - 1)" aria-label="Previous photo">&#8249;</button>
      <button class="pp-gallery-arrow pp-gallery-arrow-right" id="ppArrowRight" onclick="ppGalleryGoTo(_galleryIndex + 1)" aria-label="Next photo">&#8250;</button>
      <div class="pp-gallery-dots" id="ppGalleryDots">
        ${photos.map((_, i) => `<span class="pp-gallery-dot${i===0?' active':''}" onclick="ppGalleryGoTo(${i})"></span>`).join('')}
      </div>
    `;
    // Thumbnail strip (below hero, inside pp-body — we inject it)
    const thumbHtml = `<div class="pp-thumbs" id="ppThumbStrip">
      ${photos.map((url, i) => `<img class="pp-thumb${i===0?' active':''}" src="${url}" alt="thumb ${i+1}" onclick="ppGalleryGoTo(${i})">`).join('')}
    </div>`;
    // Insert thumb strip after hero
    heroEl.insertAdjacentHTML('afterend', thumbHtml);

    initGallerySwipe(photos.length);
  }

  document.getElementById('ppName').textContent = p.name;
  document.getElementById('ppDesc').textContent = p.desc;
  document.getElementById('ppQty').textContent = ppQty;

  const variants = getWeightVariants(p);
  renderWeightDropdown(variants);
  ppSelectedWeight = variants[0];
  selectWeightVariant(0);

  document.getElementById('productPage').classList.add('open');
  document.getElementById('ppActions').classList.add('open');
  document.body.style.overflow = 'hidden';
  renderProductReviews(id);
}

// ── Gallery helpers ──
let _galleryIndex = 0;
let _galleryTotal = 0;
let _galleryTouchStartX = 0;
let _galleryTouchStartY = 0;

function ppGalleryGoTo(idx) {
  idx = Math.max(0, Math.min(_galleryTotal - 1, idx));
  _galleryIndex = idx;
  const track = document.getElementById('ppGalleryTrack');
  if (track) track.style.transform = `translateX(-${idx * 100}%)`;
  document.querySelectorAll('.pp-gallery-dot').forEach((d, i) => d.classList.toggle('active', i === idx));
  document.querySelectorAll('.pp-thumb').forEach((t, i) => t.classList.toggle('active', i === idx));
  // Arrow visibility
  const left = document.getElementById('ppArrowLeft');
  const right = document.getElementById('ppArrowRight');
  if (left)  left.style.opacity  = idx === 0 ? '0' : '1';
  if (right) right.style.opacity = idx === _galleryTotal - 1 ? '0' : '1';
  if (left)  left.style.pointerEvents  = idx === 0 ? 'none' : 'auto';
  if (right) right.style.pointerEvents = idx === _galleryTotal - 1 ? 'none' : 'auto';
}

function initGallerySwipe(total) {
  _galleryIndex = 0;
  _galleryTotal = total;
  const track = document.getElementById('ppGalleryTrack');
  if (!track) return;
  track.style.transform = 'translateX(0)';

  // Hide left arrow on first slide
  const left = document.getElementById('ppArrowLeft');
  if (left) { left.style.opacity = '0'; left.style.pointerEvents = 'none'; }

  // Touch swipe
  const hero = document.getElementById('ppHero');
  hero.ontouchstart = (e) => {
    _galleryTouchStartX = e.touches[0].clientX;
    _galleryTouchStartY = e.touches[0].clientY;
  };
  hero.ontouchend = (e) => {
    const dx = e.changedTouches[0].clientX - _galleryTouchStartX;
    const dy = e.changedTouches[0].clientY - _galleryTouchStartY;
    if (Math.abs(dx) < 30 || Math.abs(dy) > Math.abs(dx)) return; // ignore taps & vertical
    if (dx < 0 && _galleryIndex < _galleryTotal - 1) ppGalleryGoTo(_galleryIndex + 1);
    if (dx > 0 && _galleryIndex > 0) ppGalleryGoTo(_galleryIndex - 1);
  };
}

window.ppGalleryGoTo = ppGalleryGoTo;

function closeProductPage() {
  document.getElementById('productPage').classList.remove('open');
  document.getElementById('ppActions').classList.remove('open');
  document.body.style.overflow = '';
  // Remove thumb strip if it exists
  const thumbStrip = document.getElementById('ppThumbStrip');
  if (thumbStrip) thumbStrip.remove();
  const heroEl = document.getElementById('ppHero');
  heroEl.classList.remove('pp-has-gallery');
  heroEl.ontouchstart = null;
  heroEl.ontouchend = null;
}

function changePPQty(delta) {
  ppQty = Math.max(1, ppQty + delta);
  document.getElementById('ppQty').textContent = ppQty;
}

function ppAddToCart() {
  const p = products.find(x => x.id === currentProductId);
  if (!p) return;
  if (!ppSelectedWeight) { showToast('Please select a weight!'); return; }
  const cartKey = p.id + '_' + ppSelectedWeight.size;
  if (!cart[cartKey]) cart[cartKey] = { ...p, qty: 0, selectedWeight: ppSelectedWeight.size, selectedPrice: ppSelectedWeight.price };
  cart[cartKey].qty += ppQty;
  updateCartBadge();
  showToast(`${p.name} (${ppSelectedWeight.size}) x${ppQty} added to cart!`);
  closeProductPage();
}

function ppBuyNow() {
  const p = products.find(x => x.id === currentProductId);
  if (!p) return;
  if (!ppSelectedWeight) { showToast('Please select a weight!'); return; }
  const cartKey = p.id + '_' + ppSelectedWeight.size;
  if (!cart[cartKey]) cart[cartKey] = { ...p, qty: 0, selectedWeight: ppSelectedWeight.size, selectedPrice: ppSelectedWeight.price };
  cart[cartKey].qty += ppQty;
  updateCartBadge();
  closeProductPage();
  setTimeout(() => openShipping(), 300);
}

// ── REVIEWS ──
function starsHtml(rating, size = '0.85rem') {
  return `<span style="font-size:${size};color:#FFA000;">${'★'.repeat(rating)}${'☆'.repeat(5-rating)}</span>`;
}

function renderProductReviews(productId) {
  const data = reviewsData[productId] || { avg: 4.8, total: 0, dist: [0,0,0,0,0], reviews: [] };
  const barsHtml = [5,4,3,2,1].map(star => {
    const count = data.dist[star-1];
    const pct = data.total > 0 ? Math.round(count/data.total*100) : 0;
    return `<div class="rating-bar-row" style="margin-bottom:0.25rem;"><span class="rbar-label">${star}</span><div class="rbar-track"><div class="rbar-fill" style="width:${pct}%"></div></div><span class="rbar-count">${count}</span></div>`;
  }).join('');
  const m = document.getElementById('ppMiniRatingBars'); if(m) m.innerHTML = barsHtml;
  const a = document.getElementById('ppAvgRating'); if(a) a.textContent = data.avg.toFixed(1);
  const s = document.getElementById('ppStarsDisplay'); if(s) s.innerHTML = starsHtml(Math.round(data.avg), '1rem');
  const c = document.getElementById('ppReviewCount'); if(c) c.textContent = data.total + ' reviews';
  const t = document.getElementById('ppTopReviews');
  if(t) t.innerHTML = data.reviews.slice(0,2).map(r => `
    <div class="review-item" style="margin-bottom:0.6rem;">
      <div class="review-item-header">
        <div class="review-avatar" style="background:${r.color};font-size:0.8rem;">${r.name[0]}</div>
        <div class="review-meta"><div class="review-name">${r.name}</div><div>${starsHtml(r.rating)} ${r.verified?'<span class="verified-badge">✓ Verified</span>':''}</div></div>
      </div>
      <div class="review-body">"${r.text}"</div>
    </div>`).join('');
}

let currentReviewProductId = null;
let selectedRating = 0;

function openReviewsPage() {
  const id = currentProductId;
  currentReviewProductId = id;
  const p = products.find(x => x.id === id);
  const data = reviewsData[id] || { avg: 4.8, total: 0, dist: [0,0,0,0,0], reviews: [] };
  document.getElementById('reviewsPageTitle').innerHTML = `${p ? p.name : 'Reviews'} <small id="reviewsPageSub">${data.avg.toFixed(1)}★ · ${data.total} reviews</small>`;
  const barsHtml = [5,4,3,2,1].map(star => {
    const count = data.dist[star-1];
    const pct = data.total > 0 ? Math.round(count/data.total*100) : 0;
    return `<div class="rating-bar-row"><span class="rbar-label">${star}</span><div class="rbar-track"><div class="rbar-fill" style="width:${pct}%"></div></div><span class="rbar-count">${count}</span></div>`;
  }).join('');
  document.getElementById('reviewsRatingSummary').innerHTML = `
    <div class="rating-big">
      <div><div class="rating-num">${data.avg.toFixed(1)}</div><div class="rating-stars-big">${starsHtml(Math.round(data.avg),'1.1rem')}</div><div class="rating-total">${data.total} ratings</div></div>
      <div class="rating-bars" style="flex:1;">${barsHtml}</div>
    </div>
    <div class="rating-chips"><div class="rating-chip">✅ Pure Ingredients</div><div class="rating-chip">😋 Great Taste</div><div class="rating-chip">📦 Good Packaging</div><div class="rating-chip">🚚 Fast Delivery</div></div>`;
  const allReviews = [...(userReviews[id]||[]), ...(data.reviews||[])];
  document.getElementById('reviewsListFull').innerHTML = allReviews.length === 0
    ? `<div style="text-align:center;padding:3rem 1rem;color:#aaa;"><div style="font-size:3rem;margin-bottom:0.5rem;">💬</div><p>No reviews yet.</p></div>`
    : allReviews.map((r,i) => `
      <div class="review-item">
        <div class="review-item-header">
          <div class="review-avatar" style="background:${r.color||'#E8650A'}">${r.name[0].toUpperCase()}</div>
          <div class="review-meta"><div class="review-name">${r.name} <span style="font-size:0.62rem;color:#aaa;font-weight:400">· ${r.loc||'India'}</span></div><div class="review-date">${r.date||'Recently'}</div></div>
          ${r.verified?'<span class="verified-badge">✓ Verified</span>':''}
        </div>
        <div class="review-stars">${starsHtml(r.rating)}</div>
        <div class="review-body">"${r.text}"</div>
        <div class="review-helpful"><span class="helpful-label">Helpful?</span><button class="helpful-btn" onclick="this.classList.toggle('liked')">👍 Yes</button><button class="helpful-btn" onclick="this.classList.toggle('liked')">👎 No</button></div>
      </div>`).join('');
  document.getElementById('reviewsPage').classList.add('open');
  const writeBtn = document.getElementById('writeReviewBtn');
  writeBtn.classList.add('open');

  const isDelivered = deliveredProducts.has(id);
  if (isDelivered) {
    writeBtn.querySelector('button').textContent = '✍️ Write a Review';
    writeBtn.querySelector('button').disabled = false;
    writeBtn.querySelector('button').style.opacity = '1';
    writeBtn.querySelector('button').style.background = 'var(--deep-red)';
  } else if (purchasedProducts.has(id)) {
    writeBtn.querySelector('button').innerHTML = '⏳ Review available after delivery';
    writeBtn.querySelector('button').disabled = true;
    writeBtn.querySelector('button').style.opacity = '0.6';
    writeBtn.querySelector('button').style.background = '#888';
  } else {
    writeBtn.querySelector('button').innerHTML = '🔒 Purchase this product to review';
    writeBtn.querySelector('button').disabled = true;
    writeBtn.querySelector('button').style.opacity = '0.5';
    writeBtn.querySelector('button').style.background = '#aaa';
  }
  document.body.style.overflow = 'hidden';
}

function closeReviewsPage() {
  document.getElementById('reviewsPage').classList.remove('open');
  document.getElementById('writeReviewBtn').classList.remove('open');
  document.body.style.overflow = '';
}

function openWriteReview() {
  if (!deliveredProducts.has(currentReviewProductId)) {
    if (purchasedProducts.has(currentReviewProductId)) {
      showToast('⏳ Review will be available after your order is delivered!');
    } else {
      showToast('🔒 Only verified buyers can review!');
    }
    return;
  }
  selectedRating = 0;
  const userName = window.currentUser ? window.currentUser.displayName || '' : '';
  document.getElementById('reviewName').value = userName;
  document.getElementById('reviewName').readOnly = !!userName;
  document.getElementById('reviewText').value = '';
  document.getElementById('starLabel').textContent = 'Tap a star to rate';
  document.querySelectorAll('.star-pick').forEach(s => s.classList.remove('active'));
  document.getElementById('reviewModalOverlay').classList.add('open');
}

function closeWriteReview() {
  document.getElementById('reviewModalOverlay').classList.remove('open');
}

function setRating(val) {
  selectedRating = val;
  const labels = ['','Poor 😞','Fair 😐','Good 🙂','Very Good 😊','Excellent 🤩'];
  document.getElementById('starLabel').textContent = labels[val];
  document.querySelectorAll('.star-pick').forEach(s => s.classList.toggle('active', parseInt(s.dataset.val) <= val));
}

function submitReview() {
  const name = document.getElementById('reviewName').value.trim();
  const text = document.getElementById('reviewText').value.trim();
  if (!selectedRating) { showToast('⭐ Please select a star rating!'); return; }
  if (name.length < 2) { showToast('📝 Please enter your name!'); return; }
  if (text.length < 10) { showToast('📝 Please write at least a short review!'); return; }
  if (!deliveredProducts.has(currentReviewProductId)) { showToast('⏳ Review available after delivery!'); return; }
  const id = currentReviewProductId;
  if (!userReviews[id]) userReviews[id] = [];
  const colors = ['#E8650A','#B84D00','#FF8C2A','#5C3A00','#CC5500'];
  const now = new Date().toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
  userReviews[id].unshift({ name, text, rating: selectedRating, loc: shippingData?.city || 'India', date: now, color: colors[Math.floor(Math.random()*colors.length)], verified: true });
  if (reviewsData[id]) { reviewsData[id].total += 1; reviewsData[id].dist[selectedRating-1] += 1; }
  closeWriteReview();
  showToast('🎉 Thank you for your verified review!');
  if (window.saveReviewToFirebase) window.saveReviewToFirebase(id, { name, text, rating: selectedRating, loc: shippingData?.city || 'India', date: now });
  setTimeout(() => { openReviewsPage(); renderProductReviews(id); }, 400);
}

// ── SHIPPING ──
let shippingData = {};

function openShipping() {
  if (!window.currentUser) {
    document.getElementById('cartDrawer').classList.remove('open');
    document.getElementById('overlay').classList.remove('open');
    showToast('🔐 Please sign in to place your order!');
    setTimeout(() => { if (window.openAccount) window.openAccount(); }, 800);
    return;
  }
  document.getElementById('cartDrawer').classList.remove('open');
  document.getElementById('shippingPage1').style.display = 'block';
  document.getElementById('shippingPage2').style.display = 'none';
  document.getElementById('stepAddress').className = 'shipping-step active';
  document.getElementById('stepPayment').className = 'shipping-step';
  const user = window.currentUser;
  const nameField = document.getElementById('ship_name');
  if (nameField && !nameField.value) nameField.value = user.displayName || '';
  document.getElementById('overlay').classList.add('open');
  document.getElementById('shippingDrawer').classList.add('open');
}

function backToCart() {
  document.getElementById('shippingDrawer').classList.remove('open');
  openCart();
}

function backToAddress() {
  document.getElementById('shippingPage2').style.display = 'none';
  document.getElementById('shippingPage1').style.display = 'block';
  document.getElementById('stepAddress').className = 'shipping-step active';
  document.getElementById('stepPayment').className = 'shipping-step';
}

let pincodeTimer = null;
document.addEventListener('DOMContentLoaded', function() {
  const pincodeInput = document.getElementById('ship_pincode');
  if (pincodeInput) {
    pincodeInput.addEventListener('input', function() {
      const val = this.value.replace(/\D/g,'');
      this.value = val;
      clearTimeout(pincodeTimer);
      hideErr('err_pincode');
      document.getElementById('locationTag').classList.remove('show');
      if (val.length === 6) pincodeTimer = setTimeout(() => lookupPincode(val), 400);
      else if (val.length < 6) {
        document.getElementById('ship_city').value = '';
        document.getElementById('ship_state').value = '';
        document.getElementById('ship_city').disabled = false;
        document.getElementById('ship_state').disabled = false;
      }
    });
  }
});

async function lookupPincode(pin) {
  const spinner = document.getElementById('pincodeSpinner');
  const locationTag = document.getElementById('locationTag');
  const cityInput = document.getElementById('ship_city');
  const stateInput = document.getElementById('ship_state');
  const pincodeInput = document.getElementById('ship_pincode');
  spinner.classList.add('show');
  pincodeInput.classList.remove('error','success');
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
    const data = await res.json();
    spinner.classList.remove('show');
    if (data[0].Status === 'Success' && data[0].PostOffice?.length > 0) {
      const po = data[0].PostOffice[0];
      cityInput.value = po.District||po.Block||po.Name;
      stateInput.value = po.State;
      cityInput.disabled = true; stateInput.disabled = true;
      cityInput.classList.add('success'); stateInput.classList.add('success');
      pincodeInput.classList.add('success');
      document.getElementById('locationText').textContent = `${po.Region||po.Name}, ${po.District||po.Block}, ${po.State}`;
      locationTag.classList.add('show');
      hideErr('err_pincode');
    } else {
      pincodeInput.classList.add('error'); cityInput.value=''; stateInput.value='';
      cityInput.disabled=false; stateInput.disabled=false;
      locationTag.classList.remove('show');
      showErr('err_pincode','Invalid pincode');
    }
  } catch(e) {
    spinner.classList.remove('show');
    pincodeInput.classList.add('error');
    showErr('err_pincode','Could not verify pincode. Enter city manually.');
    cityInput.disabled=false; stateInput.disabled=false;
  }
}

function showErr(id, msg) { const el=document.getElementById(id); if(el){el.textContent=msg||el.textContent;el.classList.add('show');} }
function hideErr(id) { const el=document.getElementById(id); if(el) el.classList.remove('show'); }
function setFieldError(inputId,errId,msg) { document.getElementById(inputId).classList.add('error'); showErr(errId,msg); return false; }
function clearFieldError(inputId,errId) { document.getElementById(inputId).classList.remove('error'); hideErr(errId); return true; }

function validateShippingForm() {
  let valid = true;
  const name = document.getElementById('ship_name').value.trim();
  if (name.length < 3) { setFieldError('ship_name','err_name','Please enter your full name'); valid=false; } else clearFieldError('ship_name','err_name');
  const phone = document.getElementById('ship_phone').value.trim();
  if (!/^[6-9]\d{9}$/.test(phone)) { setFieldError('ship_phone','err_phone','Enter valid 10-digit number'); valid=false; } else clearFieldError('ship_phone','err_phone');
  const pincode = document.getElementById('ship_pincode').value.trim();
  if (!/^\d{6}$/.test(pincode)) { setFieldError('ship_pincode','err_pincode','Enter valid 6-digit pincode'); valid=false; } else clearFieldError('ship_pincode','err_pincode');
  const city = document.getElementById('ship_city').value.trim();
  if (!city) { setFieldError('ship_city','err_city','City is required'); valid=false; } else clearFieldError('ship_city','err_city');
  const house = document.getElementById('ship_house').value.trim();
  if (house.length < 3) { setFieldError('ship_house','err_house','Please enter your house/flat details'); valid=false; } else clearFieldError('ship_house','err_house');
  const street = document.getElementById('ship_street').value.trim();
  if (street.length < 5) { setFieldError('ship_street','err_street','Please enter your street/area'); valid=false; } else clearFieldError('ship_street','err_street');
  return valid;
}

function goToReview() {
  if (goToReview._busy) return;
  goToReview._busy = true;
  setTimeout(() => goToReview._busy = false, 1000);
  if (!validateShippingForm()) {
    const firstErr = document.querySelector('.form-input.error');
    if(firstErr) firstErr.scrollIntoView({behavior:'smooth',block:'center'});
    return;
  }
  shippingData = {
    name: document.getElementById('ship_name').value.trim(),
    phone: document.getElementById('ship_phone').value.trim(),
    altPhone: document.getElementById('ship_alt_phone').value.trim(),
    pincode: document.getElementById('ship_pincode').value.trim(),
    city: document.getElementById('ship_city').value.trim(),
    state: document.getElementById('ship_state').value.trim(),
    house: document.getElementById('ship_house').value.trim(),
    street: document.getElementById('ship_street').value.trim(),
    note: document.getElementById('ship_note').value.trim(),
  };
  document.getElementById('confirm_name').textContent = shippingData.name + '  📞 ' + shippingData.phone;
  document.getElementById('confirm_address').innerHTML = shippingData.house + ', ' + shippingData.street + '<br>' + shippingData.city + ', ' + shippingData.state + ' - ' + shippingData.pincode + (shippingData.note ? '<br>📝 ' + shippingData.note : '');
  const items = Object.values(cart);
  const subtotal = items.reduce((s,i) => s + i.selectedPrice*i.qty, 0);
  const delivery = getDeliveryCharge(shippingData.state, subtotal);
  const isAP_TG = AP_TG_STATES.some(s => shippingData.state.toLowerCase().includes(s));
  const deliveryLabel = delivery === 0 ? '<span style="color:green">FREE</span>' :
    `₹${delivery} <small style="color:#aaa;font-size:0.65rem;">(${isAP_TG ? 'AP/TG rate' : 'Other state rate'})</small>`;
  document.getElementById('confirm_items').innerHTML = items.map(i => `<div class="shipping-summary-row"><span>${i.name} (${i.selectedWeight||'250g'}) x${i.qty}</span><span>₹${i.selectedPrice*i.qty}</span></div>`).join('') +
    `<div class="shipping-summary-row"><span>Delivery</span><span>${deliveryLabel}</span></div>`;
  document.getElementById('confirm_total').textContent = '₹' + (subtotal+delivery);
  document.getElementById('shippingPage1').style.display = 'none';
  document.getElementById('shippingPage2').style.display = 'block';
  document.getElementById('stepAddress').className = 'shipping-step done';
  document.getElementById('stepPayment').className = 'shipping-step active';
  document.getElementById('shippingDrawer').scrollTop = 0;
}

function proceedToPayment() {
  if (proceedToPayment._busy) return;
  proceedToPayment._busy = true;
  setTimeout(() => proceedToPayment._busy = false, 2000);
  document.getElementById('shippingDrawer').classList.remove('open');
  document.getElementById('overlay').classList.remove('open');
  startPayment();
}

// ── EMAIL ──
emailjs.init('CmgzshDIJLAWVwlW8');

function sendOrderEmail(items, total, shipping, paymentId) {
  const subtotal = items.reduce((s,i) => s + i.selectedPrice*i.qty, 0);
  const delivery = getDeliveryCharge(shipping?.state || '', subtotal);
  const itemLines = items.map(i => i.name + ' (' + (i.selectedWeight||'250g') + ') x' + i.qty + ' = Rs.' + (i.selectedPrice*i.qty)).join('\n');
  const address = shipping ? [shipping.house+', '+shipping.street, shipping.city+', '+shipping.state+' - '+shipping.pincode].join(', ') : 'Not provided';
  const isAP_TG = AP_TG_STATES.some(s => (shipping?.state||'').toLowerCase().includes(s));
  const deliveryInfo = delivery === 0 ? 'FREE (above Rs.1000)' : `Rs.${delivery} (${isAP_TG ? 'AP/Telangana rate' : 'Other state rate'})`;
  const now = new Date().toLocaleString('en-IN', {day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  emailjs.send('service_1hzy94j','template_wclu0uv',{
    date: now, payment_id: paymentId||'N/A', items: itemLines,
    subtotal, delivery: deliveryInfo, total,
    customer_name: shipping?.name||'Guest', phone: shipping?.phone||'N/A',
    address, delivery_state: shipping?.state||'N/A',
    shipping_note: `Delivery Charge: ${deliveryInfo} | State: ${shipping?.state||'N/A'}`
  }).catch(err=>console.error('Email failed:',err));
}

// ── ORDER PLACED PAGE ──
function showOrderPlacedPage(items, total, shipping, paymentId) {
  const subtotal = items.reduce((s,i) => s + i.selectedPrice*i.qty, 0);
  const delivery = getDeliveryCharge(shipping?.state || '', subtotal);
  const isAP_TG = AP_TG_STATES.some(s => (shipping?.state||'').toLowerCase().includes(s));
  const now = new Date().toLocaleString('en-IN', {day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  const itemsHtml = items.map(i =>
    `<div class="order-placed-row"><span>${i.name} (${i.selectedWeight||'250g'}) x${i.qty}</span><strong>₹${i.selectedPrice*i.qty}</strong></div>`
  ).join('');
  const deliveryLabel = delivery === 0 ? 'FREE' : `₹${delivery} (${isAP_TG ? 'AP/TG' : 'Other State'})`;
  document.getElementById('orderPlacedDetails').innerHTML = `
    ${itemsHtml}
    <div class="order-placed-row"><span>Delivery Charge</span><strong>${deliveryLabel}</strong></div>
    <div class="order-placed-row total"><span>Total Paid</span><span>₹${total}</span></div>
    <div class="order-placed-row" style="margin-top:0.5rem;"><span>📍 Deliver to</span><strong>${shipping?.city || ''}, ${shipping?.state || ''}</strong></div>
    <div class="order-placed-row"><span>🕐 Ordered on</span><strong>${now}</strong></div>
    ${paymentId ? `<div class="order-placed-row"><span>Payment ID</span><strong style="font-size:0.7rem;">${paymentId}</strong></div>` : ''}
  `;
  document.getElementById('orderPlacedPage').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeOrderPlacedPage() {
  document.getElementById('orderPlacedPage').classList.remove('open');
  document.body.style.overflow = '';
}

// ── RAZORPAY PAYMENT ──
function startPayment() {
  const items = Object.values(cart);
  if (!items.length) return;
  const subtotal = items.reduce((s,i) => s + i.selectedPrice*i.qty, 0);
  const delivery = getDeliveryCharge(shippingData?.state || '', subtotal);
  const total = subtotal + delivery;
  const options = {
    key: "rzp_test_SN8B17Y4nm9Htx",
    amount: total * 100, currency: "INR",
    name: "Sree Ramu Sweets", description: "Sweet Order",
    theme: { color: '#E8650A' },
    handler: async function(response) {
      const purchasedIds = items.map(i => i.id);
      purchasedIds.forEach(pid => purchasedProducts.add(pid));
      try { if (window.saveOrderToFirebase) await window.saveOrderToFirebase(items, total, shippingData); } catch(e) {}
      sendOrderEmail(items, total, shippingData, response.razorpay_payment_id);
      cart = {}; updateCartBadge();
      showOrderPlacedPage(items, total, shippingData, response.razorpay_payment_id);
    }
  };
  const rzp = new Razorpay(options);
  rzp.open();
}
