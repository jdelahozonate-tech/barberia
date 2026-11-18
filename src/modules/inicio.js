// Módulo de inicio e informes gerenciales.
export function crearModuloInicio(deps) {
 const { $, sb, S, esc, dinero, hora, fecha, toast, ADM, mio, fila2, porConfirmar } = deps;
const RG=[['hoy','Hoy'],['ayer','Ayer'],['semana','Esta semana'],['mes','Este mes'],['30','Últimos 30 días'],['custom','Personalizado']];
function rango(v,a,b){const d=new Date();d.setHours(0,0,0,0);const s=new Date(d);let e=new Date(d);e.setDate(e.getDate()+1);
 if(v==='ayer'){s.setDate(s.getDate()-1);e=new Date(d)}
 else if(v==='semana')s.setDate(s.getDate()-((s.getDay()+6)%7));
 else if(v==='mes')s.setDate(1);
 else if(v==='30')s.setDate(s.getDate()-29);
 else if(v==='custom'){const x=new Date((a||fecha(d))+'T00:00:00');e=new Date((b||fecha(d))+'T00:00:00');e.setDate(e.getDate()+1);return[x,e]}
 return[s,e]}
function inicio(){return ADM.includes(S.perfil.rol)?informe():inicioSimple()}
async function informe(){
 const[s,e]=rango(S.rg||'hoy',S.ra,S.rb),A=s.toISOString(),B=e.toISOString(),rg=S.rg||'hoy';
 $('#main').innerHTML=`<div class="head"><h2>Panel gerencial</h2></div><div id="pc"></div><select id="rg" aria-label="Periodo">${RG.map(([k,l])=>`<option value="${k}"${k===rg?' selected':''}>${l}</option>`).join('')}</select>
 ${rg==='custom'?`<div class="dia" style="margin-top:8px"><input type="date" id="ra" value="${S.ra||fecha(new Date())}" aria-label="Desde"><input type="date" id="rb" value="${S.rb||fecha(new Date())}" aria-label="Hasta"></div>`:''}<div id="inf"><p class="empty">Calculando…</p></div>`;
 $('#rg').onchange=x=>{S.rg=x.target.value;informe()};
 porConfirmar();
 if(rg==='custom')['ra','rb'].forEach(i=>$('#'+i).onchange=x=>{S[i]=x.target.value;informe()});
 const[V,D,P,G,C]=(await Promise.all([
  sb.from('ventas').select('descuento').neq('estado_venta','ANULADA').gte('fecha_hora',A).lt('fecha_hora',B).limit(5000),
  sb.from('detalle_ventas').select('tipo_item,descripcion,cantidad,subtotal,costo_unitario,comision_generada,ventas!inner(estado_venta,fecha_hora,barberos(nombre))').neq('ventas.estado_venta','ANULADA').gte('ventas.fecha_hora',A).lt('ventas.fecha_hora',B).limit(5000),
  sb.from('pagos').select('valor_pago,metodo_pago,cuentas(nombre),ventas!inner(estado_venta)').eq('estado_pago','REGISTRADO').neq('ventas.estado_venta','ANULADA').gte('fecha_hora',A).lt('fecha_hora',B).limit(5000),
  sb.from('gastos').select('categoria_gasto,valor').eq('estado_gasto','REGISTRADO').gte('fecha_hora',A).lt('fecha_hora',B).limit(5000),
  sb.from('citas').select('estado').gte('inicio',A).lt('inicio',B).limit(5000)])).map(r=>r.data||[]);
 const sum=(a,f)=>a.reduce((t,x)=>t+Number(f(x)||0),0),cl=x=>Number(x.costo_unitario)*Number(x.cantidad)+Number(x.comision_generada);
 const bruto=sum(D,x=>x.subtotal),desc=sum(V,x=>x.descuento),neto=bruto-desc,costo=sum(D,x=>Number(x.costo_unitario)*Number(x.cantidad)),com=sum(D,x=>x.comision_generada);
 const gast=sum(G.filter(x=>!['COMISIONES','PRODUCTOS'].includes(x.categoria_gasto)),x=>x.valor),util=neto-costo-com-gast;
 const grp=(a,k,f)=>{const m={};a.forEach(x=>{const n=k(x);m[n]=m[n]||{n,c:0,i:0,k:0};f(m[n],x)});return Object.values(m)};
 const lin=(g,e)=>fila2(esc(g.n)+'<br><small>'+g.c+' '+e+', ingresos '+dinero(g.i)+', costo '+dinero(g.k)+'</small>',dinero(g.i-g.k));
 const mg=(a,k,e,flt)=>grp(a.filter(flt||(()=>true)),k,(g,x)=>{g.c+=Number(x.cantidad);g.i+=Number(x.subtotal);g.k+=cl(x)}).sort((p,q)=>(q.i-q.k)-(p.i-p.k)).map(g=>lin(g,e));
 const sec=(t,r)=>r.length?`<label>${t}</label>`+r.join(''):'';
 const pm=grp(P,x=>bonito(x.metodo_pago),(g,x)=>{g.i+=Number(x.valor_pago)}).map(g=>fila2(esc(g.n),dinero(g.i))),pc=grp(P.filter(x=>x.cuentas),x=>x.cuentas.nombre,(g,x)=>{g.i+=Number(x.valor_pago)}).map(g=>fila2(esc(g.n),dinero(g.i)));
 $('#inf').innerHTML=`<div class="kp"><div><small>Ventas netas</small><strong>${dinero(neto)}</strong></div><div><small>Utilidad estimada</small><strong>${dinero(util)}</strong></div><div><small>Ventas</small><strong>${V.length}</strong></div><div><small>Citas atendidas</small><strong>${C.filter(x=>x.estado==='ATENDIDA').length}</strong></div></div>
 ${fila2('Ventas brutas',dinero(bruto))}${fila2('Descuentos','-'+dinero(desc))}${fila2('Costo de productos vendidos','-'+dinero(costo))}${fila2('Comisiones de barberos','-'+dinero(com))}${fila2('Gastos operativos','-'+dinero(gast))}${fila2('Utilidad estimada',dinero(util),'tot')}
 <p class="mute">No se restan aparte las compras de mercancía ni las liquidaciones de comisión: su costo ya está en las líneas de arriba.</p>
 ${sec('Margen por barbero',mg(D,x=>x.ventas.barberos?.nombre||'Sin barbero','servicios y productos'))}
 ${sec('Margen por producto',mg(D,x=>x.descripcion,'vendidos',x=>x.tipo_item==='PRODUCTO'))}
 ${sec('Margen por servicio',mg(D,x=>x.descripcion,'servicios',x=>x.tipo_item==='SERVICIO'))}
 ${sec('Cobrado por método de pago',pm)}${sec('Cobrado por cuenta',pc)}`;
}

/* ---------- Resumen y ajustes ---------- */
async function inicioSimple(){
 const h0=new Date();h0.setHours(0,0,0,0);const h1=new Date(h0);h1.setDate(h1.getDate()+1);
 const[{data:v},{data:c},{data:s}]=await Promise.all([
  mio(sb.from('ventas').select('total_venta').neq('estado_venta','ANULADA').gte('fecha_hora',h0.toISOString()).lt('fecha_hora',h1.toISOString())),
  mio(sb.from('citas').select('inicio,estado,clientes(nombre),barberos(nombre)').in('estado',['PENDIENTE','CONFIRMADA']).gte('inicio',h0.toISOString()).lt('inicio',h1.toISOString())).order('inicio'),
  ADM.includes(S.perfil.rol)?sb.from('stock_actual').select('nombre,existencias,stock_minimo'):Promise.resolve({data:[]})]);
 const tot=(v||[]).reduce((a,x)=>a+Number(x.total_venta),0),bajo=(s||[]).filter(x=>Number(x.existencias)<=Number(x.stock_minimo)),prox=(c||[]).filter(x=>new Date(x.inicio)>=new Date());
 $('#main').innerHTML=`<div class="head"><h2>Hoy</h2></div>
 <div class="kp"><div><small>Vendido hoy</small><strong>${dinero(tot)}</strong></div><div><small>Ventas</small><strong>${(v||[]).length}</strong></div><div><small>Citas pendientes</small><strong>${(c||[]).length}</strong></div></div>
 <label>Próximas citas</label>${prox.length?prox.slice(0,5).map(x=>fila2(hora(x.inicio)+', '+esc(x.clientes?.nombre),esc(x.barberos?.nombre))).join(''):'<p class="empty">No hay más citas por atender hoy.</p>'}
 ${bajo.length?'<label>Stock bajo</label>'+bajo.map(x=>fila2(esc(x.nombre),x.existencias+' (mínimo '+x.stock_minimo+')')).join(''):''}`;
}

 return { inicio, informe, inicioSimple };
}
