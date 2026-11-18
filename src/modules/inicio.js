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
function grafica(titulo,serie,campo,maximo,color){
 if(!serie.length)return '';
 return '<label>'+titulo+'</label><div class="panel-graf">'+serie.map(([k,v])=>'<div class="graf-col"><small>'+esc(k.slice(5))+'</small><div class="graf-track"><i style="height:'+Math.max(3,100*v[campo]/maximo)+'%;background:'+color+'"></i></div><b>'+dinero(v[campo])+'</b></div>').join('')+'</div>';
}
async function informe(){
 if(!document.getElementById('dashboard-chart-style')){const css=document.createElement('style');css.id='dashboard-chart-style';
 css.textContent='.panel-graf{display:flex;gap:8px;align-items:stretch;overflow-x:auto;padding:8px 2px 14px}.graf-col{min-width:54px;display:flex;flex-direction:column;align-items:center;gap:5px;flex:1}.graf-col small{font-size:11px}.graf-track{height:112px;width:22px;background:var(--borde,#e5e7eb);border-radius:8px;display:flex;align-items:end;overflow:hidden}.graf-track i{display:block;width:100%;border-radius:8px}.graf-col b{font-size:10px;white-space:nowrap}.estado-graf{display:grid;grid-template-columns:105px 1fr 28px;gap:8px;align-items:center;margin:8px 0;font-size:13px}.estado-graf div{height:9px;background:var(--borde,#e5e7eb);border-radius:8px;overflow:hidden}.estado-graf i{display:block;height:100%;background:#497caa;border-radius:8px}';
 document.head.appendChild(css);}
 const[s,e]=rango(S.rg||'hoy',S.ra,S.rb),A=s.toISOString(),B=e.toISOString(),rg=S.rg||'hoy';
 $('#main').innerHTML=`<div class="head"><h2>Panel gerencial</h2><button class="btn sec" id="ex" disabled>Exportar CSV</button></div><div id="pc"></div><select id="rg" aria-label="Periodo">${RG.map(([k,l])=>`<option value="${k}"${k===rg?' selected':''}>${l}</option>`).join('')}</select>
 ${rg==='custom'?`<div class="dia" style="margin-top:8px"><input type="date" id="ra" value="${S.ra||fecha(new Date())}" aria-label="Desde"><input type="date" id="rb" value="${S.rb||fecha(new Date())}" aria-label="Hasta"></div>`:''}<div id="inf"><p class="empty">Calculando…</p></div>`;
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
   $('#inf').innerHTML=r.error
    ?'<p class="empty">No fue posible cargar '+esc(nombre)+': '+esc(r.error.message)+'</p>'
    :pendientes.length?'<p class="empty">Datos recibidos. Falta consultar: '+esc(pendientes.join(', '))+'…</p>':'<p class="empty">Preparando resultados…</p>';
  }
  return r;
 }));
 if(ejecucion!==informeEjecucion)return;
 const fallo=respuestas.find(r=>r.error);if(fallo){$('#inf').innerHTML='<p class="empty">No fue posible cargar el informe: '+esc(fallo.error.message)+'</p>';return}
 const[V,D,P,G,C]=respuestas.map(r=>r.data||[]);
 const sum=(a,f)=>a.reduce((t,x)=>t+Number(f(x)||0),0),cl=x=>Number(x.costo_unitario)*Number(x.cantidad)+Number(x.comision_generada);
 const bruto=sum(D,x=>x.subtotal),desc=sum(V,x=>x.descuento),neto=bruto-desc,costo=sum(D,x=>Number(x.costo_unitario)*Number(x.cantidad)),com=sum(D,x=>x.comision_generada);
 const gast=sum(G.filter(x=>!['COMISIONES','PRODUCTOS'].includes(x.categoria_gasto)),x=>x.valor),util=neto-costo-com-gast;
 const grp=(a,k,f)=>{const m={};a.forEach(x=>{const n=k(x);m[n]=m[n]||{n,c:0,i:0,k:0};f(m[n],x)});return Object.values(m)};
 const lin=(g,e)=>fila2(esc(g.n)+'<br><small>'+g.c+' '+e+', ingresos '+dinero(g.i)+', costo '+dinero(g.k)+'</small>',dinero(g.i-g.k));
 const mg=(a,k,e,flt)=>grp(a.filter(flt||(()=>true)),k,(g,x)=>{g.c+=Number(x.cantidad);g.i+=Number(x.subtotal);g.k+=cl(x)}).sort((p,q)=>(q.i-q.k)-(p.i-p.k)).map(g=>lin(g,e));
 const sec=(t,r)=>r.length?'<label>'+t+'</label>'+r.join(''):'';
 const pm=grp(P,x=>bonito(x.metodo_pago),(g,x)=>{g.i+=Number(x.valor_pago)}).map(g=>fila2(esc(g.n),dinero(g.i))),pc=grp(P.filter(x=>x.cuentas),x=>x.cuentas.nombre,(g,x)=>{g.i+=Number(x.valor_pago)}).map(g=>fila2(esc(g.n),dinero(g.i)));
 const dias={};V.forEach(x=>{const k=fecha(new Date(x.fecha_hora));dias[k]=dias[k]||{ventas:0,gastos:0,citas:0};dias[k].ventas+=Number(x.total_venta||0)});
 G.forEach(x=>{const k=fecha(new Date(x.fecha_hora));dias[k]=dias[k]||{ventas:0,gastos:0,citas:0};dias[k].gastos+=Number(x.valor||0)});
 C.forEach(x=>{const k=fecha(new Date(x.inicio));dias[k]=dias[k]||{ventas:0,gastos:0,citas:0};dias[k].citas++});
 const serie=Object.entries(dias).sort((a,b)=>a[0].localeCompare(b[0])).slice(-14),maxDia=Math.max(1,...serie.map(x=>Math.max(x[1].ventas,x[1].gastos))),cobrado=sum(P,x=>x.valor_pago),ticket=V.length?neto/V.length:0;
 const estados=['PENDIENTE','CONFIRMADA','ATENDIDA','CANCELADA','NO_ASISTIO'].map(k=>({k,n:C.filter(x=>x.estado===k).length})),maxEstado=Math.max(1,...estados.map(x=>x.n));
 const citasGraf='<label>Estado de las citas</label>'+estados.map(x=>'<div class="estado-graf"><span>'+bonito(x.k)+'</span><div><i style="width:'+100*x.n/maxEstado+'%"></i></div><b>'+x.n+'</b></div>').join('');
 $('#inf').innerHTML=`<div class="kp"><div><small>Ventas netas</small><strong>${dinero(neto)}</strong></div><div><small>Utilidad estimada</small><strong>${dinero(util)}</strong></div><div><small>Recaudado</small><strong>${dinero(cobrado)}</strong></div><div><small>Ventas</small><strong>${V.length}</strong></div><div><small>Ticket promedio</small><strong>${dinero(ticket)}</strong></div><div><small>Citas atendidas</small><strong>${C.filter(x=>x.estado==='ATENDIDA').length}</strong></div></div>
 ${fila2('Ventas brutas',dinero(bruto))}${fila2('Descuentos','-'+dinero(desc))}${fila2('Costo de productos vendidos','-'+dinero(costo))}${fila2('Comisiones de barberos','-'+dinero(com))}${fila2('Gastos operativos','-'+dinero(gast))}${fila2('Utilidad estimada',dinero(util),'tot')}
 ${grafica('Ventas por día',serie,'ventas',maxDia,'#237a57')}${grafica('Gastos por día',serie,'gastos',maxDia,'#bd7a35')}${citasGraf}
 <p class="mute">No se restan aparte las compras de mercancía ni las liquidaciones de comisión: su costo ya está en las líneas de arriba.</p>
 ${sec('Margen por barbero',mg(D,x=>x.ventas.barberos?.nombre||'Sin barbero','servicios y productos'))}
 ${sec('Margen por producto',mg(D,x=>x.descripcion,'vendidos',x=>x.tipo_item==='PRODUCTO'))}
 ${sec('Margen por servicio',mg(D,x=>x.descripcion,'servicios',x=>x.tipo_item==='SERVICIO'))}
 ${sec('Cobrado por método de pago',pm)}${sec('Cobrado por cuenta',pc)}`;
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
