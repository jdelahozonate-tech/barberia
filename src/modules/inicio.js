// Módulo de inicio e informes gerenciales.
function crearModuloInicioCompleto(deps) {
 const { $, sb, S, esc, dinero, hora, fecha, toast, ADM, mio } = deps;
 const bonitoSeguro=typeof deps.bonito==='function'?deps.bonito:value=>{const s=String(value??'').replace(/_/g,' ').toLowerCase();return s?s[0].toUpperCase()+s.slice(1):''};
 const RG=[['hoy','Hoy'],['ayer','Ayer'],['semana','Esta semana'],['mes','Este mes'],['30','Últimos 30 días'],['custom','Personalizado']];
 let ejecucion=0;
 const suma=(a,f)=>a.reduce((t,x)=>t+Number(f(x)||0),0),localFecha=d=>fecha(d);
 function rango(v,a,b){
  const d=new Date();d.setHours(0,0,0,0);const s=new Date(d),e=new Date(d);e.setDate(e.getDate()+1);
  if(v==='ayer'){s.setDate(s.getDate()-1);e.setTime(d.getTime())}
  else if(v==='semana')s.setDate(s.getDate()-((s.getDay()+6)%7));
  else if(v==='mes')s.setDate(1);
  else if(v==='30')s.setDate(s.getDate()-29);
  else if(v==='custom'){const x=new Date((a||localFecha(d))+'T00:00:00'),y=new Date((b||localFecha(d))+'T00:00:00');if(!Number.isFinite(x.getTime())||!Number.isFinite(y.getTime())||x>y)throw new Error('El rango personalizado no es válido.');y.setDate(y.getDate()+1);return[x,y]}
  return[s,e]
 }
 async function todos(q,nombre){
  const filas=[];let desde=0;
  while(true){const c=new AbortController(),timer=setTimeout(()=>c.abort(),20000);let r;try{r=await q.abortSignal(c.signal).range(desde,desde+999)}catch(error){r={data:null,error}}finally{clearTimeout(timer)}
   if(r.error)return{data:null,error:{message:c.signal.aborted?'La consulta de '+nombre+' superó los 20 segundos.':nombre+': '+r.error.message}};
   const bloque=r.data||[];filas.push(...bloque);if(bloque.length<1000)break;desde+=1000;if(desde>=50000)return{data:null,error:{message:'La consulta de '+nombre+' superó el límite de 50.000 registros.'}}
  }return{data:filas,error:null}
 }
 const shortMoney=n=>{const v=Number(n)||0,a=Math.abs(v);return a>=1e9?'
 const { $, sb, S, esc, dinero, hora, fecha, bonito, toast, ADM, mio, fila2, porConfirmar } = deps;
const RG=[['hoy','Hoy'],['ayer','Ayer'],['semana','Esta semana'],['mes','Este mes'],['30','Últimos 30 días'],['custom','Personalizado']];
let informeEjecucion=0;
function rango(v,a,b){const d=new Date();d.setHours(0,0,0,0);const s=new Date(d);let e=new Date(d);e.setDate(e.getDate()+1);
 if(v==='ayer'){s.setDate(s.getDate()-1);e=new Date(d)}
 else if(v==='semana')s.setDate(s.getDate()-((s.getDay()+6)%7));
 else if(v==='mes')s.setDate(1);
 else if(v==='30')s.setDate(s.getDate()-29);
 else if(v==='custom'){const x=new Date((a||fecha(d))+'T00:00:00');e=new Date((b||fecha(d))+'T00:00:00');e.setDate(e.getDate()+1);return[x,e]}
 return[s,e]}
function inicio(){return ADM.includes(S.perfil.rol)?informe():inicioSimple()}
async function todos(q,nombre){
 const filas=[];let desde=0;
 while(true){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),20000);
  let resultado;
  try{resultado=await q.abortSignal(controller.signal).range(desde,desde+999)}
  catch(error){resultado={data:null,error}}
  finally{clearTimeout(timer)}
  if(resultado.error)return{data:null,error:{message:controller.signal.aborted?'La consulta de '+nombre+' superó los 20 segundos. Revisa la conexión o los permisos de lectura.':nombre+': '+resultado.error.message}};
  const bloque=resultado.data||[];filas.push(...bloque);
  if(bloque.length<1000)break;
  desde+=1000;
  if(desde>=50000)return{data:null,error:{message:'La consulta de '+nombre+' superó el límite de seguridad de 50.000 registros para este informe.'}};
 }
 return{data:filas,error:null};
}
function graficaComparativa(serie){
 if(!serie.length)return '<p class="mute">No hay movimientos en el periodo seleccionado.</p>';
 const max=Math.max(1,...serie.map(([,v])=>Math.max(v.ventas,v.gastos)));
 return '<div class="dash-chart">'+serie.map(([k,v])=>'<div class="dash-day"><span class="date">'+esc(k.slice(5))+'</span><div class="dash-bars"><div class="dash-bar rev"><i style="width:'+100*v.ventas/max+'%"></i></div><div class="dash-bar exp"><i style="width:'+100*v.gastos/max+'%"></i></div></div><span class="amount">'+dinero(v.ventas)+'</span></div>').join('')+'</div><div class="dash-legend"><span>Ventas</span><span>Gastos</span></div>';
}
function grafica(titulo,serie,campo,maximo,color){ return graficaComparativa(serie); }
function graficaIndicador(serie,campo,esMoneda=true){
 if(!serie.length||!serie.some(([,v])=>Number(v[campo]||0)!==0))return '<p class="mute">No hay movimientos en el periodo seleccionado.</p>';
 const max=Math.max(1,...serie.map(([,v])=>Math.abs(Number(v[campo]||0))));
 return '<div class="dash-chart">'+serie.map(([k,v])=>{
  const n=Number(v[campo]||0),ancho=100*Math.abs(n)/max;
  return '<div class="dash-day"><span class="date">'+esc(k.slice(5))+'</span><div class="dash-bars"><div class="dash-bar '+(n<0?'exp':'rev')+'"><i style="width:'+ancho+'%"></i></div></div><span class="amount">'+(esMoneda?dinero(n):String(Math.round(n)))+'</span></div>';
 }).join('')+'</div>';
}
function barras(titulo,datos,total){
 if(!datos.length)return '';
 const max=Math.max(1,...datos.map(x=>x.valor));
 return '<div class="dash-card"><h3>'+titulo+'</h3><p class="sub">Participación sobre el total del periodo</p><div class="dash-breakdown">'+datos.map(x=>'<div class="dash-break-row"><span>'+esc(x.nombre)+'</span><strong>'+dinero(x.valor)+'</strong><div class="dash-break-track"><i style="width:'+100*x.valor/max+'%"></i></div></div>').join('')+'</div></div>';
}
async function informe(){
 if(!document.getElementById('dashboard-chart-style')){const css=document.createElement('style');css.id='dashboard-chart-style';
 css.textContent=`
 #main:has(#inf){max-width:1240px}
 .dash-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin:10px 0 18px;flex-wrap:wrap}
 .dash-kicker{font-size:11px;letter-spacing:.13em;text-transform:uppercase;color:#63738a;font-weight:800}
 .dash-title{font-size:clamp(25px,4vw,34px);letter-spacing:-.04em;margin:3px 0 4px}
 .dash-sub{font-size:13px;color:#65748a}
 .dash-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
 .dash-actions select,.dash-actions input{min-width:145px;width:auto;padding:10px 12px;font-size:13px}
 .dash-actions .btn{padding:10px 14px;font-size:13px}
 .dash-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:14px 0}
 .dash-kpi{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px;min-width:0;box-shadow:0 3px 12px #10223f08;cursor:pointer;text-align:left;width:100%;font:inherit;transition:border-color .18s,box-shadow .18s,transform .18s}
 .dash-kpi:hover{border-color:#9aabc0;transform:translateY(-2px)}
 .dash-kpi:focus-visible{outline:3px solid #8bb8dc;outline-offset:2px}
 .dash-kpi.primary{box-shadow:0 0 0 2px #102b4920,0 5px 16px #10223f12}
 .dash-kpi.primary small{color:#c2d1e2}
 .dash-kpi.primary em{color:#b6c8da}
 .dash-kpi.primary{background:#102b49;color:#fff;border-color:#102b49}
 .dash-kpi small{display:block;font-size:12px;color:#718096;font-weight:600}
 .dash-kpi.primary small{color:#c2d1e2}
 .dash-kpi strong{display:block;font-size:clamp(19px,2.5vw,27px);letter-spacing:-.03em;margin:7px 0 4px;overflow-wrap:anywhere}
 .dash-kpi em{font-style:normal;font-size:11px;color:#748398}
 .dash-kpi.primary em{color:#b6c8da}
 .dash-grid{display:grid;grid-template-columns:1.45fr 1fr;gap:14px;margin:14px 0}
 .dash-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:17px;min-width:0;box-shadow:0 3px 12px #10223f08}
 .dash-card h3{font-size:15px;margin:0 0 4px;letter-spacing:-.01em}
 .dash-card .sub{font-size:12px;color:#718096;margin:0 0 14px}
 .dash-chart{display:grid;gap:10px}
 .dash-day{display:grid;grid-template-columns:44px minmax(0,1fr) 90px;gap:10px;align-items:center;font-size:11px}
 .dash-day .date{color:#758398}
 .dash-bars{display:grid;gap:4px}
 .dash-bar{height:8px;background:#edf1f5;border-radius:20px;overflow:hidden}
 .dash-bar i{display:block;height:100%;border-radius:20px}
 .dash-bar.rev i{background:#1d8068}.dash-bar.exp i{background:#e2a04b}
 .dash-day .amount{font-variant-numeric:tabular-nums;text-align:right;color:#46566b;white-space:nowrap}
 .dash-legend{display:flex;gap:14px;margin-top:13px;font-size:11px;color:#65748a}
 .dash-legend span:before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;background:#1d8068;margin-right:5px}
 .dash-legend span+span:before{background:#e2a04b}
 .dash-breakdown{display:grid;gap:12px}
 .dash-break-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;font-size:12px}
 .dash-break-row strong{font-variant-numeric:tabular-nums}
 .dash-break-track{grid-column:1/-1;height:7px;background:#edf1f5;border-radius:10px;overflow:hidden}
 .dash-break-track i{display:block;height:100%;background:#467ba8;border-radius:10px}
 .dash-metric-list{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}
 .dash-metric{background:#f5f7fa;border-radius:9px;padding:10px}
 .dash-metric small{display:block;color:#748398;font-size:10px}
 .dash-metric b{font-size:14px}
 .dash-state{display:grid;grid-template-columns:105px 1fr 26px;gap:9px;align-items:center;margin:11px 0;font-size:12px}
 .dash-state .track{height:8px;background:#edf1f5;border-radius:20px;overflow:hidden}
 .dash-state i{display:block;height:100%;background:#467ba8;border-radius:20px}
 .dash-state b{text-align:right;font-variant-numeric:tabular-nums}
 .dash-section{margin:14px 0}
 .dash-section h3{font-size:15px;margin:0 0 9px}
 .dash-section .ln2{padding:10px 2px;font-size:13px}
 .dash-note{border-left:3px solid #e2a04b;background:#fff9ed;border-radius:0 9px 9px 0;padding:11px 13px;color:#725b36;font-size:12px;margin:12px 0}
 .dash-loading{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:28px;color:#65748a}
 @media(max-width:700px){.dash-kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.dash-kpi{padding:13px}.dash-grid{grid-template-columns:1fr;gap:10px}.dash-card{padding:14px}.dash-day{grid-template-columns:38px minmax(0,1fr) 82px;gap:7px}.dash-metric-list{grid-template-columns:repeat(3,1fr)}.dash-state{grid-template-columns:90px 1fr 24px}}
 @media(min-width:1000px){.dash-kpis{grid-template-columns:repeat(6,minmax(0,1fr))}}
 ` ;
 document.head.appendChild(css);}
 const[s,e]=rango(S.rg||'hoy',S.ra,S.rb),A=s.toISOString(),B=e.toISOString(),rg=S.rg||'hoy';
 $('#main').innerHTML=`<div class="dash-head"><div><div class="dash-kicker">DH Barber · Inteligencia de negocio</div><h2 class="dash-title">Panel gerencial</h2><div class="dash-sub">Indicadores financieros y operativos · ${RG.find(x=>x[0]===rg)?.[1]||'Periodo personalizado'}</div></div><div class="dash-actions"><select id="rg" aria-label="Periodo">${RG.map(([k,l])=>`<option value="${k}"${k===rg?' selected':''}>${l}</option>`).join('')}</select>${rg==='custom'?`<input type="date" id="ra" value="${S.ra||fecha(new Date())}" aria-label="Desde"><input type="date" id="rb" value="${S.rb||fecha(new Date())}" aria-label="Hasta">`:''}<button class="btn sec" id="ex" disabled>Exportar CSV</button></div></div><div id="inf"><div class="dash-loading">Consultando ventas, pagos, gastos y citas…</div></div>`;
 $('#rg').onchange=x=>{S.rg=x.target.value;informe()};
 porConfirmar();
 if(rg==='custom')['ra','rb'].forEach(i=>$('#'+i).onchange=x=>{S[i]=x.target.value;informe()});
 const ejecucion=++informeEjecucion;
 const fuentes=[
  ['ventas',sb.from('ventas').select('id,descuento,fecha_hora,total_venta').eq('negocio_id',S.perfil.negocio_id).neq('estado_venta','ANULADA').gte('fecha_hora',A).lt('fecha_hora',B).order('id',{ascending:true})],
  ['detalles de ventas',sb.from('detalle_ventas').select('tipo_item,descripcion,cantidad,subtotal,costo_unitario,comision_generada,ventas!inner(estado_venta,fecha_hora,barberos(nombre))').eq('negocio_id',S.perfil.negocio_id).neq('ventas.estado_venta','ANULADA').gte('ventas.fecha_hora',A).lt('ventas.fecha_hora',B).order('id',{ascending:true})],
  ['pagos',sb.from('pagos').select('valor_pago,metodo_pago,fecha_hora,cuentas(nombre),ventas!inner(estado_venta)').eq('negocio_id',S.perfil.negocio_id).eq('estado_pago','REGISTRADO').neq('ventas.estado_venta','ANULADA').gte('fecha_hora',A).lt('fecha_hora',B).order('id',{ascending:true})],
  ['gastos',sb.from('gastos').select('categoria_gasto,descripcion,valor,metodo_pago,estado_gasto,fecha_hora').eq('negocio_id',S.perfil.negocio_id).eq('estado_gasto','REGISTRADO').gte('fecha_hora',A).lt('fecha_hora',B).order('id',{ascending:true})],
  ['citas',sb.from('citas').select('inicio,estado').eq('negocio_id',S.perfil.negocio_id).gte('inicio',A).lt('inicio',B).order('id',{ascending:true})]
 ];
 let pendientes=fuentes.map(x=>x[0]);
 $('#inf').innerHTML='<p class="empty">Consultando: '+pendientes.join(', ')+'…</p>';
 const respuestas=await Promise.all(fuentes.map(async([nombre,q])=>{
  const r=await todos(q,nombre);
  if(ejecucion===informeEjecucion){
   pendientes=pendientes.filter(x=>x!==nombre);
   const panel=$('#inf');
   if(panel)panel.innerHTML=r.error
    ?'<p class="empty">No fue posible cargar '+esc(nombre)+': '+esc(r.error.message)+'</p>'
    :pendientes.length?'<p class="empty">Datos recibidos. Falta consultar: '+esc(pendientes.join(', '))+'…</p>':'<p class="empty">Preparando resultados…</p>';
  }
  return r;
 }));
 if(ejecucion!==informeEjecucion||!$('#inf'))return;
 const fallo=respuestas.find(r=>r.error);if(fallo){$('#inf').innerHTML='<p class="empty">No fue posible cargar el informe: '+esc(fallo.error.message)+'</p>';return}
 let etapa='validando los datos';
 try{
 const panelEtapa=mensaje=>{const panel=$('#inf');if(panel)panel.innerHTML='<p class="empty">'+mensaje+'</p>'};
 panelEtapa('Consultas completas. Validando datos…');
 await new Promise(resolve=>setTimeout(resolve,0));
 const[V,D,P,G,C]=respuestas.map(r=>r.data||[]);
 etapa='calculando ventas, costos y gastos';
 panelEtapa('Calculando ventas, costos y gastos…');
 await new Promise(resolve=>setTimeout(resolve,0));
 const sum=(a,f)=>a.reduce((t,x)=>t+Number(f(x)||0),0),cl=x=>Number(x.costo_unitario)*Number(x.cantidad)+Number(x.comision_generada);
 const bruto=sum(D,x=>x.subtotal),desc=sum(V,x=>x.descuento),neto=bruto-desc,costo=sum(D,x=>Number(x.costo_unitario)*Number(x.cantidad)),com=sum(D,x=>x.comision_generada);
 const gast=sum(G.filter(x=>!['COMISIONES','PRODUCTOS'].includes(x.categoria_gasto)),x=>x.valor),util=neto-costo-com-gast;
 const grp=(a,k,f)=>{const m={};a.forEach(x=>{const n=k(x);m[n]=m[n]||{n,c:0,i:0,k:0};f(m[n],x)});return Object.values(m)};
 const lin=(g,e)=>fila2(esc(g.n)+'<br><small>'+g.c+' '+e+', ingresos '+dinero(g.i)+', costo '+dinero(g.k)+'</small>',dinero(g.i-g.k));
 const mg=(a,k,e,flt)=>grp(a.filter(flt||(()=>true)),k,(g,x)=>{g.c+=Number(x.cantidad||0);g.i+=Number(x.subtotal||0);g.k+=cl(x)}).sort((p,q)=>(q.i-q.k)-(p.i-p.k)).map(g=>lin(g,e));
 const sec=(t,r)=>r.length?(t?'<label>'+t+'</label>':'')+r.join(''):'';
 const pm=grp(P,x=>bonito(x.metodo_pago),(g,x)=>{g.i+=Number(x.valor_pago)}).map(g=>fila2(esc(g.n),dinero(g.i))),pc=grp(P.filter(x=>x.cuentas),x=>x.cuentas.nombre,(g,x)=>{g.i+=Number(x.valor_pago)}).map(g=>fila2(esc(g.n),dinero(g.i)));
 etapa='construyendo gráficas y agrupaciones';panelEtapa('Preparando gráficas y agrupaciones…');await new Promise(resolve=>setTimeout(resolve,0));
 const dias={};
 const dia=k=>dias[k]||(dias[k]={ventas:0,gastos:0,citas:0,recaudo:0,operaciones:0,costos:0,utilidad:0});
 V.forEach(x=>{const d=dia(fecha(new Date(x.fecha_hora)));d.ventas+=Number(x.total_venta||0);d.operaciones++});
 D.forEach(x=>{const k=x.ventas?.fecha_hora;if(!k)return;dia(fecha(new Date(k))).costos+=cl(x)});
 P.forEach(x=>{dia(fecha(new Date(x.fecha_hora))).recaudo+=Number(x.valor_pago||0)});
 G.filter(x=>!['COMISIONES','PRODUCTOS'].includes(x.categoria_gasto)).forEach(x=>{const d=dia(fecha(new Date(x.fecha_hora)));d.gastos+=Number(x.valor||0)});
 C.forEach(x=>{const d=dia(fecha(new Date(x.inicio)));d.citas++;if(x.estado==='ATENDIDA')d.atendidas=(d.atendidas||0)+1});
 Object.values(dias).forEach(d=>{d.utilidad=d.ventas-d.costos-d.gastos});
 const serie=Object.entries(dias).sort((a,b)=>a[0].localeCompare(b[0])).slice(-14),cobrado=sum(P,x=>x.valor_pago),ticket=V.length?neto/V.length:0;
 etapa='dibujando el informe';panelEtapa('Mostrando resultados…');await new Promise(resolve=>setTimeout(resolve,0));
 const margen=neto?util/neto*100:0,ratioCobro=neto?cobrado/neto*100:0,atendidas=C.filter(x=>x.estado==='ATENDIDA').length,pendientesC=C.filter(x=>['PENDIENTE','CONFIRMADA'].includes(x.estado)).length;
 const pagosMetodo=grp(P,x=>bonito(x.metodo_pago),(g,x)=>{g.i+=Number(x.valor_pago)}).map(g=>({nombre:g.n,valor:g.i})).sort((a,b)=>b.valor-a.valor);
 const topBarberos=grp(D,x=>x.ventas?.barberos?.nombre||'Sin barbero',(g,x)=>{g.i+=Number(x.subtotal||0);g.k+=cl(x);g.c+=Number(x.cantidad||0)}).map(g=>({nombre:g.n,valor:g.i-g.k})).sort((a,b)=>b.valor-a.valor).slice(0,5);
 const topServicios=grp(D.filter(x=>x.tipo_item==='SERVICIO'),x=>x.descripcion,(g,x)=>{g.i+=Number(x.subtotal||0);g.k+=cl(x);g.c+=Number(x.cantidad||0)}).map(g=>({nombre:g.n,valor:g.i-g.k})).sort((a,b)=>b.valor-a.valor).slice(0,5);
 const estados=['PENDIENTE','CONFIRMADA','ATENDIDA','CANCELADA','NO_ASISTIO'].map(k=>({k,n:C.filter(x=>x.estado===k).length})),maxEstado=Math.max(1,...estados.map(x=>x.n));
 const citasGraf=estados.map(x=>'<div class="dash-state"><span>'+bonito(x.k)+'</span><div class="track"><i style="width:'+100*x.n/maxEstado+'%"></i></div><b>'+x.n+'</b></div>').join('');
 $('#inf').innerHTML=`<div class="dash-kpis">
 <button type="button" class="dash-kpi primary" data-metric="ingresos" aria-pressed="true"><small>Ingresos por ventas</small><strong>${dinero(neto)}</strong><em>Ventas netas del periodo</em></button>
 <button type="button" class="dash-kpi" data-metric="utilidad" aria-pressed="false"><small>Utilidad estimada</small><strong>${dinero(util)}</strong><em>Margen: ${margen.toFixed(1)}%</em></button>
 <button type="button" class="dash-kpi" data-metric="recaudo" aria-pressed="false"><small>Recaudo registrado</small><strong>${dinero(cobrado)}</strong><em>${ratioCobro.toFixed(1)}% de ventas netas</em></button>
 <button type="button" class="dash-kpi" data-metric="operaciones" aria-pressed="false"><small>Operaciones de venta</small><strong>${V.length}</strong><em>Ticket promedio: ${dinero(ticket)}</em></button>
 <button type="button" class="dash-kpi" data-metric="citas" aria-pressed="false"><small>Citas atendidas</small><strong>${atendidas}</strong><em>${pendientesC} pendientes o confirmadas</em></button>
 <button type="button" class="dash-kpi" data-metric="gastos" aria-pressed="false"><small>Gastos operativos</small><strong>${dinero(gast)}</strong><em>${neto? (gast/neto*100).toFixed(1):'0.0'}% de ingresos</em></button>
 </div>
 <div class="dash-grid">
 <section class="dash-card" id="dash-dynamic-graph" aria-live="polite"></section>
 <section class="dash-card"><h3>Rentabilidad del periodo</h3><p class="sub">Composición de ingresos y costos</p>
 <div class="dash-breakdown">
 ${[['Ventas brutas',bruto],['Descuentos',-desc],['Costo de productos',-costo],['Comisiones',-com],['Gastos operativos',-gast],['Utilidad estimada',util]].map(([n,v])=>'<div class="dash-break-row"><span>'+n+'</span><strong>'+dinero(v)+'</strong></div>').join('')}
 </div><div class="dash-metric-list"><div class="dash-metric"><small>Margen utilidad</small><b>${margen.toFixed(1)}%</b></div><div class="dash-metric"><small>Ticket medio</small><b>${dinero(ticket)}</b></div><div class="dash-metric"><small>Ventas</small><b>${V.length}</b></div></div></section>
 </div>
 <div class="dash-grid">
 <section class="dash-card"><h3>Actividad de citas</h3><p class="sub">Estado de las citas · distribución por estado · ${C.length} citas</p>${citasGraf}</section>
 <section class="dash-card"><h3>Recaudo por medio de pago</h3><p class="sub">Pagos registrados y no anulados</p>${pagosMetodo.length?'<div class="dash-breakdown">'+pagosMetodo.map(x=>'<div class="dash-break-row"><span>'+esc(x.nombre)+'</span><strong>'+dinero(x.valor)+'</strong><div class="dash-break-track"><i style="width:'+100*x.valor/Math.max(1,...pagosMetodo.map(y=>y.valor))+'%"></i></div></div>').join('')+'</div>':'<p class="mute">Sin pagos registrados en el periodo.</p>'}</section>
 </div>
 <div class="dash-grid">${barras('Rentabilidad por barbero',topBarberos)}${barras('Servicios con mayor margen',topServicios)}</div>
 <div class="dash-section"><h3>Detalle de rentabilidad por producto</h3>${sec('',mg(D,x=>x.descripcion,'unidades',x=>x.tipo_item==='PRODUCTO').slice(0,8))}</div>
 <div class="dash-note">Criterio contable: la utilidad mostrada es estimada con ventas netas menos costo de productos vendidos, comisiones y gastos operativos registrados. Las compras de inventario y liquidaciones de comisiones no se descuentan otra vez para evitar duplicidad.</div>
 <div class="dash-section"><h3>Recaudo por cuenta</h3>${sec('',pc)}</div>`;
 const metricas={
  ingresos:{titulo:'Comportamiento del negocio',descripcion:'Ventas por día y Gastos por día · últimos 14 días del periodo.',campo:'ventas',moneda:true},
  utilidad:{titulo:'Evolución de utilidad estimada',descripcion:'Ingresos diarios menos costos, comisiones y gastos operativos.',campo:'utilidad',moneda:true},
  recaudo:{titulo:'Evolución del recaudo',descripcion:'Pagos registrados por día, según su fecha de registro.',campo:'recaudo',moneda:true},
  operaciones:{titulo:'Operaciones de venta',descripcion:'Cantidad de ventas registradas por día.',campo:'operaciones',moneda:false},
  citas:{titulo:'Actividad de citas',descripcion:'Cantidad de citas programadas por día.',campo:'citas',moneda:false},
  gastos:{titulo:'Evolución de gastos operativos',descripcion:'Gastos registrados por día, excluyendo compras de inventario y liquidaciones de comisiones.',campo:'gastos',moneda:true}
 };
 const pintarGrafica=clave=>{
  const m=metricas[clave]||metricas.ingresos,panel=$('#dash-dynamic-graph');
  if(!panel)return;
  panel.innerHTML='<h3>'+m.titulo+'</h3><p class="sub">'+m.descripcion+'</p>'+(clave==='ingresos'?graficaComparativa(serie):graficaIndicador(serie,m.campo,m.moneda));
 };
 const tarjetas=Array.from(document.querySelectorAll('#inf .dash-kpi[data-metric]'));
 tarjetas.forEach(tarjeta=>tarjeta.addEventListener('click',()=>{
  tarjetas.forEach(otra=>{
   const activa=otra===tarjeta;
   otra.classList.toggle('primary',activa);
   otra.setAttribute('aria-pressed',String(activa));
  });
  pintarGrafica(tarjeta.dataset.metric);
 }));
 pintarGrafica('ingresos');
 $('#ex').onclick=()=>{
 const csvCell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
 const lineas=[['Tipo','Fecha','Concepto','Barbero','Método','Estado','Cantidad','Ingreso','Costo','Descuento']];
 V.forEach(x=>lineas.push(['VENTA',x.fecha_hora,'Venta '+x.id,'','','',1,Number(x.total_venta||0),0,Number(x.descuento||0)]));
 D.forEach(x=>lineas.push(['DETALLE',x.ventas?.fecha_hora||'',x.descripcion,x.ventas?.barberos?.nombre||'','',x.ventas?.estado_venta||'',x.cantidad,Number(x.subtotal||0),Number(x.costo_unitario||0)*Number(x.cantidad||0),0]));
 P.forEach(x=>lineas.push(['PAGO',x.fecha_hora,'Recaudo','',x.metodo_pago,'REGISTRADO',1,Number(x.valor_pago||0),0,0]));
 G.forEach(x=>lineas.push(['GASTO',x.fecha_hora,x.descripcion||x.categoria_gasto,'',x.metodo_pago,x.estado_gasto,1,-Number(x.valor||0),Number(x.valor||0),0]));
 C.forEach(x=>lineas.push(['CITA',x.inicio,'Cita','','',x.estado,1,0,0,0]));
 const contenido='\uFEFF'+lineas.map(f=>f.map(csvCell).join(';')).join('\r\n');
 const blob=new Blob([contenido],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='informe-barberia-'+fecha(s)+'-'+fecha(new Date(e.getTime()-86400000))+'.csv';
 document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);toast('Informe CSV generado');
 };
 $('#ex').disabled=false;
 }catch(error){
  console.error('Error preparando informe gerencial:',etapa,error);
  const panel=$('#inf');
  if(panel)panel.innerHTML='<p class="empty">No se pudo preparar el informe al '+esc(etapa)+': '+esc(error?.message||String(error))+'</p>';
 }
}

/* ---------- Resumen y ajustes ---------- */
async function inicioSimple(){
 const h0=new Date();h0.setHours(0,0,0,0);const h1=new Date(h0);h1.setDate(h1.getDate()+1);
 const respuestas=await Promise.all([
  mio(sb.from('ventas').select('total_venta').neq('estado_venta','ANULADA').gte('fecha_hora',h0.toISOString()).lt('fecha_hora',h1.toISOString())),
  mio(sb.from('citas').select('inicio,estado,clientes(nombre),barberos(nombre)').in('estado',['PENDIENTE','CONFIRMADA']).gte('inicio',h0.toISOString()).lt('inicio',h1.toISOString())).order('inicio'),
  ADM.includes(S.perfil.rol)?sb.from('stock_actual').select('nombre,existencias,stock_minimo').eq('negocio_id',S.perfil.negocio_id):Promise.resolve({data:[]})]);
 const fallo=respuestas.find(r=>r.error);if(fallo)return toast('No fue posible cargar el resumen: '+fallo.error.message,true);
 const[{data:v},{data:c},{data:s}]=respuestas;
 const tot=(v||[]).reduce((a,x)=>a+Number(x.total_venta),0),bajo=(s||[]).filter(x=>Number(x.existencias)<=Number(x.stock_minimo)),prox=(c||[]).filter(x=>new Date(x.inicio)>=new Date());
 $('#main').innerHTML=`<div class="head"><h2>Hoy</h2></div>
 <div class="kp"><div><small>Vendido hoy</small><strong>${dinero(tot)}</strong></div><div><small>Ventas</small><strong>${(v||[]).length}</strong></div><div><small>Citas pendientes</small><strong>${(c||[]).length}</strong></div></div>
 <label>Próximas citas</label>${prox.length?prox.slice(0,5).map(x=>fila2(hora(x.inicio)+', '+esc(x.clientes?.nombre),esc(x.barberos?.nombre))).join(''):'<p class="empty">No hay más citas por atender hoy.</p>'}
 ${bajo.length?'<label>Stock bajo</label>'+bajo.map(x=>fila2(esc(x.nombre),x.existencias+' (mínimo '+x.stock_minimo+')')).join(''):''}`;
}

 return { inicio };
}
+(v/1e9).toFixed(1)+' mil M':a>=1e6?'
 const { $, sb, S, esc, dinero, hora, fecha, bonito, toast, ADM, mio, fila2, porConfirmar } = deps;
const RG=[['hoy','Hoy'],['ayer','Ayer'],['semana','Esta semana'],['mes','Este mes'],['30','Últimos 30 días'],['custom','Personalizado']];
let informeEjecucion=0;
function rango(v,a,b){const d=new Date();d.setHours(0,0,0,0);const s=new Date(d);let e=new Date(d);e.setDate(e.getDate()+1);
 if(v==='ayer'){s.setDate(s.getDate()-1);e=new Date(d)}
 else if(v==='semana')s.setDate(s.getDate()-((s.getDay()+6)%7));
 else if(v==='mes')s.setDate(1);
 else if(v==='30')s.setDate(s.getDate()-29);
 else if(v==='custom'){const x=new Date((a||fecha(d))+'T00:00:00');e=new Date((b||fecha(d))+'T00:00:00');e.setDate(e.getDate()+1);return[x,e]}
 return[s,e]}
function inicio(){return ADM.includes(S.perfil.rol)?informe():inicioSimple()}
async function todos(q,nombre){
 const filas=[];let desde=0;
 while(true){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),20000);
  let resultado;
  try{resultado=await q.abortSignal(controller.signal).range(desde,desde+999)}
  catch(error){resultado={data:null,error}}
  finally{clearTimeout(timer)}
  if(resultado.error)return{data:null,error:{message:controller.signal.aborted?'La consulta de '+nombre+' superó los 20 segundos. Revisa la conexión o los permisos de lectura.':nombre+': '+resultado.error.message}};
  const bloque=resultado.data||[];filas.push(...bloque);
  if(bloque.length<1000)break;
  desde+=1000;
  if(desde>=50000)return{data:null,error:{message:'La consulta de '+nombre+' superó el límite de seguridad de 50.000 registros para este informe.'}};
 }
 return{data:filas,error:null};
}
function graficaComparativa(serie){
 if(!serie.length)return '<p class="mute">No hay movimientos en el periodo seleccionado.</p>';
 const max=Math.max(1,...serie.map(([,v])=>Math.max(v.ventas,v.gastos)));
 return '<div class="dash-chart">'+serie.map(([k,v])=>'<div class="dash-day"><span class="date">'+esc(k.slice(5))+'</span><div class="dash-bars"><div class="dash-bar rev"><i style="width:'+100*v.ventas/max+'%"></i></div><div class="dash-bar exp"><i style="width:'+100*v.gastos/max+'%"></i></div></div><span class="amount">'+dinero(v.ventas)+'</span></div>').join('')+'</div><div class="dash-legend"><span>Ventas</span><span>Gastos</span></div>';
}
function grafica(titulo,serie,campo,maximo,color){ return graficaComparativa(serie); }
function graficaIndicador(serie,campo,esMoneda=true){
 if(!serie.length||!serie.some(([,v])=>Number(v[campo]||0)!==0))return '<p class="mute">No hay movimientos en el periodo seleccionado.</p>';
 const max=Math.max(1,...serie.map(([,v])=>Math.abs(Number(v[campo]||0))));
 return '<div class="dash-chart">'+serie.map(([k,v])=>{
  const n=Number(v[campo]||0),ancho=100*Math.abs(n)/max;
  return '<div class="dash-day"><span class="date">'+esc(k.slice(5))+'</span><div class="dash-bars"><div class="dash-bar '+(n<0?'exp':'rev')+'"><i style="width:'+ancho+'%"></i></div></div><span class="amount">'+(esMoneda?dinero(n):String(Math.round(n)))+'</span></div>';
 }).join('')+'</div>';
}
function barras(titulo,datos,total){
 if(!datos.length)return '';
 const max=Math.max(1,...datos.map(x=>x.valor));
 return '<div class="dash-card"><h3>'+titulo+'</h3><p class="sub">Participación sobre el total del periodo</p><div class="dash-breakdown">'+datos.map(x=>'<div class="dash-break-row"><span>'+esc(x.nombre)+'</span><strong>'+dinero(x.valor)+'</strong><div class="dash-break-track"><i style="width:'+100*x.valor/max+'%"></i></div></div>').join('')+'</div></div>';
}
async function informe(){
 if(!document.getElementById('dashboard-chart-style')){const css=document.createElement('style');css.id='dashboard-chart-style';
 css.textContent=`
 #main:has(#inf){max-width:1240px}
 .dash-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin:10px 0 18px;flex-wrap:wrap}
 .dash-kicker{font-size:11px;letter-spacing:.13em;text-transform:uppercase;color:#63738a;font-weight:800}
 .dash-title{font-size:clamp(25px,4vw,34px);letter-spacing:-.04em;margin:3px 0 4px}
 .dash-sub{font-size:13px;color:#65748a}
 .dash-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
 .dash-actions select,.dash-actions input{min-width:145px;width:auto;padding:10px 12px;font-size:13px}
 .dash-actions .btn{padding:10px 14px;font-size:13px}
 .dash-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:14px 0}
 .dash-kpi{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px;min-width:0;box-shadow:0 3px 12px #10223f08;cursor:pointer;text-align:left;width:100%;font:inherit;transition:border-color .18s,box-shadow .18s,transform .18s}
 .dash-kpi:hover{border-color:#9aabc0;transform:translateY(-2px)}
 .dash-kpi:focus-visible{outline:3px solid #8bb8dc;outline-offset:2px}
 .dash-kpi.primary{box-shadow:0 0 0 2px #102b4920,0 5px 16px #10223f12}
 .dash-kpi.primary small{color:#c2d1e2}
 .dash-kpi.primary em{color:#b6c8da}
 .dash-kpi.primary{background:#102b49;color:#fff;border-color:#102b49}
 .dash-kpi small{display:block;font-size:12px;color:#718096;font-weight:600}
 .dash-kpi.primary small{color:#c2d1e2}
 .dash-kpi strong{display:block;font-size:clamp(19px,2.5vw,27px);letter-spacing:-.03em;margin:7px 0 4px;overflow-wrap:anywhere}
 .dash-kpi em{font-style:normal;font-size:11px;color:#748398}
 .dash-kpi.primary em{color:#b6c8da}
 .dash-grid{display:grid;grid-template-columns:1.45fr 1fr;gap:14px;margin:14px 0}
 .dash-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:17px;min-width:0;box-shadow:0 3px 12px #10223f08}
 .dash-card h3{font-size:15px;margin:0 0 4px;letter-spacing:-.01em}
 .dash-card .sub{font-size:12px;color:#718096;margin:0 0 14px}
 .dash-chart{display:grid;gap:10px}
 .dash-day{display:grid;grid-template-columns:44px minmax(0,1fr) 90px;gap:10px;align-items:center;font-size:11px}
 .dash-day .date{color:#758398}
 .dash-bars{display:grid;gap:4px}
 .dash-bar{height:8px;background:#edf1f5;border-radius:20px;overflow:hidden}
 .dash-bar i{display:block;height:100%;border-radius:20px}
 .dash-bar.rev i{background:#1d8068}.dash-bar.exp i{background:#e2a04b}
 .dash-day .amount{font-variant-numeric:tabular-nums;text-align:right;color:#46566b;white-space:nowrap}
 .dash-legend{display:flex;gap:14px;margin-top:13px;font-size:11px;color:#65748a}
 .dash-legend span:before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;background:#1d8068;margin-right:5px}
 .dash-legend span+span:before{background:#e2a04b}
 .dash-breakdown{display:grid;gap:12px}
 .dash-break-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;font-size:12px}
 .dash-break-row strong{font-variant-numeric:tabular-nums}
 .dash-break-track{grid-column:1/-1;height:7px;background:#edf1f5;border-radius:10px;overflow:hidden}
 .dash-break-track i{display:block;height:100%;background:#467ba8;border-radius:10px}
 .dash-metric-list{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}
 .dash-metric{background:#f5f7fa;border-radius:9px;padding:10px}
 .dash-metric small{display:block;color:#748398;font-size:10px}
 .dash-metric b{font-size:14px}
 .dash-state{display:grid;grid-template-columns:105px 1fr 26px;gap:9px;align-items:center;margin:11px 0;font-size:12px}
 .dash-state .track{height:8px;background:#edf1f5;border-radius:20px;overflow:hidden}
 .dash-state i{display:block;height:100%;background:#467ba8;border-radius:20px}
 .dash-state b{text-align:right;font-variant-numeric:tabular-nums}
 .dash-section{margin:14px 0}
 .dash-section h3{font-size:15px;margin:0 0 9px}
 .dash-section .ln2{padding:10px 2px;font-size:13px}
 .dash-note{border-left:3px solid #e2a04b;background:#fff9ed;border-radius:0 9px 9px 0;padding:11px 13px;color:#725b36;font-size:12px;margin:12px 0}
 .dash-loading{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:28px;color:#65748a}
 @media(max-width:700px){.dash-kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.dash-kpi{padding:13px}.dash-grid{grid-template-columns:1fr;gap:10px}.dash-card{padding:14px}.dash-day{grid-template-columns:38px minmax(0,1fr) 82px;gap:7px}.dash-metric-list{grid-template-columns:repeat(3,1fr)}.dash-state{grid-template-columns:90px 1fr 24px}}
 @media(min-width:1000px){.dash-kpis{grid-template-columns:repeat(6,minmax(0,1fr))}}
 ` ;
 document.head.appendChild(css);}
 const[s,e]=rango(S.rg||'hoy',S.ra,S.rb),A=s.toISOString(),B=e.toISOString(),rg=S.rg||'hoy';
 $('#main').innerHTML=`<div class="dash-head"><div><div class="dash-kicker">DH Barber · Inteligencia de negocio</div><h2 class="dash-title">Panel gerencial</h2><div class="dash-sub">Indicadores financieros y operativos · ${RG.find(x=>x[0]===rg)?.[1]||'Periodo personalizado'}</div></div><div class="dash-actions"><select id="rg" aria-label="Periodo">${RG.map(([k,l])=>`<option value="${k}"${k===rg?' selected':''}>${l}</option>`).join('')}</select>${rg==='custom'?`<input type="date" id="ra" value="${S.ra||fecha(new Date())}" aria-label="Desde"><input type="date" id="rb" value="${S.rb||fecha(new Date())}" aria-label="Hasta">`:''}<button class="btn sec" id="ex" disabled>Exportar CSV</button></div></div><div id="inf"><div class="dash-loading">Consultando ventas, pagos, gastos y citas…</div></div>`;
 $('#rg').onchange=x=>{S.rg=x.target.value;informe()};
 porConfirmar();
 if(rg==='custom')['ra','rb'].forEach(i=>$('#'+i).onchange=x=>{S[i]=x.target.value;informe()});
 const ejecucion=++informeEjecucion;
 const fuentes=[
  ['ventas',sb.from('ventas').select('id,descuento,fecha_hora,total_venta').eq('negocio_id',S.perfil.negocio_id).neq('estado_venta','ANULADA').gte('fecha_hora',A).lt('fecha_hora',B).order('id',{ascending:true})],
  ['detalles de ventas',sb.from('detalle_ventas').select('tipo_item,descripcion,cantidad,subtotal,costo_unitario,comision_generada,ventas!inner(estado_venta,fecha_hora,barberos(nombre))').eq('negocio_id',S.perfil.negocio_id).neq('ventas.estado_venta','ANULADA').gte('ventas.fecha_hora',A).lt('ventas.fecha_hora',B).order('id',{ascending:true})],
  ['pagos',sb.from('pagos').select('valor_pago,metodo_pago,fecha_hora,cuentas(nombre),ventas!inner(estado_venta)').eq('negocio_id',S.perfil.negocio_id).eq('estado_pago','REGISTRADO').neq('ventas.estado_venta','ANULADA').gte('fecha_hora',A).lt('fecha_hora',B).order('id',{ascending:true})],
  ['gastos',sb.from('gastos').select('categoria_gasto,descripcion,valor,metodo_pago,estado_gasto,fecha_hora').eq('negocio_id',S.perfil.negocio_id).eq('estado_gasto','REGISTRADO').gte('fecha_hora',A).lt('fecha_hora',B).order('id',{ascending:true})],
  ['citas',sb.from('citas').select('inicio,estado').eq('negocio_id',S.perfil.negocio_id).gte('inicio',A).lt('inicio',B).order('id',{ascending:true})]
 ];
 let pendientes=fuentes.map(x=>x[0]);
 $('#inf').innerHTML='<p class="empty">Consultando: '+pendientes.join(', ')+'…</p>';
 const respuestas=await Promise.all(fuentes.map(async([nombre,q])=>{
  const r=await todos(q,nombre);
  if(ejecucion===informeEjecucion){
   pendientes=pendientes.filter(x=>x!==nombre);
   const panel=$('#inf');
   if(panel)panel.innerHTML=r.error
    ?'<p class="empty">No fue posible cargar '+esc(nombre)+': '+esc(r.error.message)+'</p>'
    :pendientes.length?'<p class="empty">Datos recibidos. Falta consultar: '+esc(pendientes.join(', '))+'…</p>':'<p class="empty">Preparando resultados…</p>';
  }
  return r;
 }));
 if(ejecucion!==informeEjecucion||!$('#inf'))return;
 const fallo=respuestas.find(r=>r.error);if(fallo){$('#inf').innerHTML='<p class="empty">No fue posible cargar el informe: '+esc(fallo.error.message)+'</p>';return}
 let etapa='validando los datos';
 try{
 const panelEtapa=mensaje=>{const panel=$('#inf');if(panel)panel.innerHTML='<p class="empty">'+mensaje+'</p>'};
 panelEtapa('Consultas completas. Validando datos…');
 await new Promise(resolve=>setTimeout(resolve,0));
 const[V,D,P,G,C]=respuestas.map(r=>r.data||[]);
 etapa='calculando ventas, costos y gastos';
 panelEtapa('Calculando ventas, costos y gastos…');
 await new Promise(resolve=>setTimeout(resolve,0));
 const sum=(a,f)=>a.reduce((t,x)=>t+Number(f(x)||0),0),cl=x=>Number(x.costo_unitario)*Number(x.cantidad)+Number(x.comision_generada);
 const bruto=sum(D,x=>x.subtotal),desc=sum(V,x=>x.descuento),neto=bruto-desc,costo=sum(D,x=>Number(x.costo_unitario)*Number(x.cantidad)),com=sum(D,x=>x.comision_generada);
 const gast=sum(G.filter(x=>!['COMISIONES','PRODUCTOS'].includes(x.categoria_gasto)),x=>x.valor),util=neto-costo-com-gast;
 const grp=(a,k,f)=>{const m={};a.forEach(x=>{const n=k(x);m[n]=m[n]||{n,c:0,i:0,k:0};f(m[n],x)});return Object.values(m)};
 const lin=(g,e)=>fila2(esc(g.n)+'<br><small>'+g.c+' '+e+', ingresos '+dinero(g.i)+', costo '+dinero(g.k)+'</small>',dinero(g.i-g.k));
 const mg=(a,k,e,flt)=>grp(a.filter(flt||(()=>true)),k,(g,x)=>{g.c+=Number(x.cantidad||0);g.i+=Number(x.subtotal||0);g.k+=cl(x)}).sort((p,q)=>(q.i-q.k)-(p.i-p.k)).map(g=>lin(g,e));
 const sec=(t,r)=>r.length?(t?'<label>'+t+'</label>':'')+r.join(''):'';
 const pm=grp(P,x=>bonito(x.metodo_pago),(g,x)=>{g.i+=Number(x.valor_pago)}).map(g=>fila2(esc(g.n),dinero(g.i))),pc=grp(P.filter(x=>x.cuentas),x=>x.cuentas.nombre,(g,x)=>{g.i+=Number(x.valor_pago)}).map(g=>fila2(esc(g.n),dinero(g.i)));
 etapa='construyendo gráficas y agrupaciones';panelEtapa('Preparando gráficas y agrupaciones…');await new Promise(resolve=>setTimeout(resolve,0));
 const dias={};
 const dia=k=>dias[k]||(dias[k]={ventas:0,gastos:0,citas:0,recaudo:0,operaciones:0,costos:0,utilidad:0});
 V.forEach(x=>{const d=dia(fecha(new Date(x.fecha_hora)));d.ventas+=Number(x.total_venta||0);d.operaciones++});
 D.forEach(x=>{const k=x.ventas?.fecha_hora;if(!k)return;dia(fecha(new Date(k))).costos+=cl(x)});
 P.forEach(x=>{dia(fecha(new Date(x.fecha_hora))).recaudo+=Number(x.valor_pago||0)});
 G.filter(x=>!['COMISIONES','PRODUCTOS'].includes(x.categoria_gasto)).forEach(x=>{const d=dia(fecha(new Date(x.fecha_hora)));d.gastos+=Number(x.valor||0)});
 C.forEach(x=>{const d=dia(fecha(new Date(x.inicio)));d.citas++;if(x.estado==='ATENDIDA')d.atendidas=(d.atendidas||0)+1});
 Object.values(dias).forEach(d=>{d.utilidad=d.ventas-d.costos-d.gastos});
 const serie=Object.entries(dias).sort((a,b)=>a[0].localeCompare(b[0])).slice(-14),cobrado=sum(P,x=>x.valor_pago),ticket=V.length?neto/V.length:0;
 etapa='dibujando el informe';panelEtapa('Mostrando resultados…');await new Promise(resolve=>setTimeout(resolve,0));
 const margen=neto?util/neto*100:0,ratioCobro=neto?cobrado/neto*100:0,atendidas=C.filter(x=>x.estado==='ATENDIDA').length,pendientesC=C.filter(x=>['PENDIENTE','CONFIRMADA'].includes(x.estado)).length;
 const pagosMetodo=grp(P,x=>bonito(x.metodo_pago),(g,x)=>{g.i+=Number(x.valor_pago)}).map(g=>({nombre:g.n,valor:g.i})).sort((a,b)=>b.valor-a.valor);
 const topBarberos=grp(D,x=>x.ventas?.barberos?.nombre||'Sin barbero',(g,x)=>{g.i+=Number(x.subtotal||0);g.k+=cl(x);g.c+=Number(x.cantidad||0)}).map(g=>({nombre:g.n,valor:g.i-g.k})).sort((a,b)=>b.valor-a.valor).slice(0,5);
 const topServicios=grp(D.filter(x=>x.tipo_item==='SERVICIO'),x=>x.descripcion,(g,x)=>{g.i+=Number(x.subtotal||0);g.k+=cl(x);g.c+=Number(x.cantidad||0)}).map(g=>({nombre:g.n,valor:g.i-g.k})).sort((a,b)=>b.valor-a.valor).slice(0,5);
 const estados=['PENDIENTE','CONFIRMADA','ATENDIDA','CANCELADA','NO_ASISTIO'].map(k=>({k,n:C.filter(x=>x.estado===k).length})),maxEstado=Math.max(1,...estados.map(x=>x.n));
 const citasGraf=estados.map(x=>'<div class="dash-state"><span>'+bonito(x.k)+'</span><div class="track"><i style="width:'+100*x.n/maxEstado+'%"></i></div><b>'+x.n+'</b></div>').join('');
 $('#inf').innerHTML=`<div class="dash-kpis">
 <button type="button" class="dash-kpi primary" data-metric="ingresos" aria-pressed="true"><small>Ingresos por ventas</small><strong>${dinero(neto)}</strong><em>Ventas netas del periodo</em></button>
 <button type="button" class="dash-kpi" data-metric="utilidad" aria-pressed="false"><small>Utilidad estimada</small><strong>${dinero(util)}</strong><em>Margen: ${margen.toFixed(1)}%</em></button>
 <button type="button" class="dash-kpi" data-metric="recaudo" aria-pressed="false"><small>Recaudo registrado</small><strong>${dinero(cobrado)}</strong><em>${ratioCobro.toFixed(1)}% de ventas netas</em></button>
 <button type="button" class="dash-kpi" data-metric="operaciones" aria-pressed="false"><small>Operaciones de venta</small><strong>${V.length}</strong><em>Ticket promedio: ${dinero(ticket)}</em></button>
 <button type="button" class="dash-kpi" data-metric="citas" aria-pressed="false"><small>Citas atendidas</small><strong>${atendidas}</strong><em>${pendientesC} pendientes o confirmadas</em></button>
 <button type="button" class="dash-kpi" data-metric="gastos" aria-pressed="false"><small>Gastos operativos</small><strong>${dinero(gast)}</strong><em>${neto? (gast/neto*100).toFixed(1):'0.0'}% de ingresos</em></button>
 </div>
 <div class="dash-grid">
 <section class="dash-card" id="dash-dynamic-graph" aria-live="polite"></section>
 <section class="dash-card"><h3>Rentabilidad del periodo</h3><p class="sub">Composición de ingresos y costos</p>
 <div class="dash-breakdown">
 ${[['Ventas brutas',bruto],['Descuentos',-desc],['Costo de productos',-costo],['Comisiones',-com],['Gastos operativos',-gast],['Utilidad estimada',util]].map(([n,v])=>'<div class="dash-break-row"><span>'+n+'</span><strong>'+dinero(v)+'</strong></div>').join('')}
 </div><div class="dash-metric-list"><div class="dash-metric"><small>Margen utilidad</small><b>${margen.toFixed(1)}%</b></div><div class="dash-metric"><small>Ticket medio</small><b>${dinero(ticket)}</b></div><div class="dash-metric"><small>Ventas</small><b>${V.length}</b></div></div></section>
 </div>
 <div class="dash-grid">
 <section class="dash-card"><h3>Actividad de citas</h3><p class="sub">Estado de las citas · distribución por estado · ${C.length} citas</p>${citasGraf}</section>
 <section class="dash-card"><h3>Recaudo por medio de pago</h3><p class="sub">Pagos registrados y no anulados</p>${pagosMetodo.length?'<div class="dash-breakdown">'+pagosMetodo.map(x=>'<div class="dash-break-row"><span>'+esc(x.nombre)+'</span><strong>'+dinero(x.valor)+'</strong><div class="dash-break-track"><i style="width:'+100*x.valor/Math.max(1,...pagosMetodo.map(y=>y.valor))+'%"></i></div></div>').join('')+'</div>':'<p class="mute">Sin pagos registrados en el periodo.</p>'}</section>
 </div>
 <div class="dash-grid">${barras('Rentabilidad por barbero',topBarberos)}${barras('Servicios con mayor margen',topServicios)}</div>
 <div class="dash-section"><h3>Detalle de rentabilidad por producto</h3>${sec('',mg(D,x=>x.descripcion,'unidades',x=>x.tipo_item==='PRODUCTO').slice(0,8))}</div>
 <div class="dash-note">Criterio contable: la utilidad mostrada es estimada con ventas netas menos costo de productos vendidos, comisiones y gastos operativos registrados. Las compras de inventario y liquidaciones de comisiones no se descuentan otra vez para evitar duplicidad.</div>
 <div class="dash-section"><h3>Recaudo por cuenta</h3>${sec('',pc)}</div>`;
 const metricas={
  ingresos:{titulo:'Comportamiento del negocio',descripcion:'Ventas por día y Gastos por día · últimos 14 días del periodo.',campo:'ventas',moneda:true},
  utilidad:{titulo:'Evolución de utilidad estimada',descripcion:'Ingresos diarios menos costos, comisiones y gastos operativos.',campo:'utilidad',moneda:true},
  recaudo:{titulo:'Evolución del recaudo',descripcion:'Pagos registrados por día, según su fecha de registro.',campo:'recaudo',moneda:true},
  operaciones:{titulo:'Operaciones de venta',descripcion:'Cantidad de ventas registradas por día.',campo:'operaciones',moneda:false},
  citas:{titulo:'Actividad de citas',descripcion:'Cantidad de citas programadas por día.',campo:'citas',moneda:false},
  gastos:{titulo:'Evolución de gastos operativos',descripcion:'Gastos registrados por día, excluyendo compras de inventario y liquidaciones de comisiones.',campo:'gastos',moneda:true}
 };
 const pintarGrafica=clave=>{
  const m=metricas[clave]||metricas.ingresos,panel=$('#dash-dynamic-graph');
  if(!panel)return;
  panel.innerHTML='<h3>'+m.titulo+'</h3><p class="sub">'+m.descripcion+'</p>'+(clave==='ingresos'?graficaComparativa(serie):graficaIndicador(serie,m.campo,m.moneda));
 };
 const tarjetas=Array.from(document.querySelectorAll('#inf .dash-kpi[data-metric]'));
 tarjetas.forEach(tarjeta=>tarjeta.addEventListener('click',()=>{
  tarjetas.forEach(otra=>{
   const activa=otra===tarjeta;
   otra.classList.toggle('primary',activa);
   otra.setAttribute('aria-pressed',String(activa));
  });
  pintarGrafica(tarjeta.dataset.metric);
 }));
 pintarGrafica('ingresos');
 $('#ex').onclick=()=>{
 const csvCell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
 const lineas=[['Tipo','Fecha','Concepto','Barbero','Método','Estado','Cantidad','Ingreso','Costo','Descuento']];
 V.forEach(x=>lineas.push(['VENTA',x.fecha_hora,'Venta '+x.id,'','','',1,Number(x.total_venta||0),0,Number(x.descuento||0)]));
 D.forEach(x=>lineas.push(['DETALLE',x.ventas?.fecha_hora||'',x.descripcion,x.ventas?.barberos?.nombre||'','',x.ventas?.estado_venta||'',x.cantidad,Number(x.subtotal||0),Number(x.costo_unitario||0)*Number(x.cantidad||0),0]));
 P.forEach(x=>lineas.push(['PAGO',x.fecha_hora,'Recaudo','',x.metodo_pago,'REGISTRADO',1,Number(x.valor_pago||0),0,0]));
 G.forEach(x=>lineas.push(['GASTO',x.fecha_hora,x.descripcion||x.categoria_gasto,'',x.metodo_pago,x.estado_gasto,1,-Number(x.valor||0),Number(x.valor||0),0]));
 C.forEach(x=>lineas.push(['CITA',x.inicio,'Cita','','',x.estado,1,0,0,0]));
 const contenido='\uFEFF'+lineas.map(f=>f.map(csvCell).join(';')).join('\r\n');
 const blob=new Blob([contenido],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='informe-barberia-'+fecha(s)+'-'+fecha(new Date(e.getTime()-86400000))+'.csv';
 document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);toast('Informe CSV generado');
 };
 $('#ex').disabled=false;
 }catch(error){
  console.error('Error preparando informe gerencial:',etapa,error);
  const panel=$('#inf');
  if(panel)panel.innerHTML='<p class="empty">No se pudo preparar el informe al '+esc(etapa)+': '+esc(error?.message||String(error))+'</p>';
 }
}

/* ---------- Resumen y ajustes ---------- */
async function inicioSimple(){
 const h0=new Date();h0.setHours(0,0,0,0);const h1=new Date(h0);h1.setDate(h1.getDate()+1);
 const respuestas=await Promise.all([
  mio(sb.from('ventas').select('total_venta').neq('estado_venta','ANULADA').gte('fecha_hora',h0.toISOString()).lt('fecha_hora',h1.toISOString())),
  mio(sb.from('citas').select('inicio,estado,clientes(nombre),barberos(nombre)').in('estado',['PENDIENTE','CONFIRMADA']).gte('inicio',h0.toISOString()).lt('inicio',h1.toISOString())).order('inicio'),
  ADM.includes(S.perfil.rol)?sb.from('stock_actual').select('nombre,existencias,stock_minimo').eq('negocio_id',S.perfil.negocio_id):Promise.resolve({data:[]})]);
 const fallo=respuestas.find(r=>r.error);if(fallo)return toast('No fue posible cargar el resumen: '+fallo.error.message,true);
 const[{data:v},{data:c},{data:s}]=respuestas;
 const tot=(v||[]).reduce((a,x)=>a+Number(x.total_venta),0),bajo=(s||[]).filter(x=>Number(x.existencias)<=Number(x.stock_minimo)),prox=(c||[]).filter(x=>new Date(x.inicio)>=new Date());
 $('#main').innerHTML=`<div class="head"><h2>Hoy</h2></div>
 <div class="kp"><div><small>Vendido hoy</small><strong>${dinero(tot)}</strong></div><div><small>Ventas</small><strong>${(v||[]).length}</strong></div><div><small>Citas pendientes</small><strong>${(c||[]).length}</strong></div></div>
 <label>Próximas citas</label>${prox.length?prox.slice(0,5).map(x=>fila2(hora(x.inicio)+', '+esc(x.clientes?.nombre),esc(x.barberos?.nombre))).join(''):'<p class="empty">No hay más citas por atender hoy.</p>'}
 ${bajo.length?'<label>Stock bajo</label>'+bajo.map(x=>fila2(esc(x.nombre),x.existencias+' (mínimo '+x.stock_minimo+')')).join(''):''}`;
}

 return { inicio };
}
+(v/1e6).toFixed(1)+' M':a>=1e3?'
 const { $, sb, S, esc, dinero, hora, fecha, bonito, toast, ADM, mio, fila2, porConfirmar } = deps;
const RG=[['hoy','Hoy'],['ayer','Ayer'],['semana','Esta semana'],['mes','Este mes'],['30','Últimos 30 días'],['custom','Personalizado']];
let informeEjecucion=0;
function rango(v,a,b){const d=new Date();d.setHours(0,0,0,0);const s=new Date(d);let e=new Date(d);e.setDate(e.getDate()+1);
 if(v==='ayer'){s.setDate(s.getDate()-1);e=new Date(d)}
 else if(v==='semana')s.setDate(s.getDate()-((s.getDay()+6)%7));
 else if(v==='mes')s.setDate(1);
 else if(v==='30')s.setDate(s.getDate()-29);
 else if(v==='custom'){const x=new Date((a||fecha(d))+'T00:00:00');e=new Date((b||fecha(d))+'T00:00:00');e.setDate(e.getDate()+1);return[x,e]}
 return[s,e]}
function inicio(){return ADM.includes(S.perfil.rol)?informe():inicioSimple()}
async function todos(q,nombre){
 const filas=[];let desde=0;
 while(true){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),20000);
  let resultado;
  try{resultado=await q.abortSignal(controller.signal).range(desde,desde+999)}
  catch(error){resultado={data:null,error}}
  finally{clearTimeout(timer)}
  if(resultado.error)return{data:null,error:{message:controller.signal.aborted?'La consulta de '+nombre+' superó los 20 segundos. Revisa la conexión o los permisos de lectura.':nombre+': '+resultado.error.message}};
  const bloque=resultado.data||[];filas.push(...bloque);
  if(bloque.length<1000)break;
  desde+=1000;
  if(desde>=50000)return{data:null,error:{message:'La consulta de '+nombre+' superó el límite de seguridad de 50.000 registros para este informe.'}};
 }
 return{data:filas,error:null};
}
function graficaComparativa(serie){
 if(!serie.length)return '<p class="mute">No hay movimientos en el periodo seleccionado.</p>';
 const max=Math.max(1,...serie.map(([,v])=>Math.max(v.ventas,v.gastos)));
 return '<div class="dash-chart">'+serie.map(([k,v])=>'<div class="dash-day"><span class="date">'+esc(k.slice(5))+'</span><div class="dash-bars"><div class="dash-bar rev"><i style="width:'+100*v.ventas/max+'%"></i></div><div class="dash-bar exp"><i style="width:'+100*v.gastos/max+'%"></i></div></div><span class="amount">'+dinero(v.ventas)+'</span></div>').join('')+'</div><div class="dash-legend"><span>Ventas</span><span>Gastos</span></div>';
}
function grafica(titulo,serie,campo,maximo,color){ return graficaComparativa(serie); }
function graficaIndicador(serie,campo,esMoneda=true){
 if(!serie.length||!serie.some(([,v])=>Number(v[campo]||0)!==0))return '<p class="mute">No hay movimientos en el periodo seleccionado.</p>';
 const max=Math.max(1,...serie.map(([,v])=>Math.abs(Number(v[campo]||0))));
 return '<div class="dash-chart">'+serie.map(([k,v])=>{
  const n=Number(v[campo]||0),ancho=100*Math.abs(n)/max;
  return '<div class="dash-day"><span class="date">'+esc(k.slice(5))+'</span><div class="dash-bars"><div class="dash-bar '+(n<0?'exp':'rev')+'"><i style="width:'+ancho+'%"></i></div></div><span class="amount">'+(esMoneda?dinero(n):String(Math.round(n)))+'</span></div>';
 }).join('')+'</div>';
}
function barras(titulo,datos,total){
 if(!datos.length)return '';
 const max=Math.max(1,...datos.map(x=>x.valor));
 return '<div class="dash-card"><h3>'+titulo+'</h3><p class="sub">Participación sobre el total del periodo</p><div class="dash-breakdown">'+datos.map(x=>'<div class="dash-break-row"><span>'+esc(x.nombre)+'</span><strong>'+dinero(x.valor)+'</strong><div class="dash-break-track"><i style="width:'+100*x.valor/max+'%"></i></div></div>').join('')+'</div></div>';
}
async function informe(){
 if(!document.getElementById('dashboard-chart-style')){const css=document.createElement('style');css.id='dashboard-chart-style';
 css.textContent=`
 #main:has(#inf){max-width:1240px}
 .dash-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin:10px 0 18px;flex-wrap:wrap}
 .dash-kicker{font-size:11px;letter-spacing:.13em;text-transform:uppercase;color:#63738a;font-weight:800}
 .dash-title{font-size:clamp(25px,4vw,34px);letter-spacing:-.04em;margin:3px 0 4px}
 .dash-sub{font-size:13px;color:#65748a}
 .dash-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
 .dash-actions select,.dash-actions input{min-width:145px;width:auto;padding:10px 12px;font-size:13px}
 .dash-actions .btn{padding:10px 14px;font-size:13px}
 .dash-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:14px 0}
 .dash-kpi{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px;min-width:0;box-shadow:0 3px 12px #10223f08;cursor:pointer;text-align:left;width:100%;font:inherit;transition:border-color .18s,box-shadow .18s,transform .18s}
 .dash-kpi:hover{border-color:#9aabc0;transform:translateY(-2px)}
 .dash-kpi:focus-visible{outline:3px solid #8bb8dc;outline-offset:2px}
 .dash-kpi.primary{box-shadow:0 0 0 2px #102b4920,0 5px 16px #10223f12}
 .dash-kpi.primary small{color:#c2d1e2}
 .dash-kpi.primary em{color:#b6c8da}
 .dash-kpi.primary{background:#102b49;color:#fff;border-color:#102b49}
 .dash-kpi small{display:block;font-size:12px;color:#718096;font-weight:600}
 .dash-kpi.primary small{color:#c2d1e2}
 .dash-kpi strong{display:block;font-size:clamp(19px,2.5vw,27px);letter-spacing:-.03em;margin:7px 0 4px;overflow-wrap:anywhere}
 .dash-kpi em{font-style:normal;font-size:11px;color:#748398}
 .dash-kpi.primary em{color:#b6c8da}
 .dash-grid{display:grid;grid-template-columns:1.45fr 1fr;gap:14px;margin:14px 0}
 .dash-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:17px;min-width:0;box-shadow:0 3px 12px #10223f08}
 .dash-card h3{font-size:15px;margin:0 0 4px;letter-spacing:-.01em}
 .dash-card .sub{font-size:12px;color:#718096;margin:0 0 14px}
 .dash-chart{display:grid;gap:10px}
 .dash-day{display:grid;grid-template-columns:44px minmax(0,1fr) 90px;gap:10px;align-items:center;font-size:11px}
 .dash-day .date{color:#758398}
 .dash-bars{display:grid;gap:4px}
 .dash-bar{height:8px;background:#edf1f5;border-radius:20px;overflow:hidden}
 .dash-bar i{display:block;height:100%;border-radius:20px}
 .dash-bar.rev i{background:#1d8068}.dash-bar.exp i{background:#e2a04b}
 .dash-day .amount{font-variant-numeric:tabular-nums;text-align:right;color:#46566b;white-space:nowrap}
 .dash-legend{display:flex;gap:14px;margin-top:13px;font-size:11px;color:#65748a}
 .dash-legend span:before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;background:#1d8068;margin-right:5px}
 .dash-legend span+span:before{background:#e2a04b}
 .dash-breakdown{display:grid;gap:12px}
 .dash-break-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;font-size:12px}
 .dash-break-row strong{font-variant-numeric:tabular-nums}
 .dash-break-track{grid-column:1/-1;height:7px;background:#edf1f5;border-radius:10px;overflow:hidden}
 .dash-break-track i{display:block;height:100%;background:#467ba8;border-radius:10px}
 .dash-metric-list{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}
 .dash-metric{background:#f5f7fa;border-radius:9px;padding:10px}
 .dash-metric small{display:block;color:#748398;font-size:10px}
 .dash-metric b{font-size:14px}
 .dash-state{display:grid;grid-template-columns:105px 1fr 26px;gap:9px;align-items:center;margin:11px 0;font-size:12px}
 .dash-state .track{height:8px;background:#edf1f5;border-radius:20px;overflow:hidden}
 .dash-state i{display:block;height:100%;background:#467ba8;border-radius:20px}
 .dash-state b{text-align:right;font-variant-numeric:tabular-nums}
 .dash-section{margin:14px 0}
 .dash-section h3{font-size:15px;margin:0 0 9px}
 .dash-section .ln2{padding:10px 2px;font-size:13px}
 .dash-note{border-left:3px solid #e2a04b;background:#fff9ed;border-radius:0 9px 9px 0;padding:11px 13px;color:#725b36;font-size:12px;margin:12px 0}
 .dash-loading{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:28px;color:#65748a}
 @media(max-width:700px){.dash-kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.dash-kpi{padding:13px}.dash-grid{grid-template-columns:1fr;gap:10px}.dash-card{padding:14px}.dash-day{grid-template-columns:38px minmax(0,1fr) 82px;gap:7px}.dash-metric-list{grid-template-columns:repeat(3,1fr)}.dash-state{grid-template-columns:90px 1fr 24px}}
 @media(min-width:1000px){.dash-kpis{grid-template-columns:repeat(6,minmax(0,1fr))}}
 ` ;
 document.head.appendChild(css);}
 const[s,e]=rango(S.rg||'hoy',S.ra,S.rb),A=s.toISOString(),B=e.toISOString(),rg=S.rg||'hoy';
 $('#main').innerHTML=`<div class="dash-head"><div><div class="dash-kicker">DH Barber · Inteligencia de negocio</div><h2 class="dash-title">Panel gerencial</h2><div class="dash-sub">Indicadores financieros y operativos · ${RG.find(x=>x[0]===rg)?.[1]||'Periodo personalizado'}</div></div><div class="dash-actions"><select id="rg" aria-label="Periodo">${RG.map(([k,l])=>`<option value="${k}"${k===rg?' selected':''}>${l}</option>`).join('')}</select>${rg==='custom'?`<input type="date" id="ra" value="${S.ra||fecha(new Date())}" aria-label="Desde"><input type="date" id="rb" value="${S.rb||fecha(new Date())}" aria-label="Hasta">`:''}<button class="btn sec" id="ex" disabled>Exportar CSV</button></div></div><div id="inf"><div class="dash-loading">Consultando ventas, pagos, gastos y citas…</div></div>`;
 $('#rg').onchange=x=>{S.rg=x.target.value;informe()};
 porConfirmar();
 if(rg==='custom')['ra','rb'].forEach(i=>$('#'+i).onchange=x=>{S[i]=x.target.value;informe()});
 const ejecucion=++informeEjecucion;
 const fuentes=[
  ['ventas',sb.from('ventas').select('id,descuento,fecha_hora,total_venta').eq('negocio_id',S.perfil.negocio_id).neq('estado_venta','ANULADA').gte('fecha_hora',A).lt('fecha_hora',B).order('id',{ascending:true})],
  ['detalles de ventas',sb.from('detalle_ventas').select('tipo_item,descripcion,cantidad,subtotal,costo_unitario,comision_generada,ventas!inner(estado_venta,fecha_hora,barberos(nombre))').eq('negocio_id',S.perfil.negocio_id).neq('ventas.estado_venta','ANULADA').gte('ventas.fecha_hora',A).lt('ventas.fecha_hora',B).order('id',{ascending:true})],
  ['pagos',sb.from('pagos').select('valor_pago,metodo_pago,fecha_hora,cuentas(nombre),ventas!inner(estado_venta)').eq('negocio_id',S.perfil.negocio_id).eq('estado_pago','REGISTRADO').neq('ventas.estado_venta','ANULADA').gte('fecha_hora',A).lt('fecha_hora',B).order('id',{ascending:true})],
  ['gastos',sb.from('gastos').select('categoria_gasto,descripcion,valor,metodo_pago,estado_gasto,fecha_hora').eq('negocio_id',S.perfil.negocio_id).eq('estado_gasto','REGISTRADO').gte('fecha_hora',A).lt('fecha_hora',B).order('id',{ascending:true})],
  ['citas',sb.from('citas').select('inicio,estado').eq('negocio_id',S.perfil.negocio_id).gte('inicio',A).lt('inicio',B).order('id',{ascending:true})]
 ];
 let pendientes=fuentes.map(x=>x[0]);
 $('#inf').innerHTML='<p class="empty">Consultando: '+pendientes.join(', ')+'…</p>';
 const respuestas=await Promise.all(fuentes.map(async([nombre,q])=>{
  const r=await todos(q,nombre);
  if(ejecucion===informeEjecucion){
   pendientes=pendientes.filter(x=>x!==nombre);
   const panel=$('#inf');
   if(panel)panel.innerHTML=r.error
    ?'<p class="empty">No fue posible cargar '+esc(nombre)+': '+esc(r.error.message)+'</p>'
    :pendientes.length?'<p class="empty">Datos recibidos. Falta consultar: '+esc(pendientes.join(', '))+'…</p>':'<p class="empty">Preparando resultados…</p>';
  }
  return r;
 }));
 if(ejecucion!==informeEjecucion||!$('#inf'))return;
 const fallo=respuestas.find(r=>r.error);if(fallo){$('#inf').innerHTML='<p class="empty">No fue posible cargar el informe: '+esc(fallo.error.message)+'</p>';return}
 let etapa='validando los datos';
 try{
 const panelEtapa=mensaje=>{const panel=$('#inf');if(panel)panel.innerHTML='<p class="empty">'+mensaje+'</p>'};
 panelEtapa('Consultas completas. Validando datos…');
 await new Promise(resolve=>setTimeout(resolve,0));
 const[V,D,P,G,C]=respuestas.map(r=>r.data||[]);
 etapa='calculando ventas, costos y gastos';
 panelEtapa('Calculando ventas, costos y gastos…');
 await new Promise(resolve=>setTimeout(resolve,0));
 const sum=(a,f)=>a.reduce((t,x)=>t+Number(f(x)||0),0),cl=x=>Number(x.costo_unitario)*Number(x.cantidad)+Number(x.comision_generada);
 const bruto=sum(D,x=>x.subtotal),desc=sum(V,x=>x.descuento),neto=bruto-desc,costo=sum(D,x=>Number(x.costo_unitario)*Number(x.cantidad)),com=sum(D,x=>x.comision_generada);
 const gast=sum(G.filter(x=>!['COMISIONES','PRODUCTOS'].includes(x.categoria_gasto)),x=>x.valor),util=neto-costo-com-gast;
 const grp=(a,k,f)=>{const m={};a.forEach(x=>{const n=k(x);m[n]=m[n]||{n,c:0,i:0,k:0};f(m[n],x)});return Object.values(m)};
 const lin=(g,e)=>fila2(esc(g.n)+'<br><small>'+g.c+' '+e+', ingresos '+dinero(g.i)+', costo '+dinero(g.k)+'</small>',dinero(g.i-g.k));
 const mg=(a,k,e,flt)=>grp(a.filter(flt||(()=>true)),k,(g,x)=>{g.c+=Number(x.cantidad||0);g.i+=Number(x.subtotal||0);g.k+=cl(x)}).sort((p,q)=>(q.i-q.k)-(p.i-p.k)).map(g=>lin(g,e));
 const sec=(t,r)=>r.length?(t?'<label>'+t+'</label>':'')+r.join(''):'';
 const pm=grp(P,x=>bonito(x.metodo_pago),(g,x)=>{g.i+=Number(x.valor_pago)}).map(g=>fila2(esc(g.n),dinero(g.i))),pc=grp(P.filter(x=>x.cuentas),x=>x.cuentas.nombre,(g,x)=>{g.i+=Number(x.valor_pago)}).map(g=>fila2(esc(g.n),dinero(g.i)));
 etapa='construyendo gráficas y agrupaciones';panelEtapa('Preparando gráficas y agrupaciones…');await new Promise(resolve=>setTimeout(resolve,0));
 const dias={};
 const dia=k=>dias[k]||(dias[k]={ventas:0,gastos:0,citas:0,recaudo:0,operaciones:0,costos:0,utilidad:0});
 V.forEach(x=>{const d=dia(fecha(new Date(x.fecha_hora)));d.ventas+=Number(x.total_venta||0);d.operaciones++});
 D.forEach(x=>{const k=x.ventas?.fecha_hora;if(!k)return;dia(fecha(new Date(k))).costos+=cl(x)});
 P.forEach(x=>{dia(fecha(new Date(x.fecha_hora))).recaudo+=Number(x.valor_pago||0)});
 G.filter(x=>!['COMISIONES','PRODUCTOS'].includes(x.categoria_gasto)).forEach(x=>{const d=dia(fecha(new Date(x.fecha_hora)));d.gastos+=Number(x.valor||0)});
 C.forEach(x=>{const d=dia(fecha(new Date(x.inicio)));d.citas++;if(x.estado==='ATENDIDA')d.atendidas=(d.atendidas||0)+1});
 Object.values(dias).forEach(d=>{d.utilidad=d.ventas-d.costos-d.gastos});
 const serie=Object.entries(dias).sort((a,b)=>a[0].localeCompare(b[0])).slice(-14),cobrado=sum(P,x=>x.valor_pago),ticket=V.length?neto/V.length:0;
 etapa='dibujando el informe';panelEtapa('Mostrando resultados…');await new Promise(resolve=>setTimeout(resolve,0));
 const margen=neto?util/neto*100:0,ratioCobro=neto?cobrado/neto*100:0,atendidas=C.filter(x=>x.estado==='ATENDIDA').length,pendientesC=C.filter(x=>['PENDIENTE','CONFIRMADA'].includes(x.estado)).length;
 const pagosMetodo=grp(P,x=>bonito(x.metodo_pago),(g,x)=>{g.i+=Number(x.valor_pago)}).map(g=>({nombre:g.n,valor:g.i})).sort((a,b)=>b.valor-a.valor);
 const topBarberos=grp(D,x=>x.ventas?.barberos?.nombre||'Sin barbero',(g,x)=>{g.i+=Number(x.subtotal||0);g.k+=cl(x);g.c+=Number(x.cantidad||0)}).map(g=>({nombre:g.n,valor:g.i-g.k})).sort((a,b)=>b.valor-a.valor).slice(0,5);
 const topServicios=grp(D.filter(x=>x.tipo_item==='SERVICIO'),x=>x.descripcion,(g,x)=>{g.i+=Number(x.subtotal||0);g.k+=cl(x);g.c+=Number(x.cantidad||0)}).map(g=>({nombre:g.n,valor:g.i-g.k})).sort((a,b)=>b.valor-a.valor).slice(0,5);
 const estados=['PENDIENTE','CONFIRMADA','ATENDIDA','CANCELADA','NO_ASISTIO'].map(k=>({k,n:C.filter(x=>x.estado===k).length})),maxEstado=Math.max(1,...estados.map(x=>x.n));
 const citasGraf=estados.map(x=>'<div class="dash-state"><span>'+bonito(x.k)+'</span><div class="track"><i style="width:'+100*x.n/maxEstado+'%"></i></div><b>'+x.n+'</b></div>').join('');
 $('#inf').innerHTML=`<div class="dash-kpis">
 <button type="button" class="dash-kpi primary" data-metric="ingresos" aria-pressed="true"><small>Ingresos por ventas</small><strong>${dinero(neto)}</strong><em>Ventas netas del periodo</em></button>
 <button type="button" class="dash-kpi" data-metric="utilidad" aria-pressed="false"><small>Utilidad estimada</small><strong>${dinero(util)}</strong><em>Margen: ${margen.toFixed(1)}%</em></button>
 <button type="button" class="dash-kpi" data-metric="recaudo" aria-pressed="false"><small>Recaudo registrado</small><strong>${dinero(cobrado)}</strong><em>${ratioCobro.toFixed(1)}% de ventas netas</em></button>
 <button type="button" class="dash-kpi" data-metric="operaciones" aria-pressed="false"><small>Operaciones de venta</small><strong>${V.length}</strong><em>Ticket promedio: ${dinero(ticket)}</em></button>
 <button type="button" class="dash-kpi" data-metric="citas" aria-pressed="false"><small>Citas atendidas</small><strong>${atendidas}</strong><em>${pendientesC} pendientes o confirmadas</em></button>
 <button type="button" class="dash-kpi" data-metric="gastos" aria-pressed="false"><small>Gastos operativos</small><strong>${dinero(gast)}</strong><em>${neto? (gast/neto*100).toFixed(1):'0.0'}% de ingresos</em></button>
 </div>
 <div class="dash-grid">
 <section class="dash-card" id="dash-dynamic-graph" aria-live="polite"></section>
 <section class="dash-card"><h3>Rentabilidad del periodo</h3><p class="sub">Composición de ingresos y costos</p>
 <div class="dash-breakdown">
 ${[['Ventas brutas',bruto],['Descuentos',-desc],['Costo de productos',-costo],['Comisiones',-com],['Gastos operativos',-gast],['Utilidad estimada',util]].map(([n,v])=>'<div class="dash-break-row"><span>'+n+'</span><strong>'+dinero(v)+'</strong></div>').join('')}
 </div><div class="dash-metric-list"><div class="dash-metric"><small>Margen utilidad</small><b>${margen.toFixed(1)}%</b></div><div class="dash-metric"><small>Ticket medio</small><b>${dinero(ticket)}</b></div><div class="dash-metric"><small>Ventas</small><b>${V.length}</b></div></div></section>
 </div>
 <div class="dash-grid">
 <section class="dash-card"><h3>Actividad de citas</h3><p class="sub">Estado de las citas · distribución por estado · ${C.length} citas</p>${citasGraf}</section>
 <section class="dash-card"><h3>Recaudo por medio de pago</h3><p class="sub">Pagos registrados y no anulados</p>${pagosMetodo.length?'<div class="dash-breakdown">'+pagosMetodo.map(x=>'<div class="dash-break-row"><span>'+esc(x.nombre)+'</span><strong>'+dinero(x.valor)+'</strong><div class="dash-break-track"><i style="width:'+100*x.valor/Math.max(1,...pagosMetodo.map(y=>y.valor))+'%"></i></div></div>').join('')+'</div>':'<p class="mute">Sin pagos registrados en el periodo.</p>'}</section>
 </div>
 <div class="dash-grid">${barras('Rentabilidad por barbero',topBarberos)}${barras('Servicios con mayor margen',topServicios)}</div>
 <div class="dash-section"><h3>Detalle de rentabilidad por producto</h3>${sec('',mg(D,x=>x.descripcion,'unidades',x=>x.tipo_item==='PRODUCTO').slice(0,8))}</div>
 <div class="dash-note">Criterio contable: la utilidad mostrada es estimada con ventas netas menos costo de productos vendidos, comisiones y gastos operativos registrados. Las compras de inventario y liquidaciones de comisiones no se descuentan otra vez para evitar duplicidad.</div>
 <div class="dash-section"><h3>Recaudo por cuenta</h3>${sec('',pc)}</div>`;
 const metricas={
  ingresos:{titulo:'Comportamiento del negocio',descripcion:'Ventas por día y Gastos por día · últimos 14 días del periodo.',campo:'ventas',moneda:true},
  utilidad:{titulo:'Evolución de utilidad estimada',descripcion:'Ingresos diarios menos costos, comisiones y gastos operativos.',campo:'utilidad',moneda:true},
  recaudo:{titulo:'Evolución del recaudo',descripcion:'Pagos registrados por día, según su fecha de registro.',campo:'recaudo',moneda:true},
  operaciones:{titulo:'Operaciones de venta',descripcion:'Cantidad de ventas registradas por día.',campo:'operaciones',moneda:false},
  citas:{titulo:'Actividad de citas',descripcion:'Cantidad de citas programadas por día.',campo:'citas',moneda:false},
  gastos:{titulo:'Evolución de gastos operativos',descripcion:'Gastos registrados por día, excluyendo compras de inventario y liquidaciones de comisiones.',campo:'gastos',moneda:true}
 };
 const pintarGrafica=clave=>{
  const m=metricas[clave]||metricas.ingresos,panel=$('#dash-dynamic-graph');
  if(!panel)return;
  panel.innerHTML='<h3>'+m.titulo+'</h3><p class="sub">'+m.descripcion+'</p>'+(clave==='ingresos'?graficaComparativa(serie):graficaIndicador(serie,m.campo,m.moneda));
 };
 const tarjetas=Array.from(document.querySelectorAll('#inf .dash-kpi[data-metric]'));
 tarjetas.forEach(tarjeta=>tarjeta.addEventListener('click',()=>{
  tarjetas.forEach(otra=>{
   const activa=otra===tarjeta;
   otra.classList.toggle('primary',activa);
   otra.setAttribute('aria-pressed',String(activa));
  });
  pintarGrafica(tarjeta.dataset.metric);
 }));
 pintarGrafica('ingresos');
 $('#ex').onclick=()=>{
 const csvCell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
 const lineas=[['Tipo','Fecha','Concepto','Barbero','Método','Estado','Cantidad','Ingreso','Costo','Descuento']];
 V.forEach(x=>lineas.push(['VENTA',x.fecha_hora,'Venta '+x.id,'','','',1,Number(x.total_venta||0),0,Number(x.descuento||0)]));
 D.forEach(x=>lineas.push(['DETALLE',x.ventas?.fecha_hora||'',x.descripcion,x.ventas?.barberos?.nombre||'','',x.ventas?.estado_venta||'',x.cantidad,Number(x.subtotal||0),Number(x.costo_unitario||0)*Number(x.cantidad||0),0]));
 P.forEach(x=>lineas.push(['PAGO',x.fecha_hora,'Recaudo','',x.metodo_pago,'REGISTRADO',1,Number(x.valor_pago||0),0,0]));
 G.forEach(x=>lineas.push(['GASTO',x.fecha_hora,x.descripcion||x.categoria_gasto,'',x.metodo_pago,x.estado_gasto,1,-Number(x.valor||0),Number(x.valor||0),0]));
 C.forEach(x=>lineas.push(['CITA',x.inicio,'Cita','','',x.estado,1,0,0,0]));
 const contenido='\uFEFF'+lineas.map(f=>f.map(csvCell).join(';')).join('\r\n');
 const blob=new Blob([contenido],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='informe-barberia-'+fecha(s)+'-'+fecha(new Date(e.getTime()-86400000))+'.csv';
 document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);toast('Informe CSV generado');
 };
 $('#ex').disabled=false;
 }catch(error){
  console.error('Error preparando informe gerencial:',etapa,error);
  const panel=$('#inf');
  if(panel)panel.innerHTML='<p class="empty">No se pudo preparar el informe al '+esc(etapa)+': '+esc(error?.message||String(error))+'</p>';
 }
}

/* ---------- Resumen y ajustes ---------- */
async function inicioSimple(){
 const h0=new Date();h0.setHours(0,0,0,0);const h1=new Date(h0);h1.setDate(h1.getDate()+1);
 const respuestas=await Promise.all([
  mio(sb.from('ventas').select('total_venta').neq('estado_venta','ANULADA').gte('fecha_hora',h0.toISOString()).lt('fecha_hora',h1.toISOString())),
  mio(sb.from('citas').select('inicio,estado,clientes(nombre),barberos(nombre)').in('estado',['PENDIENTE','CONFIRMADA']).gte('inicio',h0.toISOString()).lt('inicio',h1.toISOString())).order('inicio'),
  ADM.includes(S.perfil.rol)?sb.from('stock_actual').select('nombre,existencias,stock_minimo').eq('negocio_id',S.perfil.negocio_id):Promise.resolve({data:[]})]);
 const fallo=respuestas.find(r=>r.error);if(fallo)return toast('No fue posible cargar el resumen: '+fallo.error.message,true);
 const[{data:v},{data:c},{data:s}]=respuestas;
 const tot=(v||[]).reduce((a,x)=>a+Number(x.total_venta),0),bajo=(s||[]).filter(x=>Number(x.existencias)<=Number(x.stock_minimo)),prox=(c||[]).filter(x=>new Date(x.inicio)>=new Date());
 $('#main').innerHTML=`<div class="head"><h2>Hoy</h2></div>
 <div class="kp"><div><small>Vendido hoy</small><strong>${dinero(tot)}</strong></div><div><small>Ventas</small><strong>${(v||[]).length}</strong></div><div><small>Citas pendientes</small><strong>${(c||[]).length}</strong></div></div>
 <label>Próximas citas</label>${prox.length?prox.slice(0,5).map(x=>fila2(hora(x.inicio)+', '+esc(x.clientes?.nombre),esc(x.barberos?.nombre))).join(''):'<p class="empty">No hay más citas por atender hoy.</p>'}
 ${bajo.length?'<label>Stock bajo</label>'+bajo.map(x=>fila2(esc(x.nombre),x.existencias+' (mínimo '+x.stock_minimo+')')).join(''):''}`;
}

 return { inicio };
}
+(v/1e3).toFixed(0)+' mil':'
 const { $, sb, S, esc, dinero, hora, fecha, bonito, toast, ADM, mio, fila2, porConfirmar } = deps;
const RG=[['hoy','Hoy'],['ayer','Ayer'],['semana','Esta semana'],['mes','Este mes'],['30','Últimos 30 días'],['custom','Personalizado']];
let informeEjecucion=0;
function rango(v,a,b){const d=new Date();d.setHours(0,0,0,0);const s=new Date(d);let e=new Date(d);e.setDate(e.getDate()+1);
 if(v==='ayer'){s.setDate(s.getDate()-1);e=new Date(d)}
 else if(v==='semana')s.setDate(s.getDate()-((s.getDay()+6)%7));
 else if(v==='mes')s.setDate(1);
 else if(v==='30')s.setDate(s.getDate()-29);
 else if(v==='custom'){const x=new Date((a||fecha(d))+'T00:00:00');e=new Date((b||fecha(d))+'T00:00:00');e.setDate(e.getDate()+1);return[x,e]}
 return[s,e]}
function inicio(){return ADM.includes(S.perfil.rol)?informe():inicioSimple()}
async function todos(q,nombre){
 const filas=[];let desde=0;
 while(true){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),20000);
  let resultado;
  try{resultado=await q.abortSignal(controller.signal).range(desde,desde+999)}
  catch(error){resultado={data:null,error}}
  finally{clearTimeout(timer)}
  if(resultado.error)return{data:null,error:{message:controller.signal.aborted?'La consulta de '+nombre+' superó los 20 segundos. Revisa la conexión o los permisos de lectura.':nombre+': '+resultado.error.message}};
  const bloque=resultado.data||[];filas.push(...bloque);
  if(bloque.length<1000)break;
  desde+=1000;
  if(desde>=50000)return{data:null,error:{message:'La consulta de '+nombre+' superó el límite de seguridad de 50.000 registros para este informe.'}};
 }
 return{data:filas,error:null};
}
function graficaComparativa(serie){
 if(!serie.length)return '<p class="mute">No hay movimientos en el periodo seleccionado.</p>';
 const max=Math.max(1,...serie.map(([,v])=>Math.max(v.ventas,v.gastos)));
 return '<div class="dash-chart">'+serie.map(([k,v])=>'<div class="dash-day"><span class="date">'+esc(k.slice(5))+'</span><div class="dash-bars"><div class="dash-bar rev"><i style="width:'+100*v.ventas/max+'%"></i></div><div class="dash-bar exp"><i style="width:'+100*v.gastos/max+'%"></i></div></div><span class="amount">'+dinero(v.ventas)+'</span></div>').join('')+'</div><div class="dash-legend"><span>Ventas</span><span>Gastos</span></div>';
}
function grafica(titulo,serie,campo,maximo,color){ return graficaComparativa(serie); }
function graficaIndicador(serie,campo,esMoneda=true){
 if(!serie.length||!serie.some(([,v])=>Number(v[campo]||0)!==0))return '<p class="mute">No hay movimientos en el periodo seleccionado.</p>';
 const max=Math.max(1,...serie.map(([,v])=>Math.abs(Number(v[campo]||0))));
 return '<div class="dash-chart">'+serie.map(([k,v])=>{
  const n=Number(v[campo]||0),ancho=100*Math.abs(n)/max;
  return '<div class="dash-day"><span class="date">'+esc(k.slice(5))+'</span><div class="dash-bars"><div class="dash-bar '+(n<0?'exp':'rev')+'"><i style="width:'+ancho+'%"></i></div></div><span class="amount">'+(esMoneda?dinero(n):String(Math.round(n)))+'</span></div>';
 }).join('')+'</div>';
}
function barras(titulo,datos,total){
 if(!datos.length)return '';
 const max=Math.max(1,...datos.map(x=>x.valor));
 return '<div class="dash-card"><h3>'+titulo+'</h3><p class="sub">Participación sobre el total del periodo</p><div class="dash-breakdown">'+datos.map(x=>'<div class="dash-break-row"><span>'+esc(x.nombre)+'</span><strong>'+dinero(x.valor)+'</strong><div class="dash-break-track"><i style="width:'+100*x.valor/max+'%"></i></div></div>').join('')+'</div></div>';
}
async function informe(){
 if(!document.getElementById('dashboard-chart-style')){const css=document.createElement('style');css.id='dashboard-chart-style';
 css.textContent=`
 #main:has(#inf){max-width:1240px}
 .dash-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin:10px 0 18px;flex-wrap:wrap}
 .dash-kicker{font-size:11px;letter-spacing:.13em;text-transform:uppercase;color:#63738a;font-weight:800}
 .dash-title{font-size:clamp(25px,4vw,34px);letter-spacing:-.04em;margin:3px 0 4px}
 .dash-sub{font-size:13px;color:#65748a}
 .dash-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
 .dash-actions select,.dash-actions input{min-width:145px;width:auto;padding:10px 12px;font-size:13px}
 .dash-actions .btn{padding:10px 14px;font-size:13px}
 .dash-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:14px 0}
 .dash-kpi{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px;min-width:0;box-shadow:0 3px 12px #10223f08;cursor:pointer;text-align:left;width:100%;font:inherit;transition:border-color .18s,box-shadow .18s,transform .18s}
 .dash-kpi:hover{border-color:#9aabc0;transform:translateY(-2px)}
 .dash-kpi:focus-visible{outline:3px solid #8bb8dc;outline-offset:2px}
 .dash-kpi.primary{box-shadow:0 0 0 2px #102b4920,0 5px 16px #10223f12}
 .dash-kpi.primary small{color:#c2d1e2}
 .dash-kpi.primary em{color:#b6c8da}
 .dash-kpi.primary{background:#102b49;color:#fff;border-color:#102b49}
 .dash-kpi small{display:block;font-size:12px;color:#718096;font-weight:600}
 .dash-kpi.primary small{color:#c2d1e2}
 .dash-kpi strong{display:block;font-size:clamp(19px,2.5vw,27px);letter-spacing:-.03em;margin:7px 0 4px;overflow-wrap:anywhere}
 .dash-kpi em{font-style:normal;font-size:11px;color:#748398}
 .dash-kpi.primary em{color:#b6c8da}
 .dash-grid{display:grid;grid-template-columns:1.45fr 1fr;gap:14px;margin:14px 0}
 .dash-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:17px;min-width:0;box-shadow:0 3px 12px #10223f08}
 .dash-card h3{font-size:15px;margin:0 0 4px;letter-spacing:-.01em}
 .dash-card .sub{font-size:12px;color:#718096;margin:0 0 14px}
 .dash-chart{display:grid;gap:10px}
 .dash-day{display:grid;grid-template-columns:44px minmax(0,1fr) 90px;gap:10px;align-items:center;font-size:11px}
 .dash-day .date{color:#758398}
 .dash-bars{display:grid;gap:4px}
 .dash-bar{height:8px;background:#edf1f5;border-radius:20px;overflow:hidden}
 .dash-bar i{display:block;height:100%;border-radius:20px}
 .dash-bar.rev i{background:#1d8068}.dash-bar.exp i{background:#e2a04b}
 .dash-day .amount{font-variant-numeric:tabular-nums;text-align:right;color:#46566b;white-space:nowrap}
 .dash-legend{display:flex;gap:14px;margin-top:13px;font-size:11px;color:#65748a}
 .dash-legend span:before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;background:#1d8068;margin-right:5px}
 .dash-legend span+span:before{background:#e2a04b}
 .dash-breakdown{display:grid;gap:12px}
 .dash-break-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;font-size:12px}
 .dash-break-row strong{font-variant-numeric:tabular-nums}
 .dash-break-track{grid-column:1/-1;height:7px;background:#edf1f5;border-radius:10px;overflow:hidden}
 .dash-break-track i{display:block;height:100%;background:#467ba8;border-radius:10px}
 .dash-metric-list{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}
 .dash-metric{background:#f5f7fa;border-radius:9px;padding:10px}
 .dash-metric small{display:block;color:#748398;font-size:10px}
 .dash-metric b{font-size:14px}
 .dash-state{display:grid;grid-template-columns:105px 1fr 26px;gap:9px;align-items:center;margin:11px 0;font-size:12px}
 .dash-state .track{height:8px;background:#edf1f5;border-radius:20px;overflow:hidden}
 .dash-state i{display:block;height:100%;background:#467ba8;border-radius:20px}
 .dash-state b{text-align:right;font-variant-numeric:tabular-nums}
 .dash-section{margin:14px 0}
 .dash-section h3{font-size:15px;margin:0 0 9px}
 .dash-section .ln2{padding:10px 2px;font-size:13px}
 .dash-note{border-left:3px solid #e2a04b;background:#fff9ed;border-radius:0 9px 9px 0;padding:11px 13px;color:#725b36;font-size:12px;margin:12px 0}
 .dash-loading{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:28px;color:#65748a}
 @media(max-width:700px){.dash-kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.dash-kpi{padding:13px}.dash-grid{grid-template-columns:1fr;gap:10px}.dash-card{padding:14px}.dash-day{grid-template-columns:38px minmax(0,1fr) 82px;gap:7px}.dash-metric-list{grid-template-columns:repeat(3,1fr)}.dash-state{grid-template-columns:90px 1fr 24px}}
 @media(min-width:1000px){.dash-kpis{grid-template-columns:repeat(6,minmax(0,1fr))}}
 ` ;
 document.head.appendChild(css);}
 const[s,e]=rango(S.rg||'hoy',S.ra,S.rb),A=s.toISOString(),B=e.toISOString(),rg=S.rg||'hoy';
 $('#main').innerHTML=`<div class="dash-head"><div><div class="dash-kicker">DH Barber · Inteligencia de negocio</div><h2 class="dash-title">Panel gerencial</h2><div class="dash-sub">Indicadores financieros y operativos · ${RG.find(x=>x[0]===rg)?.[1]||'Periodo personalizado'}</div></div><div class="dash-actions"><select id="rg" aria-label="Periodo">${RG.map(([k,l])=>`<option value="${k}"${k===rg?' selected':''}>${l}</option>`).join('')}</select>${rg==='custom'?`<input type="date" id="ra" value="${S.ra||fecha(new Date())}" aria-label="Desde"><input type="date" id="rb" value="${S.rb||fecha(new Date())}" aria-label="Hasta">`:''}<button class="btn sec" id="ex" disabled>Exportar CSV</button></div></div><div id="inf"><div class="dash-loading">Consultando ventas, pagos, gastos y citas…</div></div>`;
 $('#rg').onchange=x=>{S.rg=x.target.value;informe()};
 porConfirmar();
 if(rg==='custom')['ra','rb'].forEach(i=>$('#'+i).onchange=x=>{S[i]=x.target.value;informe()});
 const ejecucion=++informeEjecucion;
 const fuentes=[
  ['ventas',sb.from('ventas').select('id,descuento,fecha_hora,total_venta').eq('negocio_id',S.perfil.negocio_id).neq('estado_venta','ANULADA').gte('fecha_hora',A).lt('fecha_hora',B).order('id',{ascending:true})],
  ['detalles de ventas',sb.from('detalle_ventas').select('tipo_item,descripcion,cantidad,subtotal,costo_unitario,comision_generada,ventas!inner(estado_venta,fecha_hora,barberos(nombre))').eq('negocio_id',S.perfil.negocio_id).neq('ventas.estado_venta','ANULADA').gte('ventas.fecha_hora',A).lt('ventas.fecha_hora',B).order('id',{ascending:true})],
  ['pagos',sb.from('pagos').select('valor_pago,metodo_pago,fecha_hora,cuentas(nombre),ventas!inner(estado_venta)').eq('negocio_id',S.perfil.negocio_id).eq('estado_pago','REGISTRADO').neq('ventas.estado_venta','ANULADA').gte('fecha_hora',A).lt('fecha_hora',B).order('id',{ascending:true})],
  ['gastos',sb.from('gastos').select('categoria_gasto,descripcion,valor,metodo_pago,estado_gasto,fecha_hora').eq('negocio_id',S.perfil.negocio_id).eq('estado_gasto','REGISTRADO').gte('fecha_hora',A).lt('fecha_hora',B).order('id',{ascending:true})],
  ['citas',sb.from('citas').select('inicio,estado').eq('negocio_id',S.perfil.negocio_id).gte('inicio',A).lt('inicio',B).order('id',{ascending:true})]
 ];
 let pendientes=fuentes.map(x=>x[0]);
 $('#inf').innerHTML='<p class="empty">Consultando: '+pendientes.join(', ')+'…</p>';
 const respuestas=await Promise.all(fuentes.map(async([nombre,q])=>{
  const r=await todos(q,nombre);
  if(ejecucion===informeEjecucion){
   pendientes=pendientes.filter(x=>x!==nombre);
   const panel=$('#inf');
   if(panel)panel.innerHTML=r.error
    ?'<p class="empty">No fue posible cargar '+esc(nombre)+': '+esc(r.error.message)+'</p>'
    :pendientes.length?'<p class="empty">Datos recibidos. Falta consultar: '+esc(pendientes.join(', '))+'…</p>':'<p class="empty">Preparando resultados…</p>';
  }
  return r;
 }));
 if(ejecucion!==informeEjecucion||!$('#inf'))return;
 const fallo=respuestas.find(r=>r.error);if(fallo){$('#inf').innerHTML='<p class="empty">No fue posible cargar el informe: '+esc(fallo.error.message)+'</p>';return}
 let etapa='validando los datos';
 try{
 const panelEtapa=mensaje=>{const panel=$('#inf');if(panel)panel.innerHTML='<p class="empty">'+mensaje+'</p>'};
 panelEtapa('Consultas completas. Validando datos…');
 await new Promise(resolve=>setTimeout(resolve,0));
 const[V,D,P,G,C]=respuestas.map(r=>r.data||[]);
 etapa='calculando ventas, costos y gastos';
 panelEtapa('Calculando ventas, costos y gastos…');
 await new Promise(resolve=>setTimeout(resolve,0));
 const sum=(a,f)=>a.reduce((t,x)=>t+Number(f(x)||0),0),cl=x=>Number(x.costo_unitario)*Number(x.cantidad)+Number(x.comision_generada);
 const bruto=sum(D,x=>x.subtotal),desc=sum(V,x=>x.descuento),neto=bruto-desc,costo=sum(D,x=>Number(x.costo_unitario)*Number(x.cantidad)),com=sum(D,x=>x.comision_generada);
 const gast=sum(G.filter(x=>!['COMISIONES','PRODUCTOS'].includes(x.categoria_gasto)),x=>x.valor),util=neto-costo-com-gast;
 const grp=(a,k,f)=>{const m={};a.forEach(x=>{const n=k(x);m[n]=m[n]||{n,c:0,i:0,k:0};f(m[n],x)});return Object.values(m)};
 const lin=(g,e)=>fila2(esc(g.n)+'<br><small>'+g.c+' '+e+', ingresos '+dinero(g.i)+', costo '+dinero(g.k)+'</small>',dinero(g.i-g.k));
 const mg=(a,k,e,flt)=>grp(a.filter(flt||(()=>true)),k,(g,x)=>{g.c+=Number(x.cantidad||0);g.i+=Number(x.subtotal||0);g.k+=cl(x)}).sort((p,q)=>(q.i-q.k)-(p.i-p.k)).map(g=>lin(g,e));
 const sec=(t,r)=>r.length?(t?'<label>'+t+'</label>':'')+r.join(''):'';
 const pm=grp(P,x=>bonito(x.metodo_pago),(g,x)=>{g.i+=Number(x.valor_pago)}).map(g=>fila2(esc(g.n),dinero(g.i))),pc=grp(P.filter(x=>x.cuentas),x=>x.cuentas.nombre,(g,x)=>{g.i+=Number(x.valor_pago)}).map(g=>fila2(esc(g.n),dinero(g.i)));
 etapa='construyendo gráficas y agrupaciones';panelEtapa('Preparando gráficas y agrupaciones…');await new Promise(resolve=>setTimeout(resolve,0));
 const dias={};
 const dia=k=>dias[k]||(dias[k]={ventas:0,gastos:0,citas:0,recaudo:0,operaciones:0,costos:0,utilidad:0});
 V.forEach(x=>{const d=dia(fecha(new Date(x.fecha_hora)));d.ventas+=Number(x.total_venta||0);d.operaciones++});
 D.forEach(x=>{const k=x.ventas?.fecha_hora;if(!k)return;dia(fecha(new Date(k))).costos+=cl(x)});
 P.forEach(x=>{dia(fecha(new Date(x.fecha_hora))).recaudo+=Number(x.valor_pago||0)});
 G.filter(x=>!['COMISIONES','PRODUCTOS'].includes(x.categoria_gasto)).forEach(x=>{const d=dia(fecha(new Date(x.fecha_hora)));d.gastos+=Number(x.valor||0)});
 C.forEach(x=>{const d=dia(fecha(new Date(x.inicio)));d.citas++;if(x.estado==='ATENDIDA')d.atendidas=(d.atendidas||0)+1});
 Object.values(dias).forEach(d=>{d.utilidad=d.ventas-d.costos-d.gastos});
 const serie=Object.entries(dias).sort((a,b)=>a[0].localeCompare(b[0])).slice(-14),cobrado=sum(P,x=>x.valor_pago),ticket=V.length?neto/V.length:0;
 etapa='dibujando el informe';panelEtapa('Mostrando resultados…');await new Promise(resolve=>setTimeout(resolve,0));
 const margen=neto?util/neto*100:0,ratioCobro=neto?cobrado/neto*100:0,atendidas=C.filter(x=>x.estado==='ATENDIDA').length,pendientesC=C.filter(x=>['PENDIENTE','CONFIRMADA'].includes(x.estado)).length;
 const pagosMetodo=grp(P,x=>bonito(x.metodo_pago),(g,x)=>{g.i+=Number(x.valor_pago)}).map(g=>({nombre:g.n,valor:g.i})).sort((a,b)=>b.valor-a.valor);
 const topBarberos=grp(D,x=>x.ventas?.barberos?.nombre||'Sin barbero',(g,x)=>{g.i+=Number(x.subtotal||0);g.k+=cl(x);g.c+=Number(x.cantidad||0)}).map(g=>({nombre:g.n,valor:g.i-g.k})).sort((a,b)=>b.valor-a.valor).slice(0,5);
 const topServicios=grp(D.filter(x=>x.tipo_item==='SERVICIO'),x=>x.descripcion,(g,x)=>{g.i+=Number(x.subtotal||0);g.k+=cl(x);g.c+=Number(x.cantidad||0)}).map(g=>({nombre:g.n,valor:g.i-g.k})).sort((a,b)=>b.valor-a.valor).slice(0,5);
 const estados=['PENDIENTE','CONFIRMADA','ATENDIDA','CANCELADA','NO_ASISTIO'].map(k=>({k,n:C.filter(x=>x.estado===k).length})),maxEstado=Math.max(1,...estados.map(x=>x.n));
 const citasGraf=estados.map(x=>'<div class="dash-state"><span>'+bonito(x.k)+'</span><div class="track"><i style="width:'+100*x.n/maxEstado+'%"></i></div><b>'+x.n+'</b></div>').join('');
 $('#inf').innerHTML=`<div class="dash-kpis">
 <button type="button" class="dash-kpi primary" data-metric="ingresos" aria-pressed="true"><small>Ingresos por ventas</small><strong>${dinero(neto)}</strong><em>Ventas netas del periodo</em></button>
 <button type="button" class="dash-kpi" data-metric="utilidad" aria-pressed="false"><small>Utilidad estimada</small><strong>${dinero(util)}</strong><em>Margen: ${margen.toFixed(1)}%</em></button>
 <button type="button" class="dash-kpi" data-metric="recaudo" aria-pressed="false"><small>Recaudo registrado</small><strong>${dinero(cobrado)}</strong><em>${ratioCobro.toFixed(1)}% de ventas netas</em></button>
 <button type="button" class="dash-kpi" data-metric="operaciones" aria-pressed="false"><small>Operaciones de venta</small><strong>${V.length}</strong><em>Ticket promedio: ${dinero(ticket)}</em></button>
 <button type="button" class="dash-kpi" data-metric="citas" aria-pressed="false"><small>Citas atendidas</small><strong>${atendidas}</strong><em>${pendientesC} pendientes o confirmadas</em></button>
 <button type="button" class="dash-kpi" data-metric="gastos" aria-pressed="false"><small>Gastos operativos</small><strong>${dinero(gast)}</strong><em>${neto? (gast/neto*100).toFixed(1):'0.0'}% de ingresos</em></button>
 </div>
 <div class="dash-grid">
 <section class="dash-card" id="dash-dynamic-graph" aria-live="polite"></section>
 <section class="dash-card"><h3>Rentabilidad del periodo</h3><p class="sub">Composición de ingresos y costos</p>
 <div class="dash-breakdown">
 ${[['Ventas brutas',bruto],['Descuentos',-desc],['Costo de productos',-costo],['Comisiones',-com],['Gastos operativos',-gast],['Utilidad estimada',util]].map(([n,v])=>'<div class="dash-break-row"><span>'+n+'</span><strong>'+dinero(v)+'</strong></div>').join('')}
 </div><div class="dash-metric-list"><div class="dash-metric"><small>Margen utilidad</small><b>${margen.toFixed(1)}%</b></div><div class="dash-metric"><small>Ticket medio</small><b>${dinero(ticket)}</b></div><div class="dash-metric"><small>Ventas</small><b>${V.length}</b></div></div></section>
 </div>
 <div class="dash-grid">
 <section class="dash-card"><h3>Actividad de citas</h3><p class="sub">Estado de las citas · distribución por estado · ${C.length} citas</p>${citasGraf}</section>
 <section class="dash-card"><h3>Recaudo por medio de pago</h3><p class="sub">Pagos registrados y no anulados</p>${pagosMetodo.length?'<div class="dash-breakdown">'+pagosMetodo.map(x=>'<div class="dash-break-row"><span>'+esc(x.nombre)+'</span><strong>'+dinero(x.valor)+'</strong><div class="dash-break-track"><i style="width:'+100*x.valor/Math.max(1,...pagosMetodo.map(y=>y.valor))+'%"></i></div></div>').join('')+'</div>':'<p class="mute">Sin pagos registrados en el periodo.</p>'}</section>
 </div>
 <div class="dash-grid">${barras('Rentabilidad por barbero',topBarberos)}${barras('Servicios con mayor margen',topServicios)}</div>
 <div class="dash-section"><h3>Detalle de rentabilidad por producto</h3>${sec('',mg(D,x=>x.descripcion,'unidades',x=>x.tipo_item==='PRODUCTO').slice(0,8))}</div>
 <div class="dash-note">Criterio contable: la utilidad mostrada es estimada con ventas netas menos costo de productos vendidos, comisiones y gastos operativos registrados. Las compras de inventario y liquidaciones de comisiones no se descuentan otra vez para evitar duplicidad.</div>
 <div class="dash-section"><h3>Recaudo por cuenta</h3>${sec('',pc)}</div>`;
 const metricas={
  ingresos:{titulo:'Comportamiento del negocio',descripcion:'Ventas por día y Gastos por día · últimos 14 días del periodo.',campo:'ventas',moneda:true},
  utilidad:{titulo:'Evolución de utilidad estimada',descripcion:'Ingresos diarios menos costos, comisiones y gastos operativos.',campo:'utilidad',moneda:true},
  recaudo:{titulo:'Evolución del recaudo',descripcion:'Pagos registrados por día, según su fecha de registro.',campo:'recaudo',moneda:true},
  operaciones:{titulo:'Operaciones de venta',descripcion:'Cantidad de ventas registradas por día.',campo:'operaciones',moneda:false},
  citas:{titulo:'Actividad de citas',descripcion:'Cantidad de citas programadas por día.',campo:'citas',moneda:false},
  gastos:{titulo:'Evolución de gastos operativos',descripcion:'Gastos registrados por día, excluyendo compras de inventario y liquidaciones de comisiones.',campo:'gastos',moneda:true}
 };
 const pintarGrafica=clave=>{
  const m=metricas[clave]||metricas.ingresos,panel=$('#dash-dynamic-graph');
  if(!panel)return;
  panel.innerHTML='<h3>'+m.titulo+'</h3><p class="sub">'+m.descripcion+'</p>'+(clave==='ingresos'?graficaComparativa(serie):graficaIndicador(serie,m.campo,m.moneda));
 };
 const tarjetas=Array.from(document.querySelectorAll('#inf .dash-kpi[data-metric]'));
 tarjetas.forEach(tarjeta=>tarjeta.addEventListener('click',()=>{
  tarjetas.forEach(otra=>{
   const activa=otra===tarjeta;
   otra.classList.toggle('primary',activa);
   otra.setAttribute('aria-pressed',String(activa));
  });
  pintarGrafica(tarjeta.dataset.metric);
 }));
 pintarGrafica('ingresos');
 $('#ex').onclick=()=>{
 const csvCell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
 const lineas=[['Tipo','Fecha','Concepto','Barbero','Método','Estado','Cantidad','Ingreso','Costo','Descuento']];
 V.forEach(x=>lineas.push(['VENTA',x.fecha_hora,'Venta '+x.id,'','','',1,Number(x.total_venta||0),0,Number(x.descuento||0)]));
 D.forEach(x=>lineas.push(['DETALLE',x.ventas?.fecha_hora||'',x.descripcion,x.ventas?.barberos?.nombre||'','',x.ventas?.estado_venta||'',x.cantidad,Number(x.subtotal||0),Number(x.costo_unitario||0)*Number(x.cantidad||0),0]));
 P.forEach(x=>lineas.push(['PAGO',x.fecha_hora,'Recaudo','',x.metodo_pago,'REGISTRADO',1,Number(x.valor_pago||0),0,0]));
 G.forEach(x=>lineas.push(['GASTO',x.fecha_hora,x.descripcion||x.categoria_gasto,'',x.metodo_pago,x.estado_gasto,1,-Number(x.valor||0),Number(x.valor||0),0]));
 C.forEach(x=>lineas.push(['CITA',x.inicio,'Cita','','',x.estado,1,0,0,0]));
 const contenido='\uFEFF'+lineas.map(f=>f.map(csvCell).join(';')).join('\r\n');
 const blob=new Blob([contenido],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='informe-barberia-'+fecha(s)+'-'+fecha(new Date(e.getTime()-86400000))+'.csv';
 document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);toast('Informe CSV generado');
 };
 $('#ex').disabled=false;
 }catch(error){
  console.error('Error preparando informe gerencial:',etapa,error);
  const panel=$('#inf');
  if(panel)panel.innerHTML='<p class="empty">No se pudo preparar el informe al '+esc(etapa)+': '+esc(error?.message||String(error))+'</p>';
 }
}

/* ---------- Resumen y ajustes ---------- */
async function inicioSimple(){
 const h0=new Date();h0.setHours(0,0,0,0);const h1=new Date(h0);h1.setDate(h1.getDate()+1);
 const respuestas=await Promise.all([
  mio(sb.from('ventas').select('total_venta').neq('estado_venta','ANULADA').gte('fecha_hora',h0.toISOString()).lt('fecha_hora',h1.toISOString())),
  mio(sb.from('citas').select('inicio,estado,clientes(nombre),barberos(nombre)').in('estado',['PENDIENTE','CONFIRMADA']).gte('inicio',h0.toISOString()).lt('inicio',h1.toISOString())).order('inicio'),
  ADM.includes(S.perfil.rol)?sb.from('stock_actual').select('nombre,existencias,stock_minimo').eq('negocio_id',S.perfil.negocio_id):Promise.resolve({data:[]})]);
 const fallo=respuestas.find(r=>r.error);if(fallo)return toast('No fue posible cargar el resumen: '+fallo.error.message,true);
 const[{data:v},{data:c},{data:s}]=respuestas;
 const tot=(v||[]).reduce((a,x)=>a+Number(x.total_venta),0),bajo=(s||[]).filter(x=>Number(x.existencias)<=Number(x.stock_minimo)),prox=(c||[]).filter(x=>new Date(x.inicio)>=new Date());
 $('#main').innerHTML=`<div class="head"><h2>Hoy</h2></div>
 <div class="kp"><div><small>Vendido hoy</small><strong>${dinero(tot)}</strong></div><div><small>Ventas</small><strong>${(v||[]).length}</strong></div><div><small>Citas pendientes</small><strong>${(c||[]).length}</strong></div></div>
 <label>Próximas citas</label>${prox.length?prox.slice(0,5).map(x=>fila2(hora(x.inicio)+', '+esc(x.clientes?.nombre),esc(x.barberos?.nombre))).join(''):'<p class="empty">No hay más citas por atender hoy.</p>'}
 ${bajo.length?'<label>Stock bajo</label>'+bajo.map(x=>fila2(esc(x.nombre),x.existencias+' (mínimo '+x.stock_minimo+')')).join(''):''}`;
}

 return { inicio };
}
+Math.round(v)};
 function grafica(serie,clave){
  const cfg={ingresos:['Ventas frente a gastos','Comparación diaria de ventas y gastos',[['ventas','Ventas','#167d68'],['gastos','Gastos','#d69a42']],true],recaudo:['Recaudo registrado','Pagos recibidos por fecha de registro',[['recaudo','Recaudo','#3977b8']],true],utilidad:['Utilidad estimada','Ventas netas menos costos, comisiones y gastos',[['utilidad','Utilidad','#167d68']],true],gastos:['Gastos operativos','Egresos registrados sin duplicar compras ni comisiones',[['gastos','Gastos','#d69a42']],true],operaciones:['Ventas realizadas','Cantidad de operaciones por día',[['operaciones','Ventas','#3977b8']],false],citas:['Actividad de citas','Citas programadas por día',[['citas','Citas','#8064b4']],false]}[clave]||null;
  const c=cfg||['Ventas frente a gastos','Comparación diaria de ventas y gastos',[['ventas','Ventas','#167d68'],['gastos','Gastos','#d69a42']],true];
  if(!serie.length)return '<h3>'+c[0]+'</h3><p class="dp-empty">No hay movimientos para graficar en este periodo.</p>';
  const w=720,h=255,L=64,R=18,T=20,B=42,iw=w-L-R,ih=h-T-B,nums=c[2].flatMap(k=>serie.map(x=>Number(x[k[0]]||0)));
  let min=Math.min(0,...nums),max=Math.max(1,...nums);if(min===0)max*=1.12;else{const p=(max-min)*.12;min-=p;max+=p}
  const x=i=>L+(serie.length===1?iw/2:i*iw/(serie.length-1)),y=v=>T+(max-v)/(max-min||1)*ih;
  const grid=Array.from({length:5},(_,i)=>{const v=max-(max-min)*i/4,yy=T+ih*i/4;return '<line x1="'+L+'" y1="'+yy+'" x2="'+(w-R)+'" y2="'+yy+'" stroke="#e9eef4"/><text x="'+(L-9)+'" y="'+(yy+4)+'" text-anchor="end" fill="#8190a3" font-size="10">'+(c[3]?shortMoney(v):Math.round(v))+'</text>'}).join('');
  const labels=serie.map((d,i)=>i===0||i===serie.length-1||i%Math.max(1,Math.ceil(serie.length/7))===0?'<text x="'+x(i)+'" y="'+(h-12)+'" text-anchor="middle" fill="#8190a3" font-size="10">'+esc(d.fecha.slice(5))+'</text>':'').join('');
  const paths=c[2].map(([key,label,color])=>{const pts=serie.map((d,i)=>x(i)+','+y(Number(d[key]||0))),path='M '+pts.join(' L '),area=path+' L '+x(serie.length-1)+','+(T+ih)+' L '+x(0)+','+(T+ih)+' Z',dots=serie.map((d,i)=>'<circle cx="'+x(i)+'" cy="'+y(Number(d[key]||0))+'" r="3" fill="'+color+'" stroke="#fff" stroke-width="1.5"><title>'+esc(d.fecha)+': '+(c[3]?dinero(d[key]):Math.round(Number(d[key]||0)))+'</title></circle>').join('');return '<path d="'+area+'" fill="'+color+'" opacity=".08"/><path d="'+path+'" fill="none" stroke="'+color+'" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>'+dots}).join('');
  const legend=c[2].map(k=>'<span><i style="background:'+k[2]+'"></i>'+k[1]+'</span>').join('');
  return '<div class="dp-chart-head"><div><h3>'+c[0]+'</h3><p>'+c[1]+'</p></div><div class="dp-legend">'+legend+'</div></div><div class="dp-svg-wrap"><svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+c[0]+'">'+grid+paths+labels+'</svg></div>'
 }
 function ranking(items){
  if(!items.length)return '<p class="dp-empty">Sin datos para este periodo.</p>';
  const max=Math.max(1,...items.map(x=>Math.abs(Number(x.valor)||0)));
  return '<div class="dp-ranks">'+items.map((x,i)=>'<div><div class="dp-ranktop"><span><b>'+(i+1)+'</b>'+esc(x.nombre)+'</span><strong>'+dinero(x.valor)+'</strong></div><div class="dp-track"><i style="width:'+100*Math.abs(Number(x.valor)||0)/max+'%"></i></div></div>').join('')+'</div>'
 }
 function estilos(){
  if(document.getElementById('dashboard-pro-style'))return;
  const s=document.createElement('style');s.id='dashboard-pro-style';
  s.textContent='.dashboard-pro{color:#1e293b}.dp-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin:8px 0 18px}.dp-kicker{font-size:10px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#718096}.dp-title{font-size:clamp(26px,3vw,35px);letter-spacing:-.045em;margin:4px 0}.dp-subtitle{color:#718096;font-size:13px}.dp-controls{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.dp-controls select,.dp-controls input{width:auto;min-width:140px;padding:10px 12px;font-size:13px;border:1px solid #dbe3ec;border-radius:10px;background:#fff}.dp-controls .btn{padding:10px 14px;font-size:13px}.dp-note{font-size:11px;color:#718096;margin:0 0 12px}.dp-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px;margin:12px 0}.dp-kpi{border:1px solid #e3e9f0;border-radius:15px;padding:15px;background:#fff;min-width:0;text-align:left;cursor:pointer;box-shadow:0 4px 15px #14243a08;transition:.18s;font:inherit}.dp-kpi:hover{border-color:#9fb0c4;transform:translateY(-1px)}.dp-kpi:focus-visible{outline:3px solid #9bc4e5;outline-offset:2px}.dp-kpi.active{background:#142f4d;border-color:#142f4d;color:#fff}.dp-kpi small{display:block;color:#738197;font-size:11px;font-weight:650}.dp-kpi.active small{color:#c4d3e2}.dp-kpi strong{display:block;font-size:clamp(19px,2vw,25px);letter-spacing:-.035em;margin:8px 0 5px;overflow-wrap:anywhere}.dp-kpi em{display:block;font-size:10px;font-style:normal;color:#8290a2}.dp-kpi.active em{color:#c1d0df}.dp-layout{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(270px,1fr);gap:13px;margin:13px 0}.dp-card{background:#fff;border:1px solid #e3e9f0;border-radius:15px;padding:17px;min-width:0;box-shadow:0 4px 15px #14243a08}.dp-card h3{font-size:15px;margin:0 0 5px}.dp-caption{font-size:11px;color:#7a8798;margin:0 0 14px}.dp-chart-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:8px}.dp-chart-head p{font-size:11px;color:#7a8798;margin:0}.dp-legend{display:flex;gap:12px;flex-wrap:wrap}.dp-legend span{display:inline-flex;align-items:center;gap:5px;color:#65748a;font-size:10px}.dp-legend i{width:8px;height:8px;border-radius:50%;display:inline-block}.dp-svg-wrap{width:100%;overflow:hidden}.dp-svg-wrap svg{display:block;width:100%;height:auto;min-height:180px}.dp-empty{padding:18px 8px;text-align:center;color:#8491a2;font-size:12px}.dp-ops{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.dp-op{background:#f5f7fa;border:1px solid #edf1f5;border-radius:11px;padding:11px}.dp-op small{display:block;color:#758398;font-size:10px}.dp-op b{display:block;font-size:19px;margin-top:4px}.dp-ranks{display:grid;gap:13px}.dp-ranktop{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12px}.dp-ranktop span{min-width:0;overflow-wrap:anywhere}.dp-ranktop strong{white-space:nowrap;font-size:12px}.dp-ranktop b{display:inline-grid;place-items:center;width:20px;height:20px;margin-right:7px;border-radius:6px;background:#eef3f8;color:#52657a;font-size:10px}.dp-track{height:6px;border-radius:9px;background:#edf1f5;margin:7px 0 0;overflow:hidden}.dp-track i{display:block;height:100%;border-radius:9px;background:#477ba5}.dp-status{display:grid;grid-template-columns:105px minmax(0,1fr) 24px;gap:9px;align-items:center;margin:11px 0;font-size:11px}.dp-status .dp-track{margin:0}.dp-status b{text-align:right}.dp-table{width:100%;border-collapse:collapse;font-size:12px}.dp-table td{padding:10px 5px;border-bottom:1px solid #edf1f5}.dp-table tr:last-child td{border:0}.dp-table td:last-child{text-align:right;font-weight:650;white-space:nowrap}.dp-table small{display:block;color:#8290a2;font-size:10px;margin-top:3px}.dp-pill{display:inline-block;border-radius:30px;padding:4px 7px;background:#edf5f2;color:#26715f;font-size:9px;font-weight:700}.dp-alert{padding:10px 12px;border-radius:10px;background:#fff8e9;color:#806333;font-size:11px;margin-top:10px}.dp-foot{font-size:10px;line-height:1.5;color:#8793a2;margin:14px 2px}.dp-progress{padding:18px;border:1px solid #e3e9f0;border-radius:12px;background:#fff;color:#65748a;font-size:12px}@media(min-width:1100px){.dp-kpis{grid-template-columns:repeat(6,minmax(0,1fr))}}@media(max-width:900px){.dp-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.dp-layout{grid-template-columns:1fr}}@media(max-width:560px){.dp-controls{width:100%}.dp-controls select,.dp-controls input{flex:1;min-width:0}.dp-controls .btn{width:100%}.dp-card{padding:13px}.dp-ops{grid-template-columns:repeat(2,minmax(0,1fr))}.dp-status{grid-template-columns:90px minmax(0,1fr) 22px}.dp-kpi{padding:12px}.dp-svg-wrap svg{min-height:160px}}@media(prefers-reduced-motion:reduce){.dp-kpi{transition:none}}';
  document.head.appendChild(s)
 }
 function inicio(){return ADM.includes(S.perfil.rol)?informe():inicioSimple()}
 async function informe(){
  estilos();let bounds;try{bounds=rango(S.rg||'hoy',S.ra,S.rb)}catch(error){toast(error.message,true);return}
  const[s,e]=bounds,A=s.toISOString(),B=e.toISOString(),rg=S.rg||'hoy',id=++ejecucion,hoy=new Date();hoy.setHours(0,0,0,0);const manana=new Date(hoy);manana.setDate(manana.getDate()+1);
  const main=$('#main');main.innerHTML='<div class="dp-progress">Consultando datos de la barbería…</div>';
  const q=(t,c)=>sb.from(t).select(c).eq('negocio_id',S.perfil.negocio_id);
  const fuentes=[
   ['ventas',q('ventas','id,descuento,fecha_hora,total_venta,estado_venta,barbero_id').neq('estado_venta','ANULADA').gte('fecha_hora',A).lt('fecha_hora',B).order('fecha_hora')],
   ['detalles',q('detalle_ventas','tipo_item,descripcion,cantidad,subtotal,costo_unitario,comision_generada,ventas!inner(estado_venta,fecha_hora,barbero_id,barberos(nombre))').neq('ventas.estado_venta','ANULADA').gte('ventas.fecha_hora',A).lt('ventas.fecha_hora',B).order('id')],
   ['pagos',q('pagos','valor_pago,metodo_pago,fecha_hora,cuentas(nombre),ventas!inner(estado_venta,barbero_id)').eq('estado_pago','REGISTRADO').neq('ventas.estado_venta','ANULADA').gte('fecha_hora',A).lt('fecha_hora',B).order('id')],
   ['gastos',q('gastos','categoria_gasto,descripcion,valor,metodo_pago,estado_gasto,fecha_hora').eq('estado_gasto','REGISTRADO').gte('fecha_hora',A).lt('fecha_hora',B).order('id')],
   ['citas',q('citas','inicio,estado,barbero_id,barberos(nombre),clientes(nombre)').gte('inicio',A).lt('inicio',B).order('inicio')],
   ['hoy',q('citas','inicio,estado,barbero_id,barberos(nombre),clientes(nombre)').gte('inicio',hoy.toISOString()).lt('inicio',manana.toISOString()).order('inicio')],
   ['barberos',q('barberos','id,nombre,estado').order('nombre')],
   ['stock',q('stock_actual','nombre,existencias,stock_minimo').order('nombre')]
  ];
  const respuestas=await Promise.all(fuentes.map(([n,query])=>todos(query,n)));
  if(id!==ejecucion||!main.isConnected)return;
  const fallo=respuestas.find(x=>x.error);if(fallo){main.innerHTML='<div class="dp-progress">No se pudo cargar el panel: '+esc(fallo.error.message)+'</div>';return}
  let etapa='calculando indicadores';
  try{
   const[V0,D0,P0,G0,C0,CT0,B0,ST0]=respuestas.map(x=>x.data||[]),sel=S.barberoDash||'todos';
   const V=sel==='todos'?V0:V0.filter(x=>x.barbero_id===sel),D=sel==='todos'?D0:D0.filter(x=>x.ventas?.barbero_id===sel),P=sel==='todos'?P0:P0.filter(x=>x.ventas?.barbero_id===sel),C=sel==='todos'?C0:C0.filter(x=>x.barbero_id===sel),CT=sel==='todos'?CT0:CT0.filter(x=>x.barbero_id===sel);
   const G=G0.filter(x=>!['COMISIONES','PRODUCTOS'].includes(x.categoria_gasto)),neto=suma(V,x=>x.total_venta),descuentos=suma(V,x=>x.descuento),bruto=neto+descuentos,costo=suma(D.filter(x=>x.tipo_item==='PRODUCTO'),x=>Number(x.costo_unitario||0)*Number(x.cantidad||0)),com=suma(D,x=>x.comision_generada),gast=suma(G,x=>x.valor),util=neto-costo-com-gast,recaudo=suma(P,x=>x.valor_pago),nVentas=V.length,ticket=nVentas?neto/nVentas:0,margen=neto?util/neto*100:0;
   const atendidas=C.filter(x=>x.estado==='ATENDIDA').length,gestion=C.filter(x=>['PENDIENTE','CONFIRMADA'].includes(x.estado)).length,hoyPend=CT.filter(x=>['PENDIENTE','CONFIRMADA'].includes(x.estado)).length,hoyAtend=CT.filter(x=>x.estado==='ATENDIDA').length,activos=B0.filter(x=>x.estado==='ACTIVO').length,bajo=ST0.filter(x=>Number(x.existencias)<=Number(x.stock_minimo));
   const pay={};P.forEach(x=>{const k=bonitoSeguro(x.metodo_pago)||'Sin método';pay[k]=(pay[k]||0)+Number(x.valor_pago||0)});
   const payList=Object.entries(pay).map(([nombre,valor])=>({nombre,valor})).sort((a,b)=>b.valor-a.valor);
   const barber={},serv={};D.forEach(x=>{const n=x.ventas?.barberos?.nombre||'Sin barbero';barber[n]=(barber[n]||0)+Number(x.subtotal||0);if(x.tipo_item==='SERVICIO')serv[x.descripcion]=(serv[x.descripcion]||0)+Number(x.subtotal||0)});
   const rank=o=>Object.entries(o).map(([nombre,valor])=>({nombre,valor})).sort((a,b)=>b.valor-a.valor).slice(0,5),topBarberos=rank(barber),topServicios=rank(serv);
   const estados=['PENDIENTE','CONFIRMADA','ATENDIDA','CANCELADA','NO_ASISTIO'].map(k=>({nombre:bonitoSeguro(k),valor:C.filter(x=>x.estado===k).length})),maxEstado=Math.max(1,...estados.map(x=>x.valor));
   const citasHtml=estados.map(x=>'<div class="dp-status"><span>'+esc(x.nombre)+'</span><div class="dp-track"><i style="width:'+100*x.valor/maxEstado+'%"></i></div><b>'+x.valor+'</b></div>').join('');
   const dias={};const dia=k=>dias[k]||(dias[k]={fecha:k,ventas:0,gastos:0,recaudo:0,citas:0,operaciones:0,utilidad:0});
   V.forEach(x=>{const d=dia(localFecha(new Date(x.fecha_hora)));d.ventas+=Number(x.total_venta||0);d.operaciones++});
   D.forEach(x=>{const d=dia(localFecha(new Date(x.ventas.fecha_hora)));if(x.tipo_item==='PRODUCTO')d.gastos+=Number(x.costo_unitario||0)*Number(x.cantidad||0);d.utilidad-=Number(x.comision_generada||0)});
   P.forEach(x=>{dia(localFecha(new Date(x.fecha_hora))).recaudo+=Number(x.valor_pago||0)});
   G.forEach(x=>{dia(localFecha(new Date(x.fecha_hora))).gastos+=Number(x.valor||0)});
   C.forEach(x=>{dia(localFecha(new Date(x.inicio))).citas++});
   Object.values(dias).forEach(d=>{d.utilidad+=d.ventas-d.gastos});
   const serie=Object.values(dias).sort((a,b)=>a.fecha.localeCompare(b.fecha)).slice(-31),periodo=RG.find(x=>x[0]===rg)?.[1]||'Periodo personalizado';
   const opts='<option value="todos">Todo el equipo</option>'+B0.filter(x=>x.estado==='ACTIVO').map(x=>'<option value="'+esc(x.id)+'"'+(x.id===sel?' selected':'')+'>'+esc(x.nombre)+'</option>').join('');
   const kpi=(key,title,value,note)=>'<button type="button" class="dp-kpi'+(key==='ingresos'?' active':'')+'" data-metric="'+key+'" aria-pressed="'+(key==='ingresos')+'"><small>'+title+'</small><strong>'+value+'</strong><em>'+note+'</em></button>';
   const proximas=CT.filter(x=>new Date(x.inicio)>=new Date()).slice(0,6),recent=[...V].sort((a,b)=>new Date(b.fecha_hora)-new Date(a.fecha_hora)).slice(0,6);
   main.innerHTML='<section class="dashboard-pro"><header class="dp-head"><div><div class="dp-kicker">DH Barber · Centro de control</div><h2 class="dp-title">Panel gerencial</h2><div class="dp-subtitle">Visión financiera y operativa · '+periodo+'</div></div><div class="dp-controls"><select id="dp-rango" aria-label="Periodo">'+RG.map(x=>'<option value="'+x[0]+'"'+(x[0]===rg?' selected':'')+'>'+x[1]+'</option>').join('')+'</select>'+(rg==='custom'?'<input type="date" id="dp-desde" value="'+esc(S.ra||fecha(s))+'" aria-label="Desde"><input type="date" id="dp-hasta" value="'+esc(S.rb||fecha(new Date(e.getTime()-86400000)))+'" aria-label="Hasta">':'')+'<select id="dp-barbero" aria-label="Filtrar por barbero">'+opts+'</select><button type="button" class="btn sec" id="dp-exportar">Exportar CSV</button></div></header>'+
   '<p class="dp-note">Datos del negocio activo. La utilidad es estimada y no equivale al efectivo disponible ni al saldo de caja.</p><div class="dp-kpis">'+
   kpi('ingresos','Ventas netas',dinero(neto),'Después de descuentos')+kpi('recaudo','Recaudo registrado',dinero(recaudo),'Pagos recibidos en el periodo')+kpi('utilidad','Utilidad estimada',dinero(util),'Margen: '+margen.toFixed(1)+'%')+kpi('gastos','Gastos operativos',dinero(gast),'Sin compras ni liquidaciones')+kpi('operaciones','Ventas realizadas',nVentas,'Ticket promedio: '+dinero(ticket))+kpi('citas','Citas atendidas',atendidas,gestion+' pendientes o confirmadas')+'</div>'+
   '<div class="dp-layout"><section class="dp-card" id="dp-grafica" aria-live="polite"></section><section class="dp-card"><h3>Rentabilidad del periodo</h3><p class="dp-caption">Composición del resultado estimado</p><table class="dp-table"><tbody><tr><td>Ventas brutas</td><td>'+dinero(bruto)+'</td></tr><tr><td>Descuentos</td><td>− '+dinero(descuentos)+'</td></tr><tr><td>Costo de productos</td><td>− '+dinero(costo)+'</td></tr><tr><td>Comisiones generadas</td><td>− '+dinero(com)+'</td></tr><tr><td>Gastos operativos</td><td>− '+dinero(gast)+'</td></tr><tr><td><b>Utilidad estimada</b></td><td><b>'+dinero(util)+'</b></td></tr></tbody></table><div class="dp-alert">No representa el efectivo disponible ni reemplaza el cierre de caja.</div></section></div>'+
   '<div class="dp-layout"><section class="dp-card"><h3>Operación de hoy</h3><p class="dp-caption">Actividad del día, independiente del periodo financiero</p><div class="dp-ops"><div class="dp-op"><small>Citas hoy</small><b>'+CT.length+'</b></div><div class="dp-op"><small>Por atender</small><b>'+hoyPend+'</b></div><div class="dp-op"><small>Atendidas</small><b>'+hoyAtend+'</b></div><div class="dp-op"><small>Barberos activos</small><b>'+activos+'</b></div></div><h3 style="margin-top:18px">Próximas citas</h3>'+(proximas.length?'<table class="dp-table"><tbody>'+proximas.map(x=>'<tr><td>'+esc(x.clientes?.nombre||'Cliente')+'<small>'+esc(x.barberos?.nombre||'Sin barbero')+' · '+esc(hora(x.inicio))+'</small></td><td><span class="dp-pill">'+esc(bonitoSeguro(x.estado))+'</span></td></tr>').join('')+'</tbody></table>':'<p class="dp-empty">No hay más citas hoy.</p>')+'</section>'+
   '<section class="dp-card"><h3>Estado de las citas</h3><p class="dp-caption">Distribución del periodo · '+C.length+' citas</p>'+citasHtml+'</section></div>'+
   '<div class="dp-layout"><section class="dp-card"><h3>Recaudo por medio de pago</h3><p class="dp-caption">Método registrado</p>'+ranking(payList)+'</section><section class="dp-card"><h3>Barberos con más ventas</h3><p class="dp-caption">Ingresos asociados a detalles vendidos</p>'+ranking(topBarberos)+'</section></div>'+
   '<div class="dp-layout"><section class="dp-card"><h3>Servicios más vendidos</h3><p class="dp-caption">Valor vendido por servicio</p>'+ranking(topServicios)+'</section><section class="dp-card"><h3>Alertas de inventario</h3><p class="dp-caption">Productos iguales o por debajo del mínimo</p>'+(bajo.length?'<table class="dp-table"><tbody>'+bajo.slice(0,8).map(x=>'<tr><td>'+esc(x.nombre)+'</td><td>'+Number(x.existencias)+' / '+Number(x.stock_minimo)+' mín.</td></tr>').join('')+'</tbody></table>':'<p class="dp-empty">No hay productos por debajo del mínimo.</p>')+(bajo.length>8?'<p class="dp-caption">Y '+(bajo.length-8)+' productos más.</p>':'')+'</section></div>'+
   '<section class="dp-card"><h3>Últimas ventas del periodo</h3><p class="dp-caption">Ventas no anuladas</p>'+(recent.length?'<table class="dp-table"><tbody>'+recent.map(x=>'<tr><td>Venta '+esc(String(x.id).slice(0,8))+'<small>'+esc(new Date(x.fecha_hora).toLocaleString('es-CO',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}))+'</small></td><td>'+dinero(x.total_venta)+'</td></tr>').join('')+'</tbody></table>':'<p class="dp-empty">No hay ventas en el periodo.</p>')+'</section>'+
   '<p class="dp-foot">Criterio: utilidad estimada = ventas netas − costo de productos vendidos − comisiones generadas − gastos operativos registrados. Los pagos se muestran por fecha de recaudo. Las compras de inventario y liquidaciones de comisiones se excluyen para evitar duplicidad.</p></section>';
   const pintar=key=>{const el=$('#dp-grafica');if(el)el.innerHTML=grafica(serie,key)};
   const cards=Array.from(main.querySelectorAll('[data-metric]'));cards.forEach(t=>t.addEventListener('click',()=>{cards.forEach(o=>{const a=o===t;o.classList.toggle('active',a);o.setAttribute('aria-pressed',String(a))});pintar(t.dataset.metric)}));pintar('ingresos');
   $('#dp-rango').onchange=x=>{S.rg=x.target.value;informe()};$('#dp-barbero').onchange=x=>{S.barberoDash=x.target.value;informe()};
   if(rg==='custom'){$('#dp-desde').onchange=x=>{S.ra=x.target.value;informe()};$('#dp-hasta').onchange=x=>{S.rb=x.target.value;informe()}}
   $('#dp-exportar').onclick=()=>{const cell=v=>'"'+String(v??'').replace(/"/g,'""')+'"',rows=[['Tipo','Fecha','Concepto','Barbero','Método','Estado','Cantidad','Valor','Costo']];V.forEach(x=>rows.push(['VENTA',x.fecha_hora,'Venta '+x.id,'','',x.estado_venta,1,Number(x.total_venta||0),0]));D.forEach(x=>rows.push(['DETALLE',x.ventas?.fecha_hora||'',x.descripcion,x.ventas?.barberos?.nombre||'','',x.ventas?.estado_venta||'',x.cantidad,Number(x.subtotal||0),Number(x.costo_unitario||0)*Number(x.cantidad||0)]));P.forEach(x=>rows.push(['PAGO',x.fecha_hora,'Recaudo','',x.metodo_pago,'REGISTRADO',1,Number(x.valor_pago||0),0]));G0.filter(x=>!['COMISIONES','PRODUCTOS'].includes(x.categoria_gasto)).forEach(x=>rows.push(['GASTO',x.fecha_hora,x.descripcion||x.categoria_gasto,'',x.metodo_pago,x.estado_gasto,1,-Number(x.valor||0),Number(x.valor||0)]));C.forEach(x=>rows.push(['CITA',x.inicio,'Cita',x.barberos?.nombre||'','',x.estado,1,0,0]));const blob=new Blob(['\uFEFF'+rows.map(r=>r.map(cell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='informe-barberia-'+fecha(s)+'-'+fecha(new Date(e.getTime()-86400000))+'.csv';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);toast('Informe CSV generado')};
  }catch(error){console.error('Error preparando el panel gerencial:',etapa,error);if(id===ejecucion&&main.isConnected)main.innerHTML='<div class="dp-progress">No se pudo preparar el informe al '+esc(etapa)+': '+esc(error?.message||String(error))+'</div>'}
 }
 async function inicioSimple(){
  const a=new Date();a.setHours(0,0,0,0);const b=new Date(a);b.setDate(b.getDate()+1);
  const r=await Promise.all([mio(sb.from('ventas').select('total_venta,fecha_hora').neq('estado_venta','ANULADA').gte('fecha_hora',a.toISOString()).lt('fecha_hora',b.toISOString())),mio(sb.from('citas').select('inicio,estado,clientes(nombre),barberos(nombre)').in('estado',['PENDIENTE','CONFIRMADA']).gte('inicio',a.toISOString()).lt('inicio',b.toISOString()).order('inicio'))]);
  const fallo=r.find(x=>x.error);if(fallo)return toast('No fue posible cargar el resumen: '+fallo.error.message,true);
  const[v,c]=r.map(x=>x.data||[]),tot=suma(v,x=>x.total_venta),prox=c.filter(x=>new Date(x.inicio)>=new Date());
  $('#main').innerHTML='<section class="dashboard-pro"><header class="dp-head"><div><div class="dp-kicker">DH Barber · Mi jornada</div><h2 class="dp-title">Resumen de hoy</h2><div class="dp-subtitle">Tu actividad y próximas citas</div></div></header><div class="dp-kpis"><div class="dp-kpi"><small>Ventas propias hoy</small><strong>'+dinero(tot)+'</strong></div><div class="dp-kpi"><small>Ventas realizadas</small><strong>'+v.length+'</strong></div><div class="dp-kpi"><small>Citas por atender</small><strong>'+c.length+'</strong></div></div><section class="dp-card"><h3>Próximas citas</h3>'+(prox.length?'<table class="dp-table"><tbody>'+prox.slice(0,8).map(x=>'<tr><td>'+esc(x.clientes?.nombre||'Cliente')+'<small>'+esc(bonitoSeguro(x.estado))+'</small></td><td>'+esc(hora(x.inicio))+'</td></tr>').join('')+'</tbody></table>':'<p class="dp-empty">No tienes más citas pendientes hoy.</p>')+'</section></section>'
 }
 return {inicio}
}

export function crearModuloInicio(deps) {
 return crearModuloInicioCompleto(deps);
 const { $, sb, S, esc, dinero, hora, fecha, bonito, toast, ADM, mio, fila2, porConfirmar } = deps;
const RG=[['hoy','Hoy'],['ayer','Ayer'],['semana','Esta semana'],['mes','Este mes'],['30','Últimos 30 días'],['custom','Personalizado']];
let informeEjecucion=0;
function rango(v,a,b){const d=new Date();d.setHours(0,0,0,0);const s=new Date(d);let e=new Date(d);e.setDate(e.getDate()+1);
 if(v==='ayer'){s.setDate(s.getDate()-1);e=new Date(d)}
 else if(v==='semana')s.setDate(s.getDate()-((s.getDay()+6)%7));
 else if(v==='mes')s.setDate(1);
 else if(v==='30')s.setDate(s.getDate()-29);
 else if(v==='custom'){const x=new Date((a||fecha(d))+'T00:00:00');e=new Date((b||fecha(d))+'T00:00:00');e.setDate(e.getDate()+1);return[x,e]}
 return[s,e]}
function inicio(){return ADM.includes(S.perfil.rol)?informe():inicioSimple()}
async function todos(q,nombre){
 const filas=[];let desde=0;
 while(true){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),20000);
  let resultado;
  try{resultado=await q.abortSignal(controller.signal).range(desde,desde+999)}
  catch(error){resultado={data:null,error}}
  finally{clearTimeout(timer)}
  if(resultado.error)return{data:null,error:{message:controller.signal.aborted?'La consulta de '+nombre+' superó los 20 segundos. Revisa la conexión o los permisos de lectura.':nombre+': '+resultado.error.message}};
  const bloque=resultado.data||[];filas.push(...bloque);
  if(bloque.length<1000)break;
  desde+=1000;
  if(desde>=50000)return{data:null,error:{message:'La consulta de '+nombre+' superó el límite de seguridad de 50.000 registros para este informe.'}};
 }
 return{data:filas,error:null};
}
function graficaComparativa(serie){
 if(!serie.length)return '<p class="mute">No hay movimientos en el periodo seleccionado.</p>';
 const max=Math.max(1,...serie.map(([,v])=>Math.max(v.ventas,v.gastos)));
 return '<div class="dash-chart">'+serie.map(([k,v])=>'<div class="dash-day"><span class="date">'+esc(k.slice(5))+'</span><div class="dash-bars"><div class="dash-bar rev"><i style="width:'+100*v.ventas/max+'%"></i></div><div class="dash-bar exp"><i style="width:'+100*v.gastos/max+'%"></i></div></div><span class="amount">'+dinero(v.ventas)+'</span></div>').join('')+'</div><div class="dash-legend"><span>Ventas</span><span>Gastos</span></div>';
}
function grafica(titulo,serie,campo,maximo,color){ return graficaComparativa(serie); }
function graficaIndicador(serie,campo,esMoneda=true){
 if(!serie.length||!serie.some(([,v])=>Number(v[campo]||0)!==0))return '<p class="mute">No hay movimientos en el periodo seleccionado.</p>';
 const max=Math.max(1,...serie.map(([,v])=>Math.abs(Number(v[campo]||0))));
 return '<div class="dash-chart">'+serie.map(([k,v])=>{
  const n=Number(v[campo]||0),ancho=100*Math.abs(n)/max;
  return '<div class="dash-day"><span class="date">'+esc(k.slice(5))+'</span><div class="dash-bars"><div class="dash-bar '+(n<0?'exp':'rev')+'"><i style="width:'+ancho+'%"></i></div></div><span class="amount">'+(esMoneda?dinero(n):String(Math.round(n)))+'</span></div>';
 }).join('')+'</div>';
}
function barras(titulo,datos,total){
 if(!datos.length)return '';
 const max=Math.max(1,...datos.map(x=>x.valor));
 return '<div class="dash-card"><h3>'+titulo+'</h3><p class="sub">Participación sobre el total del periodo</p><div class="dash-breakdown">'+datos.map(x=>'<div class="dash-break-row"><span>'+esc(x.nombre)+'</span><strong>'+dinero(x.valor)+'</strong><div class="dash-break-track"><i style="width:'+100*x.valor/max+'%"></i></div></div>').join('')+'</div></div>';
}
async function informe(){
 if(!document.getElementById('dashboard-chart-style')){const css=document.createElement('style');css.id='dashboard-chart-style';
 css.textContent=`
 #main:has(#inf){max-width:1240px}
 .dash-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin:10px 0 18px;flex-wrap:wrap}
 .dash-kicker{font-size:11px;letter-spacing:.13em;text-transform:uppercase;color:#63738a;font-weight:800}
 .dash-title{font-size:clamp(25px,4vw,34px);letter-spacing:-.04em;margin:3px 0 4px}
 .dash-sub{font-size:13px;color:#65748a}
 .dash-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
 .dash-actions select,.dash-actions input{min-width:145px;width:auto;padding:10px 12px;font-size:13px}
 .dash-actions .btn{padding:10px 14px;font-size:13px}
 .dash-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:14px 0}
 .dash-kpi{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px;min-width:0;box-shadow:0 3px 12px #10223f08;cursor:pointer;text-align:left;width:100%;font:inherit;transition:border-color .18s,box-shadow .18s,transform .18s}
 .dash-kpi:hover{border-color:#9aabc0;transform:translateY(-2px)}
 .dash-kpi:focus-visible{outline:3px solid #8bb8dc;outline-offset:2px}
 .dash-kpi.primary{box-shadow:0 0 0 2px #102b4920,0 5px 16px #10223f12}
 .dash-kpi.primary small{color:#c2d1e2}
 .dash-kpi.primary em{color:#b6c8da}
 .dash-kpi.primary{background:#102b49;color:#fff;border-color:#102b49}
 .dash-kpi small{display:block;font-size:12px;color:#718096;font-weight:600}
 .dash-kpi.primary small{color:#c2d1e2}
 .dash-kpi strong{display:block;font-size:clamp(19px,2.5vw,27px);letter-spacing:-.03em;margin:7px 0 4px;overflow-wrap:anywhere}
 .dash-kpi em{font-style:normal;font-size:11px;color:#748398}
 .dash-kpi.primary em{color:#b6c8da}
 .dash-grid{display:grid;grid-template-columns:1.45fr 1fr;gap:14px;margin:14px 0}
 .dash-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:17px;min-width:0;box-shadow:0 3px 12px #10223f08}
 .dash-card h3{font-size:15px;margin:0 0 4px;letter-spacing:-.01em}
 .dash-card .sub{font-size:12px;color:#718096;margin:0 0 14px}
 .dash-chart{display:grid;gap:10px}
 .dash-day{display:grid;grid-template-columns:44px minmax(0,1fr) 90px;gap:10px;align-items:center;font-size:11px}
 .dash-day .date{color:#758398}
 .dash-bars{display:grid;gap:4px}
 .dash-bar{height:8px;background:#edf1f5;border-radius:20px;overflow:hidden}
 .dash-bar i{display:block;height:100%;border-radius:20px}
 .dash-bar.rev i{background:#1d8068}.dash-bar.exp i{background:#e2a04b}
 .dash-day .amount{font-variant-numeric:tabular-nums;text-align:right;color:#46566b;white-space:nowrap}
 .dash-legend{display:flex;gap:14px;margin-top:13px;font-size:11px;color:#65748a}
 .dash-legend span:before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;background:#1d8068;margin-right:5px}
 .dash-legend span+span:before{background:#e2a04b}
 .dash-breakdown{display:grid;gap:12px}
 .dash-break-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;font-size:12px}
 .dash-break-row strong{font-variant-numeric:tabular-nums}
 .dash-break-track{grid-column:1/-1;height:7px;background:#edf1f5;border-radius:10px;overflow:hidden}
 .dash-break-track i{display:block;height:100%;background:#467ba8;border-radius:10px}
 .dash-metric-list{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}
 .dash-metric{background:#f5f7fa;border-radius:9px;padding:10px}
 .dash-metric small{display:block;color:#748398;font-size:10px}
 .dash-metric b{font-size:14px}
 .dash-state{display:grid;grid-template-columns:105px 1fr 26px;gap:9px;align-items:center;margin:11px 0;font-size:12px}
 .dash-state .track{height:8px;background:#edf1f5;border-radius:20px;overflow:hidden}
 .dash-state i{display:block;height:100%;background:#467ba8;border-radius:20px}
 .dash-state b{text-align:right;font-variant-numeric:tabular-nums}
 .dash-section{margin:14px 0}
 .dash-section h3{font-size:15px;margin:0 0 9px}
 .dash-section .ln2{padding:10px 2px;font-size:13px}
 .dash-note{border-left:3px solid #e2a04b;background:#fff9ed;border-radius:0 9px 9px 0;padding:11px 13px;color:#725b36;font-size:12px;margin:12px 0}
 .dash-loading{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:28px;color:#65748a}
 @media(max-width:700px){.dash-kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.dash-kpi{padding:13px}.dash-grid{grid-template-columns:1fr;gap:10px}.dash-card{padding:14px}.dash-day{grid-template-columns:38px minmax(0,1fr) 82px;gap:7px}.dash-metric-list{grid-template-columns:repeat(3,1fr)}.dash-state{grid-template-columns:90px 1fr 24px}}
 @media(min-width:1000px){.dash-kpis{grid-template-columns:repeat(6,minmax(0,1fr))}}
 ` ;
 document.head.appendChild(css);}
 const[s,e]=rango(S.rg||'hoy',S.ra,S.rb),A=s.toISOString(),B=e.toISOString(),rg=S.rg||'hoy';
 $('#main').innerHTML=`<div class="dash-head"><div><div class="dash-kicker">DH Barber · Inteligencia de negocio</div><h2 class="dash-title">Panel gerencial</h2><div class="dash-sub">Indicadores financieros y operativos · ${RG.find(x=>x[0]===rg)?.[1]||'Periodo personalizado'}</div></div><div class="dash-actions"><select id="rg" aria-label="Periodo">${RG.map(([k,l])=>`<option value="${k}"${k===rg?' selected':''}>${l}</option>`).join('')}</select>${rg==='custom'?`<input type="date" id="ra" value="${S.ra||fecha(new Date())}" aria-label="Desde"><input type="date" id="rb" value="${S.rb||fecha(new Date())}" aria-label="Hasta">`:''}<button class="btn sec" id="ex" disabled>Exportar CSV</button></div></div><div id="inf"><div class="dash-loading">Consultando ventas, pagos, gastos y citas…</div></div>`;
 $('#rg').onchange=x=>{S.rg=x.target.value;informe()};
 porConfirmar();
 if(rg==='custom')['ra','rb'].forEach(i=>$('#'+i).onchange=x=>{S[i]=x.target.value;informe()});
 const ejecucion=++informeEjecucion;
 const fuentes=[
  ['ventas',sb.from('ventas').select('id,descuento,fecha_hora,total_venta').eq('negocio_id',S.perfil.negocio_id).neq('estado_venta','ANULADA').gte('fecha_hora',A).lt('fecha_hora',B).order('id',{ascending:true})],
  ['detalles de ventas',sb.from('detalle_ventas').select('tipo_item,descripcion,cantidad,subtotal,costo_unitario,comision_generada,ventas!inner(estado_venta,fecha_hora,barberos(nombre))').eq('negocio_id',S.perfil.negocio_id).neq('ventas.estado_venta','ANULADA').gte('ventas.fecha_hora',A).lt('ventas.fecha_hora',B).order('id',{ascending:true})],
  ['pagos',sb.from('pagos').select('valor_pago,metodo_pago,fecha_hora,cuentas(nombre),ventas!inner(estado_venta)').eq('negocio_id',S.perfil.negocio_id).eq('estado_pago','REGISTRADO').neq('ventas.estado_venta','ANULADA').gte('fecha_hora',A).lt('fecha_hora',B).order('id',{ascending:true})],
  ['gastos',sb.from('gastos').select('categoria_gasto,descripcion,valor,metodo_pago,estado_gasto,fecha_hora').eq('negocio_id',S.perfil.negocio_id).eq('estado_gasto','REGISTRADO').gte('fecha_hora',A).lt('fecha_hora',B).order('id',{ascending:true})],
  ['citas',sb.from('citas').select('inicio,estado').eq('negocio_id',S.perfil.negocio_id).gte('inicio',A).lt('inicio',B).order('id',{ascending:true})]
 ];
 let pendientes=fuentes.map(x=>x[0]);
 $('#inf').innerHTML='<p class="empty">Consultando: '+pendientes.join(', ')+'…</p>';
 const respuestas=await Promise.all(fuentes.map(async([nombre,q])=>{
  const r=await todos(q,nombre);
  if(ejecucion===informeEjecucion){
   pendientes=pendientes.filter(x=>x!==nombre);
   const panel=$('#inf');
   if(panel)panel.innerHTML=r.error
    ?'<p class="empty">No fue posible cargar '+esc(nombre)+': '+esc(r.error.message)+'</p>'
    :pendientes.length?'<p class="empty">Datos recibidos. Falta consultar: '+esc(pendientes.join(', '))+'…</p>':'<p class="empty">Preparando resultados…</p>';
  }
  return r;
 }));
 if(ejecucion!==informeEjecucion||!$('#inf'))return;
 const fallo=respuestas.find(r=>r.error);if(fallo){$('#inf').innerHTML='<p class="empty">No fue posible cargar el informe: '+esc(fallo.error.message)+'</p>';return}
 let etapa='validando los datos';
 try{
 const panelEtapa=mensaje=>{const panel=$('#inf');if(panel)panel.innerHTML='<p class="empty">'+mensaje+'</p>'};
 panelEtapa('Consultas completas. Validando datos…');
 await new Promise(resolve=>setTimeout(resolve,0));
 const[V,D,P,G,C]=respuestas.map(r=>r.data||[]);
 etapa='calculando ventas, costos y gastos';
 panelEtapa('Calculando ventas, costos y gastos…');
 await new Promise(resolve=>setTimeout(resolve,0));
 const sum=(a,f)=>a.reduce((t,x)=>t+Number(f(x)||0),0),cl=x=>Number(x.costo_unitario)*Number(x.cantidad)+Number(x.comision_generada);
 const bruto=sum(D,x=>x.subtotal),desc=sum(V,x=>x.descuento),neto=bruto-desc,costo=sum(D,x=>Number(x.costo_unitario)*Number(x.cantidad)),com=sum(D,x=>x.comision_generada);
 const gast=sum(G.filter(x=>!['COMISIONES','PRODUCTOS'].includes(x.categoria_gasto)),x=>x.valor),util=neto-costo-com-gast;
 const grp=(a,k,f)=>{const m={};a.forEach(x=>{const n=k(x);m[n]=m[n]||{n,c:0,i:0,k:0};f(m[n],x)});return Object.values(m)};
 const lin=(g,e)=>fila2(esc(g.n)+'<br><small>'+g.c+' '+e+', ingresos '+dinero(g.i)+', costo '+dinero(g.k)+'</small>',dinero(g.i-g.k));
 const mg=(a,k,e,flt)=>grp(a.filter(flt||(()=>true)),k,(g,x)=>{g.c+=Number(x.cantidad||0);g.i+=Number(x.subtotal||0);g.k+=cl(x)}).sort((p,q)=>(q.i-q.k)-(p.i-p.k)).map(g=>lin(g,e));
 const sec=(t,r)=>r.length?(t?'<label>'+t+'</label>':'')+r.join(''):'';
 const pm=grp(P,x=>bonito(x.metodo_pago),(g,x)=>{g.i+=Number(x.valor_pago)}).map(g=>fila2(esc(g.n),dinero(g.i))),pc=grp(P.filter(x=>x.cuentas),x=>x.cuentas.nombre,(g,x)=>{g.i+=Number(x.valor_pago)}).map(g=>fila2(esc(g.n),dinero(g.i)));
 etapa='construyendo gráficas y agrupaciones';panelEtapa('Preparando gráficas y agrupaciones…');await new Promise(resolve=>setTimeout(resolve,0));
 const dias={};
 const dia=k=>dias[k]||(dias[k]={ventas:0,gastos:0,citas:0,recaudo:0,operaciones:0,costos:0,utilidad:0});
 V.forEach(x=>{const d=dia(fecha(new Date(x.fecha_hora)));d.ventas+=Number(x.total_venta||0);d.operaciones++});
 D.forEach(x=>{const k=x.ventas?.fecha_hora;if(!k)return;dia(fecha(new Date(k))).costos+=cl(x)});
 P.forEach(x=>{dia(fecha(new Date(x.fecha_hora))).recaudo+=Number(x.valor_pago||0)});
 G.filter(x=>!['COMISIONES','PRODUCTOS'].includes(x.categoria_gasto)).forEach(x=>{const d=dia(fecha(new Date(x.fecha_hora)));d.gastos+=Number(x.valor||0)});
 C.forEach(x=>{const d=dia(fecha(new Date(x.inicio)));d.citas++;if(x.estado==='ATENDIDA')d.atendidas=(d.atendidas||0)+1});
 Object.values(dias).forEach(d=>{d.utilidad=d.ventas-d.costos-d.gastos});
 const serie=Object.entries(dias).sort((a,b)=>a[0].localeCompare(b[0])).slice(-14),cobrado=sum(P,x=>x.valor_pago),ticket=V.length?neto/V.length:0;
 etapa='dibujando el informe';panelEtapa('Mostrando resultados…');await new Promise(resolve=>setTimeout(resolve,0));
 const margen=neto?util/neto*100:0,ratioCobro=neto?cobrado/neto*100:0,atendidas=C.filter(x=>x.estado==='ATENDIDA').length,pendientesC=C.filter(x=>['PENDIENTE','CONFIRMADA'].includes(x.estado)).length;
 const pagosMetodo=grp(P,x=>bonito(x.metodo_pago),(g,x)=>{g.i+=Number(x.valor_pago)}).map(g=>({nombre:g.n,valor:g.i})).sort((a,b)=>b.valor-a.valor);
 const topBarberos=grp(D,x=>x.ventas?.barberos?.nombre||'Sin barbero',(g,x)=>{g.i+=Number(x.subtotal||0);g.k+=cl(x);g.c+=Number(x.cantidad||0)}).map(g=>({nombre:g.n,valor:g.i-g.k})).sort((a,b)=>b.valor-a.valor).slice(0,5);
 const topServicios=grp(D.filter(x=>x.tipo_item==='SERVICIO'),x=>x.descripcion,(g,x)=>{g.i+=Number(x.subtotal||0);g.k+=cl(x);g.c+=Number(x.cantidad||0)}).map(g=>({nombre:g.n,valor:g.i-g.k})).sort((a,b)=>b.valor-a.valor).slice(0,5);
 const estados=['PENDIENTE','CONFIRMADA','ATENDIDA','CANCELADA','NO_ASISTIO'].map(k=>({k,n:C.filter(x=>x.estado===k).length})),maxEstado=Math.max(1,...estados.map(x=>x.n));
 const citasGraf=estados.map(x=>'<div class="dash-state"><span>'+bonito(x.k)+'</span><div class="track"><i style="width:'+100*x.n/maxEstado+'%"></i></div><b>'+x.n+'</b></div>').join('');
 $('#inf').innerHTML=`<div class="dash-kpis">
 <button type="button" class="dash-kpi primary" data-metric="ingresos" aria-pressed="true"><small>Ingresos por ventas</small><strong>${dinero(neto)}</strong><em>Ventas netas del periodo</em></button>
 <button type="button" class="dash-kpi" data-metric="utilidad" aria-pressed="false"><small>Utilidad estimada</small><strong>${dinero(util)}</strong><em>Margen: ${margen.toFixed(1)}%</em></button>
 <button type="button" class="dash-kpi" data-metric="recaudo" aria-pressed="false"><small>Recaudo registrado</small><strong>${dinero(cobrado)}</strong><em>${ratioCobro.toFixed(1)}% de ventas netas</em></button>
 <button type="button" class="dash-kpi" data-metric="operaciones" aria-pressed="false"><small>Operaciones de venta</small><strong>${V.length}</strong><em>Ticket promedio: ${dinero(ticket)}</em></button>
 <button type="button" class="dash-kpi" data-metric="citas" aria-pressed="false"><small>Citas atendidas</small><strong>${atendidas}</strong><em>${pendientesC} pendientes o confirmadas</em></button>
 <button type="button" class="dash-kpi" data-metric="gastos" aria-pressed="false"><small>Gastos operativos</small><strong>${dinero(gast)}</strong><em>${neto? (gast/neto*100).toFixed(1):'0.0'}% de ingresos</em></button>
 </div>
 <div class="dash-grid">
 <section class="dash-card" id="dash-dynamic-graph" aria-live="polite"></section>
 <section class="dash-card"><h3>Rentabilidad del periodo</h3><p class="sub">Composición de ingresos y costos</p>
 <div class="dash-breakdown">
 ${[['Ventas brutas',bruto],['Descuentos',-desc],['Costo de productos',-costo],['Comisiones',-com],['Gastos operativos',-gast],['Utilidad estimada',util]].map(([n,v])=>'<div class="dash-break-row"><span>'+n+'</span><strong>'+dinero(v)+'</strong></div>').join('')}
 </div><div class="dash-metric-list"><div class="dash-metric"><small>Margen utilidad</small><b>${margen.toFixed(1)}%</b></div><div class="dash-metric"><small>Ticket medio</small><b>${dinero(ticket)}</b></div><div class="dash-metric"><small>Ventas</small><b>${V.length}</b></div></div></section>
 </div>
 <div class="dash-grid">
 <section class="dash-card"><h3>Actividad de citas</h3><p class="sub">Estado de las citas · distribución por estado · ${C.length} citas</p>${citasGraf}</section>
 <section class="dash-card"><h3>Recaudo por medio de pago</h3><p class="sub">Pagos registrados y no anulados</p>${pagosMetodo.length?'<div class="dash-breakdown">'+pagosMetodo.map(x=>'<div class="dash-break-row"><span>'+esc(x.nombre)+'</span><strong>'+dinero(x.valor)+'</strong><div class="dash-break-track"><i style="width:'+100*x.valor/Math.max(1,...pagosMetodo.map(y=>y.valor))+'%"></i></div></div>').join('')+'</div>':'<p class="mute">Sin pagos registrados en el periodo.</p>'}</section>
 </div>
 <div class="dash-grid">${barras('Rentabilidad por barbero',topBarberos)}${barras('Servicios con mayor margen',topServicios)}</div>
 <div class="dash-section"><h3>Detalle de rentabilidad por producto</h3>${sec('',mg(D,x=>x.descripcion,'unidades',x=>x.tipo_item==='PRODUCTO').slice(0,8))}</div>
 <div class="dash-note">Criterio contable: la utilidad mostrada es estimada con ventas netas menos costo de productos vendidos, comisiones y gastos operativos registrados. Las compras de inventario y liquidaciones de comisiones no se descuentan otra vez para evitar duplicidad.</div>
 <div class="dash-section"><h3>Recaudo por cuenta</h3>${sec('',pc)}</div>`;
 const metricas={
  ingresos:{titulo:'Comportamiento del negocio',descripcion:'Ventas por día y Gastos por día · últimos 14 días del periodo.',campo:'ventas',moneda:true},
  utilidad:{titulo:'Evolución de utilidad estimada',descripcion:'Ingresos diarios menos costos, comisiones y gastos operativos.',campo:'utilidad',moneda:true},
  recaudo:{titulo:'Evolución del recaudo',descripcion:'Pagos registrados por día, según su fecha de registro.',campo:'recaudo',moneda:true},
  operaciones:{titulo:'Operaciones de venta',descripcion:'Cantidad de ventas registradas por día.',campo:'operaciones',moneda:false},
  citas:{titulo:'Actividad de citas',descripcion:'Cantidad de citas programadas por día.',campo:'citas',moneda:false},
  gastos:{titulo:'Evolución de gastos operativos',descripcion:'Gastos registrados por día, excluyendo compras de inventario y liquidaciones de comisiones.',campo:'gastos',moneda:true}
 };
 const pintarGrafica=clave=>{
  const m=metricas[clave]||metricas.ingresos,panel=$('#dash-dynamic-graph');
  if(!panel)return;
  panel.innerHTML='<h3>'+m.titulo+'</h3><p class="sub">'+m.descripcion+'</p>'+(clave==='ingresos'?graficaComparativa(serie):graficaIndicador(serie,m.campo,m.moneda));
 };
 const tarjetas=Array.from(document.querySelectorAll('#inf .dash-kpi[data-metric]'));
 tarjetas.forEach(tarjeta=>tarjeta.addEventListener('click',()=>{
  tarjetas.forEach(otra=>{
   const activa=otra===tarjeta;
   otra.classList.toggle('primary',activa);
   otra.setAttribute('aria-pressed',String(activa));
  });
  pintarGrafica(tarjeta.dataset.metric);
 }));
 pintarGrafica('ingresos');
 $('#ex').onclick=()=>{
 const csvCell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
 const lineas=[['Tipo','Fecha','Concepto','Barbero','Método','Estado','Cantidad','Ingreso','Costo','Descuento']];
 V.forEach(x=>lineas.push(['VENTA',x.fecha_hora,'Venta '+x.id,'','','',1,Number(x.total_venta||0),0,Number(x.descuento||0)]));
 D.forEach(x=>lineas.push(['DETALLE',x.ventas?.fecha_hora||'',x.descripcion,x.ventas?.barberos?.nombre||'','',x.ventas?.estado_venta||'',x.cantidad,Number(x.subtotal||0),Number(x.costo_unitario||0)*Number(x.cantidad||0),0]));
 P.forEach(x=>lineas.push(['PAGO',x.fecha_hora,'Recaudo','',x.metodo_pago,'REGISTRADO',1,Number(x.valor_pago||0),0,0]));
 G.forEach(x=>lineas.push(['GASTO',x.fecha_hora,x.descripcion||x.categoria_gasto,'',x.metodo_pago,x.estado_gasto,1,-Number(x.valor||0),Number(x.valor||0),0]));
 C.forEach(x=>lineas.push(['CITA',x.inicio,'Cita','','',x.estado,1,0,0,0]));
 const contenido='\uFEFF'+lineas.map(f=>f.map(csvCell).join(';')).join('\r\n');
 const blob=new Blob([contenido],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='informe-barberia-'+fecha(s)+'-'+fecha(new Date(e.getTime()-86400000))+'.csv';
 document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);toast('Informe CSV generado');
 };
 $('#ex').disabled=false;
 }catch(error){
  console.error('Error preparando informe gerencial:',etapa,error);
  const panel=$('#inf');
  if(panel)panel.innerHTML='<p class="empty">No se pudo preparar el informe al '+esc(etapa)+': '+esc(error?.message||String(error))+'</p>';
 }
}

/* ---------- Resumen y ajustes ---------- */
async function inicioSimple(){
 const h0=new Date();h0.setHours(0,0,0,0);const h1=new Date(h0);h1.setDate(h1.getDate()+1);
 const respuestas=await Promise.all([
  mio(sb.from('ventas').select('total_venta').neq('estado_venta','ANULADA').gte('fecha_hora',h0.toISOString()).lt('fecha_hora',h1.toISOString())),
  mio(sb.from('citas').select('inicio,estado,clientes(nombre),barberos(nombre)').in('estado',['PENDIENTE','CONFIRMADA']).gte('inicio',h0.toISOString()).lt('inicio',h1.toISOString())).order('inicio'),
  ADM.includes(S.perfil.rol)?sb.from('stock_actual').select('nombre,existencias,stock_minimo').eq('negocio_id',S.perfil.negocio_id):Promise.resolve({data:[]})]);
 const fallo=respuestas.find(r=>r.error);if(fallo)return toast('No fue posible cargar el resumen: '+fallo.error.message,true);
 const[{data:v},{data:c},{data:s}]=respuestas;
 const tot=(v||[]).reduce((a,x)=>a+Number(x.total_venta),0),bajo=(s||[]).filter(x=>Number(x.existencias)<=Number(x.stock_minimo)),prox=(c||[]).filter(x=>new Date(x.inicio)>=new Date());
 $('#main').innerHTML=`<div class="head"><h2>Hoy</h2></div>
 <div class="kp"><div><small>Vendido hoy</small><strong>${dinero(tot)}</strong></div><div><small>Ventas</small><strong>${(v||[]).length}</strong></div><div><small>Citas pendientes</small><strong>${(c||[]).length}</strong></div></div>
 <label>Próximas citas</label>${prox.length?prox.slice(0,5).map(x=>fila2(hora(x.inicio)+', '+esc(x.clientes?.nombre),esc(x.barberos?.nombre))).join(''):'<p class="empty">No hay más citas por atender hoy.</p>'}
 ${bajo.length?'<label>Stock bajo</label>'+bajo.map(x=>fila2(esc(x.nombre),x.existencias+' (mínimo '+x.stock_minimo+')')).join(''):''}`;
}

 return { inicio };
}
