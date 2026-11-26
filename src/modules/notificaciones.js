// Centro de notificaciones en tiempo real mientras la aplicación está abierta.
export function crearModuloNotificaciones({ $, sb, S, esc, toast }) {
 const BASE={citas_nuevas:true,citas_30m:true,citas_15m:false,stock_bajo:true,stock_agotado:true,pedidos_clientes:true,cuentas_vencer:true};
 let preferencias={...BASE},avisos=[],timer=null,consultando=false;
 const clave=()=> 'barberia_notif_'+S.perfil.negocio_id;
 const leidas=()=>{try{return JSON.parse(localStorage.getItem(clave())||'{}')}catch{return {}}};
 const registrar=(id,titulo,detalle,tipo='info')=>{
  const vistos=leidas();if(vistos[id])return;
  vistos[id]=Date.now();localStorage.setItem(clave(),JSON.stringify(vistos));
  avisos.unshift({id,titulo,detalle,tipo,fecha:new Date()});avisos=avisos.slice(0,60);
  pintarCampana();
  if(tipo==='cita-nueva'){
   try{navigator.vibrate&&navigator.vibrate([200,100,200])}catch{}
   try{if('Notification' in window&&Notification.permission==='granted')new Notification(titulo,{body:detalle,icon:'icon-192.png',tag:id})}catch{}
   toast(titulo+' · '+detalle);
  }
 };
 function pintarCampana(){
  const b=$('#campana-notificaciones');if(!b)return;
  const n=avisos.length;b.innerHTML='♢'+(n?'<span class="notif-badge">'+n+'</span>':'');
  b.setAttribute('aria-label',n+' notificaciones nuevas');b.title=n+' notificaciones';
 }
 async function cargarPreferencias(){
  const{data,error}=await sb.from('preferencias_notificaciones').select('preferencias').eq('negocio_id',S.perfil.negocio_id).maybeSingle();
  if(!error&&data?.preferencias)preferencias={...BASE,...data.preferencias};
  return preferencias;
 }
 async function guardarPreferencias(nuevas){
  const{error}=await sb.from('preferencias_notificaciones').upsert({negocio_id:S.perfil.negocio_id,preferencias:{...BASE,...nuevas},actualizado_en:new Date().toISOString()},{onConflict:'negocio_id'});
  if(error){toast('No se pudieron guardar las notificaciones: '+error.message,true);return false}
  preferencias={...BASE,...nuevas};toast('Preferencias de notificaciones guardadas');return true;
 }
 async function revisar(){
  if(consultando||!S.perfil?.negocio_id)return;consultando=true;
  try{
   const ahora=new Date(),limite=new Date(ahora.getTime()+31*60000);
   if(preferencias.citas_30m||preferencias.citas_15m){
    const{data,error}=await sb.from('citas').select('id,inicio,estado,clientes(nombre),servicios(nombre)').eq('negocio_id',S.perfil.negocio_id).in('estado',['PENDIENTE','CONFIRMADA']).gte('inicio',ahora.toISOString()).lte('inicio',limite.toISOString()).limit(100);
    if(!error)(data||[]).forEach(c=>{
     const faltan=Math.round((new Date(c.inicio)-ahora)/60000);
     if(preferencias.citas_30m&&faltan<=30&&faltan>=29)registrar('cita30_'+c.id,c.clientes?.nombre||'Próxima cita','Tu cita es en aproximadamente 30 minutos · '+(c.servicios?.nombre||'Servicio'),'cita');
     if(preferencias.citas_15m&&faltan<=15&&faltan>=14)registrar('cita15_'+c.id,c.clientes?.nombre||'Próxima cita','Tu cita es en aproximadamente 15 minutos · '+(c.servicios?.nombre||'Servicio'),'cita');
    });
   }
   if(preferencias.citas_nuevas){
    const{data:nuevas,error:errorNuevas}=await sb.from('citas').select('id,inicio,clientes(nombre),servicios(nombre),barberos(nombre)').eq('negocio_id',S.perfil.negocio_id).eq('estado','PENDIENTE').gte('inicio',ahora.toISOString()).order('inicio').limit(50);
    if(!errorNuevas)(nuevas||[]).forEach(c=>registrar('nueva_'+c.id,'Cita nueva por confirmar',(c.clientes?.nombre||'Cliente')+' · '+new Date(c.inicio).toLocaleString('es-CO',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+' · '+(c.servicios?.nombre||'Servicio')+(c.barberos?.nombre?' con '+c.barberos.nombre:''),'cita-nueva'));
   }
   if(preferencias.stock_bajo||preferencias.stock_agotado){
    const{data:ps,error:ep}=await sb.from('productos').select('id,nombre,stock_minimo,control_stock,estado').eq('negocio_id',S.perfil.negocio_id).eq('estado','ACTIVO').eq('control_stock',true);
    const{data:st,error:es}=await sb.from('stock_actual').select('producto_id,existencias,stock_minimo').eq('negocio_id',S.perfil.negocio_id);
    if(!ep&&!es){const stocks=new Map((st||[]).map(x=>[x.producto_id,x]));(ps||[]).forEach(p=>{
     const x=stocks.get(p.id),cantidad=Number(x?.existencias||0),min=Number(p.stock_minimo??x?.stock_minimo??0);
     if(cantidad<=0&&preferencias.stock_agotado)registrar('agotado_'+p.id,p.nombre,'Producto agotado. Revisa si debes incluirlo en el pedido.','danger');
     else if(cantidad>0&&cantidad<=min&&preferencias.stock_bajo)registrar('stock_'+p.id+'_'+cantidad,p.nombre,'Quedan '+cantidad+' unidades; el mínimo configurado es '+min+'.','warning');
    })}
   }
   if(preferencias.pedidos_clientes){
    const{data,error}=await sb.from('pedidos_productos').select('id,nombre_cliente,creado_en').eq('negocio_id',S.perfil.negocio_id).eq('estado','NUEVO').gte('creado_en',new Date(Date.now()-86400000).toISOString()).limit(50);
    if(!error)(data||[]).forEach(p=>registrar('pedido_'+p.id,'Nuevo pedido de '+p.nombre_cliente,'Hay un pedido de productos pendiente de revisar.','info'));
   }
   if(preferencias.cuentas_vencer){
    const hoy=new Date();hoy.setHours(0,0,0,0);const hasta=new Date(hoy.getTime()+3*86400000);
    const{data,error}=await sb.from('compras_inventario').select('id,fecha_vencimiento,saldo_pendiente,proveedores_inventario(nombre)').eq('negocio_id',S.perfil.negocio_id).eq('estado_compra','PENDIENTE').gt('saldo_pendiente',0).not('fecha_vencimiento','is',null).lte('fecha_vencimiento',hasta.toISOString().slice(0,10)).limit(50);
    if(!error)(data||[]).forEach(c=>registrar('vence_'+c.id+'_'+c.fecha_vencimiento,'Cuenta por pagar próxima',''+(c.proveedores_inventario?.nombre||'Proveedor')+' · vence '+new Date(c.fecha_vencimiento+'T12:00:00').toLocaleDateString('es-CO'),'warning'));
   }
  }catch(e){console.warn('Notificaciones:',e)}finally{consultando=false}
 }
 function abrir(){
  let panel=$('#panel-notificaciones');
  if(!panel){panel=document.createElement('section');panel.id='panel-notificaciones';panel.className='notif-panel';document.querySelector('.bar')?.append(panel)}
  panel.innerHTML='<div class="notif-panel-head"><strong>Notificaciones</strong><button type="button" class="link" id="cerrar-notif">Cerrar</button></div>'+
   (avisos.length?avisos.map(a=>'<article class="notif-item '+a.tipo+'"><strong>'+esc(a.titulo)+'</strong><p>'+esc(a.detalle)+'</p><small>'+a.fecha.toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'})+'</small></article>').join(''):'<p class="empty">No tienes notificaciones nuevas.</p>')+
   '<button type="button" class="btn sec block" id="limpiar-notif">Marcar todas como leídas</button>';
  panel.hidden=false;$('#cerrar-notif').onclick=()=>panel.hidden=true;
  $('#limpiar-notif').onclick=()=>{avisos=[];pintarCampana();panel.hidden=true};
 }
 function iniciar(){
  const campana=$('#campana-notificaciones');if(campana)campana.onclick=()=>{try{if('Notification' in window&&Notification.permission==='default')Notification.requestPermission()}catch{}abrir()};
  cargarPreferencias().finally(()=>{revisar();if(timer)clearInterval(timer);timer=setInterval(revisar,30000)});
 }
 function detener(){if(timer)clearInterval(timer);timer=null}
 return { iniciar, detener, abrir, cargarPreferencias, guardarPreferencias, revisar };
}
