(function(){
  const header=document.querySelector('.top');
  const controls=document.createElement('div');
  controls.className='import-controls';
  controls.innerHTML='<button class="import-btn" type="button">导入我的 TXT</button><input class="book-file" type="file" accept=".txt,text/plain" multiple hidden><span class="book-label">示例小说</span>';
  header.appendChild(controls);
  const picker=controls.querySelector('input');
  const story=document.querySelector('#story');
  const toc=document.querySelector('.side-card');
  const title=document.querySelector('.reader h1');
  const chapterTag=document.querySelector('.chapter-tag');
  const byline=document.querySelector('.byline');
  const progressLabel=document.querySelector('.top-right');
  let chapters=[];let current=0;let bookId='sample-book';window.__xiaoyueBookId=bookId;
  controls.querySelector('button').addEventListener('click',()=>picker.click());
  picker.addEventListener('change',async()=>{
    const files=Array.from(picker.files||[]).sort((a,b)=>a.name.localeCompare(b.name,'zh-CN',{numeric:true,sensitivity:'base'}));
    if(!files.length)return;
    try{
      const loaded=await Promise.all(files.map(async f=>({name:f.name.replace(/\.txt$/i,''),text:(await f.text()).replace(/^\uFEFF/, '').replace(/\r\n?/g,'\n').trim()})));
      const parsed=[];
      for(const file of loaded){
        const lines=file.text.split('\n');
        const starts=[];
        lines.forEach((line,i)=>{if(/^\s*(第[零〇一二三四五六七八九十百千万\d]+[章节回卷部篇].{0,50}|卷[零〇一二三四五六七八九十\d]+.{0,50})\s*$/.test(line))starts.push(i)});
        if(starts.length>1){
          for(let i=0;i<starts.length;i++){
            const end=starts[i+1]??lines.length;const part=lines.slice(starts[i],end).join('\n').trim();
            if(part)parsed.push({title:lines[starts[i]].trim(),text:part});
          }
        }else if(files.length>1){parsed.push({title:file.name,text:file.text})}
        else if(starts.length===1){parsed.push({title:lines[starts[0]].trim(),text:file.text})}
        else parsed.push({title:file.name,text:file.text});
      }
      chapters=parsed;bookId='txt:'+loaded.map(f=>f.name.toLowerCase()).join('|');window.__xiaoyueBookId=bookId;current=0;
      let saved=null;try{saved=JSON.parse(localStorage.getItem(`xiaoyue-progress:${bookId}`)||'null')}catch{}
      if(Number.isInteger(saved?.chapter)&&saved.chapter>=0&&saved.chapter<chapters.length)current=saved.chapter;
      window.__xiaoyueChapters=chapters;window.__xiaoyueCurrentChapter=current;controls.querySelector('.book-label').textContent=files.length===1?loaded[0].name:`已导入 ${files.length} 个文件 · ${chapters.length} 章`;
      renderChapter(saved?.scrollY);
    }catch(e){alert('读取 TXT 失败：'+e.message)}
    picker.value='';
  });
  function renderChapter(restoreY){
    if(!chapters.length)return;
    const c=chapters[current];window.__xiaoyueCurrentChapter=current;title.textContent=c.title.replace(/^\d+[-_.、\s]*/, '')||c.title;
    chapterTag.textContent=`${chapters.length>1?`第 ${current+1} / ${chapters.length} 章　`:''}${c.title}`;
    byline.textContent=`${controls.querySelector('.book-label').textContent}　·　约 ${Math.max(1,Math.ceil(c.text.length/450))} 分钟`;
    const paras=c.text.split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean);
    story.replaceChildren(...paras.map(t=>{const p=document.createElement('p');p.textContent=t;return p}));
    document.querySelectorAll('.reader-nav').forEach(n=>n.remove());
    if(chapters.length>1){const nav=document.createElement('div');nav.className='reader-nav';nav.innerHTML=`<button ${current===0?'disabled':''}>上一章</button><span>${current+1} / ${chapters.length}</span><button ${current===chapters.length-1?'disabled':''}>下一章</button>`;nav.children[0].onclick=()=>{current--;renderChapter();window.scrollTo(0,0)};nav.children[2].onclick=()=>{current++;renderChapter();window.scrollTo(0,0)};story.after(nav)}
    if(toc){
      const oldQuery=toc.querySelector('.toc-search')?.value||'';
      toc.innerHTML='<h3>本书目录</h3><input class="toc-search" type="search" placeholder="搜索章节标题…" aria-label="搜索目录章节"><div class="toc-results"></div>';
      const input=toc.querySelector('.toc-search');const results=toc.querySelector('.toc-results');input.value=oldQuery;
      const renderRows=query=>{results.replaceChildren();const matches=chapters.map((chapter,index)=>({chapter,index})).filter(item=>item.chapter.title.toLocaleLowerCase().includes(query));const visible=query?matches:(matches.length>120?matches.slice(Math.max(0,current-4),current+116):matches);visible.forEach(({chapter,index})=>{const row=document.createElement('button');row.className='chapter-row'+(index===current?' active':'');row.dataset.chapterIndex=String(index);row.innerHTML='<span class="dot"></span><span></span>';row.lastElementChild.textContent=chapter.title;row.onclick=()=>{current=index;renderChapter();window.scrollTo(0,0)};results.appendChild(row)});if(!visible.length){const empty=document.createElement('p');empty.className='toc-empty';empty.textContent='没有匹配的章节';results.appendChild(empty)}};
      input.addEventListener('input',()=>renderRows(input.value.trim().toLocaleLowerCase()));renderRows(oldQuery.trim().toLocaleLowerCase());
    }
    const pct=Math.round((current+1)/chapters.length*100);const bar=progressLabel.querySelector('.progress i');if(bar)bar.style.width=pct+'%';const label=progressLabel.lastElementChild;if(label)label.textContent=chapters.length>1?`第 ${current+1} 章 · ${pct}%`:'整本 · 100%';
    story.scrollIntoView({block:'start'});
    if(Number.isFinite(restoreY))setTimeout(()=>window.scrollTo(0,restoreY),80);
    window.dispatchEvent(new CustomEvent('xiaoyue:chapter-rendered',{detail:{bookId,chapter:current}}));
  }
  window.__xiaoyueGoToChapter=(index,paragraphIndex=0,needle='')=>{
    if(!chapters.length||index<0||index>=chapters.length)return;
    current=index;renderChapter();
    requestAnimationFrame(()=>{const paragraphs=Array.from(story.querySelectorAll('p'));let target=paragraphs[paragraphIndex];if(needle)target=paragraphs.find(p=>p.textContent.toLocaleLowerCase().includes(needle.toLocaleLowerCase()))||target;if(target)target.scrollIntoView({behavior:'smooth',block:'center'})});
  };
  let progressTimer;
  window.addEventListener('scroll',()=>{clearTimeout(progressTimer);progressTimer=setTimeout(()=>localStorage.setItem(`xiaoyue-progress:${bookId}`,JSON.stringify({chapter:current,scrollY:window.scrollY})),350)},{passive:true});
  if(bookId==='sample-book'){let saved=null;try{saved=JSON.parse(localStorage.getItem(`xiaoyue-progress:${bookId}`)||'null')}catch{}if(Number.isFinite(saved?.scrollY))setTimeout(()=>window.scrollTo(0,saved.scrollY),120)}
})();
// Capture the click before the drag handler so a normal tap always opens/closes the chat.
const mascotButton = document.getElementById('pet');
const mascotFloat = document.getElementById('floating');
const mascotReply = document.getElementById('reply');
mascotButton.setAttribute('role', 'button');
mascotButton.setAttribute('tabindex', '0');
mascotButton.setAttribute('aria-label', '点击和小阅互动，拖动可移动');
function toggleMascotChat() {
  if (mascotFloat.classList.contains('open')) {
    mascotFloat.classList.remove('open');
  } else {
    mascotReply.textContent = '我在呢。选中一段文字，或者直接问我这本书的情节和人物吧。';
    mascotFloat.classList.add('open');
  }
}
mascotButton.addEventListener('click', (event) => {
  event.stopImmediatePropagation();
  if (mascotButton.dataset.skipClick === 'true') { delete mascotButton.dataset.skipClick; return; }
  toggleMascotChat();
}, true);
mascotButton.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    toggleMascotChat();
  }
});
// Pointer-capture drag handling: dragging the mascot moves the whole widget without selecting text.
let mascotDrag = null;
mascotButton.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  event.preventDefault();
  const rect = mascotFloat.getBoundingClientRect();
  mascotDrag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, left: rect.left, top: rect.top, moved: false };
  mascotButton.setPointerCapture(event.pointerId);
  mascotButton.style.cursor = 'grabbing';
  event.stopImmediatePropagation();
}, true);
mascotButton.addEventListener('pointermove', (event) => {
  if (!mascotDrag || event.pointerId !== mascotDrag.id) return;
  event.stopImmediatePropagation();
  const dx = event.clientX - mascotDrag.startX;
  const dy = event.clientY - mascotDrag.startY;
  if (!mascotDrag.moved && Math.hypot(dx, dy) < 14) return;
  mascotDrag.moved = true;
  mascotFloat.style.right = 'auto';
  mascotFloat.style.bottom = 'auto';
  mascotFloat.style.left = Math.max(0, Math.min(innerWidth - mascotFloat.offsetWidth, mascotDrag.left + dx)) + 'px';
  mascotFloat.style.top = Math.max(0, Math.min(innerHeight - mascotFloat.offsetHeight, mascotDrag.top + dy)) + 'px';
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);
function endMascotDrag(event) {
  if (!mascotDrag || event.pointerId !== mascotDrag.id) return;
  if (mascotDrag.moved) mascotButton.dataset.skipClick = 'true';
  mascotDrag = null;
  mascotButton.style.cursor = 'grab';
  event.stopImmediatePropagation();
}
mascotButton.addEventListener('pointerup', endMascotDrag, true);
mascotButton.addEventListener('pointercancel', endMascotDrag, true);




