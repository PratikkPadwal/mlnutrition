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
let catalog=[],featuredPool=[],featuredPage=0;
const FEATURED_PER_PAGE=4;
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
  const exactLabels={
    protein:['protein','wheyprotein','isolate'],creatine:['creatine'],
    gainer:['massgainer','gainer'],preworkout:['preworkout'],
    essentials:['essentials','essential'],healthfood:['healthfood','healthfoods']
  };
  const norm=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  $$('.category-card').forEach(card=>{
    const key=card.dataset.category;
    const exact=catalog.filter(p=>exactLabels[key]?.includes(norm(p.category))&&primaryPhoto(p));
    const options=exact.length?exact:catalog.filter(p=>findMatch(p,key)&&primaryPhoto(p));
    const product=options.find(inStock)||options[0];
    if(!product)return;
    const img=card.querySelector('img'),fallback=card.querySelector('.category-graphic');
    showImage(img,fallback,primaryPhoto(product),product.name);
  });
}
function fillBrands(){
  const target=$('#brandList'),count=$('#brandCount'),prev=$('#brandPrev'),next=$('#brandNext');
  const counts=new Map();
  // Every brand is taken from the real product catalogue. Merge differences
  // in capitalization without inventing brand names or products.
  catalog.forEach(p=>{
    const name=String(p.brand||'').trim();
    if(!name)return;
    const key=name.toLowerCase().replace(/\s+/g,' ');
    const existing=counts.get(key);
    if(existing)existing.count++;
    else counts.set(key,{name,count:1});
  });
  const names=Array.from(counts.values()).sort((a,b)=>{
    // Larger in-store ranges appear first; then alphabetical within peers.
    return b.count-a.count||a.name.localeCompare(b.name);
  });
  count.textContent=names.length+' CATALOGUE BRANDS';
  if(!names.length){
    target.replaceChildren(el('span','brand-loading','Browse our full product catalogue.'));
    prev.disabled=true;next.disabled=true;return;
  }

  // Source artwork is from official brand sites or identifiable existing
  // retailer brand assets. Do not transform or recreate trademark geometry.
  // Only display a picture if it actually loads; the true catalogue
  // brand name remains the fallback for failed or unavailable assets.
  const brandAssets=[
    // Verified existing logo artwork, matched to catalogue brand spellings.
    {re:/^as[\s-]*it[\s-]*is(?:\s+nutrition)?$/i,src:'https://cdn.kindlife.in/images/feature_variant/216/ASITIS_Black_Text_Logo_Without_BG.png?t=1771222200'},
    {re:/^big[\s-]*muscles(?:\s+nutrition)?$/i,src:'https://pbs.twimg.com/profile_images/1463771910177640455/-yDh17Jw.jpg'},
    {re:/^doctor['’]?\s*s[\s-]*choice$|^doctor[\s-]*choice$/i,src:'https://images.yourstory.com/cs/images/companies/2725850111044989421442515851804265828519002n1-1705832698022.jpg?ar=1%3A1&fill=solid&fill-color=fff&fm=auto&format=auto&mode=fill&q=85&w=1920'},
    {re:/^cellucor$/i,src:'https://supplementsuperstores.com/cdn/shop/files/Cellucor_Logo.png?v=1647546825&width=3840'},
    {re:/^flex[\s-]*wheeler(?:\s+nutrition)?$/i,src:'https://flexwheelernutrition.com/cdn/shop/files/Flex_Wheeler_Logo_02.png?v=1683280327'},
    {re:/^fuel[\s-]*one$/i,src:'https://mma.prnewswire.com/media/2393254/Fuel_One_Logo.jpg?p=facebook'},
    {re:/^gat(?:\s*sport)?$/i,src:'https://www.supplementking.ca/media/amasty/shopby/option_images/GAT_2016_New_LOGO_1.jpg'},
    {re:/^rule[\s-]*1(?:\s*proteins?)?$|^r1$/i,src:'https://snshealth.com/cdn/shop/collections/Rule-One_600x600_crop_center.png?v=1689272606'},
    {re:/^scivation$/i,src:'https://www.shayn.ch/cdn/shop/files/Scivation-Logo_1024x1024.jpg?v=1690726039'},
    {re:/^ultimate[\s-]*nutrition$/i,src:'https://muscle-nutrition.com/cdn/shop/collections/ulto.jpg?v=1730032215&width=1024'},
    // For these niche brands use the real icon requested from the
    // brand's own website, paired with the exact catalogue name.
    // Don't substitute unrelated supplement packaging or invent a logo.
    {re:/^nortech(?:\s+nutrition)?$/i,src:'https://www.google.com/s2/favicons?domain=nortechnutrition.com&sz=128',icon:true},
    {re:/^pro[\s-]*maniax$/i,src:'https://www.google.com/s2/favicons?domain=promaniax.au&sz=128',icon:true},
    {re:/^scitron(?:\s+nutrition)?$/i,src:'https://www.google.com/s2/favicons?domain=scitron.com&sz=128',icon:true},
    {re:/^muscle\s*blaze$/i,src:'https://iiasl.org/images/muscleblaze-logo.png'},
    {re:/^(on|optimum nutrition)$/i,src:'https://nastore.com/cdn/shop/collections/5.jpg?v=1729843115'},
    {re:/^ronnie coleman/i,src:'https://ronniecoleman.net/cdn/shop/collections/RC_Logo_BlueAndGold_LowRes_1024x1024.png?v=1623848696'},
    {re:/^applied nutrition/i,src:'https://cdn.shopify.com/s/files/1/0454/0871/4919/files/Applied_Logo_blue_1200x1200.png?v=1658918948'},
    {re:/^muscle\s*tech$/i,src:'https://images.tcdn.com.br/img/img_prod/820633/vapor_x5_360_g_sabor_nasty_grape_muscletech_1487_3_e4ca5f278fc704165dec7fdc97f5816b.jpg'},
    {re:/^avvatar/i,src:'https://pbs.twimg.com/profile_images/1035100746738479109/kviFfjwO_400x400.jpg'},
    {re:/^steadfast/i,src:'https://steadfastnutrition.in/cdn/shop/files/SN_Logo_Final-02_014eb72b-8e3a-430c-b6ac-fa4e87ae5c33.png?v=1694502155'},
    {re:/^naturaltein/i,src:'https://app.shoptrustified.in/public/uploads/brand/13-04-241713041918brand.jpg'},
    {re:/^allmax/i,src:'https://gibbsdirect.com/cdn/shop/collections/gibbs-direct-allmax_1200x1200.png?v=1681393521'},
    {re:/^labrada/i,src:'https://shopvitaplus.com/cdn/shop/collections/Labrada_logo.png?v=1697222812'},
    {re:/^(bpi|bpi sports)$/i,src:'https://cdn.shopify.com/s/files/1/0581/6021/8173/files/brand-logo-bpisports_com.png?v=1775134907'},
    {re:/^ultimate nutrition/i,src:'https://jupitersfitness.cl/cdn/shop/collections/1000097253.webp?v=1743730671'},
    {re:/^gnc/i,src:'https://api.watsons.com.sg/medias/GNC-Brand-Landing-Page-Brand-Logo-750pxl-x-452pxl.jpg?context=bWFzdGVyfGltYWdlc3w3MTU1NXxpbWFnZS9qcGVnfGFHRXlMMmd4WkM4eU9ETTNPVGcyTmpNek16SXhOQzlIVGtNZ1FuSmhibVFnVEdGdVpHbHVaeUJRWVdkbElFSnlZVzVrSUV4dloyOGdOelV3Y0hoc0lIZ2dORFV5Y0hoc0xtcHdad3xhMmU2ZmY4N2ZhN2FiNGEzNTUwMGVlNzQ3OTNiYTM2NDg5ZDVlYjBhNzIyMDQ5NmJkYjJlYThjNDk0NDI4MzRl'},
    {re:/^mutant/i,src:'https://static.insales-cdn.com/images/collections/1/5811/93689523/Mutant-brand-logo.webp'},
    {re:/^dymatize/i,src:'https://images.seeklogo.com/logo-png/65/1/dymatize-logo-png_seeklogo-654141.png'},
    {re:/^isopure/i,src:'https://images.seeklogo.com/logo-png/60/1/isopure-logo-png_seeklogo-608651.png'},
    {re:/^scitec/i,src:'https://seeklogo.com/images/S/scitec-nutrition-logo-58790A3263-seeklogo.com.png'},
    {re:/^bsn/i,src:'https://supplementsuperstores.com/cdn/shop/files/BSN-logo.png?v=1613159646&width=2000'},
    {re:/^kevin levrone/i,src:'https://www.sportnahrungdirekt.com/media/image/manufacturer/3/lg/kevin-levrone-signature-series.jpg'},
    // These two use the favicon supplied by the brand's own website
    // instead of a guessed, redrawn or unrelated wordmark.
    {re:/^health\s*ninja/i,src:'https://www.google.com/s2/favicons?domain=healthninjafoods.in&sz=128',icon:true},
    {re:/^(ozn|optimize nutrition)/i,src:'https://www.google.com/s2/favicons?domain=optimize-nutrition.com&sz=128',icon:true},
    {re:/^wellcore/i,src:'https://www.google.com/s2/favicons?domain=wellversed.in&sz=128',icon:true}
  ];

  target.replaceChildren(...names.map((item,index)=>{
    const name=item.name;
    const link=el('a','brand-link');
    link.href='/products.html?brand='+encodeURIComponent(name);
    link.setAttribute('aria-label','Shop '+name+' supplements');
    const fallback=el('span','brand-logo-name',name);
    link.append(fallback);
    const asset=brandAssets.find(entry=>entry.re.test(name));
    if(asset){
      const image=el('img','brand-logo-img'+(asset.icon?' brand-logo-icon':''));
      image.alt=asset.icon?'':name+' brand logo';
      // Keep hidden loading images in a visible carousel slot so
      // native lazy loading can fetch them when customers scroll.
      image.loading=index<6?'eager':'lazy';image.decoding='async';
      image.referrerPolicy='no-referrer';
      image.style.opacity='0';
      image.style.position='absolute';
      image.style.inset='0';
      image.style.width='100%';
      image.style.height='100%';
      image.onload=()=>{
        if(!image.naturalWidth)return;
        image.style.opacity='1';
        image.style.position='static';
        image.style.inset='auto';
        image.style.width='';
        image.style.height='';
        if(!asset.icon)fallback.hidden=true;
        else link.classList.add('has-brand-icon');
      };
      image.onerror=()=>{image.remove();fallback.hidden=false};
      link.prepend(image);
      image.src=asset.src;
      if(image.complete&&image.naturalWidth>0)image.onload();
    }
    return link;
  }));

  function syncBrandArrows(){
    const max=Math.max(0,target.scrollWidth-target.clientWidth);
    prev.disabled=target.scrollLeft<=3;
    next.disabled=max<=3||target.scrollLeft>=max-3;
  }
  const scroll=(direction)=>{
    const first=target.querySelector('.brand-link');
    const width=first?.getBoundingClientRect().width||185;
    target.scrollBy({left:direction*(width+11)*3,behavior:'smooth'});
  };
  prev.addEventListener('click',()=>scroll(-1));
  next.addEventListener('click',()=>scroll(1));
  target.addEventListener('scroll',syncBrandArrows,{passive:true});
  window.addEventListener('resize',syncBrandArrows);
  requestAnimationFrame(syncBrandArrows);
}
function buildFeaturedPool(){
  const candidates=catalog.filter(p=>primaryPhoto(p)&&inStock(p));
  const pool=candidates.length?candidates:catalog.filter(p=>primaryPhoto(p));
  const score=p=>(isFeatured(p)?10:0)+(inStock(p)?5:0);
  const ranked=pool.slice().sort((a,b)=>score(b)-score(a));
  const featured=ranked.filter(isFeatured);
  const lead=featured.find(p=>/applied nutrition/i.test(p.brand))||featured[0]||ranked[0];
  const result=[],seenBrands=new Set(),usedIds=new Set();
  function push(p){if(!p||usedIds.has(String(p.id)))return;result.push(p);usedIds.add(String(p.id));seenBrands.add(p.brand.toLowerCase())}
  push(lead);
  for(const p of ranked){if(result.length>=16)break;if(!seenBrands.has(p.brand.toLowerCase()))push(p)}
  for(const p of ranked){if(result.length>=16)break;push(p)}
  return result;
}
function renderFeatured(){
  const grid=$('#featuredGrid'),totalPages=Math.ceil(featuredPool.length/FEATURED_PER_PAGE);
  if(!featuredPool.length){
    grid.replaceChildren(el('p','loading-message','No featured products available right now. Browse all products or contact our team.'));
    grid.setAttribute('aria-busy','false');updateFeaturedControls(0);return;
  }
  featuredPage=Math.max(0,Math.min(featuredPage,totalPages-1));
  const begin=featuredPage*FEATURED_PER_PAGE;
  grid.replaceChildren(...featuredPool.slice(begin,begin+FEATURED_PER_PAGE).map((p,i)=>productCard(p,i)));
  grid.setAttribute('aria-busy','false');grid.scrollLeft=0;
  updateFeaturedControls(totalPages);
  window.MLStore?.syncWishlistButtons();
}
function updateFeaturedControls(totalPages){
  const prev=$('#featuredPrev'),next=$('#featuredNext'),dots=$('#featuredDots');
  prev.disabled=totalPages<2||featuredPage===0;
  next.disabled=totalPages<2||featuredPage===totalPages-1;
  const dotNodes=[];
  for(let page=0;page<totalPages;page++){
    const dot=el('span','feature-dot'+(page===featuredPage?' is-current':''));
    dot.setAttribute('aria-hidden','true');dotNodes.push(dot);
  }
  dots.replaceChildren(...dotNodes);
  dots.setAttribute('aria-label',totalPages?'Featured products page '+(featuredPage+1)+' of '+totalPages:'No products');
}
function productCard(p,index){
  const card=el('article','feature-card'+(index===0?' spotlight-card':''));
  const flag=el('span','feature-flag'+(isFeatured(p)?' is-featured':''),isFeatured(p)?'FEATURED':'CURATED');
  card.append(flag);
  const wish=el('button','feature-wishlist','♡');wish.type='button';
  wish.dataset.wishlistId=String(p.id);
  wish.setAttribute('aria-label','Save '+p.name+' to wishlist');
  card.append(wish);
  const top=el('div','feature-top'),image=el('a','feature-image');
  image.href=url(p);image.setAttribute('aria-label','View '+p.name);
  const fallback=el('span','feature-fallback','MLN.');
  const img=el('img');img.loading='eager';img.decoding='async';
  image.append(fallback,img);
  showImage(img,fallback,primaryPhoto(p),p.name);
  top.append(image);
  const info=el('div','feature-info');
  info.append(el('span','feature-brand',p.brand||'ML Nutrition'));
  const name=el('a','feature-title',p.name);name.href=url(p);info.append(name);
  info.append(el('span','feature-category',p.category||'Supplements'));
  info.append(el('strong','feature-price',formatPrice(p.price_range)));
  top.append(info);card.append(top);
  const actions=el('div','feature-actions');
  const link=el('a','',inStock(p)?'CHOOSE OPTIONS':'VIEW PRODUCT');
  link.href=url(p);
  link.setAttribute('aria-label',inStock(p)?'Choose options for '+p.name:'View '+p.name);
  actions.append(link);card.append(actions);return card;
}
function setupShowcase(){
  $('#featuredPrev').addEventListener('click',()=>{
    if(featuredPage===0)return;
    featuredPage--;renderFeatured();
  });
  $('#featuredNext').addEventListener('click',()=>{
    if(featuredPage>=Math.ceil(featuredPool.length/FEATURED_PER_PAGE)-1)return;
    featuredPage++;renderFeatured();
  });
  const viewport=$('#categoryViewport'),prev=$('#categoryPrev'),next=$('#categoryNext');
  const move=(direction)=>{
    const first=viewport.querySelector('.category-card');
    const distance=(first?.getBoundingClientRect().width||200)+12;
    viewport.scrollBy({left:direction*distance*2,behavior:'smooth'});
  };
  prev.addEventListener('click',()=>move(-1));
  next.addEventListener('click',()=>move(1));
  const syncCategory=()=>{
    const max=viewport.scrollWidth-viewport.clientWidth;
    prev.disabled=viewport.scrollLeft<=3;
    next.disabled=max<=3||viewport.scrollLeft>=max-3;
  };
  viewport.addEventListener('scroll',syncCategory,{passive:true});
  window.addEventListener('resize',syncCategory);
  requestAnimationFrame(syncCategory);
}
async function load(){
  try{
    const response=await fetch(SHEET,{cache:'no-store'});
    if(!response.ok)throw Error('Catalogue HTTP '+response.status);
    catalog=parseSheet(await response.text());
    if(!catalog.length)throw Error('Catalogue is empty');
    window.MLStore?.registerProducts(catalog);
    fillHero();fillCategories();fillBrands();featuredPool=buildFeaturedPool();renderFeatured();
  }catch(err){
    console.error('Unable to load ML Nutrition product catalogue',err);
    $('#featuredGrid').replaceChildren(el('p','loading-message','Products are temporarily unavailable. You can still browse our catalogue or ask our team on WhatsApp.'));
    $('#featuredGrid').setAttribute('aria-busy','false');
    $('#brandList').replaceChildren(el('span','brand-loading','Explore global brands in our catalogue.'));
  }
}
setupHeader();
setupShowcase();
load();
})();
