/* =====================================================
   ML NUTRITION - Cart & Wishlist (shared module)
   Self-contained: injects its own CSS + UI drawers.
   Pages only need: nav icons + product card buttons +
   <script src="cart.js"></script>
   ===================================================== */
(function () {
	'use strict';

	const WHATSAPP_NUMBER = '918329384588';
	const CART_KEY = 'mlnutrition-cart';
	const WISHLIST_KEY = 'mlnutrition-wishlist';

	/* ---------- i18n ---------- */
	const T = {
		en: {
			cartTitle: 'Your Cart',
			wishlistTitle: 'Your Wishlist',
			emptyCart: 'Your cart is empty',
			emptyWishlist: 'Your wishlist is empty',
			browse: 'Browse Products',
			estTotal: 'Estimated Total',
			priceRequest: 'Price on request',
			checkout: 'Checkout via WhatsApp',
			moveToCart: 'Move to Cart',
			remove: 'Remove',
			addedCart: 'Added to cart',
			addedWish: 'Added to wishlist',
			removedWish: 'Removed from wishlist',
			removedCart: 'Removed from cart',
			outOfStock: 'Out of stock',
			note: 'Final price confirmed on WhatsApp.',
			waIntro: 'Hi ML Nutrition! I would like to order the following items:',
			waTotal: 'Estimated Total',
			waConfirm: 'Please confirm availability and final price.',
			qty: 'Qty'
		},
		mr: {
			cartTitle: 'तुमची कार्ट',
			wishlistTitle: 'तुमची इच्छा-यादी',
			emptyCart: 'तुमची कार्ट रिकामी आहे',
			emptyWishlist: 'तुमची इच्छा-यादी रिकामी आहे',
			browse: 'उत्पादने पहा',
			estTotal: 'अंदाजे एकूण',
			priceRequest: 'किंमत विचारणा',
			checkout: 'व्हाट्सअॅपवर ऑर्डर करा',
			moveToCart: 'कार्टमध्ये टाका',
			remove: 'काढा',
			addedCart: 'कार्टमध्ये जोडले',
			addedWish: 'इच्छा-यादीत जोडले',
			removedWish: 'इच्छा-यादीतून काढले',
			removedCart: 'कार्टमधून काढले',
			outOfStock: 'स्टॉक संपला',
			note: 'अंतिम किंमत व्हाट्सअॅपवर निश्चित होईल.',
			waIntro: 'नमस्ते ML Nutrition! मला खालील उत्पादने ऑर्डर करायची आहेत:',
			waTotal: 'अंदाजे एकूण',
			waConfirm: 'कृपया उपलब्धता आणि अंतिम किंमत सांगा.',
			qty: 'संख्या'
		}
	};

	function lang() {
		const l = localStorage.getItem('mlnutrition-lang');
		return l === 'mr' ? 'mr' : 'en';
	}
	function t(key) {
		return (T[lang()] && T[lang()][key]) || T.en[key] || key;
	}

	/* ---------- State ---------- */
	const registry = {}; // id -> product

	function read(key) {
		try {
			return JSON.parse(localStorage.getItem(key)) || [];
		} catch (e) {
			return [];
		}
	}
	function write(key, val) {
		localStorage.setItem(key, JSON.stringify(val));
	}
	function getCart() { return read(CART_KEY); }
	function getWishlist() { return read(WISHLIST_KEY); }
	function saveCart(c) { write(CART_KEY, c); }
	function saveWishlist(w) { write(WISHLIST_KEY, w); }

	/* ---------- Price parsing ---------- */
	function parsePrice(str) {
		if (!str) return null;
		const nums = String(str).match(/\d+/g);
		if (!nums || nums.length === 0) return null;
		const vals = nums.map(Number);
		return { min: Math.min(...vals), max: Math.max(...vals) };
	}
	function formatINR(n) {
		return '₹' + n.toLocaleString('en-IN');
	}
	function cartTotals() {
		const cart = getCart();
		let min = 0, max = 0, hasRequest = false, known = false;
		cart.forEach(item => {
			const p = parsePrice(item.price_range);
			if (p) {
				min += p.min * item.qty;
				max += p.max * item.qty;
				known = true;
			} else {
				hasRequest = true;
			}
		});
		return { min, max, hasRequest, known };
	}

	/* ---------- Product lookup ---------- */
	function findProduct(id) {
		if (registry[id]) return registry[id];
		// fallback: search stored cart/wishlist snapshots
		const all = getCart().concat(getWishlist());
		return all.find(p => String(p.id) === String(id)) || null;
	}

	function snapshot(p) {
		return {
			id: p.id,
			name: p.name || 'Product',
			brand: p.brand || 'ML Nutrition',
			price_range: p.price_range || '',
			image_url: p.image_url ? String(p.image_url).split(/,(?=\s*https?:\/\/)/)[0].trim() : '',
			in_stock: p.in_stock || ''
		};
	}

	// Build a unique line key for a product + optional flavour.
	function lineId(id, flavour) {
		return flavour ? String(id) + '::' + flavour : String(id);
	}
	// Escape a string for safe use inside a single-quoted inline JS handler.
	function jsq(s) {
		return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
	}
	// Escape a string for safe HTML text.
	function esc(s) {
		return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	}

	/* ---------- Cart ops ---------- */
	function addToCart(id, flavour, qty) {
		const prod = findProduct(id);
		if (!prod) return;
		if (prod.in_stock && prod.in_stock !== 'Yes') {
			showToast(t('outOfStock'), 'error');
			return;
		}
		const addQty = Math.max(1, parseInt(qty, 10) || 1);
		const key = lineId(id, flavour);
		const cart = getCart();
		const existing = cart.find(i => String(i.id) === key);
		if (existing) {
			existing.qty += addQty;
		} else {
			const s = snapshot(prod);
			s.productId = prod.id;
			s.id = key;
			if (flavour) s.flavour = flavour;
			s.qty = addQty;
			cart.push(s);
		}
		saveCart(cart);
		updateBadges();
		renderCart();
		showToast(t('addedCart'), 'success');
		bump('cartBtn');
	}
	function removeFromCart(id) {
		saveCart(getCart().filter(i => String(i.id) !== String(id)));
		updateBadges();
		renderCart();
	}
	function setQty(id, delta) {
		const cart = getCart();
		const item = cart.find(i => String(i.id) === String(id));
		if (!item) return;
		item.qty += delta;
		if (item.qty <= 0) {
			saveCart(cart.filter(i => String(i.id) !== String(id)));
		} else {
			saveCart(cart);
		}
		updateBadges();
		renderCart();
	}

	/* ---------- Wishlist ops ---------- */
	function isInWishlist(id, flavour) {
		const key = lineId(id, flavour);
		return getWishlist().some(i => String(i.id) === key);
	}
	function toggleWishlist(id, flavour) {
		const prod = findProduct(id);
		if (!prod) return;
		const key = lineId(id, flavour);
		let wl = getWishlist();
		if (isInWishlist(id, flavour)) {
			wl = wl.filter(i => String(i.id) !== key);
			saveWishlist(wl);
			showToast(t('removedWish'));
		} else {
			const s = snapshot(prod);
			s.productId = prod.id;
			s.id = key;
			if (flavour) s.flavour = flavour;
			wl.push(s);
			saveWishlist(wl);
			showToast(t('addedWish'), 'success');
			bump('wishlistBtn');
		}
		updateBadges();
		renderWishlist();
		syncWishlistButtons();
	}
	function removeFromWishlist(id) {
		saveWishlist(getWishlist().filter(i => String(i.id) !== String(id)));
		updateBadges();
		renderWishlist();
		syncWishlistButtons();
	}
	function moveToCart(id) {
		const item = getWishlist().find(i => String(i.id) === String(id));
		if (!item) return;
		if (item.in_stock && item.in_stock !== 'Yes') {
			showToast(t('outOfStock'), 'error');
			return;
		}
		const cart = getCart();
		const existing = cart.find(i => String(i.id) === String(item.id));
		if (existing) {
			existing.qty += 1;
		} else {
			const s = Object.assign({}, item);
			s.qty = 1;
			cart.push(s);
		}
		saveCart(cart);
		removeFromWishlist(id);
		updateBadges();
		renderCart();
		showToast(t('addedCart'), 'success');
		bump('cartBtn');
	}

	/* ---------- Badges & button sync ---------- */
	function updateBadges() {
		const cartCount = getCart().reduce((s, i) => s + i.qty, 0);
		const wishCount = getWishlist().length;
		document.querySelectorAll('#cartBadge').forEach(b => {
			b.textContent = cartCount;
			b.style.display = cartCount > 0 ? 'flex' : 'none';
		});
		document.querySelectorAll('#wishlistBadge').forEach(b => {
			b.textContent = wishCount;
			b.style.display = wishCount > 0 ? 'flex' : 'none';
		});
	}
	function syncWishlistButtons() {
		document.querySelectorAll('[data-wishlist-id]').forEach(btn => {
			const active = isInWishlist(btn.dataset.wishlistId);
			btn.classList.toggle('active', active);
		});
	}

	function bump(id) {
		const el = document.getElementById(id);
		if (!el) return;
		el.classList.remove('ml-bump');
		void el.offsetWidth;
		el.classList.add('ml-bump');
	}

	/* ---------- Rendering: Cart ---------- */
	function lineItemHTML(item, inCart) {
		const initials = item.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
		const img = item.image_url
			? `<img src="${item.image_url}" alt="" onerror="this.parentElement.innerHTML='${initials}'">`
			: initials;
		const priceP = parsePrice(item.price_range);
		const priceText = priceP ? '₹' + item.price_range : t('priceRequest');
		const idArg = jsq(item.id);
		const flavourLine = item.flavour ? `<div class="ml-line-flavour">${esc(item.flavour)}</div>` : '';
		const qtyControls = inCart
			? `<div class="ml-qty">
					<button onclick="MLStore.setQty('${idArg}',-1)" aria-label="Decrease">−</button>
					<span>${item.qty}</span>
					<button onclick="MLStore.setQty('${idArg}',1)" aria-label="Increase">+</button>
				</div>`
			: `<button class="ml-move-btn" onclick="MLStore.moveToCart('${idArg}')">${t('moveToCart')}</button>`;
		const removeFn = inCart ? `MLStore.removeFromCart('${idArg}')` : `MLStore.removeFromWishlist('${idArg}')`;
		return `
			<div class="ml-line">
				<div class="ml-line-img">${img}</div>
				<div class="ml-line-info">
					<div class="ml-line-brand">${item.brand}</div>
					<div class="ml-line-name">${item.name}</div>
					${flavourLine}
					<div class="ml-line-price">${priceText}</div>
					${qtyControls}
				</div>
				<button class="ml-line-remove" onclick="${removeFn}" aria-label="${t('remove')}">×</button>
			</div>`;
	}

	function renderCart() {
		const body = document.getElementById('mlCartBody');
		const footer = document.getElementById('mlCartFooter');
		if (!body) return;
		const cart = getCart();
		if (cart.length === 0) {
			body.innerHTML = emptyState(t('emptyCart'));
			footer.innerHTML = '';
			footer.style.display = 'none';
			return;
		}
		body.innerHTML = cart.map(i => lineItemHTML(i, true)).join('');
		const tot = cartTotals();
		let totalText;
		if (tot.known) {
			totalText = tot.min === tot.max ? formatINR(tot.min) : formatINR(tot.min) + ' - ' + formatINR(tot.max);
			if (tot.hasRequest) totalText += ' +';
		} else {
			totalText = t('priceRequest');
		}
		footer.style.display = 'block';
		footer.innerHTML = `
			<div class="ml-total-row">
				<span>${t('estTotal')}</span>
				<strong>${totalText}</strong>
			</div>
			<p class="ml-note">${t('note')}</p>
			<button class="ml-checkout" onclick="MLStore.checkout()">
				<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
				${t('checkout')}
			</button>`;
	}

	function renderWishlist() {
		const body = document.getElementById('mlWishBody');
		if (!body) return;
		const wl = getWishlist();
		if (wl.length === 0) {
			body.innerHTML = emptyState(t('emptyWishlist'));
			return;
		}
		body.innerHTML = wl.map(i => lineItemHTML(i, false)).join('');
	}

	function emptyState(msg) {
		return `
			<div class="ml-empty">
				<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
					<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
					<path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
				</svg>
				<p>${msg}</p>
				<a href="products.html" class="ml-browse">${t('browse')}</a>
			</div>`;
	}

	/* ---------- Checkout (WhatsApp) ---------- */
	function checkout() {
		const cart = getCart();
		if (cart.length === 0) return;
		let msg = t('waIntro') + '\n\n';
		cart.forEach((item, idx) => {
			const priceP = parsePrice(item.price_range);
			const priceText = priceP ? '₹' + item.price_range : t('priceRequest');
			const flavourText = item.flavour ? ` [${item.flavour}]` : '';
			msg += `${idx + 1}. ${item.name}${flavourText} (${item.brand}) — ${t('qty')}: ${item.qty} — ${priceText}\n`;
		});
		const tot = cartTotals();
		if (tot.known) {
			const totalText = tot.min === tot.max ? formatINR(tot.min) : formatINR(tot.min) + ' - ' + formatINR(tot.max);
			msg += `\n${t('waTotal')}: ${totalText}${tot.hasRequest ? ' +' : ''}\n`;
		}
		msg += `\n${t('waConfirm')}`;
		window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
	}

	/* ---------- Drawers ---------- */
	function openCart() { renderCart(); openDrawer('mlCartDrawer'); }
	function closeCart() { closeDrawer('mlCartDrawer'); }
	function openWishlist() { renderWishlist(); openDrawer('mlWishDrawer'); }
	function closeWishlist() { closeDrawer('mlWishDrawer'); }

	function openDrawer(id) {
		document.getElementById('mlOverlay').classList.add('active');
		document.getElementById(id).classList.add('active');
		document.body.style.overflow = 'hidden';
	}
	function closeDrawer(id) {
		document.getElementById(id).classList.remove('active');
		const anyOpen = document.querySelector('.ml-drawer.active');
		if (!anyOpen) {
			document.getElementById('mlOverlay').classList.remove('active');
			document.body.style.overflow = '';
		}
	}
	function closeAll() {
		document.querySelectorAll('.ml-drawer').forEach(d => d.classList.remove('active'));
		document.getElementById('mlOverlay').classList.remove('active');
		document.body.style.overflow = '';
	}

	/* ---------- Toast ---------- */
	let toastTimer;
	function showToast(msg, type) {
		let toast = document.getElementById('mlToast');
		if (!toast) return;
		toast.textContent = msg;
		toast.className = 'ml-toast show' + (type ? ' ' + type : '');
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => { toast.className = 'ml-toast'; }, 2200);
	}

	/* ---------- Public API for product cards ---------- */
	function registerProducts(list) {
		(list || []).forEach(p => {
			if (p && p.id != null) registry[String(p.id)] = p;
			else if (p && p.name) registry[String(p.name)] = p;
		});
		// reflect wishlist state on freshly rendered cards
		setTimeout(syncWishlistButtons, 0);
	}

	// Returns the action buttons markup for a product card.
	function cardButtons(product) {
		const id = product.id != null ? product.id : product.name;
		const safeId = String(id).replace(/"/g, '&quot;');
		const inStock = product.in_stock === 'Yes';
		const wished = isInWishlist(id) ? ' active' : '';
		const cartBtn = inStock
			? `<button class="ml-card-cart" data-cart-id="${safeId}" aria-label="Add to cart">
					<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
				</button>`
			: '';
		return `
			<div class="ml-card-actions">
				<button class="ml-card-wish${wished}" data-wishlist-id="${safeId}" aria-label="Wishlist">
					<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
				</button>
				${cartBtn}
			</div>`;
	}

	// Inject action buttons into freshly rendered cards (order matches list).
	function decorateCards(products) {
		const cards = document.querySelectorAll('.product-card');
		cards.forEach((card, i) => {
			if (card.querySelector('.ml-card-actions')) return;
			const product = (products || [])[i];
			if (!product) return;
			registry[String(product.id != null ? product.id : product.name)] = product;
			card.insertAdjacentHTML('afterbegin', cardButtons(product));
		});
		syncWishlistButtons();
	}

	/* ---------- Event delegation ---------- */
	document.addEventListener('click', function (e) {
		const wb = e.target.closest('[data-wishlist-id]');
		if (wb) { e.preventDefault(); toggleWishlist(wb.dataset.wishlistId); return; }
		const cb = e.target.closest('[data-cart-id]');
		if (cb) { e.preventDefault(); addToCart(cb.dataset.cartId); return; }
	});

	/* ---------- Inject CSS ---------- */
	function injectCSS() {
		const css = `
		.nav-actions{display:flex;align-items:center;gap:.5rem}
		.ml-icon-btn{position:relative;background:none;border:none;color:var(--white,#fff);cursor:pointer;padding:8px;display:flex;align-items:center;justify-content:center;border-radius:8px;transition:background .25s,transform .25s}
		.ml-icon-btn:hover{background:rgba(255,255,255,.08)}
		.ml-icon-btn svg{width:22px;height:22px;display:block}
		.ml-bump{animation:mlBump .4s ease}
		@keyframes mlBump{0%{transform:scale(1)}30%{transform:scale(1.25)}60%{transform:scale(.9)}100%{transform:scale(1)}}
		.nav-badge{position:absolute;top:0;right:0;min-width:18px;height:18px;padding:0 5px;background:var(--primary,#E31E24);color:#fff;font-size:11px;font-weight:700;border-radius:9px;display:none;align-items:center;justify-content:center;line-height:1}
		.ml-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(2px);opacity:0;visibility:hidden;transition:opacity .3s;z-index:2000}
		.ml-overlay.active{opacity:1;visibility:visible}
		.ml-drawer{position:fixed;top:0;right:-100%;width:400px;max-width:90vw;height:100%;background:var(--surface,#111);border-left:1px solid var(--border,#222);z-index:2001;display:flex;flex-direction:column;transition:right .35s cubic-bezier(.4,0,.2,1)}
		.ml-drawer.active{right:0}
		.ml-drawer-head{display:flex;align-items:center;justify-content:space-between;padding:1.3rem 1.4rem;border-bottom:1px solid var(--border,#222)}
		.ml-drawer-head h3{font-size:18px;font-weight:700;color:var(--white,#fff);letter-spacing:.5px}
		.ml-drawer-close{background:none;border:none;color:var(--grey,#888);font-size:26px;line-height:1;cursor:pointer;transition:color .25s}
		.ml-drawer-close:hover{color:var(--white,#fff)}
		.ml-drawer-body{flex:1;overflow-y:auto;padding:1rem 1.2rem}
		.ml-line{display:flex;gap:.9rem;padding:.9rem 0;border-bottom:1px solid var(--border,#222);position:relative}
		.ml-line-img{width:62px;height:62px;border-radius:10px;background:var(--card,#161616);display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--grey,#888);overflow:hidden;flex-shrink:0}
		.ml-line-img img{width:100%;height:100%;object-fit:cover}
		.ml-line-info{flex:1;min-width:0}
		.ml-line-brand{font-size:11px;color:var(--grey,#888);text-transform:uppercase;letter-spacing:.5px}
		.ml-line-name{font-size:14px;font-weight:600;color:var(--white,#fff);margin:2px 0 4px;line-height:1.3}
		.ml-line-flavour{display:inline-block;font-size:11px;color:var(--white,#fff);background:var(--card,#161616);border:1px solid var(--border,#222);border-radius:6px;padding:2px 8px;margin-bottom:6px}
		.ml-line-price{font-size:14px;font-weight:700;color:var(--primary,#E31E24);margin-bottom:.5rem}
		.ml-line-remove{position:absolute;top:.9rem;right:0;background:none;border:none;color:var(--grey,#888);font-size:20px;cursor:pointer;line-height:1;transition:color .25s}
		.ml-line-remove:hover{color:var(--primary,#E31E24)}
		.ml-qty{display:inline-flex;align-items:center;border:1px solid var(--border,#222);border-radius:8px;overflow:hidden}
		.ml-qty button{width:30px;height:30px;background:var(--card,#161616);border:none;color:var(--white,#fff);font-size:16px;cursor:pointer;transition:background .25s}
		.ml-qty button:hover{background:var(--primary,#E31E24)}
		.ml-qty span{min-width:34px;text-align:center;font-weight:600;color:var(--white,#fff)}
		.ml-move-btn{background:var(--card,#161616);border:1px solid var(--border,#222);color:var(--white,#fff);padding:7px 14px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;transition:all .25s}
		.ml-move-btn:hover{background:var(--primary,#E31E24);border-color:var(--primary,#E31E24)}
		.ml-drawer-foot{padding:1.2rem 1.4rem;border-top:1px solid var(--border,#222);background:var(--bg,#080808)}
		.ml-total-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:.4rem}
		.ml-total-row span{color:var(--grey,#888);font-size:14px}
		.ml-total-row strong{color:var(--white,#fff);font-size:18px}
		.ml-note{font-size:11px;color:var(--grey,#888);margin-bottom:.9rem}
		.ml-checkout{width:100%;display:flex;align-items:center;justify-content:center;gap:.6rem;background:#25D366;color:#fff;border:none;padding:14px;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;transition:transform .2s,box-shadow .2s}
		.ml-checkout:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(37,211,102,.35)}
		.ml-empty{text-align:center;padding:3rem 1rem;color:var(--grey,#888)}
		.ml-empty svg{color:var(--border,#333);margin-bottom:1rem}
		.ml-empty p{margin-bottom:1.4rem;font-size:15px}
		.ml-browse{display:inline-block;background:var(--primary,#E31E24);color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:600;font-size:14px;transition:transform .2s}
		.ml-browse:hover{transform:translateY(-2px)}
		.ml-toast{position:fixed;bottom:-80px;left:50%;transform:translateX(-50%);background:var(--card,#161616);color:#fff;padding:13px 24px;border-radius:10px;font-size:14px;font-weight:600;box-shadow:0 8px 30px rgba(0,0,0,.5);border:1px solid var(--border,#222);z-index:3000;transition:bottom .35s cubic-bezier(.4,0,.2,1);max-width:90vw;text-align:center}
		.ml-toast.show{bottom:28px}
		.ml-toast.success{border-color:#25D366}
		.ml-toast.error{border-color:var(--primary,#E31E24)}
		/* product card action buttons */
		.product-card{position:relative}
		.ml-card-actions{position:absolute;top:10px;right:10px;display:flex;flex-direction:column;gap:8px;z-index:5}
		.ml-card-wish,.ml-card-cart{width:38px;height:38px;border-radius:50%;border:1px solid var(--border,#222);background:rgba(8,8,8,.75);backdrop-filter:blur(6px);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .25s}
		.ml-card-wish:hover{background:var(--primary,#E31E24);border-color:var(--primary,#E31E24);transform:scale(1.1)}
		.ml-card-wish.active{background:var(--primary,#E31E24);border-color:var(--primary,#E31E24)}
		.ml-card-wish.active svg{fill:#fff}
		.ml-card-cart:hover{background:#25D366;border-color:#25D366;transform:scale(1.1)}
		@media(max-width:480px){.ml-card-wish,.ml-card-cart{width:34px;height:34px}.ml-card-wish svg,.ml-card-cart svg{width:16px;height:16px}}
		`;
		const style = document.createElement('style');
		style.id = 'ml-cart-styles';
		style.textContent = css;
		document.head.appendChild(style);
	}

	/* ---------- Inject drawer + overlay + toast markup ---------- */
	function injectUI() {
		const wrap = document.createElement('div');
		wrap.innerHTML = `
			<div class="ml-overlay" id="mlOverlay"></div>
			<aside class="ml-drawer" id="mlCartDrawer" aria-label="Cart">
				<div class="ml-drawer-head">
					<h3 id="mlCartTitle">${t('cartTitle')}</h3>
					<button class="ml-drawer-close" onclick="MLStore.closeCart()" aria-label="Close">×</button>
				</div>
				<div class="ml-drawer-body" id="mlCartBody"></div>
				<div class="ml-drawer-foot" id="mlCartFooter" style="display:none"></div>
			</aside>
			<aside class="ml-drawer" id="mlWishDrawer" aria-label="Wishlist">
				<div class="ml-drawer-head">
					<h3 id="mlWishTitle">${t('wishlistTitle')}</h3>
					<button class="ml-drawer-close" onclick="MLStore.closeWishlist()" aria-label="Close">×</button>
				</div>
				<div class="ml-drawer-body" id="mlWishBody"></div>
			</aside>
			<div class="ml-toast" id="mlToast"></div>`;
		document.body.appendChild(wrap);
		document.getElementById('mlOverlay').addEventListener('click', closeAll);
		document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });
	}

	/* ---------- Wire nav icons ---------- */
	function wireNav() {
		document.querySelectorAll('#cartBtn').forEach(b => b.addEventListener('click', openCart));
		document.querySelectorAll('#wishlistBtn').forEach(b => b.addEventListener('click', openWishlist));
	}

	/* ---------- Refresh translated titles on language change ---------- */
	function refreshLang() {
		const ct = document.getElementById('mlCartTitle');
		const wt = document.getElementById('mlWishTitle');
		if (ct) ct.textContent = t('cartTitle');
		if (wt) wt.textContent = t('wishlistTitle');
		renderCart();
		renderWishlist();
	}

	/* ---------- Init ---------- */
	function init() {
		injectCSS();
		injectUI();
		wireNav();
		updateBadges();
		syncWishlistButtons();
	}
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}

	/* ---------- Expose ---------- */
	window.MLStore = {
		addToCart, removeFromCart, setQty,
		toggleWishlist, removeFromWishlist, moveToCart, isInWishlist,
		openCart, closeCart, openWishlist, closeWishlist,
		checkout, registerProducts, cardButtons, decorateCards,
		updateBadges, syncWishlistButtons, refreshLang,
		toast: showToast
	};
})();
