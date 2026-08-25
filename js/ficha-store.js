// js/ficha-store.js
// Fonte única do formato/armazenamento de personagens da Ficha Digital.
// Usado tanto por ferramentas/ficha.html quanto por ferramentas/funil.js
// (mesmo localStorage, mesma origem — dá pra escrever direto daqui).
window.TT_FICHA = (function () {
  const LS = 'tt_fichas_v1';
  const LS_OLD = 'tt_ficha_v9';
  const LS_ACTIVE = 'tt_ficha_ativa_v1';
  const TL = ['—','Combatente','Batedor','Especialista','Arcanista','Xamã','Sacerdote','Mestre das Feras','Lorde Rúnico','Bardo','Alquimista','Defensor','Troca-peles'];

  function def(){return{nome:'',jogador:'',ocupacoes:'',nivel:1,xp:0,bonus_xp:0,origem:'',sexo:'',idade:'',attrs:{FOR:{base:10,atual:10},DES:{base:10,atual:10},CON:{base:10,atual:10},INT:{base:10,atual:10},VON:{base:10,atual:10},CAR:{base:10,atual:10}},ca:10,sf:10,sm:10,pv:{v:8,max:8},sorte:{v:3,max:3},contadores:[],armas:[{nome:'',ataque:'',dano:'',alcance:'',obs:''}],trilha_principal:{nome:'—',rank:1,ouro:'',ataques:''},trilhas:[{nome:'—',rank:1,ouro:'',ataques:''}],idiomas:[],magias:[],habilidades:[],equip:{items:[],tem_mochila:false,mochila_slots:10,mochila:[]},carga:{leve:'',media:'',pesada:'',sobre:''},moedas:{cobre:0,prata:0,ouro:0,electrum:0,platina:0},pedras:'',anotacoes:''};}

  function newId(){return 'c'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);}

  function normChar(c){
    const d=def();
    const attrs={};
    Object.keys(d.attrs).forEach(k=>{attrs[k]={...d.attrs[k],...((c.attrs&&c.attrs[k])||{})};});
    return{...d,...c,
      attrs,
      pv:{...d.pv,...(c.pv||{})},
      sorte:{...d.sorte,...(c.sorte||{})},
      equip:{...d.equip,...(c.equip||{})},
      carga:{...d.carga,...(c.carga||{})},
      moedas:{...d.moedas,...(c.moedas||{})},
      trilha_principal:{...d.trilha_principal,...(c.trilha_principal||{})}
    };
  }

  function getRoster(){
    try{
      const x=localStorage.getItem(LS);
      if(x) return JSON.parse(x).map(normChar);
    }catch(e){}
    return [];
  }

  let _pushTimer=null;

  function cloudPush(list){
    if(!window.TT_AUTH) return;
    window.TT_AUTH.getSession().then(function(session){
      if(!session) return;
      const client=window.TT_AUTH.getClient();
      const uid=session.user.id;
      const localIds=list.map(c=>c.id);
      const rows=list.map(c=>({id:c.id,user_id:uid,ficha:c,updated_at:new Date().toISOString()}));
      client.from('personagens').select('id').eq('user_id',uid).then(function(res){
        const cloudIds=(res.data||[]).map(r=>r.id);
        const toDelete=cloudIds.filter(id=>localIds.indexOf(id)===-1);
        const ops=[];
        if(rows.length) ops.push(client.from('personagens').upsert(rows));
        if(toDelete.length) ops.push(client.from('personagens').delete().eq('user_id',uid).in('id',toDelete));
        Promise.all(ops).catch(e=>console.error('Erro ao sincronizar com Supabase:',e));
      });
    });
  }

  function debouncedCloudPush(list){
    clearTimeout(_pushTimer);
    _pushTimer=setTimeout(()=>cloudPush(list),1500);
  }

  function cloudPull(){
    if(!window.TT_AUTH) return Promise.resolve(null);
    return window.TT_AUTH.getSession().then(function(session){
      if(!session) return null;
      const client=window.TT_AUTH.getClient();
      return client.from('personagens').select('id,ficha').eq('user_id',session.user.id).then(function(res){
        if(res.error){console.error('Erro ao buscar fichas do Supabase:',res.error);return null;}
        return (res.data||[]).map(r=>normChar({...r.ficha,id:r.id}));
      });
    });
  }

  // Chamado ao logar: une o catálogo local com o da nuvem por id. Em caso de
  // conflito mantém a versão local (evita sobrescrever o que já está na tela).
  function mergeWithCloud(localList){
    return cloudPull().then(function(cloudList){
      if(!cloudList) return localList;
      const localIds=localList.map(c=>c.id);
      const merged=localList.slice();
      cloudList.forEach(c=>{if(localIds.indexOf(c.id)===-1) merged.push(c);});
      saveRoster(merged);
      cloudPush(merged);
      return merged;
    });
  }

  function saveRoster(list){
    try{localStorage.setItem(LS,JSON.stringify(list));}catch(e){}
    debouncedCloudPush(list);
  }

  // Só usado pela ficha.html no boot: migra o formato antigo (1 personagem só) se existir.
  function migrateOld(){
    try{
      if(localStorage.getItem(LS)) return null; // já está no formato novo, nada a migrar
      const old=localStorage.getItem(LS_OLD);
      if(!old) return null;
      const data=JSON.parse(old),id=newId();
      const list=[normChar({...data,id})];
      saveRoster(list);
      return {list,migratedId:id};
    }catch(e){return null;}
  }

  function getActiveId(){try{return localStorage.getItem(LS_ACTIVE);}catch(e){return null;}}
  function setActiveId(id){try{localStorage.setItem(LS_ACTIVE,id);}catch(e){}}
  function clearActiveId(){try{localStorage.removeItem(LS_ACTIVE);}catch(e){}}

  // Adiciona um personagem novo ao catálogo a partir de dados parciais (ex: vindos do Funil).
  // Preenche o que faltar com os defaults. Retorna o personagem criado (já com id).
  function addCharacter(partial){
    const list=getRoster();
    const c=normChar({...(partial||{}),id:newId()});
    list.push(c);
    saveRoster(list);
    return c;
  }

  return {LS,LS_OLD,LS_ACTIVE,TL,def,newId,normChar,getRoster,saveRoster,migrateOld,getActiveId,setActiveId,clearActiveId,addCharacter,cloudPull,cloudPush,mergeWithCloud};
})();
