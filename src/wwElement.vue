<template>
  <div v-if="!content.portalTarget || content.portalTarget === 'admin'" class="spread-cb">
    <!-- Gate: no credentials -->
    <div v-if="!content.accessToken || !content.userId" class="spread-cb__gate">
      <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      <p class="spread-cb__gate-text">Admin access required</p>
    </div>

    <!-- Permission gate -->
    <div v-else-if="!canManageOrders" class="spread-cb__gate">
      <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
      <p class="spread-cb__gate-text">You don't have permission to build orders</p>
    </div>

    <template v-else>
      <!-- Header -->
      <div class="spread-cb__header">
        <h2 class="spread-cb__title">Build Order</h2>
        <div class="spread-cb__stepper" aria-label="Steps">
          <div v-for="(step, i) in STEPS" :key="step.key" class="spread-cb__step" :class="{ 'spread-cb__step--active': activeSection === step.key, 'spread-cb__step--done': stepDone(step.key) }">
            <span class="spread-cb__step-num">
              <svg v-if="stepDone(step.key)" viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
              <span v-else>{{ i + 1 }}</span>
            </span>
            <span class="spread-cb__step-label">{{ step.label }}</span>
          </div>
        </div>
      </div>

      <!-- Error -->
      <div v-if="error" class="spread-cb__error" role="alert">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        {{ error }}
        <button class="spread-cb__error-dismiss" @click="error = null" aria-label="Dismiss">×</button>
      </div>

      <!-- ── Step 1: Select Customer ──────────────────────────────────── -->
      <div v-show="activeSection === 'customer'" class="spread-cb__section">
        <h3 class="spread-cb__section-title">Select Customer</h3>
        <div class="spread-cb__search-wrap">
          <svg class="spread-cb__search-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            class="spread-cb__search-input"
            type="text"
            v-model="customerQuery"
            placeholder="Search by name or email…"
            @input="debouncedSearch"
            autocomplete="off"
          />
          <div v-if="searchingCustomers" class="spread-cb__inline-spinner"></div>
        </div>

        <!-- Results -->
        <div v-if="customerResults.length" class="spread-cb__customer-list">
          <button
            v-for="c in customerResults"
            :key="c.id"
            class="spread-cb__customer-row"
            :class="{ 'spread-cb__customer-row--selected': selectedCustomer?.id === c.id }"
            @click="selectCustomer(c)"
          >
            <div class="spread-cb__customer-avatar">
              <img v-if="c.avatar_url" :src="c.avatar_url" alt="" width="36" height="36" loading="lazy" />
              <span v-else class="spread-cb__customer-initials">{{ initials(c.display_name) }}</span>
            </div>
            <div class="spread-cb__customer-info">
              <span class="spread-cb__customer-name">{{ c.display_name || 'Unknown' }}</span>
              <span class="spread-cb__customer-meta">{{ c.email }}</span>
            </div>
            <svg v-if="selectedCustomer?.id === c.id" class="spread-cb__customer-check" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
          </button>
        </div>
        <p v-else-if="customerQuery.length >= 2 && !searchingCustomers" class="spread-cb__empty-msg">No customers found for "{{ customerQuery }}"</p>
        <p v-else-if="!customerQuery" class="spread-cb__hint">Start typing to search customers</p>

        <div class="spread-cb__nav-row">
          <span></span>
          <button
            class="spread-cb__btn spread-cb__btn--primary"
            :disabled="!selectedCustomer || creatingCart"
            @click="confirmCustomer"
          >
            <div v-if="creatingCart" class="spread-cb__inline-spinner spread-cb__inline-spinner--white"></div>
            <span v-else>Create cart &amp; continue</span>
            <svg v-if="!creatingCart" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>

      <!-- ── Step 2: Build Cart ───────────────────────────────────────── -->
      <div v-show="activeSection === 'build'" class="spread-cb__section">
        <h3 class="spread-cb__section-title">
          Build Cart
          <span class="spread-cb__section-badge">{{ selectedCustomer?.display_name }}</span>
        </h3>

        <div class="spread-cb__build-layout">
          <!-- Left: product search -->
          <div class="spread-cb__products-panel">
            <div class="spread-cb__search-wrap spread-cb__search-wrap--sm">
              <svg class="spread-cb__search-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                class="spread-cb__search-input"
                type="text"
                v-model="productQuery"
                placeholder="Search products…"
                @input="debouncedProductSearch"
              />
            </div>
            <div class="spread-cb__product-list">
              <div v-if="searchingProducts" class="spread-cb__loading-row">
                <div class="spread-cb__spinner spread-cb__spinner--sm"></div>
                Searching…
              </div>
              <div v-else-if="!productResults.length && productQuery" class="spread-cb__empty-msg">No products found</div>
              <button
                v-for="p in productResults"
                :key="p.id"
                class="spread-cb__product-row"
                @click="addProduct(p)"
                :disabled="addingProductId === p.id"
              >
                <img v-if="p.image_url" :src="p.image_url" :alt="p.name" class="spread-cb__product-img" width="36" height="36" loading="lazy" />
                <div v-else class="spread-cb__product-img-placeholder">🌿</div>
                <div class="spread-cb__product-info">
                  <span class="spread-cb__product-name">{{ p.name }}</span>
                  <span class="spread-cb__product-price">{{ formatCents(p.price_cents ?? p.member_price_cents) }}</span>
                </div>
                <div v-if="addingProductId === p.id" class="spread-cb__inline-spinner"></div>
                <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            </div>
          </div>

          <!-- Right: cart items -->
          <div class="spread-cb__cart-panel">
            <h4 class="spread-cb__cart-panel-title">
              Cart
              <span v-if="cartItems.length" class="spread-cb__cart-count-badge">{{ cartItems.length }}</span>
              <button class="spread-cb__cart-refresh" @click="fetchCartItems" :disabled="loadingCart" title="Refresh cart">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              </button>
            </h4>
            <div v-if="loadingCart" class="spread-cb__loading-row">
              <div class="spread-cb__spinner spread-cb__spinner--sm"></div>
            </div>
            <div v-else-if="!cartItems.length" class="spread-cb__empty-msg">No items yet — add products from the left panel</div>
            <ul v-else class="spread-cb__cart-list">
              <li v-for="item in cartItems" :key="item.cart_item_id" class="spread-cb__cart-item">
                <img v-if="item.image_url" :src="item.image_url" :alt="item.product_name" class="spread-cb__product-img" width="32" height="32" loading="lazy" />
                <div class="spread-cb__cart-item-info">
                  <span class="spread-cb__cart-item-name">{{ item.product_name }}</span>
                  <span class="spread-cb__cart-item-price">{{ formatCents(item.unit_price) }}</span>
                </div>
                <div class="spread-cb__qty-stepper">
                  <button class="spread-cb__qty-btn" @click="adjustQty(item, -1)" :disabled="item.qty <= 1">−</button>
                  <span class="spread-cb__qty-val">{{ item.qty }}</span>
                  <button class="spread-cb__qty-btn" @click="adjustQty(item, +1)">+</button>
                </div>
                <span class="spread-cb__cart-item-total">{{ formatCents(item.line_total) }}</span>
                <button class="spread-cb__cart-item-remove" @click="removeItem(item)" title="Remove">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </li>
            </ul>
            <div v-if="cartItems.length" class="spread-cb__cart-total">
              <span>Total</span>
              <span class="spread-cb__cart-total-value">{{ formatCents(cartTotal) }}</span>
            </div>
          </div>
        </div>

        <div class="spread-cb__nav-row">
          <button class="spread-cb__btn spread-cb__btn--ghost" @click="activeSection = 'customer'">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
            Back
          </button>
          <button
            class="spread-cb__btn spread-cb__btn--primary"
            :disabled="!cartItems.length"
            @click="activeSection = 'review'"
          >
            Review &amp; send
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>

      <!-- ── Step 3: Review & Send ─────────────────────────────────────── -->
      <div v-show="activeSection === 'review'" class="spread-cb__section">
        <template v-if="!dispatched">
          <h3 class="spread-cb__section-title">Review &amp; Dispatch</h3>

          <div class="spread-cb__review-summary">
            <div class="spread-cb__review-row">
              <span class="spread-cb__review-label">Customer</span>
              <span>{{ selectedCustomer?.display_name }} · {{ selectedCustomer?.email }}</span>
            </div>
            <div class="spread-cb__review-row">
              <span class="spread-cb__review-label">Items</span>
              <span>{{ cartItems.length }} product{{ cartItems.length !== 1 ? 's' : '' }}</span>
            </div>
            <div class="spread-cb__review-row">
              <span class="spread-cb__review-label">Total</span>
              <strong>{{ formatCents(cartTotal) }}</strong>
            </div>
          </div>

          <ul class="spread-cb__review-items">
            <li v-for="item in cartItems" :key="item.cart_item_id" class="spread-cb__review-item">
              <span>{{ item.product_name }}</span>
              <span class="spread-cb__review-item-qty">× {{ item.qty }}</span>
              <span class="spread-cb__review-item-total">{{ formatCents(item.line_total) }}</span>
            </li>
          </ul>

          <div class="spread-cb__field" style="margin-top: 1rem;">
            <label class="spread-cb__label" for="adminNote">Admin note <span class="spread-cb__optional">(optional, 160 chars)</span></label>
            <textarea
              id="adminNote"
              class="spread-cb__textarea"
              rows="3" maxlength="160"
              v-model="adminNote"
              placeholder="Internal note for this order…"
            ></textarea>
            <span class="spread-cb__char-count">{{ adminNote.length }}/160</span>
          </div>

          <!-- Confirm modal -->
          <div v-if="confirmingDispatch" class="spread-cb__confirm-modal" role="dialog" aria-modal="true">
            <div class="spread-cb__confirm-box">
              <p class="spread-cb__confirm-title">Dispatch this order?</p>
              <p class="spread-cb__confirm-body">This will send the cart to {{ selectedCustomer?.display_name }} for payment. This action cannot be undone.</p>
              <div class="spread-cb__confirm-actions">
                <button class="spread-cb__btn spread-cb__btn--ghost" @click="confirmingDispatch = false">Cancel</button>
                <button class="spread-cb__btn spread-cb__btn--danger" :disabled="dispatching" @click="dispatchCart">
                  <div v-if="dispatching" class="spread-cb__inline-spinner spread-cb__inline-spinner--white"></div>
                  <span v-else>Yes, dispatch</span>
                </button>
              </div>
            </div>
          </div>

          <div class="spread-cb__nav-row">
            <button class="spread-cb__btn spread-cb__btn--ghost" @click="activeSection = 'build'">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
              Back
            </button>
            <button class="spread-cb__btn spread-cb__btn--primary" @click="confirmingDispatch = true">
              Dispatch order →
            </button>
          </div>
        </template>

        <!-- Success screen -->
        <div v-else class="spread-cb__success">
          <div class="spread-cb__success-icon">
            <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#16A34A" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>
          </div>
          <h3 class="spread-cb__success-title">Order dispatched!</h3>
          <p class="spread-cb__success-body">The cart has been sent to <strong>{{ selectedCustomer?.display_name }}</strong> for payment.</p>
          <button class="spread-cb__btn spread-cb__btn--primary" @click="resetWizard">Build another order</button>
        </div>
      </div>

    </template>
  </div>
</template>

<script>
/* ── Mock data ─────────────────────────────────────────────────────────── */
const MOCK_CUSTOMERS = [
  { id: 'c1', display_name: 'Jane Farmer', email: 'jane@example.com', phone: '+61 400 000 001', avatar_url: null, household_id: 'h1' },
  { id: 'c2', display_name: 'Sam Grower', email: 'sam@example.com', phone: '+61 400 000 002', avatar_url: null, household_id: 'h2' },
];
const MOCK_PRODUCTS = [
  { id: 'p1', name: 'Seasonal Vegetable Box', price_cents: 4500, image_url: null, slug: 'veg-box' },
  { id: 'p2', name: 'Free Range Eggs (dozen)', price_cents: 1200, image_url: null, slug: 'eggs-dozen' },
  { id: 'p3', name: 'Sourdough Loaf', price_cents: 900, image_url: null, slug: 'sourdough' },
];
const STEPS = [
  { key: 'customer', label: 'Customer' },
  { key: 'build',    label: 'Build' },
  { key: 'review',   label: 'Review' },
];

/* ── Inline client ─────────────────────────────────────────────────────── */
function createSpreadClient(url, anonKey, token) {
  const headers = { 'Content-Type': 'application/json', apikey: anonKey };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return {
    async rpc(fn, params = {}) {
      const res = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(params) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || res.statusText); }
      return res.json();
    },
    async fromSelect(table, { select = '*', filters = '' } = {}) {
      let qs = `${url}/rest/v1/${table}?select=${encodeURIComponent(select)}`;
      if (filters) qs += '&' + filters;
      const res = await fetch(qs, { headers });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || res.statusText); }
      return res.json();
    },
    async patch(table, filters, body) {
      const qs = `${url}/rest/v1/${table}?${filters}`;
      const res = await fetch(qs, {
        method: 'PATCH',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || res.statusText); }
      return res.json();
    },
    async del(table, filters) {
      const qs = `${url}/rest/v1/${table}?${filters}`;
      const res = await fetch(qs, { method: 'DELETE', headers });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || res.statusText); }
    },
  };
}

export default {
  props: {
    /* wwEditor:start */
    wwEditorState: { type: Object, required: true },
    /* wwEditor:end */
    content:        { type: Object, required: true },
    wwFrontState:   { type: Object, required: true },
    wwElementState: { type: Object, required: true },
  },
  emits: ['trigger-event', 'update:content'],

  setup() {
    const { value: cartBuilderActive, setValue: setCartBuilderActive } =
      wwLib.wwVariable.useComponentVariable({ uid: 'cartBuilderActive', name: 'Cart Builder Active', type: 'boolean', defaultValue: false });
    return { cartBuilderActive, setCartBuilderActive };
  },

  data() {
    return {
      STEPS,
      canManageOrders:    true,
      activeSection:      'customer',
      // Customer step
      customerQuery:      '',
      customerResults:    [],
      searchingCustomers: false,
      selectedCustomer:   null,
      creatingCart:       false,
      // Build step
      cartId:             null,
      cartItems:          [],
      loadingCart:        false,
      productQuery:       '',
      productResults:     [],
      searchingProducts:  false,
      addingProductId:    null,
      // Review
      adminNote:          '',
      confirmingDispatch: false,
      dispatching:        false,
      dispatched:         false,
      // General
      error:              null,
      _debounceTimer:     null,
      _productDebounce:   null,
    };
  },

  computed: {
    /* wwEditor:start */
    isEditorMode() { return !!this.wwEditorState; },
    /* wwEditor:end */
    cartTotal() {
      return this.cartItems.reduce((sum, item) => sum + (item.line_total || 0), 0);
    },
  },

  watch: {
    activeSection(val) { this.setCartBuilderActive(val !== 'customer' || !!this.cartId); },
  },

  mounted() {
    /* wwEditor:start */
    if (this.isEditorMode) {
      this.customerResults = MOCK_CUSTOMERS;
      this.selectedCustomer = MOCK_CUSTOMERS[0];
      this.productResults = MOCK_PRODUCTS;
      this.cartItems = [
        { cart_item_id: 'ci1', product_id: 'p1', product_name: 'Seasonal Vegetable Box', image_url: null, qty: 2, unit_price: 4500, line_total: 9000 },
        { cart_item_id: 'ci2', product_id: 'p2', product_name: 'Free Range Eggs (dozen)', image_url: null, qty: 1, unit_price: 1200, line_total: 1200 },
      ];
      return;
    }
    /* wwEditor:end */
    this.checkPermission();
  },

  methods: {
    client() {
      return createSpreadClient(this.content?.supabaseUrl, this.content?.supabaseAnonKey, this.content?.accessToken);
    },

    async checkPermission() {
      try {
        const result = await this.client().rpc('has_permission', {
          p_user_id:       this.content.userId,
          p_permission_key:'orders.manage',
          p_scope_type:    'global',
          p_scope_id:      null,
        });
        this.canManageOrders = !!result;
      } catch (_) { this.canManageOrders = true; } // fail-open in case permission check errors
    },

    stepDone(key) {
      if (key === 'customer') return !!this.cartId;
      if (key === 'build')    return this.activeSection === 'review' || this.dispatched;
      return false;
    },

    debouncedSearch() {
      clearTimeout(this._debounceTimer);
      if (this.customerQuery.length < 2) { this.customerResults = []; return; }
      this._debounceTimer = setTimeout(() => this.searchCustomers(), 350);
    },

    debouncedProductSearch() {
      clearTimeout(this._productDebounce);
      if (!this.productQuery.trim()) { this.loadDefaultProducts(); return; }
      this._productDebounce = setTimeout(() => this.searchProducts(), 350);
    },

    async searchCustomers() {
      this.searchingCustomers = true;
      try {
        const res = await this.client().rpc('search_customer_profiles', {
          p_user_id: this.content.userId,
          p_query:   this.customerQuery,
          p_limit:   8,
        });
        this.customerResults = Array.isArray(res) ? res : [];
      } catch (e) { this.error = e.message; } finally { this.searchingCustomers = false; }
    },

    selectCustomer(c) { this.selectedCustomer = c; },

    async confirmCustomer() {
      if (!this.selectedCustomer) return;
      this.creatingCart = true; this.error = null;
      try {
        const result = await this.client().rpc('admin_create_cart', {
          p_user_id:          this.content.userId,
          p_customer_user_id: this.selectedCustomer.id,
          p_note:             null,
        });
        this.cartId = result?.cart_id || result;
        this.activeSection = 'build';
        await this.loadDefaultProducts();
        await this.fetchCartItems();
      } catch (e) { this.error = e.message || 'Failed to create cart'; } finally { this.creatingCart = false; }
    },

    async loadDefaultProducts() {
      this.searchingProducts = true;
      try {
        const results = await this.client().fromSelect('products', {
          select: 'id,name,slug,image_url,price_cents,member_price_cents,is_active',
          filters: 'is_active=eq.true&order=name.asc&limit=20',
        });
        this.productResults = Array.isArray(results) ? results : [];
      } catch (e) { this.error = e.message; } finally { this.searchingProducts = false; }
    },

    async searchProducts() {
      if (!this.productQuery.trim()) return;
      this.searchingProducts = true;
      try {
        const results = await this.client().fromSelect('products', {
          select: 'id,name,slug,image_url,price_cents,member_price_cents,is_active',
          filters: `is_active=eq.true&name=ilike.*${encodeURIComponent(this.productQuery)}*&limit=20`,
        });
        this.productResults = Array.isArray(results) ? results : [];
      } catch (e) { this.error = e.message; } finally { this.searchingProducts = false; }
    },

    async fetchCartItems() {
      if (!this.cartId) return;
      this.loadingCart = true;
      try {
        const items = await this.client().rpc('get_admin_cart_items', {
          p_user_id: this.content.userId,
          p_cart_id: this.cartId,
        });
        this.cartItems = Array.isArray(items) ? items : [];
      } catch (e) { this.error = e.message; } finally { this.loadingCart = false; }
    },

    async addProduct(product) {
      if (!this.cartId) return;
      this.addingProductId = product.id;
      try {
        await this.client().rpc('add_to_cart', { p_product_id: product.id, p_quantity: 1 });
        await this.fetchCartItems();
      } catch (e) { this.error = e.message || 'Could not add product'; } finally { this.addingProductId = null; }
    },

    async adjustQty(item, delta) {
      const newQty = item.qty + delta;
      if (newQty < 1) return;
      try {
        await this.client().patch('cart_items', `id=eq.${item.cart_item_id}`, { qty: newQty });
        await this.fetchCartItems();
      } catch (e) { this.error = e.message; }
    },

    async removeItem(item) {
      try {
        await this.client().del('cart_items', `id=eq.${item.cart_item_id}`);
        this.cartItems = this.cartItems.filter(ci => ci.cart_item_id !== item.cart_item_id);
      } catch (e) { this.error = e.message; }
    },

    async dispatchCart() {
      this.dispatching = true;
      try {
        if (this.adminNote) {
          await this.client().patch('carts', `id=eq.${this.cartId}`, { admin_note: this.adminNote });
        }
        await this.client().rpc('dispatch_cart_ready', {
          p_user_id: this.content.userId,
          p_cart_id: this.cartId,
        });
        this.dispatched = true;
        this.confirmingDispatch = false;
        this.setCartBuilderActive(false);
        this.$emit('trigger-event', {
          name:  'cart:dispatched',
          event: { cartId: this.cartId, customerId: this.selectedCustomer?.id, total: this.cartTotal },
        });
      } catch (e) {
        this.error = e.message || 'Dispatch failed';
        this.confirmingDispatch = false;
      } finally { this.dispatching = false; }
    },

    resetWizard() {
      Object.assign(this.$data, {
        activeSection: 'customer', customerQuery: '', customerResults: [],
        selectedCustomer: null, cartId: null, cartItems: [],
        productQuery: '', productResults: [], adminNote: '',
        confirmingDispatch: false, dispatched: false, error: null,
      });
      this.setCartBuilderActive(false);
    },

    initials(name) {
      if (!name) return '?';
      return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    },

    formatCents(cents) {
      if (cents === null || cents === undefined) return '$—';
      return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format((cents || 0) / 100);
    },
  },
};
</script>

<style scoped>
.spread-cb {
  --spread-primary:     #4B162D;
  --spread-accent:      #CE6632;
  --spread-dark-grey:   #2B2B2B;
  --spread-mid-grey:    #4B5563;
  --spread-light-grey:  #6B7280;
  --spread-border:      #F3EADF;
  --spread-background:  #FBFAF8;
  --spread-success:     #16A34A;
  --spread-error:       #D14343;
  --spread-radius:      12px;
  --spread-radius-sm:   8px;
  --spread-font:        ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;

  font-family: var(--spread-font);
  width: 100%;
  box-sizing: border-box;
  padding: 1.5rem;
  background: var(--spread-background);
}

.spread-cb *, .spread-cb *::before, .spread-cb *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* Gate */
.spread-cb__gate { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; min-height: 200px; color: var(--spread-mid-grey); }
.spread-cb__gate-text { font-size: 14px; font-weight: 500; }

/* Header */
.spread-cb__header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem; }
.spread-cb__title { font-size: 1.375rem; font-weight: 800; color: var(--spread-primary); }

/* Stepper */
.spread-cb__stepper { display: flex; gap: 6px; align-items: center; }
.spread-cb__step { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--spread-light-grey); padding: 4px 10px; border-radius: 20px; border: 1px solid transparent; transition: all 0.15s; }
.spread-cb__step--active { color: var(--spread-primary); background: #FDEEF3; border-color: #F9C5D3; font-weight: 700; }
.spread-cb__step--done { color: var(--spread-success); }
.spread-cb__step-num { width: 16px; height: 16px; border-radius: 50%; background: currentColor; display: flex; align-items: center; justify-content: center; }
.spread-cb__step-num > span { color: #fff; font-size: 10px; font-weight: 700; }
.spread-cb__step-num > svg { color: #fff; stroke: #fff; }
.spread-cb__step-label { white-space: nowrap; }

/* Error */
.spread-cb__error { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: #FEF2F2; border: 1px solid #FECACA; border-radius: var(--spread-radius-sm); color: var(--spread-error); font-size: 13px; margin-bottom: 1rem; }
.spread-cb__error-dismiss { margin-left: auto; background: none; border: none; cursor: pointer; color: inherit; font-size: 18px; line-height: 1; }

/* Section */
.spread-cb__section { display: flex; flex-direction: column; gap: 1rem; }
.spread-cb__section-title { font-size: 1rem; font-weight: 700; color: var(--spread-dark-grey); display: flex; align-items: center; gap: 8px; }
.spread-cb__section-badge { font-size: 12px; font-weight: 600; padding: 3px 8px; background: #FDEEF3; color: var(--spread-primary); border-radius: 20px; }

/* Search */
.spread-cb__search-wrap { position: relative; display: flex; align-items: center; }
.spread-cb__search-icon { position: absolute; left: 12px; color: var(--spread-light-grey); pointer-events: none; }
.spread-cb__search-input { width: 100%; padding: 11px 12px 11px 36px; background: #fff; border: 1px solid var(--spread-border); border-radius: var(--spread-radius-sm); font-size: 14px; color: var(--spread-dark-grey); outline: none; font-family: inherit; transition: border-color 0.15s; }
.spread-cb__search-input:focus { border-color: var(--spread-accent); }
.spread-cb__search-wrap .spread-cb__inline-spinner { position: absolute; right: 12px; }
.spread-cb__search-wrap--sm .spread-cb__search-input { padding-top: 9px; padding-bottom: 9px; font-size: 13px; }

/* Customer list */
.spread-cb__customer-list { display: flex; flex-direction: column; gap: 4px; }
.spread-cb__customer-row { display: flex; align-items: center; gap: 12px; padding: 10px 14px; background: #fff; border: 1px solid var(--spread-border); border-radius: var(--spread-radius-sm); cursor: pointer; border-left: 3px solid transparent; transition: all 0.12s; text-align: left; width: 100%; }
.spread-cb__customer-row:hover { border-color: var(--spread-accent); }
.spread-cb__customer-row--selected { border-left-color: var(--spread-accent); background: #FFF9F5; }
.spread-cb__customer-avatar { width: 36px; height: 36px; border-radius: 50%; overflow: hidden; background: var(--spread-border); flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
.spread-cb__customer-avatar img { width: 100%; height: 100%; object-fit: cover; }
.spread-cb__customer-initials { font-size: 13px; font-weight: 700; color: var(--spread-mid-grey); }
.spread-cb__customer-info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.spread-cb__customer-name { font-size: 13.5px; font-weight: 600; color: var(--spread-dark-grey); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.spread-cb__customer-meta { font-size: 12px; color: var(--spread-light-grey); }
.spread-cb__customer-check { color: var(--spread-accent); flex-shrink: 0; }

/* Build layout */
.spread-cb__build-layout { display: flex; flex-direction: column; gap: 1rem; }
@media (min-width: 768px) { .spread-cb__build-layout { flex-direction: row; gap: 1.25rem; } }
.spread-cb__products-panel { flex: 1; display: flex; flex-direction: column; gap: 8px; min-height: 0; }
.spread-cb__cart-panel { flex: 1; display: flex; flex-direction: column; gap: 8px; min-height: 0; }

.spread-cb__product-list { display: flex; flex-direction: column; gap: 4px; max-height: 320px; overflow-y: auto; }
.spread-cb__product-row { display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: #fff; border: 1px solid var(--spread-border); border-radius: var(--spread-radius-sm); cursor: pointer; text-align: left; width: 100%; transition: border-color 0.12s; }
.spread-cb__product-row:hover:not(:disabled) { border-color: var(--spread-accent); }
.spread-cb__product-row:disabled { opacity: 0.6; cursor: not-allowed; }
.spread-cb__product-img { width: 36px; height: 36px; object-fit: cover; border-radius: 6px; flex-shrink: 0; }
.spread-cb__product-img-placeholder { width: 36px; height: 36px; border-radius: 6px; background: var(--spread-border); display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
.spread-cb__product-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.spread-cb__product-name { font-size: 13px; font-weight: 600; color: var(--spread-dark-grey); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.spread-cb__product-price { font-size: 12px; color: var(--spread-mid-grey); }

/* Cart panel */
.spread-cb__cart-panel-title { font-size: 13px; font-weight: 700; color: var(--spread-mid-grey); text-transform: uppercase; letter-spacing: 0.04em; display: flex; align-items: center; gap: 6px; }
.spread-cb__cart-count-badge { font-size: 10px; font-weight: 700; padding: 2px 6px; background: var(--spread-accent); color: #fff; border-radius: 10px; }
.spread-cb__cart-refresh { margin-left: auto; background: none; border: none; cursor: pointer; color: var(--spread-light-grey); display: flex; align-items: center; padding: 2px; }
.spread-cb__cart-refresh:hover { color: var(--spread-accent); }

.spread-cb__cart-list { list-style: none; display: flex; flex-direction: column; gap: 4px; max-height: 280px; overflow-y: auto; }
.spread-cb__cart-item { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #fff; border: 1px solid var(--spread-border); border-radius: var(--spread-radius-sm); }
.spread-cb__cart-item-info { flex: 1; min-width: 0; }
.spread-cb__cart-item-name { font-size: 12.5px; font-weight: 600; color: var(--spread-dark-grey); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
.spread-cb__cart-item-price { font-size: 11.5px; color: var(--spread-light-grey); }
.spread-cb__qty-stepper { display: flex; align-items: center; gap: 0; background: var(--spread-background); border: 1px solid var(--spread-border); border-radius: 20px; overflow: hidden; flex-shrink: 0; }
.spread-cb__qty-btn { width: 22px; height: 22px; background: none; border: none; cursor: pointer; font-size: 14px; font-weight: 700; color: var(--spread-mid-grey); display: flex; align-items: center; justify-content: center; transition: background 0.1s; }
.spread-cb__qty-btn:hover:not(:disabled) { background: var(--spread-border); }
.spread-cb__qty-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.spread-cb__qty-val { font-size: 12px; font-weight: 700; color: var(--spread-dark-grey); min-width: 16px; text-align: center; }
.spread-cb__cart-item-total { font-size: 12.5px; font-weight: 700; color: var(--spread-dark-grey); white-space: nowrap; }
.spread-cb__cart-item-remove { background: none; border: none; cursor: pointer; color: var(--spread-light-grey); padding: 3px; display: flex; transition: color 0.1s; }
.spread-cb__cart-item-remove:hover { color: var(--spread-error); }
.spread-cb__cart-total { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: var(--spread-primary); border-radius: var(--spread-radius-sm); color: rgba(255,255,255,0.8); font-size: 13.5px; font-weight: 600; }
.spread-cb__cart-total-value { color: #fff; font-size: 16px; font-weight: 800; }

/* Nav row */
.spread-cb__nav-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding-top: 4px; }

/* Review */
.spread-cb__review-summary { background: #fff; border: 1px solid var(--spread-border); border-radius: var(--spread-radius-sm); padding: 1rem; display: flex; flex-direction: column; gap: 8px; }
.spread-cb__review-row { display: flex; justify-content: space-between; align-items: center; font-size: 13.5px; color: var(--spread-dark-grey); }
.spread-cb__review-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--spread-light-grey); min-width: 80px; }
.spread-cb__review-items { list-style: none; display: flex; flex-direction: column; gap: 4px; }
.spread-cb__review-item { display: flex; align-items: center; gap: 8px; font-size: 13px; padding: 6px 0; border-bottom: 1px solid var(--spread-border); color: var(--spread-dark-grey); }
.spread-cb__review-item-qty { color: var(--spread-light-grey); flex: 1; }
.spread-cb__review-item-total { font-weight: 700; }

/* Field */
.spread-cb__field { display: flex; flex-direction: column; gap: 6px; }
.spread-cb__label { font-size: 12.5px; font-weight: 600; color: var(--spread-mid-grey); }
.spread-cb__optional { font-weight: 400; color: var(--spread-light-grey); }
.spread-cb__textarea { width: 100%; padding: 10px 12px; border: 1px solid var(--spread-border); border-radius: var(--spread-radius-sm); font-family: inherit; font-size: 14px; color: var(--spread-dark-grey); resize: vertical; outline: none; background: var(--spread-background); transition: border-color 0.15s; }
.spread-cb__textarea:focus { border-color: var(--spread-accent); }
.spread-cb__char-count { font-size: 11px; color: var(--spread-light-grey); text-align: right; }

/* Confirm modal */
.spread-cb__confirm-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 1rem; }
.spread-cb__confirm-box { background: #fff; border-radius: var(--spread-radius); padding: 2rem; max-width: 420px; width: 100%; box-shadow: 0 20px 40px rgba(0,0,0,0.2); }
.spread-cb__confirm-title { font-size: 1.125rem; font-weight: 800; color: var(--spread-primary); margin-bottom: 8px; }
.spread-cb__confirm-body { font-size: 14px; color: var(--spread-mid-grey); line-height: 1.5; margin-bottom: 1.5rem; }
.spread-cb__confirm-actions { display: flex; justify-content: flex-end; gap: 10px; }

/* Success */
.spread-cb__success { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 1rem; padding: 2rem 1rem; }
.spread-cb__success-icon { width: 72px; height: 72px; border-radius: 50%; background: #DCFCE7; display: flex; align-items: center; justify-content: center; }
.spread-cb__success-title { font-size: 1.5rem; font-weight: 800; color: var(--spread-dark-grey); }
.spread-cb__success-body { font-size: 14px; color: var(--spread-mid-grey); line-height: 1.5; }

/* Buttons */
.spread-cb__btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 18px; border-radius: var(--spread-radius-sm); font-size: 14px; font-weight: 600; cursor: pointer; border: 1px solid transparent; transition: all 0.12s; font-family: inherit; white-space: nowrap; }
.spread-cb__btn:disabled { opacity: 0.5; cursor: not-allowed; }
.spread-cb__btn--primary { background: var(--spread-primary); color: #fff; border-color: var(--spread-primary); }
.spread-cb__btn--primary:hover:not(:disabled) { background: #3a0f22; }
.spread-cb__btn--ghost { background: none; color: var(--spread-mid-grey); border-color: var(--spread-border); }
.spread-cb__btn--ghost:hover:not(:disabled) { border-color: var(--spread-mid-grey); }
.spread-cb__btn--danger { background: var(--spread-error); color: #fff; border-color: var(--spread-error); }
.spread-cb__btn--danger:hover:not(:disabled) { background: #B91C1C; }

/* Loading helpers */
.spread-cb__loading-row { display: flex; align-items: center; gap: 8px; color: var(--spread-light-grey); font-size: 13px; padding: 8px 0; }
.spread-cb__empty-msg { font-size: 13px; color: var(--spread-light-grey); padding: 8px 0; }
.spread-cb__hint { font-size: 13px; color: var(--spread-light-grey); padding: 8px 0; font-style: italic; }

/* Spinners */
.spread-cb__spinner { display: inline-block; border: 2px solid var(--spread-border); border-top-color: var(--spread-accent); border-radius: 50%; animation: spread-cb-spin 0.6s linear infinite; flex-shrink: 0; width: 20px; height: 20px; }
.spread-cb__spinner--sm { width: 14px; height: 14px; }
.spread-cb__inline-spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid var(--spread-border); border-top-color: var(--spread-accent); border-radius: 50%; animation: spread-cb-spin 0.6s linear infinite; flex-shrink: 0; }
.spread-cb__inline-spinner--white { border-color: rgba(255,255,255,0.3); border-top-color: #fff; }
@keyframes spread-cb-spin { to { transform: rotate(360deg); } }
</style>
