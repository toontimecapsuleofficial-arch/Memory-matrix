/* Memory Matrix - game logic
   Single IIFE; runs after the DOM is parsed (loaded at the end of <body>).
   Y8 SDK bridge lives in the Plat object near the top - every SDK call is guarded so the
   game runs unchanged when the SDK is absent or blocked. */
(function(){
"use strict";
/* =========================================================
   MEMORY MATRIX — EXPANSION BUILD 2.0
   Same visual language, deeper gameplay:
   campaign, chapters, bosses, stars, mastery, combos,
   records, daily matrix, modes, tokens, badges.
   Core fantasy stays: SEE → REMEMBER → TAP → IMPROVE → MASTER
   ========================================================= */

/* ================= helpers ================= */
var $=function(id){return document.getElementById(id);};
var clamp=function(v,a,b){return v<a?a:(v>b?b:v);};
var rnd=function(a,b){return a+Math.random()*(b-a);};
var pick=function(arr){return arr[(Math.random()*arr.length)|0];};
var pad2=function(n){return (n<10?'0':'')+n;};
var nf=function(n){try{return Number(n).toLocaleString();}catch(e){return ''+n;}};
var vib=function(p){try{if(navigator.vibrate)navigator.vibrate(p);}catch(e){}};

/* ================= Y8 SDK bridge =================
   The SDK itself is loaded + initialised in index.html (window.y8Sdk, appId 6ac37d5b6bbaa3458b665a55,
   gameId 286199). Non-blocking: the game never waits for the SDK, and every call is guarded, so the
   same file runs on Y8, on any other host, or offline. Ads are only requested at natural breaks.
   Progress is stored in localStorage (mmx_* keys). */
var Plat={sdk:null,ready:false,inPlay:false,adsOff:false,adBusy:false,adblock:false,lastAd:0,adsShown:0,_paused:false,
  init:function(){
    var self=this;
    var go=function(){
      var s=window.y8Sdk;
      if(self.ready||!s)return;
      self.sdk=s;self.ready=true;
      try{self.onReady();}catch(e){}
    };
    go();
    if(!this.ready){
      window.addEventListener('mmY8Ready',go);
      var n=0,iv=setInterval(function(){n++;go();if(self.ready||n>120)clearInterval(iv);},250);
    }
  },
  onReady:function(){
    this.refreshUI();
    try{if(typeof window.mmPlatReady==='function')window.mmPlatReady();}catch(e){}
  },
  adsOk:function(){return this.ready&&!this.adsOff&&!!(this.sdk&&typeof this.sdk.showAd==='function');},
  rewardedOk:function(){return this.adsOk()&&!this.adblock;},
  refreshUI:function(){if(typeof refreshAdUI==='function'){try{refreshAdUI();}catch(e){}}},
  _wait:function(on){var w=document.getElementById('ad-wait');if(w)w.classList.toggle('hidden',!on);},
  _pause:function(on){
    if(on===this._paused)return;this._paused=on;
    if(typeof A!=='undefined'){try{A.adPause(on);}catch(e){}}
    if(on)this.gameplayStop();
  },
  /* Interstitial ("next") ad at a natural break. The SDK paces these itself. `next` ALWAYS runs, exactly once. */
  midgame:function(next){
    next=next||function(){};
    if(!this.adsOk()||this.adBusy||(S.clears||0)<2)return next();
    var self=this,fin=false,guard=null;
    var end=function(){if(fin)return;fin=true;clearTimeout(guard);self.adBusy=false;self._pause(false);self._wait(false);next();};
    this.adBusy=true;this._wait(true);
    guard=setTimeout(end,12000);
    try{
      var p=this.sdk.showAd({
        type:'next',
        name:'level-complete',
        beforeAd:function(){clearTimeout(guard);guard=setTimeout(end,120000);self._wait(false);self._pause(true);},
        afterAd:function(){self._pause(false);self.lastAd=Date.now();self.adsShown++;},
        adBreakDone:function(info){end();}
      });
      if(p&&typeof p.catch==='function')p.catch(function(){end();});
    }catch(e){end();}
  },
  /* Rewarded ad: the reward is granted ONLY if the ad was actually viewed. */
  rewarded:function(onReward,onFail,name){
    onReward=onReward||function(){};onFail=onFail||function(){};
    if(!this.rewardedOk()||this.adBusy)return onFail({code:'unavailable',message:'Rewarded ads unavailable'});
    var self=this,fin=false,viewed=false,guard=null,post=null;
    var end=function(){
      if(fin)return;fin=true;clearTimeout(guard);clearTimeout(post);
      self.adBusy=false;self._pause(false);self._wait(false);
      if(viewed){self.lastAd=Date.now();self.adsShown++;onReward();}
      else onFail({code:'noreward',message:'Ad not viewed'});
    };
    this.adBusy=true;this._wait(true);
    guard=setTimeout(end,15000);
    try{
      var p=this.sdk.showAd({
        type:'reward',
        name:name||'extra-life',
        beforeAd:function(){self._pause(true);},
        afterAd:function(){self._pause(false);},
        beforeReward:function(showAdFn){clearTimeout(guard);guard=setTimeout(end,120000);self._wait(false);showAdFn();},
        adDismissed:function(){},
        adViewed:function(){viewed=true;clearTimeout(post);post=setTimeout(end,4000);},
        adBreakDone:function(info){end();}
      });
      if(p&&typeof p.catch==='function')p.catch(function(){end();});
    }catch(e){end();}
  },
  gameplayStart:function(){this.inPlay=true;},
  gameplayStop:function(){this.inPlay=false;},
  happytime:function(){},
  /* ---- multiplayer room hooks: Y8 has no invite/room API, so these are inert ---- */
  onJoinRoom:function(fn){},
  inviteParams:function(){return null;},
  isInstant:function(){return false;},
  updateRoom:function(roomId,joinable,params){},
  leaveRoom:function(){},
  loadingStop:function(){}
};
Plat.init();

var LS={
  get:function(k,d){
    try{
      var v=localStorage.getItem('mmx_'+k);
      return v==null?d:JSON.parse(v);
    }catch(e){return d;}
  },
  set:function(k,v){
    var s;try{s=JSON.stringify(v);}catch(e){return;}
    if(s===undefined)return;                     /* never persist the literal string "undefined" */
    try{localStorage.setItem('mmx_'+k,s);}catch(e2){}
  },
  del:function(k){try{localStorage.removeItem('mmx_'+k);}catch(e){}}
};
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
function hashStr(s){var h=5381,i;for(i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return h>>>0;}

/* ================= persisted state ================= */
function loadState(){return {
  /* original fields (safe defaults, never destroyed) */
  snd:LS.get('snd',true), fx:LS.get('fx',true), mus:LS.get('mus',true),
  best:LS.get('best',0), games:LS.get('games',0), maxlvl:LS.get('maxlvl',1),
  tiles:LS.get('tiles',0), wrong:LS.get('wrong',0), bcombo:LS.get('bcombo',0),
  clears:LS.get('clears',0), pclear:LS.get('pclear',0),
  ach:LS.get('ach',[]), dlast:LS.get('dlast',''), dstreak:LS.get('dstreak',0),
  /* expansion fields */
  showObj:LS.get('showobj',true), adapt:LS.get('adapt',true),
  lv:LS.get('lv',{}), tok:LS.get('tok',0), tokAll:LS.get('tokall',0),
  bosses:LS.get('bosses',[]),
  pw:LS.get('pw',{heart:2,reveal:1,slow:1,second:0,time:1,hint:1}),
  pweq:LS.get('pweq',['heart']),
  modes:LS.get('modes',{}),
  bestct:LS.get('bestct',0), bpl:LS.get('bpl',0), bboss:LS.get('bboss',0), spd:LS.get('spd',0),
  rec:LS.get('rec',{combo:0,fast:0,acc:0,tiles:0}),
  fails:LS.get('fails',{}),
  ddata:LS.get('ddata',{lastdone:'',best:0,medal:'',runs:0,today:0,todayDate:''}),
  seed:LS.get('seed',12345), pstreak:LS.get('pstreak',0),
  /* play-time: the 30-minute session goal */
  sessToday:LS.get('sesstoday',0), sessDate:LS.get('sessdate',''), sessBest:LS.get('sessbest',0),
  sessRun:LS.get('sessrun',0), sessAll:LS.get('sessall',0), sessGot:LS.get('sessgot',[]),
  /* shop & customization (cosmetic only — never gameplay power) */
  own:LS.get('own',['classic','sunny','classicburst','notrail','brain','snd-classic']),
  eq:LS.get('eq',{tiles:'classic',themes:'sunny',parts:'classicburst',trails:'notrail',avatars:'brain',badges:'',sounds:'snd-classic',fx:'',special:''}),
  fav:LS.get('fav',[]),
  loadouts:LS.get('loadouts',[{n:'Loadout 1'},{n:'Loadout 2'},{n:'Loadout 3'}]),
  wmast:LS.get('wmast',{}),
  unl:LS.get('unl',[]),
  seen:LS.get('seen',[]),
  setseen:LS.get('setseen',[]),
  /* onboarding: the 3-step tutorial has been seen (or skipped) */
  tut:LS.get('tut',false),
  /* interactive hands-on tutorial (replaces the passive 3-step for new players) */
  tut2:LS.get('tut2',false),
  /* online versus — separate stats, never touched by single-player code */
  mp:LS.get('mp',{g:0,w:0,l:0,t:0,best:0})
};}
var S=loadState();
var KEYS=['snd','fx','best','games','maxlvl','tiles','wrong','bcombo','clears','pclear','ach','dlast','dstreak',
  'showobj','adapt','lv','tok','tokall','bosses','pw','pweq','modes','bestct','bpl','bboss','spd','rec','fails','ddata','seed','pstreak',
  'own','eq','fav','loadouts','wmast','unl','seen','setseen',
  'sesstoday','sessdate','sessbest','sessrun','sessall','sessgot','tut','tut2','mp'];
/* storage keys that live under a camelCase field on S — mapped so these values really persist */
var KEYMAP={showobj:'showObj',tokall:'tokAll',sesstoday:'sessToday',sessdate:'sessDate',sessbest:'sessBest',sessrun:'sessRun',sessall:'sessAll',sessgot:'sessGot'};
function fieldOf(k){return KEYMAP[k]||k;}
function saveS(){for(var i=0;i<KEYS.length;i++)LS.set(KEYS[i],S[fieldOf(KEYS[i])]);}
function saveKey(k){LS.set(k,S[fieldOf(k)]);}
/* re-read every persisted value (used when a cloud save arrives after boot) */
function reloadState(){
  var ns=loadState(),k;
  for(k in ns)if(Object.prototype.hasOwnProperty.call(ns,k))S[k]=ns[k];
  dgold=LS.get('dgold',0);
  try{applyCosmetics();cosCheckUnlocks(true);}catch(e){}
  try{refreshMenu();renderSettings();sndIcon();}catch(e2){}
  if(typeof TUT!=='undefined'&&TUT.open&&!TUT.replay&&S.tut){TUT.close();showScreen('menu');refreshMenu();}
}
function lvData(l){
  if(!S.lv[l])S.lv[l]={st:0,sc:0,cb:0,ac:0,fs:0,ob:[false,false,false,false],dn:0,wi:0};
  var d=S.lv[l];
  if(!d.ob)d.ob=[false,false,false,false];
  return d;
}
function starTotal(){var n=0,k;for(k in S.lv)if(S.lv[k]&&S.lv[k].st)n+=S.lv[k].st;return n;}
function masteryCount(){var n=0,k,d;for(k in S.lv){d=S.lv[k];if(d&&d.ob&&d.ob[0]&&d.ob[1]&&d.ob[2]&&d.ob[3])n++;}return n;}
function star3Count(){var n=0,k;for(k in S.lv)if(S.lv[k]&&S.lv[k].st>=3)n++;return n;}
function objDone(){var n=0,k,d,i;for(k in S.lv){d=S.lv[k];if(d&&d.ob)for(i=0;i<4;i++)if(d.ob[i])n++;}return n;}
var dgold=LS.get('dgold',0);
function addTok(n){
  if(!(n>0))return;
  S.tok+=n;S.tokAll=(S.tokAll||0)+n;saveKey('tok');saveKey('tokall');
  FX.text(window.innerWidth/2,window.innerHeight*0.2,'+'+n+' TOKENS','#2E92D1',15);
  A.tok();
}

/* ================= campaign data ================= */
/* The five chapters are the five WORLDS — each with its own identity. */
var CH=[
  {name:'Sunny Start',  ic:'sun',   tone:'c1', blurb:'Bright skies and friendly recall', len:10},
  {name:'Candy Grove',  ic:'candy', tone:'c2', blurb:'Playful patterns, longer and quicker', len:10},
  {name:'Ocean Mind',   ic:'wave',  tone:'c3', blurb:'Order, fading tiles and speed', len:10},
  {name:'Crystal Cave', ic:'gem',   tone:'c4', blurb:'The board starts playing tricks', len:10},
  {name:'Memory Core',  ic:'chip',  tone:'c5', blurb:'The first Core — everything at once', len:10},
  /* ---- expansion: six new worlds, twelve levels each ---- */
  {name:'Neon City',    ic:'bolt',  tone:'c6', blurb:'Decoy storms under electric lights', len:12},
  {name:'Volcano Ridge',ic:'fire',  tone:'c7', blurb:'Danger tiles and burning recall', len:12},
  {name:'Cloudpeak',    ic:'cloud', tone:'c8', blurb:'Two and three wave patterns', len:12},
  {name:'Emerald Jungle',ic:'leaf', tone:'c9', blurb:'Fading tiles, shifting boards', len:12},
  {name:'Galaxy Drift', ic:'planet',tone:'c10',blurb:'Backwards recall, deep space', len:12},
  {name:'Time Nexus',   ic:'clock', tone:'c11',blurb:'Every trick the Matrix knows', len:12}
];
/* variable world length: worlds 1-5 keep 10 levels (old saves stay valid),
   worlds 6-11 have 12 levels each — 122 levels in total. */
var CHLEN=[],CHSTART=[],_cs=1,_ci;
for(_ci=0;_ci<CH.length;_ci++){CHLEN.push(CH[_ci].len||10);CHSTART.push(_cs);_cs+=CHLEN[_ci];}
var NCH=CH.length;
var MAXLVL=_cs-1;
var chOf=function(l){var c;for(c=NCH-1;c>=0;c--)if(l>=CHSTART[c])return c;return 0;};
var chFirst=function(c){return CHSTART[c];};
var chLast=function(c){return CHSTART[c]+CHLEN[c]-1;};
var isWorldBoss=function(l){return !!BOSSES[l]&&l===chLast(chOf(l));};
var GSZ  =[3,3,4,4,4,5,5,5,6,6, 6,6,7,7,7,7,8,8,8,8, 7,7,8,8,8,8,9,9,9,9, 8,8,9,9,9,9,9,9,9,9, 9,9,9,9,9,9,9,9,9,9,
           9,9,9,9,9,9,9,9,9,9,9,9,
           9,9,10,10,10,10,10,10,10,10,10,10,
           10,10,10,10,10,10,10,10,10,10,10,10,
           10,10,10,10,10,10,10,10,10,10,10,10,
           10,10,10,10,10,10,10,10,10,10,10,10,
           10,10,10,10,10,10,10,10,10,10,10,10];
var GTILE=[3,3,4,4,4,5,6,6,7,8, 8,9,9,10,10,11,11,12,12,13, 13,13,14,14,15,15,16,17,18,19, 17,18,18,19,19,20,20,21,21,22, 22,22,23,23,24,24,25,25,26,28,
           24,24,25,25,26,26, 26,27,27,28,28,29,
           27,27,28,28,29,29, 29,30,30,30,31,32,
           29,29,30,30,31,31, 31,31,32,32,33,34,
           30,30,31,31,32,32, 32,33,33,33,34,35,
           31,31,32,32,33,33, 33,34,34,34,35,36,
           33,33,34,34,35,35, 35,36,36,36,37,38];
var TBASE=[640,570,510,465,425, 300,285,270,258,246,236];
/* Pacing controls — Expansion 4.0 deliberately stretches a full run.
   reveal : multiplies the memorise window (slightly longer than before)
   cap    : longest hold for a normal level (was 8400)
   bossCap: longest hold for a boss phase (was 7600)      */
var PACE={reveal:1.08,cap:10500,bossCap:9800,phaseFloor:185};
var MECH={
  4:'flash',6:'flash',7:'flash',9:'flash',
  12:'decoy',13:'decoy',14:'order',15:'decoyflash',17:'decoy',18:'order',19:'decoyflash',
  21:'vanish',22:'order',23:'vanishdecoy',25:'orderdecoy',26:'vanish',27:'flashdecoy',28:'orderrev',29:'vanishorder',
  31:'shuffle',32:'shuffledecoy',33:'order',34:'hazard',35:'shuffleorder',36:'vanishshuffle',37:'hazarddecoy',38:'orderrev',39:'shufflehazard',
  41:'shuffleorder',42:'vanishdecoy',43:'waves',44:'hazardshuffle',45:'wavesorder',46:'wavesvanish',47:'shufflehazarddecoy',48:'wavesorderrev',49:'wavesvanishhazard',
  /* World 6 — Neon City: decoy storms */
  51:'decoy',52:'orderdecoy',53:'flashdecoy',54:'megadecoy',55:'ordermegadecoy',
  57:'decoyflash',58:'shuffledecoy',59:'orderdecoy',60:'megadecoy',61:'shuffleordermegadecoy',
  /* World 7 — Volcano Ridge: danger tiles */
  63:'hazard',64:'hazarddecoy',65:'flashhazard',66:'hazardorder',67:'hazardmegadecoy',
  69:'hazardshuffle',70:'flashhazarddecoy',71:'hazardorder',72:'hazardvanish',73:'hazardshuffleorder',
  /* World 8 — Cloudpeak: two and three waves */
  75:'waves',76:'wavesorder',77:'wavesdecoy',78:'wavesvanish',79:'waves3',
  81:'waves3order',82:'wavesmegadecoy',83:'waves3vanish',84:'wavesorder',85:'waves3shuffle',
  /* World 9 — Emerald Jungle: fading + shifting */
  87:'vanish',88:'vanishshuffle',89:'vanishorder',90:'vanishmegadecoy',91:'shuffleorder',
  93:'vanishorderrev',94:'shufflehazard',95:'vanishshuffleorder',96:'megadecoy',97:'vanishwaves',
  /* World 10 — Galaxy Drift: backwards recall */
  99:'orderrev',100:'orderrev',101:'orderrevdecoy',102:'orderrevvanish',103:'orderrevmegadecoy',
  105:'orderrevshuffle',106:'wavesorderrev',107:'orderrevultradecoy',108:'orderrevhazard',109:'waves3orderrev',
  /* World 11 — Time Nexus: everything */
  111:'shufflehazarddecoy',112:'wavesorder',113:'vanishshuffle',114:'megadecoy',115:'hazardshuffleorder',
  117:'ultradecoy',118:'waves3orderrev',119:'vanishorderrev',120:'shufflehazardmegadecoy',121:'waves3ultradecoy'
};
var BOSSES={
  10:{name:'MEMORY LOCK',sub:'Reproduce the pattern in the exact order',ic:'lock',badge:'Sharp Mind',tone:'sky'},
  20:{name:'DOUBLE PATTERN',sub:'Two patterns appear — recall both',ic:'layers',badge:'Pattern Breaker',tone:'yellow'},
  30:{name:'DISAPPEARING MATRIX',sub:'Tiles fade away — track them anyway',ic:'eye',badge:'Recall King',tone:'green'},
  40:{name:'REVERSE RECALL',sub:'Tap the whole pattern backwards',ic:'reverse',badge:'Chaos Tamer',tone:'coral'},
  50:{name:'THE MEMORY CORE',sub:'Everything at once. Prove your memory',ic:'chip',badge:'Memory Core Master',tone:'coral'},
  /* ---- expansion bosses: a mini-boss mid-world and a world boss at the end ---- */
  56:{name:'OVERLOAD',sub:'Neon surge — the pattern flashes at once',ic:'bolt',badge:'City Spark',tone:'sky',mini:true},
  62:{name:'NEON SCRAMBLER',sub:'The grid scrambles while you recall',ic:'shuffle',badge:'Neon Tamer',tone:'coral'},
  68:{name:'EMBER GUARD',sub:'Danger tiles guard the pattern',ic:'fire',badge:'Ember Walker',tone:'coral',mini:true},
  74:{name:'MAGMA TITAN',sub:'Two, then three waves of lava',ic:'fire',badge:'Volcano Victor',tone:'coral'},
  80:{name:'THUNDER PEAK',sub:'A flashing pattern in the storm',ic:'bolt',badge:'Peak Climber',tone:'sky',mini:true},
  86:{name:'STORM SEQUENCE',sub:'Three waves — recall every one',ic:'wave',badge:'Storm Rider',tone:'sky'},
  92:{name:'CANOPY TRAP',sub:'Tiles fade away into the leaves',ic:'leaf',badge:'Vine Dodger',tone:'green',mini:true},
  98:{name:'VINE TANGLE',sub:'The board shifts under the vines',ic:'shuffle',badge:'Jungle Champion',tone:'green'},
  104:{name:'DARK MATTER',sub:'Recall the pattern backwards',ic:'gem',badge:'Star Gazer',tone:'coral',mini:true},
  110:{name:'SUPERNOVA',sub:'Everything at once — twice over',ic:'star',badge:'Galaxy Guardian',tone:'yellow'},
  116:{name:'ECHO CHAMBER',sub:'Backwards, shifting and fading',ic:'reverse',badge:'Echo Breaker',tone:'sky',mini:true},
  122:{name:'TIME NEXUS',sub:'The final test. Every trick at once',ic:'clock',badge:'Time Master',tone:'coral'}
};
function mechFlags(m){
  var f={flash:false,decoy:0,order:null,vanish:false,shuffle:false,hazard:false,waves:1};
  if(!m)return f;
  if(m.indexOf('flash')>=0)f.flash=true;
  if(m.indexOf('ultradecoy')>=0)f.decoy=9;
  else if(m.indexOf('megadecoy')>=0)f.decoy=7;
  else if(m==='decoy')f.decoy=3;
  else if(m==='decoyflash'||m==='hazarddecoy')f.decoy=4;
  else if(m==='vanishdecoy'||m==='flashdecoy')f.decoy=4;
  else if(m==='shuffledecoy'||m==='orderdecoy')f.decoy=5;
  else if(m==='shufflehazarddecoy')f.decoy=6;
  else if(m.indexOf('decoy')>=0)f.decoy=5;
  if(m.indexOf('orderrev')>=0)f.order='rev';else if(m.indexOf('order')>=0)f.order='fwd';
  if(m.indexOf('vanish')>=0)f.vanish=true;
  if(m.indexOf('shuffle')>=0)f.shuffle=true;
  if(m.indexOf('hazard')>=0)f.hazard=true;
  if(m.indexOf('waves3')>=0)f.waves=3;
  else if(m.indexOf('waves')>=0)f.waves=2;
  return f;
}
function mechLabel(l){
  var m=MECH[l]||'';
  if(BOSSES[l])return 'BOSS';
  if(!m)return null;
  if(m==='flash')return 'FLASH';
  if(m.indexOf('waves3')>=0)return 'THREE WAVES';
  if(m.indexOf('waves')>=0)return 'TWO WAVES';
  if(m.indexOf('shuffle')>=0)return 'SHIFT';
  if(m.indexOf('vanish')>=0)return 'FADING';
  if(m.indexOf('order')>=0)return 'IN ORDER';
  if(m.indexOf('hazard')>=0)return 'DANGER TILE';
  if(m.indexOf('ultradecoy')>=0)return 'DECOY STORM';
  if(m.indexOf('megadecoy')>=0)return 'DECOY RUSH';
  if(m.indexOf('decoy')>=0)return 'DECOYS';
  return null;
}
function mechDesc(l){
  var f=mechFlags(MECH[l]||''),p=[];
  if(f.flash)p.push('No stagger — the pattern flashes on at once');
  if(f.waves>2)p.push('Three patterns appear one after another — recall all three');
  else if(f.waves>1)p.push('Two patterns appear one after another — recall both');
  if(f.order==='fwd')p.push('Tap in the shown order (numbers appear on the tiles)');
  if(f.order==='rev')p.push('Tap the pattern backwards');
  if(f.vanish)p.push('Some tiles fade before you finish looking');
  if(f.shuffle)p.push('The board shifts after the reveal — adjust your pattern');
  if(f.decoy)p.push(f.decoy+' decoy tiles light up: recalling them is bonus score'+(f.decoy>=7?' — most are fake!':''));
  if(f.hazard)p.push('A danger tile may appear during recall — do not tap it');
  if(!p.length)p.push('Plain recall — a clean, readable matrix');
  return p;
}
function levelCfg(l){
  var c=chOf(l),span=Math.max(1,CHLEN[c]-1),idx=clamp(l-chFirst(c),0,span);
  var m=MECH[l]||'',f=mechFlags(m),boss=BOSSES[l]||null;
  var size=GSZ[l-1],tiles=GTILE[l-1];
  var perTile=TBASE[c]*(1-(idx/span)*0.2)*PACE.reveal;
  if(boss)perTile*=(l===MAXLVL?0.9:0.87);
  var dur=clamp(Math.round(tiles*perTile),900,boss?PACE.bossCap:PACE.cap);
  return {lvl:l,ch:c,size:size,tiles:tiles,dur:dur,perTile:Math.round(perTile),flags:f,boss:boss,mech:m,
    order:f.order,vanish:f.vanish,shuffle:f.shuffle,hazard:f.hazard,waves:f.waves,decoy:f.decoy,flash:f.flash,
    parSec:Math.round(tiles*0.75+2),accT:90,comboT:clamp(Math.round(tiles*0.75),3,12),label:mechLabel(l)};
}
/* ================= unlock gates ================= */
function unlocked(k){
  switch(k){
    case 'stars':return S.maxlvl>=3;
    case 'mastery':return S.maxlvl>=5;
    case 'powerups':return S.maxlvl>=6;
    case 'vault':return S.maxlvl>=8;
    case 'daily':return S.maxlvl>=12;
    case 'speed':return S.maxlvl>=15;
    case 'endurance':return S.maxlvl>=25;
    case 'reverse':return S.maxlvl>=35;
    case 'perfect':return S.maxlvl>=45;
    case 'chaos':return S.bosses.indexOf(50)>=0;
  }
  return true;
}
var UNLOCK_TXT={stars:'Level 3',mastery:'Level 5',powerups:'Level 6',vault:'Level 8',daily:'Level 12',
  speed:'Level 15',endurance:'Level 25',reverse:'Level 35',perfect:'Level 45',chaos:'Defeat Level 50'};
/* ================= modes ================= */
var MODES=[
  {id:'classic',  name:'Classic',   ic:'grid',    tone:'sky',    desc:'Endless matrix. Three hearts.'},
  {id:'speed',    name:'Speed',     ic:'bolt',    tone:'yellow', desc:'Very short reveals. 1.5× score.'},
  {id:'endurance',name:'Endurance', ic:'heart',   tone:'coral',  desc:'Five hearts. Keep recalling.'},
  {id:'reverse',  name:'Reverse',   ic:'reverse', tone:'green',  desc:'Every pattern goes backwards.'},
  {id:'perfect',  name:'Perfect',   ic:'target',  tone:'coral',  desc:'One mistake ends the run. 1.5× score.'},
  {id:'chaos',    name:'Chaos',     ic:'shuffle', tone:'sky',    desc:'Shifting board, danger tiles, waves.'}
];
/* ================= power-ups ================= */
var PWR=[
  {id:'heart', name:'Extra Heart', ic:'heart', tone:'coral', cost:30, kind:'passive', desc:'Start the run with one extra heart.'},
  {id:'reveal',name:'Reveal',      ic:'eye',   tone:'sky',   cost:40, kind:'active',  desc:'Briefly re-show the pattern.'},
  {id:'slow',  name:'Slow Time',   ic:'clock', tone:'green', cost:35, kind:'active',  desc:'Adds 1.4s to the reveal window.'},
  {id:'second',name:'Second Chance',ic:'shield',tone:'yellow',cost:45, kind:'passive', desc:'Cancels your next mistake once.'},
  {id:'time',  name:'Time Boost',  ic:'clock', tone:'sky',   cost:50, kind:'passive', desc:'+25% reveal time for the whole run.'},
  {id:'hint',  name:'Hint',        ic:'target',tone:'coral', cost:55, kind:'active',  desc:'Shows one tile you still need to tap.'}
];
function pwById(id){for(var i=0;i<PWR.length;i++)if(PWR[i].id===id)return PWR[i];return PWR[0];}
function pwCount(id){return (S.pw&&S.pw[id])||0;}
/* ---- booster economy: single buys and discounted bundles ---- */
function bundleCost(p,n){
  var d=(n>=5)?0.8:((n>=3)?0.9:1);
  return Math.max(1,Math.round(p.cost*n*d));
}
function bundleSave(p,n){
  if(n<2)return 0;
  return Math.round((1-bundleCost(p,n)/(p.cost*n))*100);
}
function buyBooster(id,n){
  var p=pwById(id),qty=n||1,cost=bundleCost(p,qty);
  A.init();
  if(S.tok<cost){A.warn();toast('chip','coral','Not enough tokens','You need '+nf(cost)+' — clear levels to earn more');return false;}
  S.tok-=cost;saveKey('tok');
  S.pw[p.id]=pwCount(p.id)+qty;saveKey('pw');
  A.tok();A.ach();vib([15,25,15]);
  toast(p.ic,p.tone,p.name+' +'+qty,(qty>1?'Bundle saved '+bundleSave(p,qty)+'% • ':'')+'Tokens left: '+nf(S.tok));
  return true;
}
function toggleBoosterEquip(id){
  var k=S.pweq.indexOf(id);
  if(k>=0)S.pweq.splice(k,1);
  else{if(S.pweq.length>=2)S.pweq.shift();S.pweq.push(id);}
  saveKey('pweq');
}
/* re-paint every booster surface that is currently on screen */
function refreshBoosterUI(){
  renderMenuBoosters();
  if($('ov-vault').classList.contains('on'))renderVault();
  if($('ov-level').classList.contains('on')&&$('btn-lc-play').dataset.lvl)renderLevelCard(parseInt($('btn-lc-play').dataset.lvl,10));
  if($('ov-pause').classList.contains('on'))renderPauseObj();
  if(R.active&&!R.over){renderPuBar();updatePuStates();}
  var t=$('shop-tok');if(t)t.textContent=nf(S.tok);
  var m=$('m-tok');if(m)m.textContent=nf(S.tok);
  var mp=$('map-tok');if(mp)mp.textContent=nf(S.tok);
}

/* ================= audio ================= */
var A={
  ctx:null,
  adMute:false,sdkMute:false,
  init:function(){
    if(!this.ctx){try{var AC=window.AudioContext||window.webkitAudioContext;this.ctx=new AC();}catch(e){}}
    if(this.ctx&&this.ctx.state==='suspended'&&!this.adMute&&!this.sdkMute)this.ctx.resume();
    try{if(window.MU)MU.ensure();}catch(e){}
  },
  /* hard-mute while an ad plays */
  adPause:function(on){
    this.adMute=!!on;
    try{
      if(on){if(this.ctx&&this.ctx.state==='running')this.ctx.suspend();}
      else if(this.ctx&&this.ctx.state==='suspended'&&!this.sdkMute&&S.snd)this.ctx.resume();
    }catch(e){}
  },
  t:function(f,dur,type,vol,delay,slide){
    if(!S.snd||this.adMute||this.sdkMute||!this.ctx)return;
    try{
      var pk=(typeof SNDPACKS!=='undefined'&&SNDPACKS[(S.eq&&S.eq.sounds)||'snd-classic'])||{};
      if(pk.type)type=pk.type;
      if(pk.f)f=f*pk.f;
      if(pk.v)vol=(vol||.12)*pk.v;
      var c=this.ctx,o=c.createOscillator(),g=c.createGain(),t0=c.currentTime+(delay||0);
      o.type=type||'sine';o.frequency.setValueAtTime(f,t0);
      if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(40,f+slide),t0+(dur||.1));
      g.gain.setValueAtTime(vol||.12,t0);
      g.gain.exponentialRampToValueAtTime(.0008,t0+(dur||.1));
      o.connect(g);g.connect(c.destination);o.start(t0);o.stop(t0+(dur||.1)+.03);
    }catch(e){}
  },
  seq:function(fs,d,type,vol,gap){for(var i=0;i<fs.length;i++)this.t(fs[i],d,type||'sine',vol||.1,i*(gap||.07));},
  tap:function(){this.t(620,.05,'sine',.07);},
  good:function(){this.t(640,.07,'sine',.11);this.t(900,.09,'sine',.09,.05);},
  bad:function(){this.t(230,.16,'triangle',.15,0,-90);this.t(140,.2,'sine',.1,.06);},
  show:function(){this.t(520,.045,'sine',.045);},
  combo:function(n){this.t(660+Math.min(n,14)*42,.08,'square',.055);},
  warn:function(){this.t(420,.09,'triangle',.1);this.t(420,.09,'triangle',.1,.14);},
  clear:function(){this.seq([523,659,784,1047],.13,'sine',.11,.07);},
  over:function(){this.seq([392,330,262],.2,'triangle',.12,.13);},
  ach:function(){this.seq([784,988,1319],.12,'sine',.1,.08);},
  btn:function(){this.t(480,.05,'sine',.06);},
  star:function(n){this.t(880+((n||0)*160),.12,'sine',.1);},
  phase:function(){this.seq([659,880,1047],.14,'sine',.11,.09);},
  boss:function(){this.seq([196,196,247,196,262],.16,'triangle',.13,.16);},
  won:function(){this.seq([523,659,784,1047,1319],.16,'sine',.12,.1);},
  record:function(){this.seq([1047,1319,1568],.1,'sine',.09,.06);},
  tok:function(){this.t(1180,.07,'sine',.06);this.t(1560,.09,'sine',.05,.05);},
  unlock:function(){this.seq([659,880,1175],.12,'square',.07,.08);}
};

/* ================= background music =================
   Procedural WebAudio loop — zero audio files. A tiny lookahead
   scheduler plays a calm arpeggio on menus and a bouncier groove
   in game. Honors every existing mute gate (music toggle, sound
   toggle, ad mute, SDK mute, hidden tab) and never steals the
   AudioContext from the SFX engine — it shares A.ctx.        */
var MU={
  scene:'',step:0,nextT:0,timer:0,
  SCENES:{
    /* steps = semitone offsets from A4 per 8th-note (null = rest);
       bass = semitone offsets from A2 on beats 1 & 3. */
    menu:  {dur:.34,wave:'sine',    vol:.042,bvol:.038,
            steps:[0,7,12,7, 5,12,16,12, 3,10,15,10, -2,5,12,5],
            bass:[-12,-7,-9,-14]},
    play:  {dur:.25,wave:'triangle',vol:.038,bvol:.034,
            steps:[12,null,7,12, 16,null,12,7, 5,7,12,null, 7,5,3,null],
            bass:[-12,-5,-9,-7]},
    versus:{dur:.21,wave:'triangle',vol:.040,bvol:.036,
            steps:[12,12,7,12, 15,12,7,5, 12,12,16,12, 7,5,3,5],
            bass:[-12,-12,-7,-7]}
  },
  f:function(semi,base){return (base||440)*Math.pow(2,semi/12);},
  note:function(f,t0,dur,wave,vol){
    try{
      var c=A.ctx,o=c.createOscillator(),g=c.createGain();
      o.type=wave;o.frequency.setValueAtTime(f,t0);
      g.gain.setValueAtTime(.0001,t0);
      g.gain.exponentialRampToValueAtTime(Math.max(.0002,vol),t0+.02);
      g.gain.exponentialRampToValueAtTime(.0008,t0+dur);
      o.connect(g);g.connect(c.destination);o.start(t0);o.stop(t0+dur+.05);
    }catch(e){}
  },
  tick:function(){
    var self=MU;
    if(!S.mus||!S.snd||A.adMute||A.sdkMute||!A.ctx||document.hidden){self.hold();return;}
    var sc=self.SCENES[self.scene];
    if(!sc||A.ctx.state!=='running'){self.hold();return;}
    try{
      var ahead=A.ctx.currentTime+.4;
      if(self.nextT<ahead-.6||self.nextT> ahead+.6)self.nextT=A.ctx.currentTime+.05;
      while(self.nextT<ahead){
        var s=sc.steps[self.step%sc.steps.length];
        if(s!=null)self.note(self.f(s),self.nextT,sc.dur*1.8,sc.wave,sc.vol);
        if(self.step%4===0||self.step%4===2){
          var b=sc.bass[(self.step>>1)%sc.bass.length];
          self.note(self.f(b,110),self.nextT,sc.dur*3.2,'sine',sc.bvol);
        }
        self.nextT+=sc.dur;self.step++;
      }
    }catch(e){}
  },
  hold:function(){ /* muted/hidden: freeze the clock so no burst piles up */
    try{if(A.ctx)MU.nextT=A.ctx.currentTime+.08;}catch(e){}
  },
  ensure:function(){
    if(this.timer||!S.mus||!A.ctx)return;
    if(!this.scene)this.scene='menu';
    this.nextT=A.ctx.currentTime+.06;this.step=0;
    var self=this;
    this.timer=setInterval(function(){self.tick();},120);
  },
  setScene:function(s){
    if(this.scene===s)return;
    this.scene=s;this.step=0;                 /* next bar starts the new groove */
    try{if(A.ctx)this.nextT=A.ctx.currentTime+.06;}catch(e){}
    this.ensure();
  },
  stop:function(){
    if(this.timer){clearInterval(this.timer);this.timer=0;}
    this.scene='';this.step=0;
  }
};

/* ================= particles ================= */
var FX=(function(){
  var cv=$('fx'),cx=cv.getContext('2d'),W=0,H=0,DPR=1;
  function resize(){
    DPR=Math.min(window.devicePixelRatio||1,2);
    W=window.innerWidth;H=window.innerHeight;
    cv.width=Math.round(W*DPR);cv.height=Math.round(H*DPR);
    cv.style.width=W+'px';cv.style.height=H+'px';
    cx.setTransform(DPR,0,0,DPR,0,0);
  }
  resize();window.addEventListener('resize',resize);
  var P=[],T=[],MAX=240,running=false;
  try{
    if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)MAX=120;
    else if(navigator&&navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=2)MAX=160;
    else if(navigator&&navigator.deviceMemory&&navigator.deviceMemory<=2)MAX=160;
  }catch(e0){}
  function kick(){if(!running){running=true;requestAnimationFrame(loop);}}
  function push(p){if(!S.fx)return;if(P.length>=MAX)P.splice(0,P.length-MAX+1);P.push(p);kick();}
  function burst(x,y,o){
    o=o||{};
    var n=o.n||10,colors=o.colors||['#57CB6C','#FFFFFF'];
    var ang=(o.ang!=null)?o.ang:rnd(0,Math.PI*2);
    var spread=(o.spread!=null)?o.spread:Math.PI*2;
    var sp=o.sp||3.2,g=(o.g!=null)?o.g:.14;
    var shapes=o.shapes||['c','r','s'];
    for(var i=0;i<n;i++){
      var a=ang+(Math.random()-.5)*spread;
      var v=(o.spMin!=null?o.spMin:sp*.4)+Math.random()*sp;
      push({shape:pick(shapes),x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-(o.up||0),
        g:g,rot:rnd(0,6.3),vr:rnd(-.25,.25),size:rnd((o.size||5)*.7,(o.size||5)*1.3),
        color:pick(colors),life:Math.round(rnd(24,46)),age:0});
    }
  }
  function fountain(x,y,n,colsIn){
    var cols=colsIn||['#4CB9F2','#FFC93C','#FF6B6B','#57CB6C','#FFFFFF'];
    for(var i=0;i<n;i++){
      var a=-Math.PI/2+(Math.random()-.5)*1.5,v=rnd(3.2,7);
      push({shape:pick(['c','r','r','s','st']),x:x+rnd(-30,30),y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,
        g:.16,rot:rnd(0,6.3),vr:rnd(-.3,.3),size:rnd(3.5,7),color:pick(cols),
        life:Math.round(rnd(48,78)),age:0});
    }
  }
  function text(x,y,str,color,size){
    if(!S.fx&&T.length>3)return;
    T.push({x:x,y:y,str:str,color:color||'#1F2A52',size:size||16,age:0,life:52,vy:-1.3});
    kick();
  }
  function drawStar(x,y,r,rot){
    cx.save();cx.translate(x,y);cx.rotate(rot);
    cx.beginPath();cx.moveTo(0,-r);cx.lineTo(r*.3,-r*.3);cx.lineTo(r,0);cx.lineTo(r*.3,r*.3);
    cx.lineTo(0,r);cx.lineTo(-r*.3,r*.3);cx.lineTo(-r,0);cx.lineTo(-r*.3,-r*.3);cx.closePath();cx.fill();
    cx.restore();
  }
  function loop(){
    cx.clearRect(0,0,W,H);
    if(!P.length&&!T.length){running=false;return;}   /* sleep until the next particle */
    var i,p,k,s;
    for(i=P.length-1;i>=0;i--){
      p=P[i];p.age++;
      if(p.age>=p.life){P.splice(i,1);continue;}
      p.vy+=p.g;p.x+=p.vx;p.y+=p.vy;p.rot+=p.vr;
      k=1-p.age/p.life;
      cx.globalAlpha=k>0.7?1:(k/0.7);
      cx.fillStyle=p.color;
      if(p.shape==='c'){cx.beginPath();cx.arc(p.x,p.y,p.size*.55,0,6.29);cx.fill();}
      else if(p.shape==='r'){cx.save();cx.translate(p.x,p.y);cx.rotate(p.rot);s=p.size*.9;cx.fillRect(-s/2,-s/2,s,s);cx.restore();}
      else if(p.shape==='s'){drawStar(p.x,p.y,p.size,p.rot);}
      else if(p.shape==='o'){cx.strokeStyle=p.color;cx.lineWidth=2.4;cx.beginPath();cx.arc(p.x,p.y,p.size*(.6+p.age/p.life*1.7),0,6.29);cx.stroke();}
      else{cx.strokeStyle=p.color;cx.lineWidth=2;cx.lineCap='round';cx.beginPath();cx.moveTo(p.x,p.y);cx.lineTo(p.x-p.vx*1.8,p.y-p.vy*1.8);cx.stroke();}
    }
    for(i=T.length-1;i>=0;i--){
      var t=T[i];t.age++;
      if(t.age>=t.life){T.splice(i,1);continue;}
      t.y+=t.vy;
      var al=1-t.age/t.life;
      cx.globalAlpha=al>0.6?1:(al/0.6);
      cx.font='800 '+t.size+'px "Baloo 2", "Nunito", sans-serif';
      cx.textAlign='center';
      cx.lineWidth=4;cx.strokeStyle='rgba(255,255,255,.92)';cx.lineJoin='round';
      cx.strokeText(t.str,t.x,t.y);
      cx.fillStyle=t.color;cx.fillText(t.str,t.x,t.y);
    }
    cx.globalAlpha=1;
    requestAnimationFrame(loop);
  }
  return {burst:burst,fountain:fountain,text:text};
})();

/* ================= achievements ================= */
var CATS=[
  {id:'combo',   name:'Combo',    ic:'bolt'},
  {id:'memory',  name:'Memory',   ic:'chip'},
  {id:'speed',   name:'Speed',    ic:'gauge'},
  {id:'perfect', name:'Perfect',  ic:'star'},
  {id:'boss',    name:'Boss',     ic:'crown'},
  {id:'daily',   name:'Daily',    ic:'cal'},
  {id:'mastery', name:'Mastery',  ic:'medal'}
];
var ACH=[
  {id:'cmb5',  cat:'combo',  icon:'bolt',  c:'yellow',name:'Warming Up',       desc:'Reach a ×5 combo',              goal:5,   stat:'bcombo'},
  {id:'cmb10', cat:'combo',  icon:'fire',  c:'coral', name:'On Fire',          desc:'Reach a ×10 combo',             goal:10,  stat:'bcombo'},
  {id:'cmb15', cat:'combo',  icon:'fire',  c:'coral', name:'Unstoppable',      desc:'Reach a ×15 combo',             goal:15,  stat:'bcombo'},
  {id:'cmb20', cat:'combo',  icon:'spark', c:'sky',   name:'Memory Beast',     desc:'Reach a ×20 combo',             goal:20,  stat:'bcombo'},
  {id:'cmb25', cat:'combo',  icon:'crown', c:'yellow',name:'Matrix Mind',      desc:'Reach a ×25 combo',             goal:25,  stat:'bcombo'},
  {id:'t100',  cat:'memory', icon:'chip',  c:'sky',   name:'Century',          desc:'Recall 100 tiles in total',     goal:100, stat:'tiles'},
  {id:'t500',  cat:'memory', icon:'chip',  c:'green', name:'Memory Vault',     desc:'Recall 500 tiles in total',     goal:500, stat:'tiles'},
  {id:'t1500', cat:'memory', icon:'trophy',c:'yellow',name:'Deep Storage',     desc:'Recall 1,500 tiles in total',   goal:1500,stat:'tiles'},
  {id:'ct25',  cat:'memory', icon:'bolt',  c:'green', name:'Chain Recall',     desc:'25 correct taps back to back',  goal:25,  stat:'bestct'},
  {id:'cl15',  cat:'memory', icon:'check', c:'sky',   name:'Pattern Hunter',   desc:'Clear 15 levels',               goal:15,  stat:'clears'},
  {id:'cl35',  cat:'memory', icon:'medal', c:'green', name:'Matrix Veteran',   desc:'Clear 35 levels',               goal:35,  stat:'clears'},
  {id:'sp10',  cat:'speed',  icon:'gauge', c:'sky',   name:'Quick Reflex',     desc:'10 PERFECT-speed recalls',      goal:10,  stat:'spd'},
  {id:'sp100', cat:'speed',  icon:'gauge', c:'yellow',name:'Lightning Recall', desc:'100 PERFECT-speed recalls',     goal:100, stat:'spd'},
  {id:'sp400', cat:'speed',  icon:'gauge', c:'coral', name:'Instant Matrix',   desc:'400 PERFECT-speed recalls',     goal:400, stat:'spd'},
  {id:'pf3',   cat:'perfect',icon:'star',  c:'sky',   name:'Focused',          desc:'3 perfect levels in a row',     goal:3,   stat:'pclear'},
  {id:'pf5',   cat:'perfect',icon:'star',  c:'green', name:'Locked In',        desc:'5 perfect levels in a row',     goal:5,   stat:'pclear'},
  {id:'pf10',  cat:'perfect',icon:'crown', c:'yellow',name:'Memory Master',    desc:'10 perfect levels in a row',    goal:10,  stat:'pclear'},
  {id:'pl25',  cat:'perfect',icon:'spark', c:'coral', name:'Flawless Mind',    desc:'25 perfect levels total',       goal:25,  stat:'bpl'},
  {id:'bs1',   cat:'boss',   icon:'crown', c:'sky',   name:'Sharp Mind',       desc:'Defeat your first boss',        goal:1,   stat:'bosses'},
  {id:'bs3',   cat:'boss',   icon:'crown', c:'green', name:'Pattern Breaker',  desc:'Defeat 3 bosses',               goal:3,   stat:'bosses'},
  {id:'bs5',   cat:'boss',   icon:'trophy',c:'yellow',name:'Core Master',      desc:'Defeat 5 bosses',                 goal:5,   stat:'bosses'},
  {id:'dl1',   cat:'daily',  icon:'cal',   c:'sky',   name:'Daily Habit',      desc:'Complete a Daily Matrix',       goal:1,   stat:'druns'},
  {id:'dl7',   cat:'daily',  icon:'fire',  c:'coral', name:'Seven Days',       desc:'7-day daily streak',            goal:7,   stat:'dstreak'},
  {id:'dlg',   cat:'daily',  icon:'medal', c:'yellow',name:'Golden Matrix',    desc:'Earn a gold daily medal',       goal:1,   stat:'dgold'},
  {id:'mst1',  cat:'mastery',icon:'medal', c:'sky',   name:'Objective One',    desc:'Complete 10 objectives',        goal:10,  stat:'objs'},
  {id:'mst2',  cat:'mastery',icon:'medal', c:'green', name:'Objective Master', desc:'Complete 60 objectives',        goal:60,  stat:'objs'},
  {id:'mst3',  cat:'mastery',icon:'trophy',c:'yellow',name:'Badge Collector',  desc:'Master 10 levels completely',   goal:10,  stat:'badges'},
  {id:'st30',  cat:'mastery',icon:'star',  c:'yellow',name:'Star Collector',   desc:'Earn 30 stars',                 goal:30,  stat:'stars'},
  {id:'st90',  cat:'mastery',icon:'star',  c:'coral', name:'Star Hunter',      desc:'Earn 90 stars',                 goal:90,  stat:'stars'},
  {id:'st150', cat:'mastery',icon:'spark', c:'sky',   name:'Constellation',    desc:'Earn 150 stars',                goal:150, stat:'stars'},
  /* ---- expansion awards for the six new worlds ---- */
  {id:'cmb30', cat:'combo',  icon:'crown', c:'coral', name:'Combo Legend',     desc:'Reach a ×30 combo',             goal:30,  stat:'bcombo'},
  {id:'cl60',  cat:'memory', icon:'medal', c:'sky',   name:'Sixty Strong',     desc:'Clear 60 levels',               goal:60,  stat:'clears'},
  {id:'cl100', cat:'memory', icon:'trophy',c:'yellow',name:'Century Club',     desc:'Clear 100 levels',              goal:100, stat:'clears'},
  {id:'bs8',   cat:'boss',   icon:'crown', c:'sky',   name:'Boss Slayer',      desc:'Defeat 8 bosses',               goal:8,   stat:'bosses'},
  {id:'bs11',  cat:'boss',   icon:'crown', c:'coral', name:'World Conqueror',  desc:'Defeat all 11 world bosses',    goal:11,  stat:'wbosses'},
  {id:'bs17',  cat:'boss',   icon:'trophy',c:'yellow',name:'Nexus Champion',   desc:'Defeat every boss in the game', goal:17,  stat:'bosses'},
  {id:'st250', cat:'mastery',icon:'star',  c:'coral', name:'Star Storm',       desc:'Earn 250 stars',                goal:250, stat:'stars'},
  {id:'stall', cat:'mastery',icon:'spark', c:'yellow',name:'Full Constellation',desc:'Earn every campaign star',     goal:3*MAXLVL,stat:'stars'},
  {id:'mst4',  cat:'mastery',icon:'medal', c:'coral', name:'Master of Masters',desc:'Master 40 levels completely',   goal:40,  stat:'badges'},
  {id:'ses30', cat:'daily',  icon:'clock', c:'green', name:'Half Hour Hero',   desc:'Play 30 minutes in one session',goal:1800,stat:'sessbest'},
  {id:'ses60', cat:'daily',  icon:'clock', c:'sky',   name:'Matrix Marathon',  desc:'Play 60 minutes in one day',    goal:3600,stat:'sesstoday'}
];
function statVal(k){
  if(k==='bcombo')return S.bcombo;
  if(k==='tiles')return S.tiles;
  if(k==='bestct')return S.bestct||0;
  if(k==='clears')return S.clears;
  if(k==='spd')return S.spd||0;
  if(k==='pclear')return S.pclear;
  if(k==='bpl')return S.bpl||0;
  if(k==='bosses')return S.bosses.length;
  if(k==='druns')return (S.ddata&&S.ddata.runs)||0;
  if(k==='dstreak')return S.dstreak;
  if(k==='dgold')return dgold;
  if(k==='objs')return objDone();
  if(k==='badges')return masteryCount();
  if(k==='stars')return starTotal();
  if(k==='wbosses')return wbossCount();
  if(k==='sessbest')return S.sessBest||0;
  if(k==='sesstoday')return (S.sessDate===todayKey())?(S.sessToday||0):0;
  return 0;
}
/* world-final bosses defeated (mini-bosses do not count) */
function wbossCount(){
  var n=0,l;
  for(l in BOSSES)if(isWorldBoss(parseInt(l,10))&&S.bosses.indexOf(parseInt(l,10))>=0)n++;
  return n;
}
function achCheck(){
  var got=0,i,a;
  for(i=0;i<ACH.length;i++){
    a=ACH[i];
    if(S.ach.indexOf(a.id)>=0)continue;
    if(statVal(a.stat)>=a.goal){
      S.ach.push(a.id);saveKey('ach');
      toast(a.icon,a.c,'Award unlocked!',a.name);
      A.ach();got++;
    }
  }
  if(got){
    FX.burst(window.innerWidth/2,window.innerHeight*0.3,{n:14,colors:['#FFC93C','#FFFFFF','#4CB9F2'],sp:3.4,shapes:['s','c']});
    addTok(8*got);                       /* awards also feed the token economy */
  }
  if(typeof cosCheckUnlocks==='function')cosCheckUnlocks();
  return got;
}
/* ================= toasts / banners / records ================= */
var bannerT=null;
function banner(kind,icon,text,dur){
  var b=$('banner');
  b.className='banner '+(kind||'');
  b.innerHTML=(icon?'<svg class="ic"><use href="#i-'+icon+'"/></svg>':'')+'<span>'+text+'</span>';
  b.style.animationDuration=(dur||1150)+'ms';
  void b.offsetWidth;
  b.classList.add('show');
  if(bannerT)clearTimeout(bannerT);
  bannerT=setTimeout(function(){b.classList.remove('show');},(dur||1150)+60);
}
function toast(icon,color,title,sub){
  var box=$('toasts'),el=document.createElement('div');
  el.className='toast';
  el.innerHTML='<span class="t-badge" style="background:var(--'+color+');box-shadow:0 3px 0 var(--'+color+'-edge)"><svg class="ic"><use href="#i-'+icon+'"/></svg></span>'+
    '<span class="t-txt"><b>'+title+'</b><span>'+sub+'</span></span>';
  box.appendChild(el);
  requestAnimationFrame(function(){requestAnimationFrame(function(){el.classList.add('show');});});
  setTimeout(function(){el.classList.remove('show');setTimeout(function(){if(el.parentNode)el.parentNode.removeChild(el);},420);},2700);
}
var recT=null;
function newRec(text){
  var b=$('newrec');
  b.innerHTML='<svg class="ic"><use href="#i-crown"/></svg><span>NEW RECORD — '+text+'</span>';
  b.classList.remove('show');void b.offsetWidth;b.classList.add('show');
  A.record();
  if(recT)clearTimeout(recT);
  recT=setTimeout(function(){b.classList.remove('show');},1560);
}
/* ================= screens & overlays ================= */
function showScreen(name){
  var names=['menu','map','game','shop','custom'],i;
  for(i=0;i<names.length;i++){
    var el=$('scr-'+names[i]);
    if(el)el.classList.toggle('on',names[i]===name);
  }
  if(name==='game')requestAnimationFrame(fitBoard);
  else Plat.gameplayStop();
  if(name==='menu'&&typeof mmFitMenu==='function')requestAnimationFrame(mmFitMenu);
  try{if(window.MU){if(name!=='game')MU.setScene('menu');else if(!(window.MP&&MP.active))MU.setScene('play');}}catch(e){}
}
var OVS=['ov-level','ov-pause','ov-win','ov-over','ov-bossdef','ov-modes','ov-daily','ov-vault','ov-ach','ov-stats','ov-set','ov-world','ov-collection','ov-mastery','ov-mp-confirm'];
function openOv(id){
  var ov=$(id),pn=ov.querySelector('.panel');
  if(pn)pn.scrollTop=0;
  ov.classList.add('on');
  if(id==='ov-pause'||id==='ov-win'||id==='ov-over'||id==='ov-bossdef'||id==='ov-world')Plat.gameplayStop();
}
function closeOv(id){$(id).classList.remove('on');}
function closeAllOv(){for(var i=0;i<OVS.length;i++)closeOv(OVS[i]);}
function anyOv(){for(var i=0;i<OVS.length;i++)if($(OVS[i]).classList.contains('on'))return true;return false;}
function showBossWarn(boss,cb){
  var w=$('boss-warn');
  var wc=(typeof WORLDS!=='undefined')?WORLDS[chOf(R.level||10)]:null;
  $('bw-title').textContent=boss.name;
  $('bw-sub').textContent=(wc?('World '+wc.n+' · '+wc.name+' — '):'')+boss.sub;
  var bwic=w.querySelector('.bw-ic');
  if(wc&&bwic){bwic.style.background=wc.col;bwic.style.boxShadow='0 5px 0 '+wc.edge;}
  var rules='<div><svg class="ic"><use href="#i-layers"/></svg>3 phases — clear every one to win</div>';
  if(boss.name==='MEMORY LOCK')rules+='<div><svg class="ic"><use href="#i-lock"/></svg>Order matters: tap them in sequence</div>';
  if(boss.name==='DOUBLE PATTERN')rules+='<div><svg class="ic"><use href="#i-layers"/></svg>Both patterns must be recalled</div>';
  if(boss.name==='DISAPPEARING MATRIX')rules+='<div><svg class="ic"><use href="#i-eye"/></svg>Tiles fade — remember their spots</div>';
  if(boss.name==='REVERSE RECALL')rules+='<div><svg class="ic"><use href="#i-reverse"/></svg>Always tap the pattern backwards</div>';
  if(boss.name==='THE MEMORY CORE')rules+='<div><svg class="ic"><use href="#i-shuffle"/></svg>Shifting board, two waves, fading tiles</div>';
  if(boss.mini)rules+='<div><svg class="ic"><use href="#i-warn"/></svg>Mid-world mini-boss — clear it to open the second half of the world</div>';
  else if(boss.name!=='MEMORY LOCK'&&boss.name!=='DOUBLE PATTERN'&&boss.name!=='DISAPPEARING MATRIX'&&boss.name!=='REVERSE RECALL'&&boss.name!=='THE MEMORY CORE')
    rules+='<div><svg class="ic"><use href="#i-'+boss.ic+'"/></svg>'+boss.sub+'</div>';
  rules+='<div><svg class="ic"><use href="#i-heart"/></svg>'+(boss.name==='THE MEMORY CORE'||boss.name==='TIME NEXUS'?'Only 2 mistakes allowed':'Mistakes cost a heart')+'</div>';
  $('bw-rules').innerHTML=rules;
  w.classList.add('on');
  A.boss();vib([30,50,30]);
  setTimeout(function(){w.classList.remove('on');if(cb)cb();},1500);
}
/* ================= game state ================= */
var grid=$('grid'),board=$('board');
var R={
  active:false,paused:false,over:false,phase:'idle',mode:'campaign',
  level:1,round:1,lives:3,maxLives:3,score:0,combo:0,bestCombo:0,
  found:0,required:0,sel:{},decoySel:{},levels:0,
  waves:[],waveIdx:0,totalWaves:1,spec:null,cfg:null,mapFn:null,shiftKind:null,
  missThisLevel:0,misses:0,hits:0,taps:0,tapTimes:[],recallStart:0,lastTap:0,
  noMiss:true,shield:false,shieldUsed:false,
  bossPhase:0,bossPhases:0,bossWon:false,
  decoysFound:0,hazardIdx:-1,hazards:0,bonusIdx:-1,
  recs:{},gridSize:0,pDur:0,pStart:0,raf:0,stag:null,raf2:0,
  pstreak:0,cleared:0,ordQ:0,orderAll:[],orderBase:[],levelTokens:0
};
var TT={a:null,b:null,c:null};
function clrT(){
  var k;for(k in TT){if(TT[k]){clearTimeout(TT[k]);TT[k]=null;}}
  if(R.stag){for(var i=0;i<R.stag.length;i++)clearTimeout(R.stag[i]);R.stag=null;}
  if(R.raf){cancelAnimationFrame(R.raf);R.raf=0;}
  if(R.raf2){cancelAnimationFrame(R.raf2);R.raf2=0;}
}
/* ================= grid ================= */
function buildGrid(sz){
  grid.innerHTML='';
  grid.style.gridTemplateColumns='repeat('+sz+',1fr)';
  grid.style.gap=(sz<=4?9:sz===5?7:sz===6?6:sz<=7?5:4)+'px';
  board.style.setProperty('--tr',(sz<=4?16:sz===5?13:sz===6?11:sz===7?10:sz===8?9:8)+'px');
  var frag=document.createDocumentFragment(),i;
  for(i=0;i<sz*sz;i++){
    var d=document.createElement('div');
    d.className='tile lock';
    d.dataset.i=i;
    d.style.animationDelay=Math.min(i*8,240)+'ms';
    d.innerHTML='<span class="ord"></span>';
    (function(idx){d.addEventListener('pointerdown',function(e){e.preventDefault();handleTap(idx);},{passive:false});})(i);
    frag.appendChild(d);
  }
  grid.appendChild(frag);
  R.gridSize=sz;
}
function tileAt(i){return grid.children[i];}
function clearOrd(el){var s=el&&el.firstChild;if(s&&s.textContent)s.textContent='';}
function setTile(i,cls,lock,ord){
  var el=tileAt(i);if(!el)return;
  el.className='tile'+(cls?' '+cls:'')+(lock?' lock':'');
  var s=el.firstChild;
  if(s)s.textContent=(ord!=null&&ord>0)?ord:'';
  el.style.animationDelay='';
}
function lockAll(on){
  var ch=grid.children,i;
  for(i=0;i<ch.length;i++){if(on)ch[i].classList.add('lock');else ch[i].classList.remove('lock');}
}
function resetBoard(){
  var ch=grid.children,i;
  for(i=0;i<ch.length;i++){ch[i].className='tile';ch[i].style.animationDelay='';clearOrd(ch[i]);}
}
function tileCenter(i){
  var el=tileAt(i);if(!el)return{x:0,y:0};
  var r=el.getBoundingClientRect();
  return{x:r.left+r.width/2,y:r.top+r.height/2};
}
function boardRect(){return board.getBoundingClientRect();}
function boardTopCenter(){var r=boardRect();return{x:r.left+r.width/2,y:r.top+12};}
function boardCenter(){var r=boardRect();return{x:r.left+r.width/2,y:r.top+r.height/2};}
/* ================= pattern generation ================= */
var RECENT=[];
/* noRec (5th arg, set by versus specs): skip cross-round RECENT history
   influence AND skip recording into RECENT. Versus boards must be a PURE
   function of (size, count, seed) so the authoritative server derives the
   identical Set, and so a reconnect can rebuild the same board any number
   of times without drifting. Campaign/daily/mode calls pass nothing and
   behave exactly as before. */
function genPattern(size,count,rng,exclude,noRec){
  var cells=size*size,best=null,bestScore=-1e9;
  var pool=[],i2;
  for(i2=0;i2<cells;i2++)if(!(exclude&&exclude.indexOf(i2)>=0))pool.push(i2);
  count=clamp(count,1,pool.length-1);
  var tries=24,t,cand,i,j,tmp,score,k,x,y;
  for(t=0;t<tries;t++){
    var arr=pool.slice();
    for(i=arr.length-1;i>0;i--){j=(rng()*(i+1))|0;tmp=arr[i];arr[i]=arr[j];arr[j]=tmp;}
    cand=arr.slice(0,count).sort(function(a,b){return a-b;});
    score=0;
    var rows={},cols={},quad=[0,0,0,0];
    for(k=0;k<cand.length;k++){
      x=cand[k]%size;y=(cand[k]/size)|0;
      rows[y]=1;cols[x]=1;
      quad[(y<size/2?0:1)*2+(x<size/2?0:1)]++;
    }
    score+=(Object.keys(rows).length+Object.keys(cols).length)*3;
    var used=0;for(k=0;k<4;k++)if(quad[k]>0)used++;
    score+=used*8;
    var mx=Math.max.apply(null,quad),mn=Math.min.apply(null,quad);
    score-=(mx-mn)*4;
    var maxRow=0,maxCol=0,mm,rr,cc;
    for(k in rows){rr=0;for(mm=0;mm<cand.length;mm++)if(((cand[mm]/size)|0)===parseInt(k,10))rr++;if(rr>maxRow)maxRow=rr;}
    for(k in cols){cc=0;for(mm=0;mm<cand.length;mm++)if((cand[mm]%size)===parseInt(k,10))cc++;if(cc>maxCol)maxCol=cc;}
    score-=(maxRow+maxCol)*(count>=4?5:1);
    if(count>=4){
      var symH=true,symV=true,symR=true;
      for(k=0;k<cand.length;k++){
        x=cand[k]%size;y=(cand[k]/size)|0;
        if(cand.indexOf(y*size+(size-1-x))<0)symH=false;
        if(cand.indexOf((size-1-y)*size+x)<0)symV=false;
        if(cand.indexOf((size-1-y)*size+(size-1-x))<0)symR=false;
      }
      if(symH)score-=14;if(symV)score-=14;if(symR)score-=14;
    }
    if(count>=3){
      var diag=true;
      for(k=0;k<cand.length;k++){if((cand[k]%size)!==((cand[k]/size)|0)){diag=false;break;}}
      if(diag)score-=20;
    }
    if(!noRec){
      for(i=0;i<RECENT.length;i++){
        var ov=RECENT[i],sm=0;
        for(k=0;k<cand.length;k++)if(ov.indexOf(cand[k])>=0)sm++;
        if(sm===cand.length&&ov.length===cand.length)score-=140;
        score-=sm*(RECENT.length-i)*2;
      }
    }
    if(score>bestScore){bestScore=score;best=cand;}
  }
  if(!noRec){RECENT.push(best);if(RECENT.length>6)RECENT.shift();}
  return best;
}
function shiftMap(kind,s){
  return function(i){
    var c=i%s,r=(i/s)|0;
    if(kind==='mirrorH')return r*s+(s-1-c);
    if(kind==='mirrorV')return (s-1-r)*s+c;
    if(kind==='rot180')return (s-1-r)*s+(s-1-c);
    return c*s+(s-1-r);
  };
}
function shiftName(kind){
  if(kind==='mirrorH')return 'MIRRORED ↔';
  if(kind==='mirrorV')return 'FLIPPED ↕';
  if(kind==='rot180')return 'ROTATED 180°';
  return 'ROTATED ↻';
}
/* ================= HUD ================= */
var elScore=$('hud-score'),elLevel=$('hud-level'),obj=$('obj-text'),hearts=$('hearts'),
    prog=$('prog'),progFill=$('prog-fill'),hint=$('hint'),elMult=$('chip-mult'),
    chipShield=$('chip-shield'),chipPs=$('chip-ps'),psVal=$('ps-val'),
    objstrip=$('objstrip'),pubar=$('pubar'),bossbar=$('bossbar');
function bump(el){el.classList.remove('bump');void el.offsetWidth;el.classList.add('bump');}
function setScore(v){elScore.textContent=nf(v);bump(elScore);}
function multOf(c){
  if(c>=25)return 12;if(c>=20)return 10;if(c>=15)return 8;if(c>=12)return 6;
  if(c>=9)return 5;if(c>=6)return 4;if(c>=4)return 3;if(c>=2)return 2;return 1;
}
function updateHUD(){
  elLevel.textContent = (R.mode==='versus') ? (R.round + ' / ' + (window.MP&&MP.rounds?MP.rounds:3)) : pad2(R.mode==='campaign'?R.level:R.round);
  elMult.innerHTML='&times;'+multOf(R.combo);
  chipShield.classList.toggle('hidden',!R.shield);
  chipPs.classList.toggle('hidden',(R.pstreak||0)<1);
  psVal.textContent=R.pstreak||0;
}
var heartsShown=-1;
function renderHearts(){
  var h='',i,lost=(heartsShown>=0&&heartsShown>R.lives)?R.lives:-1;
  for(i=0;i<R.maxLives;i++)h+='<svg class="'+(i<R.lives?'':('off'+(i===lost?' lose':'')))+'" viewBox="0 0 24 24"><use href="#i-heart"/></svg>';
  hearts.innerHTML=h;
  hearts.classList.toggle('danger',R.lives===1);
  heartsShown=R.lives;
}
/* one soft coral vignette on a wrong tap */
function missFlash(){
  if(!S.fx)return;
  var f=$('miss-flash');if(!f)return;
  f.classList.remove('on');void f.offsetWidth;f.classList.add('on');
}
/* coach copy for the very first levels, then the classic prompts */
function coachOn(){return R.mode==='campaign'&&(S.clears||0)<2&&R.level<=2;}
function recallText(){
  var base=coachOn()?'Tap where they were!':'Your turn!';
  return base+'  '+(R.found||0)+' / '+(R.required||0);
}
function refreshRecallCounter(){
  if(R.phase!=='recall')return;
  if(obj.className.indexOf('go')>=0){setObj(recallText(),'go');return;}
  var t=obj.textContent;
  if(/\d+ \/ \d+\s*$/.test(t))obj.textContent=t.replace(/\d+ \/ \d+\s*$/,(R.found||0)+' / '+(R.required||0));
}
function setObj(txt,cls){obj.textContent=txt;obj.className='obj-text'+(cls?' '+cls:'');}
function setHint(txt){hint.textContent=txt||'';}
function setProg(p,go){
  progFill.style.width=(clamp(p,0,1)*100)+'%';
  prog.classList.toggle('go',!!go);
}
function objStrings(cfg){
  return [
    {k:'Clear the level',p:'CLEAR'},
    {k:'Accuracy '+cfg.accT+'% or better',p:cfg.accT+'% ACC'},
    {k:'Recall under '+cfg.parSec+'s',p:'&lt;'+cfg.parSec+'s'},
    {k:'Reach &times;'+cfg.comboT+' combo',p:'&times;'+cfg.comboT}
  ];
}
function renderObjStrip(){
  if(!(R.mode==='campaign'&&unlocked('mastery')&&S.showObj&&R.cfg)){objstrip.classList.add('hidden');return;}
  objstrip.classList.remove('hidden');
  var o=objStrings(R.cfg),d=lvData(R.level),h='',i,ico=['check','target','gauge','bolt'];
  for(i=0;i<4;i++)h+='<span class="os'+(d[i]?' done':'')+'" data-o="'+i+'"><svg class="ic"><use href="#i-'+ico[i]+'"/></svg><span>'+o[i].p+'</span></span>';
  objstrip.innerHTML=h;
}
function markObj(i,quiet){
  if(R.mode!=='campaign'||!unlocked('mastery')||!R.cfg)return;
  var d=lvData(R.level);
  if(d.ob[i])return;
  d.ob[i]=true;saveKey('lv');
  renderObjStrip();
  if(!quiet){
    A.star(1);
    var el=objstrip.querySelector('[data-o="'+i+'"]');
    if(el){
      var st=el.getBoundingClientRect();
      FX.burst(st.left+st.width/2,st.top+8,{n:7,colors:['#57CB6C','#FFFFFF'],sp:2.6,size:4,shapes:['c','s']});
    }
  }
  if(d.ob[0]&&d.ob[1]&&d.ob[2]&&d.ob[3]&&!d.mbadge){
    d.mbadge=1;saveKey('lv');               /* recorded quietly — the mastery system reveals at Level 5 */
    if(unlocked('mastery')){
      addTok(15);
      toast('medal','yellow','LEVEL MASTERED!','Level '+R.level+' — all objectives complete');
      A.ach();
      FX.fountain(boardCenter().x,boardCenter().y,26);
    }
  }
}
function buildBossBar(phases){
  var t=$('bb-track'),h='',i;
  for(i=0;i<phases;i++)h+='<span class="bb-seg" data-s="'+i+'"><i></i></span>';
  t.innerHTML=h;
  bossbar.classList.remove('hidden');
}
function setBossPhase(p,phases,name){
  $('bb-phase').textContent='PHASE '+(p+1)+' / '+phases;
  $('bb-name').textContent=name;
}
function fillBossSeg(i){
  var s=bossbar.querySelector('[data-s="'+i+'"]');
  if(!s)return;
  s.querySelector('i').style.width='100%';
  s.classList.add('full');
}
function hideBossBar(){bossbar.classList.add('hidden');}
/* ================= power-up bar ================= */
function renderPuBar(){
  if(!(unlocked('powerups')&&R.mode!=='daily'&&R.mode!=='versus'&&S.pweq.length)){pubar.classList.add('hidden');return;}
  var h='',i;
  for(i=0;i<S.pweq.length;i++){
    var p=pwById(S.pweq[i]),n=pwCount(p.id);
    h+='<button class="pubtn'+(n<=0?' low':'')+'" data-pu="'+p.id+'"><span class="pu-ic" style="background:var(--'+p.tone+');box-shadow:0 3px 0 var(--'+p.tone+'-edge)"><svg class="ic"><use href="#i-'+p.ic+'"/></svg></span>'+
      '<span><b>'+p.name+'</b><span id="pu-st-'+p.id+'">'+(p.kind==='active'?'Ready ('+n+')':'Active')+'</span></span>'+
      '<span class="pu-n'+(n<=0?' zero':'')+'">'+n+'</span></button>';
  }
  pubar.innerHTML=h;
  pubar.classList.remove('hidden');
}
function updatePuStates(){
  if(pubar.classList.contains('hidden'))return;
  for(var i=0;i<S.pweq.length;i++){
    var id=S.pweq[i],btn=pubar.querySelector('[data-pu="'+id+'"]'),p=pwById(id),st=$('pu-st-'+id);
    if(!btn)continue;
    if(p.kind==='active'){
      var used=R.puUsed&&R.puUsed[id];
      btn.classList.toggle('spent',!!used||pwCount(id)<=0);
      if(st)st.textContent=used?'Used':(pwCount(id)>0?'Ready ('+pwCount(id)+')':'Empty');
    }else if(st)st.textContent='Active';
  }
}
function usePowerUp(id){
  var p=pwById(id);
  if(R.mode==='versus')return;                    /* boosters stay single-player only */
  if(!R.active||R.over||p.kind!=='active')return;
  if(!R.puUsed)R.puUsed={};
  if(R.puUsed[id])return;
  if(pwCount(id)<=0){toast('lock','coral','None left','Earn more power-ups in the Vault');return;}
  if(R.phase!=='reveal'&&R.phase!=='recall'&&R.phase!=='stagger'){toast('warn','coral','Not now','Power-ups work during a round');return;}
  S.pw[id]=pwCount(id)-1;saveKey('pw');
  R.puUsed[id]=1;
  var btn=pubar.querySelector('[data-pu="'+id+'"]');
  if(btn)btn.classList.add('spent','flash');
  if(id==='reveal'){
    if(R.phase==='recall'&&R.waves.length){
      var i,j,els=[];
      for(i=0;i<R.waves.length;i++)for(j=0;j<R.waves[i].tiles.length;j++){
        var idx=R.waves[i].tiles[j];
        if(idx==null||R.sel[idx])continue;
        setTile(idx,'hl warn lock');els.push(idx);
      }
      setObj('Reveal!','warn');A.star(1);
      setTimeout(function(){
        for(var k=0;k<els.length;k++)if(!R.sel[els[k]])setTile(els[k],'lock');
        if(R.phase==='recall')setObj(recallText(),'go');
      },900);
    }else{
      R.pStart-=900;
      setObj('Reveal!','warn');
    }
  }else if(id==='slow'){
    R.pStart-=1400;
    setObj('Slow time…','warn');
  }else if(id==='hint'){
    if(R.phase==='recall'&&R.waves.length){
      var q=null,i2,j2,ix;
      for(i2=0;i2<R.waves.length&&q==null;i2++)
        for(j2=0;j2<R.waves[i2].tiles.length;j2++){
          ix=R.waves[i2].tiles[j2];
          if(ix!=null&&!R.sel[ix]){q=ix;break;}
        }
      if(q==null){toast('check','green','Nothing left','You already found every tile');}
      else{
        setTile(q,'hl warn lock');A.star(1);setObj('Hint!','warn');
        setTimeout(function(){if(!R.sel[q])setTile(q,'lock');if(R.phase==='recall')setObj(recallText(),'go');},1000);
      }
    }else{
      R.pStart-=700;
      setObj('Look closer…','warn');
    }
  }
  updatePuStates();
  toast(p.ic,p.tone,p.name+' used',pwCount(id)+' left');
}
/* ================= round building ================= */
function newSeed(){S.seed=(S.seed*1103515245+12345)%2147483647;if(S.seed<0)S.seed=-S.seed;saveKey('seed');return S.seed;}
function buildRound(spec,seed){
  var rng=mulberry32(seed>>>0);
  var size=spec.size,cells=size*size,wi,waves=[],used=[];
  var tilesCount = spec.tiles != null ? spec.tiles : (spec.count != null ? spec.count : 3);
  var total=clamp(tilesCount,2,cells-2);
  var waveDur = spec.dur || spec.reveal || 1680;
  var wavesIn=spec.waves||1;
  var per=Math.max(2,Math.round(total/wavesIn));
  for(wi=0;wi<wavesIn;wi++){
    var n=(wi===wavesIn-1)?Math.max(2,total-per*(wavesIn-1)):per;
    var free=cells-used.length;
    if(free<2)break;
    n=clamp(n,2,free-1);
    var t=genPattern(size,n,rng,used,!!spec.noRecent);
    used=used.concat(t);
    var dcs=[];
    if(spec.decoy){
      var pool=[],i2;
      for(i2=0;i2<cells;i2++)if(used.indexOf(i2)<0&&rng()<0.5)pool.push(i2);
      for(i2=pool.length-1;i2>0;i2--){var j2=(rng()*(i2+1))|0,tmp=pool[i2];pool[i2]=pool[j2];pool[j2]=tmp;}
      dcs=pool.slice(0,clamp(spec.decoy,0,cells-used.length-1));
      used=used.concat(dcs);
    }
    waves.push({tiles:t,decoys:dcs,dur:waveDur});
  }
  return {rng:rng,size:size,waves:waves};
}
/* ================= start run ================= */
function equipList(){return unlocked('powerups')?S.pweq.slice(0,2):[];}
function startRun(opts){
  opts=opts||{};
  if(window.MP&&MP.active){mpLeave(false);}          /* entering single-player always closes any versus match */
  var continuing=R.active&&R.mode===opts.mode&&R.level===opts.level&&!!opts.cont;
  var wasRun=R.active;
  RECENT=[];
  R.active=true;R.paused=false;R.over=false;R.phase='idle';
  R.mode=opts.mode||'campaign';
  try{if(window.MU)MU.setScene('play');}catch(e){}
  if(R.mode!=='campaign')R.cfg=null;
  R.score=0;R.combo=0;R.bestCombo=0;R.cleared=0;R.misses=0;R.tapTimes=[];R.revived=false;R.reviveOffered=false;
  R.recs={};R.puUsed={};R.bonusDrought=0;R.hazardIdx=-1;R.hazards=0;R.orderAll=[];R.orderBase=[];R.shield=false;R.shieldUsed=false;R.timeBoost=false;
  R.round=opts.round||1;
  R.dailyRound=0;R.dailyScore=0;R.bossWon=false;
  R.quickStart=!!opts.quick;heartsShown=-1;
  R.level=(R.mode==='campaign')?(opts.level||S.maxlvl):1;
  if(R.mode==='daily'){R.daily=opts.daily||dailySpec();R.maxLives=R.daily.lives;
    R.dailyModDouble=R.daily.mods.some(function(m){return m.id==='double';});}
  else if(R.mode==='endurance')R.maxLives=5;
  else if(R.mode==='perfect')R.maxLives=1;
  else R.maxLives=3;
  if(R.mode==='campaign'){
    R.pstreak=S.pstreak||0;
    if(unlocked('powerups')&&equipList().indexOf('heart')>=0&&pwCount('heart')>0){
      R.maxLives++;S.pw.heart=pwCount('heart')-1;saveKey('pw');
    }
  }else R.pstreak=0;
  R.lives=R.maxLives;
  if(R.mode==='campaign'&&unlocked('powerups')&&equipList().indexOf('time')>=0&&pwCount('time')>0){
    R.timeBoost=true;S.pw.time=pwCount('time')-1;saveKey('pw');
    setTimeout(function(){toast('clock','sky','Time Boost active','+25% reveal time this run');},1100);
  }
  if(R.mode==='campaign'&&unlocked('powerups')&&equipList().indexOf('second')>=0&&pwCount('second')>0){
    R.shield=true;S.pw.second=pwCount('second')-1;saveKey('pw');
    setTimeout(function(){toast('shield','sky','Second Chance active','Your next mistake is cancelled');},900);
  }
  if(!continuing&&!wasRun){S.games++;saveKey('games');}
  setScore(0);renderHearts();
  showScreen('game');
  applyWorldCtx();
  renderPuBar();updatePuStates();updateHUD();
  if(R.mode==='campaign'){
    $('hud-lvl-lbl').textContent='Level';
    startLevel(R.level,opts.bossWarn!==false);
  }else{
    $('hud-lvl-lbl').textContent='Round';
    startModeRound();
  }
}
/* -------- campaign -------- */
function startLevel(l,withWarn){
  var cfg=levelCfg(l);
  R.level=l;R.cfg=cfg;R.missThisLevel=0;R.hits=0;R.taps=0;R.tapTimes=[];
  R.decoysFound=0;R.hazards=0;R.hazardIdx=-1;R.levelTokens=0;
  R.shieldBroken=false;
  if(cfg.boss){
    R.bossPhase=0;R.bossPhases=3;R.bossWon=false;
    buildBossBar(3);setBossPhase(0,3,cfg.boss.name);
  }else hideBossBar();
  if(typeof applyWorldCtx==='function')applyWorldCtx();
  renderObjStrip();
  fxLevelStart();
  if(cfg.boss&&withWarn)showBossWarn(cfg.boss,buildRoundForLevel);
  else buildRoundForLevel();
}
function adaptFactor(l){
  if(!S.adapt)return 1;
  var f=(l>0&&S.fails[l])||0;
  var b=Math.min(2,Math.floor(f/2))*0.13;
  var trim=Math.min(0.05,((S.pclear||0)+(S.bpl||0))*0.004);
  return 1+b-trim;
}
function phaseSpec(cfg,phase){
  var t=cfg.tiles,name=cfg.boss?cfg.boss.name:'',spec;
  spec={size:cfg.size,tiles:t,dur:cfg.dur,order:cfg.order,waves:cfg.waves||1,decoy:cfg.decoy,
    flash:cfg.flash,vanish:cfg.vanish,shuffle:cfg.shuffle,hazard:cfg.hazard,bonus:true};
  if(!cfg.boss)return spec;
  var timeMul;
  if(phase===1){spec.tiles=Math.max(3,Math.round(t*0.42));timeMul=1.02;}
  else if(phase===2){spec.tiles=Math.max(4,Math.round(t*0.5));timeMul=0.92;}
  else{spec.tiles=Math.max(5,Math.round(t*0.6));timeMul=0.84;}
  spec.order=null;spec.waves=1;spec.decoy=0;spec.vanish=false;spec.shuffle=false;spec.hazard=false;spec.flash=false;
  if(name==='MEMORY LOCK')spec.order='fwd';
  else if(name==='DOUBLE PATTERN')spec.waves=phase>=2?2:1;
  else if(name==='DISAPPEARING MATRIX')spec.vanish=(phase>=2);
  else if(name==='REVERSE RECALL')spec.order=(phase>=2?'rev':'fwd');
  else if(name==='THE MEMORY CORE'){
    if(phase===1){spec.order='fwd';}
    else if(phase===2){spec.waves=2;spec.shuffle=true;spec.tiles=Math.max(5,Math.round(t*0.52));}
    else{spec.waves=2;spec.order='rev';spec.vanish=true;spec.shuffle=true;spec.hazard=true;spec.tiles=Math.max(6,Math.round(t*0.5));}
  }
  /* ---- expansion bosses ---- */
  else if(name==='OVERLOAD'){
    if(phase===2)spec.flash=true;
    else if(phase===3){spec.flash=true;spec.order='fwd';}
  }
  else if(name==='NEON SCRAMBLER'){
    if(phase===2)spec.shuffle=true;
    else if(phase===3){spec.shuffle=true;spec.order='fwd';spec.decoy=4;}
  }
  else if(name==='EMBER GUARD'){
    if(phase===2)spec.hazard=true;
    else if(phase===3){spec.hazard=true;spec.decoy=5;}
  }
  else if(name==='MAGMA TITAN'){
    if(phase===2)spec.waves=2;
    else if(phase===3)spec.waves=3;
  }
  else if(name==='THUNDER PEAK'){
    if(phase===2)spec.flash=true;
    else if(phase===3){spec.flash=true;spec.order='fwd';spec.hazard=true;}
  }
  else if(name==='STORM SEQUENCE'){
    if(phase===1)spec.waves=2;
    else if(phase===2)spec.waves=3;
    else{spec.waves=3;spec.order='fwd';}
  }
  else if(name==='CANOPY TRAP'){
    if(phase===2)spec.vanish=true;
    else if(phase===3){spec.vanish=true;spec.decoy=5;}
  }
  else if(name==='VINE TANGLE'){
    if(phase===2)spec.shuffle=true;
    else if(phase===3){spec.shuffle=true;spec.vanish=true;spec.hazard=true;}
  }
  else if(name==='DARK MATTER'){
    if(phase===2)spec.order='rev';
    else if(phase===3){spec.order='rev';spec.vanish=true;}
  }
  else if(name==='SUPERNOVA'){
    if(phase===2){spec.waves=2;spec.shuffle=true;}
    else if(phase===3){spec.waves=3;spec.order='rev';spec.hazard=true;}
  }
  else if(name==='ECHO CHAMBER'){
    if(phase===2)spec.order='rev';
    else if(phase===3){spec.order='rev';spec.shuffle=true;spec.vanish=true;}
  }
  else if(name==='TIME NEXUS'){
    if(phase===1){spec.order='fwd';}
    else if(phase===2){spec.waves=3;spec.shuffle=true;spec.tiles=Math.max(6,Math.round(t*0.55));}
    else{spec.waves=3;spec.order='rev';spec.vanish=true;spec.shuffle=true;spec.hazard=true;spec.decoy=6;spec.tiles=Math.max(7,Math.round(t*0.52));}
  }else{
    if(phase===3){spec.order='rev';spec.shuffle=true;}
    else if(phase===2)spec.shuffle=false;
  }
  spec.dur=Math.round(spec.tiles*cfg.perTile*timeMul);
  /* late-world bosses would otherwise show 30+ tiles for two seconds —
     keep a sane minimum reading time per tile */
  var floorMs=Math.round(spec.tiles*PACE.phaseFloor*timeMul);
  if(spec.dur<floorMs)spec.dur=floorMs;
  return spec;
}
function buildRoundForLevel(){
  var cfg=R.cfg,spec=(cfg.boss)?phaseSpec(cfg,R.bossPhase):{
    size:cfg.size,tiles:cfg.tiles,dur:Math.round(cfg.dur*adaptFactor(R.level)),order:cfg.order,
    waves:cfg.waves||1,decoy:cfg.decoy,flash:cfg.flash,vanish:cfg.vanish,shuffle:cfg.shuffle,hazard:cfg.hazard,bonus:true};
  if(cfg.boss)spec.dur=Math.round(spec.dur*adaptFactor(R.level));
  if(R.timeBoost)spec.dur=Math.round(spec.dur*1.25);     /* Time Boost booster */
  spec.bonus=true;                    /* the rarity roll happens inside beginRound */
  beginRound(spec,newSeed());
}
/* -------- modes -------- */
function modeSpec(round){
  var m=R.mode,i,size=clamp(3+Math.floor((round-1)/4),3,9);
  var tiles=clamp(2+Math.round(round*0.7)+Math.floor(round/5),2,Math.floor(size*size*0.5));
  var perTile=TBASE[Math.min(4,Math.floor((round-1)/8))]*(1-Math.min(0.3,((round-1)%8)*0.03));
  if(m==='speed')perTile*=0.6;
  var spec={size:size,tiles:tiles,dur:Math.round(tiles*perTile),order:null,waves:1,decoy:0,flash:false,
    vanish:false,shuffle:false,hazard:false,bonus:true};
  if(m==='reverse')spec.order='rev';
  if(m==='chaos'){
    spec.shuffle=(round>=2&&round%2===0);
    spec.hazard=(round>=3&&round%3===0);
    spec.waves=(round>=5&&round%5===0)?2:1;
    spec.decoy=(round>=6&&round%4===0)?3:0;
  }
  if(m==='endurance'){
    if(round>=8&&round%3===0)spec.order='rev';
    if(round>=12&&round%4===0)spec.waves=2;
  }
  spec.dur=Math.round(spec.dur*adaptFactor(-1));
  return spec;
}
function startModeRound(){
  if(R.mode==='daily')R.round=Math.min(5,R.dailyRound+1);
  var spec=(R.mode==='daily')?dailyRoundSpec(R.dailyRound):modeSpec(R.round);
  var seed=(R.mode==='daily')?(R.daily.seed+R.dailyRound*977):newSeed();
  beginRound(spec,seed);
}
/* -------- daily -------- */
function todayKey(){
  var d=new Date();
  return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate());
}
function dailySpec(){
  var key=todayKey(),h=hashStr(key),rng=mulberry32(h),mods=[];
  var pool=[
    {id:'nomiss',name:'No Mistakes',ic:'heart'},
    {id:'reverse',name:'Reverse Order',ic:'reverse'},
    {id:'short',name:'Short Reveal',ic:'eye'},
    {id:'large',name:'Large Pattern',ic:'grid'},
    {id:'speedrun',name:'Speed Challenge',ic:'clock'},
    {id:'double',name:'Double Score',ic:'spark'},
    {id:'hearts',name:'Limited Hearts',ic:'shield'}
  ];
  var a=(rng()*pool.length)|0,b=(rng()*pool.length)|0;
  mods.push(pool[a]);
  if(b!==a)mods.push(pool[b]);
  var lives=4,i;
  for(i=0;i<mods.length;i++){
    if(mods[i].id==='nomiss')lives-=2;
    if(mods[i].id==='hearts')lives-=2;
  }
  lives=Math.max(1,Math.min(4,lives));
  return {key:key,seed:h,mods:mods,lives:lives,rounds:5};
}
function dailyRoundSpec(i){
  var d=R.daily,rng=mulberry32((d.seed+i*7919)>>>0);
  var size=[4,5,5,6,6][i]||6;
  var tiles=clamp(Math.round(4+i*2.1+rng()*2),3,Math.floor(size*size*0.5));
  var perTile=TBASE[Math.min(4,Math.floor(i/2)+1)]*(1-i*0.02);
  var spec={size:size,tiles:tiles,dur:Math.round(tiles*perTile),order:null,waves:1,decoy:0,flash:false,
    vanish:false,shuffle:false,hazard:false,bonus:true};
  if(i>=2&&rng()<0.5)spec.order=(rng()<0.5?'fwd':'rev');
  if(i>=3&&rng()<0.45)spec.waves=2;
  if(i>=3&&rng()<0.3)spec.decoy=3;
  if(i>=4&&rng()<0.3)spec.vanish=true;
  for(var k=0;k<d.mods.length;k++){
    var id=d.mods[k].id;
    if(id==='reverse')spec.order='rev';
    if(id==='short')spec.dur=Math.round(spec.dur*0.66);
    if(id==='large')spec.tiles=clamp(Math.round(spec.tiles*1.35),3,Math.floor(size*size*0.55));
    if(id==='speedrun')spec.recallLimit=Math.round(spec.tiles*1.6*1000)+2500;
  }
  return spec;
}
/* ================= round engine ================= */
function beginRound(spec,seed){
  clrT();
  R.spec=spec;
  R.sel={};R.decoySel={};R.found=0;R.required=0;R.ordQ=0;R.strayTaps=0;R.lastHit=null;
  R.mapFn=null;R.shiftKind=null;R.hazardIdx=-1;R.hazardSpawned=false;R.recallTimerStarted=false;
  R.puUsed=R.puUsed||{};
  R.phase='prep';
  setObj('Get ready\u2026','');setHint('');
  buildGridIfNeeded(spec.size);
  resetBoard();lockAll(true);
  var built=buildRound(spec,seed);
  R.size=spec.size;R.waves=built.waves;R.totalWaves=built.waves.length;
  var i,j;
  for(i=0;i<R.waves.length;i++)R.required+=R.waves[i].tiles.length;
  R.waveIdx=0;
  R.orderAll=[];R.orderBase=[];
  var base=0;
  for(i=0;i<R.waves.length;i++){
    R.orderBase.push(base);
    var seq=R.waves[i].tiles.slice();
    if(spec.order==='rev')seq.reverse();
    R.orderAll=R.orderAll.concat(seq);
    base+=R.waves[i].tiles.length;
  }
  R.requiredMap={};R.decoyMap={};
  for(i=0;i<R.waves.length;i++){
    for(j=0;j<R.waves[i].tiles.length;j++)R.requiredMap[R.waves[i].tiles[j]]=i+1;
    for(j=0;j<R.waves[i].decoys.length;j++)R.decoyMap[R.waves[i].decoys[j]]=1;
  }
  if(spec.shuffle){
    var kinds=['mirrorH','mirrorV','rot90','rot180'];
    R.shiftKind=kinds[(seed>>>3)%4];
    R.mapFn=shiftMap(R.shiftKind,R.size);
    var w,x,nt,nd;
    for(w=0;w<R.waves.length;w++){
      nt=[];for(x=0;x<R.waves[w].tiles.length;x++)nt.push(R.mapFn(R.waves[w].tiles[x]));
      nd=[];for(x=0;x<R.waves[w].decoys.length;x++)nd.push(R.mapFn(R.waves[w].decoys[x]));
      R.waves[w].tiles=nt;R.waves[w].decoys=nd;
    }
    for(x=0;x<R.orderAll.length;x++)R.orderAll[x]=R.mapFn(R.orderAll[x]);
    R.requiredMap={};R.decoyMap={};
    for(i=0;i<R.waves.length;i++){
      for(j=0;j<R.waves[i].tiles.length;j++)R.requiredMap[R.waves[i].tiles[j]]=i+1;
      for(j=0;j<R.waves[i].decoys.length;j++)R.decoyMap[R.waves[i].decoys[j]]=1;
    }
  }
  R.bonusIdx=-1;
  /* rare mystery tile — roughly one round in six, and never more than a few rounds apart */
  var drought=(R.bonusDrought||0),roll;
  if(spec.bonus&&spec.tiles>=4){
    roll=(drought>=7)?1:mulberry32((seed^0x51ed270b)>>>0)();
    if(roll<0.18){
      var all=[];
      for(i=0;i<R.waves.length;i++)for(j=0;j<R.waves[i].tiles.length;j++)all.push(R.waves[i].tiles[j]);
      R.bonusIdx=all[(seed>>>5)%all.length];
    }
  }
  R.bonusDrought=(R.bonusIdx>=0)?0:drought+1;
  updateHUD();renderHearts();setProg(0,false);setHint('');
  var quick=!!R.quickStart;R.quickStart=false;
  if(R.mode==='campaign')banner(R.cfg&&R.cfg.boss?'warn':'lv',R.cfg&&R.cfg.boss?'warn':null,R.cfg&&R.cfg.boss?('BOSS PHASE '+(R.bossPhase+1)):('Level '+R.level),(R.cfg&&R.cfg.boss)?1150:(quick?700:900));
  else if(R.mode==='daily')banner('lv',null,'Daily Round '+(R.dailyRound+1)+' / 5',900);
  else if(R.mode==='versus'){ /* online versus starts reveal immediately without blocking modal */ }
  else banner('lv',null,'Round '+R.round,850);
  A.tap();
  Plat.gameplayStart();
  var wait=(R.mode==='versus')?40:((R.mode==='campaign'&&R.cfg&&R.cfg.boss)?980:(quick?520:760));
  TT.a=setTimeout(function(){startWave(0);},wait);
}
function buildGridIfNeeded(sz){
  if(R.gridSize!==sz)buildGrid(sz);
  fitBoard();
}
function startWave(k){
  if(!R.active||R.over||R.paused)return;
  R.waveIdx=k;R.phase='stagger';R.stag=[];
  var w=R.waves[k],n=w.tiles.length,i,stg;
  var isOrder=!!R.spec.order;
  stg=R.spec.flash?0:clamp(74-n*2,24,74);
  setObj(R.totalWaves>1?('Memorize — pattern '+(k+1)+' of '+R.totalWaves+'!'):(coachOn()?'Watch the yellow tiles!':'Memorize!'),'warn');
  setHint(isOrder?(R.spec.order==='rev'?'Numbers show the order — you must tap BACKWARDS.':'Numbers show the tap order.'):
    (R.totalWaves>1?'Both patterns will be recalled together.':(coachOn()?'Remember where they light up — they will hide soon.':'')));
  var base=R.orderBase[k]||0;
  for(i=0;i<n;i++){
    (function(idx,delay,ord){
      if(R.spec.flash){
        var el=tileAt(idx);
        if(el){el.className='tile hl lock flashIn';if(isOrder)el.firstChild.textContent=ord;}
        A.show();
        var p=tileCenter(idx);
        FX.burst(p.x,p.y,{n:3,colors:['#FFC93C','#FFE29A','#FFFFFF'],sp:1.4,size:3,g:.05,shapes:['c','s']});
      }else{
        R.stag.push(setTimeout(function(){
          var e2=tileAt(idx);
          if(!e2)return;
          e2.className='tile hl lock';
          if(isOrder)e2.firstChild.textContent=ord;
          A.show();
          var p2=tileCenter(idx);
          FX.burst(p2.x,p2.y,{n:4,colors:['#FFC93C','#FFE29A','#FFFFFF'],sp:1.6,size:3.5,g:.05,shapes:['c','s']});
        },delay));
      }
    })(w.tiles[i],i*stg,(isOrder?base+i+1:''));
  }
  var dly=R.spec.flash?280:(n*stg+Math.max(120,R.spec.dur*0.26));
  if(w.decoys.length){
    R.stag.push(setTimeout(function(){
      for(var d=0;d<w.decoys.length;d++){
        var el2=tileAt(w.decoys[d]);
        if(el2){el2.className='tile decoy lock';A.show();}
      }
      setHint('Decoys light up too — recalling them later is bonus score.');
    },dly));
  }
  R.stag.push(setTimeout(function(){
    if(!R.active||R.over)return;
    if(R.spec.vanish){
      var vn=Math.max(1,Math.ceil(n/3));
      for(var v=0;v<vn;v++){
        (function(idx,dd){
          R.stag.push(setTimeout(function(){
            var el3=tileAt(idx);
            if(el3&&el3.className.indexOf('hl')>=0){
              el3.className='tile vanish lock';
              var p3=tileCenter(idx);
              FX.burst(p3.x,p3.y,{n:5,colors:['#CBD7EA','#FFFFFF'],sp:1.8,size:3.4,g:.04,shapes:['c']});
              A.show();
            }
          },dd));
        })(w.tiles[n-1-v],v*150);
      }
    }
    R.phase='reveal';
    var dur = (R.mode === 'versus') ? Math.max(600, (w.dur || 1680) - (n * stg) - 40) : w.dur;
    runPreviewTimer(dur);
  },R.spec.flash?160:(n*stg)));
}
function runPreviewTimer(dur){
  R.pDur=dur;R.pStart=performance.now();
  if(R.raf)cancelAnimationFrame(R.raf);
  var step=function(){
    if(R.phase!=='reveal'||R.paused||!R.active){R.raf=0;return;}
    var e=performance.now()-R.pStart;
    var p=Math.max(0,1-e/R.pDur);
    setProg(p,false);
    if(p<=0){R.raf=0;hidePattern();return;}
    R.raf=requestAnimationFrame(step);
  };
  R.raf=requestAnimationFrame(step);
}
function hidePattern(){
  if(R.phase!=='reveal')return;
  var i,j,w;
  for(i=0;i<R.waves.length;i++){
    w=R.waves[i];
    for(j=0;j<w.tiles.length;j++)if(!R.sel[w.tiles[j]])setTile(w.tiles[j],'lock');
    for(j=0;j<w.decoys.length;j++)if(!R.decoySel[w.decoys[j]])setTile(w.decoys[j],'lock');
  }
  if(R.spec.shuffle&&R.waveIdx===R.totalWaves-1){doBoardShift();return;}
  if(R.waveIdx<R.totalWaves-1){
    R.phase='gap';
    setObj('Pattern '+(R.waveIdx+1)+' locked in…','warn');
    setProg(0,false);
    TT.a=setTimeout(function(){startWave(R.waveIdx+1);},480);
    return;
  }
  startRecall();
}
function doBoardShift(){
  R.phase='gap';
  setObj('BOARD '+shiftName(R.shiftKind),'warn');
  setHint('Your pattern moved with the board — adjust before tapping!');
  A.warn();
  board.classList.add('shuffling');
  grid.style.transition='transform .34s ease';
  grid.style.transform=(R.shiftKind==='mirrorH')?'scaleX(-1) scale(.94)':(R.shiftKind==='mirrorV'?'scaleY(-1) scale(.94)':'rotate(90deg) scale(.94)');
  TT.a=setTimeout(function(){
    grid.style.transform='none';
    board.classList.remove('shuffling');
    FX.burst(boardCenter().x,boardCenter().y,{n:12,colors:['#4CB9F2','#FFFFFF','#8B98BC'],sp:3,size:4,shapes:['r','c']});
    TT.a=setTimeout(function(){
      if(!R.active||R.over)return;
      startRecall();
    },420);
  },380);
}
function startRecall(){
  R.phase='recall';
  lockAll(false);
  setObj(recallText(),'go');
  R.recallStart=performance.now();R.lastTap=performance.now();
  setProg(0,true);
  A.tap();
  var h=[];
  if(R.spec.order)h.push(R.spec.order==='rev'?'Tap the pattern BACKWARDS':'Tap in the shown order');
  if(R.spec.shuffle)h.push('Board '+shiftName(R.shiftKind).toLowerCase());
  if(R.spec.recallLimit && R.mode !== 'versus'){h.push('Beat the clock!');startRecallTimer();}
  if(!h.length&&coachOn())h.push('Any order works — tap every tile that lit up');
  setHint(h.join('  •  '));
  if(R.spec.hazard&&!R.hazardSpawned){
    R.hazardSpawned=true;
    setTimeout(function(){if(R.active&&!R.over&&R.phase==='recall')spawnHazard();},900);
  }
}
function startRecallTimer(){
  R.recallEnds=performance.now()+R.spec.recallLimit;
  var step=function(){
    if(R.phase!=='recall'||R.paused||!R.active){R.raf2=0;return;}
    var left=R.recallEnds-performance.now();
    if(left<=0){
      R.raf2=0;
      timeUp();
      return;
    }
    setProg(left/R.spec.recallLimit,true);
    R.raf2=requestAnimationFrame(step);
  };
  R.raf2=requestAnimationFrame(step);
}
function timeUp(){
  if(window.MP&&MP.active)return;              /* versus rounds are server-timed — a local clock-up must never interrupt match flow */
  if(R.phase!=='recall')return;
  var i,j,w,missed=[];
  for(i=0;i<R.waves.length;i++){
    w=R.waves[i];
    for(j=0;j<w.tiles.length;j++)if(!R.sel[w.tiles[j]])missed.push(w.tiles[j]);
  }
  R.combo=0;R.misses=(R.misses||0)+1;
  R.noMiss=false;R.lives--;renderHearts();updateHUD();
  A.bad();vib([40,40,40]);
  banner('warn','clock','Time up!','1100');
  for(i=0;i<missed.length;i++)setTile(missed[i],'warn lock');
  if(R.lives<=0){setObj('Out of time!','bad');TT.a=setTimeout(function(){levelFailed('The clock beat you.');},900);return;}
  setObj('Time up — watch the pattern!','bad');
  setProg(0,false);
  R.phase='gap';
  TT.a=setTimeout(function(){
    if(!R.active||R.over)return;
    R.spec.recallLimit=0;
    startWave(0);
  },1300);
}
function spawnHazard(){
  var cells=R.size*R.size,idx=-1,tries=0;
  while(tries++<40){
    idx=(Math.random()*cells)|0;
    if(!R.requiredMap[idx]&&!R.decoyMap[idx]&&!R.sel[idx])break;
  }
  if(idx<0||R.requiredMap[idx])return;
  R.hazardIdx=idx;R.hazards++;
  var el=tileAt(idx);
  if(!el)return;
  el.className='tile hazard lock';
  var p=tileCenter(idx);
  FX.burst(p.x,p.y,{n:7,colors:['#FF6B6B','#FFD1D1'],sp:2.4,size:4,shapes:['c','r']});
  A.warn();
  setObj('DANGER TILE — do not tap!','bad');
  TT.b=setTimeout(function(){
    if(!R.active||R.over)return;
    if(R.hazardIdx===idx){
      R.hazardIdx=-1;
      if(!R.sel[idx]&&!R.decoySel[idx])setTile(idx,'lock');
      R.score+=40;setScore(R.score);
      FX.text(p.x,p.y-16,'AVOIDED +40','#2E92D1',14);
    }
    if(R.phase==='recall')setObj(recallText(),'go');
  },1500);
}
/* real miss handling — returns true when it cost a life */
function missTile(i){
  var el=tileAt(i);
  if(el)el.className='tile no';
  var p=tileCenter(i);
  board.classList.remove('shake');void board.offsetWidth;board.classList.add('shake');
  A.bad();vib([45,40,45]);
  missFlash();
  FX.burst(p.x,p.y,{n:10,colors:['#FF6B6B','#FF9E9E','#FFD1D1'],sp:3,shapes:['c','r']});
  FX.burst(p.x,p.y,{n:1,colors:['#FF6B6B'],sp:.4,g:0,size:7,shapes:['o']});
  R.combo=0;
  R.noMiss=false;
  if(R.mode==='campaign'){R.missThisLevel++;R.pstreak=0;S.pstreak=0;saveKey('pstreak');}
  updateHUD();
  if(R.shield&&!R.shieldUsed){
    R.shieldUsed=true;R.shield=false;
    updateHUD();
    banner('warn','shield','FOCUS SHIELD BROKEN!',1200);
    toast('shield','sky','Shield absorbed it','Your combo survives');
    FX.burst(p.x,p.y,{n:16,colors:['#4CB9F2','#FFFFFF'],sp:4,size:5,shapes:['s','c']});
    return false;
  }
  S.wrong++;saveKey('wrong');
  if(R.mode==='campaign'){}else R.misses=(R.misses||0)+1;
  R.lives--;renderHearts();
  if(R.lives===1)banner('warn','heart','Last heart!',1200);
  return true;
}
function handleTap(i){
  if(window.MP&&MP.active){mpHandleTap(i);return;} /* online versus owns the board while a match runs */
  if(R.phase!=='recall'||R.paused||!R.active||R.over)return;
  if(R.sel[i]||R.decoySel[i])return;
  var t=performance.now();
  R.taps++;
  var isReq=!!R.requiredMap[i],isDecoy=!!R.decoyMap[i],p=tileCenter(i);
  if(i===R.hazardIdx){
    R.hazardIdx=-1;
    var real=missTile(i);
    setTile(i,'no lock');
    if(real&&R.lives<=0){setObj('Out of hearts!','bad');levelFailed('You tapped the danger tile.');return;}
    setObj('Danger tile! Combo reset.','warn');
    TT.c=setTimeout(function(){if(R.phase==='recall')setObj(recallText(),'go');},900);
    return;
  }
  if(isReq&&R.spec.order){
    var need=R.orderAll[R.ordQ];
    if(need!==i){
      R.strayTaps++;R.combo=0;updateHUD();
      A.bad();vib(30);
      var el=tileAt(i);
      if(el){el.classList.add('lockedTap');setTimeout(function(){if(el&&el.className.indexOf('ok')<0)el.classList.remove('lockedTap');},340);}
      FX.text(p.x,p.y-16,'ORDER!','#E04F4F',14);
      setObj('Wrong order — combo reset','warn');
      TT.c=setTimeout(function(){if(R.phase==='recall')setObj(recallText(),'go');},850);
      return;
    }
  }
  if(isReq){
    var dt=t-R.lastTap;
    R.lastTap=t;R.tapTimes.push(dt);
    R.hits++;R.found++;R.ordQ++;
    R.sel[i]=1;
    var mult=multOf(R.combo+1);
    R.combo++;
    if(R.combo>R.bestCombo)R.bestCombo=R.combo;
    if(R.combo>S.bcombo){S.bcombo=R.combo;saveKey('bcombo');}
    if(R.combo>S.bestct){S.bestct=R.combo;saveKey('bestct');}
    S.tiles++;saveKey('tiles');
    var tier=dt<=650?'PERFECT':(dt<=1150?'FAST':(dt<=1800?'GREAT':''));
    var sb=tier==='PERFECT'?45:(tier==='FAST'?25:(tier==='GREAT'?10:0));
    if(tier==='PERFECT'){S.spd=(S.spd||0)+1;saveKey('spd');}
    var roundTiles=(R.spec&&R.spec.tiles)||R.required;
    var base=9+R.level*1.5+roundTiles*1.5;
    var pts=Math.round((base*mult+sb*(1+mult*0.15)));
    if(R.mode==='speed'||R.mode==='perfect')pts=Math.round(pts*1.5);
    else if(R.mode==='chaos')pts=Math.round(pts*1.3);
    if(R.dailyModDouble)pts*=2;
    R.score+=pts;setScore(R.score);
    var isBonus=(i===R.bonusIdx);
    setTile(i,isBonus?'ok bonus':'ok',true);
    A.good();vib(12);
    spawnTrail(p);
    FX.burst(p.x,p.y,{n:isBonus?14:10,colors:isBonus?['#FFC93C','#FFE29A','#FFFFFF','#57CB6C']:pcols(),sp:3.4,shapes:pshapes()});
    FX.burst(p.x,p.y,{n:1,colors:['#FFFFFF'],sp:.5,g:0,size:6,shapes:['o']});
    tapRipple(p);
    refreshRecallCounter();
    R.lastHit={x:p.x,y:p.y};
    FX.text(p.x,p.y-18,'+'+pts,'#2FA24A',15);
    if(tier)FX.text(p.x+20,p.y-34,tier,tier==='PERFECT'?'#E0A31E':'#2E92D1',12);
    if(isBonus){
      R.score+=60;setScore(R.score);R.combo++;
      addTok(3);
      FX.text(p.x,p.y-40,'BONUS!','#E0A31E',18);
      toast('star','yellow','Bonus tile!','+60 score  •  +3 Memory Tokens');
      A.star(2);vib(20);
    }
    comboFx();
    updateHUD();
    setProg(R.found/R.required,true);
    checkLiveRecords();
    achCheck();
    if(R.found>=R.required)roundComplete();
    return;
  }
  if(isDecoy){
    R.decoySel[i]=1;R.decoysFound++;R.found++;
    R.combo++;
    if(R.combo>R.bestCombo)R.bestCombo=R.combo;
    if(R.combo>S.bcombo){S.bcombo=R.combo;saveKey('bcombo');}
    var pts2=Math.round(30+R.level*2);
    R.score+=pts2;setScore(R.score);
    setTile(i,'decoy ok',true);
    addTok(2);
    A.good();vib(12);
    refreshRecallCounter();
    FX.burst(p.x,p.y,{n:9,colors:['#4CB9F2','#FFFFFF','#9FB0D0'],sp:3,shapes:['c','s']});
    FX.text(p.x,p.y-18,'DECOY +'+pts2,'#2E92D1',14);
    comboFx();
    updateHUD();setProg(R.found/R.required,true);
    achCheck();
    if(R.found>=R.required)roundComplete();
    return;
  }
  /* stray tap */
  var real2=missTile(i);
  setTile(i,'no lock');
  if(real2&&R.lives<=0){setObj('Out of hearts!','bad');levelFailed(null);return;}
  var j,k,w,idx;
  for(j=0;j<R.waves.length;j++){
    w=R.waves[j];
    for(k=0;k<w.tiles.length;k++){
      idx=w.tiles[k];
      if(!R.sel[idx])setTile(idx,'warn lock');
    }
  }
  R.phase='teach';
  A.warn();
  setObj('So close! Watch again…','warn');
  TT.a=setTimeout(function(){
    if(!R.active||R.over)return;
    for(var j2=0;j2<R.waves.length;j2++){
      var w2=R.waves[j2];
      for(var k2=0;k2<w2.tiles.length;k2++){
        var idx2=w2.tiles[k2];
        if(!R.sel[idx2])setTile(idx2,'lock');
      }
    }
    if(!R.active||R.over)return;
    R.phase='recall';lockAll(false);
    setObj('Keep going — find the rest!  '+R.found+' / '+R.required,'warn');
    R.lastTap=performance.now();
  },1250);
}
function comboFx(){
  var m=multOf(R.combo);
  elMult.innerHTML='&times;'+m;
  elMult.classList.remove('pulse');void elMult.offsetWidth;elMult.classList.add('pulse');
  if(R.combo>=3){
    A.combo(R.combo);
    var bc=boardTopCenter();
    FX.burst(bc.x,bc.y+rnd(0,20),{n:Math.min(4+R.combo,14),colors:pcols(),ang:-Math.PI/2,spread:1.1,sp:3.6,up:1.4,shapes:pshapes()});
    FX.text(bc.x,bc.y-6,'+COMBO ×'+m,'#9A6E08',13);
    comboFlames();fxComboSparkle();
  }
  var MS=[{n:5,t:'ON FIRE!',ic:'fire',tk:3},{n:10,t:'UNSTOPPABLE!',ic:'bolt',tk:3},
          {n:15,t:'MEMORY BEAST!',ic:'crown',tk:5},{n:20,t:'LEGENDARY FOCUS!',ic:'spark',tk:8},
          {n:25,t:'MATRIX MIND!',ic:'chip',tk:12}];
  for(var i=0;i<MS.length;i++){
    if(R.combo===MS[i].n){
      banner('warn',MS[i].ic,MS[i].t+'  ×'+R.combo,1300);
      addTok(MS[i].tk);
      A.won();
      var btc=boardTopCenter();
      FX.fountain(btc.x,btc.y,22);
      break;
    }
  }
  if(R.combo>=10)checkShield();
}
function checkShield(){
  if(R.shield||R.shieldUsed)return;            /* one shield per run, cannot stack */
  if(R.combo>=10){
    R.shield=true;updateHUD();
    toast('shield','sky','Focus Shield ready','One mistake won\'t break your combo');
    A.star(2);
  }
}
function checkLiveRecords(){
  if(!R.recs)R.recs={};
  if(!R.recs.combo&&S.rec.combo>0&&R.bestCombo>S.rec.combo){R.recs.combo=true;S.rec.combo=R.bestCombo;saveKey('rec');newRec('Best Combo ×'+R.bestCombo);}
  if(!R.recs.score&&S.best>200&&R.score>S.best){R.recs.score=true;newRec('Best Score');}
}
function roundComplete(){
  if(R.mode==='campaign'){
    if(R.cfg.boss){R.phase='clear';clrT();lockAll(true);bossPhaseClear();}
    else levelClear();
    return;
  }
  if(R.mode==='daily'){dailyRoundClear();return;}
  roundClearEndless();
}
/* ================= boss flow ================= */
function flareTiles(){
  var i,j,el,k=0,n=Math.max(1,R.required||1),step=Math.min(45,Math.round(700/n));
  for(i=0;i<R.waves.length;i++){
    for(j=0;j<R.waves[i].tiles.length;j++){
      el=tileAt(R.waves[i].tiles[j]);
      if(el){el.className='tile lock';void el.offsetWidth;el.className='tile ok lock';el.style.animationDelay=(k++*step)+'ms';}
    }
    for(j=0;j<R.waves[i].decoys.length;j++){el=tileAt(R.waves[i].decoys[j]);if(el)el.className='tile decoy ok lock';}
  }
}
function bossPhaseClear(){
  fillBossSeg(R.bossPhase);
  bossbar.classList.add('defeated');
  A.phase();vib(20);
  var bc=boardCenter();
  FX.fountain(bc.x,bc.y,26);
  flareTiles();
  R.bossPhase++;
  if(R.bossPhase<R.bossPhases){
    setObj('Phase '+R.bossPhase+' cleared!','go');
    banner('',R.bossPhase===1?'check':'spark','PHASE CLEARED',1150);
    addTok(10);
    TT.a=setTimeout(function(){
      if(!R.active||R.over)return;
      bossbar.classList.remove('defeated');
      setBossPhase(R.bossPhase,R.bossPhases,R.cfg.boss.name);
      buildRoundForLevel();
    },1500);
  }else bossDefeated();
}
function bossDefeated(){
  R.phase='reward';
  fillBossSeg(R.bossPhases-1);
  bossbar.classList.add('defeated');
  if(S.fx){
    var fl=$('boss-flash');
    if(fl){fl.classList.remove('hidden');fl.classList.add('on');
      setTimeout(function(){fl.classList.remove('on');},950);}
  }
  A.won();vib([30,60,30,60]);
  Plat.happytime();
  banner('','crown','BOSS DEFEATED!',1700);
  flareTiles();
  var bc=boardCenter();
  FX.fountain(bc.x,bc.y,54);
  setTimeout(function(){FX.fountain(bc.x-40,bc.y+30,30);},260);
  setTimeout(function(){FX.fountain(bc.x+40,bc.y+30,30);},420);
  var l=R.level,first=S.bosses.indexOf(l)<0,res;
  if(first)S.bosses.push(l);
  saveKey('bosses');
  S.bboss=Math.max(S.bboss||0,1);saveKey('bboss');
  res=commitLevelResult(true);
  var tok=first?100:30;
  addTok(tok);
  R.levelTokens=(R.levelTokens||0)+tok;
  if(l<MAXLVL)S.maxlvl=Math.max(S.maxlvl,Math.min(MAXLVL,l+1));
  else S.maxlvl=MAXLVL;
  saveKey('maxlvl');
  achCheck();
  R.active=false;R.over=true;clrT();
  var wfin=first&&isWorldBoss(l);
  if(wfin)worldBurst(chOf(l));             /* world-specific celebration particles */
  setTimeout(function(){
    if(wfin){renderWorldComplete(l,tok,res);openOv('ov-world');}
    else{renderBossDefeat(l,first,tok,res);openOv('ov-bossdef');}
  },2300);
}
function renderBossDefeat(l,first,tok,res){
  var b=BOSSES[l];
  $('bd-sub').textContent=b.badge+' earned — '+(first?'brand new badge for your vault!':'boss cleared again.');
  var h='';
  h+=rew('chip','sky','+'+tok+' Memory Tokens',first?'First clear reward':'Repeat clear reward');
  if(unlocked('stars'))h+=rew('star','yellow',res.stars+' / 3 stars','Accuracy '+res.acc+'% • best combo ×'+R.bestCombo);
  h+=rew(b.ic,'green','Boss Badge: '+b.badge,'Level '+l+' boss defeated');
  if(l===10)h+=rew('cal','coral','Daily Matrix unlocked','Unlocks at Level 12');
  if(l===15)h+=rew('bolt','yellow','Speed mode unlocked','Level 15 reached');
  if(l===30)h+=rew('reverse','green','Reverse mode unlocked','Level 35 route');
  if(l===45)h+=rew('target','coral','Perfect mode unlocked','Level 45 reached');
  if(l===50)h+=rew('shuffle','sky','Chaos mode unlocked','The board fights back now');
  if(l===MAXLVL){
    h+=rew('trophy','yellow','CAMPAIGN COMPLETE','All '+NCH+' worlds conquered');
  }else if(isWorldBoss(l)&&chOf(l)+1<NCH){
    h+=rew('grid','green','World '+(chOf(l)+2)+' — '+CH[chOf(l)+1].name,'Levels '+chFirst(chOf(l)+1)+'–'+chLast(chOf(l)+1));
  }else{
    h+=rew('flag','sky','Next: Level '+(l+1),'Levels '+(chFirst(chOf(l))+1)+'–'+chLast(chOf(l))+' in '+CH[chOf(l)].name);
  }
  h+=rew('medal','yellow',starTotal()+' total stars','Mastery continues on replays');
  $('bd-rewards').innerHTML=h;
  var nx=(l<MAXLVL&&S.maxlvl>l)?S.maxlvl:null;
  $('bd-next-label').textContent=nx?('Continue — Level '+nx):'Back to Campaign';
  $('btn-bd-next').dataset.lvl=nx||'';
}
function rew(ic,tone,t,s){
  return '<div class="reward-item"><span class="rw-ic" style="background:var(--'+tone+');box-shadow:0 3px 0 var(--'+tone+'-edge)"><svg class="ic"><use href="#i-'+ic+'"/></svg></span><span><b>'+t+'</b><span>'+s+'</span></span></div>';
}
/* ================= endless modes clear ================= */
function roundClearEndless(){
  R.phase='clear';clrT();lockAll(true);
  R.cleared++;R.round++;
  if(R.mode==='endurance'&&R.round%5===0)R.lives=Math.min(R.maxLives,R.lives+1);
  renderHearts();
  var bonus=30+R.round*10;
  R.score+=bonus;setScore(R.score);
  S.clears++;saveKey('clears');
  if(R.mode==='perfect'){S.modes.perfectRounds=Math.max(S.modes.perfectRounds||0,R.cleared);saveKey('modes');}
  A.clear();
  flareTiles();
  FX.fountain(boardCenter().x,boardCenter().y,Math.min(14+R.round*2,34));
  setObj('Round cleared!','go');
  banner('',R.round%5===0?'crown':'star','Round '+(R.round-1)+' clear!',1000);
  addTok(1);
  achCheck();
  TT.a=setTimeout(function(){
    if(!R.active||R.over)return;
    startModeRound();
  },1150);
}
/* ================= daily ================= */
function dailyRoundClear(){
  R.phase='clear';clrT();lockAll(true);
  R.dailyRound++;
  R.cleared++;
  R.round=R.dailyRound+1;                 /* HUD shows 1/5 … 5/5 */
  R.score+=40+R.dailyRound*14;setScore(R.score);
  flareTiles();
  A.clear();
  FX.fountain(boardCenter().x,boardCenter().y,26);
  if(R.dailyRound>=R.daily.rounds){dailyComplete();return;}
  setObj('Daily round '+R.dailyRound+' done!','go');
  banner('','star','Round '+R.dailyRound+' / 5',1000);
  addTok(2);
  TT.a=setTimeout(function(){
    if(!R.active||R.over)return;
    startModeRound();
  },1150);
}
function dailyComplete(){
  R.phase='reward';R.active=false;R.over=true;clrT();
  var d=R.daily,score=R.score;
  var goldT=d.mods.some(function(m){return m.id==='double';})?3400:2000;
  var silT=Math.round(goldT*0.6);
  var medal=score>=goldT?'gold':(score>=silT?'silver':'bronze');
  var tok=medal==='gold'?50:(medal==='silver'?35:20);
  var dd=S.ddata;
  dd.runs=(dd.runs||0)+1;
  dd.best=Math.max(dd.best||0,score);
  var order={bronze:1,silver:2,gold:3};
  if((order[medal]||1)>(order[dd.medal]||0))dd.medal=medal;
  dd.today=Math.max(dd.todayDate===d.key?(dd.today||0):0,score);
  dd.todayDate=d.key;
  var ykey=new Date(Date.now()-86400000);
  ykey=ykey.getFullYear()+'-'+pad2(ykey.getMonth()+1)+'-'+pad2(ykey.getDate());
  if(dd.lastdone!==d.key){
    S.dstreak=(dd.lastdone===ykey)?(S.dstreak+1):1;
    dd.lastdone=d.key;
    saveKey('dstreak');
  }
  S.dlast=d.key;saveKey('dlast');
  if(medal==='gold'){dgold=1;LS.set('dgold',1);}
  var streakBonus=Math.min(7,S.dstreak)*3;
  saveKey('ddata');
  addTok(tok+streakBonus);
  achCheck();
  cosCheckUnlocks();
  A.won();
  Plat.happytime();
  banner('','medal',medal.toUpperCase()+' MEDAL!',1600);
  FX.fountain(window.innerWidth/2,window.innerHeight*0.32,50);
  setTimeout(function(){
    renderDailyWin(score,medal,tok+streakBonus,silT,goldT);
    openOv('ov-win');
  },1500);
  refreshMenu();
}
function renderDailyWin(score,medal,tok,silT,goldT){
  $('win-title').textContent='Daily Matrix Complete!';
  $('win-sub').textContent=medal.toUpperCase()+' medal — '+(medal==='gold'?'top marks for today.':'replay today to push for gold.');
  popWinHero();
  $('btn-win-next').classList.remove('cta');
  $('btn-win-retry').style.display='none';
  var sh='',i,on=medal==='gold'?3:(medal==='silver'?2:1);
  for(i=0;i<3;i++)sh+='<svg class="'+(i<on?'on':'')+'" viewBox="0 0 24 24"><use href="#i-star"/></svg>';
  $('win-stars').innerHTML=sh;
  $('win-stars').style.display='flex';
  var h='';
  h+='<div class="go-row">'+
     '<div class="plate"><span class="lbl">Daily Score</span><span class="val">'+nf(score)+'</span></div>'+
     '<div class="plate"><span class="lbl">Medal</span><span class="val" style="text-transform:capitalize">'+medal+'</span></div>'+
     '<div class="plate"><span class="lbl">Streak</span><span class="val">'+S.dstreak+'</span></div>'+
     '</div>';
  h+='<div class="go-row" style="margin-top:8px">'+
     '<div class="plate"><span class="lbl">Rounds</span><span class="val">5 / 5</span></div>'+
     '<div class="plate"><span class="lbl">Best Combo</span><span class="val">&times;'+R.bestCombo+'</span></div>'+
     '<div class="plate"><span class="lbl">Silver / Gold</span><span class="val">'+nf(silT)+' / '+nf(goldT)+'</span></div>'+
     '</div>';
  h+='<div class="rec-list">'+
     '<div class="rec-item isrec"><span class="ri-ic"><svg class="ic"><use href="#i-medal"/></svg></span><span class="ri-t">'+medal.toUpperCase()+' medal for '+R.daily.key+'</span><span class="ri-tag">NEW</span></div>'+
     '<div class="rec-item"><span class="ri-ic"><svg class="ic"><use href="#i-cal"/></svg></span><span class="ri-t">Daily streak</span><span class="ri-v">'+S.dstreak+' day'+(S.dstreak===1?'':'s')+'</span></div>'+
     (medal!=='gold'?'<div class="rec-item"><span class="ri-ic"><svg class="ic"><use href="#i-flag"/></svg></span><span class="ri-t">Replay today for gold</span><span class="ri-v">'+nf(goldT)+'</span></div>':'')+
     '</div>';
  h+='<div class="tokrow"><span class="tk"><svg class="ic"><use href="#i-chip"/></svg></span><b>+'+tok+'</b><span>Memory Tokens &nbsp;•&nbsp; total '+nf(S.tok)+'</span></div>'+((tok>0&&Plat.rewardedOk())?'<button class="btn yellow wide adbtn" id="btn-2x" data-tok="'+tok+'"><svg class="ic"><use href="#i-chip"/></svg><span>Double tokens &nbsp;+'+tok+'</span><span class="adtag"><svg class="ic"><use href="#i-play"/></svg>AD</span></button>':'');
  $('win-body').innerHTML=h;
  $('win-next-label').textContent='Retry Daily';
  $('btn-win-next').dataset.lvl='';
  $('btn-win-retry').dataset.lvl='';
}
/* ================= level results ================= */
function commitLevelResult(isBoss){
  var cfg=R.cfg,l=R.level,lv=lvData(l);
  var acc=Math.round(R.hits/Math.max(1,R.hits+R.missThisLevel)*100);
  var avg=R.tapTimes.length?Math.round(R.tapTimes.reduce(function(a,b){return a+b;},0)/R.tapTimes.length):0;
  var stars=starsFor(cfg,acc,avg);   /* stored silently; the star UI reveals at Level 3 */
  var bonus=40+l*10+stars*25;
  R.score+=bonus;setScore(R.score);
  S.clears++;saveKey('clears');
  if(!R.missThisLevel){
    S.bpl=(S.bpl||0)+1;saveKey('bpl');
    R.pstreak=(R.pstreak||0)+1;S.pstreak=R.pstreak;saveKey('pstreak');
  }else{R.pstreak=0;S.pstreak=0;saveKey('pstreak');}
  if(R.pstreak>S.pclear){S.pclear=R.pstreak;saveKey('pclear');}
  var tok=6;
  if(!lv.wi)tok+=4;
  if(stars>=3&&lv.st<3)tok+=12;
  if(!R.missThisLevel)tok+=4;
  if(R.hazards&&!R.hazardTapped)tok+=4;
  addTok(tok);
  R.levelTokens=(R.levelTokens||0)+tok;
  var rec=lv;
  var newBest=(R.score>rec.sc),newStars=(stars>rec.st),newFast=(avg>0&&(!rec.fs||avg<rec.fs)),newCombo=(R.bestCombo>rec.cb);
  var prevFast=rec.fs;
  if(newBest)rec.sc=R.score;
  if(newStars)rec.st=stars;
  if(acc>rec.ac)rec.ac=acc;
  if(newFast)rec.fs=avg;
  if(newCombo)rec.cb=R.bestCombo;
  if(!rec.wi)rec.wi=1;
  rec.dn=(rec.dn||0)+1;
  if(!R.missThisLevel)rec.pf=1;                       /* world mastery: perfect clears */
  if(R.bestCombo>(rec.bc||0))rec.bc=R.bestCombo;      /* world mastery: best combo */
  S.fails[l]=Math.max(0,(S.fails[l]||0)-1);
  var obo=rec.ob;
  obo[0]=true;
  if(acc>=cfg.accT)obo[1]=true;
  if(avg>0&&avg<=cfg.parSec*1000)obo[2]=true;
  if(R.bestCombo>=cfg.comboT)obo[3]=true;
  if(obo[0]&&obo[1]&&obo[2]&&obo[3]&&!rec.mbadge){
    rec.mbadge=1;
    if(unlocked('mastery')){
      addTok(15);
      setTimeout(function(){toast('medal','yellow','LEVEL MASTERED!','Level '+l+' — all objectives complete');A.ach();},600);
    }
  }
  var gr=[];
  if(avg>0&&(!S.rec.fast||avg<S.rec.fast)){S.rec.fast=avg;gr.push('Fastest Recall '+ (avg/1000).toFixed(2)+'s');}
  if(acc>(S.rec.acc||0)){S.rec.acc=acc;gr.push('Highest Accuracy '+acc+'%');}
  if(R.required>(S.rec.tiles||0)){S.rec.tiles=R.required;gr.push('Most Tiles '+R.required);}
  if(R.bestCombo>(S.rec.combo||0)){S.rec.combo=R.bestCombo;}
  saveKey('rec');saveKey('lv');saveKey('fails');
  if(l<MAXLVL)S.maxlvl=Math.max(S.maxlvl,Math.min(MAXLVL,l+1));
  saveKey('maxlvl');
  achCheck();
  wmCheck(chOf(l));
  cosCheckUnlocks();
  return {stars:stars,acc:acc,avg:avg,tok:tok,bonus:bonus,gr:gr,
    newBest:newBest&&rec.sc>0,newStars:newStars,newFast:newFast&&!!prevFast,newCombo:newCombo,perfect:!R.missThisLevel};
}
/* ---- campaign length estimate (shown on the map so a full run is predictable) ----
   reveal hold + stagger + a brisk recall + the overlays between levels.       */
function estLevelSec(l){
  var cfg=levelCfg(l),stg=clamp(74-cfg.tiles*2,24,74);
  var reveal=(cfg.dur+cfg.tiles*stg)/1000;
  var recall=Math.max(2.5,cfg.tiles*0.42);
  return reveal+recall+4.2;
}
function estCampaignSec(){
  var t=0,l;
  for(l=1;l<=MAXLVL;l++)t+=estLevelSec(l);
  return t;
}
function estWorldSec(c){
  var t=0,l;
  for(l=chFirst(c);l<=chLast(c);l++)t+=estLevelSec(l);
  return t;
}
function starsFor(cfg,acc,avg){
  var s=1;
  if(acc>=cfg.accT)s=2;
  var fast=900+cfg.tiles*45;
  if(!R.missThisLevel&&avg&&avg<=fast)s=3;
  return s;
}
function levelClear(){
  R.phase='clear';clrT();lockAll(true);
  var l=R.level,res=commitLevelResult(false);
  A.clear();vib(25);
  Plat.happytime();
  setObj(res.perfect?'Perfect memory!':'Level cleared!','go');
  banner('',res.stars>=3?'crown':'star',res.stars>=3?'PERFECT CLEAR!':('Level '+l+' Clear!'),1100);
  board.classList.remove('pop');void board.offsetWidth;board.classList.add('pop');
  flareTiles();
  var bc=boardCenter();
  FX.fountain(bc.x,bc.y,Math.min(18+l,44),pcols());
  if(res.newStars&&res.stars>0)setTimeout(function(){FX.fountain(bc.x,bc.y+40,18);},240);
  if(S.eq.fx==='winconfetti')setTimeout(function(){FX.burst(bc.x,bc.y-30,{n:14,colors:['#4CB9F2','#FFC93C','#FF6B6B','#57CB6C','#FFFFFF'],sp:4.2,shapes:['r','r','c','s']});},140);
  fxVictoryRing();
  var as=activeSet();
  if(as)setTimeout(function(){FX.burst(bc.x,bc.y,{n:16,colors:setCols(as),sp:4,shapes:['s','c','r']});},220);
  if(res.newBest||res.newCombo||res.newFast){
    var nm=[];
    if(res.newBest)nm.push('Score');
    if(res.newCombo)nm.push('Combo');
    if(res.newFast)nm.push('Recall Speed');
    setTimeout(function(){newRec(nm.join(' • '));},760);
  }
  TT.a=setTimeout(function(){
    if(!R.active||R.over||R.paused)return;
    R.active=false;
    renderWinCard(res);
    openOv('ov-win');
  },1350);
}
/* deterministic pattern preview for a level (same seed as the level card) */
function miniGridHTML(l,cfg,cls){
  var rng=mulberry32((l*7919+13)>>>0),pre=[],i,h;
  for(i=0;i<cfg.size*cfg.size;i++)pre.push(i);
  for(i=pre.length-1;i>0;i--){var j=(rng()*(i+1))|0,t=pre[i];pre[i]=pre[j];pre[j]=t;}
  pre=pre.slice(0,Math.min(cfg.tiles,cfg.size*cfg.size-1));
  h='<span class="mini '+(cls||'')+'" style="grid-template-columns:repeat('+cfg.size+',1fr)">';
  for(i=0;i<cfg.size*cfg.size;i++)h+='<i class="'+(pre.indexOf(i)>=0?'on':'')+'"></i>';
  return h+'</span>';
}
/* animated number roll for the result score */
function countUp(el,to,ms){
  if(!el)return;
  var t0=performance.now(),from=0;
  if(!S.fx||to<=0){el.textContent=nf(to);return;}
  var step=function(){
    var k=Math.min(1,(performance.now()-t0)/ms);k=1-Math.pow(1-k,3);
    el.textContent=nf(Math.round(from+(to-from)*k));
    if(k<1)requestAnimationFrame(step);else bump(el);
  };
  requestAnimationFrame(step);
}
function popWinHero(){
  var hero=$('win-hero');if(!hero)return;
  hero.classList.remove('win-pop');void hero.offsetWidth;hero.classList.add('win-pop');
}
function renderWinCard(res){
  var cfg=R.cfg,l=R.level,lv=lvData(l),i;
  var firstEver=(l===1&&(lv.dn||0)<=1);
  var title='Level '+l+' Complete!',sub='';
  if(firstEver){title='Great start!';sub='Level 1 cleared — your memory is warming up.';}
  else if(res.perfect&&res.stars>=3){title='Perfect memory!';sub='Level '+l+' — flawless recall at top speed.';}
  else if(res.perfect){sub='Zero misses on Level '+l+' — clean recall.';}
  else sub='Level '+l+' cleared with '+res.acc+'% accuracy.';
  $('win-title').textContent=title;
  $('win-sub').textContent=sub;
  popWinHero();
  var showStars=unlocked('stars'),sh='';
  for(i=0;i<3;i++)sh+='<svg viewBox="0 0 24 24"><use href="#i-star"/></svg>';
  $('win-stars').innerHTML=sh;
  $('win-stars').style.display='flex';
  if(showStars){
    var icons=$('win-stars').querySelectorAll('svg');
    for(i=0;i<res.stars;i++){
      (function(el,idx){
        setTimeout(function(){
          el.classList.add('on');A.star(idx);
          var r=el.getBoundingClientRect();
          FX.burst(r.left+r.width/2,r.top+r.height/2,{n:8,colors:['#FFC93C','#FFFFFF'],sp:2.6,size:4,shapes:['s','c']});
        },240+idx*200);
      })(icons[i],i);
    }
  }
  var h='';
  h+='<div class="go-row win-score-row">'+
     '<div class="plate"><span class="lbl">Score</span><span class="val" id="win-score">0</span></div>'+
     '<div class="plate"><span class="lbl">Accuracy</span><span class="val">'+res.acc+'%</span></div>'+
     '<div class="plate"><span class="lbl">Best Combo</span><span class="val">&times;'+R.bestCombo+'</span></div>'+
     '</div>';
  h+='<div class="go-row" style="margin-top:8px">'+
     '<div class="plate"><span class="lbl">Recall Speed</span><span class="val">'+(res.avg?(res.avg/1000).toFixed(2)+'s':'—')+'</span></div>'+
     '<div class="plate"><span class="lbl">Tiles</span><span class="val">'+R.required+'</span></div>'+
     '<div class="plate"><span class="lbl">Clear Bonus</span><span class="val">+'+res.bonus+'</span></div>'+
     '</div>';
  h+='<div class="tokrow"><span class="tk"><svg class="ic"><use href="#i-chip"/></svg></span><b>+'+res.tok+'</b><span>Memory Tokens &nbsp;•&nbsp; total '+nf(S.tok)+'</span></div>'+((res.tok>0&&Plat.rewardedOk())?'<button class="btn yellow wide adbtn" id="btn-2x" data-tok="'+res.tok+'"><svg class="ic"><use href="#i-chip"/></svg><span>Double tokens &nbsp;+'+res.tok+'</span><span class="adtag"><svg class="ic"><use href="#i-play"/></svg>AD</span></button>':'');
  if(!showStars)h+='<div class="unlock-note soft" style="margin-top:10px"><svg class="ic"><use href="#i-star"/></svg>Stars unlock at Level 3 — '+(3-Math.min(2,l))+' more level'+((3-Math.min(2,l))===1?'':'s')+' to go!</div>';
  if(unlocked('mastery')){
    var os=objStrings(cfg),ico=['check','target','gauge','bolt'];
    h+='<div class="sect-title"><svg class="ic"><use href="#i-flag"/></svg>Level Objectives</div>';
    for(i=0;i<4;i++){
      if(i===1)h+='<div class="obj-head">Mastery Objectives</div>';
      h+='<div class="obj-line'+(lv.ob[i]?' done':'')+'"><span class="o-ic"><svg class="ic"><use href="#i-'+(lv.ob[i]?'check':ico[i])+'"/></svg></span><span>'+os[i].k+'</span></div>';
    }
    if(lv.ob[0]&&lv.ob[1]&&lv.ob[2]&&lv.ob[3])h+='<div class="unlock-note"><svg class="ic"><use href="#i-medal"/></svg>Mastery badge earned for Level '+l+'!</div>';
  }
  var recBits=[];
  if(res.newBest)recBits.push(['crown','Best Level Score',nf(lv.sc)]);
  if(res.newCombo)recBits.push(['bolt','Best Combo','×'+lv.cb]);
  if(res.newFast)recBits.push(['gauge','Fastest Recall',(lv.fs/1000).toFixed(2)+'s']);
  if(res.newStars&&showStars)recBits.push(['star','Best Stars',res.stars+' / 3']);
  for(i=0;i<res.gr.length;i++)recBits.push(['spark',res.gr[i],'NEW']);
  if(recBits.length&&firstEver){
    h+='<div class="unlock-note soft"><svg class="ic"><use href="#i-crown"/></svg>'+recBits.length+' personal best'+(recBits.length===1?'':'s')+' set \u2014 beat them next time!</div>';
  }else if(recBits.length){
    h+='<div class="rec-list">';
    for(i=0;i<recBits.length;i++){
      h+='<div class="rec-item isrec"><span class="ri-ic"><svg class="ic"><use href="#i-'+recBits[i][0]+'"/></svg></span>'+
        '<span class="ri-t">'+recBits[i][1]+'</span><span class="ri-v">'+recBits[i][2]+'</span><span class="ri-tag">NEW</span></div>';
    }
    h+='</div>';
  }
  var nxt=(l<MAXLVL)?l+1:null;
  if(nxt){
    var nc=levelCfg(nxt),ncw=chOf(nxt);
    h+='<div class="next-card">'+miniGridHTML(nxt,nc,'sm')+
       '<span class="nc-t"><b>Up next: Level '+nxt+(nc.boss?(nc.boss.mini?' — MINI-BOSS':' — BOSS'):'')+'</b>'+
       '<span>'+(nc.boss?nc.boss.name+' · 3 phases':(nc.size+'×'+nc.size+' board · '+nc.tiles+' tiles'+(nc.label?' · '+nc.label:'')))+'</span></span>'+
       '<span class="pill sky"><svg class="ic"><use href="#i-'+CH[ncw].ic+'"/></svg>W'+(ncw+1)+'</span></div>';
    if(BOSSES[nxt])h+='<div class="unlock-note"><svg class="ic"><use href="#i-warn"/></svg>Next up: '+(BOSSES[nxt].mini?'MINI-BOSS':'BOSS')+' LEVEL — '+BOSSES[nxt].name+'</div>';
    else if(MECH[nxt])h+='<div class="unlock-note"><svg class="ic"><use href="#i-spark"/></svg>Next up: new mechanic — '+mechLabel(nxt)+'</div>';
    if(nxt===chFirst(chOf(nxt)))h+='<div class="unlock-note"><svg class="ic"><use href="#i-grid"/></svg>World '+(chOf(nxt)+1)+' — '+CH[chOf(nxt)].name+' begins ('+CHLEN[chOf(nxt)]+' levels)</div>';
  }
  var unlocks=[[3,'star','Stars unlocked'],[5,'medal','Mastery objectives unlocked'],[6,'shield','Power-ups unlocked'],
    [8,'gift','Memory Vault unlocked'],[12,'cal','Daily Matrix unlocked'],[15,'bolt','Speed mode unlocked'],
    [25,'heart','Endurance mode unlocked'],[35,'reverse','Reverse mode unlocked'],[45,'target','Perfect mode unlocked']];
  for(i=0;i<NCH;i++)unlocks.push([chFirst(i),CH[i].ic,'World '+(i+1)+' — '+CH[i].name+' unlocked']);
  var gotUnlock='';
  for(i=0;i<unlocks.length;i++)if(l+1===unlocks[i][0]){h+='<div class="unlock-note"><svg class="ic"><use href="#i-'+unlocks[i][1]+'"/></svg>'+unlocks[i][2]+'!</div>';gotUnlock=unlocks[i][2];}
  if(gotUnlock){
    var msg=gotUnlock;
    setTimeout(function(){A.unlock();toast('spark','sky','NEW FEATURE',msg+'!');},900);
  }
  $('win-body').innerHTML=h;
  $('win-next-label').textContent=nxt?('Next Level · '+nxt+(BOSSES[nxt]?' BOSS':'')):'Campaign Map';
  $('btn-win-next').dataset.lvl=nxt||'';
  $('btn-win-next').classList.toggle('cta',!!nxt&&l<=3);
  $('btn-win-retry').dataset.lvl=l;
  $('btn-win-retry').style.display='';
  countUp($('win-score'),R.score,700);
}
/* ================= failure ================= */
function levelFailed(reason){
  if(R.phase==='over')return;
  R.over=true;R.active=false;R.phase='over';clrT();lockAll(true);
  if(R.mode==='campaign'){
    S.fails[R.level]=(S.fails[R.level]||0)+1;
    saveKey('fails');
    var lv=lvData(R.level);
    lv.dn=(lv.dn||0)+1;saveKey('lv');
    R.pstreak=0;S.pstreak=0;saveKey('pstreak');
  }
  runOver(reason);
}
function runOver(reason){
  R.over=true;R.active=false;R.phase='over';clrT();
  A.over();
  var isMode=(R.mode!=='campaign'&&R.mode!=='daily');
  var nb=false;
  if(R.score>S.best){S.best=R.score;nb=true;}
  if(isMode){if(!S.modes[R.mode]||R.score>S.modes[R.mode]){S.modes[R.mode]=R.score;nb=true;}}
  if(R.mode==='daily'){
    var today=todayKey();
    S.ddata.today=Math.max(S.ddata.todayDate===today?(S.ddata.today||0):0,R.score);
    S.ddata.todayDate=today;
    S.ddata.runs=(S.ddata.runs||0)+1;
    S.ddata.best=Math.max(S.ddata.best||0,R.score);
    if(!S.ddata.medal)S.ddata.medal='';
    saveKey('ddata');
  }
  saveKey('best');saveKey('modes');
  $('go-score').textContent=nf(R.score);
  $('go-scorelbl').textContent=(R.mode==='daily')?'Daily Score':(isMode?'Mode Score':'Run Score');
  $('go-level').textContent=(R.mode==='campaign')?R.level:(R.mode==='daily'?(R.dailyRound+' / 5'):R.round);
  $('go-streak').textContent='×'+R.bestCombo;
  var acc=R.mode==='campaign'?Math.round(R.hits/Math.max(1,R.hits+R.missThisLevel)*100)
    :Math.round(R.hits/Math.max(1,R.hits+(R.misses||0))*100);
  $('go-acc').textContent=acc+'%';
  $('go-newbest').classList.toggle('hidden',!nb);
  var t='Run Over',sub='';
  if(R.mode==='campaign'){
    var lvF=lvData(R.level);
    if(lvF.wi){
      t='So close!';
      sub='You have cleared Level '+R.level+' before — beat your best of '+nf(lvF.sc||0)+' pts.';
    }else if(R.level>1){
      t='One more try!';
      sub='You were one level away from moving past Level '+R.level+'.';
    }else{
      sub='Every miss teaches your memory something. Go again.';
    }
    if(lvF.st>0)sub+='  Best here: '+'★'.repeat(lvF.st);
  }else if(R.mode==='daily'){
    t='Daily ended';sub='Rounds cleared: '+R.dailyRound+' / 5. The seed stays the same all day — retry it.';
  }else{
    t='Run Over';sub='Cleared '+R.cleared+' round'+(R.cleared===1?'':'s')+' — this mode\'s best is '+nf(S.modes[R.mode]||0)+'.';
  }
  if(reason)sub=reason+' '+sub;
  if(nb){t='New Best!';sub='You beat your own record. Now top it.';}
  $('over-title').textContent=t;
  $('over-sub').textContent=sub;
  var rl='',i,list;
  if(isMode||R.mode==='daily'){
    list=(R.mode==='daily')?
      [['target','Rounds cleared',R.dailyRound+' / 5'],['bolt','Best combo','×'+R.bestCombo],['medal','Daily medal',(S.ddata.medal||'—')]]:
      [['bolt','Best combo','×'+R.bestCombo],['chart','Mode best',nf(S.modes[R.mode]||0)],['check','Rounds cleared',R.cleared]];
    for(i=0;i<list.length;i++)rl+='<div class="rec-item"><span class="ri-ic"><svg class="ic"><use href="#i-'+list[i][0]+'"/></svg></span><span class="ri-t">'+list[i][1]+'</span><span class="ri-v">'+list[i][2]+'</span></div>';
  }else{
    var lv2=lvData(R.level);
    rl+='<div class="rec-item"><span class="ri-ic"><svg class="ic"><use href="#i-star"/></svg></span><span class="ri-t">Best stars on Level '+R.level+'</span><span class="ri-v">'+(lv2.st?lv2.st+' / 3':'—')+'</span></div>';
    rl+='<div class="rec-item"><span class="ri-ic"><svg class="ic"><use href="#i-gauge"/></svg></span><span class="ri-t">Fastest recall (career)</span><span class="ri-v">'+(S.rec.fast?(S.rec.fast/1000).toFixed(2)+'s':'—')+'</span></div>';
    rl+='<div class="rec-item"><span class="ri-ic"><svg class="ic"><use href="#i-bolt"/></svg></span><span class="ri-t">Best combo (career)</span><span class="ri-v">×'+(S.rec.combo||0)+'</span></div>';
  }
  if(rl)$('over-rec').innerHTML='<div class="rec-list">'+rl+'</div>';
  $('over-retry-label').textContent=(R.mode==='campaign')?('Try Level '+R.level+' Again'):(R.mode==='daily'?'Retry Daily':'Try Again');
  $('btn-again').dataset.mode=(R.mode==='campaign'?'campaign':(R.mode==='daily'?'daily':'mode'));
  R.reviveOffered=canRevive();refreshAdUI();
  openOv('ov-over');
  if(nb){
    banner('warn','crown','New Best Score!',1400);
    FX.fountain(window.innerWidth/2,window.innerHeight*0.35,46);
    A.ach();Plat.happytime();
  }
  achCheck();
  refreshMenu();
}
/* ================= Rewarded revive ================= */
function reviveEligible(){return !!(R.over&&!R.revived&&R.mode!=='daily'&&R.mode!=='perfect');}
function canRevive(){return reviveEligible()&&Plat.rewardedOk();}
function refreshAdUI(){
  var rb=$('btn-revive'),rn=$('revive-note'),db=$('btn-2x');
  if(rb)rb.classList.toggle('hidden',!canRevive());
  if(rn)rn.classList.toggle('hidden',!(reviveEligible()&&Plat.adsOk()&&Plat.adblock));
  if(db&&!db.disabled)db.classList.toggle('hidden',!Plat.rewardedOk());
}
function reviveRun(){
  if(!reviveEligible())return false;
  R.revived=true;R.reviveOffered=false;
  closeAllOv();clrT();
  R.over=false;R.active=true;R.phase='prep';
  R.lives=R.maxLives;heartsShown=-1;renderHearts();updateHUD();
  setObj('Revived! Get ready\u2026','go');setHint('');
  banner('warn','heart','Revived \u2014 keep going!',1100);
  A.good();vib(20);
  FX.fountain(window.innerWidth/2,window.innerHeight*0.35,30);
  toast('heart','green','Revived!','Hearts restored \u2014 same level, same score');
  if(R.mode==='campaign'){R.missThisLevel=0;TT.rv=setTimeout(buildRoundForLevel,750);}
  else TT.rv=setTimeout(startModeRound,750);
  return true;
}
/* ================= pause ================= */
function hideHl(){
  var i,j,w,el;
  for(i=0;i<R.waves.length;i++){
    w=R.waves[i];
    for(j=0;j<w.tiles.length;j++){
      el=tileAt(w.tiles[j]);
      if(el&&el.className.indexOf('hl')>=0)setTile(w.tiles[j],'lock');
    }
    for(j=0;j<w.decoys.length;j++){
      el=tileAt(w.decoys[j]);
      if(el&&el.className.indexOf('decoy')>=0&&el.className.indexOf('ok')<0&&!R.decoySel[w.decoys[j]])setTile(w.decoys[j],'lock');
    }
  }
}
function pauseGame(){
  if(window.MP&&MP.active)return;                 /* online rounds are server-timed — no pausing */
  if(!R.active||R.over||R.paused||anyOv())return;
  if(R.phase!=='stagger'&&R.phase!=='reveal'&&R.phase!=='recall')return;
  R.paused=true;
  if(R.phase==='stagger'){
    if(R.stag){for(var i=0;i<R.stag.length;i++)clearTimeout(R.stag[i]);R.stag=null;}
    R.phase='reveal';R.remain=0;
  }else if(R.phase==='reveal'){
    R.remain=Math.max(300,R.pDur-(performance.now()-R.pStart));
    if(R.raf){cancelAnimationFrame(R.raf);R.raf=0;}
  }
  if(R.raf2){cancelAnimationFrame(R.raf2);R.raf2=0;}
  hideHl();
  lockAll(true);
  renderPauseObj();
  try{if(typeof pubar!=='undefined'&&pubar)pubar.classList.add('hidden');}catch(e){}  /* boosters off-screen while paused */
  openOv('ov-pause');
}
function renderPauseObj(){
  var h='',i;
  if(R.mode==='campaign'&&unlocked('mastery')&&R.cfg){
    var o=objStrings(R.cfg),d=lvData(R.level);
    for(i=0;i<4;i++){
      var ok=!!(d.ob&&d.ob[i]);
      h+='<div class="obj-line'+(ok?' done':'')+'"><span class="o-ic"><svg class="ic"><use href="#i-'+(ok?'check':'flag')+'"/></svg></span><span>'+o[i].k+'</span></div>';
    }
    h='<div class="sect-title"><svg class="ic"><use href="#i-flag"/></svg>Objectives</div>'+h;
  }
  if(unlocked('powerups')){
    h+='<div class="sect-title"><svg class="ic"><use href="#i-shield"/></svg>Boosters<span class="spacer"></span>'+
       '<span class="tokchip inline"><span class="tk"><svg class="ic"><use href="#i-chip"/></svg></span>'+nf(S.tok)+'</span></div>';
    h+='<div class="pu-pick tight">';
    for(i=0;i<PWR.length;i++){
      var p=PWR[i],own=pwCount(p.id),sl=S.pweq.indexOf(p.id)>=0,can=S.tok>=p.cost;
      h+='<div class="pu-slot2'+(sl?' sel':'')+(own<=0?' empty':'')+'">'+
        '<button class="ps-main" data-beq="'+p.id+'">'+
        '<span class="pu-ic" style="background:var(--'+p.tone+');box-shadow:0 3px 0 var(--'+p.tone+'-edge)"><svg class="ic"><use href="#i-'+p.ic+'"/></svg></span>'+
        '<b>'+p.name+'</b><span>×'+own+(sl?' • equipped':'')+'</span></button>'+
        '<button class="ps-buy'+(can?'':' no')+'" data-pbuy="'+p.id+'"><svg class="ic"><use href="#i-chip"/></svg>'+p.cost+'</button></div>';
    }
    h+='</div>';
    h+='<div class="unlock-note"><svg class="ic"><use href="#i-clock"/></svg>Bought boosters apply from the next round.</div>';
  }
  h+='<div class="sessline goal-removed"><svg class="ic"><use href="#i-clock"/></svg>Session '+fmtClock(S.sessRun)+
     ' \u2022 Today '+fmtClock((S.sessDate===todayKey())?(S.sessToday||0):0)+'</div>';
  $('pause-obj').innerHTML=h;
  var slots=$('pause-obj').querySelectorAll('.ps-main');
  for(i=0;i<slots.length;i++){
    slots[i].addEventListener('click',(function(id){
      return function(){A.init();A.btn();toggleBoosterEquip(id);renderPauseObj();renderPuBar();};
    })(slots[i].dataset.beq));
  }
  wireBoosters($('pause-obj'));
}
function resumeGame(){
  if(!R.paused)return;
  R.paused=false;
  closeOv('ov-pause');
  try{if(typeof renderPuBar==='function')renderPuBar();}catch(e){}  /* boosters back, exactly as the mode allows */
  Plat.gameplayStart();
  if(R.phase==='reveal'){
    if(R.remain>0){
      var i,j,w;
      for(i=0;i<R.waves.length;i++){
        w=R.waves[i];
        for(j=0;j<w.tiles.length;j++){
          var idx=w.tiles[j];
          if(!R.sel[idx])setTile(idx,'hl lock');
        }
      }
      R.remain=Math.min(R.remain,R.spec.dur);
      runPreviewTimer(R.remain);
      R.remain=0;
    }else startWave(R.waveIdx);
  }else if(R.phase==='recall'){
    lockAll(false);
    if(R.spec.recallLimit&&R.recallEnds){
      var left=R.recallEnds-performance.now();
      if(left<=0){timeUp();}
    }
  }
}
/* ================= board sizing ================= */
function fitBoard(){
  var wrap=$('boardWrap');
  if(!wrap||!wrap.clientWidth)return;
  var s=Math.min(wrap.clientWidth,wrap.clientHeight)-4;
  if(s<150)s=150;
  board.style.width=s+'px';
}
window.addEventListener('resize',function(){requestAnimationFrame(fitBoard);});
/* ================= menu: always fits the window (no scrollbar) ================= */
function mmFitMenu(){
  var scr=$('scr-menu');
  if(!scr)return;
  var w=scr.querySelector(':scope>.mfit');
  if(!w){
    w=document.createElement('div');w.className='mfit';
    while(scr.firstChild)w.appendChild(scr.firstChild);
    scr.appendChild(w);
    if(window.ResizeObserver){
      var ro=new ResizeObserver(function(){mmFitMenu();});
      ro.observe(w);ro.observe(scr);
    }
  }
  if(!scr.clientHeight)return;                     /* menu hidden */
  var cs=getComputedStyle(scr);
  var availH=scr.clientHeight-parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom);
  var availW=scr.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight);
  var nat=w.offsetHeight;                          /* layout height (unaffected by transform) */
  if(!nat||availH<=0)return;
  var z=Math.min(1,availH/nat,availW/Math.max(1,w.offsetWidth));
  z=Math.max(.35,z);
  w.style.transform=z<.999?'scale('+z.toFixed(3)+')':'';
}
window.addEventListener('resize',function(){requestAnimationFrame(mmFitMenu);});
window.addEventListener('orientationchange',function(){setTimeout(mmFitMenu,200);});
mmFitMenu();
/* ================= menu ================= */
function refreshMenu(){
  $('m-best').textContent=nf(S.best);
  $('m-level').textContent=pad2(S.maxlvl);
  $('m-stars').textContent=unlocked('stars')?starTotal():'—';
  $('m-tok').textContent=nf(S.tok);
  $('m-pstreak').textContent=S.pstreak||0;
  if(typeof renderMenuAvatar==='function'){renderMenuAvatar();renderSetFlag();}
  if(typeof renderMenuBoosters==='function')renderMenuBoosters();
  if(typeof renderSessionBar==='function')renderSessionBar();
  $('m-tokchip').style.display=(S.maxlvl>=6)?'':'none';
  $('m-pchip').style.display=(S.maxlvl>=5)?'':'none';
  var lbl=$('play-label');
  if(S.maxlvl>=MAXLVL&&S.bosses.indexOf(MAXLVL)>=0)lbl.textContent='All Levels Cleared';
  else lbl.textContent='Level '+S.maxlvl+(BOSSES[S.maxlvl]?' — BOSS':'');
  $('nb-map-label').textContent='Lev '+S.maxlvl;
  $('btn-daily').style.opacity=unlocked('daily')?'':'0.5';
}
/* ================= map ================= */
function nodeStars(st){
  var h='',i;
  for(i=0;i<3;i++)h+='<svg class="'+(i<st?'':'off')+'" viewBox="0 0 24 24"><use href="#i-star"/></svg>';
  return h;
}
function renderMap(){
  var body=$('map-body'),h='',c,i;
  $('map-tok').textContent=nf(S.tok);
  var cNow=chOf(Math.min(S.maxlvl,MAXLVL));
  $('map-sub').textContent='World '+(cNow+1)+' · '+CH[cNow].name+' · '+MAXLVL+' levels';
  /* campaign length estimate, shown so players know what a full run costs */
  h+='<div class="campmeta">'+
     '<span class="cm-i"><svg class="ic"><use href="#i-grid"/></svg>'+MAXLVL+' LEVELS</span>'+
     '<span class="cm-i"><svg class="ic"><use href="#i-layers"/></svg>'+NCH+' WORLDS</span>'+
     '<span class="cm-i"><svg class="ic"><use href="#i-crown"/></svg>'+Object.keys(BOSSES).length+' BOSSES</span>'+
     '<span class="cm-i"><svg class="ic"><use href="#i-clock"/></svg>&asymp; '+Math.round(estCampaignSec()/60)+' MIN FULL RUN</span>'+
     '</div>';
  for(c=0;c<NCH;c++){
    var first=chFirst(c),last=chLast(c),len=CHLEN[c],chStars=0,chMax=0,done=0,l,d;
    for(l=first;l<=last;l++){
      chMax+=3;d=S.lv[l];
      if(d){chStars+=d.st||0;if(d.wi)done++;}
    }
    var chLocked=first>S.maxlvl;
    h+='<div class="chhead '+(chLocked?'locked':CH[c].tone)+'">'+
       '<div class="ch-top"><span class="ch-ic"><svg class="ic"><use href="#i-'+CH[c].ic+'"/></svg></span>'+
       '<span class="ch-n"><b>World '+(c+1)+' — '+CH[c].name+'</b><span>LEVELS '+first+'–'+last+' · &asymp;'+Math.round(estWorldSec(c)/60)+' MIN · '+CH[c].blurb+'</span></span>'+
       (unlocked('stars')?'<span class="pill '+(chStars>=chMax?'green':(chStars?'yellow':'navy'))+'"><svg class="ic"><use href="#i-star"/></svg>'+chStars+'/'+chMax+'</span>':'')+
       '<button class="wmast-chip'+(wmDone(c)?' full':'')+'" data-wm="'+c+'"><svg class="ic"><use href="#i-medal"/></svg>'+wmCount(c)+'/'+wmTotal(c)+'</button>'+
       '</div><div class="ch-bar"><i style="width:'+Math.round(done/len*100)+'%"></i></div></div>';
    /* rows of three, serpentine — works for any world length */
    var order=[],rows=[],r,k,rr=[];
    for(k=0;k<len;k++){
      rr.push(k);
      if(rr.length===3){rows.push(rr);rr=[];}
    }
    if(rr.length)rows.push(rr);
    for(r=0;r<rows.length;r++){
      var row=rows[r].slice();
      if(r%2===1)row.reverse();          /* serpentine: odd rows read right→left */
      for(k=0;k<row.length;k++)order.push(first+row[k]);
    }
    h+='<div class="path">';
    var col=0;
    for(i=0;i<len;i++){
      if(col===0)h+='<div class="prow">';
      var lvN=order[i],L=S.lv[lvN],isBoss=!!BOSSES[lvN];
      var isUnl=lvN<=S.maxlvl,cls='node';
      if(!isUnl)cls+=' lock';
      else if(L&&L.wi)cls+=(isBoss?(BOSSES[lvN].mini?' minboss done':' boss done'):' done');
      else if(lvN===S.maxlvl)cls+=isBoss?(BOSSES[lvN].mini?' minboss':' boss'):' cur';
      var inner='';
      if(!isUnl)inner='<svg class="ic"><use href="#i-lock"/></svg><span class="n-lbl">LV '+lvN+'</span>';
      else{
        if(isBoss){
          inner='<svg class="ic n-ic"><use href="#i-'+BOSSES[lvN].ic+'"/></svg><span>'+lvN+'</span>';
          inner+=(L&&L.wi)?'<span class="n-stars">'+nodeStars(L.st||0)+'</span>':'<span class="n-lbl">'+(BOSSES[lvN].mini?'MINI':'BOSS')+'</span>';
        }else{
          inner='<span>'+lvN+'</span>';
          if(unlocked('stars'))inner+='<span class="n-stars">'+nodeStars((L&&L.st)||0)+'</span>';
        }
      }
      var mast=(L&&L.ob&&L.ob[0]&&L.ob[1]&&L.ob[2]&&L.ob[3])?'':' hide';
      h+='<button class="'+cls+'" data-lv="'+lvN+'">'+inner+(isUnl?'<span class="n-mast'+mast+'"><svg class="ic"><use href="#i-medal"/></svg></span>':'')+'</button>';
      col++;
      if(col<3&&i<len-1)h+='<span class="sep"><svg class="ic"><use href="#i-chev"/></svg></span>';
      if(col===3||i===len-1){
        while(col<3){h+='<span class="spacer"></span>';col++;}
        h+='</div>';
      }
      if(col===3&&i<len-1){
        var rIdx=Math.floor(i/3),side=(rIdx%2===1)?'left':'right';
        h+='<div class="prow hop '+side+'"><span class="sep down"><svg class="ic"><use href="#i-chev"/></svg></span></div>';
      }
      if(col===3)col=0;
    }
    h+='</div>';
  }
  body.innerHTML=h;
  var nodes=body.querySelectorAll('.node');
  var handler=function(){
    var lvN=parseInt(this.dataset.lv,10);
    A.init();A.btn();
    if(lvN>S.maxlvl){toast('lock','coral','Level locked','Clear Level '+(lvN-1)+' first');A.warn();return;}
    renderLevelCard(lvN);openOv('ov-level');
  };
  for(i=0;i<nodes.length;i++)nodes[i].addEventListener('click',handler);
  var wms=body.querySelectorAll('.wmast-chip');
  for(i=0;i<wms.length;i++){
    wms[i].addEventListener('click',function(e){
      e.stopPropagation();
      A.init();A.btn();
      renderMastery(parseInt(this.dataset.wm,10));
      openOv('ov-mastery');
    });
  }
}
/* ================= level card ================= */
function renderLevelCard(l){
  var cfg=levelCfg(l),lv=lvData(l),h='',i;
  $('lc-head').textContent='Level '+l+(cfg.boss?' — BOSS':'');
  var c=chOf(l);
  var rng=mulberry32((l*7919+13)>>>0);
  var pre=[];for(i=0;i<cfg.size*cfg.size;i++)pre.push(i);
  for(i=pre.length-1;i>0;i--){var j=(rng()*(i+1))|0,t=pre[i];pre[i]=pre[j];pre[j]=t;}
  pre=pre.slice(0,Math.min(cfg.tiles,cfg.size*cfg.size-1));
  h+='<div class="lc-top"><span class="lc-badge '+(cfg.boss?'coral':(lv.wi?'green':'sky'))+'">'+(cfg.boss?'<svg class="ic" style="width:26px;height:26px"><use href="#i-'+cfg.boss.ic+'"/></svg>':l)+'</span>'+
     '<span class="lc-t"><b>'+(cfg.boss?cfg.boss.name:'World '+(c+1)+' — '+CH[c].name)+'</b><span>'+(cfg.boss?cfg.boss.sub:cfg.size+'×'+cfg.size+' matrix · '+cfg.tiles+' tiles · '+(cfg.dur/1000).toFixed(1)+'s reveal')+'</span></span></div>';
  h+='<div class="mini" style="grid-template-columns:repeat('+cfg.size+',1fr)">';
  for(i=0;i<cfg.size*cfg.size;i++)h+='<i class="'+(pre.indexOf(i)>=0?'on':'')+'"></i>';
  h+='</div>';
  h+='<div class="lc-facts">'+
     '<div class="plate"><span class="lbl">Grid</span><span class="val">'+cfg.size+'²</span></div>'+
     '<div class="plate"><span class="lbl">Tiles</span><span class="val">'+cfg.tiles+'</span></div>'+
     '<div class="plate"><span class="lbl">Reveal</span><span class="val">'+(cfg.dur/1000).toFixed(1)+'s</span></div>'+
     '</div>';
  if(cfg.boss){
    h+='<div class="unlock-note"><svg class="ic"><use href="#i-layers"/></svg>3 phases: warm-up, harder pattern, then the boss twist.</div>';
    h+='<div class="unlock-note"><svg class="ic"><use href="#i-heart"/></svg>'+(l===MAXLVL?'Only 2 mistakes allowed':'Mistakes cost a heart')+'</div>';
  }else{
    var md=mechDesc(l);
    for(i=0;i<md.length;i++)h+='<div class="unlock-note"><svg class="ic"><use href="#i-'+(i===0?'spark':'check')+'"/></svg>'+md[i]+'</div>';
  }
  if(unlocked('mastery')){
    var os=objStrings(cfg),ico=['check','target','gauge','bolt'];
    h+='<div class="sect-title"><svg class="ic"><use href="#i-flag"/></svg>Level Objectives</div>';
    for(i=0;i<4;i++){
      if(i===1)h+='<div class="obj-head">Mastery Objectives</div>';
      h+='<div class="obj-line'+(lv.ob[i]?' done':'')+'"><span class="o-ic"><svg class="ic"><use href="#i-'+(lv.ob[i]?'check':ico[i])+'"/></svg></span><span>'+os[i].k+'</span><b>'+(lv.ob[i]?'DONE':'')+'</b></div>';
    }
  }
  if(lv.wi||lv.sc){
    h+='<div class="rec-row">';
    if(unlocked('stars'))h+='<span class="rec-chip"><svg class="ic"><use href="#i-star"/></svg>Best <b>'+(lv.st||0)+' / 3</b></span>';
    h+='<span class="rec-chip"><svg class="ic"><use href="#i-crown"/></svg>Best <b>'+nf(lv.sc||0)+'</b></span>';
    if(lv.cb)h+='<span class="rec-chip"><svg class="ic"><use href="#i-bolt"/></svg>Combo <b>×'+lv.cb+'</b></span>';
    if(lv.fs)h+='<span class="rec-chip"><svg class="ic"><use href="#i-gauge"/></svg>Fastest <b>'+(lv.fs/1000).toFixed(2)+'s</b></span>';
    h+='</div>';
  }
  if(unlocked('powerups')){
    h+='<div class="sect-title"><svg class="ic"><use href="#i-shield"/></svg>Boosters — equip up to 2<span class="spacer"></span>'+
       '<span class="tokchip inline"><span class="tk"><svg class="ic"><use href="#i-chip"/></svg></span>'+nf(S.tok)+'</span></div>';
    h+='<div class="pu-pick">';
    for(i=0;i<PWR.length;i++){
      var p=PWR[i],own=pwCount(p.id),sl=S.pweq.indexOf(p.id)>=0,can=S.tok>=p.cost;
      h+='<div class="pu-slot2'+(sl?' sel':'')+(own<=0?' empty':'')+'">'+
        '<button class="ps-main" data-pw="'+p.id+'">'+
        '<span class="pu-ic" style="background:var(--'+p.tone+');box-shadow:0 3px 0 var(--'+p.tone+'-edge)"><svg class="ic"><use href="#i-'+p.ic+'"/></svg></span>'+
        '<b>'+p.name+'</b><span>'+own+' owned'+(sl?' • equipped':'')+'</span></button>'+
        '<button class="ps-buy'+(can?'':' no')+'" data-pbuy="'+p.id+'" title="Buy one"><svg class="ic"><use href="#i-chip"/></svg>'+p.cost+'</button>'+
        '</div>';
    }
    h+='</div>';
    h+='<button class="btn white wide" data-bvault="1" style="margin-top:8px"><svg class="ic"><use href="#i-gift"/></svg>Booster bundles in the Vault</button>';
  }
  $('lc-body').innerHTML=h;
  $('btn-lc-play').dataset.lvl=l;
  var slots=$('lc-body').querySelectorAll('.ps-main');
  for(i=0;i<slots.length;i++){
    slots[i].addEventListener('click',(function(id){
      return function(){
        A.init();A.btn();
        if(pwCount(id)<=0){toast('lock','coral','None owned','Buy some with the + button or in the Vault');return;}
        toggleBoosterEquip(id);
        renderLevelCard(l);renderMenuBoosters();
      };
    })(slots[i].dataset.pw));
  }
  wireBoosters($('lc-body'));
}
/* ================= modes overlay ================= */
function renderModes(){
  var h='',i;
  for(i=0;i<MODES.length;i++){
    var m=MODES[i],un=unlocked(m.id),best=S.modes[m.id]||0;
    h+='<button class="mode-card'+(un?'':' lock')+'" data-mode="'+m.id+'">'+
      '<span class="mc-ic" style="background:var(--'+m.tone+');box-shadow:0 3px 0 var(--'+m.tone+'-edge)"><svg class="ic"><use href="#i-'+m.ic+'"/></svg></span>'+
      '<span class="mc-t"><b>'+m.name+'</b><span>'+(un?m.desc:'Unlocks at '+UNLOCK_TXT[m.id])+'</span></span>'+
      (un?(best?'<span class="mc-best">BEST '+nf(best)+'</span>':'<span class="mc-go"><svg class="ic"><use href="#i-play"/></svg></span>'):'<span class="mc-go"><svg class="ic"><use href="#i-lock"/></svg></span>')+
      '</button>';
  }
  h+='<div class="unlock-note" style="margin-top:12px"><svg class="ic"><use href="#i-spark"/></svg>Modes are endless practice. Campaign stars &amp; mastery stay the main path.</div>';
  $('modes-list').innerHTML=h;
  var cards=$('modes-list').querySelectorAll('.mode-card');
  for(i=0;i<cards.length;i++){
    cards[i].addEventListener('click',(function(id){
      return function(){
        A.init();A.btn();
        if(!unlocked(id)){toast('lock','coral','Locked mode','Unlocks at '+UNLOCK_TXT[id]);A.warn();return;}
        closeAllOv();clrT();
        startRun({mode:id});
      };
    })(cards[i].dataset.mode));
  }
}
/* ================= daily overlay ================= */
function renderDaily(){
  var d=dailySpec(),dd=S.ddata,today=todayKey(),doneToday=dd.lastdone===today;
  var h='';
  h+='<div class="daily-hero '+(doneToday?'done':'')+'">'+
     (doneToday?'<span class="dh-medal"><svg class="ic"><use href="#i-medal"/></svg></span>':'')+
     '<h3>DAILY MATRIX</h3><div class="dh-sub">'+d.key+' · 5 rounds · same seed for everyone</div>'+
     '<div class="dh-stars"><i class="on"><svg class="ic"><use href="#i-check"/></svg></i><i></i><i></i><i></i><i></i></div>'+
     '</div>';
  h+='<div class="mod-wrap">';
  for(var i=0;i<d.mods.length;i++)h+='<span class="mod-chip"><svg class="ic"><use href="#i-'+d.mods[i].ic+'"/></svg>'+d.mods[i].name+'</span>';
  h+='</div>';
  h+='<div class="sgrid" style="margin-top:14px">'+
     '<div class="plate"><span class="lbl">Daily Streak</span><span class="val">'+S.dstreak+'</span></div>'+
     '<div class="plate"><span class="lbl">Today Best</span><span class="val">'+nf(dd.todayDate===today?(dd.today||0):0)+'</span></div>'+
     '<div class="plate"><span class="lbl">Best Medal</span><span class="val" style="text-transform:capitalize">'+(dd.medal||'—')+'</span></div>'+
     '<div class="plate"><span class="lbl">Runs</span><span class="val">'+(dd.runs||0)+'</span></div>'+
     '</div>';
  if(!unlocked('daily'))h+='<div class="unlock-note" style="margin-top:12px"><svg class="ic"><use href="#i-lock"/></svg>Daily Matrix unlocks at Level 12. You are at Level '+S.maxlvl+'.</div>';
  else if(doneToday)h+='<div class="unlock-note" style="margin-top:12px"><svg class="ic"><use href="#i-check"/></svg>Today\'s daily is cleared — replay it for a bigger score!</div>';
  h+='<div class="unlock-note"><svg class="ic"><use href="#i-medal"/></svg>Bronze: finish · Silver: '+nf(d.mods.some(function(m){return m.id==='double';})?2040:1200)+' · Gold: '+nf(d.mods.some(function(m){return m.id==='double';})?3400:2000)+'</div>';
  $('daily-body').innerHTML=h;
  $('btn-daily-play').style.opacity=unlocked('daily')?'':'0.5';
}
/* ================= vault ================= */
function renderVault(){
  var h='',i;
  h+='<div class="tokrow"><span class="tk"><svg class="ic"><use href="#i-chip"/></svg></span><b>'+nf(S.tok)+'</b><span>Memory Tokens  •  '+nf(S.tokAll||0)+' earned all-time</span></div>';
  /* -------- BOOSTERS: the first thing in the Vault, impossible to miss -------- */
  var eqn=S.pweq.length,totalOwn=0;
  for(i=0;i<PWR.length;i++)totalOwn+=pwCount(PWR[i].id);
  h+='<div class="bsthead'+(totalOwn?'':' empty')+'">'+
     '<span class="bh-ic"><svg class="ic"><use href="#i-shield"/></svg></span>'+
     '<span class="bh-t"><b>BOOSTERS</b><span>BUY WITH TOKENS • EQUIP 2 PER RUN</span></span>'+
     '<span class="bh-n">'+totalOwn+' OWNED</span></div>';
  if(unlocked('powerups')){
    for(i=0;i<PWR.length;i++)h+=boosterCard(PWR[i]);
    h+='<div class="unlock-note"><svg class="ic"><use href="#i-chip"/></svg>Bundles save tokens: ×3 costs 10% less, ×5 costs 20% less. Tokens are only ever earned by playing.</div>';
  }else{
    h+='<div class="unlock-note"><svg class="ic"><use href="#i-lock"/></svg>Boosters unlock at Level 6. You are at Level '+S.maxlvl+'.</div>';
  }
  h+='<div class="sect-title"><svg class="ic"><use href="#i-trophy"/></svg>Boss Badges — '+S.bosses.length+' / '+Object.keys(BOSSES).length+'</div><div class="bdg-grid">';
  for(i=0;i<NCH;i++){
    var l=chLast(i),b=BOSSES[l],won=S.bosses.indexOf(l)>=0;
    h+='<div class="bdg'+(won?' won b'+((i%5)+1):' locked')+'"><span class="bdg-ic"><svg class="ic"><use href="#i-'+(won?b.ic:'lock')+'"/></svg></span><b>'+(won?b.badge:'???')+'</b><span>World '+(i+1)+' • Level '+l+' — '+(won?'defeated':b.name)+'</span></div>';
  }
  h+='</div>';
  h+='<div class="sessline"><svg class="ic"><use href="#i-clock"/></svg>Session '+fmtClock(S.sessRun)+
     ' &bull; Today '+fmtClock(sessTodayVal())+' &bull; Best '+fmtClock(S.sessBest)+'</div>';
  h+='<div class="sect-title"><svg class="ic"><use href="#i-star"/></svg>Collectibles &amp; Progress</div><div class="sgrid">'+
     '<div class="plate"><span class="lbl">Stars</span><span class="val">'+starTotal()+' / '+(3*MAXLVL)+'</span></div>'+
     '<div class="plate"><span class="lbl">Mastery Badges</span><span class="val">'+masteryCount()+' / '+MAXLVL+'</span></div>'+
     '<div class="plate"><span class="lbl">Objectives</span><span class="val">'+objDone()+' / '+(4*MAXLVL)+'</span></div>'+
     '<div class="plate"><span class="lbl">3-Star Levels</span><span class="val">'+star3Count()+' / '+MAXLVL+'</span></div>'+
     '</div>';
  $('vault-body').innerHTML=h;
  wireBoosters($('vault-body'));
}
/* one big booster card, used in the Vault */
function boosterCard(p){
  var own=pwCount(p.id),eq=S.pweq.indexOf(p.id)>=0,i,h='',n,c,can;
  h+='<div class="bst'+(eq?' eq':'')+(own?'':' out')+'">';
  h+='<div class="bst-top"><span class="pu-ic" style="background:var(--'+p.tone+');box-shadow:0 3px 0 var(--'+p.tone+'-edge)"><svg class="ic"><use href="#i-'+p.ic+'"/></svg></span>'+
     '<span class="bst-t"><b>'+p.name+'</b><span>'+p.desc+'</span></span>'+
     '<span class="bst-own">×'+own+'</span></div>';
  h+='<div class="bst-kind">'+(p.kind==='active'?'<svg class="ic"><use href="#i-play"/></svg>TAP IT DURING A ROUND':'<svg class="ic"><use href="#i-shield"/></svg>WORKS ALL RUN ONCE EQUIPPED')+'</div>';
  h+='<div class="bst-buy">';
  var bundles=[1,3,5];
  for(i=0;i<bundles.length;i++){
    n=bundles[i];c=bundleCost(p,n);can=S.tok>=c;
    h+='<button class="bst-b'+(can?'':' no')+'" data-bbuy="'+p.id+'" data-bn="'+n+'">'+
       '<svg class="ic"><use href="#i-chip"/></svg>'+nf(c)+
       '<b>×'+n+(bundleSave(p,n)?'  −'+bundleSave(p,n)+'%':'')+'</b></button>';
  }
  h+='</div>';
  h+='<button class="bst-eq'+(eq?' equipped':'')+'" data-beq="'+p.id+'">'+
     (eq?'<svg class="ic"><use href="#i-check"/></svg>EQUIPPED — TAP TO REMOVE':'EQUIP FOR RUNS · '+S.pweq.length+' / 2 SLOTS USED')+'</button>';
  if(!own)h+='<div class="bst-warn"><svg class="ic"><use href="#i-warn"/></svg>You own none — buy a bundle above</div>';
  h+='</div>';
  return h;
}
/* shared wiring for any container that holds booster controls */
function wireBoosters(root){
  if(!root)return;
  var i,els;
  els=root.querySelectorAll('[data-bbuy]');
  for(i=0;i<els.length;i++){
    els[i].addEventListener('click',(function(id,n){
      return function(){if(buyBooster(id,n))refreshBoosterUI();};
    })(els[i].dataset.bbuy,parseInt(els[i].dataset.bn,10)));
  }
  els=root.querySelectorAll('[data-beq]');
  for(i=0;i<els.length;i++){
    els[i].addEventListener('click',(function(id){
      return function(){A.init();A.btn();toggleBoosterEquip(id);refreshBoosterUI();};
    })(els[i].dataset.beq));
  }
  els=root.querySelectorAll('[data-bquick]');
  for(i=0;i<els.length;i++){
    els[i].addEventListener('click',(function(id){
      return function(){
        A.init();A.btn();
        if(pwCount(id)<=0){if(buyBooster(id,1))refreshBoosterUI();return;}
        renderVault();openOv('ov-vault');
      };
    })(els[i].dataset.bquick));
  }
  els=root.querySelectorAll('[data-bvault]');
  for(i=0;i<els.length;i++){
    els[i].addEventListener('click',function(){A.init();A.btn();renderVault();openOv('ov-vault');});
  }
  els=root.querySelectorAll('[data-pbuy]');
  for(i=0;i<els.length;i++){
    els[i].addEventListener('click',(function(id){
      return function(){if(buyBooster(id,1))refreshBoosterUI();};
    })(els[i].dataset.pbuy));
  }
}
/* menu strip REMOVED (2026-09 request): the booster column above the Play
   button is gone from the home screen. Buy/equip still live in the Vault
   (+ level card + pause briefing), so this only clears the menu slot. */
function renderMenuBoosters(){
  var el=$('m-boost');if(!el)return;
  el.innerHTML='';
}
/* ================= achievements overlay ================= */
var achTab='all';
function renderAch(){
  var tabs='<button class="'+(achTab==='all'?'on':'')+'" data-cat="all">All</button>',i;
  for(i=0;i<CATS.length;i++)tabs+='<button class="'+(achTab===CATS[i].id?'on':'')+'" data-cat="'+CATS[i].id+'">'+CATS[i].name+'</button>';
  $('ach-tabs').innerHTML=tabs;
  var h='',n=0,cur='',shown=0;
  for(i=0;i<ACH.length;i++){
    var a=ACH[i];
    if(achTab!=='all'&&a.cat!==achTab)continue;
    shown++;
    var done=S.ach.indexOf(a.id)>=0;
    if(done)n++;
    var v=Math.min(statVal(a.stat),a.goal),pct=Math.round(v/a.goal*100);
    if(achTab==='all'&&a.cat!==cur){
      cur=a.cat;
      var cat=null,j;for(j=0;j<CATS.length;j++)if(CATS[j].id===cur)cat=CATS[j];
      h+='<div class="ach-cat"><svg class="ic"><use href="#i-'+(cat?cat.ic:'star')+'"/></svg>'+(cat?cat.name.toUpperCase():'')+'</div>';
    }
    h+='<div class="ach'+(done?' done':'')+'"><span class="ach-badge" style="background:var(--'+a.c+');box-shadow:0 3px 0 var(--'+a.c+'-edge)"><svg class="ic"><use href="#i-'+a.icon+'"/></svg></span>'+
      '<span class="ach-info"><span class="ach-name">'+a.name+'</span><span class="ach-desc">'+a.desc+'</span>'+
      '<span class="bar"><i style="width:'+pct+'%"></i></span></span>'+
      '<span class="ach-state">'+(done?'<svg class="ic"><use href="#i-check"/></svg>':(v+' / '+a.goal))+'</span></div>';
  }
  $('ach-list').innerHTML=h;
  $('ach-count').textContent=n+' / '+shown;
  var btns=$('ach-tabs').querySelectorAll('button');
  for(i=0;i<btns.length;i++)btns[i].addEventListener('click',(function(cat){
    return function(){A.btn();achTab=cat;renderAch();};
  })(btns[i].dataset.cat));
}
/* ================= stats overlay ================= */
function plate(l,v){return '<div class="plate"><span class="lbl">'+l+'</span><span class="val">'+v+'</span></div>';}
function renderStats(){
  var i,h='';
  h+='<div class="sect-title"><svg class="ic"><use href="#i-chart"/></svg>Career</div><div class="sgrid">'+
     plate('Best Score',nf(S.best))+plate('Runs',nf(S.games))+
     plate('Tiles Recalled',nf(S.tiles))+plate('Accuracy',(S.tiles+S.wrong>0?Math.round(S.tiles/(S.tiles+S.wrong)*100):0)+'%')+
     plate('Levels Cleared',nf(S.clears))+plate('Tokens Earned',nf(S.tokAll||0))+
     '</div>';
  h+='<div class="sect-title"><svg class="ic"><use href="#i-chip"/></svg>Memory Streaks</div><div class="sgrid">'+
     plate('Best Combo','×'+S.bcombo)+plate('Back-to-Back Taps',nf(S.bestct||0))+
     plate('Best Perfect Levels',nf(S.bpl||0))+plate('Perfect Streak',nf(S.pclear||0))+
     '</div>';
  h+='<div class="sect-title"><svg class="ic"><use href="#i-gauge"/></svg>Speed</div><div class="sgrid">'+
     plate('Fastest Recall',S.rec.fast?(S.rec.fast/1000).toFixed(2)+'s':'—')+
     plate('PERFECT Recalls',nf(S.spd||0))+
     '</div>';
  h+='<div class="sect-title"><svg class="ic"><use href="#i-crown"/></svg>Bosses</div><div class="sgrid">'+
     plate('Bosses Defeated',S.bosses.length+' / '+Object.keys(BOSSES).length)+plate('Boss Streak',nf(S.bboss||0))+
     '</div>';
  h+='<div class="sect-title"><svg class="ic"><use href="#i-clock"/></svg>Play Time</div><div class="sgrid">'+
     plate('Session',fmtClock(S.sessRun))+plate('Today',fmtClock(sessTodayVal()))+
     plate('Best Session',fmtClock(S.sessBest))+plate('Total Played',fmtClock(S.sessAll))+
     '</div>';
  h+='<div class="sect-title"><svg class="ic"><use href="#i-cal"/></svg>Daily</div><div class="sgrid">'+
     plate('Daily Streak',nf(S.dstreak))+plate('Best Daily',nf(S.ddata.best||0))+
     plate('Best Medal',(S.ddata.medal?S.ddata.medal.charAt(0).toUpperCase()+S.ddata.medal.slice(1):'—'))+
     plate('Dailies Played',nf(S.ddata.runs||0))+
     '</div>';
  h+='<div class="sect-title"><svg class="ic"><use href="#i-bolt"/></svg>Mode Best Scores</div><div class="sgrid">';
  for(i=0;i<MODES.length;i++)h+=plate(MODES[i].name,nf(S.modes[MODES[i].id]||0));
  h+='</div>';
  h+='<div class="sect-title"><svg class="ic"><use href="#i-medal"/></svg>Mastery</div><div class="sgrid">'+
     plate('Stars',starTotal()+' / '+(3*MAXLVL))+plate('Mastery Badges',masteryCount()+' / '+MAXLVL)+
     plate('Objectives',objDone()+' / '+(4*MAXLVL))+plate('Highest Level',S.maxlvl+' / '+MAXLVL)+
     '</div>';
  /* online versus — its own record, never mixed with career stats */
  var mp=S.mp||{g:0,w:0,l:0,t:0,best:0};
  h+='<div class="sect-title"><svg class="ic"><use href="#i-globe"/></svg>Online</div><div class="sgrid">'+
     plate('Matches',nf(mp.g))+plate('Wins',nf(mp.w))+
     plate('Draws',nf(mp.t))+plate('Best Score',nf(mp.best||0))+
     '</div>';
  $('stats-body').innerHTML=h;
}
/* ================= settings ================= */
function renderSettings(){
  $('sw-snd').classList.toggle('on',S.snd);
  $('sw-mus').classList.toggle('on',S.mus);
  $('sw-fx').classList.toggle('on',S.fx);
  $('sw-obj').classList.toggle('on',S.showObj);
  $('sw-adapt').classList.toggle('on',S.adapt);
}
function sndIcon(){$('btn-snd').innerHTML='<svg class="ic"><use href="#i-'+((S.snd&&!A.sdkMute)?'sound':'soundoff')+'"/></svg>';}
/* =========================================================
   SHOP • WORLDS • CUSTOMIZATION EXPANSION
   Cosmetic-only systems: everything here is expression,
   collection and prestige. Never score, lives or power.
   ========================================================= */

/* ---------- optional real-asset layer ----------
   If files like assets/shop/tiles/candy.png are added later they can be
   probed and layered over the vector look; missing files fall back to
   the existing CSS/vector rendering automatically.               */
var ASSETS={
  base:'assets/',
  url:function(cat,id){return 'assets/'+cat+'/'+id+'.png';},
  probe:function(cat,id,cb){
    try{var im=new Image();im.onload=function(){cb(true);};im.onerror=function(){cb(false);};im.src=ASSETS.url(cat,id);}
    catch(e){cb(false);}
  }
};

/* ---------- worlds (identity for each chapter) ---------- */
var WORLDS=[
  {n:1,name:'Sunny Start', ic:'sun',  tone:'sky',   col:'#4CB9F2',edge:'#2E92D1',mood:'Bright & cheerful',
   cols:['#FFC93C','#FFFFFF','#4CB9F2'],shapes:['s','c'],
   desc:'Soft skies, rounded clouds and friendly patterns.',boss:'MEMORY LOCK'},
  {n:2,name:'Candy Grove', ic:'candy',tone:'yellow',col:'#FFC93C',edge:'#E0A31E',mood:'Playful & energetic',
   cols:['#FF9E9E','#FF6B6B','#FFC93C','#FFFFFF'],shapes:['c','r','s'],
   desc:'Candy hills and bouncing shapes keep the tempo up.',boss:'DOUBLE PATTERN'},
  {n:3,name:'Ocean Mind',  ic:'wave', tone:'sky',   col:'#3FB0E8',edge:'#2A86BE',mood:'Calm but challenging',
   cols:['#4CB9F2','#9BE3F2','#FFFFFF'],shapes:['c','o'],
   desc:'Slow bubbles drift while the matrix tests your focus.',boss:'DISAPPEARING MATRIX'},
  {n:4,name:'Crystal Cave',ic:'gem',  tone:'coral', col:'#8B7FD6',edge:'#6A5FB0',mood:'Intense & mysterious',
   cols:['#A98BEB','#8B7FD6','#FFFFFF','#4CB9F2'],shapes:['s','r'],
   desc:'Sparkles glint off geometric crystal formations.',boss:'REVERSE RECALL'},
  {n:5,name:'Memory Core', ic:'chip', tone:'coral', col:'#3A4A85',edge:'#243161',mood:'The first final challenge',
   cols:['#4CB9F2','#FFC93C','#FF6B6B','#57CB6C','#FFFFFF'],shapes:['c','r','s'],
   desc:'The Core pulses. Everything you learned, at once.',boss:'THE MEMORY CORE'},
  /* ---- expansion worlds 6-11 ---- */
  {n:6,name:'Neon City',   ic:'bolt',  tone:'sky',   col:'#5A6BE8',edge:'#3B47B8',mood:'Electric & relentless',
   cols:['#5A6BE8','#FF6BD6','#4CB9F2','#FFFFFF'],shapes:['s','l','c'],
   desc:'Neon signs flicker while decoys flood the grid.',boss:'NEON SCRAMBLER'},
  {n:7,name:'Volcano Ridge',ic:'fire', tone:'coral', col:'#FF7A45',edge:'#D9542A',mood:'Hot & dangerous',
   cols:['#FF7A45','#FFC93C','#FF6B6B','#FFFFFF'],shapes:['c','s','r'],
   desc:'Lava bubbles below and danger tiles above.',boss:'MAGMA TITAN'},
  {n:8,name:'Cloudpeak',   ic:'cloud', tone:'sky',   col:'#59C0F0',edge:'#2E93CB',mood:'Airy & bright',
   cols:['#BFE9FF','#FFFFFF','#FFC93C','#9BD4F2'],shapes:['c','o','s'],
   desc:'Floating islands drift while the patterns come in waves.',boss:'STORM SEQUENCE'},
  {n:9,name:'Emerald Jungle',ic:'leaf',tone:'green', col:'#4FB25C',edge:'#3A8F49',mood:'Dense & tricky',
   cols:['#5FBE6E','#8FD97A','#FFFFFF','#FFC93C'],shapes:['c','s','r'],
   desc:'Vines hide the tiles and the board keeps shifting.',boss:'VINE TANGLE'},
  {n:10,name:'Galaxy Drift',ic:'planet',tone:'coral',col:'#A98BEB',edge:'#7F6FC8',mood:'Vast & backwards',
   cols:['#A98BEB','#FFC93C','#FFFFFF','#4CB9F2'],shapes:['s','c','o'],
   desc:'Recall the pattern in reverse across deep space.',boss:'SUPERNOVA'},
  {n:11,name:'Time Nexus', ic:'clock', tone:'yellow',col:'#FF9E5E',edge:'#D9702F',mood:'The last stand',
   cols:['#FF9E5E','#A98BEB','#4CB9F2','#FFC93C','#FFFFFF'],shapes:['c','s','l','r'],
   desc:'Every trick the Matrix knows, all at once.',boss:'TIME NEXUS'}
];
function curWorld(){
  if(R.mode==='campaign'&&R.level)return chOf(R.level)+1;
  return chOf(Math.min(S.maxlvl,MAXLVL))+1;
}
function applyWorldCtx(){
  var g=$('scr-game');if(!g)return;
  var w=curWorld(),cs=g.className.split(' '),i;
  for(i=cs.length-1;i>=0;i--)if(/^w\d+$/.test(cs[i]))g.classList.remove(cs[i]);
  g.classList.add('w'+w);
  buildWDecor(w);
  var bd=$('board');
  if(bd){
    bd.classList.toggle('bossrun',!!(R.cfg&&R.cfg.boss));
    bd.classList.toggle('w5pulse',w===5&&!!(R.cfg&&R.cfg.boss));
  }
}
function buildWDecor(w){
  var d=$('wdecor');if(!d)return;
  var h='';
  if(w===1){
    h+='<div class="wd-cloud wd-float" style="width:86px;height:26px;top:11%;left:4%"></div>';
    h+='<div class="wd-cloud wd-float2" style="width:62px;height:20px;top:20%;right:5%"></div>';
    h+='<div class="wd-cloud wd-float" style="width:50px;height:16px;bottom:15%;left:7%;animation-delay:1.2s"></div>';
    h+='<span class="wd-star wd-twinkle" style="width:16px;height:16px;top:30%;left:12%"><svg viewBox="0 0 24 24"><use href="#i-star"/></svg></span>';
    h+='<span class="wd-star wd-twinkle" style="width:12px;height:12px;top:15%;right:18%;animation-delay:.9s"><svg viewBox="0 0 24 24"><use href="#i-star"/></svg></span>';
    h+='<span class="wd-star wd-twinkle" style="width:14px;height:14px;bottom:22%;right:9%;animation-delay:1.7s"><svg viewBox="0 0 24 24"><use href="#i-spark"/></svg></span>';
  }else if(w===2){
    h+='<div class="wd-hill" style="width:170px;height:78px;bottom:-26px;left:-34px;background:#FF9E9E"></div>';
    h+='<div class="wd-hill" style="width:130px;height:60px;bottom:-22px;right:-24px;background:#FFC93C"></div>';
    h+='<div class="wd-hill" style="width:96px;height:46px;bottom:-20px;left:36%;background:#57CB6C"></div>';
    h+='<span class="wd-hop" style="width:14px;height:14px;border-radius:50%;background:#FF6B6B;top:16%;left:9%"></span>';
    h+='<span class="wd-hop" style="width:11px;height:11px;border-radius:50%;background:#4CB9F2;top:24%;right:11%;animation-delay:.5s"></span>';
    h+='<span class="wd-hop" style="width:12px;height:12px;border-radius:5px;background:#FFC93C;bottom:28%;left:14%;animation-delay:1s"></span>';
    h+='<span class="wd-hop" style="width:10px;height:10px;border-radius:50%;background:#57CB6C;bottom:34%;right:15%;animation-delay:1.5s"></span>';
  }else if(w===3){
    h+='<div class="wd-waveb" style="width:130%;height:74px;bottom:-28px;left:-15%;background:#9BD4F2"></div>';
    h+='<div class="wd-waveb" style="width:130%;height:54px;bottom:-30px;left:-30%;background:#4CB9F2"></div>';
    h+='<span class="wd-bubble wd-rise" style="width:16px;height:16px;bottom:10%;left:10%"></span>';
    h+='<span class="wd-bubble wd-rise" style="width:22px;height:22px;bottom:6%;left:28%;animation-delay:2.4s"></span>';
    h+='<span class="wd-bubble wd-rise" style="width:13px;height:13px;bottom:12%;right:26%;animation-delay:4.1s"></span>';
    h+='<span class="wd-bubble wd-rise" style="width:18px;height:18px;bottom:8%;right:9%;animation-delay:5.6s"></span>';
  }else if(w===4){
    h+='<span class="wd-gem wd-float" style="width:30px;height:30px;background:#A98BEB;top:12%;left:6%"></span>';
    h+='<span class="wd-gem wd-float2" style="width:20px;height:20px;background:#8B7FD6;top:22%;right:8%"></span>';
    h+='<span class="wd-gem wd-float" style="width:24px;height:24px;background:#4CB9F2;bottom:16%;left:10%;animation-delay:1.3s"></span>';
    h+='<span class="wd-gem wd-float2" style="width:16px;height:16px;background:#A98BEB;bottom:26%;right:12%"></span>';
    h+='<span class="wd-star wd-twinkle" style="width:14px;height:14px;top:34%;left:16%;color:#8B7FD6"><svg viewBox="0 0 24 24"><use href="#i-spark"/></svg></span>';
    h+='<span class="wd-star wd-twinkle" style="width:12px;height:12px;bottom:34%;right:18%;color:#8B7FD6;animation-delay:1.4s"><svg viewBox="0 0 24 24"><use href="#i-spark"/></svg></span>';
  }else if(w===5){
    h+='<div class="wd-core wd-spin" style="width:240px;height:240px;top:50%;left:50%;margin:-120px 0 0 -120px"></div>';
    h+='<div class="wd-core wd-spin" style="width:320px;height:320px;top:50%;left:50%;margin:-160px 0 0 -160px;animation-direction:reverse;border-color:rgba(255,201,60,.22)"></div>';
    h+='<span class="wd-minitile wd-float" style="width:16px;height:16px;background:#4CB9F2;top:13%;left:8%"></span>';
    h+='<span class="wd-minitile wd-float2" style="width:13px;height:13px;background:#FFC93C;top:21%;right:10%"></span>';
    h+='<span class="wd-minitile wd-float" style="width:14px;height:14px;background:#FF6B6B;bottom:18%;left:12%;animation-delay:1s"></span>';
    h+='<span class="wd-minitile wd-float2" style="width:12px;height:12px;background:#57CB6C;bottom:25%;right:8%"></span>';
  }else if(w===6){                                    /* Neon City */
    h+='<span class="wd-neon wd-flick" style="width:9px;height:78px;top:14%;left:5%;background:#FF6BD6"></span>';
    h+='<span class="wd-neon wd-flick" style="width:9px;height:54px;top:24%;left:11%;background:#4CB9F2;animation-delay:.7s"></span>';
    h+='<span class="wd-neon wd-flick" style="width:9px;height:70px;bottom:16%;right:6%;background:#5A6BE8;animation-delay:1.4s"></span>';
    h+='<span class="wd-neon wd-flick" style="width:9px;height:44px;bottom:24%;right:12%;background:#FFC93C;animation-delay:2.1s"></span>';
    h+='<div class="wd-hill" style="width:150px;height:70px;bottom:-24px;left:-30px;background:#3B4790"></div>';
    h+='<div class="wd-hill" style="width:120px;height:56px;bottom:-22px;right:-22px;background:#2E3772"></div>';
    h+='<span class="wd-star wd-twinkle" style="width:14px;height:14px;top:30%;left:20%;color:#FF6BD6"><svg viewBox="0 0 24 24"><use href="#i-spark"/></svg></span>';
    h+='<span class="wd-star wd-twinkle" style="width:12px;height:12px;bottom:30%;right:20%;color:#4CB9F2;animation-delay:1.1s"><svg viewBox="0 0 24 24"><use href="#i-spark"/></svg></span>';
  }else if(w===7){                                    /* Volcano Ridge */
    h+='<div class="wd-hill" style="width:210px;height:96px;bottom:-34px;left:-40px;background:#B9432A"></div>';
    h+='<div class="wd-hill" style="width:150px;height:70px;bottom:-26px;right:-30px;background:#8E2F1F"></div>';
    h+='<span class="wd-ember wd-rise" style="width:9px;height:9px;bottom:6%;left:16%"></span>';
    h+='<span class="wd-ember wd-rise" style="width:6px;height:6px;bottom:4%;left:34%;animation-delay:1.8s"></span>';
    h+='<span class="wd-ember wd-rise" style="width:8px;height:8px;bottom:8%;right:28%;animation-delay:3.2s"></span>';
    h+='<span class="wd-ember wd-rise" style="width:5px;height:5px;bottom:5%;right:11%;animation-delay:4.6s"></span>';
    h+='<span class="wd-star wd-twinkle" style="width:13px;height:13px;top:20%;left:12%;color:#FF7A45"><svg viewBox="0 0 24 24"><use href="#i-fire"/></svg></span>';
  }else if(w===8){                                    /* Cloudpeak */
    h+='<div class="wd-cloud wd-float" style="width:110px;height:34px;top:10%;left:3%"></div>';
    h+='<div class="wd-cloud wd-float2" style="width:78px;height:24px;top:19%;right:6%"></div>';
    h+='<div class="wd-cloud wd-float" style="width:60px;height:20px;bottom:12%;left:9%;animation-delay:1.5s"></div>';
    h+='<div class="wd-hill" style="width:170px;height:84px;bottom:-30px;right:-34px;background:#CFE9F8"></div>';
    h+='<span class="wd-star wd-twinkle" style="width:16px;height:16px;top:26%;left:18%;color:#FFC93C"><svg viewBox="0 0 24 24"><use href="#i-sun"/></svg></span>';
    h+='<span class="wd-star wd-twinkle" style="width:12px;height:12px;bottom:26%;right:16%;animation-delay:1.2s"><svg viewBox="0 0 24 24"><use href="#i-spark"/></svg></span>';
  }else if(w===9){                                    /* Emerald Jungle */
    h+='<div class="wd-hill" style="width:190px;height:88px;bottom:-30px;left:-36px;background:#4FB25C"></div>';
    h+='<div class="wd-hill" style="width:140px;height:64px;bottom:-24px;right:-26px;background:#3A8F49"></div>';
    h+='<span class="wd-leaf wd-rise" style="width:15px;height:15px;bottom:8%;left:14%"></span>';
    h+='<span class="wd-leaf wd-rise" style="width:11px;height:11px;bottom:5%;left:31%;animation-delay:2.2s"></span>';
    h+='<span class="wd-leaf wd-rise" style="width:13px;height:13px;bottom:9%;right:26%;animation-delay:3.9s"></span>';
    h+='<span class="wd-leaf wd-rise" style="width:10px;height:10px;bottom:6%;right:10%;animation-delay:5.2s"></span>';
    h+='<span class="wd-star wd-twinkle" style="width:13px;height:13px;top:18%;right:14%;color:#8FD97A"><svg viewBox="0 0 24 24"><use href="#i-spark"/></svg></span>';
  }else if(w===10){                                   /* Galaxy Drift */
    h+='<div class="wd-core wd-spin" style="width:280px;height:280px;top:50%;left:50%;margin:-140px 0 0 -140px;border-color:rgba(169,139,235,.3);border-radius:50%"></div>';
    h+='<span class="wd-planet wd-float" style="width:34px;height:34px;top:15%;left:8%"></span>';
    h+='<span class="wd-planet wd-float2" style="width:22px;height:22px;top:26%;right:10%;background:#FF9E9E"></span>';
    h+='<span class="wd-planet wd-float" style="width:16px;height:16px;bottom:20%;left:14%;background:#FFC93C;animation-delay:1.6s"></span>';
    h+='<span class="wd-star wd-twinkle" style="width:15px;height:15px;top:34%;left:22%"><svg viewBox="0 0 24 24"><use href="#i-star"/></svg></span>';
    h+='<span class="wd-star wd-twinkle" style="width:11px;height:11px;bottom:30%;right:18%;animation-delay:.8s"><svg viewBox="0 0 24 24"><use href="#i-star"/></svg></span>';
    h+='<span class="wd-star wd-twinkle" style="width:13px;height:13px;bottom:14%;right:32%;animation-delay:1.9s"><svg viewBox="0 0 24 24"><use href="#i-spark"/></svg></span>';
  }else{                                              /* Time Nexus */
    h+='<div class="wd-core wd-spin" style="width:250px;height:250px;top:50%;left:50%;margin:-125px 0 0 -125px;border-color:rgba(255,122,69,.26);border-radius:50%"></div>';
    h+='<div class="wd-core wd-spin" style="width:340px;height:340px;top:50%;left:50%;margin:-170px 0 0 -170px;animation-direction:reverse;border-color:rgba(169,139,235,.22);border-radius:50%"></div>';
    h+='<span class="wd-clockhand wd-tick" style="top:50%;left:50%;width:4px;height:66px;margin:-66px 0 0 -2px"></span>';
    h+='<span class="wd-minitile wd-float" style="width:15px;height:15px;background:#FF7A45;top:12%;left:9%"></span>';
    h+='<span class="wd-minitile wd-float2" style="width:12px;height:12px;background:#A98BEB;top:20%;right:11%"></span>';
    h+='<span class="wd-minitile wd-float" style="width:13px;height:13px;background:#4CB9F2;bottom:17%;left:13%;animation-delay:1.2s"></span>';
    h+='<span class="wd-minitile wd-float2" style="width:11px;height:11px;background:#FFC93C;bottom:24%;right:9%"></span>';
    h+='<span class="wd-ember wd-rise" style="width:6px;height:6px;bottom:4%;left:24%"></span>';
    h+='<span class="wd-ember wd-rise" style="width:5px;height:5px;bottom:6%;right:22%;animation-delay:2.6s"></span>';
  }
  d.innerHTML=h;
}
function worldBurst(c){
  var w=WORLDS[c],x=window.innerWidth/2,y=window.innerHeight*0.36;
  FX.fountain(x,y,42,w.cols);
  setTimeout(function(){FX.fountain(x-60,y+40,22,w.cols);},220);
  setTimeout(function(){FX.fountain(x+60,y+40,22,w.cols);},420);
}
function ambientTick(){
  if(!S.fx||document.hidden)return;
  var g=$('scr-game');
  if(!g||!g.classList.contains('on'))return;
  var w=WORLDS[curWorld()-1];
  FX.burst(rnd(window.innerWidth*.08,window.innerWidth*.92),rnd(window.innerHeight*.22,window.innerHeight*.8),
    {n:2,colors:w.cols,sp:.5,g:.01,size:3.4,shapes:w.shapes});
  /* cosmetic drift effects */
  if(S.eq.fx==='starrain'){
    FX.burst(rnd(window.innerWidth*.06,window.innerWidth*.94),window.innerHeight*.16,
      {n:1,colors:['#FFC93C','#FFE29A','#FFFFFF'],sp:.4,g:.05,size:4.2,shapes:['s']});
  }else if(S.eq.fx==='confettirain'){
    FX.burst(rnd(window.innerWidth*.06,window.innerWidth*.94),window.innerHeight*.14,
      {n:2,colors:['#4CB9F2','#FFC93C','#FF6B6B','#57CB6C'],sp:.5,g:.05,size:3.6,shapes:['r','r','c']});
  }
}
/* one-shot cosmetic hooks */
function fxLevelStart(){
  if(!S.fx||S.eq.fx!=='levelstart')return;
  var bc=boardTopCenter();
  FX.burst(bc.x,bc.y,{n:12,colors:['#4CB9F2','#FFC93C','#FF6B6B','#57CB6C','#FFFFFF'],sp:3.4,g:.06,size:4,shapes:['r','r','c','s']});
}
function fxComboSparkle(){
  if(!S.fx||S.eq.fx!=='combosparkle'||R.combo<5)return;
  var bc=boardTopCenter();
  FX.burst(bc.x,bc.y,{n:3,colors:['#FFC93C','#FFE29A','#FFFFFF'],ang:-Math.PI/2,spread:1.1,sp:2,g:.04,size:3.4,shapes:['s','s','c']});
}
function fxVictoryRing(){
  if(!S.fx||S.eq.fx!=='victoryring')return;
  var bc=boardCenter(),i,a,r=92;
  for(i=0;i<14;i++){
    a=(i/14)*Math.PI*2;
    FX.burst(bc.x+Math.cos(a)*r,bc.y+Math.sin(a)*r,{n:1,colors:['#FFC93C','#FFFFFF','#4CB9F2'],sp:.5,g:.01,size:4.4,shapes:['s','c']});
  }
}

/* ---------- particle packs / trails / sound packs (cosmetic) ---------- */
var PACKFX={
  classicburst:{c:['#57CB6C','#8FE09C','#FFFFFF','#FFC93C'],s:['c','r','s']},
  starburst:{c:['#FFC93C','#FFE29A','#FFFFFF'],s:['s','c']},
  confetti:{c:['#4CB9F2','#FFC93C','#FF6B6B','#57CB6C','#FFFFFF'],s:['r','r','c','s']},
  sparkle:{c:['#9BD4F2','#4CB9F2','#FFFFFF'],s:['s','s','c']},
  leafburst:{c:['#57CB6C','#8FD97A','#FFFFFF','#FFC93C'],s:['c','s']},
  bubblepop:{c:['#9BE3F2','#4CB9F2','#FFFFFF'],s:['c','o','c']},
  candyburst:{c:['#FF9E9E','#FF6B6B','#FFC93C','#FFFFFF'],s:['c','r','s']},
  lightningpop:{c:['#5AA8F0','#9BD4F2','#FFFFFF','#FFC93C'],s:['l','l','c']},
  crownburst:{c:['#FFC93C','#FFE29A','#FFFFFF'],s:['s','c','r']},
  neonpop:{c:['#FF6BD6','#5A6BE8','#4CB9F2','#FFFFFF'],s:['s','l','c']},
  emberburst:{c:['#FF7A45','#FFC93C','#FF6B6B','#FFFFFF'],s:['c','s']},
  cloudpuff:{c:['#FFFFFF','#DCEEFB','#9BD4F2'],s:['c','c','o']},
  stardust:{c:['#A98BEB','#FFC93C','#FFFFFF','#4CB9F2'],s:['s','s','c']},
  chronoburst:{c:['#FF7A45','#A98BEB','#FFFFFF'],s:['c','l','s']}
};
function pcols(){var p=PACKFX[S.eq.parts]||PACKFX.classicburst;return p.c;}
function pshapes(){var p=PACKFX[S.eq.parts]||PACKFX.classicburst;return p.s;}
var TRAILFX={
  startrail:{c:['#FFC93C','#FFFFFF'],s:['s'],n:5},
  sparktrail:{c:['#FFE29A','#FFC93C','#FFFFFF'],s:['l','c'],n:6},
  bubbletrail:{c:['#9BE3F2','#FFFFFF'],s:['o','c'],n:5},
  leaftrail:{c:['#57CB6C','#8FD97A'],s:['c','s'],n:5},
  lightningtrail:{c:['#5AA8F0','#FFFFFF'],s:['l'],n:6},
  rainbowtrail:{c:['#FF6B6B','#FFC93C','#57CB6C','#4CB9F2','#A98BEB'],s:['c'],n:8},
  neontrail:{c:['#FF6BD6','#5A6BE8','#FFFFFF'],s:['l','c'],n:6},
  embertrail:{c:['#FF7A45','#FFC93C'],s:['c','s'],n:6},
  cloudtrail:{c:['#FFFFFF','#CFE9F8'],s:['c','o'],n:5},
  comettrail:{c:['#A98BEB','#FFFFFF','#FFC93C'],s:['s','c'],n:7},
  chronotrail:{c:['#FF7A45','#A98BEB','#4CB9F2','#FFFFFF'],s:['c','s','l'],n:8}
};
function spawnTrail(p){
  var t=TRAILFX[S.eq.trails];
  if(!t||!R.lastHit||!S.fx)return;
  var a=R.lastHit,i,k;
  for(i=1;i<=t.n;i++){
    k=i/(t.n+1);
    FX.burst(a.x+(p.x-a.x)*k,a.y+(p.y-a.y)*k,{n:1,colors:t.c,sp:.35,g:.015,size:3.2,shapes:t.s});
  }
}
function tapRipple(p){
  if(S.eq.fx!=='tapripples'||!S.fx)return;
  FX.burst(p.x,p.y,{n:2,colors:['#FFFFFF','#9BD4F2'],sp:1.1,g:0,size:5,shapes:['o','o']});
}
function comboFlames(){
  if(S.eq.fx!=='comboflames'||!S.fx||R.combo<5)return;
  var bc=boardTopCenter();
  FX.burst(bc.x,bc.y,{n:3,colors:['#FFC93C','#FF6B6B','#FFE29A'],ang:-Math.PI/2,spread:.9,sp:2.2,up:1,shapes:['s','c']});
}
var SNDPACKS={
  'snd-classic':{},
  'snd-arcade':{type:'square',f:1.12,v:.8},
  'snd-mellow':{f:.86,v:1.15},
  'snd-sparkle':{type:'triangle',f:1.25,v:.9},
  'snd-chiptune':{type:'square',f:1.18,v:.62},
  'snd-bubble':{type:'sine',f:.78,v:1.2},
  'snd-jungle':{type:'triangle',f:.92,v:1.05},
  'snd-thunder':{type:'sawtooth',f:.68,v:.8},
  'snd-crystal':{type:'triangle',f:1.42,v:.72},
  'snd-musicbox':{type:'triangle',f:1.55,v:.55},
  'snd-cosmic':{type:'sine',f:1.12,v:.85}
};

/* ---------- the catalog: 75 cosmetics ---------- */
var COS=[
/* TILE SKINS (17) */
{id:'classic',cat:'tiles',name:'Classic',d:'The original sky-blue matrix tiles.',r:'common',p:0},
{id:'candy',cat:'tiles',name:'Candy',d:'Sweet pink tiles with sugar dots.',r:'common',p:50},
{id:'puzzle',cat:'tiles',name:'Puzzle',d:'Fresh green tiles with puzzle knobs.',r:'common',p:50},
{id:'bubble',cat:'tiles',name:'Bubble',d:'Light blue tiles with a glossy bubble.',r:'common',p:50},
{id:'leaf',cat:'tiles',name:'Leaf',d:'Grass green tiles with a little leaf.',r:'common',p:50},
{id:'cloud',cat:'tiles',name:'Cloud',d:'Soft sky tiles with a puff of cloud.',r:'common',p:50},
{id:'marble',cat:'tiles',name:'Marble',d:'Cool stone tiles with gentle swirls.',r:'rare',p:100},
{id:'star',cat:'tiles',name:'Star',d:'Sunny yellow tiles stamped with stars.',r:'rare',p:100},
{id:'lightning',cat:'tiles',name:'Lightning',d:'Deep blue tiles with a bolt mark.',r:'rare',p:100},
{id:'cookie',cat:'tiles',name:'Cookie',d:'Warm baked tiles with choc chips.',r:'rare',p:100},
{id:'crystal',cat:'tiles',name:'Crystal',d:'Icy tiles framed like cut crystal.',r:'epic',p:250},
{id:'crown',cat:'tiles',name:'Crown',d:'Royal gold tiles fit for a champion.',r:'epic',p:250,u:{stars:60}},
{id:'sunbeam',cat:'tiles',name:'Sunbeam',d:'World 1 signature — glowing sun tiles.',r:'legendary',p:500,u:{boss:10}},
{id:'candyswirl',cat:'tiles',name:'Candy Swirl',d:'World 2 signature — swirled candy tiles.',r:'legendary',p:500,u:{boss:20}},
{id:'reef',cat:'tiles',name:'Reef',d:'World 3 signature — coral reef tiles.',r:'legendary',p:500,u:{boss:30}},
{id:'geode',cat:'tiles',name:'Geode',d:'World 4 signature — crystal geode tiles.',r:'legendary',p:500,u:{boss:40}},
{id:'coretiles',cat:'tiles',name:'Core Tiles',d:'World 5 signature — straight from the Core.',r:'legendary',p:500,u:{boss:50}},
/* expansion skins — six world signatures plus five new looks */
{id:'neonglow',cat:'tiles',name:'Neon Glow',d:'World 6 signature — electric indigo tiles.',r:'legendary',p:500,u:{boss:62}},
{id:'lavatiles',cat:'tiles',name:'Lava Tiles',d:'World 7 signature — molten orange stone.',r:'legendary',p:500,u:{boss:74}},
{id:'skyglass',cat:'tiles',name:'Sky Glass',d:'World 8 signature — pale glass above the clouds.',r:'legendary',p:500,u:{boss:86}},
{id:'vinetiles',cat:'tiles',name:'Vine Tiles',d:'World 9 signature — leafy jungle green.',r:'legendary',p:500,u:{boss:98}},
{id:'startiles',cat:'tiles',name:'Star Tiles',d:'World 10 signature — violet deep-space stone.',r:'legendary',p:500,u:{boss:110}},
{id:'chronotiles',cat:'tiles',name:'Chrono Tiles',d:'World 11 signature — teal time-crystal.',r:'legendary',p:500,u:{boss:122}},
{id:'sunset',cat:'tiles',name:'Sunset',d:'Warm orange tiles from a long evening.',r:'rare',p:100},
{id:'arctic',cat:'tiles',name:'Arctic',d:'Icy pale tiles with a frost mark.',r:'rare',p:100},
{id:'rose',cat:'tiles',name:'Rose',d:'Soft pink tiles with a little heart.',r:'common',p:50},
{id:'graphite',cat:'tiles',name:'Graphite',d:'Cool grey tiles, sharp and clean.',r:'epic',p:250,u:{lvl:80}},
{id:'hologram',cat:'tiles',name:'Hologram',d:'Shimmering teal tiles with a halo ring.',r:'epic',p:250,u:{combo:25}},
/* BOARD THEMES (10) */
{id:'sunny',cat:'themes',name:'Sunny Field',d:'The classic bright Memory Matrix sky.',r:'common',p:0},
{id:'cloudvalley',cat:'themes',name:'Cloud Valley',d:'Soft clouds over a gentle valley.',r:'common',p:50},
{id:'candygarden',cat:'themes',name:'Candy Garden',d:'Sweet pinks over a candy garden.',r:'common',p:50,u:{lvl:10}},
{id:'snowpeak',cat:'themes',name:'Snow Peak',d:'Crisp whites of a rounded mountain top.',r:'rare',p:100},
{id:'oceanbay',cat:'themes',name:'Ocean Bay',d:'Light blues washed onto a calm bay.',r:'rare',p:100,u:{lvl:20}},
{id:'desertdash',cat:'themes',name:'Desert Dash',d:'Warm sand tones under a big sun.',r:'rare',p:100},
{id:'junglegrove',cat:'themes',name:'Jungle Grove',d:'Fresh greens of a leafy grove.',r:'rare',p:100,u:{lvl:30}},
{id:'crystalcave',cat:'themes',name:'Crystal Cave',d:'Soft violet glow of a crystal cavern.',r:'epic',p:250,u:{boss:40}},
{id:'skykingdom',cat:'themes',name:'Sky Kingdom',d:'Golden clouds above the kingdom.',r:'epic',p:250,u:{stars:90}},
{id:'memorycore',cat:'themes',name:'Memory Core',d:'The intense heart of the Matrix.',r:'legendary',p:500,u:{lvl:50}},
/* expansion themes */
{id:'neoncity',cat:'themes',name:'Neon City',d:'Indigo dusk over a glowing city.',r:'epic',p:250,u:{boss:62}},
{id:'volcanoridge',cat:'themes',name:'Volcano Ridge',d:'Warm ash tones under a smoking ridge.',r:'epic',p:250,u:{boss:74}},
{id:'cloudpeak',cat:'themes',name:'Cloudpeak',d:'Bright whites above the cloud line.',r:'epic',p:250,u:{boss:86}},
{id:'emeraldjungle',cat:'themes',name:'Emerald Jungle',d:'Deep leafy greens of the canopy.',r:'epic',p:250,u:{boss:98}},
{id:'galaxydrift',cat:'themes',name:'Galaxy Drift',d:'Violet starlight across the board.',r:'legendary',p:500,u:{boss:110}},
{id:'timenexus',cat:'themes',name:'Time Nexus',d:'Amber light at the end of everything.',r:'legendary',p:500,u:{boss:122}},
{id:'midnight',cat:'themes',name:'Midnight Blue',d:'A calm deep-blue evening board.',r:'rare',p:100,u:{lvl:60}},
{id:'cottoncandy',cat:'themes',name:'Cotton Candy',d:'Pink sugar skies for sweet recall.',r:'common',p:50},
/* PARTICLE PACKS (9) */
{id:'classicburst',cat:'parts',name:'Classic Burst',d:'The original green & white burst.',r:'common',p:0},
{id:'starburst',cat:'parts',name:'Star Burst',d:'Golden stars fly on every hit.',r:'common',p:50},
{id:'confetti',cat:'parts',name:'Confetti',d:'A party of colorful confetti.',r:'common',p:50},
{id:'sparkle',cat:'parts',name:'Sparkle',d:'Tiny sky-blue sparkles.',r:'rare',p:100},
{id:'leafburst',cat:'parts',name:'Leaf Burst',d:'Fresh green leaves scatter.',r:'rare',p:100},
{id:'bubblepop',cat:'parts',name:'Bubble Pop',d:'Round bubbles pop outward.',r:'rare',p:100},
{id:'candyburst',cat:'parts',name:'Candy Burst',d:'Sweet pink candy pieces.',r:'rare',p:100},
{id:'lightningpop',cat:'parts',name:'Lightning Pop',d:'Electric streaks crackle out.',r:'epic',p:250},
{id:'crownburst',cat:'parts',name:'Crown Burst',d:'Royal gold crowns rain down.',r:'epic',p:250,u:{boss:30}},
/* expansion packs */
{id:'neonpop',cat:'parts',name:'Neon Pop',d:'Electric pink and indigo sparks.',r:'rare',p:100},
{id:'emberburst',cat:'parts',name:'Ember Burst',d:'Hot embers fly off every tap.',r:'rare',p:100},
{id:'cloudpuff',cat:'parts',name:'Cloud Puff',d:'Soft white puffs drift away.',r:'rare',p:100},
{id:'stardust',cat:'parts',name:'Stardust',d:'Violet and gold dust from deep space.',r:'epic',p:250,u:{boss:110}},
{id:'chronoburst',cat:'parts',name:'Chrono Burst',d:'Time shards scatter on impact.',r:'epic',p:250,u:{boss:122}},
/* TRAILS (7) */
{id:'notrail',cat:'trails',name:'No Trail',d:'Clean taps, no trail.',r:'common',p:0},
{id:'startrail',cat:'trails',name:'Star Trail',d:'Stars connect your correct taps.',r:'common',p:50},
{id:'sparktrail',cat:'trails',name:'Spark Trail',d:'Quick golden sparks between taps.',r:'rare',p:100},
{id:'bubbletrail',cat:'trails',name:'Bubble Trail',d:'Bubbles float between taps.',r:'rare',p:100},
{id:'leaftrail',cat:'trails',name:'Leaf Trail',d:'Leaves drift along your path.',r:'rare',p:100},
{id:'lightningtrail',cat:'trails',name:'Lightning Trail',d:'A zap of energy links each tap.',r:'epic',p:250},
{id:'rainbowtrail',cat:'trails',name:'Rainbow Trail',d:'A full palette ribbon between taps.',r:'legendary',p:500,u:{combo:20}},
/* expansion trails */
{id:'neontrail',cat:'trails',name:'Neon Trail',d:'A hot pink wire links your taps.',r:'rare',p:100},
{id:'embertrail',cat:'trails',name:'Ember Trail',d:'Burning embers follow your path.',r:'rare',p:100},
{id:'cloudtrail',cat:'trails',name:'Cloud Trail',d:'Little clouds puff between taps.',r:'rare',p:100},
{id:'comettrail',cat:'trails',name:'Comet Trail',d:'A violet comet tail between taps.',r:'epic',p:250,u:{lvl:90}},
{id:'chronotrail',cat:'trails',name:'Chrono Trail',d:'A ribbon of time links every tap.',r:'legendary',p:500,u:{boss:122}},
/* AVATARS (8) */
{id:'brain',cat:'avatars',name:'Brain',d:'The classic memory brain.',r:'common',p:0},
{id:'cube',cat:'avatars',name:'Memory Cube',d:'A chunky cube of pure recall.',r:'common',p:50},
{id:'starav',cat:'avatars',name:'Star',d:'Shine bright on the menu.',r:'common',p:50},
{id:'robot',cat:'avatars',name:'Robot',d:'Beep boop. Perfect memory installed.',r:'rare',p:100},
{id:'fox',cat:'avatars',name:'Fox',d:'Quick, clever and fluffy.',r:'rare',p:100},
{id:'penguin',cat:'avatars',name:'Penguin',d:'Cool under pattern pressure.',r:'rare',p:100},
{id:'crownav',cat:'avatars',name:'Crown',d:'For royalty of recall.',r:'epic',p:250,u:{boss:10}},
{id:'boltbrain',cat:'avatars',name:'Lightning Brain',d:'A brain charged with lightning.',r:'epic',p:250,u:{combo:20}},
/* expansion avatars */
{id:'owl',cat:'avatars',name:'Owl',d:'Wise eyes for long patterns.',r:'rare',p:100},
{id:'cat',cat:'avatars',name:'Cat',d:'Nine lives, perfect recall.',r:'rare',p:100},
{id:'dragon',cat:'avatars',name:'Dragon',d:'Breathes fire on tough boards.',r:'epic',p:250,u:{boss:74}},
{id:'astro',cat:'avatars',name:'Astronaut',d:'Trained for zero-gravity memory.',r:'epic',p:250,u:{boss:110}},
{id:'ninja',cat:'avatars',name:'Ninja',d:'Silent, quick, never forgets.',r:'epic',p:250,u:{combo:22}},
/* BADGES (8 — earned by playing, never bought) */
{id:'bosshunter',cat:'badges',name:'Boss Hunter',d:'Defeat the World 1 boss.',r:'rare',p:0,u:{boss:10}},
{id:'sharpmind',cat:'badges',name:'Sharp Mind',d:'3-star 10 levels.',r:'rare',p:0,u:{star3:10}},
{id:'starsailor',cat:'badges',name:'Star Sailor',d:'Earn 60 stars.',r:'rare',p:0,u:{stars:60}},
{id:'combocadet',cat:'badges',name:'Combo Cadet',d:'Reach a x15 combo.',r:'rare',p:0,u:{combo:15}},
{id:'perfectpupil',cat:'badges',name:'Perfect Pupil',d:'25 perfect clears in total.',r:'epic',p:0,u:{perfect:25}},
{id:'dailydevotee',cat:'badges',name:'Daily Devotee',d:'Complete 7 Daily Matrices.',r:'epic',p:0,u:{daily:7}},
{id:'worldwalker',cat:'badges',name:'World Walker',d:'Defeat 3 bosses.',r:'epic',p:0,u:{bosses:3}},
{id:'matrixsage',cat:'badges',name:'Matrix Sage',d:'Fully master 10 levels.',r:'legendary',p:0,u:{master:10}},
/* expansion badges — earned, never bought */
{id:'citybreaker',cat:'badges',name:'City Breaker',d:'Defeat the World 6 boss.',r:'rare',p:0,u:{boss:62}},
{id:'ridgewalker',cat:'badges',name:'Ridge Walker',d:'Defeat the World 8 boss.',r:'epic',p:0,u:{boss:86}},
{id:'deepdiver',cat:'badges',name:'Deep Diver',d:'Reach Level 100.',r:'epic',p:0,u:{lvl:100}},
{id:'nexusconqueror',cat:'badges',name:'Nexus Conqueror',d:'Defeat all 11 world bosses.',r:'legendary',p:0,u:{allboss:1}},
/* SOUND PACKS (4) */
{id:'snd-classic',cat:'sounds',name:'Classic Sound',d:'The original cheerful blips.',r:'common',p:0},
{id:'snd-arcade',cat:'sounds',name:'Arcade Sound',d:'Punchy retro arcade bleeps.',r:'rare',p:100},
{id:'snd-mellow',cat:'sounds',name:'Mellow Sound',d:'Softer, deeper tones.',r:'rare',p:100},
{id:'snd-sparkle',cat:'sounds',name:'Sparkle Sound',d:'Bright bells and chimes.',r:'epic',p:250},
/* expansion sound packs */
{id:'snd-chiptune',cat:'sounds',name:'Chiptune',d:'Classic 8-bit square waves.',r:'rare',p:100},
{id:'snd-bubble',cat:'sounds',name:'Bubble',d:'Round, watery low blips.',r:'rare',p:100},
{id:'snd-jungle',cat:'sounds',name:'Jungle Drum',d:'Soft wooden mid tones.',r:'rare',p:100},
{id:'snd-thunder',cat:'sounds',name:'Thunder',d:'Deep rumbling saw waves.',r:'epic',p:250},
{id:'snd-crystal',cat:'sounds',name:'Crystal',d:'Glassy high triangle tones.',r:'epic',p:250},
{id:'snd-musicbox',cat:'sounds',name:'Music Box',d:'Tiny delicate music-box notes.',r:'epic',p:250},
{id:'snd-cosmic',cat:'sounds',name:'Cosmic',d:'Wide airy sine tones.',r:'epic',p:250,u:{boss:110}},
/* EFFECTS (4) */
{id:'menusparkles',cat:'fx',name:'Menu Sparkles',d:'Gentle sparkles drift across the menu.',r:'common',p:50},
{id:'winconfetti',cat:'fx',name:'Win Confetti',d:'Extra confetti on level clears.',r:'common',p:50},
{id:'tapripples',cat:'fx',name:'Tap Ripples',d:'Ripple rings bloom on correct taps.',r:'rare',p:100},
{id:'comboflames',cat:'fx',name:'Combo Flames',d:'Flame licks rise at x5 combo and up.',r:'rare',p:100},
/* expansion effects */
{id:'boardhalo',cat:'fx',name:'Board Halo',d:'A soft ring pulses around the board.',r:'common',p:50},
{id:'neongrid',cat:'fx',name:'Neon Grid',d:'A coloured glow sits behind the board.',r:'common',p:50},
{id:'levelstart',cat:'fx',name:'Level Fanfare',d:'Confetti pops when a level begins.',r:'rare',p:100},
{id:'combosparkle',cat:'fx',name:'Combo Sparkle',d:'Golden sparkles at x5 combo and up.',r:'rare',p:100},
{id:'starrain',cat:'fx',name:'Star Rain',d:'Stars drift down while you play.',r:'rare',p:100},
{id:'confettirain',cat:'fx',name:'Confetti Rain',d:'Colourful confetti drifts while you play.',r:'rare',p:100},
{id:'victoryring',cat:'fx',name:'Victory Ring',d:'A ring of particles marks every clear.',r:'epic',p:250},
/* SPECIAL (8 — legendary prestige, world mastery rewards & endgame) */
{id:'perfectmind',cat:'special',name:'Perfect Mind',d:'A calm green aura on perfect play.',r:'legendary',p:0,u:{world:1}},
{id:'combo100',cat:'special',name:'100 Combo',d:'Your combo chip burns with glory.',r:'legendary',p:0,u:{world:2}},
{id:'ultimaterecall',cat:'special',name:'Ultimate Recall',d:'Correct tiles flare with rainbow light.',r:'legendary',p:0,u:{world:3}},
{id:'corebreaker',cat:'special',name:'Core Breaker',d:'The Core trembles around your board.',r:'legendary',p:0,u:{world:4}},
{id:'worldchampion',cat:'special',name:'World Champion',d:'A champion crown marks your name.',r:'legendary',p:0,u:{world:5}},
{id:'goldenmatrix',cat:'special',name:'Golden Matrix',d:'Your board glows with golden prestige.',r:'legendary',p:600,u:{stars:100}},
{id:'memorymaster',cat:'special',name:'Memory Master',d:'A master ring orbits your avatar.',r:'legendary',p:600,u:{master:15}},
{id:'infinity',cat:'special',name:'Infinity Matrix',d:'Twin rings of sky and coral prestige.',r:'legendary',p:750,u:{allboss:1}},
/* expansion specials — world mastery rewards for worlds 6-11 */
{id:'neonrider',cat:'special',name:'Neon Rider',d:'Indigo and pink neon rings on your board.',r:'legendary',p:0,u:{world:6}},
{id:'volcanoking',cat:'special',name:'Volcano King',d:'Your board smoulders with ember light.',r:'legendary',p:0,u:{world:7}},
{id:'skysovereign',cat:'special',name:'Sky Sovereign',d:'A bright cloud-white glow around the board.',r:'legendary',p:0,u:{world:8}},
{id:'jungleheart',cat:'special',name:'Jungle Heart',d:'Living green light pulses on your board.',r:'legendary',p:0,u:{world:9}},
{id:'galaxylord',cat:'special',name:'Galaxy Lord',d:'Violet and gold rings orbit your board.',r:'legendary',p:0,u:{world:10}},
{id:'timelord',cat:'special',name:'Time Lord',d:'A clock ring orbits your avatar.',r:'legendary',p:0,u:{world:11}}
];
var COSCATS=[
  {id:'tiles',name:'TILE SKINS',ic:'grid'},
  {id:'themes',name:'BOARD THEMES',ic:'layers'},
  {id:'trails',name:'TRAILS',ic:'shuffle'},
  {id:'parts',name:'PARTICLES',ic:'spark'},
  {id:'fx',name:'EFFECTS',ic:'fire'},
  {id:'avatars',name:'AVATARS',ic:'av-brain'},
  {id:'badges',name:'BADGES',ic:'medal'},
  {id:'sounds',name:'SOUND PACKS',ic:'sound'},
  {id:'special',name:'SPECIAL',ic:'crown'}
];
var ICO={
  starburst:['i-star','yellow'],confetti:['i-gift','coral'],sparkle:['i-spark','sky'],leafburst:['i-spark','green'],
  bubblepop:['i-target','sky'],candyburst:['i-candy','coral'],lightningpop:['i-bolt','sky'],crownburst:['i-crown','yellow'],
  classicburst:['i-spark','green'],
  notrail:['i-x','sky'],startrail:['i-star','yellow'],sparktrail:['i-spark','yellow'],bubbletrail:['i-target','sky'],
  leaftrail:['i-spark','green'],lightningtrail:['i-bolt','sky'],rainbowtrail:['i-layers','coral'],
  brain:['av-brain','sky'],cube:['av-cube','sky'],starav:['i-star','yellow'],robot:['av-robot','sky'],
  fox:['av-fox','coral'],penguin:['av-penguin','sky'],crownav:['i-crown','yellow'],boltbrain:['av-bolt','yellow'],
  bosshunter:['i-crown','coral'],sharpmind:['i-star','yellow'],starsailor:['i-medal','sky'],combocadet:['i-bolt','yellow'],
  perfectpupil:['i-target','green'],dailydevotee:['i-cal','coral'],worldwalker:['i-wave','sky'],matrixsage:['i-chip','sky'],
  'snd-classic':['i-sound','sky'],'snd-arcade':['i-bolt','coral'],'snd-mellow':['i-sound','green'],'snd-sparkle':['i-spark','yellow'],
  menusparkles:['i-spark','sky'],winconfetti:['i-gift','coral'],tapripples:['i-target','sky'],comboflames:['i-fire','coral'],
  goldenmatrix:['i-crown','yellow'],perfectmind:['av-brain','green'],combo100:['i-bolt','yellow'],ultimaterecall:['i-spark','coral'],
  corebreaker:['i-chip','sky'],worldchampion:['i-crown','sky'],memorymaster:['i-medal','sky'],infinity:['i-layers','coral'],
  sunny:['i-sun','sky'],cloudvalley:['i-spark','sky'],candygarden:['i-candy','coral'],snowpeak:['i-star','sky'],
  oceanbay:['i-wave','sky'],desertdash:['i-sun','yellow'],junglegrove:['i-spark','green'],crystalcave:['i-gem','coral'],
  skykingdom:['i-crown','yellow'],memorycore:['i-chip','sky'],
  /* expansion */
  neonglow:['i-bolt','sky'],lavatiles:['i-fire','coral'],skyglass:['i-cloud','sky'],vinetiles:['i-leaf','green'],
  startiles:['i-star','coral'],chronotiles:['i-clock','sky'],sunset:['i-sun','coral'],arctic:['i-spark','sky'],
  rose:['i-heart','coral'],graphite:['i-grid','sky'],hologram:['i-target','sky'],
  neoncity:['i-bolt','sky'],volcanoridge:['i-fire','coral'],cloudpeak:['i-cloud','sky'],emeraldjungle:['i-leaf','green'],
  galaxydrift:['i-planet','coral'],timenexus:['i-clock','yellow'],midnight:['i-star','sky'],cottoncandy:['i-candy','coral'],
  neonpop:['i-bolt','coral'],emberburst:['i-fire','coral'],cloudpuff:['i-cloud','sky'],stardust:['i-star','coral'],
  chronoburst:['i-clock','sky'],
  neontrail:['i-bolt','coral'],embertrail:['i-fire','coral'],cloudtrail:['i-cloud','sky'],comettrail:['i-star','coral'],
  chronotrail:['i-clock','sky'],
  owl:['av-owl','coral'],cat:['av-cat','yellow'],dragon:['av-dragon','coral'],astro:['av-astro','sky'],ninja:['av-ninja','sky'],
  citybreaker:['i-bolt','sky'],ridgewalker:['i-cloud','sky'],deepdiver:['i-gem','coral'],nexusconqueror:['i-clock','coral'],
  'snd-chiptune':['i-chip','sky'],'snd-bubble':['i-target','sky'],'snd-jungle':['i-leaf','green'],'snd-thunder':['i-bolt','coral'],
  'snd-crystal':['i-gem','sky'],'snd-musicbox':['i-sound','yellow'],'snd-cosmic':['i-planet','coral'],
  boardhalo:['i-target','sky'],neongrid:['i-grid','sky'],levelstart:['i-gift','coral'],combosparkle:['i-spark','yellow'],
  starrain:['i-star','yellow'],confettirain:['i-gift','sky'],victoryring:['i-crown','yellow'],
  neonrider:['i-bolt','coral'],volcanoking:['i-fire','coral'],skysovereign:['i-cloud','sky'],jungleheart:['i-leaf','green'],
  galaxylord:['i-planet','coral'],timelord:['i-clock','yellow']
};
var AVSYM={brain:'av-brain',cube:'av-cube',starav:'i-star',robot:'av-robot',fox:'av-fox',penguin:'av-penguin',crownav:'i-crown',boltbrain:'av-bolt',
  owl:'av-owl',cat:'av-cat',dragon:'av-dragon',astro:'av-astro',ninja:'av-ninja'};
var BADGESYM={bosshunter:'i-crown',sharpmind:'i-star',starsailor:'i-medal',combocadet:'i-bolt',perfectpupil:'i-target',dailydevotee:'i-cal',worldwalker:'i-wave',matrixsage:'i-chip',
  citybreaker:'i-bolt',ridgewalker:'i-cloud',deepdiver:'i-gem',nexusconqueror:'i-clock'};
var COSMAP={},ci;
for(ci=0;ci<COS.length;ci++)COSMAP[COS[ci].id]=COS[ci];
function cosById(id){return COSMAP[id]||null;}
function symRef(ic){return ic.indexOf('av-')===0?ic:'i-'+ic;}
function cosIc(it){var m=ICO[it.id];return m?m[0]:'i-spark';}
function cosTone(it){var m=ICO[it.id];return m?m[1]:'sky';}
function catName(c){for(var i=0;i<COSCATS.length;i++)if(COSCATS[i].id===c)return COSCATS[i].name;return c.toUpperCase();}

/* sanitize loaded save data (old saves simply keep defaults) */
(function(){
  var d={tiles:'classic',themes:'sunny',parts:'classicburst',trails:'notrail',avatars:'brain',badges:'',sounds:'snd-classic',fx:'',special:''},k,i;
  if(!S.eq||typeof S.eq!=='object')S.eq=d;
  for(k in d)if(typeof S.eq[k]==='undefined')S.eq[k]=d[k];
  for(k in S.eq)if(S.eq[k]&&(S.own.indexOf(S.eq[k])<0||!cosById(S.eq[k])))S.eq[k]=d[k];
  for(i=S.own.length-1;i>=0;i--)if(!cosById(S.own[i]))S.own.splice(i,1);
  for(i=S.own.length-1;i>=0;i--)if(S.own.indexOf(S.own[i])!==i)S.own.splice(i,1);
  if(!S.loadouts||!S.loadouts.length)S.loadouts=[{n:'Loadout 1'},{n:'Loadout 2'},{n:'Loadout 3'}];
})();

/* ---------- unlock rules ---------- */
function unlockText(u){
  if(!u)return '';
  if(u.lvl)return 'Reach Level '+u.lvl;
  if(u.boss)return 'Defeat the Level '+u.boss+' boss';
  if(u.stars)return 'Earn '+u.stars+' stars';
  if(u.star3)return '3-star '+u.star3+' levels';
  if(u.combo)return 'Reach a x'+u.combo+' combo';
  if(u.perfect)return u.perfect+' perfect clears';
  if(u.master)return 'Master '+u.master+' levels';
  if(u.daily)return 'Complete '+u.daily+' dailies';
  if(u.bosses)return 'Defeat '+u.bosses+' bosses';
  if(u.world)return 'Master World '+u.world;
  if(u.allboss)return 'Defeat all '+NCH+' world bosses';
  return '???';
}
function cosUnlocked(it){
  var u=it.u;if(!u)return true;
  if(u.lvl)return S.maxlvl>=u.lvl;
  if(u.boss)return S.bosses.indexOf(u.boss)>=0;
  if(u.stars)return starTotal()>=u.stars;
  if(u.star3)return star3Count()>=u.star3;
  if(u.combo)return S.bcombo>=u.combo;
  if(u.perfect)return (S.bpl||0)>=u.perfect;
  if(u.master)return masteryCount()>=u.master;
  if(u.daily)return ((S.ddata&&S.ddata.runs)||0)>=u.daily;
  if(u.bosses)return S.bosses.length>=u.bosses;
  if(u.world)return !!S.wmast[u.world-1];
  if(u.allboss)return S.bosses.length>=NCH;
  return true;
}
function cosCheckUnlocks(quiet){
  var i,it,got=0;
  for(i=0;i<COS.length;i++){
    it=COS[i];
    if(S.own.indexOf(it.id)>=0||S.unl.indexOf(it.id)>=0)continue;
    if(!cosUnlocked(it))continue;
    S.unl.push(it.id);
    if(it.cat==='badges'){                      /* badges are earned — granted free */
      S.own.push(it.id);
      if(!quiet){toast(cosIc(it),cosTone(it),'Badge earned!',it.name);A.ach();}
    }else if(!quiet){
      toast(cosIc(it),cosTone(it),'NEW in the Shop!',it.name+' is now available');
    }
    got++;
  }
  if(got){
    saveKey('unl');saveKey('own');
    if(!quiet){
      A.unlock();
      FX.burst(window.innerWidth/2,window.innerHeight*0.26,{n:12,colors:['#4CB9F2','#FFFFFF','#FFC93C'],sp:3,shapes:['s','c']});
    }
  }
  return got;
}

/* ---------- equip / buy ---------- */
function owns(id){return S.own.indexOf(id)>=0;}
function applyCosmetics(){
  var b=document.body,cs=b.className.split(' '),i;
  for(i=cs.length-1;i>=0;i--)if(cs[i].indexOf('th-')===0||cs[i].indexOf('sp-')===0||cs[i].indexOf('fx-')===0)b.classList.remove(cs[i]);
  b.classList.add('th-'+(S.eq.themes||'sunny'));
  if(S.eq.special)b.classList.add('sp-'+S.eq.special);
  /* CSS-driven effects */
  if(S.eq.fx==='boardhalo')b.classList.add('fx-boardhalo');
  if(S.eq.fx==='neongrid')b.classList.add('fx-neongrid');
  var bd=$('board');
  if(bd){
    var bs=bd.className.split(' ');
    for(i=bs.length-1;i>=0;i--)if(bs[i].indexOf('sk-')===0)bd.classList.remove(bs[i]);
    bd.classList.add('sk-'+(S.eq.tiles||'classic'));
  }
  renderMenuAvatar();renderSetFlag();
}
function renderMenuAvatar(){
  var chip=$('m-avchip');if(!chip)return;
  var av=AVSYM[S.eq.avatars]||'av-brain';
  var bdg=S.eq.badges?('<span class="badge-chip"><svg class="ic"><use href="#'+(BADGESYM[S.eq.badges]||'i-star')+'"/></svg></span>'):'';
  chip.innerHTML='<span class="tk av" id="m-av"><svg class="ic"><use href="#'+av+'"/></svg></span>'+bdg;
}
function renderSetFlag(){
  var el=$('m-setflag');if(!el)return;
  var st=activeSet();
  el.innerHTML=st?('<span class="setflag" style="background:'+WORLDS[st.w-1].col+';color:#fff;box-shadow:0 3px 0 '+WORLDS[st.w-1].edge+'"><svg class="ic"><use href="#i-crown"/></svg>'+st.n+' ACTIVE</span>'):'';
}
function bumpTok(el){if(!el)return;el.style.animation='none';void el.offsetWidth;el.style.animation='vpop .3s ease';}
function ownedFly(el,txt){
  var s=document.createElement('span');
  s.className='owned-fly';s.textContent=txt;
  var x=window.innerWidth/2,y=window.innerHeight*0.4;
  if(el&&el.getBoundingClientRect){var r=el.getBoundingClientRect();x=r.left+r.width/2;y=r.top+6;}
  s.style.left=x+'px';s.style.top=y+'px';
  document.body.appendChild(s);
  setTimeout(function(){if(s.parentNode)s.parentNode.removeChild(s);},1050);
}
function buyCos(id,cardEl){
  var it=cosById(id);if(!it)return;
  if(owns(id))return;
  if(!cosUnlocked(it)){A.warn();toast('lock','coral','Still locked',unlockText(it.u));return;}
  if(S.tok<it.p){A.warn();toast('chip','coral','Not enough tokens','You need '+it.p+' — earn more by playing');return;}
  S.tok-=it.p;saveKey('tok');
  S.own.push(id);saveKey('own');
  A.tok();A.ach();vib(18);
  ownedFly(cardEl,'OWNED!');
  bumpTok($('shop-tok'));bumpTok($('m-tok'));
  $('shop-tok').textContent=nf(S.tok);
  $('m-tok').textContent=nf(S.tok);
  if(it.r==='legendary'){
    banner('warn','crown','LEGENDARY UNLOCKED!',1500);
    FX.fountain(window.innerWidth/2,window.innerHeight*0.34,34);
  }else{
    toast('check','green','Owned!',it.name+' — tap EQUIP to wear it');
  }
  checkSetBonus();
  if(cardEl){
    /* pop the card, flip its button to OWNED!, then re-render */
    cardEl.classList.add('bought');
    var bb=cardEl.querySelector('.ibuy');
    if(bb){bb.className='ibuy owned';bb.textContent='OWNED!';}
    var lt=cardEl.querySelector('.locktag');
    if(lt)lt.remove?lt.remove():null;
    setTimeout(refreshOpenShop,520);
  }else refreshOpenShop();
}
function equipCos(id,el){
  var it=cosById(id);if(!it)return;
  if(!owns(id))return;
  if(S.eq[it.cat]===id)return;
  S.eq[it.cat]=id;saveKey('eq');
  applyCosmetics();
  A.star(1);vib(10);
  banner('','check',catName(it.cat)+' EQUIPPED!',900);
  var r=(el&&el.getBoundingClientRect)?el.getBoundingClientRect():null;
  FX.burst(r?r.left+r.width/2:window.innerWidth/2,r?r.top+r.height/2:window.innerHeight/2,
    {n:10,colors:['#57CB6C','#FFFFFF','#FFC93C'],sp:2.8,shapes:['c','s']});
  checkSetBonus();
  refreshOpenShop();
}
function equipNone(cat){
  if(S.eq[cat]==='')return;
  S.eq[cat]='';saveKey('eq');
  applyCosmetics();A.btn();
  refreshOpenShop();
}
function toggleFav(id){
  var k=S.fav.indexOf(id);
  if(k>=0)S.fav.splice(k,1);else S.fav.push(id);
  saveKey('fav');
  refreshOpenShop();
}
function refreshOpenShop(){
  if($('scr-shop').classList.contains('on'))renderShop();
  if($('scr-custom').classList.contains('on'))renderCustom();
}

/* ---------- world sets (deterministic bundle pricing) ---------- */
var SETS=[
  {id:'sunnyset',  n:'SUNNY SET',  w:1,items:['sunbeam','cloudvalley','sparktrail','starburst'],   price:560},
  {id:'candyset',  n:'CANDY SET',  w:2,items:['candyswirl','candygarden','bubbletrail','candyburst'],price:600},
  {id:'oceanset',  n:'OCEAN SET',  w:3,items:['reef','oceanbay','bubbletrail','bubblepop'],         price:640},
  {id:'crystalset',n:'CRYSTAL SET',w:4,items:['geode','crystalcave','lightningtrail','sparkle'],    price:880},
  {id:'coreset',   n:'CORE SET',   w:5,items:['coretiles','memorycore','rainbowtrail','crownburst'],price:1400},
  /* ---- expansion sets ---- */
  {id:'neonset',   n:'NEON SET',   w:6,items:['neonglow','neoncity','lightningtrail','neonpop'],    price:900},
  {id:'lavaset',   n:'LAVA SET',   w:7,items:['lavatiles','volcanoridge','sparktrail','emberburst'],price:950},
  {id:'skyset',    n:'SKY SET',    w:8,items:['skyglass','cloudpeak','bubbletrail','cloudpuff'],    price:1000},
  {id:'jungleset', n:'JUNGLE SET', w:9,items:['vinetiles','emeraldjungle','leaftrail','leafburst'], price:1050},
  {id:'galaxyset', n:'GALAXY SET', w:10,items:['startiles','galaxydrift','startrail','stardust'],  price:1500},
  {id:'nexusset',  n:'NEXUS SET',  w:11,items:['chronotiles','timenexus','rainbowtrail','chronoburst'],price:1900}
];
function setById(id){for(var i=0;i<SETS.length;i++)if(SETS[i].id===id)return SETS[i];return null;}
function setPrice(st){
  var tot=0,rem=0,i,it;
  for(i=0;i<st.items.length;i++){
    it=cosById(st.items[i]);tot+=it.p;
    if(!owns(it.id))rem+=it.p;
  }
  if(rem<=0)return 0;
  return Math.min(rem,Math.round(st.price*rem/tot));   /* never more than buying pieces individually */
}
function setCols(st){return WORLDS[st.w-1].cols.concat(['#FFFFFF']);}
function activeSet(){
  var i,st;
  for(i=0;i<SETS.length;i++){
    st=SETS[i];
    if(S.eq.tiles===st.items[0]&&S.eq.themes===st.items[1]&&S.eq.trails===st.items[2]&&S.eq.parts===st.items[3])return st;
  }
  return null;
}
function checkSetBonus(){
  var i,st;
  for(i=0;i<SETS.length;i++){
    st=SETS[i];
    if(activeSet()===st&&S.setseen.indexOf(st.id)<0){
      S.setseen.push(st.id);saveKey('setseen');
      banner('warn','crown','SET COMPLETE!',1500);
      toast('crown','yellow',st.n+' active','Themed menu banner • menu particles • clear burst');
      FX.fountain(window.innerWidth/2,window.innerHeight*0.3,30,setCols(st));
      A.won();
    }
  }
  renderSetFlag();
}
function buySet(sid,el){
  var st=setById(sid);if(!st)return;
  var i,it,need=[],locked=null;
  for(i=0;i<st.items.length;i++){
    it=cosById(st.items[i]);
    if(owns(it.id))continue;
    if(!cosUnlocked(it)){locked=it;break;}
    need.push(it);
  }
  if(locked){A.warn();toast('lock','coral','Set not ready yet','First unlock: '+unlockText(locked.u));return;}
  if(!need.length){toast('check','green','Set complete','You own every piece');return;}
  var cost=setPrice(st);
  if(S.tok<cost){A.warn();toast('chip','coral','Not enough tokens','Set costs '+cost);return;}
  S.tok-=cost;saveKey('tok');
  for(i=0;i<need.length;i++)S.own.push(need[i].id);
  saveKey('own');
  A.won();vib([20,40,20]);
  banner('warn','crown',st.n+' ACQUIRED!',1400);
  FX.fountain(window.innerWidth/2,window.innerHeight*0.32,32,setCols(st));
  ownedFly(el,'SET BOUGHT!');
  bumpTok($('shop-tok'));
  $('shop-tok').textContent=nf(S.tok);$('m-tok').textContent=nf(S.tok);
  checkSetBonus();
  refreshOpenShop();
}

/* ---------- world mastery ---------- */
var WM_SIG=['sunbeam','candyswirl','reef','geode','coretiles','neonglow','lavatiles','skyglass','vinetiles','startiles','chronotiles'];
var WM_REW=['perfectmind','combo100','ultimaterecall','corebreaker','worldchampion','neonrider','volcanoking','skysovereign','jungleheart','galaxylord','timelord'];
function wmGoals(c){
  var first=chFirst(c),last=chLast(c),n=CHLEN[c],cleared=0,stars=0,pf=0,combo=0,l,d;
  var starGoal=Math.round(n*2),perfGoal=n>=12?6:5;
  for(l=first;l<=last;l++){
    d=S.lv[l];
    if(d){if(d.wi)cleared++;stars+=d.st||0;if(d.pf)pf++;if((d.bc||0)>combo)combo=d.bc||0;}
  }
  var boss=S.bosses.indexOf(last)>=0;
  var cos=owns(WM_SIG[c]);
  var g=[
    {t:'Clear all '+n+' levels',p:cleared+' / '+n,done:cleared>=n},
    {t:'Earn '+starGoal+' world stars',p:Math.min(stars,starGoal)+' / '+starGoal,done:stars>=starGoal},
    {t:'Get '+perfGoal+' perfect clears',p:Math.min(pf,perfGoal)+' / '+perfGoal,done:pf>=perfGoal},
    {t:'Reach a x10 combo',p:Math.min(combo,10)+' / 10',done:combo>=10},
    {t:'Defeat the world boss',p:boss?'done':'not yet',done:boss},
    {t:'Collect the world cosmetic',p:cos?'owned':'in shop',done:cos}
  ];
  if(BOSSES[chFirst(c)+5])g.push({t:'Defeat the mid-world boss',p:S.bosses.indexOf(chFirst(c)+5)>=0?'done':'not yet',
    done:S.bosses.indexOf(chFirst(c)+5)>=0});
  return g;
}
function wmTotal(c){return wmGoals(c).length;}
function wmCount(c){var g=wmGoals(c),n=0,i;for(i=0;i<g.length;i++)if(g[i].done)n++;return n;}
function wmDone(c){return wmCount(c)>=wmTotal(c);}
function wmCheck(c){
  if(S.wmast[c]||!wmDone(c))return;
  S.wmast[c]=1;saveKey('wmast');
  var rid=WM_REW[c];
  if(!owns(rid)){S.own.push(rid);saveKey('own');}
  addTok(100);
  A.won();vib([30,60,30]);
  banner('warn','crown','WORLD MASTERED!',1700);
  toast('crown','yellow',WORLDS[c].name+' mastered!','Legendary unlocked: '+cosById(rid).name);
  FX.fountain(window.innerWidth/2,window.innerHeight*0.3,46,WORLDS[c].cols);
}
function renderMastery(c){
  var w=WORLDS[c],g=wmGoals(c),i,h='';
  var done=wmCount(c);
  $('wm-title').textContent=w.name+' Mastery';
  var tot=wmTotal(c);
  h+='<div style="text-align:center"><span class="count-chip"><svg class="ic"><use href="#i-medal"/></svg>MASTERY '+done+' / '+tot+'</span></div>';
  h+='<div class="colbar"><i style="width:'+Math.round(done/tot*100)+'%"></i></div>';
  for(i=0;i<g.length;i++){
    h+='<div class="obj-line'+(g[i].done?' done':'')+'"><span class="o-ic"><svg class="ic"><use href="#i-'+(g[i].done?'check':'flag')+'"/></svg></span><span>'+g[i].t+'</span><b>'+(g[i].done?'DONE':g[i].p)+'</b></div>';
  }
  var rw=cosById(WM_REW[c]);
  if(S.wmast[c]){
    h+='<div class="unlock-note" style="background:var(--yellow-soft)"><svg class="ic"><use href="#i-crown"/></svg>WORLD MASTERED! Legendary unlocked: <b style="margin-left:4px">'+rw.name+'</b></div>';
  }else{
    h+='<div class="unlock-note"><svg class="ic"><use href="#i-crown"/></svg>Master reward: <b style="margin-left:4px">'+rw.name+'</b>&nbsp;• +100 tokens • unique celebration</div>';
  }
  h+='<div class="unlock-note"><svg class="ic"><use href="#i-'+w.ic+'"/></svg>'+w.mood+' — '+w.desc+'</div>';
  $('wm-body').innerHTML=h;
}

/* ---------- world complete celebration ---------- */
function renderWorldComplete(l,tok,res){
  var c=chOf(l),w=WORLDS[c],i,ll,stars=0;
  for(ll=chFirst(c);ll<=chLast(c);ll++)if(S.lv[ll])stars+=S.lv[ll].st||0;
  var bonus=120+c*25;                     /* later worlds pay a bigger world bonus */
  addTok(bonus);
  var hero=$('wc-hero');
  hero.style.background=w.col;
  hero.style.boxShadow='0 7px 0 '+w.edge+',0 14px 26px rgba(31,42,82,.3)';
  hero.innerHTML='<svg class="ic"><use href="#i-'+w.ic+'"/></svg>';
  $('wc-title').textContent='WORLD COMPLETE!';
  $('wc-sub').textContent='WORLD '+w.n+' · '+w.name.toUpperCase();
  var h='';
  h+=rew(w.ic,w.tone,'World badge: '+w.name,'World '+w.n+' completed');
  h+=rew('star','yellow',stars+' / '+(3*CHLEN[c])+' world stars','Mastery continues on replays');
  h+=rew('chip','sky','+'+(tok+bonus)+' Memory Tokens','Boss '+tok+' + world bonus '+bonus);
  h+=rew(BOSSES[l].ic,'green','Boss Badge: '+BOSSES[l].badge,'Level '+l+' boss defeated');
  var unow=[];
  for(i=0;i<COS.length;i++){
    var it=COS[i];
    if(it.u&&((it.u.boss===l)||(it.u.lvl===l+1)))unow.push(it);
  }
  for(i=0;i<unow.length;i++)h+=rew('bag','coral','Shop unlock: '+unow[i].name,'Now available in the Memory Shop');
  h+=rew('medal','yellow','World mastery board ready',wmTotal(c)+' objectives • legendary reward');
  $('wc-rewards').innerHTML=h;
  if(c+1<NCH){
    var nw=WORLDS[c+1];
    $('wc-next').innerHTML='<div class="nextw" style="background:'+nw.col+';box-shadow:0 5px 0 '+nw.edge+'">'+
      '<span class="nw-ic"><svg class="ic"><use href="#i-'+nw.ic+'"/></svg></span>'+
      '<span><b>NEXT: WORLD '+nw.n+' — '+nw.name.toUpperCase()+'</b><span>'+nw.desc+' Boss: '+nw.boss+'</span></span></div>';
  }else{
    $('wc-next').innerHTML='<div class="nextw" style="background:var(--green);box-shadow:0 5px 0 var(--green-edge)">'+
      '<span class="nw-ic"><svg class="ic"><use href="#i-trophy"/></svg></span>'+
      '<span><b>CAMPAIGN COMPLETE!</b><span>All '+NCH+' worlds and '+MAXLVL+' levels conquered. Modes &amp; Daily await.</span></span></div>';
  }
  var nx=(l<MAXLVL&&S.maxlvl>l)?S.maxlvl:null;
  $('wc-next-label').textContent=nx?('Continue — Level '+nx):'Campaign Map';
  $('btn-wc-next').dataset.lvl=nx||'';
}

/* ---------- daily picks (deterministic rotation, no loot boxes) ---------- */
function picksToday(){
  var key=todayKey(),rng=mulberry32((hashStr(key+'shop')^0x9e37)>>>0);
  var pool=[],i,j,t;
  for(i=0;i<COS.length;i++)if(COS[i].p>0)pool.push(COS[i].id);
  for(i=pool.length-1;i>0;i--){j=(rng()*(i+1))|0;t=pool[i];pool[i]=pool[j];pool[j]=t;}
  return pool.slice(0,4);
}
function nextRefreshTxt(){
  var now=new Date(),mid=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1,0,0,0);
  var s=Math.max(0,Math.floor((mid-now)/1000));
  return pad2(Math.floor(s/3600))+':'+pad2(Math.floor((s%3600)/60))+':'+pad2(s%60);
}

/* ---------- shop rendering ---------- */
var shopTab='picks';
function previewHTML(it){
  if(it.cat==='tiles')return '<span class="pp-tile sk-'+it.id+'"></span>';
  if(it.cat==='themes')return '<span class="pp-theme th-'+it.id+'"><i style="width:20px;height:7px;top:8px;left:7px"></i><i style="width:13px;height:5px;bottom:9px;right:8px"></i></span>';
  if(it.cat==='parts'){
    var pk=PACKFX[it.id]||PACKFX.classicburst,h='<span class="pp-dots">',i;
    for(i=0;i<4;i++)h+='<i style="background:'+pk.c[i%pk.c.length]+'"></i>';
    return h+'</span>';
  }
  if(it.cat==='trails'){
    var t=TRAILFX[it.id],h2='<span class="pp-trail">',k;
    if(t)for(k=0;k<4;k++)h2+='<i style="left:'+(4+k*13)+'px;top:'+(16-Math.sin(k/3*3.14)*10)+'px;background:'+t.c[k%t.c.length]+'"></i>';
    else h2+='<i style="left:20px;top:9px;background:#CBD7EA"></i>';
    return h2+'</span>';
  }
  var tone=cosTone(it);
  return '<span class="pp-ic" style="background:var(--'+tone+');box-shadow:0 3px 0 var(--'+tone+'-edge)'+(tone==='yellow'?';color:var(--navy)':'')+'"><svg class="ic"><use href="#'+symRef(cosIc(it))+'"/></svg></span>';
}
function itemCard(it){
  var owned=owns(it.id),eq=(S.eq[it.cat]===it.id),unl=cosUnlocked(it);
  var fav=S.fav.indexOf(it.id)>=0;
  var isNew=!owned&&unl&&S.unl.indexOf(it.id)>=0&&S.seen.indexOf(it.id)<0;
  var h='<div class="icard'+(eq?' eq':'')+(unl?'':' lock')+'" data-item="'+it.id+'">';
  if(it.cat!=='badges')h+='<button class="favb'+(fav?' on':'')+'" data-fav="'+it.id+'" aria-label="Favorite"><svg class="ic"><use href="#i-star"/></svg></button>';
  if(isNew)h+='<span class="new-tag">NEW</span>';
  if(eq)h+='<span class="eqtag"><svg class="ic"><use href="#i-check"/></svg></span>';
  else if(!unl)h+='<span class="locktag"><svg class="ic"><use href="#i-lock"/></svg></span>';
  h+='<div class="ip">'+previewHTML(it)+'</div>';
  h+='<span class="rar '+it.r+'">'+it.r.toUpperCase()+'</span>';
  h+='<span class="iname">'+it.name+'</span>';
  h+='<span class="idesc">'+it.d+'</span>';
  h+='<div class="icard-foot">';
  if(!unl){
    h+='<span class="ilocknote"><svg class="ic"><use href="#i-lock"/></svg>'+unlockText(it.u)+'</span>';
    h+='<span class="ibuy no">LOCKED</span>';
  }else if(owned){
    h+='<span class="iprice iprice-ghost">&nbsp;</span>';
    if(eq)h+='<span class="ibuy equipped">EQUIPPED</span>';
    else h+='<button class="ibuy equip" data-eq="'+it.id+'">EQUIP</button>';
  }else{
    h+='<span class="iprice"><svg class="ic"><use href="#i-chip"/></svg>'+it.p+' tokens</span>';
    h+='<button class="ibuy'+(S.tok>=it.p?'':' no')+'" data-buy="'+it.id+'"><svg class="ic"><use href="#i-chip"/></svg>BUY</button>';
  }
  h+='</div></div>';
  return h;
}
function setCard(st){
  var i,it,ownedN=0,tot=0,h;
  for(i=0;i<st.items.length;i++){it=cosById(st.items[i]);tot+=it.p;if(owns(it.id))ownedN++;}
  var price=setPrice(st),full=(ownedN===st.items.length);
  var w=WORLDS[st.w-1];
  h='<div class="setcard" data-set="'+st.id+'">';
  h+='<div class="sc-top"><span class="sc-ic" style="background:'+w.col+';box-shadow:0 3px 0 '+w.edge+'"><svg class="ic"><use href="#i-'+w.ic+'"/></svg></span>'+
     '<span class="sc-n"><b>'+st.n+'</b><span>WORLD '+st.w+' • '+ownedN+' / 4 OWNED</span></span>'+
     (activeSet()===st?'<span class="set-done"><svg class="ic"><use href="#i-crown"/></svg>ACTIVE</span>':'')+'</div>';
  h+='<div class="sc-items">';
  for(i=0;i<st.items.length;i++){
    it=cosById(st.items[i]);
    h+='<span class="sci" style="'+(owns(it.id)?'':'opacity:.45')+'">'+previewHTML(it)+'<b>'+it.name+'</b></span>';
  }
  h+='</div>';
  h+='<div class="sc-buyrow">';
  if(full){
    h+='<span class="sc-prices"><span class="now"><svg class="ic"><use href="#i-check"/></svg>Set complete</span></span>';
    h+='<span class="sc-buy full">COLLECTED</span>';
  }else{
    h+='<span class="sc-prices"><span class="was">'+tot+' individually</span><span class="now"><svg class="ic"><use href="#i-chip"/></svg>'+price+'</span></span>';
    h+='<button class="sc-buy'+(S.tok>=price?'':' no')+'" data-setbuy="'+st.id+'"><svg class="ic"><use href="#i-bag"/></svg>BUY SET</button>';
  }
  h+='</div></div>';
  return h;
}
function renderShop(){
  $('shop-tok').textContent=nf(S.tok);
  var i,h='';
  h+='<button data-tab="picks" class="'+(shopTab==='picks'?'on':'')+'"><svg class="ic"><use href="#i-spark"/></svg>TODAY</button>';
  h+='<button data-tab="fav" class="'+(shopTab==='fav'?'on':'')+'"><svg class="ic"><use href="#i-star"/></svg>FAVORITES</button>';
  for(i=0;i<COSCATS.length;i++){
    h+='<button data-tab="'+COSCATS[i].id+'" class="'+(shopTab===COSCATS[i].id?'on':'')+'"><svg class="ic"><use href="#'+symRef(COSCATS[i].ic)+'"/></svg>'+COSCATS[i].name+'</button>';
  }
  h+='<button data-tab="sets" class="'+(shopTab==='sets'?'on':'')+'"><svg class="ic"><use href="#i-layers"/></svg>WORLD SETS</button>';
  $('shop-tabs').innerHTML=h;
  var body='',j,it;
  if(shopTab==='picks'){
    var picks=picksToday();
    body+='<div class="shopsec"><div class="shopsec-title"><svg class="ic"><use href="#i-spark"/></svg>TODAY\'S PICKS<span class="spacer"></span>'+
      '<span class="refresh-chip"><svg class="ic"><use href="#i-clock"/></svg>NEXT REFRESH <b id="pick-timer">'+nextRefreshTxt()+'</b></span></div>';
    body+='<div class="shopgrid">';
    for(i=0;i<picks.length;i++)body+=itemCard(cosById(picks[i]));
    body+='</div><div class="unlock-note" style="margin-top:10px"><svg class="ic"><use href="#i-check"/></svg>Same four picks all day. Direct purchases only — never random.</div></div>';
    var got=0;for(i=0;i<COS.length;i++)if(owns(COS[i].id))got++;
    body+='<button class="btn white wide" data-col="1" style="margin-bottom:12px"><svg class="ic"><use href="#i-book"/></svg>MEMORY COLLECTION — '+got+' / '+COS.length+'</button>';
    body+='<div class="shopsec"><div class="shopsec-title"><svg class="ic"><use href="#i-layers"/></svg>WORLD SETS</div>';
    for(i=0;i<SETS.length;i++)body+=setCard(SETS[i]);
    body+='</div>';
  }else if(shopTab==='fav'){
    body+='<div class="shopsec"><div class="shopsec-title"><svg class="ic"><use href="#i-star"/></svg>FAVORITES</div>';
    if(!S.fav.length)body+='<div class="unlock-note"><svg class="ic"><use href="#i-star"/></svg>Tap the star on any item to favorite it for quick access.</div>';
    else{
      body+='<div class="shopgrid">';
      for(i=0;i<S.fav.length;i++){it=cosById(S.fav[i]);if(it)body+=itemCard(it);}
      body+='</div>';
    }
    body+='</div>';
  }else if(shopTab==='sets'){
    body+='<div class="shopsec"><div class="shopsec-title"><svg class="ic"><use href="#i-layers"/></svg>WORLD SETS<span class="spacer"></span><span class="refresh-chip"><svg class="ic"><use href="#i-crown"/></svg>EQUIP ALL 4 = SET BONUS</span></div>';
    for(i=0;i<SETS.length;i++)body+=setCard(SETS[i]);
    body+='<div class="unlock-note"><svg class="ic"><use href="#i-spark"/></svg>Set bonuses are visual only: menu banner, menu particles and a themed clear burst.</div></div>';
  }else{
    var cat=null;
    for(i=0;i<COSCATS.length;i++)if(COSCATS[i].id===shopTab)cat=COSCATS[i];
    body+='<div class="shopsec"><div class="shopsec-title"><svg class="ic"><use href="#'+symRef(cat.ic)+'"/></svg>'+cat.name+'</div><div class="shopgrid">';
    for(j=0;j<COS.length;j++)if(COS[j].cat===shopTab)body+=itemCard(COS[j]);
    body+='</div>';
    if(shopTab==='badges')body+='<div class="unlock-note" style="margin-top:10px"><svg class="ic"><use href="#i-medal"/></svg>Badges are earned by playing — they are never for sale.</div>';
    if(shopTab==='special')body+='<div class="unlock-note" style="margin-top:10px"><svg class="ic"><use href="#i-crown"/></svg>Specials are cosmetic prestige only. They never touch score, lives or power.</div>';
    body+='</div>';
  }
  $('shop-body').innerHTML=body;
  /* mark NEW items as seen once the shop has shown them */
  var changed=false;
  for(i=0;i<S.unl.length;i++){
    it=cosById(S.unl[i]);
    if(it&&!owns(it.id)&&S.seen.indexOf(it.id)<0){S.seen.push(it.id);changed=true;}
  }
  if(changed)saveKey('seen');
}

/* ---------- customize screen ---------- */
function prevInner(it){
  if(it.cat==='tiles')return '<span class="pp-tile sk-'+it.id+'"></span>';
  if(it.cat==='themes')return '<span class="pp-theme th-'+it.id+'" style="width:28px;height:20px;border-radius:8px;display:block"></span>';
  return '<svg class="ic"><use href="#'+symRef(cosIc(it))+'"/></svg>';
}
function optChip(it){
  var eq=(S.eq[it.cat]===it.id);
  return '<button class="copt'+(eq?' sel':'')+'" data-eq="'+it.id+'">'+prevInner(it)+'<b>'+it.name+'</b></button>';
}
function renderCustom(){
  var i,j,h='',it,cat;
  var av=AVSYM[S.eq.avatars]||'av-brain';
  var bdg=S.eq.badges?('<span class="badge-chip"><svg class="ic"><use href="#'+(BADGESYM[S.eq.badges]||'i-star')+'"/></svg></span>'):'';
  var as=activeSet();
  /* live preview */
  h+='<div class="cprev th-'+(S.eq.themes||'sunny')+' sk-'+(S.eq.tiles||'classic')+'" id="cust-preview">';
  h+='<span class="cp-id"><span class="avwrap"><span class="avatar-chip"><svg class="ic"><use href="#'+av+'"/></svg></span>'+bdg+'</span></span>';
  if(as)h+='<span class="cp-set"><span class="setflag" style="background:'+WORLDS[as.w-1].col+';color:#fff"><svg class="ic"><use href="#i-crown"/></svg>'+as.n+'</span></span>';
  h+='<div class="cp-grid">';
  var hls=[0,2,4,7];
  for(i=0;i<9;i++)h+='<div class="tile'+(hls.indexOf(i)>=0?' hl':'')+'"></div>';
  h+='</div></div>';
  h+='<button class="btn sky wide testfx-btn" id="btn-testfx"><svg class="ic"><use href="#i-spark"/></svg>TEST EFFECTS</button>';
  /* slot rows */
  var NONECATS={badges:1,fx:1,special:1};
  for(j=0;j<COSCATS.length;j++){
    cat=COSCATS[j];
    var own=[];
    for(i=0;i<COS.length;i++)if(COS[i].cat===cat.id&&owns(COS[i].id))own.push(COS[i]);
    h+='<div class="custrow"><div class="cr-h"><svg class="ic"><use href="#'+symRef(cat.ic)+'"/></svg>'+cat.name+'</div><div class="copts">';
    if(NONECATS[cat.id])h+='<button class="copt'+(S.eq[cat.id]===''?' sel':'')+'" data-none="'+cat.id+'"><svg class="ic" style="color:#B7C2DB"><use href="#i-x"/></svg><b>None</b></button>';
    if(!own.length&&!NONECATS[cat.id])h+='<span class="custempty">Nothing owned yet — visit the Shop!</span>';
    for(i=0;i<own.length;i++)h+=optChip(own[i]);
    h+='</div></div>';
  }
  /* loadouts */
  h+='<div class="sect-title" style="margin-top:16px"><svg class="ic"><use href="#i-layers"/></svg>Loadouts</div>';
  h+='<div id="lo-list">';
  for(i=0;i<S.loadouts.length;i++){
    var lo=S.loadouts[i],has=!!lo.tiles;
    h+='<div class="lo-card'+(has&&lo.tiles===S.eq.tiles&&lo.themes===S.eq.themes&&lo.avatars===S.eq.avatars?' active':'')+'" data-lo="'+i+'">';
    h+='<span class="lo-slots">';
    h+='<span class="ls">'+(lo.tiles?'<span class="pp-tile sk-'+lo.tiles+'"></span>':'<svg class="ic"><use href="#i-grid"/></svg>')+'</span>';
    h+='<span class="ls">'+(lo.themes?'<span class="pp-theme th-'+lo.themes+'" style="width:20px;height:14px;border-radius:5px;display:block"></span>':'<svg class="ic"><use href="#i-layers"/></svg>')+'</span>';
    h+='<span class="ls">'+(lo.trails&&lo.trails!=='notrail'?'<svg class="ic" style="color:var(--sky)"><use href="#'+symRef(cosIc(cosById(lo.trails)||{id:''}))+'"/></svg>':'<svg class="ic"><use href="#i-x"/></svg>')+'</span>';
    h+='<span class="ls">'+(lo.avatars?'<svg class="ic" style="color:var(--sky)"><use href="#'+(AVSYM[lo.avatars]||'av-brain')+'"/></svg>':'<svg class="ic"><use href="#av-brain"/></svg>')+'</span>';
    h+='</span>';
    h+='<span class="lo-info"><b>'+lo.n+'</b><span>'+(has?'Tap EQUIP to wear this look':'Empty — tap SAVE')+'</span></span>';
    h+='<span class="lo-btns">';
    h+='<button class="lo-btn save" data-losave="'+i+'"><svg class="ic"><use href="#i-check"/></svg>SAVE</button>';
    h+='<button class="lo-btn'+(has?'':' ghost')+'" data-loeq="'+i+'"><svg class="ic"><use href="#i-play"/></svg>EQUIP</button>';
    h+='<button class="lo-btn ghost" data-loren="'+i+'"><svg class="ic"><use href="#i-sliders"/></svg>NAME</button>';
    h+='</span></div>';
  }
  h+='</div>';
  if(S.loadouts.length<5)h+='<button class="btn white wide" id="btn-lo-add" style="margin-top:4px"><svg class="ic"><use href="#i-layers"/></svg>ADD LOADOUT ('+S.loadouts.length+' / 5)</button>';
  h+='<button class="btn white wide" id="btn-col2" style="margin-top:8px"><svg class="ic"><use href="#i-book"/></svg>MEMORY COLLECTION</button>';
  $('custom-body').innerHTML=h;
}
function loSave(i){
  var k,lo=S.loadouts[i];
  var cats=['tiles','themes','parts','trails','avatars','badges','sounds','fx','special'];
  for(k=0;k<cats.length;k++)lo[cats[k]]=S.eq[cats[k]];
  saveKey('loadouts');
  A.star(1);
  toast('check','green','Loadout saved',lo.n+' now holds this look');
  renderCustom();
}
function loEquip(i){
  var lo=S.loadouts[i];
  if(!lo||!lo.tiles){toast('lock','coral','Empty loadout','Save a look into it first');A.warn();return;}
  var cats=['tiles','themes','parts','trails','avatars','badges','sounds','fx','special'],k;
  for(k=0;k<cats.length;k++){
    var v=lo[cats[k]];
    if(typeof v==='undefined')continue;
    if(v===''||owns(v))S.eq[cats[k]]=v;
  }
  saveKey('eq');
  applyCosmetics();
  A.won();vib([15,30,15]);
  banner('warn','check','LOADOUT EQUIPPED!',1200);
  FX.fountain(window.innerWidth/2,window.innerHeight*0.4,24);
  checkSetBonus();
  renderCustom();
}
function loRename(i){
  var card=$('custom-body').querySelector('[data-lo="'+i+'"] .lo-info');
  if(!card)return;
  card.innerHTML='<input class="lo-rename" maxlength="18" value="'+S.loadouts[i].n.replace(/"/g,'')+'">';
  var inp=card.querySelector('input');
  inp.focus();inp.select();
  var fin=function(){
    var v=(inp.value||'').trim();
    if(v)S.loadouts[i].n=v;
    saveKey('loadouts');
    renderCustom();
  };
  inp.addEventListener('blur',fin);
  inp.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();inp.blur();}});
}

/* ---------- collection book ---------- */
function renderCollection(){
  var i,j,h='',got=0,it,cat,catGot,catTot;
  for(i=0;i<COS.length;i++)if(owns(COS[i].id))got++;
  $('col-count').textContent='COLLECTED '+got+' / '+COS.length;
  $('col-bar').style.width=Math.round(got/COS.length*100)+'%';
  for(j=0;j<COSCATS.length;j++){
    cat=COSCATS[j];catGot=0;catTot=0;
    var rows='';
    for(i=0;i<COS.length;i++){
      it=COS[i];
      if(it.cat!==cat.id)continue;
      catTot++;
      var owned=owns(it.id);
      if(owned)catGot++;
      var eqd=owned&&S.eq[it.cat]===it.id;
      var tone=cosTone(it);
      rows+='<div class="colc'+(owned?' got':' lock')+(eqd?' eqd':'')+'">';
      rows+='<span class="ci"'+(owned?' style="background:var(--'+tone+');box-shadow:0 2px 0 var(--'+tone+'-edge)'+(tone==='yellow'?';color:var(--navy)':'')+'"':'')+'>'+prevInner(it)+'</span>';
      rows+='<b>'+(owned?it.name:'???')+'</b>';
      if(!owned)rows+='<span class="cl-cond">'+(it.u?unlockText(it.u):'Buy in the Shop')+'</span>';
      rows+='</div>';
    }
    h+='<div class="ach-cat"><svg class="ic"><use href="#'+symRef(cat.ic)+'"/></svg>'+cat.name+' — '+catGot+' / '+catTot+'</div><div class="colgrid">'+rows+'</div>';
  }
  $('col-body').innerHTML=h;
}

/* ---------- wiring for the new systems ---------- */
$('shop-tabs').addEventListener('click',function(e){
  var b=e.target.closest?e.target.closest('button'):null;
  if(!b||!b.dataset.tab)return;
  A.init();A.btn();
  shopTab=b.dataset.tab;
  renderShop();
});
$('shop-body').addEventListener('click',function(e){
  var c=e.target.closest?e.target.closest('[data-fav],[data-buy],[data-eq],[data-setbuy],[data-col]'):null;
  if(!c)return;
  if(c.dataset.fav){A.btn();toggleFav(c.dataset.fav);return;}
  if(c.dataset.col){A.btn();renderCollection();openOv('ov-collection');return;}
  if(c.dataset.buy){A.init();buyCos(c.dataset.buy,c.closest('.icard'));return;}
  if(c.dataset.eq){A.init();equipCos(c.dataset.eq,c.closest('.icard'));return;}
  if(c.dataset.setbuy){A.init();buySet(c.dataset.setbuy,c.closest('.setcard'));return;}
});
$('custom-body').addEventListener('click',function(e){
  var t=e.target;
  var c=t.closest?t.closest('[data-eq],[data-none],[data-losave],[data-loeq],[data-loren],#btn-lo-add,#btn-col2,#btn-testfx'):null;
  if(!c)return;
  if(c.dataset.eq){A.init();equipCos(c.dataset.eq,c);return;}
  if(c.dataset.none){A.init();equipNone(c.dataset.none);return;}
  if(c.dataset.losave!=null&&c.dataset.losave!==''){A.btn();loSave(parseInt(c.dataset.losave,10));return;}
  if(c.dataset.loeq!=null&&c.dataset.loeq!==''){A.init();loEquip(parseInt(c.dataset.loeq,10));return;}
  if(c.dataset.loren!=null&&c.dataset.loren!==''){A.btn();loRename(parseInt(c.dataset.loren,10));return;}
  if(c.id==='btn-lo-add'){A.btn();if(S.loadouts.length<5){S.loadouts.push({n:'Loadout '+(S.loadouts.length+1)});saveKey('loadouts');renderCustom();}return;}
  if(c.id==='btn-col2'){A.btn();renderCollection();openOv('ov-collection');return;}
  if(c.id==='btn-testfx'){
    A.init();A.star(1);
    var r=$('cust-preview').getBoundingClientRect();
    FX.fountain(r.left+r.width/2,r.top+r.height*0.55,20,pcols());
    FX.burst(r.left+r.width*0.3,r.top+r.height*0.4,{n:8,colors:pcols(),sp:2.6,shapes:pshapes()});
    setTimeout(function(){FX.burst(r.left+r.width*0.7,r.top+r.height*0.4,{n:8,colors:pcols(),sp:2.6,shapes:pshapes()});spawnTrail({x:r.left+r.width*0.7,y:r.top+r.height*0.4});},180);
    return;
  }
});
bind('btn-shop',function(){A.init();A.btn();shopTab='picks';renderShop();showScreen('shop');});
bind('btn-custom',function(){A.init();A.btn();renderCustom();showScreen('custom');});
bind('shop-home',function(){A.btn();showScreen('menu');refreshMenu();});
bind('custom-home',function(){A.btn();showScreen('menu');refreshMenu();});
bind('btn-col',function(){A.btn();renderCollection();openOv('ov-collection');});
bind('btn-wc-next',function(){
  A.btn();closeAllOv();clrT();
  var l=parseInt($('btn-wc-next').dataset.lvl||'',10);
  R.active=false;
  if(l)startRun({mode:'campaign',level:l});
  else{renderMap();showScreen('map');}
});
bind('btn-wc-map',function(){A.btn();closeAllOv();renderMap();showScreen('map');});

/* ---------- ambient life (light on purpose) ---------- */
function menuSparkleTick(){
  if(!S.fx||document.hidden)return;
  if(!$('scr-menu').classList.contains('on'))return;
  var st=activeSet(),cols=st?setCols(st):null;
  if(S.eq.fx==='menusparkles'||cols){
    FX.burst(rnd(30,window.innerWidth-30),rnd(40,window.innerHeight*0.45),
      {n:1,colors:cols||['#FFC93C','#FFFFFF','#4CB9F2'],sp:.3,g:.02,size:4,shapes:['s']});
  }
}
/* ---------- play-time tracking: the 30-minute session goal ---------- */
var sessLastAct=Date.now(),sessSaveCt=0;
function fmtClock(s){s=Math.max(0,Math.floor(s||0));return Math.floor(s/60)+':'+pad2(s%60);}
function sessTodayVal(){return (S.sessDate===todayKey())?(S.sessToday||0):0;}
function renderSessionBar(){
  /* 30-minute goal bar removed — play-time is still tracked silently for
     Stats, but no target timer is shown anywhere in the game. */
  var el=$('m-sess');if(el)el.innerHTML='';
}
function sessMarkAct(){sessLastAct=Date.now();}
document.addEventListener('pointerdown',sessMarkAct);
document.addEventListener('keydown',sessMarkAct);
function sessTick(){
  if(document.hidden)return;
  var k=todayKey(),i;
  if(S.sessDate!==k){S.sessDate=k;S.sessToday=0;S.sessGot=[];saveKey('sessdate');saveKey('sesstoday');saveKey('sessgot');}
  if(Date.now()-sessLastAct>300000)S.sessRun=0;        /* five idle minutes ends a session */
  S.sessRun=(S.sessRun||0)+1;
  S.sessToday=(S.sessToday||0)+1;
  S.sessAll=(S.sessAll||0)+1;
  if(S.sessRun>(S.sessBest||0))S.sessBest=S.sessRun;
  sessSaveCt++;
  if(sessSaveCt>=10){
    sessSaveCt=0;
    saveKey('sesstoday');saveKey('sessrun');saveKey('sessall');saveKey('sessbest');
    achCheck();
  }
  /* goal-milestone toasts removed with the 30-minute target timer —
     sessRun/sessToday/sessBest keep tracking silently for Stats. */
  if($('scr-menu').classList.contains('on'))renderSessionBar();
}
setInterval(sessTick,1000);
setInterval(ambientTick,3000);
setInterval(menuSparkleTick,1400);
setInterval(function(){var t=$('pick-timer');if(t)t.textContent=nextRefreshTxt();},1000);

/* =========================================================
   ONLINE VERSUS lives in online.js (loaded BEFORE this file):
   player profiles, custom country flag badges, matchmaking,
   round sync, versus HUD/panels and the WebSocket transport.
   This file keeps gameplay authority — board generation,
   tiles, highlights, animations and scoring — and publishes
   the bridge below so online.js can drive a versus match.
   ========================================================= */

/* boot the cosmetic layer */
applyCosmetics();
cosCheckUnlocks(true);

/* ================= wiring ================= */
function bind(id,fn){var el=$(id);if(el)el.addEventListener('click',fn);}
bind('btn-play',function(){
  A.init();A.btn();
  mmGateTut('single',function(){
    if(S.maxlvl>=MAXLVL&&S.bosses.indexOf(MAXLVL)>=0){renderMap();showScreen('map');return;}
    renderLevelCard(S.maxlvl);openOv('ov-level');
  });
});
bind('btn-map',function(){A.init();A.btn();renderMap();showScreen('map');});
bind('map-home',function(){A.btn();showScreen('menu');refreshMenu();});
bind('btn-modes',function(){A.init();A.btn();renderModes();openOv('ov-modes');});
bind('btn-daily',function(){A.init();A.btn();renderDaily();openOv('ov-daily');});
bind('btn-vault',function(){
  A.init();A.btn();
  if(!unlocked('vault')){toast('lock','coral','Vault locked','Unlocks at Level 8');A.warn();return;}
  renderVault();openOv('ov-vault');
});
bind('btn-ach',function(){A.init();A.btn();renderAch();openOv('ov-ach');});
bind('btn-stats',function(){A.init();A.btn();renderStats();openOv('ov-stats');});
bind('btn-set',function(){A.init();A.btn();renderSettings();openOv('ov-set');});
bind('btn-pause',function(){A.init();A.btn();pauseGame();});
bind('btn-snd',function(){A.init();S.snd=!S.snd;saveKey('snd');sndIcon();A.btn();});
bind('btn-resume',function(){A.btn();resumeGame();});
bind('btn-restart',function(){
  A.btn();R.paused=false;closeOv('ov-pause');clrT();
  R.active=false;
  if(R.mode==='campaign')startRun({mode:'campaign',level:R.level,bossWarn:false});
  else if(R.mode==='daily')startRun({mode:'daily'});
  else startRun({mode:R.mode});
});
bind('btn-quit',function(){
  A.btn();R.paused=false;R.active=false;R.over=true;clrT();closeAllOv();showScreen('menu');refreshMenu();
});
bind('btn-again',function(){
  A.btn();
  var d=$('btn-again').dataset.mode,l=R.level,m=R.mode,offered=!!R.reviveOffered;
  var go=function(){
    closeAllOv();clrT();R.active=false;
    if(d==='campaign')startRun({mode:'campaign',level:l,bossWarn:false});
    else if(d==='daily')startRun({mode:'daily'});
    else startRun({mode:m});
  };
  /* Rule: never chain a midgame ad with a 'watch to keep playing' offer on the same screen */
  if(offered)go();else Plat.midgame(go);
});
bind('btn-menu2',function(){A.btn();closeAllOv();showScreen('menu');refreshMenu();});
bind('btn-revive',function(){
  A.init();A.btn();
  if(!canRevive()){refreshAdUI();return;}
  Plat.rewarded(function(){reviveRun();},function(e){
    toast('warn','coral','No ad available','Revive is not available right now');refreshAdUI();
  },'extra-life');
});
/* 'Double tokens' lives inside the re-rendered result body, so it is wired by delegation */
document.addEventListener('click',function(e){
  var t=e.target,b=null;
  while(t&&t!==document){if(t.id==='btn-2x'){b=t;break;}t=t.parentNode;}
  if(!b||b.disabled)return;
  A.init();A.btn();
  var n=parseInt(b.getAttribute('data-tok'),10)||0;
  if(!n||!Plat.rewardedOk()){refreshAdUI();return;}
  Plat.rewarded(function(){
    addTok(n);
    b.disabled=true;b.classList.add('done');
    b.innerHTML='<svg class="ic"><use href="#i-check"/></svg><span>Tokens doubled! +'+n+' added</span>';
    var row=b.parentNode?b.parentNode.querySelector('.tokrow'):null;
    if(row){var bb=row.querySelector('b'),sp=row.querySelectorAll('span');if(bb)bb.textContent='+'+(n*2);if(sp.length>1)sp[sp.length-1].innerHTML='Memory Tokens &nbsp;•&nbsp; total '+nf(S.tok);}
    toast('chip','sky','Tokens doubled!','+'+n+' bonus tokens added');
    Plat.happytime();
  },function(err){
    toast('warn','coral','No ad available','Try again in a moment');refreshAdUI();
  },'double-tokens');
});
bind('btn-lc-play',function(){
  A.btn();
  var lvl=parseInt($('btn-lc-play').dataset.lvl||S.maxlvl,10);
  mmGateTut('single',function(){
    closeAllOv();clrT();
    startRun({mode:'campaign',level:lvl});
  });
});
bind('btn-lc-back',function(){A.btn();closeOv('ov-level');});
bind('btn-win-next',function(){
  A.btn();
  var l=parseInt($('btn-win-next').dataset.lvl||'',10),daily=(!l&&R.mode==='daily');
  var go=function(){
    closeAllOv();clrT();R.active=false;
    if(l)startRun({mode:'campaign',level:l});
    else if(daily)startRun({mode:'daily'});
    else{renderMap();showScreen('map');}
  };
  if(l||daily)Plat.midgame(go);else go();
});
bind('btn-win-retry',function(){
  A.btn();closeAllOv();clrT();
  var l=parseInt($('btn-win-retry').dataset.lvl||'',10);
  R.active=false;
  if(l)startRun({mode:'campaign',level:l});
  else startRun({mode:'daily'});
});
bind('btn-win-map',function(){A.btn();closeAllOv();renderMap();showScreen('map');});
bind('btn-win-home',function(){
  A.btn();closeAllOv();clrT();R.active=false;
  showScreen('menu');refreshMenu();
  if((S.clears||0)<=2)setTimeout(function(){toast('home','sky','This is Home','Campaign, Modes, Shop, Customize and more live here');},350);
});
/* ---- first-time tutorial ---- */
bind('btn-tut-next',function(){A.init();A.btn();TUT.next();});
bind('btn-tut-skip',function(){A.init();A.btn();TUT.finish(true);});
bind('btn-tut2-skip',function(){A.init();A.btn();TUT2.finish(true);});
bind('set-howto',function(){A.init();A.btn();closeOv('ov-set');TUT2.start({replay:true,mode:'single'});});
bind('btn-bd-next',function(){
  A.btn();
  var l=parseInt($('btn-bd-next').dataset.lvl||'',10);
  var go=function(){
    closeAllOv();clrT();R.active=false;
    if(l)startRun({mode:'campaign',level:l});
    else{renderMap();showScreen('map');}
  };
  if(l)Plat.midgame(go);else go();
});
bind('btn-bd-map',function(){A.btn();closeAllOv();renderMap();showScreen('map');});
bind('btn-daily-play',function(){
  A.btn();
  if(!unlocked('daily')){toast('lock','coral','Daily locked','Unlocks at Level 12');return;}
  closeAllOv();clrT();R.active=false;
  startRun({mode:'daily'});
});
var xbtns=document.querySelectorAll('.ov-x');
for(var xi=0;xi<xbtns.length;xi++){
  xbtns[xi].addEventListener('click',function(){
    A.btn();
    var p=this.closest('.ov');
    if(!p)return;
    p.classList.remove('on');
    if(p.id==='ov-win')afterWinClose();
  });
}
for(var oi=0;oi<OVS.length;oi++){
  (function(id){
    $(id).addEventListener('click',function(e){
      if(e.target===$(id)){closeOv(id);if(id==='ov-win')afterWinClose();}
    });
  })(OVS[oi]);
}
function afterWinClose(){
  if(R.mode==='campaign'&&R.phase==='clear'){renderMap();showScreen('map');}
  else if(R.mode==='daily'&&R.phase==='reward'){showScreen('menu');refreshMenu();}
}
bind('sw-snd',function(){A.init();S.snd=!S.snd;saveKey('snd');renderSettings();sndIcon();A.btn();});
bind('sw-mus',function(){A.init();S.mus=!S.mus;saveKey('mus');renderSettings();try{if(S.mus)MU.ensure();else MU.stop();}catch(e){}A.btn();});
bind('sw-fx',function(){
  S.fx=!S.fx;saveKey('fx');renderSettings();
  if(S.fx)FX.burst(window.innerWidth/2,window.innerHeight/2,{n:12,colors:['#4CB9F2','#FFC93C','#FF6B6B','#57CB6C'],sp:3.4,shapes:['c','r','s']});
});
bind('sw-obj',function(){S.showObj=!S.showObj;saveKey('showobj');renderSettings();renderObjStrip();});
bind('sw-adapt',function(){S.adapt=!S.adapt;saveKey('adapt');renderSettings();});
var resetArmed=0;
bind('btn-reset',function(){
  A.init();
  var now=Date.now();
  if(now-resetArmed<3000&&resetArmed>0){
    var ks=[],i;
    try{
      for(i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&k.indexOf('mmx_')===0)ks.push(k);}
      for(i=0;i<ks.length;i++)localStorage.removeItem(ks[i]);
    }catch(e){}                      /* private mode / sandboxed frames simply keep the session state */
    try{location.reload();}catch(e2){closeAllOv();showScreen('menu');refreshMenu();}
  }else{
    resetArmed=now;
    $('reset-label').textContent='Tap again to confirm';
    A.warn();
    setTimeout(function(){$('reset-label').textContent='Reset Progress';},3000);
  }
});
pubar.addEventListener('click',function(e){
  var b=e.target.closest?e.target.closest('.pubtn'):null;
  if(b){A.init();A.btn();usePowerUp(b.dataset.pu);}
});
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'){
    if($('ov-pause').classList.contains('on'))resumeGame();
    else if(R.active&&!R.over&&!anyOv())pauseGame();
  }
  if(e.key===' '&&$('ov-level').classList.contains('on')){A.init();$('btn-lc-play').click();e.preventDefault();}
  if(e.key==='Enter'||e.key===' '){
    var ae=document.activeElement;
    if(ae&&ae.tagName==='BUTTON'&&ae.closest&&ae.closest('.ov.on'))return;   /* the focused button handles it */
    /* ov-tut2 is free-play (no buttons to advance) — Enter/Space intentionally do nothing there */
    if($('ov-tut').classList.contains('on')){A.init();TUT.next();e.preventDefault();}
    else if($('ov-win').classList.contains('on')){A.init();$('btn-win-next').click();e.preventDefault();}
    else if($('ov-over').classList.contains('on')){A.init();$('btn-again').click();e.preventDefault();}
  }
});
document.addEventListener('visibilitychange',function(){if(document.hidden)pauseGame();});
/* ================= first-time tutorial (3 steps) =================
   WATCH → REMEMBER → TAP, each with a live mini-board demo.
   Skip or Start both drop the player straight into Level 1.        */
var TUT={
  open:false,replay:false,step:0,timers:[],
  PAT:[1,3,8],
  STEPS:[
    {t:'Watch the tiles',d:'A few tiles light up yellow on the board. Keep your eyes on them.'},
    {t:'Remember the spots',d:'They hide after a moment. Hold the pattern in your mind.'},
    {t:'Tap them back',d:'Tap every tile that lit up — any order. Get them all to clear the level!'}
  ],
  build:function(){var g=$('tut-grid'),h='',i;for(i=0;i<9;i++)h+='<div class="tile lock"></div>';g.innerHTML=h;},
  tiles:function(){return $('tut-grid').children;},
  clear:function(){for(var i=0;i<this.timers.length;i++)clearTimeout(this.timers[i]);this.timers=[];},
  after:function(fn,ms){this.timers.push(setTimeout(function(){if(TUT.open)fn();},ms));},
  reset:function(){
    var t=this.tiles(),i;for(i=0;i<t.length;i++)t[i].className='tile lock';
    var f=$('tut-finger');if(f){f.classList.remove('show');f.classList.remove('press');}
  },
  point:function(idx){
    var f=$('tut-finger'),t=this.tiles()[idx],b=$('tut-board');if(!f||!t||!b)return;
    var r=t.getBoundingClientRect(),w=b.getBoundingClientRect();
    f.style.left=(r.left-w.left+r.width*0.64)+'px';f.style.top=(r.top-w.top+r.height*0.64)+'px';
    f.classList.add('show');
  },
  play:function(){
    this.clear();this.reset();
    var self=this,s=this.step,P=this.PAT,t=this.tiles(),i;
    var light=function(){for(i=0;i<P.length;i++)(function(idx,d){self.after(function(){t[idx].className='tile hl lock';A.show();},d);})(P[i],i*260);};
    var hide=function(d,q){self.after(function(){for(var j=0;j<P.length;j++)t[P[j]].className='tile lock'+(q?' q':'');},d);};
    if(s===0){light();hide(2300);self.after(function(){self.play();},3100);}
    else if(s===1){light();hide(1250,true);self.after(function(){self.play();},3400);}
    else{
      var f=$('tut-finger');
      for(i=0;i<P.length;i++)(function(idx,k){
        var base=420+k*680;
        self.after(function(){self.point(idx);},base);
        self.after(function(){if(f)f.classList.add('press');t[idx].className='tile ok lock';A.good();},base+270);
        self.after(function(){if(f)f.classList.remove('press');},base+430);
      })(P[i],i);
      self.after(function(){if(f)f.classList.remove('show');},420+P.length*680+250);
      self.after(function(){self.play();},420+P.length*680+1500);
    }
  },
  show:function(n){
    this.step=n;
    var st=this.STEPS[n],chips=$('tut-chips').children,dots=$('tut-dots').children,i;
    $('tut-step').textContent='STEP '+(n+1)+' OF 3';
    $('tut-title').textContent=st.t;
    $('tut-desc').textContent=st.d;
    for(i=0;i<3;i++){chips[i].className=(i<n?'done':(i===n?'on':''));dots[i].className=(i===n?'on':'');}
    var last=(n===2);
    $('tut-next-label').textContent=last?(this.replay?'Got it':'Start Level 1'):'Next';
    $('tut-next-ic').innerHTML='<use href="#i-'+(last?'play':'chev')+'"/>';
    $('btn-tut-skip').style.visibility=last?'hidden':'visible';
    $('tut-hint').textContent=last?(this.replay?'':'Your first pattern is 3 tiles on a 3×3 board'):'Tap Skip to jump straight in';
    this.play();
  },
  start:function(opts){
    opts=opts||{};
    this.replay=!!opts.replay;this.open=true;
    this.build();
    $('ov-tut').classList.add('on');
    this.show(0);
  },
  next:function(){if(!this.open)return;if(this.step<2)this.show(this.step+1);else this.finish(false);},
  close:function(){this.clear();this.open=false;$('ov-tut').classList.remove('on');},
  finish:function(skipped){
    if(!this.open)return;
    this.close();
    if(!S.tut){S.tut=true;saveKey('tut');}
    if(this.replay)return;
    clrT();R.active=false;
    startRun({mode:'campaign',level:1,bossWarn:false,quick:true});
  }
};
/* first launch = never saw the tutorial AND no progress of any kind */
function isFirstTime(){
  if(S.tut)return false;
  var has=(S.games>0)||(S.clears>0)||(S.maxlvl>1)||(S.best>0)||((S.tokAll||0)>0);
  if(has){S.tut=true;saveKey('tut');return false;}
  return true;
}
/* =========================================================
   ONLINE BRIDGE — online.js (loaded before this file) owns
   all networking & profile logic; it drives gameplay through
   these window-level references. Everything is resolved at
   runtime (never at parse time), and profile metadata
   (nickname, country) never touches seeds, tap validation
   or scoring — the server stays the single authority.
   ========================================================= */
window.$=$;window.nf=nf;window.clamp=clamp;window.rnd=rnd;window.vib=vib;
window.S=S;window.R=R;window.A=A;window.FX=FX;window.Plat=Plat;
window.toast=toast;window.banner=banner;
window.showScreen=showScreen;window.openOv=openOv;window.closeOv=closeOv;window.closeAllOv=closeAllOv;window.OVS=OVS;
window.saveKey=saveKey;window.refreshMenu=refreshMenu;
window.clrT=clrT;window.lockAll=lockAll;window.resetBoard=resetBoard;window.setTile=setTile;window.tileAt=tileAt;window.tileCenter=tileCenter;
window.setObj=setObj;window.setScore=setScore;window.setProg=setProg;
window.renderHearts=renderHearts;window.updateHUD=updateHUD;window.hideBossBar=hideBossBar;
window.renderPuBar=renderPuBar;window.updatePuStates=updatePuStates;
window.beginRound=beginRound;window.multOf=multOf;
window.spawnTrail=spawnTrail;window.pcols=pcols;window.pshapes=pshapes;window.tapRipple=tapRipple;
window.refreshRecallCounter=refreshRecallCounter;window.missFlash=missFlash;window.flareTiles=flareTiles;
window.boardTopCenter=boardTopCenter;window.boardCenter=boardCenter;
window.objstrip=objstrip;window.board=board;window.elMult=elMult;
window.mmResetHeartsShown=function(){heartsShown=-1;};
window.mmResetRecent=function(){RECENT=[];};
window.TUT2=TUT2;window.mmNeedsTut=mmNeedsTut;window.mmGateTut=mmGateTut;
window.MU=MU;window.pauseGame=pauseGame;window.resumeGame=resumeGame;
window.mmGameReady=true;

/* ================= loading screen =================
   Branded boot overlay (see #loader in index.html). Progress is staged:
   it eases toward 90% while the page finishes loading, then completes.
   A failsafe guarantees the menu appears even if `load` never fires. */
var LOADER={
  pct:0,iv:0,tipI:0,tipIv:0,done:false,
  tips:[
    'Tip: look at the whole pattern, not one tile at a time.',
    'Tip: fast recalls build a combo multiplier.',
    'Tip: wrong taps cost a heart — you have 3.',
    'Tip: decoy tiles are bonus score. Grab them!',
    'Tip: online matches are 5 rounds — highest total wins.'
  ],
  start:function(){
    var self=this,fill=$('ld-fill'),pct=$('ld-pct'),tip=$('ld-tip');
    if(!fill)return;
    if(tip){tip.textContent=this.tips[0];}
    this.tipIv=setInterval(function(){
      self.tipI=(self.tipI+1)%self.tips.length;
      var t=$('ld-tip');if(t)t.textContent=self.tips[self.tipI];
    },1500);
    this.iv=setInterval(function(){
      if(self.pct<90){self.pct=Math.min(90,self.pct+4+Math.random()*7);self.paint();}
    },140);
  },
  paint:function(){
    var fill=$('ld-fill'),pct=$('ld-pct');
    if(fill)fill.style.width=Math.round(this.pct)+'%';
    if(pct)pct.textContent=Math.round(this.pct)+'%';
  },
  finish:function(cb){
    if(this.done){if(cb)cb();return;}
    this.done=true;
    if(this.iv){clearInterval(this.iv);this.iv=0;}
    if(this.tipIv){clearInterval(this.tipIv);this.tipIv=0;}
    this.pct=100;this.paint();
    setTimeout(function(){
      var l=$('loader');if(l)l.classList.add('hide');
      setTimeout(function(){var l2=$('loader');if(l2)l2.style.display='none';},500);
      if(cb)cb();
    },320);
  }
};

/* ================= interactive tutorial (TUT2) =================
   Fullscreen, free-play, NOT step-based: one watch-and-recall practice
   round on a 3x3 board. The player watches 3 tiles flash, then taps them
   back at their own pace — combo and hearts teach themselves through play
   (contextual coach tips, zero gates, zero Next buttons). Clearing the
   pattern finishes automatically; Skip stays for instant-play joiners.
   Gating API is unchanged: start({mode,onDone,replay}), S.tut2 persists,
   mmNeedsTut/mmGateTut untouched. */
function mmNeedsTut(){return !S.tut2&&!S.tut;}
function mmGateTut(mode,cb){
  if(!mmNeedsTut()){cb();return;}
  TUT2.start({mode:(mode==='online'?'online':'single'),onDone:cb});
}
var TUT2={
  open:false,replay:false,mode:'single',phase:'watch',onDone:null,timers:[],
  PAT:[1,3,8],
  found:{},foundN:0,need:3,hearts:3,combo:0,lastTap:0,lock:false,
  saidCombo:false,saidHeart:false,done:false,
  build:function(){
    var g=$('tut2-grid'),h='',i;
    for(i=0;i<9;i++)h+='<div class="tile lock" data-t2="'+i+'"><span class="ord"></span></div>';
    g.innerHTML=h;
    var self=this;
    var tiles=g.children;
    for(i=0;i<tiles.length;i++){
      (function(idx){
        tiles[idx].addEventListener('pointerdown',function(e){e.preventDefault();self.tap(idx);},{passive:false});
      })(i);
    }
    this.paintHearts();
  },
  tiles:function(){return $('tut2-grid').children;},
  clear:function(){for(var i=0;i<this.timers.length;i++)clearTimeout(this.timers[i]);this.timers=[];},
  after:function(fn,ms){var self=this;this.timers.push(setTimeout(function(){if(self.open)fn();},ms));},
  coach:function(html,ms){
    var c=$('tut2-coach');if(!c)return;
    c.innerHTML=html;c.classList.add('show');
    var self=this;
    this.timers.push(setTimeout(function(){var c2=$('tut2-coach');if(c2)c2.classList.remove('show');},ms||2200));
  },
  phaseLabel:function(){
    var p=$('tut2-phase');if(!p)return;
    p.textContent=this.phase==='watch'?'WATCH':'YOUR TURN';
    p.className='tut2-phase '+(this.phase==='watch'?'w':'r');
  },
  paintHearts:function(){
    var el=$('tut2-hearts');if(!el)return;
    var h='',i;
    for(i=0;i<3;i++)h+='<svg class="'+(i<this.hearts?'':'off')+'" viewBox="0 0 24 24"><use href="#i-heart"/></svg>';
    el.innerHTML=h;
  },
  paintProg:function(){
    var f=$('tut2-fill'),t=$('tut2-ptxt');
    if(f)f.style.width=Math.round((this.foundN/Math.max(1,this.need))*100)+'%';
    if(t)t.textContent=this.phase==='watch'?'watch…':(this.foundN+' / '+this.need+' found');
  },
  reset:function(){
    var t=this.tiles(),i;
    for(i=0;i<t.length;i++){t[i].className='tile lock';t[i].firstChild.textContent='';}
    this.found={};this.foundN=0;this.combo=0;this.lock=false;
  },
  flash:function(pat,hold,cb){
    var self=this,t=this.tiles(),i;
    this.lock=true;
    for(i=0;i<pat.length;i++){
      (function(idx,k){
        self.after(function(){t[idx].className='tile hl lock';A.show();},k*280);
      })(pat[i],i);
    }
    this.after(function(){
      var j,tt=self.tiles();
      for(j=0;j<pat.length;j++)tt[pat[j]].className='tile lock';
      self.lock=false;
      if(cb)cb();
    },pat.length*280+(hold||900));
  },
  arm:function(pat){
    var t=this.tiles(),i;
    for(i=0;i<t.length;i++)t[i].classList.remove('lock');
    this.need=pat.length;this.foundN=0;this.found={};
    this.paintProg();
  },
  tap:function(idx){
    if(!this.open||this.lock||this.done)return;
    if(this.phase!=='recall')return;
    var pat=this.PAT,t=this.tiles();
    if(this.found[idx])return;
    if(pat.indexOf(idx)>=0){
      var now=performance.now(),dt=now-(this.lastTap||now);
      this.lastTap=now;
      this.found[idx]=1;this.foundN++;
      this.combo++;
      t[idx].className='tile ok lock';
      A.good();vib(10);
      var pts=10+this.combo*5;
      try{
        var r=t[idx].getBoundingClientRect();
        FX.text(r.left+r.width/2,r.top-6,'+'+pts,'#2FA24A',14);
        if(this.combo>=2)FX.text(r.left+r.width/2,r.top-24,'COMBO x'+this.combo,'#9A6E08',12);
      }catch(e){}
      if(this.combo>=2&&!this.saidCombo){this.saidCombo=true;this.coach('<b>COMBO x'+this.combo+'!</b> Fast taps multiply your score.');}
      this.paintProg();
      if(this.foundN>=this.need){
        var self=this;
        this.lock=true;this.done=true;
        A.star(2);
        $('tut2-title').textContent='You got it!';
        $('tut2-desc').textContent=this.mode==='online'?'Same pattern, same clock — go beat your rival!':'That is the whole game: SEE → REMEMBER → TAP.';
        try{var bc=$('tut2-board').getBoundingClientRect();FX.fountain(bc.left+bc.width/2,bc.top+bc.height/2,20);}catch(e2){}
        A.won();
        this.coach('<b>Perfect recall!</b> '+(this.mode==='online'?'Finding your match…':'Starting level 1…'));
        this.after(function(){self.finish(false);},1800);
      }
    }else{
      t[idx].className='tile no lock';
      A.bad();vib(25);
      var self2=this;
      setTimeout(function(){if(self2.open&&t[idx].className.indexOf('no')>=0){t[idx].className='tile';}},450);
      this.combo=0;
      this.hearts--;this.paintHearts();
      if(this.hearts<=0){
        this.hearts=3;this.paintHearts();
        this.coach('Out of hearts — <b>watch once more!</b>');
        var self3=this;
        this.reset();
        this.phase='watch';this.phaseLabel();this.paintProg();
        this.flash(this.PAT,1100,function(){self3.recall(false);});
      }else{
        if(!this.saidHeart){this.saidHeart=true;this.coach('Miss! Wrong taps cost <b>hearts</b> — '+this.hearts+' left.');}
        else this.coach('<b>'+this.hearts+' heart'+(this.hearts===1?'':'s')+' left!</b> Find the glowing spots.');
      }
    }
  },
  watch:function(){
    this.clear();
    this.phase='watch';this.phaseLabel();
    $('tut2-title').textContent='Watch the tiles';
    $('tut2-desc').textContent='Three tiles light up — memorize them, then tap them back!';
    this.reset();this.paintHearts();this.need=this.PAT.length;this.foundN=0;this.paintProg();
    var self=this;
    this.after(function(){
      self.flash(self.PAT,1100,function(){self.recall(true);});
    },600);
  },
  recall:function(first){
    if(!this.open||this.done)return;
    this.phase='recall';this.phaseLabel();
    $('tut2-title').textContent='Your turn — tap them back';
    $('tut2-desc').textContent='Find all 3. Fast taps build COMBO · misses cost hearts.';
    if(first)this.coach('<b>Your turn!</b> Tap the 3 spots.',1800);
    this.arm(this.PAT);
  },
  start:function(opts){
    opts=opts||{};
    this.replay=!!opts.replay;
    this.mode=(opts.mode==='online')?'online':'single';
    this.onDone=(typeof opts.onDone==='function')?opts.onDone:null;
    this.open=true;this.hearts=3;this.done=false;this.saidCombo=false;this.saidHeart=false;
    this.lastTap=0;this.combo=0;
    this.build();
    var vs=$('tut2-vs');
    if(vs)vs.classList.toggle('hidden',this.mode!=='online');
    if(this.mode==='online'){
      var r=(window.MP&&MP.rounds)||5;
      var el=$('tut2-vs-rounds');if(el)el.textContent=r+' rounds — highest total wins';
    }
    openOv('ov-tut2');
    this.watch();
  },
  close:function(){this.clear();this.open=false;closeOv('ov-tut2');},
  finish:function(skipped){
    if(!this.open)return;
    this.close();
    if(!S.tut2){S.tut2=true;saveKey('tut2');}
    if(!S.tut){S.tut=true;saveKey('tut');}
    var cb=this.onDone;this.onDone=null;
    if(this.replay)return;
    if(cb)cb();
    else{clrT();R.active=false;startRun({mode:'campaign',level:1,bossWarn:false,quick:true});}
  }
};

/* re-export (the bridge above runs before this `var` is assigned) */
window.TUT2=TUT2;

/* ================= boot ================= */
function dailyTick(){
  S.dlast=S.dlast||'';
  if(S.ddata&&S.ddata.lastdone&&S.ddata.lastdone!==S.dlast)S.dlast=S.ddata.lastdone;
  saveKey('dlast');
}
function boot(){
  dailyTick();
  refreshMenu();
  sndIcon();
  renderSettings();
  grid.addEventListener('contextmenu',function(e){e.preventDefault();});
  buildGrid(3);
  /* returning players who finished the legacy tutorial are grandfathered —
     the interactive tutorial only ever gates brand-new players. */
  if(S.tut&&!S.tut2){S.tut2=true;saveKey('tut2');}
  /* loading screen -> main menu, ALWAYS (even first run).
     The interactive tutorial gates Play / Play Online instead of
     hijacking boot, so the menu is never skipped. */
  showScreen('menu');
  LOADER.start();
  var ready=false;
  var go=function(){
    if(ready)return;ready=true;
    LOADER.finish(function(){showScreen('menu');refreshMenu();try{if(typeof window!=='undefined'&&typeof window.mmBootMenu==='function')window.mmBootMenu();}catch(e){}});
    Plat.loadingStop();
  };
  try{
    if(document.readyState==='complete')setTimeout(go,900);
    else{
      window.addEventListener('load',function(){setTimeout(go,600);});
      setTimeout(go,3500);   /* failsafe: slow fonts/SDK never trap the loader */
    }
  }catch(e){setTimeout(go,1200);}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
else boot();
})();
