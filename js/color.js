/* bead-website · 取色：笔刷选择 / 品牌色板 / 颜色数学 */
function initMardFullGrid(){
    var grid=document.getElementById('mardFullGrid');
    grid.innerHTML='';
    for(var i=0;i<MARD_COLORS.length;i++){
        var mc=MARD_COLORS[i];
        var item=document.createElement('div');
        item.className='mard-full-item';
        item.title=mc.id+' '+mc.name;
        item.innerHTML='<div class="mard-full-swatch" style="background:rgb('+mc.rgb.join(',')+')"></div><div class="mard-full-label">'+mc.id+'</div>';
        item.dataset.index=i;
        item.addEventListener('click',function(e){
            if(eyedropperActive){toggleEyedropper();return}
            var idx=parseInt(this.dataset.index);
            pickMardBrush(idx);
        });
        grid.appendChild(item);
    }
    // 默认选H19黑色
    var blackIdx=-1;
    for(var i=0;i<MARD_COLORS.length;i++){if(MARD_COLORS[i].id==='H19'){blackIdx=i;break;}}
    selectBrush(blackIdx>=0?blackIdx:0);
    _gridInit=true;
}
function pickMardBrush(mardIdx){
    selectBrush(mardIdx);
    // 颜色高亮激活时：点击色板即把高亮区域全部改成该色
    if(typeof highlightId!=='undefined' && highlightId!==null && highlightCells && highlightCells.length){
        recolorHighlight(MARD_COLORS[mardIdx].rgb);
    }
}
function selectBrush(idx){
    selectedBrushIsNull=false;
    selectedBrushColor=MARD_COLORS[idx].rgb.slice();
    selectedBrushId=MARD_COLORS[idx].id;
    document.getElementById('brushColorDisplay').textContent=MARD_COLORS[idx].id+' '+MARD_COLORS[idx].name;
    document.getElementById('mardCodeInput').value=MARD_COLORS[idx].id;
    document.querySelectorAll('.mard-full-item').forEach(function(c){c.classList.remove('active');});
    var items=document.getElementById('mardFullGrid').children;
    if(items[idx]){items[idx].classList.add('active');if(_gridInit)items[idx].scrollIntoView({block:'nearest'});}
    var nb=document.getElementById('nullBrushBtn');if(nb)nb.classList.remove('active');
    if(!suppressWandFill&&wandActive&&wandSelection)applyWandFill([selectedBrushColor[0],selectedBrushColor[1],selectedBrushColor[2],255]);
}
function selectNullBrush(){
    selectedBrushIsNull=true;
    selectedBrushId='NULL';
    document.getElementById('brushColorDisplay').textContent='镂空 NULL · 不填充';
    document.getElementById('mardCodeInput').value='NULL';
    document.querySelectorAll('.mard-full-item').forEach(function(c){c.classList.remove('active');});
    var nb=document.getElementById('nullBrushBtn');if(nb)nb.classList.add('active');
    if(!suppressWandFill&&wandActive&&wandSelection)applyWandFill([0,0,0,0]);
}
function setBrushByCode(){
    var code=document.getElementById('mardCodeInput').value.trim().toUpperCase();
    if(code==='NULL'){selectNullBrush();return;}
    for(var i=0;i<MARD_COLORS.length;i++){
        if(MARD_COLORS[i].id===code){selectBrush(i);return;}
    }
    alert('未找到色号: '+code);
}
function toggleEyedropper(){
    eyedropperActive=!eyedropperActive;
    var btn=document.getElementById('eyedropBtn');
    var canvas=document.getElementById('resultCanvas');
    if(eyedropperActive){btn.classList.add('active');btn.textContent=' 取色中...';canvas.classList.add('eyedrop-cursor');}
    else{btn.classList.remove('active');btn.textContent=' 取色管';canvas.classList.remove('eyedrop-cursor');}
}
function toggleColorCodes(){showCodes=document.getElementById('showColorCodes').checked;if(gridData)rerender();}
function rgb2lab(rgb){
    var r=rgb[0]/255,g=rgb[1]/255,b=rgb[2]/255;
    r=r>0.04045?Math.pow((r+0.055)/1.055,2.4):r/12.92;g=g>0.04045?Math.pow((g+0.055)/1.055,2.4):g/12.92;b=b>0.04045?Math.pow((b+0.055)/1.055,2.4):b/12.92;
    var x=(r*0.4124+g*0.3576+b*0.1805)/0.95047,y=(r*0.2126+g*0.7152+b*0.0722)/1.0,z=(r*0.0193+g*0.1192+b*0.9505)/1.08883;
    var fx=x>0.008856?Math.cbrt(x):(903.3*x+16)/116,fy=y>0.008856?Math.cbrt(y):(903.3*y+16)/116,fz=z>0.008856?Math.cbrt(z):(903.3*z+16)/116;
    return[116*fy-16,500*(fx-fy),200*(fy-fz)];
}
function weightedLabDist(rgb1,rgb2){
    var l1=rgb2lab(rgb1),l2=rgb2lab(rgb2);var dl=l1[0]-l2[0],da=l1[1]-l2[1],db=l1[2]-l2[2];
    return Math.sqrt(dl*dl+2.2*da*da+2.2*db*db);
}
function findMardId(rgb){
    var best=null,bd=Infinity;
    for(var j=0;j<MARD_COLORS.length;j++){var d=weightedLabDist(rgb,MARD_COLORS[j].rgb);if(d<bd){bd=d;best=MARD_COLORS[j];}}
    return best?best.id:'??';
}
/* PERLER_COLORS 已拆分至 js/data.js */


/* HAMA_COLORS 已拆分至 js/data.js */


/* ARTKAL_COLORS 已拆分至 js/data.js */

function nearestMardIndex(rgb){var best=0,bd=1e18;for(var j=0;j<MARD_COLORS.length;j++){var d=weightedLabDist(rgb,MARD_COLORS[j].rgb);if(d<bd){bd=d;best=j;}}return best;}

/* ---------- 2. 多品牌色板切换（仅切换取色色板，不改量化） ---------- */

/* BRAND_PALETTES 已拆分至 js/data.js */

function pickIds(ids){var out=[];for(var i=0;i<ids.length;i++){for(var j=0;j<MARD_COLORS.length;j++){if(MARD_COLORS[j].id===ids[i]){out.push(MARD_COLORS[j]);break;}}}return out;}
function rebuildSwatchGrid(colors){
    var grid=document.getElementById('mardFullGrid'); grid.innerHTML='';
    for(var i=0;i<colors.length;i++){
        var mc=colors[i];
        var item=document.createElement('div'); item.className='mard-full-item';
        item.title=mc.id+' '+mc.name;
        item.innerHTML='<div class="mard-full-swatch" style="background:rgb('+mc.rgb.join(',')+')"></div><div class="mard-full-label">'+mc.id+'</div>';
        var _mi=MARD_COLORS.indexOf(mc); if(_mi<0)_mi=nearestMardIndex(mc.rgb); item.dataset.mard=_mi; item.dataset.index=i;
        item.addEventListener('click',function(e){
            if(eyedropperActive){toggleEyedropper();return;}
            var mi=parseInt(this.dataset.mard);
            pickMardBrush(mi);
            document.querySelectorAll('.mard-full-item').forEach(function(c){c.classList.remove('active');});
            this.classList.add('active');
        });
        grid.appendChild(item);
    }
    var first=MARD_COLORS.indexOf(colors[0]); if(first<0)first=nearestMardIndex(colors[0].rgb);
    selectBrush(first);
    if(grid.children[0])grid.children[0].classList.add('active');
}
function applyBrand(key){ if(!BRAND_PALETTES[key])return; rebuildSwatchGrid(BRAND_PALETTES[key].colors); document.getElementById('pixelInfo').textContent=' 已切换色板：'+BRAND_PALETTES[key].name; }

