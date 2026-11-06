/* bead-website · 导出（PDF / CSV / 一键打包） */
/* ---------- 9. 导出：彩色PDF / 黑白轮廓PDF / CSV / 一键打包 ---------- */
function stamp(){return new Date().toISOString().slice(0,10);}
function getExportPrefix(){
    var el=document.getElementById('exportName');
    var n=el?el.value.trim():'';
    if(n)return n;
    exportCounter++;
    return '随机命名'+exportCounter;
}
function renderVariant(variant){
    var prev=showCodes;
    if(variant==='codes')showCodes=true; else showCodes=false;
    var sg=document.getElementById('showGrid').value==='yes',gc=document.getElementById('gridColor').value;
    var c=drawGridFromData(gridW,gridH,sg,gc);
    showCodes=prev; return c;
}
function findMardName(rgb){for(var j=0;j<MARD_COLORS.length;j++){if(MARD_COLORS[j].rgb[0]===rgb[0]&&MARD_COLORS[j].rgb[1]===rgb[1]&&MARD_COLORS[j].rgb[2]===rgb[2])return MARD_COLORS[j].name;}return '';}
function buildCsv(){
    var lines=getColorListText(); var out='序号,色号,名称,R,G,B,数量\n';
    for(var i=0;i<lines.length;i++){var l=lines[i];out+=(i+1)+','+l.id+','+findMardName(l.rgb)+','+l.rgb[0]+','+l.rgb[1]+','+l.rgb[2]+','+l.count+'\n';}
    return out;
}
function canvasToBlob(c,type,q){return new Promise(function(res){c.toBlob(function(b){res(b);},type,q);});}
function downloadBlob(blob,name){var l=document.createElement('a');l.download=name;l.href=URL.createObjectURL(blob);l.click();setTimeout(function(){URL.revokeObjectURL(l.href);},1500);}
function pdfFromCanvas(canvas,q){
    var dataURL=canvas.toDataURL('image/jpeg',q||0.92),comma=dataURL.indexOf(',');
    var bin=atob(dataURL.slice(comma+1)),bytes=new Uint8Array(bin.length);
    for(var i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    return new Blob([buildPdf(bytes,canvas.width,canvas.height)],{type:'application/pdf'});
}
function buildPdf(jpeg,w,h){
    var enc=new TextEncoder(),chunks=[],pos=0,offsets=[];
    function addBytes(a){chunks.push(a);pos+=a.length;}
    function addStr(s){addBytes(enc.encode(s));}
    addStr('%PDF-1.3\n');
    offsets[1]=pos; addStr('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
    offsets[2]=pos; addStr('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
    offsets[3]=pos; addStr('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+w+' '+h+'] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n');
    offsets[4]=pos; addStr('4 0 obj\n<< /Type /XObject /Subtype /Image /Width '+w+' /Height '+h+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+jpeg.length+' >>\nstream\n');
    addBytes(jpeg); addStr('\nendstream\nendobj\n');
    var content='q '+w+' 0 0 '+h+' 0 0 cm /Im0 Do Q\n';
    offsets[5]=pos; addStr('5 0 obj\n<< /Length '+content.length+' >>\nstream\n'+content+'endstream\nendobj\n');
    var xrefPos=pos,n=6,xref='xref\n0 '+n+'\n0000000000 65535 f \n';
    for(var i=1;i<n;i++){var o=('0000000000'+(offsets[i]||0)).slice(-10);xref+=o+' 00000 n \n';}
    addStr(xref);
    addStr('trailer\n<< /Size '+n+' /Root 1 0 R >>\nstartxref\n'+xrefPos+'\n%%EOF');
    var total=0;for(var k=0;k<chunks.length;k++)total+=chunks[k].length;
    var out=new Uint8Array(total),o2=0;for(var k=0;k<chunks.length;k++){out.set(chunks[k],o2);o2+=chunks[k].length;}
    return out;
}
function crc32(buf){var c=~0;for(var i=0;i<buf.length;i++){c^=buf[i];for(var k=0;k<8;k++)c=(c>>>1)^(0xEDB88320&-(c&1));}return (c>>>0);}
function buildZipSync(files){
    var enc=new TextEncoder(),chunks=[],pos=0,offsets=[];
    function add(a){chunks.push(a);pos+=a.length;}
    for(var i=0;i<files.length;i++){
        var name=enc.encode(files[i].name),data=files[i].data;
        var lh=new Uint8Array(30+name.length),dv=new DataView(lh.buffer);
        dv.setUint32(0,0x04034b50,true);dv.setUint16(4,20,true);dv.setUint16(6,0,true);dv.setUint16(8,0,true);dv.setUint16(10,0,true);dv.setUint16(12,0,true);
        dv.setUint32(14,crc32(data),true);dv.setUint32(18,data.length,true);dv.setUint32(22,data.length,true);dv.setUint16(26,name.length,true);dv.setUint16(28,0,true);
        lh.set(name,30);
        offsets[i]={local:pos,crc:crc32(data),size:data.length,name:files[i].name};
        add(lh);add(data);
    }
    var cdStart=pos;
    for(var i=0;i<files.length;i++){
        var o=offsets[i],name=enc.encode(o.name),ch=new Uint8Array(46+name.length),dv=new DataView(ch.buffer);
        dv.setUint32(0,0x02014b50,true);dv.setUint16(4,20,true);dv.setUint16(6,20,true);dv.setUint16(8,0,true);dv.setUint16(10,0,true);dv.setUint16(12,0,true);dv.setUint16(14,0,true);
        dv.setUint32(16,o.crc,true);dv.setUint32(20,o.size,true);dv.setUint32(24,o.size,true);dv.setUint16(28,name.length,true);dv.setUint16(30,0,true);dv.setUint16(32,0,true);dv.setUint16(34,0,true);dv.setUint16(36,0,true);dv.setUint32(40,o.local,true);
        ch.set(name,46);
        add(ch);
    }
    var cdSize=pos-cdStart,eo=new Uint8Array(22),dv=new DataView(eo.buffer);
    dv.setUint32(0,0x06054b50,true);dv.setUint16(4,0,true);dv.setUint16(6,0,true);dv.setUint16(8,files.length,true);dv.setUint16(10,files.length,true);dv.setUint32(12,cdSize,true);dv.setUint32(16,cdStart,true);dv.setUint16(20,0,true);
    add(eo);
    var total=0;for(var k=0;k<chunks.length;k++)total+=chunks[k].length;
    var out=new Uint8Array(total),p=0;for(var k=0;k<chunks.length;k++){out.set(chunks[k],p);p+=chunks[k].length;}
    return out;
}
function downloadColorPdf(){if(!gridData){alert('请先生成图纸');return;}downloadBlob(pdfFromCanvas(renderVariant('effect'),0.92),getExportPrefix()+'_彩色.pdf');}
function downloadCsv(){if(!gridData){alert('请先生成图纸');return;}downloadBlob(new Blob([buildCsv()],{type:'text/csv;charset=utf-8'}),getExportPrefix()+'_耗材清单.csv');}
async function packageExport(){
    if(!gridData){alert('请先生成图纸');return;}
    var sg=document.getElementById('showGrid').value==='yes',gc=document.getElementById('gridColor').value;
    var prefix=getExportPrefix();
    var effectC=renderVariant('effect'),codesC=renderVariant('codes');
    var files=[
        {name:prefix+'_效果图.png',blob:await canvasToBlob(effectC,'image/png')},
        {name:prefix+'_色号图纸.png',blob:await canvasToBlob(codesC,'image/png')},
        {name:prefix+'_彩色.pdf',blob:pdfFromCanvas(effectC,0.92)},
        {name:prefix+'_耗材清单.csv',blob:new Blob([buildCsv()],{type:'text/csv;charset=utf-8'})}
    ];
    if(window.showDirectoryPicker){
        try{
            var dir=await window.showDirectoryPicker();
            for(var i=0;i<files.length;i++){var fh=await dir.getFileHandle(files[i].name,{create:true});var wr=await fh.createWritable();await wr.write(files[i].blob);await wr.close();}
            document.getElementById('pixelInfo').textContent='📦 已导出 '+files.length+' 个文件到所选文件夹';
            return;
        }catch(err){ if(err&&err.name==='AbortError')return; }
    }
    var arr=[];for(var i=0;i<files.length;i++){var ab=new Uint8Array(await files[i].blob.arrayBuffer());arr.push({name:files[i].name,data:ab});}
    downloadBlob(new Blob([buildZipSync(arr)],{type:'application/zip'}),prefix+'_打包.zip');
    document.getElementById('pixelInfo').textContent='📦 浏览器不支持选文件夹，已打包ZIP下载（解压即得文件夹）';
}
