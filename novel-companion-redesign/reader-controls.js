(()=>{
 const reader=document.querySelector('.reader');
 const article=document.querySelector('#story');
 const tools=document.querySelector('#readerTools');
 const fontValue=tools.querySelector('#fontValue');
 const fontKey='xiaoyue-reader-font-size';
 const lineKey='xiaoyue-reader-line-height';
 const themeKey='xiaoyue-reader-theme';
 let size=Number(localStorage.getItem(fontKey))||18;
 function applySize(){size=Math.max(14,Math.min(32,size));article.style.setProperty('--reader-font-size',size+'px');fontValue.textContent=size+'px';localStorage.setItem(fontKey,String(size))}
 applySize();
 tools.querySelector('[data-font="down"]').addEventListener('click',()=>{size-=1;applySize()});
 tools.querySelector('[data-font="up"]').addEventListener('click',()=>{size+=1;applySize()});
 tools.querySelector('[data-font="reset"]').addEventListener('click',()=>{size=18;applySize()});
 const line=tools.querySelector('#lineHeight');line.value=localStorage.getItem(lineKey)||'2.25';article.style.setProperty('--reader-line-height',line.value);line.addEventListener('change',()=>{article.style.setProperty('--reader-line-height',line.value);localStorage.setItem(lineKey,line.value)});
 const theme=tools.querySelector('#readerTheme');theme.value=localStorage.getItem(themeKey)||'paper';reader.classList.add('theme-'+theme.value);theme.addEventListener('change',()=>{reader.classList.remove('theme-paper','theme-sepia','theme-night');reader.classList.add('theme-'+theme.value);localStorage.setItem(themeKey,theme.value)});
})();
