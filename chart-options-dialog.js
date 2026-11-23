/* Finestra de configuració individual, sense dependències. */
(() => {
"use strict";
const SELECT_INTERVALS=["","10","15","20","30","60","240","720","1440","daily"];
const typeLabels={line:"Línia",bar:"Barres horitzontals",column:"Columnes",spline:"Corba suau",step:"Esglaons"};
const fields=[
 ["title","Títol","text"],["xAxis","Eix X","text"],["yAxis","Eix Y","text"],
 ["color","Color","color"],["background","Fons","color"],["type","Tipus","type"],
 ["dynamic","Dinàmic","bool"],["days","Dies","number"],["results","Resultats","integer"],
 ["timescale","Timescale","interval"],["average","Mitjana","interval"],
 ["median","Mediana","interval"],["sum","Suma","interval"],
 ["rounding","Arrodoniment (decimals)","digits"],
 ["validMin","Dada mín.","number"],["validMax","Dada màx.","number"],
 ["yMin","Eix Y mín.","number"],["yMax","Eix Y màx.","number"]
];
function open({spec,config,onSave}){
 const options=window.ThingSpeakChartOptions.normalize(spec,config);
 let dialog=document.getElementById("chartOptionsDialog");
 if(dialog)dialog.remove();
 dialog=document.createElement("dialog");
 dialog.id="chartOptionsDialog";
 dialog.className="chart-options-dialog";
 dialog.setAttribute("aria-label","Opcions del gràfic de "+spec.name);
 const form=document.createElement("form");
 form.noValidate=true;
 const head=document.createElement("div");head.className="chart-modal-head";
 const title=document.createElement("h2");title.textContent="Opcions · "+spec.name;
 const close=document.createElement("button");close.type="button";close.textContent="×";close.className="chart-modal-close";close.setAttribute("aria-label","Tanca");
 close.onclick=()=>dialog.close();head.append(title,close);form.append(head);
 const grid=document.createElement("div");grid.className="chart-modal-grid";
 const controls={};
 for(const [key,labelText,kind] of fields){
   const label=document.createElement("label");label.className="chart-modal-field";
   const heading=document.createElement("span");heading.textContent=labelText;
   label.append(heading);
   let input;
   if(["interval","type","bool"].includes(kind)){
     input=document.createElement("select");
     const pairs=kind==="interval"?SELECT_INTERVALS.map(v=>[v,v==="daily"?"Diària":v?v+" min":"Sense agrupar"]):
       kind==="bool"?[["true","Sí"],["false","No"]]:
       Object.entries(typeLabels);
     for(const [value,text] of pairs){const opt=document.createElement("option");opt.value=value;opt.textContent=text;input.append(opt);}
     input.value=kind==="bool"?String(options[key]):String(options[key]||"");
   }else{
     input=document.createElement("input");
     input.type=kind==="color"?"color":kind==="text"?"text":"number";
     if(kind==="number")input.step="any";
     if(kind==="integer")input.min="1";
     if(kind==="digits"){input.min="0";input.max="6";}
     if(kind==="color")input.value=options[key];
     else input.value=options[key]||"";
     if(kind==="text")input.maxLength=90;
     if(kind!=="color")input.placeholder="Automàtic";
   }
   input.name=key;input.id="chartOpt-"+key;
   label.append(input);controls[key]=input;grid.append(label);
 }
 for(const key of ["timescale","average","median","sum"]){
   controls[key].addEventListener("change",()=>{
     if(controls[key].value)
       for(const other of ["timescale","average","median","sum"])
         if(other!==key)controls[other].value="";
   });
 }
 controls.days.addEventListener("input",()=>{if(controls.days.value)controls.results.value="";});
 controls.results.addEventListener("input",()=>{if(controls.results.value)controls.days.value="";});
 form.append(grid);
 const info=document.createElement("p");info.className="chart-modal-info";
 info.textContent="Els càlculs es fan amb les lectures desades en aquest navegador. Days i Results són alternatius. Timescale, Mitjana, Mediana i Suma també són alternatius. Les escales només canvien la visualització.";
 form.append(info);
 const err=document.createElement("div");err.className="chart-modal-error";err.setAttribute("role","alert");form.append(err);
 const buttons=document.createElement("div");buttons.className="chart-modal-actions";
 const reset=document.createElement("button");reset.type="button";reset.textContent="Restableix";reset.onclick=()=>{
   const d=window.ThingSpeakChartOptions.defaults(spec);
   for(const [key] of fields)controls[key].value=typeof d[key]==="boolean"?String(d[key]):d[key];
   err.textContent="";
 };
 const cancel=document.createElement("button");cancel.type="button";cancel.textContent="Cancel·la";cancel.onclick=()=>dialog.close();
 const save=document.createElement("button");save.type="submit";save.textContent="Desa";save.className="chart-save";
 buttons.append(reset,cancel,save);form.append(buttons);
 form.addEventListener("submit",e=>{
   e.preventDefault();
   const values={};
   for(const [key,,kind] of fields)values[key]=kind==="bool"?controls[key].value==="true":controls[key].value.trim();
   for(const [low,high] of [["validMin","validMax"],["yMin","yMax"]]){
     if(values[low]!=="" && values[high]!=="" && Number(values[low])>=Number(values[high])){
       err.textContent="El valor mínim ha de ser inferior al màxim.";return;
     }
   }
   if(values.days && !(Number(values.days)>0 && Number(values.days)<=36500)){
     err.textContent="Indica un nombre de dies vàlid.";return;
   }
   if(values.results && !(Number(values.results)>0 && Number.isInteger(Number(values.results)))){
     err.textContent="Indica un nombre de resultats enter i positiu.";return;
   }
   if(values.rounding && !(Number(values.rounding)>=0 && Number(values.rounding)<=6 && Number.isInteger(Number(values.rounding)))){
     err.textContent="L'arrodoniment ha de ser entre 0 i 6 decimals.";return;
   }
   const normalized=window.ThingSpeakChartOptions.normalize(spec,values);
   onSave(normalized);
   dialog.close();
 });
 dialog.addEventListener("close",()=>dialog.remove(),{once:true});
 dialog.append(form);document.body.append(dialog);dialog.showModal();
}
window.ThingSpeakChartDialog=Object.freeze({open});
})();