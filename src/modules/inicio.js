// Módulo de inicio e informes gerenciales.
export function crearModuloInicio(deps) {
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
 .dash-kpi:hover{border-color:#9aabc0;transform:translateY(-2px)}\n .dash-kpi:focus-visible{outline:3px solid #8bb8dc;outline-offset:2px}\n .dash-kpi.primary{box-shadow:0 0 0 2px #102b4920,0 5px 16px #10223f12}\n .dash-kpi.primary small{color:#c2d1e2}\n .dash-kpi.primary em{color:#b6c8da}
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
