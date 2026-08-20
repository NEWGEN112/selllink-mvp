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
  return '₦' + Number(value || 0).toLocaleString('en-NG');
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
  app.innerHTML =
    '<main class="auth"><section class="card">' +
    '<div class="brand">Sell<span>Link</span></div>' +
    '<h1>Your simple online shop.</h1>' +
    '<p class="muted">Create your store, upload products and let customers order through WhatsApp.</p>' +
    '<div class="tabs">' +
    '<button class="tab active" data-mode="login">Login</button>' +
    '<button class="tab" data-mode="signup">Create account</button>' +
    '</div>' +
    '<form id="auth-form">' +
    '<label>Email<input id="email" type="email" required placeholder="you@example.com"></label>' +
    '<label>Password<input id="password" type="password" minlength="6" required placeholder="At least 6 characters"></label>' +
    '<button class="primary" type="submit">Continue</button>' +
    '</form><p id="auth-msg" class="message"></p></section></main>';

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
    let error;
    if (mode === 'login') {
      ({ error } = await supabase.auth.signInWithPassword({ email, password }));
    } else {
      ({ error } = await supabase.auth.signUp({ email, password }));
    }
    msg.textContent = error ? error.message : (mode === 'signup' ? 'Account created!' : '');
  };
}

function renderCreateStore() {
  app.innerHTML =
    '<main class="auth"><section class="card">' +
    '<div class="brand">Sell<span>Link</span></div>' +
    '<h1>Create your store</h1>' +
    '<p class="muted">This is the public page customers will see.</p>' +
    '<form id="store-form">' +
    '<label>Store name<input id="name" required placeholder="Ada Fashion"></label>' +
    '<label>Store link (slug)<input id="slug" required placeholder="ada-fashion"></label>' +
    '<label>WhatsApp number<input id="whatsapp" required placeholder="2348012345678"></label>' +
    '<label>Short description<textarea id="description" placeholder="Quality clothes at good prices"></textarea></label>' +
    '<button class="primary" type="submit">Create store</button>' +
    '</form><p id="store-msg" class="message"></p></section></main>';

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
  const storeName = esc(state.store.name);
  const storeDesc = esc(state.store.description || 'Add products and start selling.');
  const storeSlug = encodeURIComponent(state.store.slug);
  const whatsappVal = esc(state.store.whatsapp || '');
  const productsHtml = state.products.length
    ? state.products.map(productCard).join('')
    : '<p class="muted">No products yet. Add your first product.</p>';

  app.innerHTML =
    '<header class="topbar">' +
      '<div class="brand">Sell<span>Link</span></div>' +
      '<div><a class="view" href="?store=' + storeSlug + '" target="_blank">View store</a>' +
      '<button class="link" id="logout">Log out</button></div>' +
    '</header>' +
    '<main class="dashboard">' +
      '<section class="hero">' +
        '<div><p class="eyebrow">MY STORE</p><h1>' + storeName + '</h1><p class="muted">' + storeDesc + '</p></div>' +
        '<button class="primary" id="add-product">+ Add product</button>' +
      '</section>' +
      '<section class="panel">' +
        '<h2>Products</h2>' +
        '<div id="products" class="products">' + productsHtml + '</div>' +
      '</section>' +
      '<section class="panel">' +
        '<h2>WhatsApp</h2>' +
        '<form id="settings-form" class="inline-form">' +
          '<label>WhatsApp number<input id="whatsapp" value="' + whatsappVal + '" placeholder="2348012345678"></label>' +
          '<button class="primary">Save</button>' +
        '</form>' +
      '</section>' +
    '</main>';

  document.querySelector('#logout').onclick = () => supabase.auth.signOut();
  document.querySelector('#add-product').onclick = () => showProductForm();
  document.querySelector('#settings-form').onsubmit = async e => {
    e.preventDefault();
    const whatsapp = document.querySelector('#whatsapp').value.replace(/\D/g, '');
    await supabase.from('stores').update({ whatsapp }).eq('id', state.store.id);
    await loadStore();
    render();
  };

  document.querySelectorAll('[data-delete]').forEach(btn => btn.onclick = async () => {
    if (!confirm('Delete this product?')) return;
    await supabase.from('products').delete().eq('id', btn.dataset.delete);
    await loadStore();
    render();
  });
}

function productCard(p) {
  const firstImage = (p.images && p.images.length) ? p.images[0] : p.image_url;
  const img = firstImage
    ? '<img src="' + esc(firstImage) + '" alt="' + esc(p.name) + '">'
    : '<div class="placeholder">No image</div>';
  return '<article class="product">' + img +
    '<div class="product-body"><h3>' + esc(p.name) + '</h3><strong>' + money(p.price) + '</strong><p>' + esc(p.description || '') + '</p>' +
    '<button class="danger" data-delete="' + p.id + '">Delete</button></div></article>';
}

function showProductForm() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML =
    '<div class="modal-card">' +
      '<button class="close" id="close">×</button>' +
      '<h2>Add product</h2>' +
      '<form id="product-form">' +
        '<label>Product name<input id="pname" required placeholder="e.g. Ankara Gown"></label>' +
        '<label>Price (₦)<input id="price" type="number" min="0" step="any" required placeholder="15000"></label>' +
        '<label>Category<input id="category" placeholder="Fashion, Shoes, Electronics..."></label>' +
        '<label>Description<textarea id="desc" placeholder="Short description of the product"></textarea></label>' +
        '<label>Product images (up to 10)' +
          '<input id="image-file" type="file" accept="image/*" multiple>' +
        '</label>' +
        '<div id="image-preview" class="image-preview hidden">' +
          '<img id="preview-img" alt="Preview">' +
          '<p id="image-count" class="muted"></p>' +
          '<button type="button" class="link" id="remove-image">Remove all</button>' +
        '</div>' +
        '<button class="primary" id="publish-btn" type="submit">Publish product</button>' +
        '<p id="pmsg" class="message"></p>' +
      '</form>' +
    '</div>';

  document.body.appendChild(modal);

  const fileInput = modal.querySelector('#image-file');
  const previewBox = modal.querySelector('#image-preview');
  const previewImg = modal.querySelector('#preview-img');
  const imageCount = modal.querySelector('#image-count');
  const removeBtn = modal.querySelector('#remove-image');
  const msg = modal.querySelector('#pmsg');
  const publishBtn = modal.querySelector('#publish-btn');

  let selectedFiles = [];

  fileInput.onchange = () => {
    const files = Array.from(fileInput.files || []);
    msg.textContent = '';
    if (files.length === 0) return;
    if (files.length > 10) {
      msg.textContent = 'Maximum 10 images allowed.';
      return;
    }
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        msg.textContent = 'Please select only image files.';
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        msg.textContent = 'Each image must be smaller than 5 MB.';
        return;
      }
    }
    selectedFiles = files;
    previewImg.src = URL.createObjectURL(files[0]);
    imageCount.textContent = files.length + ' image(s) selected';
    previewBox.classList.remove('hidden');
  };

  removeBtn.onclick = () => {
    selectedFiles = [];
    fileInput.value = '';
    previewBox.classList.add('hidden');
    previewImg.src = '';
    imageCount.textContent = '';
    msg.textContent = '';
  };

  modal.querySelector('#close').onclick = () => modal.remove();

  modal.querySelector('#product-form').onsubmit = async e => {
    e.preventDefault();
    msg.textContent = '';
    publishBtn.disabled = true;
    publishBtn.textContent = 'Publishing...';

    try {
      const imageUrls = [];

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const ext = file.name.split('.').pop() || 'jpg';
        const fileName = state.store.id + '/' + crypto.randomUUID() + '.' + ext;

        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, file, { cacheControl: '3600', upsert: false });

        if (uploadError) {
          throw new Error('Image upload failed: ' + uploadError.message);
        }

        const { data: publicData } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);

        imageUrls.push(publicData.publicUrl);
        publishBtn.textContent = 'Uploading ' + (i + 1) + '/' + selectedFiles.length + '...';
      }

      const { error } = await supabase.from('products').insert({
        store_id: state.store.id,
        name: modal.querySelector('#pname').value.trim(),
        price: Number(modal.querySelector('#price').value),
        category: modal.querySelector('#category').value.trim(),
        description: modal.querySelector('#desc').value.trim(),
        image_url: imageUrls[0] || '',
        images: imageUrls
      });

      if (error) throw error;

      modal.remove();
      await loadStore();
      render();
    } catch (err) {
      msg.textContent = err.message || 'Something went wrong. Please try again.';
      publishBtn.disabled = false;
      publishBtn.textContent = 'Publish product';
    }
  };
}

async function renderPublicStore(slug) {
  const { data: store } = await supabase.from('stores').select('*').eq('slug', slug).single();
  if (!store) {
    app.innerHTML = '<main class="auth"><section class="card"><h1>Store not found</h1></section></main>';
    return;
  }
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('store_id', store.id)
    .eq('is_available', true)
    .order('created_at', { ascending: false });

  let productsHtml = '';
  if (products && products.length) {
    productsHtml = products.map(p => {
      const text = encodeURIComponent('Hello, I am interested in ' + p.name + ' - ' + money(p.price) + '. How can I place an order?');
      const phone = String(store.whatsapp || store.whatsapp_number || '').replace(/\D/g, '');
      const firstImage = (p.images && p.images.length) ? p.images[0] : p.image_url;
      const img = firstImage
        ? '<img src="' + esc(firstImage) + '" alt="' + esc(p.name) + '">'
        : '<div class="placeholder">No image</div>';
      return '<article class="shop-product">' + img +
        '<div class="product-body">' +
        '<h2>' + esc(p.name) + '</h2>' +
        '<strong>' + money(p.price) + '</strong>' +
        '<p>' + esc(p.description || '') + '</p>' +
        '<a class="primary order" href="https://wa.me/' + phone + '?text=' + text + '" target="_blank">Order now</a>' +
        '</div></article>';
    }).join('');
  } else {
    productsHtml = '<p class="muted" style="grid-column:1/-1;text-align:center">No products available yet.</p>';
  }

  app.innerHTML =
    '<main class="shop">' +
      '<section class="shop-head">' +
        '<div class="brand">Sell<span>Link</span></div>' +
        '<h1>' + esc(store.name) + '</h1>' +
        '<p>' + esc(store.description || '') + '</p>' +
      '</section>' +
      '<section class="shop-grid">' + productsHtml + '</section>' +
    '</main>';
}

supabase.auth.onAuthStateChange(async (_event, session) => {
  state.session = session;
  if (session) await loadStore();
  render();
});

const params = new URLSearchParams(location.search);
const storeSlug = params.get('store');
if (storeSlug) {
  renderPublicStore(storeSlug);
} else {
  supabase.auth.getSession().then(async ({ data }) => {
    state.session = data.session;
    if (state.session) await loadStore();
    render();
  });
}
