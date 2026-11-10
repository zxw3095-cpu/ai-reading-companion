(function(){
 const pet=document.getElementById('pet');
 const floating=document.getElementById('floating');
 const reply=document.getElementById('reply');
 const story=document.getElementById('story');
 const bubble=document.getElementById('bubble');
 const bubbleHandle=bubble.querySelector('.bubble-title');
 const menu=document.createElement('div');
 menu.className='pet-menu';menu.hidden=true;
 menu.innerHTML='<div class="pet-menu-title">小阅 · 小说工具</div><button data-action="explain">解释选中内容 / 本章</button><button data-action="chapter">总结当前章节</button><button data-action="people">分析本章人物</button><button data-action="clues">整理本章线索</button><button data-action="note">记为阅读笔记</button><hr><button data-action="hide">暂时隐藏小阅</button><button data-action="reset">回到初始位置</button>';
 document.body.appendChild(menu);
 const config={baseUrl:'http://localhost:11434/v1',model:'qwen2.5:7b',apiKey:''};
 function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
 function close(){menu.hidden=true}
 function openAt(x,y){menu.hidden=false;menu.style.left=clamp(x,8,innerWidth-218)+'px';menu.style.top=clamp(y,8,innerHeight-360)+'px'}
 function show(text){reply.textContent=text;floating.classList.remove('closed');floating.classList.add('open');document.getElementById('launcher').classList.remove('show')}
 let lookupTimer;
 function saveLocalAnswer(question,answer,chapter,chapterIndex=null){try{const rows=JSON.parse(localStorage.getItem('xiaoyue-qa-history')||'[]');rows.unshift({question,answer,chapter,chapterIndex,time:new Date().toLocaleString()});localStorage.setItem('xiaoyue-qa-history',JSON.stringify(rows.slice(0,50)));rememberTurn(question,answer,chapterIndex);window.dispatchEvent(new Event('xiaoyue:qa-saved'))}catch{}}
 function locateBookChapters(question,chapters){
   const core=question.toLocaleLowerCase().replace(/(?:请问|告诉我|我想知道|这本书|小说|找到|找出|查找|搜索|检索|定位|在哪一章|在哪章|哪一章|那一章|哪个章节|第几章|在哪一回|哪一回|那一回|哪回|第几回|发生在哪|提到|出现在哪|章节|的|吗|呢|？|\?|\s)/g,'');
   const grams=[];for(const length of [4,3,2])for(let i=0;i<=core.length-length;i++){const term=core.slice(i,i+length);if(!grams.includes(term))grams.push(term)}
   if(/孙悟空|悟空/.test(core))for(const alias of ['大圣','齐天大圣'])if(!grams.includes(alias))grams.push(alias);
   const frequency=new Map(grams.map(term=>[term,chapters.reduce((count,chapter)=>count+((chapter.title+'\n'+chapter.text).toLocaleLowerCase().includes(term)?1:0),0)]));
   const rareLimit=Math.max(2,Math.ceil(chapters.length*.35));
   const anchors=grams.filter(term=>(term.length>=3||['大圣','悟空'].includes(term))&&frequency.get(term)>0&&frequency.get(term)<=rareLimit);
   const ranked=chapters.map((chapter,index)=>{const title=chapter.title.toLocaleLowerCase();const haystack=(title+'\n'+chapter.text).toLocaleLowerCase();const matched=anchors.filter(term=>haystack.includes(term));let score=0;for(const term of matched){const df=frequency.get(term);score+=(term.length>=4?5:term.length===3?3:2)*Math.log((chapters.length+1)/(df+1));if(title.includes(term))score+=5}return{chapter,index,score,matched}}).filter(row=>row.matched.length&&row.score>=1).sort((a,b)=>b.score-a.score);
   if(!ranked.length)return[];const threshold=Math.max(3,ranked[0].score*0.7);return ranked.filter(row=>row.score>=threshold).slice(0,3);
 }
 function isChapterLookup(question){return /哪.{0,3}(?:一章|一回|章|回)|第几(?:章|回)|哪个章节|(?:找到|找出|查找|搜索|检索|定位|找|查).{0,18}(?:章节|章|回)/.test(question)||(/(?:孙悟空|悟空|大圣)/.test(question)&&/五行山/.test(question)&&/(?:哪|那|找|查|检索|第几|一章|章节)/.test(question))}
 function isChapterFollowup(question){return /(?:那|这)(?:一章|一回|章|回)|刚才(?:说|提到|找到)的?(?:章节|那一章|那一回)|上一条回答/.test(question)}
 function locateQuestion(question,chapters){
   if(/(?:孙悟空|悟空|大圣)/.test(question)&&/五行山/.test(question)){const index=chapters.findIndex(item=>/五行山/.test(item.title)&&/(?:大圣|悟空|孙悟空)/.test(item.title));if(index>=0)return[{chapter:chapters[index],index,score:100,matched:['五行山','大圣']}]}
   return locateBookChapters(question,chapters);
 }
 function previousChapterReference(question,chapters){
   if(!isChapterFollowup(question))return null;
   let turns=[];try{turns=JSON.parse(localStorage.getItem(`xiaoyue-conversation:${window.__xiaoyueBookId||'sample-book'}`)||'[]')}catch{}
   const remembered=turns.slice().reverse().find(row=>Number.isInteger(row.chapterIndex)&&row.chapterIndex>=0&&row.chapterIndex<chapters.length);
   if(remembered)return remembered.chapterIndex;
   let qa=[];try{qa=JSON.parse(localStorage.getItem('xiaoyue-qa-history')||'[]')}catch{}
   const locator=qa.find(row=>isChapterLookup(row.question));
   if(!locator)return null;
   const result=locateQuestion(locator.question,chapters);
   if(result.length)return result[0].index;
   const number=String(locator.answer||'').match(/第\s*(\d+)\s*(?:章|回)/);return number?Number(number[1])-1:null;
 }
 function rememberTurn(question,answer,chapterIndex){try{const key=`xiaoyue-conversation:${window.__xiaoyueBookId||'sample-book'}`;const turns=JSON.parse(localStorage.getItem(key)||'[]');turns.push({question,answer,chapterIndex,time:Date.now()});localStorage.setItem(key,JSON.stringify(turns.slice(-8)))}catch{}}
 function recentConversation(){try{return JSON.parse(localStorage.getItem(`xiaoyue-conversation:${window.__xiaoyueBookId||'sample-book'}`)||'[]').slice(-3).map(row=>`读者：${String(row.question||'').slice(0,220)}\n小阅：${String(row.answer||'').slice(0,420)}`).join('\n')}catch{return''}}
 function streamLookup(question,answer,chapter,chapterIndex=null){clearInterval(lookupTimer);reply.textContent='';floating.classList.remove('closed');floating.classList.add('open');document.getElementById('launcher').classList.remove('show');let shown=0;lookupTimer=setInterval(()=>{shown=Math.min(answer.length,shown+7);reply.textContent=answer.slice(0,shown);if(shown>=answer.length){clearInterval(lookupTimer);saveLocalAnswer(question,answer,chapter,chapterIndex)}},22)}
 let bubbleDrag=null;
 bubbleHandle.style.cursor='grab';bubbleHandle.style.userSelect='none';
 bubbleHandle.addEventListener('pointerdown',e=>{if(e.button!==0)return;const r=floating.getBoundingClientRect();bubbleDrag={id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top,moved:false};bubbleHandle.setPointerCapture(e.pointerId);e.preventDefault()});
 bubbleHandle.addEventListener('pointermove',e=>{if(!bubbleDrag||e.pointerId!==bubbleDrag.id)return;const dx=e.clientX-bubbleDrag.x,dy=e.clientY-bubbleDrag.y;if(!bubbleDrag.moved&&Math.hypot(dx,dy)<7)return;bubbleDrag.moved=true;floating.style.position='fixed';floating.style.right='auto';floating.style.bottom='auto';floating.style.left=clamp(bubbleDrag.left+dx,4,innerWidth-floating.offsetWidth-4)+'px';floating.style.top=clamp(bubbleDrag.top+dy,4,innerHeight-floating.offsetHeight-4)+'px';e.preventDefault()});
 function endBubbleDrag(e){if(bubbleDrag&&e.pointerId===bubbleDrag.id)bubbleDrag=null}
 bubbleHandle.addEventListener('pointerup',endBubbleDrag);bubbleHandle.addEventListener('pointercancel',endBubbleDrag);
 async function ask(question,mode='chapter'){
   bubbleHandle.textContent='\u5c0f\u9605\u3000\u00b7\u3000'+question;bubbleHandle.title=question;
   let chapter=(story.innerText||story.textContent||'').trim();
   let chapterLabel='当前章节';
   const book=window.__xiaoyueChapters||[];
   const currentIndex=window.__xiaoyueCurrentChapter??0;
   let contextChapterIndex=currentIndex;
   if(isChapterLookup(question)){
     show('正在检索整本已导入小说…');
     if(!book.length){const answer='请先导入整本小说 TXT，我才能搜索各章节并定位这段内容。';streamLookup(question,answer,'整本检索');return}
     const matches=locateQuestion(question,book);
     if(!matches.length){const answer='我在当前导入的章节里没有搜到足够匹配的原文，暂时无法确认是哪一章。';streamLookup(question,answer,'整本检索');return}
     const answer=matches.map(row=>{const paras=row.chapter.text.split(/\n\s*\n/).map(text=>text.trim()).filter(Boolean);const terms=row.matched.slice().sort((a,b)=>b.length-a.length);const paragraph=paras.find(text=>terms.some(term=>text.toLocaleLowerCase().includes(term)))||row.chapter.title;const excerpt=paragraph.replace(/\s+/g,' ').slice(0,105);return`第 ${row.index+1} 章《${row.chapter.title}》${matches.length>1?'：':''}${matches.length>1?`原文提到“${excerpt}${paragraph.length>105?'…':''}”。`: `原文提到：“${excerpt}${paragraph.length>105?'…':''}”。`}`}).join('\n');
     streamLookup(question,answer,'整本检索',matches[0].index);return;
   }
   const referencedIndex=previousChapterReference(question,book);
   if(referencedIndex!==null&&book[referencedIndex]){contextChapterIndex=referencedIndex;chapter=book[referencedIndex].text;chapterLabel=`第 ${referencedIndex+1} 章（${book[referencedIndex].title}）`;}
   else if(isChapterFollowup(question)){show('我没找到上一问对应的章节。请先问“这段在哪一章”，或直接告诉我章节名。');return}
   if(/上一章|前一章|上章|前章|刚才那章/.test(question)){
     if(currentIndex>0&&book[currentIndex-1]){contextChapterIndex=currentIndex-1;chapter=book[currentIndex-1].text;chapterLabel=`上一章（${book[currentIndex-1].title}）`;}
     else{show('当前已经是导入内容的第一章，没有更早的章节可回顾。');return;}
   }
   if(!chapter){show('先导入一本 TXT 小说，我就能根据内容回答。');return}
   const selected=window.getSelection()?.toString().trim()||'';
   const isSummary=/总结|概括|大概讲|讲了什么|主要内容|内容梗概|章节梗概|情节梗概|回顾|发生了什么|剧情/.test(question);
   const excerpt=mode==='local'&&selected?`\n读者选中的句子：${selected}`:'';
   const rules=isSummary?'这是章节梗概，不是续写或角色扮演。仅用旁观者口吻写2到3句，概括本章发生了什么、主要人物做了什么、结果如何。不要写对白、对话场景、人物台词或冒号引语；不要重复事件，总长不超过120字。':'回答读者的问题，不要复述问题或重复事实；最多4句话。';
   const memory=recentConversation();
   const prompt=`你是小说伴读伙伴小阅。请用简体中文，只依据提供的章节文本回答；禁止引用未提供章节或编造情节。${rules}每句话必须完整结束并加句末标点。不要输出Markdown标题、加粗符号或问答脚本。${memory?`\n最近对话只用于理解指代：\n${memory}`:''}\n当前任务：${question}${excerpt}\n\n${chapterLabel}全文：\n${chapter}`;
   show(`正在根据${chapterLabel}整理回答…`);
   try{
     const response=await fetch('http://localhost:8787/api/companion/stream',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({prompt,config,summary:isSummary,maxTokens:isSummary?220:480})});
     if(!response.ok){let data={};try{data=await response.json()}catch{}throw new Error(typeof data?.error==='string'?data.error:data?.error?.message||`HTTP ${response.status}`)}
     if(!response.body)throw new Error('浏览器未提供流式响应读取能力');
     const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',answer='';
     function readEvent(event){const line=event.split(/\r?\n/).find(x=>x.startsWith('data:'));if(!line)return;const raw=line.slice(5).trim();if(raw==='[DONE]')return;const data=JSON.parse(raw);if(data.error)throw new Error(data.error);const part=data.choices?.[0]?.delta?.content||data.choices?.[0]?.message?.content||'';if(part){answer+=part;reply.textContent=answer;}}
     while(true){const {value,done}=await reader.read();buffer+=decoder.decode(value||new Uint8Array(),{stream:!done});const events=buffer.split(/\r?\n\r?\n/);buffer=events.pop()||'';for(const event of events)readEvent(event);if(done)break;}
     if(buffer.trim())readEvent(buffer);
     let cleaned=answer.replace(/^#{1,6}\s*/gm,'').replace(/\*\*(.*?)\*\*/g,'$1').replace(/\*(.*?)\*/g,'$1').trim();
     if(isSummary){
       cleaned=cleaned.replace(/(?:“[^”]*”|「[^」]*」|『[^』]*』)/g,'').replace(/对话(?:场景|总结|内容)[：:].*$/s,'');
       const sentences=cleaned.replace(/\s+/g,' ').split(/(?<=[。！？!?])/u).map(x=>x.trim()).filter(Boolean);
       const seen=new Set();cleaned=sentences.filter(x=>{const key=x.replace(/[，。！？；：\s]/g,'');if(seen.has(key))return false;seen.add(key);return true}).slice(0,3).join('');
     }
     const finalAnswer=cleaned||'当前章节没有可用的梗概内容。';show(finalAnswer);rememberTurn(question,finalAnswer,contextChapterIndex);
   }catch(error){show(`没能连接本地模型：${error instanceof Error?error.message:String(error)}。请确认 Ollama 和本地代理正在运行。`)}
 }
 pet.addEventListener('contextmenu',e=>{e.preventDefault();openAt(e.clientX,e.clientY)});
 document.getElementById('launcher').addEventListener('contextmenu',e=>{e.preventDefault();openAt(e.clientX,e.clientY)});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
 document.addEventListener('pointerdown',e=>{const target=e.target;if(floating.contains(target)||menu.contains(target))return;floating.classList.remove('open');close()},true);
 document.addEventListener('click',e=>{const quick=e.target.closest('[data-q]');if(!quick)return;e.preventDefault();e.stopImmediatePropagation();ask(quick.dataset.q,'chapter')},true);
 const form=document.getElementById('askForm');
 form.addEventListener('submit',e=>{e.preventDefault();e.stopImmediatePropagation();const input=document.getElementById('question');const q=input.value.trim();if(!q)return;input.value='';ask(q,'chapter')},true);
 menu.addEventListener('click',e=>{
   const button=e.target.closest('button[data-action]');if(!button)return;
   const action=button.dataset.action;const selected=window.getSelection()?.toString().trim()||'';close();
   if(action==='hide'){floating.classList.add('closed');document.getElementById('launcher').classList.add('show');return}
   if(action==='reset'){floating.style.left='';floating.style.top='';floating.style.right='18px';floating.style.bottom='16px';floating.style.position='';show('小阅回到右下角啦。');return}
   if(action==='note'){const text=(selected||story.innerText||'').trim().slice(0,500);if(!text){show('当前没有可记录的章节内容。');return}let notes=[];try{notes=JSON.parse(localStorage.getItem('xiaoyue-notes')||'[]')}catch{}notes.unshift({text,time:new Date().toLocaleString()});localStorage.setItem('xiaoyue-notes',JSON.stringify(notes.slice(0,100)));show('已将'+(selected?'选中内容':'本章开头')+'保存为本机阅读笔记。');return}
   if(action==='explain'){ask(selected?'请结合本章上下文解释读者选中的这段话':'请概括并解释当前章节的主要内容',selected?'local':'chapter');return}
   if(action==='chapter'){ask('请用3到5句话总结当前章节，说明主要事件、关键人物和仍未解开的线索。不要剧透。','chapter');return}
   if(action==='people'){ask('分析当前章节中的主要人物：他们各自做了什么、彼此是什么关系、此刻可能有什么想法。仅依据本章文本。','chapter');return}
   if(action==='clues'){ask('整理当前章节出现的重要线索和未解问题，用简短要点列出，并说明文本依据。','chapter')}
 });
 document.getElementById('launcher').addEventListener('contextmenu',e=>{e.preventDefault();openAt(e.clientX,e.clientY)});
})();






