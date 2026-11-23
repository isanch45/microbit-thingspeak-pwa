/* Opcions i dibuix de gràfics locals; cap dependència externa. */
(() => {
"use strict";
const NS="http://www.w3.org/2000/svg";
const TYPES=["line","bar","column","spline","step"];
const GROUPS=["timescale","average","median","sum"];
const INTERVALS=["","10","15","20","30","60","240","720","1440","daily"];
const node=(tag,attrs={},value)=>{const e=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,String(v)));if(value!=null)e.textContent=value;return e;};
const numeric=v=>(v===""||v==null||!Number.isFinite(Number(v)))?null:Number(v);
const defaults=spec=>({
 title:spec.name,xAxis:"Temps",yAxis:spec.name+" ("+spec.unit+")",
 color:spec.color,background:"#ffffff",type:"line",dynamic:true,
 days:"",results:"",timescale:"",average:"",median:"",sum:"",
 rounding:"",validMin:"",validMax:"",yMin:"",yMax:""
});
function normalize(spec,raw={}) {
 const o=defaults(spec);
 for(const k of ["title","xAxis","yAxis"])if(typeof raw[k]==="string")o[k]=raw[k].slice(0,90);
 for(const k of ["color","background"])if(/^#[0-9a-f]{6}$/i.test(raw[k]))o[k]=raw[k];
 if(TYPES.includes(raw.type))o.type=raw.type;
 if(typeof raw.dynamic==="boolean")o.dynamic=raw.dynamic;
 for(const k of ["days","results","rounding","validMin","validMax","yMin","yMax"])
   if(numeric(raw[k])!==null)o[k]=String(raw[k]);
 for(const k of GROUPS)if(INTERVALS.includes(String(raw[k]))&&String(raw[k])){GROUPS.forEach(x=>o[x]="");o[k]=String(raw[k]);}
 return o;
}
function groupStart(t,interval){
 if(interval==="daily"){const d=new Date(t);return new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();}
 const period=Number(interval)*60000;return Math.floor(t/period)*period;
}
function transform(data,config){
 let values=data;
 const digits=numeric(config.rounding);
 if(digits!==null){const f=10**Math.max(0,Math.min(6,Math.floor(digits)));values=values.map(p=>({...p,value:Math.round(p.value*f)/f}));}
 const type=GROUPS.find(k=>config[k]);
 if(!type)return values;
 const bins=new Map();
 for(const p of values){const b=groupStart(p.t,config[type]);if(!bins.has(b))bins.set(b,[]);bins.get(b).push(p.value);}
 return [...bins].sort((a,b)=>a[0]-b[0]).map(([t,nums])=>{
   let value;
   if(type==="timescale")value=nums[0];
   else if(type==="sum")value=nums.reduce((a,b)=>a+b,0);
   else if(type==="median"){const sorted=[...nums].sort((a,b)=>a-b),mid=Math.floor(sorted.length/2);value=sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;}
   else value=nums.reduce((a,b)=>a+b,0)/nums.length;
   return {t,value};
 });
}
function decimate(data,target){
 if(data.length<=target)return data;
 const out=[],stride=Math.ceil(data.length/(target/4));
 for(let i=0;i<data.length;i+=stride){
  const block=data.slice(i,i+stride);
  const min=block.reduce((a,b)=>a.value<b.value?a:b),max=block.reduce((a,b)=>a.value>b.value?a:b);
  [block[0],min,max,block[block.length-1]].sort((a,b)=>a.t-b.t).forEach(p=>{if(!out.includes(p))out.push(p);});
 }
 return out;
}
function label(n,d){return new Intl.NumberFormat("ca-ES",{maximumFractionDigits:d}).format(n);}
function dateLabel(t,span){const d=new Date(t);return span>86400000?d.toLocaleDateString("ca-ES",{day:"numeric",month:"short"}):d.toLocaleTimeString("ca-ES",{hour:"2-digit",minute:"2-digit"});}
function text(svg,s,x,y,attrs={}){svg.append(node("text",{x,y,fill:"#7b8799","font-family":"system-ui, sans-serif","font-size":11,...attrs},s));}
function render(svg,series,config,spec){
 svg.replaceChildren();svg.setAttribute("viewBox","0 0 640 263");
 if(!series.length)return;
 const o=normalize(spec,config),bounds={l:62,t:18,r:626,b:207},W=640,H=263;
 const vals=series.map(p=>p.value),min=Math.min(...vals),max=Math.max(...vals);
 const spread=Math.max(0.5,max-min);
 let lo=numeric(o.yMin)??(min-spread*.13),hi=numeric(o.yMax)??(max+spread*.13);
 if(lo>=hi){lo-=1;hi+=1;}
 const col=o.color;
 svg.append(node("rect",{x:0,y:0,width:W,height:H,rx:9,fill:o.background}));
 const defs=node("defs"),key="plot-"+spec.name.replace(/[^a-z]/gi,"");
 const grad=node("linearGradient",{id:"grad-"+key,x1:"0",x2:"0",y1:"0",y2:"1"});
 grad.append(node("stop",{offset:"0%","stop-color":col,"stop-opacity":0.16}));
 grad.append(node("stop",{offset:"100%","stop-color":col,"stop-opacity":0}));
 const clip=node("clipPath",{id:"clip-"+key});
 clip.append(node("rect",{x:bounds.l,y:bounds.t,width:bounds.r-bounds.l,height:bounds.b-bounds.t}));
 defs.append(grad,clip);svg.append(defs);
 const g=node("g",{"clip-path":"url(#clip-"+key+")"});
 const vx=v=>bounds.l+(v-lo)/(hi-lo)*(bounds.r-bounds.l);
 const Y=v=>bounds.b-(v-lo)/(hi-lo)*(bounds.b-bounds.t);
 if(o.type==="bar"){
  const points=decimate(series,22),h=(bounds.b-bounds.t)/points.length,baseline=Math.max(lo,Math.min(hi,0)),span=points.length>1?points[points.length-1].t-points[0].t:0;
  for(let i=0;i<=4;i++){const v=lo+(hi-lo)*i/4,x=vx(v);svg.append(node("line",{x1:x,x2:x,y1:bounds.t,y2:bounds.b,stroke:"#e7edf4"}));text(svg,label(v,spec.decimals),x,bounds.b+17,{"text-anchor":"middle"});}
  points.forEach((p,i)=>{const y=bounds.t+i*h+h*.12,v=Math.max(lo,Math.min(hi,p.value));g.append(node("rect",{x:Math.min(vx(baseline),vx(v)),y,width:Math.max(1,Math.abs(vx(v)-vx(baseline))),height:Math.max(1,h*.75),rx:2,fill:col}));if(points.length<=10)text(svg,dateLabel(p.t,span),bounds.l-5,y+h*.55,{"text-anchor":"end","font-size":10});});
  svg.append(g);text(svg,o.yAxis||spec.name,W/2,H-9,{"text-anchor":"middle"});return;
 }
 const points=decimate(series,o.type==="column"?145:500),start=points[0].t,end=points[points.length-1].t;
 const X=t=>bounds.l+(t-start)/Math.max(1,end-start)*(bounds.r-bounds.l);
 for(let i=0;i<=4;i++){const y=bounds.t+(bounds.b-bounds.t)*i/4,v=hi-(hi-lo)*i/4;svg.append(node("line",{x1:bounds.l,y1:y,x2:bounds.r,y2:y,stroke:"#e7edf4"}));text(svg,label(v,spec.decimals),bounds.l-8,y+4,{"text-anchor":"end"});}
 for(let i=0;i<=3;i++){const t=start+(end-start)*i/3; text(svg,dateLabel(t,end-start),bounds.l+(bounds.r-bounds.l)*i/3,bounds.b+20,{"text-anchor":i===0?"start":i===3?"end":"middle"});}
 text(svg,o.xAxis||"Temps",W/2,H-8,{"text-anchor":"middle"});
 if(o.yAxis)text(svg,o.yAxis,12,H/2,{"text-anchor":"middle",transform:"rotate(-90 12 "+H/2+")","font-size":10});
 const zero=Y(Math.min(hi,Math.max(lo,0)));
 if(o.type==="column"){
  const w=Math.min(17,Math.max(1,(bounds.r-bounds.l)/points.length*.7));
  points.forEach(p=>{const y=Y(p.value);g.append(node("rect",{x:X(p.t)-w/2,y:Math.min(y,zero),width:w,height:Math.max(1,Math.abs(zero-y)),rx:1.5,fill:col}));});
 }else{
  const intervals=points.slice(1).map((p,i)=>p.t-points[i].t).filter(n=>n>0).sort((a,b)=>a-b);
  const interval=intervals.length?intervals[Math.floor(intervals.length/2)]:15000;
  const gap=Math.max(2*60000,interval*4);
  const segments=[];let seg=[];
  points.forEach(p=>{if(seg.length&&p.t-seg[seg.length-1].t>gap){segments.push(seg);seg=[];}seg.push(p);});
  if(seg.length)segments.push(seg);
  segments.forEach(part=>{
   const p=part.map(a=>({x:X(a.t),y:Y(a.value)}));
   if(p.length===1){g.append(node("circle",{cx:p[0].x,cy:p[0].y,r:3,fill:col}));return;}
   let d="M"+p[0].x+","+p[0].y;
   for(let i=1;i<p.length;i++){
     const a=p[i-1],b=p[i];
     if(o.type==="step")d+=" H"+b.x+" V"+b.y;
     else if(o.type==="spline"){
       const prev=p[Math.max(0,i-2)],next=p[Math.min(p.length-1,i+1)];
       d+=" C"+(a.x+(b.x-prev.x)/6)+","+(a.y+(b.y-prev.y)/6)+" "+(b.x-(next.x-a.x)/6)+","+(b.y-(next.y-a.y)/6)+" "+b.x+","+b.y;
     }else d+=" L"+b.x+","+b.y;
   }
   const a=p[0],b=p[p.length-1];
   g.append(node("path",{d:d+" L"+b.x+","+bounds.b+" L"+a.x+","+bounds.b+" Z",fill:"url(#grad-"+key+")"}));
   g.append(node("path",{d,fill:"none",stroke:col,"stroke-width":2.5,"stroke-linejoin":"round","stroke-linecap":"round"}));
  });
 }
 const last=points[points.length-1];
 g.append(node("circle",{cx:X(last.t),cy:Y(last.value),r:4,fill:col,stroke:"#fff","stroke-width":1.8}));
 svg.append(g);
}
window.ThingSpeakChartOptions=Object.freeze({defaults,normalize,transform,render,TYPES,INTERVALS});
})();