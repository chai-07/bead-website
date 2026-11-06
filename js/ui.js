/* bead-website · 抽屉交互 / 移动端 / 版本选择 / 增强组 */
/* ---------- 10. 移动端：双指缩放 ---------- */
(function(){
    var c=document.getElementById('resultCanvas'),pinchStart=0,zoomStart=1;
    function dist(t){return Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);}
    c.addEventListener('touchstart',function(e){if(!document.body.classList.contains('force-desktop'))return;if(e.touches.length===2){pinchStart=dist(e.touches);zoomStart=viewZoom;}},{passive:false});
    c.addEventListener('touchmove',function(e){if(!document.body.classList.contains('force-desktop'))return;if(e.touches.length===2){e.preventDefault();var d=dist(e.touches);viewZoom=Math.max(0.1,Math.min(8,zoomStart*d/pinchStart));applyZoom();}},{passive:false});
})();

/* ---------- 10b. 抽屉高度拖拽拉伸 ---------- */
(function(){
  function setupResize(panel, side){
    if(!panel)return;
    var grip=panel.querySelector('.sheet-grip');
    if(!grip)return;
    var startY=0,startH=0,drag=false;
    grip.addEventListener('pointerdown',function(e){
      if(document.body.classList.contains('force-desktop'))return;
      drag=true;startY=e.clientY;startH=panel.getBoundingClientRect().height;
      try{grip.setPointerCapture(e.pointerId);}catch(_){}
      e.preventDefault();
    });
    grip.addEventListener('pointermove',function(e){
      if(!drag)return;
      var dy=e.clientY-startY;
      var h=(side==='bottom')?(startH-dy):(startH+dy);
      var maxH=(side==='bottom')?(window.innerHeight-196):(window.innerHeight-120);
      h=Math.max(180,Math.min(maxH,h));
      panel.style.setProperty('height',h+'px','important');
      panel.style.setProperty('maxHeight',h+'px','important');
    });
    function end(e){drag=false;try{grip.releasePointerCapture(e.pointerId);}catch(_){}}
    grip.addEventListener('pointerup',end);
    grip.addEventListener('pointercancel',end);
  }
  setupResize(document.getElementById('control-panel'),'bottom');
  setupResize(document.getElementById('reviewPanel'),'top');
})();

/* ---------- 11. 事件绑定 ---------- */
document.getElementById('cropOpenBtn').addEventListener('click',openCrop);
document.getElementById('cropApplyBtn').addEventListener('click',applyCrop);
document.getElementById('cropRestoreBtn').addEventListener('click',restoreCrop);
document.getElementById('cleanSpecksBtn').addEventListener('click',cleanSpecks);
document.getElementById('speckSize').addEventListener('input',function(){document.getElementById('speckSizeValue').textContent=this.value;});
document.getElementById('symMode').addEventListener('change',function(){symmetryMode=this.value;document.getElementById('pixelInfo').textContent='对称模式：'+this.value;});
document.getElementById('brandSel').addEventListener('change',function(){applyBrand(this.value);});
//document.getElementById('openReview').addEventListener('click',openReview);
document.getElementById('closeReview')&&document.getElementById('closeReview').addEventListener('click',closeReview);
//document.getElementById('openSettings').addEventListener('click',openSettings);
document.getElementById('scrim').addEventListener('click',closeSheet);

console.log('✅ MARD 195色完整版就绪 by 三金超人_SuperTrigen');
// 进入页面时左栏（及色板子区域）滚动到最顶
if('scrollRestoration' in history)history.scrollRestoration='manual';
function resetLeftScroll(){var cp=document.getElementById('control-panel'); if(cp)cp.scrollTop=0; var gf=document.getElementById('mardFullGrid'); if(gf)gf.scrollTop=0;}
resetLeftScroll();
setTimeout(resetLeftScroll,0);
window.addEventListener('load',resetLeftScroll);
updateUndoButtons();

/* ===== 版本选择：电脑版 / 手机版 ===== */
var LAYOUT_MODE='auto';
function isMobileLayout(){
  if(LAYOUT_MODE==='mobile')return true;
  if(LAYOUT_MODE==='desktop')return false;
  return window.innerWidth<1200;
}
function applyVersion(mode){
  if(mode!=='desktop'&&mode!=='mobile'){ mode=(window.innerWidth<1200)?'mobile':'desktop'; }
  LAYOUT_MODE=mode;
  document.body.classList.toggle('force-desktop',LAYOUT_MODE==='desktop');
  document.body.classList.toggle('layout-mobile',LAYOUT_MODE==='mobile');
  document.body.classList.remove('mb-hidden');
  closeAll();
  var cp=document.getElementById('control-panel');
  if(cp)cp.querySelectorAll('[data-grp]').forEach(function(g){g.style.display='';});
  try{ if(typeof fitZoom==='function')fitZoom(); }catch(e){}
}
/* 增强组：移动端点按钮 → 对应滑块行进入上一级联条；再点收起（节点移动逻辑见下方移动端交互） */
(function(){
  document.addEventListener('click',function(e){
    if(document.body.classList.contains('force-desktop'))return;
    var btn=e.target.closest('.enh-btn');
    if(!btn)return;
    var id=btn.getAttribute('data-target');
    if(btn.classList.contains('active')){
      var row=document.querySelector('.enh-row[data-row="'+id+'"]');
      if(row)restoreNode(row);
      btn.classList.remove('active');
      var lvl2=document.querySelector('#cascade .cascade-bar.level2');
      if(lvl2 && !lvl2.hasChildNodes()){ lvl2.parentNode.removeChild(lvl2); }
    } else {
      openSlider(id);
    }
  });
})();
function openSheet(name, grp){
  closeSheet();
  if(name==='settings'){
    var cp=document.getElementById('control-panel');
    cp.classList.add('open');
    cp.style.height='';cp.style.maxHeight='';
    cp.querySelectorAll('[data-grp]').forEach(function(g){ g.style.display = (!grp || g.getAttribute('data-grp')===grp) ? '' : 'none'; });
  }
  else if(name==='review'){var rp=document.getElementById('reviewPanel');rp.classList.add('open');rp.style.height='';rp.style.maxHeight='';try{if(typeof buildReview==='function')buildReview();}catch(e){}}
  document.getElementById('scrim').classList.add('show');
  var mb=document.getElementById('mobileBar');
  if(mb)mb.querySelectorAll('.mbtn').forEach(function(b){b.classList.toggle('active', grp && b.dataset.grp===grp);});
  var mt=document.getElementById('mobileTop');
  if(mt){var ma={draft:'mtDraft',export:'mtExport'};mt.querySelectorAll('.mt-btn').forEach(function(b){b.classList.toggle('active', !!(ma[grp]&&b.id===ma[grp]));});}
}
function openSettings(){openSheet('settings');}
function openReview(){
  if(document.body.classList.contains('force-desktop')){ openSheet('review'); return; }
  var rp=document.getElementById('reviewPanel');
  if(rp&&rp.classList.contains('open')){ closeReview(); }
  else { openSheet('review'); }
}
function closeSheet(){closeAll();var cp=document.getElementById('control-panel');if(cp){cp.querySelectorAll('[data-grp]').forEach(function(g){g.style.display='';});cp.style.height='';cp.style.maxHeight='';}var rp=document.getElementById('reviewPanel');if(rp){rp.style.height='';rp.style.maxHeight='';}var mb=document.getElementById('mobileBar');if(mb)mb.querySelectorAll('.mbtn').forEach(function(b){b.classList.remove('active');});var mt=document.getElementById('mobileTop');if(mt)mt.querySelectorAll('.mt-btn').forEach(function(b){b.classList.remove('active');});}
/* 移动端：显示色号开关（点一下开 / 再点关，不用下拉） */
function mtToggleCode(btn){
  var cb=document.getElementById('showColorCodes');
  if(!cb)return;
  cb.checked=!cb.checked;
  if(typeof toggleColorCodes==='function')toggleColorCodes();
  if(btn)btn.classList.toggle('active', cb.checked);
}
function syncCodeBtn(){
  var cb=document.getElementById('showColorCodes'); var b=document.getElementById('mtCode');
  if(cb&&b)b.classList.toggle('active', cb.checked);
}
/* 移动端：网格显示改为 radio；保留隐藏 select 以兼容 rerender/draft/export 对 #showGrid.value 的读取 */
function setGrid(v){
  var s=document.getElementById('showGrid');
  if(s){ s.value=v; if(typeof gridData!=='undefined'&&gridData)rerender(); }
  var rs=document.querySelectorAll('input[name="showGrid"]');
  for(var i=0;i<rs.length;i++){ rs[i].checked=(rs[i].value===v); }
}
function syncGridRadio(){
  var s=document.getElementById('showGrid'); if(!s)return;
  var rs=document.querySelectorAll('input[name="showGrid"]');
  for(var i=0;i<rs.length;i++){ rs[i].checked=(rs[i].value===s.value); }
}
/* 应用页启动：根据 ?mode=desktop|mobile 固定布局（缺省按屏宽） */
(function(){
  var m=new URLSearchParams(location.search).get('mode');
  applyVersion(m==='desktop'||m==='mobile'?m:'auto');
})();
/* ===== 移动端新版交互：顶部下拉 + 底部级联菜单 + 右侧竖排工具 ===== */
var MB_moved=[];
function MB_origin(node){ for(var i=0;i<MB_moved.length;i++){ if(MB_moved[i].node===node) return MB_moved[i]; } return null; }
function MB_mount(node, container){
  if(!node||!container)return;
  var rec=MB_origin(node);
  if(!rec){ rec={node:node, parent:node.parentNode, next:node.nextSibling}; MB_moved.push(rec); }
  container.appendChild(node);
}
function restoreNode(node){
  var rec=MB_origin(node);
  if(rec){ try{ rec.parent.insertBefore(node, rec.next); }catch(e){ if(rec.parent) rec.parent.appendChild(node); } node.style.display=''; MB_moved=MB_moved.filter(function(m){return m.node!==node;}); }
}
function MB_closeAllMenus(){
  MB_moved.slice().forEach(function(m){ try{ m.parent.insertBefore(m.node, m.next); }catch(e){ if(m.parent) m.parent.appendChild(m.node); } m.node.style.display=''; });
  MB_moved=[];
  var cascade=document.getElementById('cascade'); if(cascade){ cascade.innerHTML=''; cascade.classList.remove('open'); }
  document.querySelectorAll('.mt-drop.open').forEach(function(d){ d.classList.remove('open'); });
  var mb=document.getElementById('mobileBar'); if(mb)mb.querySelectorAll('.mbtn').forEach(function(b){ b.classList.remove('active'); });
}
function openCategory(grp){
  if(document.body.classList.contains('force-desktop'))return;
  MB_closeAllMenus();
  var group=document.querySelector('[data-grp="'+grp+'"]');
  if(!group)return;
  var cascade=document.getElementById('cascade'); if(!cascade)return;
  var lvl1=document.createElement('div'); lvl1.className='cascade-bar level1'; cascade.appendChild(lvl1);
  if(grp==='enhance'){
    var btns=group.querySelector('.enh-btns'); var reset=group.querySelector('.btn-reset');
    if(btns)MB_mount(btns, lvl1);
    if(reset)MB_mount(reset, lvl1);
  } else {
    MB_mount(group, lvl1);
  }
  cascade.classList.add('open');
  var mb=document.getElementById('mobileBar'); if(mb)mb.querySelectorAll('.mbtn').forEach(function(b){ b.classList.toggle('active', b.dataset.grp===grp); });
}
function openSlider(rowId){
  if(document.body.classList.contains('force-desktop'))return;
  var row=document.querySelector('.enh-row[data-row="'+rowId+'"]');
  if(!row)return;
  var cascade=document.getElementById('cascade'); if(!cascade)return;
  var old=cascade.querySelector('.cascade-bar.level2 .enh-row'); if(old)restoreNode(old);
  var lvl2=cascade.querySelector('.cascade-bar.level2');
  if(!lvl2){ lvl2=document.createElement('div'); lvl2.className='cascade-bar level2'; cascade.insertBefore(lvl2, cascade.firstChild); }
  MB_mount(row, lvl2);
  row.style.display='block';
  cascade.classList.add('open');
  cascade.querySelectorAll('.enh-btn').forEach(function(b){ b.classList.toggle('active', b.getAttribute('data-target')===rowId); });
}
(function(){
  var isMb=function(){ return !document.body.classList.contains('force-desktop'); };
  // 底部功能分类：点击 → 上方生成级联条（单一项直接显示；增强类先出按钮再出滑块）
  var mb=document.getElementById('mobileBar');
  if(mb)mb.querySelectorAll('.mbtn').forEach(function(b){
    b.addEventListener('click',function(){
      if(!isMb())return;
      var g=b.dataset.grp;
      if(g && b.classList.contains('active')){ MB_closeAllMenus(); }
      else { openCategory(g); }
    });
  });
  // 顶部下拉：点击展开对应分组，再次点击或点击别处收起
  var mobileTop=document.getElementById('mobileTop');
  var ddId={grid:'dd-grid', draft:'dd-draft', export:'dd-export'};
  if(mobileTop)mobileTop.querySelectorAll('.mt-btn[data-dd]').forEach(function(btn){
    btn.addEventListener('click',function(e){
      if(!isMb())return;
      e.stopPropagation();
      var grp=btn.getAttribute('data-dd');
      var dd=document.getElementById(ddId[grp]);
      var willOpen=!(dd&&dd.classList.contains('open'));
      MB_closeAllMenus();
      if(willOpen && dd){
        var group=document.querySelector('[data-grp="'+grp+'"]');
        if(group){ MB_mount(group, dd); dd.classList.add('open');
          var r=btn.getBoundingClientRect();
          var dw=dd.offsetWidth, vw=window.innerWidth;
          var left=r.left;
          if(left+dw > vw-6) left=Math.max(6, vw-dw-6);
          dd.style.top=(r.bottom+4)+'px';
          dd.style.left=left+'px';
          dd.style.right='auto';
        }
      }
    });
  });
  // 点击空白处收起所有菜单（下拉 + 级联）
  document.addEventListener('click',function(e){
    if(!isMb())return;
    var t=e.target;
    if(t.closest('#mobileTop')||t.closest('#cascade')||t.closest('#mobileBar')||t.closest('#rightTools')||t.closest('#reviewPanel'))return;
    MB_closeAllMenus();
    if(typeof closeReview==='function')closeReview();
  });
  // 同步显示色号 / 网格 radio 的初始与变更状态
  var cb=document.getElementById('showColorCodes'); if(cb)cb.addEventListener('change', syncCodeBtn);
  syncCodeBtn(); syncGridRadio();
  var sg=document.getElementById('showGrid'); if(sg)sg.addEventListener('change', syncGridRadio);
})();