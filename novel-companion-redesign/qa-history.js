(() => {
  const bubble=document.getElementById('bubble');
  const actions=bubble.querySelector('.bubble-actions');
  const form=bubble.querySelector('.bubble-input');
  const button=document.createElement('button');button.type='button';button.className='history-toggle';button.textContent='问答记录';actions.appendChild(button);
  const panel=document.createElement('div');panel.className='question-history';panel.hidden=true;form.before(panel);
  const key='xiaoyue-qa-history';
  function readRows(){try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return []}}
  function render(){
    panel.replaceChildren();
    const rows=readRows();
    if(!rows.length){const p=document.createElement('p');p.className='history-empty';p.textContent='\u6682\u65e0\u95ee\u7b54\u8bb0\u5f55';panel.appendChild(p);return}
    for(const row of rows){
      const item=document.createElement('article');item.className='history-item';
      const meta=document.createElement('div');meta.className='history-meta';meta.textContent=`${row.chapter} · ${row.time}`;
      const details=document.createElement('details');details.className='history-entry';
      const summary=document.createElement('summary');summary.className='history-question';summary.textContent=row.question||'\u672a\u8bb0\u5f55\u95ee\u9898';
      const answer=document.createElement('p');answer.className='history-answer';answer.textContent=row.answer||'\u56de\u7b54\u751f\u6210\u4e2d\u2026';
      details.append(summary,answer);item.append(meta,details);panel.appendChild(item);
    }
  }
  button.addEventListener('click',()=>{panel.hidden=!panel.hidden;if(!panel.hidden)render()});
  window.addEventListener('xiaoyue:qa-saved',()=>{if(!panel.hidden)render()});
  const originalFetch=window.fetch.bind(window);
  window.fetch=async(input,init={})=>{
    const url=typeof input==='string'?input:input.url;
    if(!url.includes('/api/companion/stream'))return originalFetch(input,init);
    let payload={};try{payload=JSON.parse(init.body||'{}')}catch{}
    const prompt=payload.prompt||'';const question=(prompt.split('当前任务：')[1]||'小说问题').split('\n')[0];
    const chapter=(prompt.match(/\n\n(.+?)全文：/)||[])[1]||'当前章节';
    const row={question,chapter,time:new Date().toLocaleString(),answer:''};
    const response=await originalFetch(input,init);
    if(!response.ok){row.answer=`请求失败（HTTP ${response.status}）`;const copy=response.clone();try{const data=await copy.json();row.answer=data?.error?.message||data?.error||row.answer}catch{};const rows=readRows();rows.unshift(row);localStorage.setItem(key,JSON.stringify(rows.slice(0,50)));if(!panel.hidden)render();return response}
    const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
    const stream=new ReadableStream({async pull(controller){try{const {value,done}=await reader.read();if(done){buffer+=decoder.decode();collect(buffer,true);const rows=readRows();rows.unshift(row);localStorage.setItem(key,JSON.stringify(rows.slice(0,50)));if(!panel.hidden)render();controller.close();return}buffer+=decoder.decode(value,{stream:true});const parts=buffer.split(/\r?\n\r?\n/);buffer=parts.pop()||'';collect(parts.join('\n\n'),false);controller.enqueue(value)}catch(error){controller.error(error)}},cancel(reason){return reader.cancel(reason)}});
    function collect(data,final){const events=data.split(/\r?\n\r?\n/);for(const event of events){const line=event.split(/\r?\n/).find(x=>x.startsWith('data:'));if(!line)continue;const raw=line.slice(5).trim();if(raw==='[DONE]')continue;try{const packet=JSON.parse(raw);row.answer+=packet.choices?.[0]?.delta?.content||''}catch{}}if(final&&panel&&!panel.hidden)render()}
    return new Response(stream,{status:response.status,statusText:response.statusText,headers:response.headers});
  };
})();

