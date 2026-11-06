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
/* 增强组：点按钮展开对应滑块（移动端生效，桌面端直接显示滑块） */
(function(){
  var cp=document.getElementById('control-panel');
  if(!cp)return;
  cp.addEventListener('click',function(e){
    var btn=e.target.closest('.enh-btn');
    if(!btn||!cp.contains(btn))return;
    var id=btn.getAttribute('data-target');
    var row=cp.querySelector('.enh-row[data-row="'+id+'"]');
    if(!row)return;
    var willOpen=(row.style.display!=='block');
    row.style.display=willOpen?'block':'none';
    btn.classList.toggle('active',willOpen);
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
function openReview(){openSheet('review');}
function closeSheet(){closeAll();var cp=document.getElementById('control-panel');if(cp){cp.querySelectorAll('[data-grp]').forEach(function(g){g.style.display='';});cp.style.height='';cp.style.maxHeight='';}var rp=document.getElementById('reviewPanel');if(rp){rp.style.height='';rp.style.maxHeight='';}var mb=document.getElementById('mobileBar');if(mb)mb.querySelectorAll('.mbtn').forEach(function(b){b.classList.remove('active');});var mt=document.getElementById('mobileTop');if(mt)mt.querySelectorAll('.mt-btn').forEach(function(b){b.classList.remove('active');});}
/* 应用页启动：根据 ?mode=desktop|mobile 固定布局（缺省按屏宽） */
(function(){
  var m=new URLSearchParams(location.search).get('mode');
  applyVersion(m==='desktop'||m==='mobile'?m:'auto');
})();
/* 移动端交互绑定（底部工具栏 / 顶部栏 / 切换版本） */
(function(){
  // 底部功能分类 tab：点开对应分组参数（从底部弹出）
  var mb=document.getElementById('mobileBar');
  if(mb)mb.querySelectorAll('.mbtn').forEach(function(b){
    b.addEventListener('click',function(){
      var g=b.dataset.grp;
      var cp=document.getElementById('control-panel');
      if(g && cp.classList.contains('open') && b.classList.contains('active')){ closeSheet(); }
      else { openSheet('settings', g); }
    });
  });
  // 顶部栏：网格 / 色号 / 评审 / 草稿 / 导出
  var mtGrid=document.getElementById('mtGrid'), mtCode=document.getElementById('mtCode'), mtReview=document.getElementById('mtReview'), mtDraft=document.getElementById('mtDraft'), mtExport=document.getElementById('mtExport');
  function syncTopToggles(){
    if(mtGrid)mtGrid.classList.toggle('active', document.getElementById('showGrid').value==='yes');
    if(mtCode)mtCode.classList.toggle('active', document.getElementById('showColorCodes').checked);
  }
  if(mtGrid)mtGrid.addEventListener('click',function(){
    var sg=document.getElementById('showGrid');
    sg.value=(sg.value==='yes')?'no':'yes';
    if(sg.dispatchEvent)sg.dispatchEvent(new Event('change'));
    syncTopToggles();
  });
  if(mtCode)mtCode.addEventListener('click',function(){
    var sc=document.getElementById('showColorCodes');
    sc.checked=!sc.checked;
    if(typeof toggleColorCodes==='function')toggleColorCodes();
    syncTopToggles();
  });
  if(mtReview)mtReview.addEventListener('click',function(){
    var rp=document.getElementById('reviewPanel');
    if(rp.classList.contains('open'))closeSheet(); else openSheet('review');
  });
  if(mtDraft)mtDraft.addEventListener('click',function(){var cp=document.getElementById('control-panel');if(cp.classList.contains('open')&&mtDraft.classList.contains('active')){closeSheet();}else{openSheet('settings','draft');}});
  if(mtExport)mtExport.addEventListener('click',function(){var cp=document.getElementById('control-panel');if(cp.classList.contains('open')&&mtExport.classList.contains('active')){closeSheet();}else{openSheet('settings','export');}});
  syncTopToggles();
  var sb=document.getElementById('switchVersionBtn');
  if(sb)sb.addEventListener('click',function(){location.href='index.html';});
})();