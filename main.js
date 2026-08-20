import { supabase } from './supabase.js';
import './style.css';

const app = document.querySelector('#app');

const state = {
  session: null,
  store: null,
  products: []
};

function esc(value = '') {
  return String(value).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[c]));
}

function money(value) {
  return `₦${Number(value || 0).toLocaleString('en-NG')}`;
}

async function loadStore() {
  if (!state.session) return;
  const { data: store } = await supabase
    .from('stores').select('*').eq('owner_id', state.session.user.id).single();
  state.store = store;
  if (store) {
    const { data: products } = await supabase
      .from('products').select('*').eq('store_id', store.id).order('created_at', { ascending: false });
    state.products = products || [];
  }
}

function render() {
  if (!state.session) return renderAuth();
  if (!state.store) return renderCreateStore();
  return renderDashboard();
}

function renderAuth() {
  app.innerHTML = `
    <main class="auth">
      <section class="card">
        <div class="brand">Sell<span>Link</span></div>
        <h1>Your simple online shop.</h1>
        <p class="muted">Create your store, upload products and let customers order through WhatsApp.</p>
        <div class="tabs">
          <button class="tab active" data-mode="login">Login</button>
          <button class="tab" data-mode="signup">Create account</button>
        </div>
        <form id="auth-form">
          <label>Email<input id="email" type="email" required placeholder="you@example.com"></label>
          <label>Password<input id="password" type="password" minlength="6" required placeholder="At least 6 characters"></label>
          <button class="primary" type="submit">Continue</button>
        </form>
        <p id="auth-msg" class="message"></p>
      </section>
    </main>`;

  let mode = 'login';
  document.querySelectorAll('.tab').forEach(btn => btn.onclick = () => {
    mode = btn.dataset.mode;
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelector('#auth-form button').textContent = mode === 'login' ? 'Login' : 'Create account';
  });

  document.querySelector('#auth-form').onsubmit = async e => {
    e.preventDefault();
    const email = document.querySelector('#email').value.trim();
    const password = document.querySelector('#password').value;
    const msg = document.querySelector('#auth-msg');
    msg.textContent = 'Please wait...';
    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    if (result.error) msg.textContent = result.error.message;
    else if (mode === 'signup' && !result.data.session) msg.textContent = 'Account created. Check your email if confirmation is enabled.';
  };
}

function renderCreateStore() {
  app.innerHTML = `
    <main class="auth">
      <section class="card">
        <div class="brand">Sell<span>Link</span></div>
        <h1>Create your store</h1>
        <p class="muted">This information will appear on your public shop.</p>
        <form id="store-form">
          <label>Business name<input id="name" required placeholder="Mary Fashion"></label>
          <label>Store username<input id="slug" required placeholder="mary-fashion"></label>
          <label>WhatsApp number<input id="whatsapp" required placeholder="2348012345678"></label>
          <label>Business description<textarea id="description" placeholder="What do you sell?"></textarea></label>
          <button class="primary">Create store</button>
        </form>
        <button class="link" id="logout">Log out</button>
        <p id="store-msg" class="message"></p>
      </section>
    </main>`;
  document.querySelector('#logout').onclick = () => supabase.auth.signOut();
  document.querySelector('#store-form').onsubmit = async e => {
    e.preventDefault();
    const name = document.querySelector('#name').value.trim();
    const slug = document.querySelector('#slug').value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const whatsapp = document.querySelector('#whatsapp').value.replace(/\D/g, '');
    const description = document.querySelector('#description').value.trim();
    const { error } = await supabase.from('stores').insert({
      owner_id: state.session.user.id, name, slug, whatsapp, description
    });
    document.querySelector('#store-msg').textContent = error ? error.message : 'Store created.';
    if (!error) { await loadStore(); render(); }
  };
}

function renderDashboard() {
  app.innerHTML = `
    <header class="topbar">
      <div class="brand">Sell<span>Link</span></div>
      <div><a class="view" href="?store=${encodeURIComponent(state.store.slug)}" target="_blank">View store</a>
      <button class="link" id="logout">Log out</button></div>
    </header>
    <main class="dashboard">
      <section class="hero">
        <div><p class="eyebrow">MY STORE</p><h1>${esc(state.store.name)}</h1><p class="muted">${esc(state.store.description || 'Add products and start selling.')}</p></div>
        <button class="primary" id="add-product">+ Add product</button>
      </section>
      <section class="panel">
        <h2>Products</h2>
        <div id="products" class="products">
          ${state.products.length ? state.products.map(productCard).join('') : '<p class="muted">No products yet. Add your first product.</p>'}
        </div>
      </section>
      <section class="panel">
        <h2>WhatsApp</h2>
        <form id="settings-form" class="inline-form">
          <label>WhatsApp number<input id="whatsapp" value="${esc(state.store.whatsapp || '')}" placeholder="2348012345678"></label>
          <button class="primary">Save</button>
        </form>
      </section>
    </main>`;

  document.querySelector('#logout').onclick = () => supabase.auth.signOut();
  document.querySelector('#add-product').onclick = () => showProductForm();
  document.querySelector('#settings-form').onsubmit = async e => {
    e.preventDefault();
    const whatsapp = document.querySelector('#whatsapp').value.replace(/\D/g, '');
    await supabase.from('stores').update({ whatsapp }).eq('id', state.store.id);
    state.store.whatsapp = whatsapp;
    alert('Saved');
  };
  document.querySelectorAll('[data-delete]').forEach(btn => btn.onclick = async () => {
    await supabase.from('products').delete().eq('id', btn.dataset.delete);
    await loadStore(); render();
  });
}

function productCard(p) {
  return `<article class="product">
    ${p.image_url ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}">` : '<div class="placeholder">No image</div>'}
    <div class="product-body"><h3>${esc(p.name)}</h3><strong>${money(p.price)}</strong><p>${esc(p.description || '')}</p>
    <button class="danger" data-delete="${p.id}">Delete</button></div>
  </article>`;
}

function showProductForm() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `<div class="modal-card">
    <button class="close" id="close">×</button><h2>Add product</h2>
    <form id="product-form">
      <label>Product name<input id="pname" required></label>
      <label>Price (₦)<input id="price" type="number" min="0" required></label>
      <label>Category<input id="category" placeholder="Fashion"></label>
      <label>Description<textarea id="desc"></textarea></label>
      <label>Product image URL<input id="image" placeholder="Paste image URL for MVP"></label>
      <button class="primary">Publish product</button>
      <p id="pmsg" class="message"></p>
    </form></div>`;
  document.body.appendChild(modal);
  modal.querySelector('#close').onclick = () => modal.remove();
  modal.querySelector('#product-form').onsubmit = async e => {
    e.preventDefault();
    const { error } = await supabase.from('products').insert({
      store_id: state.store.id,
      name: modal.querySelector('#pname').value.trim(),
      price: Number(modal.querySelector('#price').value),
      category: modal.querySelector('#category').value.trim(),
      description: modal.querySelector('#desc').value.trim(),
      image_url: modal.querySelector('#image').value.trim()
    });
    if (error) modal.querySelector('#pmsg').textContent = error.message;
    else { modal.remove(); await loadStore(); render(); }
  };
}

async function renderPublicStore(slug) {
  const { data: store } = await supabase.from('stores').select('*').eq('slug', slug).single();
  if (!store) { app.innerHTML = '<main class="auth"><section class="card"><h1>Store not found</h1></section></main>'; return; }
  const { data: products } = await supabase.from('products').select('*').eq('store_id', store.id).eq('is_available', true).order('created_at', { ascending: false });
  app.innerHTML = `<main class="shop">
    <section class="shop-head"><div class="brand">Sell<span>Link</span></div><h1>${esc(store.name)}</h1><p>${esc(store.description || '')}</p></section>
    <section class="shop-grid">${(products || []).map(p => {
      const text = encodeURIComponent(`Hello, I'm interested in ${p.name} - ${money(p.price)}. How can I place an order?`);
      const phone = String(store.whatsapp || '').replace(/\D/g,'');
      return `<article class="shop-product">
        ${p.image_url ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}">` : '<div class="placeholder">No image</div>'}
        <div class="product-body"><h2>${esc(p.name)}</h2><strong>${money(p.price)}</strong><p>${esc(p.description || '')}</p>
        <a class="primary order" href="https://wa.me/${phone}?text=${text}" target="_blank">Order now</a></div>
      </article>`;
    }).join('')}</section>
  </main>`;
}

supabase.auth.onAuthStateChange(async (_event, session) => {
  state.session = session;
  if (session) await loadStore();
  render();
});

const params = new URLSearchParams(location.search);
const storeSlug = params.get('store');
if (storeSlug) renderPublicStore(storeSlug);
else supabase.auth.getSession().then(async ({ data }) => {
  state.session = data.session;
  if (state.session) await loadStore();
  render();
});