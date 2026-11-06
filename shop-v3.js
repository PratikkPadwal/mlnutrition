/* ML Nutrition • Shared catalog and internal shopping pages.
   Uses the same Google Sheet as the existing storefront, preserving real
   stock, prices, flavors and the existing WhatsApp cart contract. */
(()=>{'use strict';
const SHEET_URL='https://docs.google.com/spreadsheets/d/17h4gGSIbSJZ6qMA0Xjt-2aLoxRT4ZTikjPdaaM6a_S4/gviz/tq?tqx=out:json';
const WA_NUMBER='918329384588';
const CATEGORIES=[
 {key:'all',label:'All Products'},
 {key:'protein',label:'Whey Protein'},
 {key:'creatine',label:'Creatine'},
 {key:'preworkout',label:'Pre-Workout'},
 {key:'gainer',label:'Mass Gainers'},
 {key:'essentials',label:'Essentials'},
 {key:'healthfood',label:'Health Food'}
];
const catMatches={
 protein:p=>/protein|whey|isolate|casein/i.test(p.category+' '+p.name)&&!/health food/i.test(p.category),
 creatine:p=>/creatine/i.test(p.category+' '+p.name),
 preworkout:p=>/pre[\s-]?workout|pre[\s-]?work[\s-]?out|pump formula/i.test(p.category+' '+p.name),
 gainer:p=>/gainer|mass gain|weight gain/i.test(p.category+' '+p.name),
 essentials:p=>/^essentials?$/i.test(p.category.trim()),
 healthfood:p=>/^health\s*foods?$/i.test(p.category.trim())
};
const $=(s,root=document)=>root.querySelector(s);
const $$=(s,root=document)=>[...root.querySelectorAll(s)];
const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e};
const link=(text,href,cls)=>{const a=node('a',cls,text);a.href=href;return a};
function safeImage(raw){if(!raw)return'';try{const u=new URL(String(raw),location.href);return /^https?:$/.test(u.protocol)?u.href:''}catch{return''}}
function photos(product){return [...new Set(String(product.image_url||'').split(/,(?=\s*https?:\/\/)/).map(x=>safeImage(x.trim())).filter(Boolean))]}
function splitFlavours(raw){return String(raw||'').split(/[,|]/).map(v=>v.trim()).filter(Boolean)}
function parseGviz(text){const start=text.indexOf('{'),end=text.lastIndexOf('}');if(start<0||end<start)throw Error('Malformed catalogue response');const result=JSON.parse(text.slice(start,end+1));if(!result.table||!Array.isArray(result.table.rows))throw Error('Catalogue missing rows');return result.table.rows}
function cell(r,i){return r?.c?.[i]?.v??''}
let fetchPromise;
async function loadCatalog(){
 if(!fetchPromise)fetchPromise=(async()=>{
  const resp=await fetch(SHEET_URL,{cache:'no-store'});
  if(!resp.ok)throw Error('Catalogue HTTP '+resp.status);
  const rows=parseGviz(await resp.text());
  const products=rows.map(r=>({
    id:cell(r,0),name:String(cell(r,1)).trim(),brand:String(cell(r,2)).trim(),
    category:String(cell(r,3)).trim(),description:String(cell(r,4)).trim(),
    price_range:String(cell(r,5)).trim(),image_url:String(cell(r,6)).trim(),
    in_stock:String(cell(r,7)).trim(),featured:String(cell(r,8)).trim(),
    flavours:String(cell(r,9)).trim()
  })).filter(p=>p.id!==''&&p.name&&p.name.toLowerCase()!=='name');
  if(window.MLStore)window.MLStore.registerProducts(products);
  return products;
 })().catch(e=>{fetchPromise=null;throw e});
 return fetchPromise;
}
function categoryFor(p){const cat=p?.category||'';return CATEGORIES.find(c=>c.key!=='all'&&catMatches[c.key]?.(p))?.key||'other'}
function productHref(p){return '/product.html?id='+encodeURIComponent(p.id)}
function categoryHref(p){return '/products.html?category='+encodeURIComponent(categoryFor(p))}
function normalizeCategory(x){const value=String(x||'').toLowerCase().replace(/[\s_-]/g,'');const table={whey:'protein',wheyprotein:'protein',protein:'protein',creatine:'creatine',preworkout:'preworkout',massgainer:'gainer',massgainers:'gainer',gainer:'gainer',essentials:'essentials',essential:'essentials',healthfood:'healthfood',healthfoods:'healthfood',all:'all'};return table[value]||'all'}
function priceNumbers(value){return String(value||'').replace(/,/g,'').match(/\d+(?:\.\d+)?/g)?.map(Number).filter(Number.isFinite)||[]}
function priceText(p){const raw=String(p?.price_range||'').trim();if(!raw||!priceNumbers(raw).length)return'Price on request';return (raw.includes('₹')?'':'₹')+raw}
function priceValue(p){return priceNumbers(p?.price_range)[0]??Infinity}
function inStock(p){return p.in_stock.toLowerCase()==='yes'}
function productImage(p,cls=''){const wrap=node('span',cls);const arr=photos(p);if(arr.length){const img=node('img');img.src=arr[0];img.alt=p.name;img.loading='lazy';img.decoding='async';img.onerror=()=>img.replaceWith(node('span','product-placeholder','MLN.'));wrap.append(img)}else wrap.append(node('span','product-placeholder','MLN.'));return wrap}
function productCard(p){
 const article=node('article','shop-product-card');
 const imgLink=link('',productHref(p),'shop-product-media');
 imgLink.append(productImage(p,'shop-product-img'));
 imgLink.append(node('span','shop-product-stock '+(inStock(p)?'is-available':'is-unavailable'),inStock(p)?'AVAILABLE':'CHECK AVAILABILITY'));
 article.append(imgLink);
 const info=node('div','shop-product-info');
 info.append(node('span','shop-product-brand',p.brand||'ML NUTRITION'));
 info.append(link(p.name,productHref(p),'shop-product-name'));
 info.append(node('span','shop-product-category',p.category||'Supplements'));
 info.append(node('strong','shop-product-price',priceText(p)));
 const actions=node('div','shop-product-actions');
 actions.append(link('VIEW DETAILS ↗',productHref(p),'shop-card-link'));
 const wish=node('button','shop-wish-btn','♡');wish.type='button';wish.dataset.wishlistId=String(p.id);wish.setAttribute('aria-label','Save '+p.name+' to wishlist');actions.append(wish);
 if(inStock(p)&&!splitFlavours(p.flavours).length){const cart=node('button','shop-quick-btn','+');cart.type='button';cart.dataset.cartId=String(p.id);cart.setAttribute('aria-label','Add '+p.name+' to cart');actions.append(cart)}
 info.append(actions);article.append(info);return article;
}
function displayMessage(target,msg){if(target)target.replaceChildren(node('div','shop-message',msg))}
function initShared(){
 const header=$('#siteHeader'),menuBtn=$('#menuButton'),mobile=$('#mobileMenu');
 menuBtn?.addEventListener('click',()=>{const open=mobile.hasAttribute('hidden');mobile.toggleAttribute('hidden',!open);menuBtn.setAttribute('aria-expanded',String(open))});
 $$('#mobileMenu a').forEach(a=>a.addEventListener('click',()=>{mobile.hidden=true;menuBtn?.setAttribute('aria-expanded','false')}));
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&mobile){mobile.hidden=true;menuBtn?.setAttribute('aria-expanded','false')}});
 const mq=matchMedia('(min-width:1021px)');mq.addEventListener?.('change',e=>{if(e.matches&&mobile){mobile.hidden=true;menuBtn?.setAttribute('aria-expanded','false')}});
 const copy=$('#copyrightYear');if(copy)copy.textContent=String(new Date().getFullYear());
}
function initListing(){
 const grid=$('#catalogGrid'),count=$('#catalogCount'),search=$('#catalogSearch');
 const brandSelect=$('#brandSelect'),sortSelect=$('#sortSelect'),available=$('#availableOnly');
 const categoryButtons=$$('[data-category]'),clear=$('#clearFilters'),more=$('#loadMore');
 const params=new URLSearchParams(location.search);
 let category=normalizeCategory(params.get('category'));let products=[];let limit=16;
 function setCategory(key){category=normalizeCategory(key);limit=16;history.replaceState(null,'',category==='all'?'/products.html':'/products.html?category='+encodeURIComponent(category));render()}
 function render(){
  categoryButtons.forEach(b=>{const current=b.dataset.category===category;b.setAttribute('aria-pressed',String(current));b.classList.toggle('is-selected',current)});
  const q=(search.value||'').trim().toLowerCase(),brand=brandSelect.value;
  let selected=products.filter(p=>(category==='all'||catMatches[category]?.(p))&&(!brand||p.brand===brand)&&(!available.checked||inStock(p))&&(!q||[p.name,p.brand,p.category,p.description].some(v=>v.toLowerCase().includes(q))));
  const sort=sortSelect.value;
  if(sort==='name')selected.sort((a,b)=>a.name.localeCompare(b.name));
  if(sort==='name-desc')selected.sort((a,b)=>b.name.localeCompare(a.name));
  if(sort==='price-low')selected.sort((a,b)=>priceValue(a)-priceValue(b));
  if(sort==='price-high')selected.sort((a,b)=>priceValue(b)-priceValue(a));
  if(sort==='brand')selected.sort((a,b)=>a.brand.localeCompare(b.brand));
  if(sort==='featured')selected.sort((a,b)=>(b.featured.toLowerCase()==='yes'?1:0)-(a.featured.toLowerCase()==='yes'?1:0));
  count.textContent=selected.length+' products';
  if(!selected.length){displayMessage(grid,'No products match these filters. Try clearing a filter or search.');more.hidden=true;return}
  grid.replaceChildren(...selected.slice(0,limit).map(productCard));
  more.hidden=selected.length<=limit;
  if(window.MLStore)window.MLStore.syncWishlistButtons();
 }
 categoryButtons.forEach(b=>b.addEventListener('click',()=>setCategory(b.dataset.category)));
 [search,brandSelect,sortSelect,available].forEach(el=>el.addEventListener(el===search?'input':'change',()=>{limit=16;render()}));
 clear.addEventListener('click',()=>{search.value='';brandSelect.value='';sortSelect.value='featured';available.checked=false;setCategory('all')});
 more.addEventListener('click',()=>{limit+=16;render()});
 loadCatalog().then(p=>{
  products=p;
  const brands=[...new Set(products.map(x=>x.brand).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  const allBrandsOption=node('option','','All brands');allBrandsOption.value='';brandSelect.replaceChildren(allBrandsOption,...brands.map(b=>{const x=node('option','',b);x.value=b;return x}));
  $$('.shop-category-chip[data-category]').forEach(b=>{const key=b.dataset.category;if(key!=='all'){const n=products.filter(p=>catMatches[key]?.(p)).length;const badge=b.querySelector('small');if(badge)badge.textContent=String(n)}});
  render();
 }).catch(e=>{console.error('Catalogue failed',e);displayMessage(grid,'Unable to load products right now. Please try again or contact us on WhatsApp.');count.textContent='Unavailable';more.hidden=true});
}
function initDetail(){
 const root=$('#productDetail'),related=$('#relatedGrid'),crumb=$('#productBreadcrumb');
 const id=new URLSearchParams(location.search).get('id');
 if(!id){displayMessage(root,'No product selected. Browse our catalogue to find what you need.');return}
 let current=null,selectedFlavour='',qty=1,activeImage=0;
 function updateSchema(p){
  const title=p.name+' | ML Nutrition';document.title=title;
  const desc=p.description||('Explore '+p.name+' at ML Nutrition. Genuine supplements with expert guidance.');
  $('#pageDescription')?.setAttribute('content',desc.slice(0,160));
  $('#ogTitle')?.setAttribute('content',title);
  $('#ogDescription')?.setAttribute('content',desc.slice(0,160));
  const images=photos(p);if(images[0])$('#ogImage')?.setAttribute('content',images[0]);
  const url='https://www.mlnutrition.in/product.html?id='+encodeURIComponent(p.id);
  $('#canonical')?.setAttribute('href',url);$('#ogUrl')?.setAttribute('content',url);
  const schema={ '@context':'https://schema.org','@type':'Product',name:p.name,description:desc,brand:{'@type':'Brand',name:p.brand||'ML Nutrition'},image:images,sku:String(p.id),offers:{'@type':'Offer',url,priceCurrency:'INR',availability:inStock(p)?'https://schema.org/InStock':'https://schema.org/OutOfStock'}};
  const nums=priceNumbers(p.price_range);if(nums.length===1&&nums[0]>0)schema.offers.price=nums[0];
  const script=$('#productSchema');if(script)script.textContent=JSON.stringify(schema);
 }
 function gallery(p){
  const arr=photos(p),viewer=$('#detailMainImage'),thumbs=$('#galleryThumbs'),previous=$('#photoPrevious'),next=$('#photoNext');
  function show(i){if(!arr.length)return;activeImage=(i+arr.length)%arr.length;viewer.replaceChildren();const img=node('img');img.src=arr[activeImage];img.alt=p.name+' • image '+(activeImage+1);img.decoding='async';img.onerror=()=>img.replaceWith(node('span','product-placeholder','MLN.'));viewer.append(img);$$('.gallery-thumb',thumbs).forEach((t,index)=>t.setAttribute('aria-pressed',String(index===activeImage)))}
  if(!arr.length)viewer.replaceChildren(node('span','product-placeholder','MLN.'));
  thumbs.replaceChildren(...arr.map((src,index)=>{const b=node('button','gallery-thumb');b.type='button';b.setAttribute('aria-label','View image '+(index+1));b.setAttribute('aria-pressed',String(index===0));const img=node('img');img.src=src;img.alt='';img.loading='lazy';b.append(img);b.addEventListener('click',()=>show(index));return b}));
  previous.hidden=arr.length<2;next.hidden=arr.length<2;
  previous.addEventListener('click',()=>show(activeImage-1));next.addEventListener('click',()=>show(activeImage+1));
  if(arr.length)show(0);
 }
 function setQty(n){qty=Math.max(1,Math.min(99,n));$('#qtyNumber').textContent=String(qty)}
 function buyWhatsApp(){if(!current)return;const flav=selectedFlavour?' ('+selectedFlavour+')':'';const msg='Hi ML Nutrition! I am interested in '+current.name+flav+' x'+qty+' by '+current.brand+'. Please confirm availability and final price.';window.open('https://wa.me/'+WA_NUMBER+'?text='+encodeURIComponent(msg),'_blank','noopener,noreferrer')}
 function render(p){
  current=p;root.hidden=false;$('#detailBrand').textContent=p.brand||'ML Nutrition';$('#detailTitle').textContent=p.name;
  $('#detailPrice').textContent=priceText(p);$('#detailCategory').textContent=p.category||'Supplements';
  const status=$('#detailStock');status.textContent=inStock(p)?'IN STOCK':'CHECK AVAILABILITY';status.classList.toggle('is-unavailable',!inStock(p));
  $('#detailDescription').textContent=p.description||'Ask our team for full product information and recommendations.';
  const choices=splitFlavours(p.flavours),flavours=$('#flavourOptions'),block=$('#flavourBlock');
  block.hidden=!choices.length;selectedFlavour=choices[0]||'';
  flavours.replaceChildren(...choices.map((flav,i)=>{const b=node('button','flavour-option',flav);b.type='button';b.setAttribute('aria-pressed',String(i===0));b.addEventListener('click',()=>{selectedFlavour=flav;$$('.flavour-option',flavours).forEach(x=>x.setAttribute('aria-pressed',String(x===b)));syncWish()});return b}));
  const add=$('#addToCart');add.disabled=!inStock(p);add.textContent=inStock(p)?'ADD TO CART ↗':'OUT OF STOCK';
  const cat=categoryFor(p),catObj=CATEGORIES.find(c=>c.key===cat);
  crumb.replaceChildren(link('Home','/redesign.html'),node('span','','/'),link('All Products','/products.html'),node('span','','/'),link(catObj?.label||p.category||'Products',categoryHref(p)),node('span','','/'),node('span','crumb-current',p.name));
  gallery(p);updateSchema(p);syncWish();
  document.querySelector('main')?.classList.add('product-loaded');
 }
 function syncWish(){const wish=$('#detailWishlist');if(wish&&current&&window.MLStore){const value=MLStore.isInWishlist(current.id,selectedFlavour);wish.setAttribute('aria-pressed',String(value));wish.textContent=value?'♥ SAVED':'♡ SAVE PRODUCT'}}
 $('#qtyDecrease')?.addEventListener('click',()=>setQty(qty-1));
 $('#qtyIncrease')?.addEventListener('click',()=>setQty(qty+1));
 $('#addToCart')?.addEventListener('click',()=>{if(current&&inStock(current)&&window.MLStore){MLStore.addToCart(current.id,selectedFlavour,qty);MLStore.openCart()}});
 $('#detailWishlist')?.addEventListener('click',()=>{if(current&&window.MLStore){MLStore.toggleWishlist(current.id,selectedFlavour);syncWish()}});
 $('#buyWhatsApp')?.addEventListener('click',buyWhatsApp);
 $('#shareProduct')?.addEventListener('click',async()=>{const url=location.href;try{if(navigator.share)await navigator.share({title:current?.name||'ML Nutrition',url});else{await navigator.clipboard.writeText(url);$('#shareProduct').textContent='✓ LINK COPIED'}}catch{}});
 loadCatalog().then(products=>{const p=products.find(item=>String(item.id)===String(id));if(!p){displayMessage(root,'Product not found. It may have been removed from the catalogue.');return}render(p);const same=products.filter(x=>String(x.id)!==String(p.id)&&x.category.toLowerCase()===p.category.toLowerCase());const fallback=products.filter(x=>String(x.id)!==String(p.id)&&!same.some(y=>String(y.id)===String(x.id)));related.replaceChildren(...same.concat(fallback).slice(0,4).map(productCard));window.MLStore?.syncWishlistButtons()}).catch(e=>{console.error('Product loading failed',e);displayMessage(root,'Product details are temporarily unavailable. Please try again or contact us on WhatsApp.')});
}
initShared();
if(document.body.dataset.page==='catalog')initListing();
if(document.body.dataset.page==='product')initDetail();
})();