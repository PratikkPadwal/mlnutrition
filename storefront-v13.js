/* ML Nutrition — selected premium storefront concept
   Source of truth: existing public Google Sheets catalogue.
   Cart integration: existing MLStore and its original product IDs. */
(()=>{
'use strict';
const SHEET='https://docs.google.com/spreadsheets/d/17h4gGSIbSJZ6qMA0Xjt-2aLoxRT4ZTikjPdaaM6a_S4/gviz/tq?tqx=out:json';
const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n};
const inStock=p=>String(p.in_stock||'').trim().toLowerCase()==='yes';
const isFeatured=p=>String(p.featured||'').trim().toLowerCase()==='yes';
const photos=p=>String(p.image_url||'').split(/,(?=\s*(?:https?:\/\/|\/\/|\/))/).map(x=>x.trim()).filter(Boolean);
// Accept the same image sources as our original catalogue, including
// site-relative paths. Never accept executable or non-web URL schemes.
const primaryPhoto=p=>photos(p).map(src=>{
  try{
    const resolved=new URL(src,location.origin);
    return resolved.protocol==='https:'||resolved.protocol==='http:'?resolved.href:'';
  }catch{return ''}
}).find(Boolean)||'';
const url=p=>'/product.html?id='+encodeURIComponent(p.id);
const categoryMatchers={
 protein:p=>/whey|protein|isolate|casein/i.test(p.category+' '+p.name)&&!/bars?|cookies?|snacks?/i.test(p.category),
 creatine:p=>/creatine/i.test(p.category+' '+p.name),
 gainer:p=>/gainer|mass gain|weight gain/i.test(p.category+' '+p.name),
 preworkout:p=>/pre[\s-]?workout|pre[\s-]?work[\s-]?out|pump formula/i.test(p.category+' '+p.name),
 essentials:p=>/^essentials?$/i.test(p.category.trim()),
 healthfood:p=>/^health\s*foods?$/i.test(p.category.trim())
};
let catalog=[],activeFilter='all';
function findMatch(p,key){return key==='all'||Boolean(categoryMatchers[key]?.(p))}
function formatPrice(raw){
  const value=String(raw||'').trim();
  if(!value)return'ASK FOR PRICE';
  const numbers=value.replace(/,/g,'').match(/\d+(?:\.\d+)?/g);
  if(!numbers?.length)return'ASK FOR PRICE';
  if(numbers.length===1 && /^\s*₹?\s*[\d,]+(?:\.\d+)?\s*$/.test(value)){
    const n=Number(numbers[0]);
    return n>0?'₹'+n.toLocaleString('en-IN',{maximumFractionDigits:2}):'ASK FOR PRICE';
  }
  // Do not falsely present a price range as one fixed item price.
  return (value.includes('₹')?'':'₹')+value;
}
function parseSheet(raw){
  const start=raw.indexOf('{'),end=raw.lastIndexOf('}');
  if(start<0||end<start)throw Error('Unexpected sheet response');
  const json=JSON.parse(raw.slice(start,end+1));
  if(!Array.isArray(json.table?.rows))throw Error('Missing catalogue rows');
  const cell=(r,i)=>r?.c?.[i]?.v??'';
  return json.table.rows.map(r=>({
    id:cell(r,0),name:String(cell(r,1)).trim(),
    brand:String(cell(r,2)).trim(),category:String(cell(r,3)).trim(),
    description:String(cell(r,4)).trim(),price_range:String(cell(r,5)).trim(),
    image_url:String(cell(r,6)).trim(),in_stock:String(cell(r,7)).trim(),
    featured:String(cell(r,8)).trim(),flavours:String(cell(r,9)).trim()
  })).filter(p=>p.id!==''&&p.name&&p.name.toLowerCase()!=='name');
}
function showImage(img,fallback,src,name){
  if(!src){
    img.hidden=true;
    if(fallback)fallback.hidden=false;
    return;
  }
  img.alt=name||'';
  // A lazy <img hidden> never intersects the viewport, so it may never
  // download and its onload handler will never fire. Keep it in layout
  // with opacity 0 while the real product photo is loading.
  img.style.opacity='0';
  img.hidden=false;
  if(fallback)fallback.hidden=false;
  img.onload=()=>{
    if(!img.naturalWidth)return;
    img.style.opacity='1';
    if(fallback)fallback.hidden=true;
  };
  img.onerror=()=>{
    img.hidden=true;
    img.style.opacity='0';
    if(fallback)fallback.hidden=false;
  };
  img.src=src;
  if(img.complete&&img.naturalWidth>0)img.onload();
}
function setupHeader(){
  $('#year').textContent=String(new Date().getFullYear());
  const menu=$('#mobileMenu'),button=$('#menuToggle');
  const close=()=>{menu.hidden=true;button.setAttribute('aria-expanded','false');button.setAttribute('aria-label','Open menu')};
  button.addEventListener('click',()=>{
    const open=menu.hidden;menu.hidden=!open;
    button.setAttribute('aria-expanded',String(open));
    button.setAttribute('aria-label',open?'Close menu':'Open menu');
  });
  $$('#mobileMenu a').forEach(a=>a.addEventListener('click',close));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
  const desktop=matchMedia('(min-width:1071px)');
  desktop.addEventListener?.('change',e=>{if(e.matches)close()});
  $('#mobileCartNav').addEventListener('click',()=>window.MLStore?.openCart());
}
function chooseHeroProducts(){
  const available=catalog.filter(p=>inStock(p)&&primaryPhoto(p));
  const withImages=available.length?available:catalog.filter(p=>primaryPhoto(p));
  const used=new Set(),brands=new Set();
  // Prefer varied well-known global brands; never insert a product not found in the sheet.
  const goals=[
    [/optimum nutrition|^on$/i,/dymatize/i,/applied nutrition/i,/avvatar/i,/muscleblaze/i],
    [/dymatize/i,/optimum nutrition|^on$/i,/applied nutrition/i,/muscleblaze/i],
    [/applied nutrition/i,/muscleblaze/i,/avvatar/i,/healthninja/i,/allmax/i]
  ];
  return goals.map((patterns)=>{
    let product=null;
    for(const re of patterns){
      product=withImages.find(p=>!used.has(String(p.id))&&!brands.has(p.brand.toLowerCase())&&re.test(p.brand)&&findMatch(p,'protein'));
      if(product)break;
    }
    if(!product)product=withImages.find(p=>!used.has(String(p.id))&&!brands.has(p.brand.toLowerCase())&&findMatch(p,'protein'));
    if(!product)product=withImages.find(p=>!used.has(String(p.id))&&!brands.has(p.brand.toLowerCase()));
    if(!product)product=withImages.find(p=>!used.has(String(p.id)))||null;
    if(product){used.add(String(product.id));brands.add(product.brand.toLowerCase())}
    return product;
  });
}
function fillHero(){
  const selected=chooseHeroProducts();
  $$('.hero-jar').forEach((slot,i)=>{
    const p=selected[i];if(!p)return;
    const img=slot.querySelector('img'),fallback=slot.querySelector('.jar-standin');
    slot.href=url(p);slot.setAttribute('aria-label','View '+p.name);
    showImage(img,fallback,primaryPhoto(p),p.name);
  });
}
function fillCategories(){
  $$('.category-card').forEach(card=>{
    const key=card.dataset.category;
    const p=catalog.find(p=>inStock(p)&&findMatch(p,key)&&primaryPhoto(p))||catalog.find(p=>findMatch(p,key)&&primaryPhoto(p));
    if(!p)return;
    const img=card.querySelector('img'),fallback=card.querySelector('.category-graphic');
    showImage(img,fallback,primaryPhoto(p),p.name);
  });
}
function fillBrands(){
  const target=$('#brandList');
  const counts=new Map();
  catalog.forEach(p=>{if(p.brand)counts.set(p.brand,(counts.get(p.brand)||0)+1)});
  const names=Array.from(counts.keys()).sort((a,b)=>counts.get(b)-counts.get(a));
  if(!names.length){target.replaceChildren(el('span','brand-loading','Browse our complete product catalogue.'));return}
  target.replaceChildren(...names.slice(0,12).map(name=>{
    const a=el('a','brand-link',name);a.href='/products.html?brand='+encodeURIComponent(name);return a;
  }));
}
function renderFeatured(){
  const grid=$('#featuredGrid'),filtered=catalog.filter(p=>findMatch(p,activeFilter));
  // Featured items are explicitly marked in the sheet. The remaining
  // items are regular catalogue selections, never labelled "bestsellers".
  const picks=filtered.slice().sort((a,b)=>{
    const score=p=>(isFeatured(p)?8:0)+(inStock(p)?4:0)+(primaryPhoto(p)?2:0);
    return score(b)-score(a);
  }).slice(0,10);
  if(!picks.length){
    grid.replaceChildren(el('p','loading-message','No matching products right now. Browse all products or message us on WhatsApp.'));
    grid.setAttribute('aria-busy','false');return;
  }
  grid.replaceChildren(...picks.map((p,index)=>productCard(p,index)));
  grid.setAttribute('aria-busy','false');
  window.MLStore?.syncWishlistButtons();
}
function productCard(p,index){
  const card=el('article','feature-card');
  const flag=el('span','feature-flag'+(isFeatured(p)?' is-featured':''),isFeatured(p)?'FEATURED':inStock(p)?'AVAILABLE':'CHECK AVAILABILITY');
  card.append(flag);
  const wish=el('button','feature-wishlist','♡');wish.type='button';wish.dataset.wishlistId=String(p.id);wish.setAttribute('aria-label','Save '+p.name+' to wishlist');card.append(wish);
  const top=el('div','feature-top');
  const image=el('a','feature-image');image.href=url(p);image.setAttribute('aria-label','View '+p.name);
  const photo=primaryPhoto(p);const fallback=el('span','feature-fallback','MLN.');
  const img=el('img');img.loading=index<5?'eager':'lazy';img.decoding='async';image.append(fallback,img);
  showImage(img,fallback,photo,p.name);
  top.append(image);
  const info=el('div','feature-info');
  info.append(el('span','feature-brand',p.brand||'ML Nutrition'));
  const name=el('a','feature-title',p.name);name.href=url(p);info.append(name);
  info.append(el('span','feature-category',p.category||'Supplements'));
  info.append(el('strong','feature-price',formatPrice(p.price_range)));
  top.append(info);card.append(top);
  const actions=el('div','feature-actions');
  const flavourChoices=String(p.flavours||'').split(/[,|]/).map(v=>v.trim()).filter(Boolean);
  // Only instant-add when no flavour choice is required.
  if(inStock(p)&&!flavourChoices.length){
    const add=el('button','','ADD TO CART');add.type='button';add.dataset.cartId=String(p.id);add.setAttribute('aria-label','Add '+p.name+' to cart');actions.append(add);
  }else{
    actions.append(el('a','',inStock(p)?'CHOOSE OPTIONS':'VIEW PRODUCT'));
    actions.lastChild.href=url(p);
  }
  card.append(actions);return card;
}
function wireFilters(){
  $$('[data-filter]').forEach(button=>button.addEventListener('click',()=>{
    activeFilter=button.dataset.filter;
    $$('[data-filter]').forEach(b=>{
      const selected=b===button;
      b.classList.toggle('selected',selected);
      b.setAttribute('aria-pressed',String(selected));
    });
    renderFeatured();
  }));
}
async function load(){
  try{
    const response=await fetch(SHEET,{cache:'no-store'});
    if(!response.ok)throw Error('Catalogue HTTP '+response.status);
    catalog=parseSheet(await response.text());
    if(!catalog.length)throw Error('Catalogue is empty');
    window.MLStore?.registerProducts(catalog);
    fillHero();fillCategories();fillBrands();renderFeatured();
  }catch(err){
    console.error('Unable to load ML Nutrition product catalogue',err);
    $('#featuredGrid').replaceChildren(el('p','loading-message','Products are temporarily unavailable. You can still browse our catalogue or ask our team on WhatsApp.'));
    $('#featuredGrid').setAttribute('aria-busy','false');
    $('#brandList').replaceChildren(el('span','brand-loading','Explore global brands in our catalogue.'));
  }
}
setupHeader();
wireFilters();
load();
})();
