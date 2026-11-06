/* ML Nutrition premium storefront preview.
   All catalog data comes from the existing ML Nutrition API.
   Preview is isolated from the production homepage. */
(function(){
  'use strict';

  const grid = document.getElementById('productsGrid');
  const buttons = Array.from(document.querySelectorAll('[data-filter]'));
  const goalButtons = Array.from(document.querySelectorAll('[data-goal]'));
  const menu = document.getElementById('mobileMenu');
  const menuButton = document.getElementById('menuButton');
  const copyright = document.getElementById('copyrightYear');
  if(copyright) copyright.textContent = String(new Date().getFullYear());

  menuButton?.addEventListener('click',function(){
    const opening = menu.hasAttribute('hidden');
    menu.toggleAttribute('hidden',!opening);
    menuButton.setAttribute('aria-expanded',String(opening));
  });
  menu?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{
    menu.setAttribute('hidden','');
    menuButton?.setAttribute('aria-expanded','false');
  }));

  let catalog = [];
  let activeFilter = 'all';
  const matches = {
    protein: p => /protein|whey|isolate|casein/i.test([p.category,p.title].join(' ')) && !/bar|cookie|snack/i.test(p.category || ''),
    creatine: p => /creatine/i.test([p.category,p.title].join(' ')),
    preworkout: p => /pre.?workout|pre.?work.?out|pump formula/i.test([p.category,p.title].join(' ')),
    gainer: p => /gainer|mass gain|weight gain/i.test([p.category,p.title].join(' '))
  };

  function el(tag, className, text){
    const node=document.createElement(tag);
    if(className) node.className=className;
    if(text!==undefined) node.textContent=String(text);
    return node;
  }

  function getImage(p){
    const image = p?.image?.src || '';
    if(!image) return null;
    try {
      const url = new URL(image,window.location.href);
      return /^https?:$/.test(url.protocol)?url.href:null;
    }catch{return null;}
  }
  function money(val){
    if(val===null || val===undefined || String(val).trim()==='') return 'Ask for price';
    const raw = String(val).trim();
    // Range or text should not be misrepresented as a precise price.
    if(/^\d+(?:\.\d{1,2})?$/.test(raw)){
      const num=Number(raw);
      return num>0?'₹'+num.toLocaleString('en-IN',{maximumFractionDigits:2}):'Ask for price';
    }
    if(/^₹?\s*[\d,]+(?:\.\d{1,2})?$/.test(raw)){
      const num=Number(raw.replace(/[₹,\s]/g,''));
      return num>0?'₹'+num.toLocaleString('en-IN',{maximumFractionDigits:2}):'Ask for price';
    }
    return 'Ask for price';
  }
  function pickVariant(p){
    const variants=Array.isArray(p.variants)?p.variants:[];
    return variants.find(v=>Number(v.quantity)>0) || variants[0] || null;
  }
  function inventory(p){
    return Array.isArray(p.variants) && p.variants.some(v=>Number(v.quantity)>0);
  }
  function productUrl(p){
    return '/product.html?id='+encodeURIComponent(p.id);
  }
  function showMessage(message){
    grid.replaceChildren(el('div','product-message',message));
    grid.setAttribute('aria-busy','false');
  }

  function card(p){
    const article=el('article','product-card');
    const imageAnchor=el('a','product-photo');
    imageAnchor.href=productUrl(p);
    imageAnchor.setAttribute('aria-label','View '+(p.title || 'product'));
    const src=getImage(p);
    if(src){
      const image=el('img');
      image.src=src;
      image.alt=p.title || 'Supplement product';
      image.loading='lazy';
      image.decoding='async';
      image.onerror=function(){image.replaceWith(el('span','product-photo-placeholder','ML'));};
      imageAnchor.append(image);
    }else imageAnchor.append(el('span','product-photo-placeholder','ML'));

    const label=el('span','card-label',inventory(p)?'IN STOCK':'CHECK AVAILABILITY');
    imageAnchor.append(label);
    article.append(imageAnchor);

    const body=el('div','product-info');
    body.append(el('span','product-brand',p.vendor || 'ML NUTRITION'));
    const titleLink=el('a','product-title',p.title || 'Supplement');
    titleLink.href=productUrl(p);
    body.append(titleLink);
    body.append(el('div','product-meta',p.product_type || 'Premium supplements'));
    const bottom=el('div','card-bottom');
    const variant=pickVariant(p);
    bottom.append(el('span','product-price',money(variant?.price)));
    const link=el('a','product-open','VIEW ↗');
    link.href=productUrl(p);
    link.setAttribute('aria-label','View '+(p.title || 'product'));
    bottom.append(link);
    body.append(bottom);
    article.append(body);
    return article;
  }

  function render(){
    const filtered=activeFilter==='all'?catalog:catalog.filter(matches[activeFilter]);
    const prioritized=filtered.filter(inventory);
    const others=filtered.filter(p=>!inventory(p));
    const visible=prioritized.concat(others).slice(0,8);
    if(!visible.length){showMessage('No matching products available in the catalogue right now. Explore all products or ask us on WhatsApp.');return;}
    grid.replaceChildren(...visible.map(card));
    grid.setAttribute('aria-busy','false');
  }
  function applyFilter(filter,scroll){
    activeFilter=filter in matches?filter:'all';
    buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===activeFilter)));
    goalButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.goal===activeFilter)));
    render();
    if(scroll) document.getElementById('featured')?.scrollIntoView({behavior:'smooth',block:'start'});
  }
  buttons.forEach(button=>button.addEventListener('click',()=>applyFilter(button.dataset.filter,false)));
  goalButtons.forEach(button=>button.addEventListener('click',()=>applyFilter(button.dataset.goal,true)));

  function spotlight(){
    const preferred=catalog.filter(p=>inventory(p)&&getImage(p)&&/(whey|protein|creatine)/i.test(p.title||''));
    const p=preferred[0]||catalog.find(p=>inventory(p)&&getImage(p));
    if(!p) return;
    const src=getImage(p);
    const img=document.getElementById('heroProductImage');
    img.onerror=()=>{img.hidden=true;document.getElementById('heroFallback').hidden=false;};
    img.onload=()=>{img.hidden=false;document.getElementById('heroFallback').hidden=true;};
    img.src=src;
    img.alt=p.title || 'Featured supplement';
    document.getElementById('heroProductBrand').textContent=p.vendor||'FEATURED PRODUCT';
    document.getElementById('heroProductName').textContent=p.title||'SHOP PREMIUM SUPPLEMENTS';
    document.getElementById('heroProductLink').textContent='EXPLORE PRODUCT ↗';
    document.getElementById('heroProductLink').href=productUrl(p);
  }

  async function load(){
    try{
      const res=await fetch('/api/products?page=1&limit=1000',{headers:{Accept:'application/json'}});
      if(!res.ok) throw new Error('Catalog request returned '+res.status);
      const payload=await res.json();
      const items=payload?.data?.products;
      if(!Array.isArray(items))throw new Error('Unexpected product response');
      catalog=items.filter(p=>p&&p.id!==undefined&&p.title&&p.status==='active');
      if(!catalog.length){showMessage('The online catalogue has no available listings right now.');return;}
      // Show only currently listed products, never fictitious sample products.
      spotlight();
      render();
    }catch(error){
      console.error('ML Nutrition preview catalogue error:',error);
      showMessage('Live products are temporarily unavailable. Please use Browse All or contact our team on WhatsApp.');
    }
  }
  load();
})();
