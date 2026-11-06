/* bead-website · 草稿系统（暂存/读取/删除/导入导出） */
// ===== 草稿系统（多草稿 + 自命名；沙盒环境自动降级到内存存储，并支持文件导出/导入兜底） =====
var memDrafts={}; // localStorage 不可用时的会话内存兜底
var storageIsMemory=false;
function draftStorageAvailable(){
    try{localStorage.setItem('__bead_t','1');localStorage.removeItem('__bead_t');return true;}
    catch(e){return false;}
}
function readAllDrafts(){
    if(draftStorageAvailable()){
        try{return JSON.parse(localStorage.getItem('beadDrafts')||'{}');}catch(e){return {};}
    }
    storageIsMemory=true;return memDrafts;
}
function writeAllDrafts(obj){
    if(draftStorageAvailable()){
        try{localStorage.setItem('beadDrafts',JSON.stringify(obj));return true;}
        catch(e){ // 写入失败（如超出配额）→ 降级内存
            storageIsMemory=true;memDrafts=obj;return false;
        }
    }
    storageIsMemory=true;memDrafts=obj;return false;
}
function refreshDraftSelect(){
    var sel=document.getElementById('draftSelect');
    var drafts=readAllDrafts();
    var names=Object.keys(drafts).sort();
    var cur=sel.value;
    sel.innerHTML='<option value="">— 选择要读取的草稿 —</option>';
    for(var i=0;i<names.length;i++){
        var opt=document.createElement('option');opt.value=names[i];opt.textContent=names[i];sel.appendChild(opt);
    }
    if(names.indexOf(cur)>=0)sel.value=cur;
    var info=document.getElementById('draftInfo');
    info.textContent=names.length?('已存 '+names.length+' 份草稿'):'';
    var sw=document.getElementById('storageWarn');
    if(storageIsMemory){sw.textContent=' 当前预览环境不支持本地存储，草稿仅本次会话有效；要永久保存请用「导出文件」或直接用浏览器打开本 HTML';sw.style.display='block';}
    else sw.style.display='none';
}
function buildDraftObj(){
    return {
        v:2,name:'',
        gridData:gridData,gridW:gridW,gridH:gridH,
        img:originalImage?originalImage.src:null,
        params:{
            canvasSize:document.getElementById('canvasSize').value,
            darkUnify:document.getElementById('darkUnify').value,
            blackThreshold:document.getElementById('blackThreshold').value,
            gamma:document.getElementById('gamma').value,
            saturation:document.getElementById('saturation').value,
            contrast:document.getElementById('contrast').value,
            brightness:document.getElementById('brightness').value,
            sharpen:document.getElementById('sharpen').value,
            denoise:document.getElementById('denoise').value,
            maxColors:document.getElementById('maxColors').value,
            mergeSimilar:document.getElementById('mergeSimilar').value,
            showGrid:document.getElementById('showGrid').value,
            gridColor:document.getElementById('gridColor').value,
            showColorCodes:document.getElementById('showColorCodes').checked
        }
    };
}
function saveDraft(){
    if(!gridData){alert('还没有可暂存的图纸');return;}
    var defName=document.getElementById('draftName').value.trim();
    if(!defName){
        var cs=document.getElementById('canvasSize').value;
        defName='草稿-'+cs+'x'+cs+'-'+new Date().toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
    }
    var name=prompt('给这份草稿起个名字：',defName);
    if(name===null)return; // 用户取消
    name=name.trim();if(!name)name=defName;
    var draft=buildDraftObj();draft.name=name;
    var drafts=readAllDrafts();
    if(drafts[name]&&!confirm('草稿「'+name+'」已存在，覆盖吗？'))return;
    drafts[name]=draft;
    var ok=writeAllDrafts(drafts);
    document.getElementById('draftName').value=name;
    document.getElementById('exportName').value=name;
    refreshDraftSelect();
    document.getElementById('draftSelect').value=name;
    document.getElementById('pixelInfo').textContent=ok?(' 草稿「'+name+'」已暂存到浏览器本地'):(' 草稿「'+name+'」已暂存（仅本次会话有效，建议导出文件备份）');
}
function applyDraftData(d){
    var p=d.params||{};
    function setVal(id,val){var el=document.getElementById(id);if(el&&val!==undefined){el.value=val;}}
    setVal('canvasSize',p.canvasSize);setVal('darkUnify',p.darkUnify);setVal('blackThreshold',p.blackThreshold);
    setVal('gamma',p.gamma);setVal('saturation',p.saturation);setVal('contrast',p.contrast);
    setVal('brightness',p.brightness);setVal('sharpen',p.sharpen);setVal('denoise',p.denoise);
    setVal('maxColors',p.maxColors);setVal('mergeSimilar',p.mergeSimilar);setVal('showGrid',p.showGrid);setVal('gridColor',p.gridColor);
    if(document.getElementById('showColorCodes'))document.getElementById('showColorCodes').checked=!!p.showColorCodes;
    document.getElementById('darkUnifyValue').textContent=p.darkUnify||0;
    document.getElementById('blackValue').textContent=p.blackThreshold||0;
    document.getElementById('gammaValue').textContent=((p.gamma||100)/100).toFixed(2);
    document.getElementById('satValue').textContent=(p.saturation||100)+'%';
    document.getElementById('contrastValue').textContent=(p.contrast||100)+'%';
    document.getElementById('brightValue').textContent=p.brightness||0;
    document.getElementById('sharpValue').textContent=p.sharpen||0;
    document.getElementById('denoiseValue').textContent=p.denoise||0;
    document.getElementById('colorCountValue').textContent=p.maxColors||48;
    document.getElementById('mergeSimilarValue').textContent=p.mergeSimilar||0;
    function applyGrid(){
        gridData=d.gridData;gridW=d.gridW;gridH=d.gridH;undoStack=[];redoStack=[];wandSelection=null;editMask=makeEditMask(gridW,gridH);resetTemplateUI();
        rerender();fitZoom();document.getElementById('downloadBtn').disabled=false;document.getElementById('downloadCodeBtn').disabled=false;
    }
    if(d.img){
        originalImage=new Image();
        originalImage.onload=function(){
            document.getElementById('originalImage').src=d.img;
            document.getElementById('originalImage').style.display='block';
            setFloatVisible(true);
            currentViewRect={x:0,y:0,w:originalImage.naturalWidth,h:originalImage.naturalHeight};
            applyGrid();document.getElementById('pixelInfo').textContent=' 已读取草稿「'+(d.name||'')+'」（原图 + 图纸）';
        };
        originalImage.src=d.img;
    }else if(d.gridData){
        applyGrid();document.getElementById('pixelInfo').textContent=' 已读取草稿「'+(d.name||'')+'」（无原图）';
    }else{alert('草稿内容为空');}
}
function loadDraft(){
    var name=document.getElementById('draftSelect').value;
    if(!name){alert('请先在下拉框选择要读取的草稿');return;}
    var drafts=readAllDrafts();
    var d=drafts[name];
    if(!d){alert('草稿「'+name+'」不存在');refreshDraftSelect();return;}
    try{applyDraftData(d);if(typeof syncGridRadio==='function')syncGridRadio();document.getElementById('draftName').value=name;document.getElementById('exportName').value=name;}
    catch(e){alert('读取失败：'+e.message);}
}
function deleteDraft(){
    var name=document.getElementById('draftSelect').value;
    if(!name){alert('请先在下拉框选择要删除的草稿');return;}
    if(!confirm('确定删除草稿「'+name+'」吗？'))return;
    var drafts=readAllDrafts();delete drafts[name];
    writeAllDrafts(drafts);refreshDraftSelect();
    document.getElementById('pixelInfo').textContent=' 已删除草稿「'+name+'」';
}
function exportDraft(){
    if(!gridData){alert('还没有可导出的图纸');return;}
    var name=document.getElementById('draftName').value.trim()||('bead-draft-'+Date.now());
    var draft=buildDraftObj();draft.name=name;
    var blob=new Blob([JSON.stringify(draft)],{type:'application/json'});
    var l=document.createElement('a');l.download=name+'.bead.json';
    l.href=URL.createObjectURL(blob);l.click();
    setTimeout(function(){URL.revokeObjectURL(l.href);},1000);
    document.getElementById('pixelInfo').textContent=' 已导出草稿文件 '+name+'.bead.json';
}
document.getElementById('draftFileInput').addEventListener('change',function(e){
    var f=e.target.files[0];if(!f)return;
    var r=new FileReader();
    r.onload=function(ev){
        try{
            var d=JSON.parse(ev.target.result);
            if(!d.gridData)throw new Error('不是有效的拼豆草稿文件');
            applyDraftData(d);
            if(typeof syncGridRadio==='function')syncGridRadio();
            if(d.name)document.getElementById('draftName').value=d.name;
            if(d.name)document.getElementById('exportName').value=d.name;
            document.getElementById('pixelInfo').textContent=' 已导入草稿文件「'+(d.name||f.name)+'」';
        }catch(err){alert('导入失败：'+err.message);}
    };
    r.readAsText(f);
    e.target.value='';
});
refreshDraftSelect();


