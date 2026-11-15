/* ML Nutrition / Internal product pages V14.
   Enhances the existing, functioning shop logic without replacing it. */
(()=>{
'use strict';
function ready(){
 const body=document.body;
 if(!body?.classList?.contains('mln-catalog-page')&&!body?.classList?.contains('mln-product-page'))return;
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
     const sync=()=>toggle.setAttribute('aria-expanded',String(sidebar.classList.contains('active')));
     toggle.addEventListener('click',()=>queueMicrotask(sync));
     document.addEventListener('keydown',e=>{
       if(e.key==='Escape'&&sidebar.classList.contains('active')){
         sidebar.classList.remove('active');
         sync();toggle.focus();
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
     add.disabled=originalAdd.disabled;
     add.textContent=originalAdd.disabled?'OUT OF STOCK':'ADD TO CART';
     bar.hidden=false;
   };
   add.addEventListener('click',()=>{
     const original=root.querySelector('#addCartBtn');
     if(original&&!original.disabled)original.click();
   });
   wa.addEventListener('click',()=>root.querySelector('#buyWaBtn')?.click());
   // Observe only the actual product area; changes to the bar itself
   // do not retrigger this observer.
   new MutationObserver(sync).observe(root,{childList:true,subtree:true});
   sync();
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});
else ready();
})();