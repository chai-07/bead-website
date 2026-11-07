/* bead-website · 画布渲染 + 工具函数（图像处理/绘制/缩放/画笔/裁剪/浮窗/杂点/挂件/高亮/撤销） */

// MARD官方195色完整色谱

/* MARD_COLORS 已拆分至 js/data.js */


var originalImage=null,gridW=0,gridH=0,gridData=null,displayScale=30,editMask=null,pendingReapply=null,_gridInit=false;
var currentViewRect=null; // 当前原图在原图(原始未裁)像素坐标系中的可视区域，用于裁剪时映射笔刷点坐标
var exportCounter=0; // 未填命名时自动编号：随机命名1、随机命名2…
var undoStack=[],redoStack=[],colorPalette=[],showCodes=false;
var selectedBrushColor=[0,0,0],selectedBrushId='H19',selectedBrushIsNull=false,eyedropperActive=false,suppressWandFill=false;
var processTimer=null;
var wandActive=false,wandSelection=null,viewZoom=1,lastFitGs=-1;
var riskResultCache=null,reviewTab="overview",selectedRiskIndex=-1,showRiskOverlay=false;
var fixParams={thinExpandSize:1,bridgeMaxDist:2,speckThreshold:2,chessAggress:1};

function bind(id,disp,fmt){
    var el=document.getElementById(id);
    if(!el)return;
    el.addEventListener('input',function(){
        document.getElementById(disp).textContent=fmt?fmt(this.value):this.value;
        requestProcess();
    });
}
bind('darkUnify','darkUnifyValue');bind('blackThreshold','blackValue');
bind('gamma','gammaValue',function(v){return(v/100).toFixed(2);});bind('saturation','satValue',function(v){return v+'%';});
bind('contrast','contrastValue',function(v){return v+'%';});bind('brightness','brightValue');
bind('sharpen','sharpValue');bind('denoise','denoiseValue');bind('maxColors','colorCountValue');bind('mergeSimilar','mergeSimilarValue');
document.getElementById('brushSize').addEventListener('input',function(){document.getElementById('brushSizeValue').textContent=this.value;});
document.getElementById('templateScale').addEventListener('input',function(){document.getElementById('templateScaleValue').textContent=(Math.round(this.value*100))+'%';var tn=document.getElementById('templateSel').value;if(tn!=='none')applyTemplate(tn,true);});
document.getElementById('templateSel').addEventListener('change',function(){var tn=this.value;document.getElementById('templateScaleRow').style.display=(tn==='none'?'none':'');applyTemplate(tn,false);});

initMardFullGrid();

function resetParams(){
    setSlider('darkUnify',0,'darkUnifyValue');setSlider('blackThreshold',0,'blackValue');
    setSlider('gamma',100,'gammaValue',function(v){return(v/100).toFixed(2);});
    setSlider('saturation',100,'satValue',function(v){return v+'%';});
    setSlider('contrast',100,'contrastValue',function(v){return v+'%';});
    setSlider('brightness',0,'brightValue');setSlider('sharpen',0,'sharpValue');
    setSlider('denoise',0,'denoiseValue');setSlider('maxColors',48,'colorCountValue');setSlider('mergeSimilar',0,'mergeSimilarValue');
    requestProcess();
}
function setSlider(id,val,disp,fmt){var el=document.getElementById(id);if(el)el.value=val;document.getElementById(disp).textContent=fmt?fmt(val):val;}

document.getElementById('fileInput').addEventListener('change',function(e){
    var f=e.target.files[0];if(!f)return;
    if(!f.type.startsWith('image/')){alert('请上传图片');return}
    document.getElementById('fileInfo').textContent=' '+f.name;
    var r=new FileReader();
    r.onload=function(ev){
        var img=new Image();
        img.onload=function(){resetTemplateUI();originalImage=img;rawOriginalImage=null;cropState=null;currentViewRect={x:0,y:0,w:img.naturalWidth,h:img.naturalHeight};document.getElementById('originalImage').src=ev.target.result;document.getElementById('originalImage').style.display='block';setFloatVisible(true);requestProcess()};
        img.src=ev.target.result;
    };
    r.readAsDataURL(f);
});

document.getElementById('canvasSize').addEventListener('change',function(){
    var v=document.getElementById('canvasSize').value;
    document.getElementById('customSizeRow').style.display=(v==='custom')?'block':'none';
    // 切到自定义时不立即生成，等点「确认」再处理（空内容会直接跳过）
    requestProcess();
});
// 自定义尺寸：仅在点「确认」或按回车时生成，避免输入过程中反复重绘
document.getElementById('customSizeConfirm').addEventListener('click',function(){
    if(document.getElementById('canvasSize').value!=='custom')return;
    requestProcess();
});
document.getElementById('customSize').addEventListener('keydown',function(e){if(e.key==='Enter')document.getElementById('customSizeConfirm').click();});
document.getElementById('showGrid').addEventListener('change',function(){if(gridData)rerender()});
document.getElementById('gridColor').addEventListener('input',function(){if(gridData)rerender()});

function makeEditMask(w,h){var m=[];for(var y=0;y<h;y++){var row=[];for(var x=0;x<w;x++)row.push(false);m.push(row);}return m;}
function captureBrushEdits(){
    if(!gridData||!editMask)return null;
    var edits=[];
    for(var y=0;y<gridData.length;y++)for(var x=0;x<gridData[y].length;x++){
        if(editMask[y][x])edits.push({x:x,y:y,c:[gridData[y][x][0],gridData[y][x][1],gridData[y][x][2],gridData[y][x][3]]});
    }
    return edits.length?edits:null;
}
function applyBrushEdits(edits){
    if(!gridData||!edits)return;
    var gw=gridData[0].length,gh=gridData.length;
    for(var i=0;i<edits.length;i++){var e=edits[i];
        if(e.x>=0&&e.x<gw&&e.y>=0&&e.y<gh){gridData[e.y][e.x]=[e.c[0],e.c[1],e.c[2],e.c[3]]; if(editMask)editMask[e.y][e.x]=true;}
    }
}
// 把笔刷点从「当前可视区域」坐标映射到「新可视区域」坐标，使笔刷点跟随裁剪走（成为图纸一部分）
function transformEdits(fx,fy,fw,fh, tx,ty,tw,th, edits){
    if(!edits)return null;
    var out=[];
    for(var i=0;i<edits.length;i++){
        var e=edits[i];
        var rx=fx+(e.x+0.5)/gridW*fw, ry=fy+(e.y+0.5)/gridH*fh; // 落到原图(原始未裁)像素
        var nx=Math.round((rx-tx)/tw*gridW-0.5), ny=Math.round((ry-ty)/th*gridH-0.5);
        if(nx>=0&&nx<gridW&&ny>=0&&ny<gridH)out.push({x:nx,y:ny,c:e.c});
    }
    return out.length?out:null;
}
function requestProcess(){
    if(!originalImage)return;
    clearTimeout(processTimer);
    processTimer=setTimeout(processImage,180);
}

function processImage(){
    if(!originalImage)return;
    try{
        var du=parseInt(document.getElementById('darkUnify').value);
        var sizeSel=document.getElementById('canvasSize').value;
        var gw,gh;
        if(sizeSel==='custom'){
            var cv=document.getElementById('customSize').value.trim();
            if(cv==='')return;
            var mm=cv.match(/^(\d{1,3})\s*[xX×]\s*(\d{1,3})$/);
            if(!mm){alert('请输入自定义尺寸，格式如 35x35（宽x高，范围5~150）');return;}
            gw=parseInt(mm[1]);gh=parseInt(mm[2]);
            if(gw<5||gw>150||gh<5||gh>150){alert('自定义尺寸需在 5~150 之间');return;}
        }else{
            gw=gh=parseInt(sizeSel);
        }
        if(!(gw>0&&gh>0))return;
        var bt=parseInt(document.getElementById('blackThreshold').value);
        var gm=parseInt(document.getElementById('gamma').value)/100;
        var sat=parseInt(document.getElementById('saturation').value)/100;
        var con=parseInt(document.getElementById('contrast').value);
        var bri=parseInt(document.getElementById('brightness').value);
        var shp=parseInt(document.getElementById('sharpen').value);
        var den=parseInt(document.getElementById('denoise').value);
        var mc=parseInt(document.getElementById('maxColors').value);
        var ms=parseInt(document.getElementById('mergeSimilar').value);
        var mergeThreshold=ms*0.42;
        var enhanced=applyEnhanceOnOriginal(originalImage,du,bt,gm,sat,con,bri,shp,den);
        var scaled=nearestNeighborScale(enhanced,gw,gh);
        var result=mardQuantize(scaled,mc,mergeThreshold);
        var quantized=result.canvas;
        colorPalette=result.palette;
        quantized=lineRepair(quantized,gw,gh);
        gridW=gw;gridH=gh;
        gridData=getGridData(quantized,gw,gh);
        editMask=makeEditMask(gw,gh);
        if(pendingReapply){applyBrushEdits(pendingReapply);pendingReapply=null;}
        undoStack=[];redoStack=[];wandSelection=null;templateBase=null;
        rerender();
        if(gridW!==lastFitGs){fitZoom();lastFitGs=gridW;}
        document.getElementById('downloadBtn').disabled=false;
        document.getElementById('downloadCodeBtn').disabled=false;
        document.getElementById('colorPdfBtn').disabled=false;
        document.getElementById('csvBtn').disabled=false;
        document.getElementById('packageBtn').disabled=false;
    }catch(e){console.error(e);templateBase=null;alert('处理失败: '+e.message);}
}

function mardQuantize(sc, maxColors, mergeThreshold){
    var c=document.createElement('canvas'),ctx=c.getContext('2d');
    c.width=sc.width;c.height=sc.height;ctx.drawImage(sc,0,0);
    var id=ctx.getImageData(0,0,c.width,c.height),p=id.data;
    var freq={};
    for(var i=0;i<p.length;i+=4){
        if(p[i+3]<128)continue;
        var best=0,bd=Infinity;
        for(var j=0;j<MARD_COLORS.length;j++){var d=weightedLabDist([p[i],p[i+1],p[i+2]],MARD_COLORS[j].rgb);if(d<bd){bd=d;best=j;}}
        freq[best]=(freq[best]||0)+1;
    }
    var sorted=Object.entries(freq).sort(function(a,b){return b[1]-a[1];});
    var limited=sorted.slice(0,Math.min(maxColors,sorted.length)).map(function(e){return parseInt(e[0]);});
    // 合并相似颜色：把 Lab 距离 ≤ 阈值的色卡并入同一簇，取出现最多的色卡作代表
    var remap={};
    if(mergeThreshold>0 && limited.length>1){
        var parent=[];for(var i=0;i<limited.length;i++)parent[i]=i;
        function find(a){while(parent[a]!==a){parent[a]=parent[parent[a]];a=parent[a];}return a;}
        function union(a,b){parent[find(a)]=find(b);}
        for(var i=0;i<limited.length;i++){for(var j=i+1;j<limited.length;j++){
            var d=weightedLabDist(MARD_COLORS[limited[i]].rgb,MARD_COLORS[limited[j]].rgb);
            if(d<=mergeThreshold)union(i,j);
        }}
        var rep={};
        for(var i=0;i<limited.length;i++){var r=find(i);var f=freq[limited[i]]||0;if(!rep[r]||f>(rep[r].cnt))rep[r]={idx:limited[i],cnt:f};}
        for(var i=0;i<limited.length;i++){remap[limited[i]]=rep[find(i)].idx;}
    }else{
        for(var i=0;i<limited.length;i++)remap[limited[i]]=limited[i];
    }
    for(var i=0;i<p.length;i+=4){
        if(p[i+3]<128)continue;
        var best=0,bd=Infinity;
        for(var j=0;j<limited.length;j++){
            var d=weightedLabDist([p[i],p[i+1],p[i+2]],MARD_COLORS[limited[j]].rgb);
            if(d<bd){bd=d;best=limited[j];}
        }
        best=remap[best];
        p[i]=MARD_COLORS[best].rgb[0];p[i+1]=MARD_COLORS[best].rgb[1];p[i+2]=MARD_COLORS[best].rgb[2];
    }
    ctx.putImageData(id,0,0);
    var paletteRgb=[],seen={};
    for(var i=0;i<limited.length;i++){var ri=remap[limited[i]];if(!seen[ri]){seen[ri]=1;paletteRgb.push(MARD_COLORS[ri].rgb);}}
    return{canvas:c,palette:paletteRgb};
}

function applyEnhanceOnOriginal(img,du,bt,gm,sat,con,bri,shp,den){
    var c=document.createElement('canvas'),ctx=c.getContext('2d');
    c.width=img.width;c.height=img.height;ctx.drawImage(img,0,0);
    if(den>0){c=denoise(c,den);ctx=c.getContext('2d')}
    var id=ctx.getImageData(0,0,c.width,c.height),p=id.data;
    var satEff=1+(sat-1)*0.6;            // 饱和度：100为中性，两端各缩放0.6倍 → 变化更细腻
    var conC=(con-100)*1;                // 对比度：原公式里100并非中性，这里以100为中性(=0)修正
    var conF=(259*(conC+255))/(255*(259-conC));
    for(var i=0;i<p.length;i+=4){
        var r=p[i],g=p[i+1],b=p[i+2];if(p[i+3]<128)continue;
        if(du>0){var lum=0.299*r+0.587*g+0.114*b;if(lum<du){p[i]=0;p[i+1]=0;p[i+2]=0;continue}}
        var rf=r/255,gf=g/255,bf=b/255;
        if(bt>0){var t=bt/120;rf=blackLift(rf,t);gf=blackLift(gf,t);bf=blackLift(bf,t)}
        if(gm!==1){rf=Math.pow(rf,1/gm);gf=Math.pow(gf,1/gm);bf=Math.pow(bf,1/gm)}
        if(satEff!==1){var gy=0.299*rf+0.587*gf+0.114*bf;rf=c01(gy+satEff*(rf-gy));gf=c01(gy+satEff*(gf-gy));bf=c01(gy+satEff*(bf-gy))}
        if(conC!==0){rf=c01(conF*(rf-0.5)+0.5);gf=c01(conF*(gf-0.5)+0.5);bf=c01(conF*(bf-0.5)+0.5)}
        if(bri!==0){var bv=bri/100;rf=c01(rf+bv);gf=c01(gf+bv);bf=c01(bf+bv)}
        p[i]=Math.round(c01(rf)*255);p[i+1]=Math.round(c01(gf)*255);p[i+2]=Math.round(c01(bf)*255);
    }
    ctx.putImageData(id,0,0);if(shp!==0)c=sharpen(c,shp);return c;
}
function blackLift(v,t){return v<t?v*v/t:(v-t)/(1-t)}
function c01(v){return Math.max(0,Math.min(1,v))}
function nearestNeighborScale(sc,tw,th){
    // 等比缩放放进底板：不裁剪、不变形，完整居中放入(长边贴边)，四周留空(透明=不填充)
    var c=document.createElement('canvas'),ctx=c.getContext('2d');
    c.width=tw;c.height=th;
    var scale=Math.min(tw/sc.width,th/sc.height);
    var dw=Math.max(1,Math.round(sc.width*scale)),dh=Math.max(1,Math.round(sc.height*scale));
    var ox=Math.floor((tw-dw)/2),oy=Math.floor((th-dh)/2);
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(sc,0,0,sc.width,sc.height,ox,oy,dw,dh);return c;
}
function denoise(sc,str){
    var c=document.createElement('canvas'),ctx=c.getContext('2d');c.width=sc.width;c.height=sc.height;ctx.drawImage(sc,0,0);
    var id=ctx.getImageData(0,0,c.width,c.height),w=c.width,h=c.height,src=id.data,dst=new Uint8ClampedArray(src),r=Math.min(Math.ceil(str/2),2);
    for(var y=r;y<h-r;y++)for(var x=r;x<w-r;x++)for(var ch=0;ch<3;ch++){
        var vals=[];for(var dy=-r;dy<=r;dy++)for(var dx=-r;dx<=r;dx++)vals.push(src[((y+dy)*w+(x+dx))*4+ch]);
        vals.sort(function(a,b){return a-b});dst[(y*w+x)*4+ch]=vals[Math.floor(vals.length/2)];
    }
    for(var i=0;i<src.length;i++)src[i]=dst[i];ctx.putImageData(id,0,0);return c;
}
function sharpen(sc,str){
    if(str===0)return sc;
    if(str>0){
        var c=document.createElement('canvas'),ctx=c.getContext('2d');c.width=sc.width;c.height=sc.height;ctx.drawImage(sc,0,0);
        var id=ctx.getImageData(0,0,c.width,c.height),w=c.width,h=c.height,src=id.data,dst=new Uint8ClampedArray(src),f=str/10,k=[0,-f,0,-f,1+4*f,-f,0,-f,0];
        for(var y=1;y<h-1;y++)for(var x=1;x<w-1;x++)for(var ch=0;ch<3;ch++){
            var idx=(y*w+x)*4+ch,sum=0;for(var ky=-1;ky<=1;ky++)for(var kx=-1;kx<=1;kx++)sum+=k[(ky+1)*3+(kx+1)]*src[((y+ky)*w+(x+kx))*4+ch];
            dst[idx]=Math.max(0,Math.min(255,Math.round(sum)));
        }
        for(var i=0;i<src.length;i++)src[i]=dst[i];ctx.putImageData(id,0,0);return c;
    }
    return boxBlur(sc,Math.max(1,Math.min(3,Math.round(Math.abs(str)/3))));
}
function boxBlur(sc,rad){
    var c=document.createElement('canvas'),ctx=c.getContext('2d');c.width=sc.width;c.height=sc.height;ctx.drawImage(sc,0,0);
    var id=ctx.getImageData(0,0,c.width,c.height),w=c.width,h=c.height,src=id.data,dst=new Uint8ClampedArray(src);
    for(var y=0;y<h;y++)for(var x=0;x<w;x++)for(var ch=0;ch<3;ch++){
        var sum=0,cnt=0;
        for(var dy=-rad;dy<=rad;dy++){var ny=y+dy;if(ny<0||ny>=h)continue;for(var dx=-rad;dx<=rad;dx++){var nx=x+dx;if(nx<0||nx>=w)continue;sum+=src[(ny*w+nx)*4+ch];cnt++;}}
        dst[(y*w+x)*4+ch]=Math.round(sum/cnt);
    }
    for(var i=3;i<src.length;i+=4)dst[i]=src[i];
    for(var i=0;i<src.length;i++)src[i]=dst[i];ctx.putImageData(id,0,0);return c;
}
function lineRepair(sc,gw,gh){
    var c=document.createElement('canvas'),ctx=c.getContext('2d');c.width=gw;c.height=gh;ctx.drawImage(sc,0,0);
    var id=ctx.getImageData(0,0,gw,gh),p=id.data;
    for(var y=1;y<gh-1;y++){for(var x=1;x<gw-1;x++){
        var idx=(y*gw+x)*4;var r=p[idx],g=p[idx+1],b=p[idx+2];
        if(p[idx+3]<128)continue; // 留空/镂空格不参与修复
        if(r===0&&g===0&&b===0)continue;
        var bc=0,wc=0;
        for(var dy=-1;dy<=1;dy++){for(var dx=-1;dx<=1;dx++){
            if(dx===0&&dy===0)continue;var nidx=((y+dy)*gw+(x+dx))*4;
            if(p[nidx+3]<128)continue; // 透明邻居不计入黑色统计
            var nr=p[nidx],ng=p[nidx+1],nb=p[nidx+2];
            if(nr===0&&ng===0&&nb===0)bc++;if(nr===255&&ng===255&&nb===255)wc++;
        }}
        if(bc>=5&&wc<=1){p[idx]=0;p[idx+1]=0;p[idx+2]=0;p[idx+3]=255;}
    }}
    ctx.putImageData(id,0,0);return c;
}
function getGridData(sc,gw,gh){
    var ctx=sc.getContext('2d');var id=ctx.getImageData(0,0,gw,gh),p=id.data;
    var data=[];for(var y=0;y<gh;y++){data[y]=[];for(var x=0;x<gw;x++){var idx=(y*gw+x)*4;data[y][x]=[p[idx],p[idx+1],p[idx+2],p[idx+3]]}}
    return data;
}
function removeSingles(){
    if(!gridData)return;saveUndo();
    var w=gridData[0].length,h=gridData.length,changed=0;
    for(var y=0;y<h;y++){for(var x=0;x<w;x++){
        var color=gridData[y][x];var sn=0,dc=null;
        for(var dy=-1;dy<=1;dy++){for(var dx=-1;dx<=1;dx++){
            if(dx===0&&dy===0)continue;var nx=x+dx,ny=y+dy;if(nx<0||nx>=w||ny<0||ny>=h)continue;
            var nc=gridData[ny][nx];if(nc[0]===color[0]&&nc[1]===color[1]&&nc[2]===color[2])sn++;else dc=nc;
        }}
        if(sn===0&&dc){gridData[y][x]=[dc[0],dc[1],dc[2],255];changed++;}
    }}
    if(changed>0)rerender();document.getElementById('pixelInfo').textContent='清除 '+changed+' 个孤立点';
}
function deepCopyGrid(g){
    if(!g)return null;var c=[];
    for(var y=0;y<g.length;y++){c[y]=[];for(var x=0;x<g[y].length;x++){c[y][x]=g[y][x].slice();}}
    return c;
}
function updateUndoButtons(){
    var u=document.getElementById('undoBtn'),r=document.getElementById('redoBtn');
    if(u)u.disabled=undoStack.length===0;
    if(r)r.disabled=redoStack.length===0;
}
function saveUndo(){
    if(!gridData)return;
    undoStack.push(deepCopyGrid(gridData));if(undoStack.length>20)undoStack.shift();
    redoStack=[];
    updateUndoButtons();
}
function undoBrush(){
    if(undoStack.length===0){document.getElementById('pixelInfo').textContent='无可后退';return}
    redoStack.push(deepCopyGrid(gridData));
    gridData=undoStack.pop();rerender();updateUndoButtons();document.getElementById('pixelInfo').textContent='已后退('+undoStack.length+'步)';
}
function redoBrush(){
    if(redoStack.length===0){document.getElementById('pixelInfo').textContent='无可前进';return}
    undoStack.push(deepCopyGrid(gridData));
    gridData=redoStack.pop();rerender();updateUndoButtons();document.getElementById('pixelInfo').textContent='已前进('+redoStack.length+'步)';
}
function getColorListText(){
    var counts={},idMap={};
    for(var y=0;y<gridData.length;y++){for(var x=0;x<gridData[y].length;x++){
        var c=gridData[y][x];
        if(c[3]<128)continue; // 镂空/留空不计入色号
        var key=c[0]+','+c[1]+','+c[2];counts[key]=(counts[key]||0)+1;if(!idMap[key])idMap[key]=findMardId(c);
    }}
    var sorted=Object.entries(counts).sort(function(a,b){return b[1]-a[1];});
    var lines=[];for(var i=0;i<sorted.length;i++){var rgb=sorted[i][0].split(',').map(Number);var count=sorted[i][1];lines.push({id:idMap[sorted[i][0]],count:count,rgb:rgb});}
    return lines;
}
function roundRectPath(ctx,x,y,w,h,r){
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
}
function drawWatermark(ctx,tw,th){
    var txt='在这里生成同款：https://chai-07.github.io/bead-website/';
    ctx.save();
    ctx.font='15px "Segoe UI",Arial,sans-serif';
    ctx.textAlign='right';ctx.textBaseline='middle';
    var w=ctx.measureText(txt).width;
    var padX=10,padY=7,boxH=15+padY*2,boxW=w+padX*2;
    var bx=tw-14-boxW, by=th-14-boxH;
    ctx.fillStyle='rgba(255,255,255,0.82)';
    roundRectPath(ctx,bx,by,boxW,boxH,7);ctx.fill();
    ctx.fillStyle='rgba(50,50,50,0.98)';
    ctx.fillText(txt,tw-14-padX,th-14-boxH/2);
    ctx.restore();
}
function drawGridFromData(gw,gh,sg,gc){
    var c=document.createElement('canvas'),ctx=c.getContext('2d');var margin=40,cs=30;
    var cl=getColorListText();
    var perRow=13,rowH=54,swSize=36;
    var usableW=gw*cs;
    var minColW=swSize+12+58;
    var autoPerRow=Math.floor(usableW/minColW);
    if(autoPerRow<perRow)perRow=Math.max(3,autoPerRow);
    var colW=usableW/perRow;
    var legendRows=cl.length>0?Math.ceil(cl.length/perRow):0;
    var legendTopGap=46,titleH=36;
    var legendAreaH=legendTopGap+titleH+legendRows*rowH+12;
    var watermarkH=44;
    var tw=gw*cs+margin*2;
    var th=margin+gh*cs+legendAreaH+watermarkH;
    c.width=tw;c.height=th;ctx.fillStyle='#fff';ctx.fillRect(0,0,tw,th);ctx.imageSmoothingEnabled=false;
    var nullCount=0;
    for(var y=0;y<gh;y++){for(var x=0;x<gw;x++){
        var clr=gridData[y][x];
        if(clr[3]<128){ // 镂空/留空：白底 + 灰色叉号，不显示色号
            nullCount++;
            ctx.fillStyle='#fff';ctx.fillRect(margin+x*cs,margin+y*cs,cs,cs);
            ctx.strokeStyle='#bbb';ctx.lineWidth=1;ctx.beginPath();
            ctx.moveTo(margin+x*cs,margin+y*cs);ctx.lineTo(margin+(x+1)*cs,margin+(y+1)*cs);
            ctx.moveTo(margin+(x+1)*cs,margin+y*cs);ctx.lineTo(margin+x*cs,margin+(y+1)*cs);ctx.stroke();
            if(sg){ctx.strokeStyle=gc;ctx.lineWidth=0.5;ctx.strokeRect(margin+x*cs,margin+y*cs,cs,cs);}
            continue;
        }
        ctx.fillStyle='rgb('+clr[0]+','+clr[1]+','+clr[2]+')';ctx.fillRect(margin+x*cs,margin+y*cs,cs,cs);
        if(sg){ctx.strokeStyle=gc;ctx.lineWidth=0.5;ctx.strokeRect(margin+x*cs,margin+y*cs,cs,cs);}
        if(showCodes){var mid=findMardId(clr);var lum=0.299*clr[0]+0.587*clr[1]+0.114*clr[2];ctx.fillStyle=lum>128?'#000':'#fff';ctx.font='bold 11px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(mid,margin+x*cs+cs/2,margin+y*cs+cs/2);}
    }}
    if(wandSelection){
        ctx.save();
        ctx.strokeStyle='#e94560';ctx.lineWidth=2;ctx.setLineDash([5,4]);
        ctx.beginPath();
        for(var y=0;y<gh;y++){for(var x=0;x<gw;x++){
            if(!wandSelection[y][x])continue;
            var X=margin+x*cs,Y=margin+y*cs;
            if(y===0||!wandSelection[y-1][x]){ctx.moveTo(X,Y);ctx.lineTo(X+cs,Y);}
            if(y===gh-1||!wandSelection[y+1][x]){ctx.moveTo(X,Y+cs);ctx.lineTo(X+cs,Y+cs);}
            if(x===0||!wandSelection[y][x-1]){ctx.moveTo(X,Y);ctx.lineTo(X,Y+cs);}
            if(x===gw-1||!wandSelection[y][x+1]){ctx.moveTo(X+cs,Y);ctx.lineTo(X+cs,Y+cs);}
        }}
        ctx.stroke();ctx.restore();
    }
    ctx.fillStyle='#222';ctx.font='bold 14px monospace';ctx.textAlign='center';ctx.textBaseline='middle';
    for(var x=0;x<gw;x++){ctx.fillText(x+1,margin+x*cs+cs/2,margin/2);ctx.fillText(x+1,margin+x*cs+cs/2,margin+gh*cs+18);}
    ctx.textAlign='right';for(var y=0;y<gh;y++){ctx.fillText(y+1,margin-5,margin+y*cs+cs/2);}
    ctx.textAlign='left';for(var y=0;y<gh;y++){ctx.fillText(y+1,tw-margin+5,margin+y*cs+cs/2);}
    ctx.strokeStyle='#000';ctx.lineWidth=1;ctx.strokeRect(margin,margin,gw*cs,gh*cs);
    var ly=margin+gh*cs+legendTopGap;
    ctx.font='bold 22px monospace';ctx.fillStyle='#222';ctx.textAlign='left';ctx.textBaseline='top';
    ctx.fillText('色号对照表 (共 '+cl.length+' 色 / 总计 '+(gw*gh-nullCount)+' 颗)',margin,ly);
    ly+=titleH;
    for(var i=0;i<cl.length;i++){
        var col=i%perRow,rowi=Math.floor(i/perRow);
        var ix=margin+col*colW;
        var iy=ly+rowi*rowH;
        var item=cl[i];
        ctx.fillStyle='rgb('+item.rgb.join(',')+')';ctx.fillRect(ix,iy,swSize,swSize);
        ctx.strokeStyle='#999';ctx.lineWidth=1.5;ctx.strokeRect(ix,iy,swSize,swSize);
        ctx.font='bold 16px monospace';ctx.fillStyle='#222';ctx.textAlign='left';ctx.textBaseline='top';
        ctx.fillText(item.id,ix+swSize+7,iy+4);
        ctx.font='15px monospace';ctx.fillStyle='#333';ctx.fillText('×'+item.count,ix+swSize+7,iy+25);
    }
    drawWatermark(ctx,tw,th);
    return c;
}
function rerender(){var sg=document.getElementById('showGrid').value==='yes',gc=document.getElementById('gridColor').value;var fin=drawGridFromData(gridW,gridH,sg,gc);displayResult(fin);}
function displayResult(rc){
    var el=document.getElementById('resultCanvas');
    el.width=rc.width;el.height=rc.height;el.getContext('2d').drawImage(rc,0,0);
    document.getElementById('resultPlaceholder').style.display='none';
    applyZoom();displayScale=30;
}
function applyZoom(){
    var el=document.getElementById('resultCanvas');
    el.style.width=(el.width*viewZoom)+'px';
    el.style.height=(el.height*viewZoom)+'px';
    document.getElementById('zoomInfo').textContent=Math.round(viewZoom*100)+'%';
}
function fitZoom(){
    var area=document.querySelector('.result-area');
    if(!area||!gridData)return;
    var el=document.getElementById('resultCanvas');
    var availW=area.clientWidth-16, availH=area.clientHeight-16;
    var z=Math.min(availW/el.width, availH/el.height);
    viewZoom=Math.max(0.1,Math.min(1,z));applyZoom();
}
function zoomCanvas(f){
    viewZoom=Math.max(0.1,Math.min(8,viewZoom*f));applyZoom();
}
function toggleWand(){
    wandActive=!wandActive;
    var btn=document.getElementById('wandBtn');
    if(wandActive){btn.classList.add('active');btn.style.background='#e94560';btn.textContent=' 魔棒(已开)';}
    else{btn.classList.remove('active');btn.style.background='#9b59b6';btn.textContent=' 魔棒选区';clearWandSelection();}
}
function clearWandSelection(){wandSelection=null;if(gridData)rerender();document.getElementById('pixelInfo').textContent='';}
function doWandSelect(gx,gy){
    if(!gridData)return;
    var w=gridW,h=gridH;
    var target=gridData[gy][gx];
    var match=function(a,b){return a[0]===b[0]&&a[1]===b[1]&&a[2]===b[2]&&a[3]===b[3];};
    var sel=[],visited={};
    for(var y=0;y<h;y++){sel[y]=[];for(var x=0;x<w;x++)sel[y][x]=false;}
    var stack=[[gx,gy]];
    while(stack.length){
        var p=stack.pop(),x=p[0],y=p[1];
        if(x<0||x>=w||y<0||y>=h)continue;
        if(sel[y][x])continue;
        if(!match(gridData[y][x],target))continue;
        sel[y][x]=true;
        stack.push([x+1,y]);stack.push([x-1,y]);stack.push([x,y+1]);stack.push([x,y-1]);
    }
    var n=0;for(var yy=0;yy<h;yy++)for(var xx=0;xx<w;xx++)if(sel[yy][xx])n++;
    wandSelection=sel;rerender();
    document.getElementById('pixelInfo').textContent=' 已选中 '+n+' 块相连色块 → 选颜色/null 覆盖，或再次点击魔棒取消选区';
}
function applyWandFill(rgba){
    if(!wandSelection){return;}
    saveUndo();
    for(var y=0;y<gridH;y++)for(var x=0;x<gridW;x++){if(wandSelection[y][x])gridData[y][x]=[rgba[0],rgba[1],rgba[2],rgba[3]];}
    wandSelection=null;rerender();
    document.getElementById('pixelInfo').textContent=' 魔棒选区已用「'+(selectedBrushIsNull?'镂空null':selectedBrushId)+'」填充';
}
function downloadResult(){showCodes=false;var s=wandSelection;wandSelection=null;rerender();var l=document.createElement('a');l.download=getExportPrefix()+'_效果图.png';l.href=document.getElementById('resultCanvas').toDataURL('image/png');l.click();wandSelection=s;showCodes=document.getElementById('showColorCodes').checked;rerender();}
function downloadCodeResult(){showCodes=true;var s=wandSelection;wandSelection=null;rerender();setTimeout(function(){var l=document.createElement('a');l.download=getExportPrefix()+'_色号图纸.png';l.href=document.getElementById('resultCanvas').toDataURL('image/png');l.click();wandSelection=s;showCodes=document.getElementById('showColorCodes').checked;rerender();},200);}

// （已移除：分享口令 / 导入口令功能）

// ================= 自由画笔（按住拖动连续绘制 + 对称 + 大小） =================
function eventToGrid(e){
    var c=document.getElementById('resultCanvas');var rect=c.getBoundingClientRect(),sx=c.width/rect.width;
    var mx=e.clientX-rect.left,my=e.clientY-rect.top,margin=40,cs=30;
    return [Math.floor((mx*sx-margin)/cs),Math.floor((my*sx-margin)/cs)];
}
function brushSymCells(gx,gy){
    var bs=parseInt(document.getElementById('brushSize').value)||1;
    var set={};
    function addT(tx,ty){ if(tx<0||tx>=gridW||ty<0||ty>=gridH)return; set[ty*gridW+tx]=1; }
    for(var dy=-bs+1;dy<bs;dy++)for(var dx=-bs+1;dx<bs;dx++){
        var nx=gx+dx,ny=gy+dy; if(nx<0||nx>=gridW||ny<0||ny>=gridH)continue;
        addT(nx,ny);
        if(symmetryMode==='vertical')addT(gridW-1-nx,ny);
        if(symmetryMode==='horizontal')addT(nx,gridH-1-ny);
        if(symmetryMode==='quad'){addT(gridW-1-nx,ny);addT(nx,gridH-1-ny);addT(gridW-1-nx,gridH-1-ny);}
    }
    var cells=[];for(var key in set){cells.push([key%gridW,Math.floor(key/gridW)]);}return cells;
}
function paintCells(cells){
    var col=selectedBrushIsNull?[0,0,0,0]:[selectedBrushColor[0],selectedBrushColor[1],selectedBrushColor[2],255];
    for(var i=0;i<cells.length;i++){var x=cells[i][0],y=cells[i][1];gridData[y][x]=col.slice();if(editMask)editMask[y][x]=true;}
}
function doPickColor(gx,gy){
    var clr=gridData[gy][gx];
    // 取色只设置当前画笔颜色，绝不应触发魔棒选区填充（否则选区会跟着被填掉）
    suppressWandFill=true;
    if(clr[3]<128){selectNullBrush();}
    else{var best=0,bd=Infinity;for(var j=0;j<MARD_COLORS.length;j++){var d=weightedLabDist(clr,MARD_COLORS[j].rgb);if(d<bd){bd=d;best=j;}}selectBrush(best);}
    suppressWandFill=false;
    toggleEyedropper();
    document.getElementById('pixelInfo').textContent='取色: ('+gx+','+gy+') → '+(clr[3]<128?'镂空NULL':MARD_COLORS[best].id);
}
var isPainting=false,lastPx=null,lastPy=null,_cv=document.getElementById('resultCanvas');
_cv.style.touchAction='none';
_cv.addEventListener('pointerdown',function(e){
    if(!gridData)return;
    var g=eventToGrid(e);
    if(g[0]<0||g[0]>=gridW||g[1]<0||g[1]>=gridH)return;
    if(eyedropperActive){doPickColor(g[0],g[1]);return;}
    if(wandActive){doWandSelect(g[0],g[1]);return;}
    e.preventDefault();isPainting=true;saveUndo();
    lastPx=g[0];lastPy=g[1];
    paintCells(brushSymCells(g[0],g[1]));rerender();
    try{_cv.setPointerCapture(e.pointerId);}catch(_){}
});
_cv.addEventListener('pointermove',function(e){
    if(!isPainting||!gridData)return;
    var g=eventToGrid(e);if(g[0]<0||g[0]>=gridW||g[1]<0||g[1]>=gridH){lastPx=g[0];lastPy=g[1];return;}
    var x0=lastPx,y0=lastPy,x1=g[0],y1=g[1];
    var dx=Math.abs(x1-x0),dy=Math.abs(y1-y0),sx=(x0<x1?1:-1),sy=(y0<y1?1:-1),err=dx-dy,cx=x0,cy=y0;
    while(true){paintCells(brushSymCells(cx,cy));if(cx===x1&&cy===y1)break;var e2=2*err;if(e2>-dy){err-=dy;cx+=sx;}if(e2<dx){err+=dx;cy+=sy;}}
    lastPx=x1;lastPy=y1;rerender();
});
function endPaint(){if(isPainting){isPainting=false;document.getElementById('pixelInfo').textContent=(selectedBrushIsNull?'镂空':'画笔')+'：按住拖动连续绘制完成';}}
_cv.addEventListener('pointerup',endPaint);_cv.addEventListener('pointerleave',endPaint);_cv.addEventListener('pointercancel',endPaint);
// ================= 新增功能（不改动画笔/色卡/图像转换/草稿核心代码） =================

/* ---------- 1. 控制面板分组可折叠 ---------- */
(function(){
    var groups=document.querySelectorAll('.control-panel .control-group');
    groups.forEach(function(g){
        var h3=g.querySelector('h3'); if(!h3)return;
        h3.classList.add('group-toggle');
        var body=document.createElement('div'); body.className='group-body';
        while(h3.nextSibling){ body.appendChild(h3.nextSibling); }
        g.appendChild(body);
        h3.addEventListener('click',function(){ g.classList.toggle('collapsed'); });
    });
})();


/* ---------- 3. 前置裁剪 ---------- */
var rawOriginalImage=null, cropState=null;
function openCrop(){
    if(!originalImage){alert('请先上传图片');return;}
    setFloatVisible(true);
    if(!rawOriginalImage)rawOriginalImage=originalImage;
    var img=document.getElementById('originalImage');
    if(img.style.display==='none'){alert('请先上传图片');return;}
    var r=img.getBoundingClientRect();
    var ov=document.getElementById('cropOverlay');
    ov.style.left=r.left+'px'; ov.style.top=r.top+'px'; ov.style.width=r.width+'px'; ov.style.height=r.height+'px';
    ov.style.display='block';
    cropState={x:r.width*0.1,y:r.height*0.1,w:r.width*0.8,h:r.height*0.8};
    drawCropRect(); document.getElementById('cropApplyBtn').disabled=false;
}
function drawCropRect(){var rect=document.getElementById('cropRect'),s=cropState;rect.style.left=s.x+'px';rect.style.top=s.y+'px';rect.style.width=s.w+'px';rect.style.height=s.h+'px';}
function closeCrop(){document.getElementById('cropOverlay').style.display='none';}
function applyCrop(){
    if(!cropState||!originalImage)return;
    var ov=document.getElementById('cropOverlay'); var r=ov.getBoundingClientRect();
    var sx=cropState.x/r.width*originalImage.naturalWidth;
    var sy=cropState.y/r.height*originalImage.naturalHeight;
    var sw=cropState.w/r.width*originalImage.naturalWidth;
    var sh=cropState.h/r.height*originalImage.naturalHeight;
    var c=document.createElement('canvas'); c.width=Math.max(1,Math.round(sw)); c.height=Math.max(1,Math.round(sh));
    c.getContext('2d').drawImage(originalImage,sx,sy,sw,sh,0,0,c.width,c.height);
    var ni=new Image();
    ni.onload=function(){
        var edits=captureBrushEdits();
        var nv={x:(currentViewRect?currentViewRect.x:0)+sx, y:(currentViewRect?currentViewRect.y:0)+sy, w:sw, h:sh};
        pendingReapply=transformEdits((currentViewRect?currentViewRect.x:0),(currentViewRect?currentViewRect.y:0),(currentViewRect?currentViewRect.w:originalImage.naturalWidth),(currentViewRect?currentViewRect.h:originalImage.naturalHeight), nv.x,nv.y,nv.w,nv.h, edits);
        currentViewRect=nv;
        originalImage=ni; var oi=document.getElementById('originalImage'); oi.src=ni.src; oi.style.display='block'; closeCrop(); resetTemplateUI(); requestProcess(); document.getElementById('pixelInfo').textContent=' 已应用前置裁剪';
    };
    ni.src=c.toDataURL('image/png');
}
function restoreCrop(){
    if(!rawOriginalImage)return;
    var edits=captureBrushEdits();
    var rw=rawOriginalImage.naturalWidth, rh=rawOriginalImage.naturalHeight;
    pendingReapply=transformEdits((currentViewRect?currentViewRect.x:0),(currentViewRect?currentViewRect.y:0),(currentViewRect?currentViewRect.w:rw),(currentViewRect?currentViewRect.h:rh), 0,0,rw,rh, edits);
    currentViewRect={x:0,y:0,w:rw,h:rh};
    originalImage=rawOriginalImage; var oi=document.getElementById('originalImage'); oi.src=rawOriginalImage.src; oi.style.display='block';
    closeCrop(); resetTemplateUI(); requestProcess(); document.getElementById('pixelInfo').textContent=' 已恢复原图（取消裁剪）';
}
(function(){
    var ov=document.getElementById('cropOverlay'); var drag=null;
    ov.addEventListener('pointerdown',function(e){drag={sx:e.clientX,sy:e.clientY};e.preventDefault();});
    window.addEventListener('pointermove',function(e){
        if(!drag)return; var r=ov.getBoundingClientRect();
        var x=Math.min(drag.sx,e.clientX)-r.left, y=Math.min(drag.sy,e.clientY)-r.top;
        var w=Math.abs(e.clientX-drag.sx), h=Math.abs(e.clientY-drag.sy);
        cropState={x:Math.max(0,x),y:Math.max(0,y),w:Math.min(w,r.width-x),h:Math.min(h,r.height-y)};
        drawCropRect();
    });
    window.addEventListener('pointerup',function(){drag=null;});
})();

/* ---------- 原图浮窗：显示/隐藏 + 拖动 ---------- */
function setFloatVisible(show){
    var fw=document.getElementById('floatOriginal');
    var tb=document.getElementById('toggleOriginalBtn');
    if(!fw)return;
    if(document.body.classList.contains('force-desktop')){
      fw.style.top = "12px"; fw.style.right = "12px"; fw.style.left = "auto"; fw.style.bottom = "auto";
    }
    fw.style.display=show?'block':'none';
    if(tb)tb.textContent=show?' 原图':' 原图';
}
(function(){
    var fw=document.getElementById('floatOriginal');
    var fh=document.getElementById('floatHead');
    var closeBtn=document.getElementById('floatClose');
    var toggleBtn=document.getElementById('toggleOriginalBtn');
    if(!fw||!fh||!toggleBtn)return;
    var dragging=false,offX=0,offY=0;
    toggleBtn.addEventListener('click',function(){ setFloatVisible(fw.style.display==='none'); });
    closeBtn.addEventListener('click',function(){ setFloatVisible(false); });
    fh.addEventListener('pointerdown',function(e){
        if(e.target===closeBtn)return;
        dragging=true;
        var r=fw.getBoundingClientRect();
        offX=e.clientX-r.left; offY=e.clientY-r.top;
        fw.style.left=r.left+'px'; fw.style.top=r.top+'px';
        fw.style.right='auto'; fw.style.bottom='auto';
        e.preventDefault();
    });
    window.addEventListener('pointermove',function(e){
        if(!dragging)return;
        var w=fw.offsetWidth,h=fw.offsetHeight;
        var x=e.clientX-offX, y=e.clientY-offY;
        x=Math.max(0,Math.min(x,window.innerWidth-w));
        y=Math.max(0,Math.min(y,window.innerHeight-h));
        fw.style.left=x+'px'; fw.style.top=y+'px';
    });
    window.addEventListener('pointerup',function(){dragging=false;});
})();

/* ---------- 4. 一键清杂点（连通分量 + 孤岛判定：仅清除“完全孤立在同色区域中的小色块”，绝不碰细线/边缘） ---------- */
function cleanSpecks(){
    if(!gridData){alert('请先生成图纸');return;}
    var maxSize=parseInt(document.getElementById('speckSize').value)||2; // ≤N颗的同色连通块才会被考虑
    saveUndo();
    var w=gridW,h=gridH,dirs4=[[1,0],[-1,0],[0,1],[0,-1]];
    var src=deepCopyGrid(gridData); // 基于旧图一次性判定，避免改写连锁扩散
    var visited=[];for(var y=0;y<h;y++){visited[y]=[];for(var x=0;x<w;x++)visited[y][x]=false;}
    var changed=0,removed=0;
    for(var y=0;y<h;y++)for(var x=0;x<w;x++){
        if(visited[y][x])continue;
        var c=src[y][x]; if(c[3]<128){visited[y][x]=true;continue;}
        // 4连通同色泛洪，得到连通块
        var comp=[],stack=[[x,y]];visited[y][x]=true;
        while(stack.length){var p=stack.pop(),px=p[0],py=p[1];comp.push([px,py]);
            for(var d=0;d<4;d++){var nx=px+dirs4[d][0],ny=py+dirs4[d][1];if(nx<0||nx>=w||ny<0||ny>=h)continue;if(visited[ny][nx])continue;var nc=src[ny][nx];if(nc[3]<128)continue;if(nc[0]===c[0]&&nc[1]===c[1]&&nc[2]===c[2]){visited[ny][nx]=true;stack.push([nx,ny]);}}
        }
        if(comp.length>maxSize)continue; // 比阈值大 → 当成真实形状（如细线），绝不处理
        // 统计连通块“外圈”邻居颜色：必须是同一主导色（孤岛才清，边缘/细节保留）
        var cnt={},border=0,bestKey=null,bestN=0;
        for(var i=0;i<comp.length;i++){var cx=comp[i][0],cy=comp[i][1];
            for(var d=0;d<4;d++){var nx=cx+dirs4[d][0],ny=cy+dirs4[d][1];if(nx<0||nx>=w||ny<0||ny>=h)continue;var nb=src[ny][nx];if(nb[3]<128)continue;if(nb[0]===c[0]&&nb[1]===c[1]&&nb[2]===c[2])continue;var key=nb[0]+','+nb[1]+','+nb[2];cnt[key]=(cnt[key]||0)+1;if(cnt[key]>bestN){bestN=cnt[key];bestKey=key;}border++;}
        }
        if(border===0)continue;                 // 四周是镂空/画布边界 → 视为有意浮空元素，保留
        if(bestN<Math.ceil(border*0.6))continue; // 外圈颜色不统一（贴在边缘/和多种颜色相邻）→ 保留
        var bc=bestKey.split(',').map(Number);
        for(var i=0;i<comp.length;i++){gridData[comp[i][1]][comp[i][0]]=[bc[0],bc[1],bc[2],255];}
        removed+=comp.length;changed++;
    }
    if(removed>0){rerender();var n=removed;document.getElementById('pixelInfo').textContent=' 清除 '+n+' 颗杂点（'+changed+' 个孤立色块）';}
    else{undoStack.pop();document.getElementById('pixelInfo').textContent=' 当前无≤'+maxSize+'颗的孤立杂点';}
}

/* ---------- 5. 对称绘图（对称模式由统一画笔处理函数 brushSymCells 读取） ---------- */
var symmetryMode='off';

/* ---------- 6. 挂件工艺模板 ---------- */
var templateBase=null; // 进入模板模式时保存的原始图纸，便于滑块实时重算（向上拖回也能复原）
// 切换原图/裁剪/导入草稿后，必须让模板状态与当前网格保持一致，否则下拉框仍显示旧模板、
// 而 templateBase 若残留会直接把“旧图”套回新图（典型 bug：换图后拖滑块仍是老图）。
function resetTemplateUI(){
    var s=document.getElementById('templateSel'); if(s)s.value='none';
    var r=document.getElementById('templateScaleRow'); if(r)r.style.display='none';
    templateBase=null;
}
function applyTemplate(name,live){
    if(!gridData){ if(name!=='none')alert('请先生成图纸'); return; }
    var w=gridW,h=gridH;
    var ts=parseFloat(document.getElementById('templateScale').value)||1; // 模板大小比例 0.3~1
    if(name==='none'){
        if(templateBase){ gridData=deepCopyGrid(templateBase); templateBase=null; }
        document.getElementById('pixelInfo').textContent='已清除挂件模板';
        rerender(); return;
    }
    if(!templateBase){ templateBase=deepCopyGrid(gridData); } // 首次进入模板时锁定原始图纸
    else if(templateBase.length!==h||templateBase[0].length!==w){ templateBase=deepCopyGrid(gridData); } // 基准尺寸与当前网格不符则重建（防旧图残留）
    if(!live){ saveUndo(); } // 仅在选中模板时记一次撤销，拖动滑块不刷屏撤销栈
    var src=deepCopyGrid(templateBase);
    var mask=function(){return true;};
    if(name==='disc'){var cx=(w-1)/2,cy=(h-1)/2,R=(Math.min(w,h)/2-0.5)*ts; mask=function(x,y){return Math.hypot((x+0.5)-cx,(y+0.5)-cy)<=R;};}
    else if(name==='heart'){mask=function(x,y){var nx=((x)/(w-1))*2-1,ny=((y)/(h-1))*2-1,a=nx/ts,b=-ny/ts;return Math.pow(a*a+b*b-1,3)-a*a*b*b*b<=0;};}
    else if(name==='rsquare'){mask=function(x,y){var nx=((x)/(w-1))*2-1,ny=((y)/(h-1))*2-1;var a=nx/ts,b=ny/ts;return (Math.abs(a)<=0.82&&Math.abs(b)<=0.82)||Math.hypot(Math.max(0,Math.abs(a)-0.6),Math.max(0,Math.abs(b)-0.6))<=0.28;};}
    for(var y=0;y<h;y++)for(var x=0;x<w;x++){ if(!mask(x,y))src[y][x]=[0,0,0,0]; }
    var hx=Math.round((w-1)/2),hy=Math.max(0,Math.min(h-1,Math.round((h-1)*(1-ts)/2)+1)); // 挂孔随形状上移到新边缘
    if(h>3&&hx-1>=0&&hx+1<w){src[Math.max(0,Math.min(h-1,hy))][hx-1]=[0,0,0,0];src[Math.max(0,Math.min(h-1,hy))][hx+1]=[0,0,0,0];}
    gridData=src;
    document.getElementById('pixelInfo').textContent=' 已应用挂件模板：'+name+'（大小 '+(ts*100).toFixed(0)+'%）';
    rerender();
}

/* ---------- 7. 颜色高亮（覆盖 rerender 以叠加高亮层，不修改原绘制） ---------- */
var highlightId=null;
var highlightCells=[]; // 高亮时锁定的 [x,y] 坐标集合（按位置记录，便于反复改色）
function highlightColor(id){
    highlightId=id;
    highlightCells=[];
    if(gridData){
        for(var y=0;y<gridH;y++)for(var x=0;x<gridW;x++){
            var clr=gridData[y][x];
            if(clr[3]>=128 && findMardId(clr)===id) highlightCells.push([x,y]);
        }
    }
    updateHlButtons();
    if(gridData)rerender();
}
function clearHighlight(){
    highlightId=null;
    highlightCells=[];
    updateHlButtons();
    if(gridData)rerender();
}
// 同步色号按钮的“绿色常亮”状态（即使评审面板被刷新也保持）
function updateHlButtons(){
    var btns=document.querySelectorAll('.hl-btn');
    for(var i=0;i<btns.length;i++){
        var b=btns[i];
        if(highlightId!==null && b.getAttribute('data-id')===highlightId) b.classList.add('hl-btn--active');
        else b.classList.remove('hl-btn--active');
    }
}
// 清除高亮前，点击色板某色：高亮区域所有色块改成该色
function recolorHighlight(rgb){
    if(!highlightCells.length || !gridData) return;
    var col=[rgb[0],rgb[1],rgb[2],255];
    for(var i=0;i<highlightCells.length;i++){ var p=highlightCells[i]; gridData[p[1]][p[0]]=col.slice(); }
    rerender();
}
function applyHighlightOverlay(){
    if(!highlightCells.length||!gridData)return;
    var c=document.getElementById('resultCanvas'); if(!c)return;
    var ctx=c.getContext('2d'),margin=40,cs=30;
    ctx.save();
    ctx.fillStyle='rgba(198,244,50,0.40)';
    for(var i=0;i<highlightCells.length;i++){ var p=highlightCells[i]; ctx.fillRect(margin+p[0]*cs,margin+p[1]*cs,cs,cs); }
    ctx.restore();
}
var _origRerender=rerender;
rerender=function(){_origRerender();applyHighlightOverlay();applyRiskOverlay();scheduleReview();};
var _reviewPending=false;
function scheduleReview(){ if(_reviewPending)return; _reviewPending=true; requestAnimationFrame(function(){_reviewPending=false; if(!isMobileLayout()||document.getElementById('reviewPanel').classList.contains('open'))buildReview();}); }

