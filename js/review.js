/* bead-website · 工艺评审报告（分析引擎 + 整改） */
/* ---------- 8. 工艺评审报告（本地像素扫描） ---------- */
function openReview(){var rp=document.getElementById('reviewPanel');if(isMobileLayout()&&rp.classList.contains('open')){closeReview();return;}buildReview();if(isMobileLayout()){rp.classList.add('open');document.getElementById('scrim').classList.add('show');}}
function closeReview(){document.getElementById('reviewPanel').classList.remove('open');maybeHideScrim();}
function openSettings(){document.getElementById('control-panel').classList.add('open');document.getElementById('scrim').classList.add('show');}
function closeAll(){document.getElementById('control-panel').classList.remove('open');document.getElementById('reviewPanel').classList.remove('open');document.getElementById('scrim').classList.remove('show');}
function maybeHideScrim(){var cp=document.getElementById('control-panel').classList.contains('open'),rp=document.getElementById('reviewPanel').classList.contains('open');if(!cp&&!rp)document.getElementById('scrim').classList.remove('show');}
/* ===== 工艺评审：分析引擎 + 多版面 + 交互式整改 ===== */
function analyzeCraftReview(){
    var w=gridW,h=gridH;
    var nullCount=0,totalBeans=0;
    var counts={},idMap={};
    var visited=[];for(var y=0;y<h;y++){visited[y]=[];for(var x=0;x<w;x++)visited[y][x]=false;}
    var regions=[];
    for(var y=0;y<h;y++)for(var x=0;x<w;x++){
        if(visited[y][x])continue;
        var c=gridData[y][x];
        if(c[3]<128){nullCount++;continue;}
        var comp=[],stack=[[x,y]];visited[y][x]=true;
        var minx=x,maxx=x,miny=y,maxy=y;
        while(stack.length){
            var p=stack.pop(),px=p[0],py=p[1];comp.push([px,py]);
            if(px<minx)minx=px;if(px>maxx)maxx=px;if(py<miny)miny=py;if(py>maxy)maxy=py;
            var dirs=[[1,0],[-1,0],[0,1],[0,-1]];
            for(var d=0;d<4;d++){var nx=px+dirs[d][0],ny=py+dirs[d][1];if(nx<0||nx>=w||ny<0||ny>=h)continue;if(visited[ny][nx])continue;var nc=gridData[ny][nx];if(nc[3]<128)continue;if(nc[0]===c[0]&&nc[1]===c[1]&&nc[2]===c[2]){visited[ny][nx]=true;stack.push([nx,ny]);}}
        }
        totalBeans+=comp.length;
        var key=c[0]+','+c[1]+','+c[2];counts[key]=(counts[key]||0)+comp.length;
        if(!idMap[key])idMap[key]=findMardId(c);
        regions.push({pixels:comp,color:[c[0],c[1],c[2]],size:comp.length,bbox:{minx:minx,maxx:maxx,miny:miny,maxy:maxy}});
    }
    var colorCount=Object.keys(counts).length;
    var colorList=Object.keys(counts).map(function(k){var rgb=k.split(',').map(Number);return{id:idMap[k],count:counts[k],rgb:rgb};}).sort(function(a,b){return b.count-a.count;});
    var nullRatio=nullCount/(w*h);
    var totalRegions=regions.length;
    var fragmentation=totalRegions/Math.max(1,colorCount);
    var isCharmMode=false;
    for(var y=0;y<h&&!isCharmMode;y++)for(var x=0;x<w;x++){
        if(gridData[y][x][3]<128){
            var filled=0,dirs=[[1,0],[-1,0],[0,1],[0,-1]];
            for(var d=0;d<4;d++){var nx=x+dirs[d][0],ny=y+dirs[d][1];if(nx>=0&&nx<w&&ny>=0&&ny<h&&gridData[ny][nx][3]>=128)filled++;}
            if(filled===4){isCharmMode=true;break;}
        }
    }
    var chessNoiseCnt=0;
    for(var y=1;y<h-1;y++)for(var x=1;x<w-2;x++){
        var c0=gridData[y][x],c1=gridData[y][x+1],c2=gridData[y][x+2];
        if(c0[3]<128||c1[3]<128||c2[3]<128)continue;
        var k0=c0[0]+','+c0[1]+','+c0[2],k1=c1[0]+','+c1[1]+','+c1[2],k2=c2[0]+','+c2[1]+','+c2[2];
        if(k0===k2&&k0!==k1)chessNoiseCnt++;
    }
    var thinBars=[],islands=[],speck1=[];
    for(var i=0;i<regions.length;i++){
        var reg=regions[i],sz=reg.size,bb=reg.bbox;
        var bw=bb.maxx-bb.minx+1,bh=bb.maxy-bb.miny+1;
        if(sz===1){speck1.push({pixels:[[reg.pixels[0][0],reg.pixels[0][1]]]});}
        else if(Math.min(bw,bh)===1&&Math.max(bw,bh)>=5){thinBars.push({pixels:reg.pixels.slice(),color:reg.color});}
        else if(sz>=2&&sz<=24){
            var touchesOther=false;
            for(var k2=0;k2<reg.pixels.length&&!touchesOther;k2++){
                var pp=reg.pixels[k2];
                var dirs2=[[1,0],[-1,0],[0,1],[0,-1]];
                for(var d2=0;d2<4;d2++){var nx=pp[0]+dirs2[d2][0],ny=pp[1]+dirs2[d2][1];if(nx<0||nx>=w||ny<0||ny>=h)continue;var nb=gridData[ny][nx];if(nb[3]<128)continue;if(!(nb[0]===reg.color[0]&&nb[1]===reg.color[1]&&nb[2]===reg.color[2])){touchesOther=true;break;}}
            }
            if(!touchesOther)islands.push({pixels:reg.pixels.slice(),color:reg.color});
        }
    }
    var risks=[];
    function pushRisk(t,dd,lv,sg){risks.push({title:t,desc:dd,riskLevel:lv,suggest:sg});}
    if(thinBars.length>0)pushRisk('细长单像素构件','检测到 '+thinBars.length+' 处宽度仅 1 像素的细长构件，物理强度极低，极易断裂脱落。',isCharmMode?3:2,isCharmMode?'挂件图纸必须优先整改：使用【整改界面】加宽线条，或在原图里把线画粗。':'用【整改界面】给长条周边填充同色豆子加宽；或手动画笔补粗。');
    if(islands.length>0)pushRisk('悬浮孤岛','检测到 '+islands.length+' 处与主结构仅极少连接的悬浮孤岛，熨烫加热后粘结不足，易脱落丢失。',2,'使用【整改界面】「孤岛加固搭桥」把孤岛连到主体；或手动画笔补一条连接通道。');
    if(speck1.length>0)pushRisk('单点孤立碎块','检测到 '+speck1.length+' 个孤立单颗豆子，无周边支撑，熨烫时易移位脱落，观感也差。',1,'使用【整改界面】清除微小碎块，或手动画笔并入周边颜色。');
    if(chessNoiseCnt>0)pushRisk('棋盘噪点','检测到 '+chessNoiseCnt+' 处量化产生的交替棋盘噪点，成品会出现斑驳闪烁观感。',1,'使用【整改界面】「噪点修复」抹平交替点。');
    if(nullRatio>0.4)pushRisk('高镂空占比','镂空/留空占比 '+(nullRatio*100).toFixed(1)+'%，图纸骨架化、结构松散，拿取易变形。',nullRatio>0.5?2:1,'减少镂空范围，或在镂空边缘加支撑连接；挂件注意保留挂孔强度。');
    if(colorCount>60)pushRisk('颜色过多','使用 '+colorCount+' 种颜色，手工需频繁换豆，工时大幅上涨且易出错。',colorCount>90?2:1,'下调「最大颜色数」或提高「相似颜色合并」简化拼制。');
    if(fragmentation>5)pushRisk('颜色碎片化严重','平均每种颜色被拆成 '+fragmentation.toFixed(1)+' 块，同一颜色零散分布，效率低。',1,'提高「相似颜色合并」，把同色碎片合并成大块。');
    if(isCharmMode){
        var topNull=false;
        for(var x=0;x<w;x++){if(gridData[0][x][3]<128||(h>1&&gridData[1][x][3]<128)){topNull=true;break;}}
        if(topNull)pushRisk('挂孔位置危险','挂孔紧贴顶部边缘，挂绳受力直接作用于边缘少量豆子，悬挂易撕裂。',2,'使用【整改界面】「下移修复挂孔」把挂孔下移，远离边缘。');
    }
    if(risks.length===0)pushRisk('整图健康','未检测到明显工艺风险，可按图施工。',0,'保持即可。');
    var baseScore=Math.log2(w*h)/2+colorCount/8+totalRegions/5;
    var riskPenalty=0;
    for(var ri=0;ri<risks.length;ri++){var rl=risks[ri].riskLevel;if(rl===3)riskPenalty+=10;else if(rl===2)riskPenalty+=5;else if(rl===1)riskPenalty+=2;}
    var score=Math.min(100,baseScore+riskPenalty);
    var lvl;if(score<8)lvl={t:'★ 入门'};else if(score<14)lvl={t:'★★ 轻松'};else if(score<22)lvl={t:'★★★ 适中'};else if(score<32)lvl={t:'★★★★ 挑战'};else lvl={t:'★★★★★ 大师'};
    return {w:w,h:h,totalBeans:totalBeans,colorUsed:colorCount,nullCount:nullCount,nullRatio:nullRatio,totalRegions:totalRegions,fragmentation:fragmentation,isCharmMode:isCharmMode,colorList:colorList,risks:risks,thinBars:thinBars,islands:islands,speck1:speck1,chessNoiseCnt:chessNoiseCnt,lvl:lvl,score:score};
}

/* 画布风险标记框：勾选后在画布叠加各风险区域的虚线框 */
function applyRiskOverlay(){
    if(!showRiskOverlay||!riskResultCache||!gridData)return;
    var c=document.getElementById('resultCanvas');if(!c)return;
    var ctx=c.getContext('2d'),margin=40,cs=30;
    ctx.save();
    var groups=[{list:riskResultCache.thinBars,color:'rgba(255,68,68,0.95)'},{list:riskResultCache.islands,color:'rgba(255,153,51,0.95)'},{list:riskResultCache.speck1,color:'rgba(255,221,68,0.95)'}];
    groups.forEach(function(g){
        if(!g.list)return;
        g.list.forEach(function(reg){
            var xs=[],ys=[];
            reg.pixels.forEach(function(p){xs.push(p[0]);ys.push(p[1]);});
            var mnx=Math.min.apply(null,xs),mxx=Math.max.apply(null,xs),mny=Math.min.apply(null,ys),mxy=Math.max.apply(null,ys);
            ctx.strokeStyle=g.color;ctx.lineWidth=2;ctx.setLineDash([5,3]);
            ctx.strokeRect(margin+mnx*cs-2,margin+mny*cs-2,cs*(mxx-mnx+1)+4,cs*(mxy-mny+1)+4);
        });
    });
    ctx.restore();
}

function buildReview(){
    var body=document.getElementById('reviewBody');
    if(!gridData){body.innerHTML='<div class="rp-section">请先生成或打开一份图纸。</div>';return;}
    var res=analyzeCraftReview();
    riskResultCache=res;
    var risks=res.risks;
    var html='';
    html+='<div style="display:flex;gap:4px;margin-bottom:12px">'
        +'<button data-tab="overview" class="rp-tab'+(reviewTab==='overview'?' rp-tab--active':'')+'" style="flex:1;padding:6px 2px">问题概览</button>'
        +'<button data-tab="detail" class="rp-tab'+(reviewTab==='detail'?' rp-tab--active':'')+'" style="flex:1;padding:6px 2px">问题详情</button>'
        +'<button data-tab="fix" class="rp-tab'+(reviewTab==='fix'?' rp-tab--active':'')+'" style="flex:1;padding:6px 2px">整改界面</button>'
        +'</div>';
    if(reviewTab==='overview'){
        var cntFatal=0,cntMid=0,cntMinor=0,cntOk=0;
        risks.forEach(function(r){if(r.riskLevel===3)cntFatal++;else if(r.riskLevel===2)cntMid++;else if(r.riskLevel===1)cntMinor++;else cntOk++;});
        html+='<div class="rp-section"><h4> 图纸统计</h4>';
        html+='<div class="rp-stat"><span>底板尺寸</span><b>'+res.w+' × '+res.h+'</b></div>';
        html+='<div class="rp-stat"><span>实际豆数</span><b>'+res.totalBeans+' 颗</b></div>';
        html+='<div class="rp-stat"><span>使用颜色</span><b>'+res.colorUsed+' 色</b></div>';
        html+='<div class="rp-stat"><span>镂空格</span><b>'+res.nullCount+' ('+(res.nullRatio*100).toFixed(1)+'%)</b></div>';
        html+='<div class="rp-stat"><span>连通域总数</span><b>'+res.totalRegions+'</b></div>';
        html+='<div class="rp-stat"><span>碎片化系数</span><b>'+res.fragmentation.toFixed(2)+'</b></div>';
        html+='<div class="rp-stat"><span>图纸模式</span><b>'+(res.isCharmMode?'挂件模式(结构加权)':'摆件模式')+'</b></div>';
        html+='</div>';
        html+='<div class="rp-section"><h4> 风险等级统计</h4><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">'
            +'<div style="background:#441111;padding:6px;border-radius:4px;text-align:center"><div style="color:#ff4444;font-weight:bold">'+cntFatal+'</div><div style="font-size:10px;color:#aaa">致命风险</div></div>'
            +'<div style="background:#332211;padding:6px;border-radius:4px;text-align:center"><div style="color:#ff9933;font-weight:bold">'+cntMid+'</div><div style="font-size:10px;color:#aaa">中等风险</div></div>'
            +'<div style="background:#2e2b18;padding:6px;border-radius:4px;text-align:center"><div style="color:#ffdd44;font-weight:bold">'+cntMinor+'</div><div style="font-size:10px;color:#aaa">轻微风险</div></div>'
            +'</div></div>';
        html+='<div class="rp-section"><h4> 综合难度</h4><div style="text-align:center;padding:6px 0"><span class="rp-badge">'+res.lvl.t+'</span></div><p style="font-size:11px;color:#aaa;text-align:center">综合得分 '+res.score.toFixed(1)+'/100</p></div>';
        html+='<div class="rp-section"><h4> 风险问题列表（点击条目查看详情）</h4>';
        for(var i=0;i<risks.length;i++){
            var r=risks[i];var tag='';
            if(r.riskLevel===1)tag='<span style="color:#ffdd44">[轻微]</span>';
            else if(r.riskLevel===2)tag='<span style="color:#ff9933">[中等]</span>';
            else if(r.riskLevel===3)tag='<span style="color:#ff4444">[致命]</span>';
            else tag='<span style="color:#8f8">[正常]</span>';
            html+='<div class="risk-item" data-idx="'+i+'" style="padding:6px 4px;margin:4px 0;background:#0f3460;border-radius:4px;cursor:pointer;border:1px solid #1a3a6e">'+tag+' <b>'+r.title+'</b><div style="font-size:10px;color:#aaa;margin-top:2px">'+r.desc+'</div></div>';
        }
        html+='</div>';
        html+='<div class="rp-section"><div class="checkbox-row"><input type="checkbox" id="toggleRiskOverlay" '+(showRiskOverlay?'checked':'')+'><label for="toggleRiskOverlay">画布显示风险标记框</label></div></div>';
    } else if(reviewTab==='detail'){
        if(selectedRiskIndex<0||selectedRiskIndex>=risks.length){
            html+='<div class="rp-section"><p style="color:#aaa">请回到【问题概览】点击一条风险条目查看详情</p></div>';
        } else {
            var r=risks[selectedRiskIndex];
            var tag='';
            if(r.riskLevel===1)tag='<span style="color:#ffdd44">[轻微风险]</span>';
            else if(r.riskLevel===2)tag='<span style="color:#ff9933">[中等风险]</span>';
            else if(r.riskLevel===3)tag='<span style="color:#ff4444">[致命风险]</span>';
            else tag='<span style="color:#8f8">[无风险]</span>';
            html+='<div class="rp-section"><h4>'+tag+' '+r.title+'</h4>';
            html+='<div style="margin:8px 0"><b>现象描述：</b><div style="font-size:12px;margin-top:4px">'+r.desc+'</div></div>';
            var harmText='';
            if(r.title.indexOf('细长单像素构件')>=0)harmText='1像素宽度长条物理强度极低；挂件经过熨烫、弯折极易直接断裂脱落；摆件也容易磕碰掉豆。挂件图纸必须优先整改。';
            else if(r.title.indexOf('悬浮孤岛')>=0)harmText='该色块仅极少豆子与主体相连；拼好熨烫加热后粘结面积不足，冷却后孤岛直接脱落丢失。';
            else if(r.title.indexOf('高镂空占比')>=0)harmText='大量镂空，图纸骨架化，整体结构松散；制作、拿取过程极易变形碎裂。';
            else if(r.title.indexOf('颜色过多')>=0)harmText='颜色数量过高，手工需要频繁更换豆子，制作工时大幅上涨，新手极易出错。';
            else if(r.title.indexOf('单点孤立碎块')>=0)harmText='孤立单颗豆子，无周边支撑；拼豆熨烫时容易移位、脱落；不影响主体，但观感差。';
            else if(r.title.indexOf('挂孔位置危险')>=0)harmText='挂孔紧贴顶部边缘，挂绳受力直接作用边缘少量豆子；悬挂受力直接撕裂挂孔区域。';
            else if(r.title.indexOf('棋盘噪点')>=0)harmText='量化算法产生的交替噪点，实物成品会出现斑驳闪烁观感，不是原图细节。';
            else if(r.title.indexOf('颜色碎片化严重')>=0)harmText='同一个颜色被拆分成大量零散小块；手工需要反复取同一种豆子来回填充，效率低下。';
            else harmText='无特殊工艺危害。';
            html+='<div style="margin:10px 0"><b> 工艺危害：</b><div style="background:#1f2228;padding:8px;border:1px solid #2c3038;border-radius:4px;font-size:12px;margin-top:4px;color:#E6E7EA">'+harmText+'</div></div>';
            html+='<div style="margin:10px 0"><b> 人工整改建议：</b><div style="font-size:12px;margin-top:4px">'+r.suggest+'</div></div>';
            html+='<div style="margin-top:12px;display:flex;gap:6px"><button id="detailLocateBtn" style="flex:1;padding:7px;background:#0984e3;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:11px"> 画布定位风险区域</button><button id="goFixTabBtn" style="flex:1;padding:7px;background:#6c5ce7;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:11px"> 跳转整改界面</button></div>';
            html+='</div>';
        }
    } else if(reviewTab==='fix'){
        if(selectedRiskIndex<0||selectedRiskIndex>=risks.length){
            html+='<div class="rp-section"><p style="color:#aaa">请回到【概览】选择一条风险，再进入整改界面</p></div>';
        } else {
            var r=risks[selectedRiskIndex];
            html+='<div class="rp-section"><h4> 针对性整改：'+r.title+'</h4><p style="font-size:11px;color:#aaa;margin-bottom:10px"> 所有修改会写入图纸；可使用界面【后退】撤销操作。</p>';
            if(r.title.indexOf('细长单像素构件')>=0){
                html+='<div class="setting-row"><label>线条加宽像素 <span id="fixThinExpandVal">'+fixParams.thinExpandSize+'</span></label><input type="range" id="fixThinExpand" min="1" max="3" value="'+fixParams.thinExpandSize+'" step="1"><span class="hint">向长条周边填充同色豆子加宽，数值越大线条越粗，豆子增加越多</span></div><button id="runFixThin" class="btn" style="margin-top:8px;background:#e17055"> 执行修复细长构件</button>';
            } else if(r.title.indexOf('悬浮孤岛')>=0){
                html+='<div class="setting-row"><label>搭桥最大距离 <span id="fixBridgeVal">'+fixParams.bridgeMaxDist+'</span></label><input type="range" id="fixBridge" min="1" max="3" value="'+fixParams.bridgeMaxDist+'" step="1"><span class="hint">孤岛到主体最大允许搭桥空格；越大越容易把孤岛连上，但会改动更多画面</span></div><button id="runFixIsland" class="btn" style="margin-top:8px;background:#e17055"> 执行孤岛加固搭桥</button>';
            } else if(r.title.indexOf('单点孤立碎块')>=0){
                html+='<div class="setting-row"><label>碎块最大尺寸阈值 <span id="fixSpeckVal">'+fixParams.speckThreshold+'</span></label><input type="range" id="fixSpeck" min="1" max="4" value="'+fixParams.speckThreshold+'" step="1"><span class="hint">小于等于该大小的连通域会被清除并入周边颜色</span></div><button id="runFixSpeck" class="btn" style="margin-top:8px;background:#0984e3"> 清除微小碎块</button>';
            } else if(r.title.indexOf('棋盘噪点')>=0){
                html+='<div class="setting-row"><label>噪点修复强度 <span id="fixChessVal">'+fixParams.chessAggress+'</span></label><input type="range" id="fixChess" min="1" max="3" value="'+fixParams.chessAggress+'" step="1"><span class="hint">强度越高，会抹平更多交替噪点，可能损失细节</span></div><button id="runFixChess" class="btn" style="margin-top:8px;background:#0984e3"> 执行修复棋盘噪点</button>';
            } else if(r.title.indexOf('挂孔位置危险')>=0){
                html+='<p style="font-size:12px">挂孔风险：自动下移挂孔位置</p><button id="runFixHook" class="btn" style="margin-top:8px;background:#bb44ff"> 下移修复挂孔</button>';
            } else {
                html+='<p style="color:#aaa">该风险无自动整改方案，请参考建议手动画笔修改图纸。</p>';
            }
            html+='<div style="margin-top:12px"><button id="fixBackOverview" style="width:100%;background:#636e72;color:#fff;border:none;border-radius:6px;padding:7px;font-size:11px">← 返回问题概览</button></div></div>';
        }
    }
    html+='<div class="rp-section"><h4> 颜色高亮</h4><p style="font-size:11px;color:#aaa;margin-bottom:6px">点击色号高亮分布</p><div style="display:flex;flex-wrap:wrap;gap:4px">';
    html+=res.colorList.map(function(c){return '<button class="hl-btn" data-id="'+c.id+'" style="background:#0f3460;color:#eee;border:1px solid #1a3a6e;border-radius:5px;padding:4px 6px;font-size:11px;cursor:pointer">'+c.id+'</button>';}).join('');
    html+='</div><button id="clearHl" style="margin-top:8px;width:100%;background:#636e72;color:#fff;border:none;border-radius:6px;padding:6px;font-size:12px;cursor:pointer">清除高亮</button></div>';
    body.innerHTML=html;
    body.querySelectorAll('.rp-tab').forEach(function(tab){tab.onclick=function(){reviewTab=this.getAttribute('data-tab');buildReview();};});
    body.querySelectorAll('.risk-item').forEach(function(item){item.onclick=function(){selectedRiskIndex=Number(this.getAttribute('data-idx'));reviewTab='detail';buildReview();};});
    var tro=document.getElementById('toggleRiskOverlay');if(tro)tro.onchange=function(){showRiskOverlay=this.checked;rerender();};
    document.getElementById('clearHl').onclick=clearHighlight;
    if(reviewTab==='detail'){
        var lb=document.getElementById('detailLocateBtn');if(lb)lb.onclick=function(){locateRiskToCanvas(selectedRiskIndex);};
        var gf=document.getElementById('goFixTabBtn');if(gf)gf.onclick=function(){reviewTab='fix';buildReview();};
    }
    if(reviewTab==='fix'){
        var te=document.getElementById('fixThinExpand');if(te)te.oninput=function(){fixParams.thinExpandSize=Number(this.value);document.getElementById('fixThinExpandVal').textContent=fixParams.thinExpandSize;};
        var bs=document.getElementById('fixBridge');if(bs)bs.oninput=function(){fixParams.bridgeMaxDist=Number(this.value);document.getElementById('fixBridgeVal').textContent=fixParams.bridgeMaxDist;};
        var ss=document.getElementById('fixSpeck');if(ss)ss.oninput=function(){fixParams.speckThreshold=Number(this.value);document.getElementById('fixSpeckVal').textContent=fixParams.speckThreshold;};
        var cs=document.getElementById('fixChess');if(cs)cs.oninput=function(){fixParams.chessAggress=Number(this.value);document.getElementById('fixChessVal').textContent=fixParams.chessAggress;};
        var rt=document.getElementById('runFixThin');if(rt)rt.onclick=function(){fixAllThinBarsParam(fixParams.thinExpandSize);};
        var ri=document.getElementById('runFixIsland');if(ri)ri.onclick=function(){fixAllIslandsParam(fixParams.bridgeMaxDist);};
        var rs=document.getElementById('runFixSpeck');if(rs)rs.onclick=function(){fixAllSpecksParam(fixParams.speckThreshold);};
        var rc=document.getElementById('runFixChess');if(rc)rc.onclick=function(){fixChessNoiseParam(fixParams.chessAggress);};
        var rh=document.getElementById('runFixHook');if(rh)rh.onclick=function(){fixHookHazard();};
        var rb=document.getElementById('fixBackOverview');if(rb)rb.onclick=function(){reviewTab='overview';buildReview();};
    }
    body.querySelectorAll('.hl-btn').forEach(function(b){b.onclick=function(){highlightColor(this.getAttribute('data-id'));};});
    updateHlButtons(); // 同步色号按钮绿色常亮状态（评审面板每次重建后恢复）
}

/* 画布定位风险：黄色闪烁标记选中风险的像素 */
function locateRiskToCanvas(riskIdx){
    if(!riskResultCache)return;
    var canvas=document.getElementById('resultCanvas');var ctx=canvas.getContext('2d');var margin=40,cs=30;
    var risk=riskResultCache.risks[riskIdx];if(!risk)return;
    var blinkCnt=0;
    var timer=setInterval(function(){
        blinkCnt++;rerender();
        setTimeout(function(){
            ctx.save();ctx.fillStyle='rgba(255,255,0,0.45)';
            if(risk.title.indexOf('细长单像素构件')>=0){
                riskResultCache.thinBars.forEach(function(reg){reg.pixels.forEach(function(p){ctx.fillRect(margin+p[0]*cs,margin+p[1]*cs,cs,cs);});});
            } else if(risk.title.indexOf('悬浮孤岛')>=0){
                riskResultCache.islands.forEach(function(reg){reg.pixels.forEach(function(p){ctx.fillRect(margin+p[0]*cs,margin+p[1]*cs,cs,cs);});});
            } else if(risk.title.indexOf('单点孤立碎块')>=0){
                riskResultCache.speck1.forEach(function(sp){var p=sp.pixels[0];ctx.fillRect(margin+p[0]*cs,margin+p[1]*cs,cs,cs);});
            }
            ctx.restore();
        },10);
        if(blinkCnt>=3){clearInterval(timer);rerender();}
    },400);
    document.getElementById('pixelInfo').textContent=' 已在画布闪烁标记风险位置';
}

/* 带参数的整改函数（复用 undo / 草稿 / 导出系统） */
function fixAllThinBarsParam(expandSize){
    if(!riskResultCache||riskResultCache.thinBars.length===0){document.getElementById('pixelInfo').textContent=' 没有检测到细长构件，无需修复';return;}
    saveUndo();
    var dir4=[[1,0],[-1,0],[0,1],[0,-1]];var fixedCount=0;
    for(var i=0;i<riskResultCache.thinBars.length;i++){
        var reg=riskResultCache.thinBars[i];var rr=reg.color[0],rg=reg.color[1],rb=reg.color[2];
        for(var step=0;step<expandSize;step++){
            var tempAdd=[];
            for(var k=0;k<reg.pixels.length;k++){var px=reg.pixels[k][0],py=reg.pixels[k][1];
                for(var d=0;d<4;d++){var nx=px+dir4[d][0],ny=py+dir4[d][1];if(nx<0||nx>=gridW||ny<0||ny>=gridH)continue;if(gridData[ny][nx][3]<128){tempAdd.push([nx,ny]);}}
            }
            for(var t=0;t<tempAdd.length;t++){var ax=tempAdd[t][0],ay=tempAdd[t][1];gridData[ay][ax]=[rr,rg,rb,255];fixedCount++;}
        }
    }
    document.getElementById('pixelInfo').textContent=' 细长构件修复完成，新增 '+fixedCount+' 颗豆子';rerender();
}
function fixAllIslandsParam(maxBridgeDist){
    if(!riskResultCache||riskResultCache.islands.length===0){document.getElementById('pixelInfo').textContent=' 没有检测悬浮孤岛';return;}
    saveUndo();
    var dir4=[[1,0],[-1,0],[0,1],[0,-1]];var bridgeCnt=0;
    for(var i=0;i<riskResultCache.islands.length;i++){
        var reg=riskResultCache.islands[i];var rr=reg.color[0],rg=reg.color[1],rb=reg.color[2];
        for(var k=0;k<reg.pixels.length;k++){var px=reg.pixels[k][0],py=reg.pixels[k][1];
            for(var d=1;d<=maxBridgeDist;d++){
                var ok=false;
                for(var dd=0;dd<4;dd++){var nx=px+dir4[dd][0]*d,ny=py+dir4[dd][1]*d;if(nx<0||nx>=gridW||ny<0||ny>=gridH)continue;if(gridData[ny][nx][3]>128){
                    for(var s=1;s<d;s++){var mx=px+dir4[dd][0]*s,my=py+dir4[dd][1]*s;if(gridData[my][mx][3]<128){gridData[my][mx]=[rr,rg,rb,255];bridgeCnt++;}}
                    ok=true;break;
                }}
                if(ok)break;
            }
        }
    }
    document.getElementById('pixelInfo').textContent=' 孤岛加固完成，搭建 '+bridgeCnt+' 座连接桥';rerender();
}
function fixAllSpecksParam(threshold){
    document.getElementById('speckSize').value=threshold;cleanSpecks();
    document.getElementById('pixelInfo').textContent=' 已清除≤'+threshold+'颗的连通域碎块';
}
function fixChessNoiseParam(aggress){
    if(!riskResultCache||riskResultCache.chessNoiseCnt===0){document.getElementById('pixelInfo').textContent=' 未检测棋盘噪点';return;}
    saveUndo();var fixCnt=0;
    for(var level=0;level<aggress;level++){
        for(var y=1;y<gridH-1;y++)for(var x=1;x<gridW-2;x++){
            var c0=gridData[y][x],c1=gridData[y][x+1],c2=gridData[y][x+2];
            if(c0[3]<128||c1[3]<128||c2[3]<128)continue;
            var k0=c0[0]+','+c0[1]+','+c0[2],k1=c1[0]+','+c1[1]+','+c1[2],k2=c2[0]+','+c2[1]+','+c2[2];
            if(k0===k2&&k0!==k1){gridData[y][x+1]=[c0[0],c0[1],c0[2],255];fixCnt++;}
        }
    }
    document.getElementById('pixelInfo').textContent=' 噪点修复完成，修正 '+fixCnt+' 处交替噪点';rerender();
}
function fixHookHazard(){
    if(!gridData)return;
    saveUndo();
    var midX=Math.floor(gridW/2);
    for(var y=0;y<=2;y++){gridData[y][midX]=[255,255,255,0];}
    var newY=3;if(newY<gridH){gridData[newY][midX-1]=[0,0,0,0];gridData[newY][midX+1]=[0,0,0,0];}
    document.getElementById('pixelInfo').textContent=' 挂孔已经向下移位修复';rerender();
}

