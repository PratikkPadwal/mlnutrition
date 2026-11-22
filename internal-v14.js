/* ML Nutrition / Internal product pages V14.
   Enhances the existing, functioning shop logic without replacing it. */
(()=>{
'use strict';
function ready(){
 const body=document.body;
 if(!body?.classList?.contains('mln-catalog-page')&&!body?.classList?.contains('mln-product-page'))return;
 // The slim announcement scrolls away while the homepage-style header stays
 // sticky. Keep the legacy mobile menu immediately below its actual edge.
 const navbar=document.querySelector('.navbar');
 const menu=document.getElementById('mobileMenu');
 const mobileToggle=document.querySelector('.mobile-toggle');
 if(navbar&&menu&&mobileToggle){
   const positionMenu=()=>{
     if(!menu.classList.contains('active'))return;
     const bottom=Math.max(0,Math.round(navbar.getBoundingClientRect().bottom));
     menu.style.top=bottom+'px';
     menu.style.maxHeight=Math.max(100,window.innerHeight-bottom)+'px';
   };
   mobileToggle.addEventListener('click',positionMenu);
   window.addEventListener('resize',positionMenu);
   window.addEventListener('scroll',positionMenu,{passive:true});
 }
 if(body.classList.contains('mln-catalog-page')){
   const active=(new URLSearchParams(window.location.search).get('category')||'all').toLowerCase();
   document.querySelectorAll('[data-mln-category]').forEach(a=>{
     const selected=a.dataset.mlnCategory===active;
     a.classList.toggle('is-current',selected);
     if(selected)a.setAttribute('aria-current','page');
   });
   document.getElementById('mlnMobileCart')?.addEventListener('click',()=>{
     window.MLStore?.openCart?.();
   });
   const toggle=document.getElementById('mobileFilterToggle'),sidebar=document.getElementById('sidebar');
   if(toggle&&sidebar){
     toggle.setAttribute('aria-controls','sidebar');
     toggle.setAttribute('aria-expanded','false');
     const close=document.createElement('button');
     close.type='button';
     close.className='mln-filter-close';
     close.textContent='CLOSE FILTERS ×';
     close.setAttribute('aria-label','Close product filters');
     sidebar.prepend(close);
     const sync=()=>toggle.setAttribute('aria-expanded',String(sidebar.classList.contains('active')));
     const hide=()=>{sidebar.classList.remove('active');sync();};
     close.addEventListener('click',()=>{hide();toggle.focus();});
     toggle.addEventListener('click',()=>queueMicrotask(sync));
     new MutationObserver(sync).observe(sidebar,{attributes:true,attributeFilter:['class']});
     document.addEventListener('keydown',e=>{
       if(e.key==='Escape'&&sidebar.classList.contains('active')){
         hide();toggle.focus();
       }
     });
   }
 }
 if(body.classList.contains('mln-product-page')){
   const bar=document.getElementById('mlnMobileBuy');
   const price=document.getElementById('mlnBuyPrice');
   const add=document.getElementById('mlnBuyAdd');
   const wa=document.getElementById('mlnBuyWhatsApp');
   const root=document.getElementById('detailRoot');
   if(!bar||!price||!add||!wa||!root)return;
   // The original product renderer creates the actual add-to-cart,
   // flavour and quantity controls asynchronously. Mirror their state,
   // and delegate clicks to their existing event handlers.
   const sync=()=>{
     const originalAdd=root.querySelector('#addCartBtn');
     const originalWa=root.querySelector('#buyWaBtn');
     const originalPrice=root.querySelector('.detail-price');
     if(!originalAdd||!originalWa||!originalPrice){
       bar.hidden=true;
       return;
     }
     price.textContent=originalPrice.textContent.trim()||'ASK FOR PRICE';
     const inStock=!root.querySelector('.badge.out');
     const hasFlavours=!!root.querySelector('.flavour-chip');
     const hasChosenFlavour=!!root.querySelector('.flavour-chip.active');
     const needsFlavour=inStock&&hasFlavours&&!hasChosenFlavour;
     add.disabled=!inStock;
     add.textContent=!inStock?'OUT OF STOCK':needsFlavour?'CHOOSE FLAVOUR':'ADD TO CART';
     add.setAttribute('aria-label',needsFlavour?'Choose a flavour before adding to cart':add.textContent);
     bar.hidden=false;
   };
   add.addEventListener('click',()=>{
     const original=root.querySelector('#addCartBtn');
     if(original&&!original.disabled)original.click();
   });
   wa.addEventListener('click',()=>{
     if(root.querySelector('.flavour-chip')&&!root.querySelector('.flavour-chip.active')){
       root.querySelector('#addCartBtn')?.click();
       return;
     }
     root.querySelector('#buyWaBtn')?.click();
   });
   // Observe only the actual product area; changes to the bar itself
   // do not retrigger this observer.
   new MutationObserver(sync).observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['class','disabled']});
   sync();
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});
else ready();
})();