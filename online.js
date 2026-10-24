/* =========================================================
   Memory Matrix — ONLINE.JS
   ---------------------------------------------------------
   Everything ONLINE lives in this file:

   PART 1  Player profile system — nickname + country, saved
           locally (localStorage). Validation & sanitization.
   PART 2  Built-in country dataset + custom flat-vector flag
           badges drawn in the Memory Matrix art direction
           (chunky rounded shapes, flat shading, navy depth).
           No emoji, no images, no external flag APIs.
   PART 3  Profile UI — CREATE / EDIT screens and the
           searchable country picker.
   PART 4  Online versus networking — WebSocket transport,
           matchmaking, round sync, versus HUD & panels.
   PART 5  Wiring + exports.

   LOAD ORDER: this file is loaded BEFORE game.js. game.js
   stays responsible for board generation, tiles, highlights,
   animations, scoring and gameplay; at the end of game.js a
   small bridge (window.$, window.R, window.S, window.A …)
   exposes those internals, and every gameplay reference in
   this file resolves through that bridge AT RUNTIME (never
   at parse time). Nickname & country are display-only
   metadata — they never influence seeds, tap validation or
   scoring on either client or server.
   ========================================================= */
(function(){
'use strict';

/* ---------- local helpers (DOM only — safe before game.js loads) ---------- */
var $=function(id){return document.getElementById(id);};
function esc(s){
  return String(s==null?'':s).replace(/[&<>"']/g,function(c){
    return c==='&'?'&amp;':(c==='<'?'&lt;':(c==='>'?'&gt;':(c==='"'?'&quot;':'&#39;')));
  });
}
function ovOpen(id){var e=$(id);if(!e)return;if(window.openOv)window.openOv(id);else e.classList.add('on');}
function ovClose(id){var e=$(id);if(!e)return;if(window.closeOv)window.closeOv(id);else e.classList.remove('on');}
function beep(){if(window.A){try{A.init();A.btn();}catch(e){}}}

/* =========================================================
   PART 1 — PROFILE DATA: validation, sanitization, storage
   ========================================================= */
var PROF_KEY='memorymatrix_profile';   /* intentionally outside the mmx_ save namespace:
                                          it is an identity, not progress — but still local */

/* code-point aware length/slice (nickname rules count characters, not UTF-16 units) */
function cpLen(s){
  var n=0,i=0,c,c2;
  while(i<s.length){
    c=s.charCodeAt(i);
    if(c>=0xD800&&c<=0xDBFF&&i+1<s.length){c2=s.charCodeAt(i+1);if(c2>=0xDC00&&c2<=0xDFFF){i+=2;n++;continue;}}
    i++;n++;
  }
  return n;
}
function cpSlice(s,max){
  var out='',n=0,i=0,c,c2;
  while(i<s.length&&n<max){
    c=s.charCodeAt(i);
    if(c>=0xD800&&c<=0xDBFF&&i+1<s.length){c2=s.charCodeAt(i+1);if(c2>=0xDC00&&c2<=0xDFFF){out+=s.charAt(i)+s.charAt(i+1);i+=2;n++;continue;}}
    out+=s.charAt(i);i++;n++;
  }
  return out;
}

/* Nickname sanitizer — defense in depth:
   1. strip control chars, zero-width & bidi-override chars
   2. strip emoji / pictographs / dingbats / astral symbol planes
   3. strip ASCII punctuation & symbols (letters & digits of ANY script stay),
      keeping only space . _ - '
   4. collapse whitespace, trim, cap to 16 code points
   Rendering additionally always goes through esc()/textContent, so even a
   hostile opponent string can never inject HTML into a panel.            */
function profStrip(raw){
  var s=String(raw==null?'':raw);
  s=s.replace(/[\u0000-\u001F\u007F\u00AD\u200B-\u200F\u2028\u2029\u202A-\u202E\u2060-\u2064\uFEFF]/g,'');
  s=s.replace(/[\u2190-\u2BFF\u3030\u303D\u3297\u3299\uFE0E\uFE0F]/g,'');
  s=s.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g,'');
  s=s.replace(/[!"#$%&()*+,\/:;<=>?@\[\\\]^`{|}~]/g,'');
  s=s.replace(/\s+/g,' ').trim();
  s=s.replace(/^[.'_-]+|[.'_-]+$/g,'');
  return cpSlice(s,16);
}
/* full check used by the profile form — returns a reason so the UI can explain */
function profCheckNick(raw){
  var s=profStrip(raw);
  if(!s)return {ok:false,err:'Pick a nickname — 2 to 16 characters'};
  if(cpLen(s)<2)return {ok:false,err:'Nicknames need at least 2 characters'};
  if(!/[^\s.'_-]/.test(s))return {ok:false,err:'Use at least 2 letters or numbers'};
  return {ok:true,nick:s,err:''};
}
/* lightweight variant used to sanitize data coming FROM an opponent */
function profCleanNick(raw){var r=profCheckNick(raw);return r.ok?r.nick:'';}

/* standardized country codes: ISO 3166-1 alpha-2 that exist in the built-in
   dataset, else 'XX' (the neutral WORLD badge) */
function profValidCc(cc){
  cc=String(cc==null?'':cc).trim().toUpperCase();
  if(!/^[A-Z]{2}$/.test(cc))return 'XX';
  return CTYMAP[cc]?cc:'XX';
}

var MMP={
  data:null,
  load:function(){
    this.data=null;
    try{
      var d=JSON.parse(localStorage.getItem(PROF_KEY)||'null');
      if(d&&typeof d==='object'){
        var nick=profCleanNick(d.nick),cc=profValidCc(d.cc);
        if(nick)this.data={nick:nick,cc:cc};
      }
    }catch(e){}
    return this.data;
  },
  save:function(){
    try{localStorage.setItem(PROF_KEY,JSON.stringify(this.data));}catch(e){}
  },
  set:function(nick,cc){
    this.data={nick:nick,cc:profValidCc(cc)};
    this.save();
  },
  has:function(){return !!(this.data&&this.data.nick);},
  nick:function(){return (this.data&&this.data.nick)||'';},
  cc:function(){return (this.data&&this.data.cc)||'XX';}
};

/* ---------- built-in country dataset (no external API) ---------- */
/* code + display name, parsed into a list and a lookup map */
var CTY=(function(){
  var raw=
'AF Afghanistan|AX Åland Islands|AL Albania|DZ Algeria|AS American Samoa|AD Andorra|AO Angola|AI Anguilla|AQ Antarctica|AG Antigua & Barbuda|AR Argentina|AM Armenia|AW Aruba|AU Australia|AT Austria|AZ Azerbaijan|BS Bahamas|BH Bahrain|BD Bangladesh|BB Barbados|BY Belarus|BE Belgium|BZ Belize|BJ Benin|BM Bermuda|BT Bhutan|BO Bolivia|BQ Caribbean Netherlands|BA Bosnia & Herzegovina|BW Botswana|BV Bouvet Island|BR Brazil|IO British Indian Ocean Territory|BN Brunei|BG Bulgaria|BF Burkina Faso|BI Burundi|CV Cape Verde|KH Cambodia|CM Cameroon|CA Canada|KY Cayman Islands|CF Central African Republic|TD Chad|CL Chile|CN China|CX Christmas Island|CC Cocos Islands|CO Colombia|KM Comoros|CG Congo|CD Congo (DR)|CK Cook Islands|CR Costa Rica|CI Côte d’Ivoire|HR Croatia|CU Cuba|CW Curaçao|CY Cyprus|CZ Czechia|DK Denmark|DJ Djibouti|DM Dominica|DO Dominican Republic|EC Ecuador|EG Egypt|SV El Salvador|GQ Equatorial Guinea|ER Eritrea|EE Estonia|SZ Eswatini|ET Ethiopia|FK Falkland Islands|FO Faroe Islands|FJ Fiji|FI Finland|FR France|GF French Guiana|PF French Polynesia|TF French Southern Territories|GA Gabon|GM Gambia|GE Georgia|DE Germany|GH Ghana|GI Gibraltar|GR Greece|GL Greenland|GD Grenada|GP Guadeloupe|GU Guam|GT Guatemala|GG Guernsey|GN Guinea|GW Guinea-Bissau|GY Guyana|HT Haiti|HM Heard & McDonald Islands|VA Vatican City|HN Honduras|HK Hong Kong|HU Hungary|IS Iceland|IN India|ID Indonesia|IR Iran|IQ Iraq|IE Ireland|IM Isle of Man|IL Israel|IT Italy|JM Jamaica|JP Japan|JE Jersey|JO Jordan|KZ Kazakhstan|KE Kenya|KI Kiribati|KP North Korea|KR South Korea|XK Kosovo|KW Kuwait|KG Kyrgyzstan|LA Laos|LV Latvia|LB Lebanon|LS Lesotho|LR Liberia|LY Libya|LI Liechtenstein|LT Lithuania|LU Luxembourg|MO Macao|MG Madagascar|MW Malawi|MY Malaysia|MV Maldives|ML Mali|MT Malta|MH Marshall Islands|MQ Martinique|MR Mauritania|MU Mauritius|YT Mayotte|MX Mexico|FM Micronesia|MD Moldova|MC Monaco|MN Mongolia|ME Montenegro|MS Montserrat|MA Morocco|MZ Mozambique|MM Myanmar|NA Namibia|NR Nauru|NP Nepal|NL Netherlands|NC New Caledonia|NZ New Zealand|NI Nicaragua|NE Niger|NG Nigeria|NU Niue|NF Norfolk Island|MK North Macedonia|MP Northern Mariana Islands|NO Norway|OM Oman|PK Pakistan|PW Palau|PS Palestine|PA Panama|PG Papua New Guinea|PY Paraguay|PE Peru|PH Philippines|PN Pitcairn Islands|PL Poland|PT Portugal|PR Puerto Rico|QA Qatar|RE Réunion|RO Romania|RU Russia|RW Rwanda|BL Saint Barthélemy|SH Saint Helena|KN Saint Kitts & Nevis|LC Saint Lucia|MF Saint Martin|PM Saint Pierre & Miquelon|VC Saint Vincent|WS Samoa|SM San Marino|ST São Tomé & Príncipe|SA Saudi Arabia|SN Senegal|RS Serbia|SC Seychelles|SL Sierra Leone|SG Singapore|SX Sint Maarten|SK Slovakia|SI Slovenia|SB Solomon Islands|SO Somalia|ZA South Africa|GS South Georgia & Sandwich Islands|SS South Sudan|ES Spain|LK Sri Lanka|SD Sudan|SR Suriname|SJ Svalbard & Jan Mayen|SE Sweden|CH Switzerland|SY Syria|TW Taiwan|TJ Tajikistan|TZ Tanzania|TH Thailand|TL Timor-Leste|TG Togo|TK Tokelau|TO Tonga|TT Trinidad & Tobago|TN Tunisia|TR Türkiye|TM Turkmenistan|TC Turks & Caicos|TV Tuvalu|UG Uganda|UA Ukraine|AE United Arab Emirates|GB United Kingdom|US United States|UM US Outlying Islands|UY Uruguay|UZ Uzbekistan|VU Vanuatu|VE Venezuela|VN Vietnam|VG British Virgin Islands|VI US Virgin Islands|WF Wallis & Futuna|EH Western Sahara|YE Yemen|ZM Zambia|ZW Zimbabwe';
  var out=raw.split('|'),list=[],i,p,sp;
  for(i=0;i<out.length;i++){
    p=out[i];sp=p.indexOf(' ');
    if(sp<1)continue;
    list.push({c:p.slice(0,sp),n:p.slice(sp+1)});
  }
  return list;
})();
var CTYMAP=(function(){var m={},i;for(i=0;i<CTY.length;i++)m[CTY[i].c]=CTY[i].n;m.XX='World';return m;})();
function ctyName(cc){cc=profValidCc(cc);return CTYMAP[cc]||(cc==='XX'?'World':'World');}
/* =========================================================
   PART 2 — CUSTOM FLAG BADGES (Memory Matrix art direction)
   ---------------------------------------------------------
   Every flag is drawn as flat vector art on one shared 36x26
   canvas, with the SAME badge treatment for every country:
   chunky rounded shape, crisp navy border, hard navy bottom
   edge, flat white top highlight and subtle navy bottom shade
   (both added by the renderer, never by the country art).
   Simplified, bold, game-like — never photoreal, never an
   emoji, never an external image. Unknown / missing codes
   fall back to the neutral WORLD badge.
   ========================================================= */

/* palette — harmonized with the Memory Matrix colors */
var W='#FFFFFF',K='#28304E',
    RED='#EE5253',DRED='#C93B4A',CRIM='#B02A44',MAROON='#8A2B45',
    OG='#FF9933',ORANGE='#FF9F1A',GOLD='#FFC93C',GOLD2='#E0A31E',
    GREEN='#3FB757',DGREEN='#14804A',
    SKY='#4CB9F2',LBLUE='#74ACDF',AZURE='#2E86D6',BLUE='#2E55A8',NAVYF='#223070',NAVY='#1F2A52',
    BROWN='#A9744F',TAN='#E8CE95',PINK='#F06595',GREY='#B9C4DD',PURP='#7D5BA6';

function fgN(v){return Math.round(v*100)/100;}
function fgR(x,y,w,h,c,rx){return '<rect x="'+fgN(x)+'" y="'+fgN(y)+'" width="'+fgN(w)+'" height="'+fgN(h)+'"'+(rx?' rx="'+fgN(rx)+'"':'')+' fill="'+c+'"/>';}
function fgC(cx,cy,r,c){return '<circle cx="'+fgN(cx)+'" cy="'+fgN(cy)+'" r="'+fgN(r)+'" fill="'+c+'"/>';}
function fgRING(cx,cy,r,c,sw){return '<circle cx="'+fgN(cx)+'" cy="'+fgN(cy)+'" r="'+fgN(r)+'" fill="none" stroke="'+c+'" stroke-width="'+fgN(sw)+'"/>';}
function fgE(cx,cy,rx,ry,c,rot){return '<ellipse cx="'+fgN(cx)+'" cy="'+fgN(cy)+'" rx="'+fgN(rx)+'" ry="'+fgN(ry)+'"'+(rot?' transform="rotate('+fgN(rot)+' '+fgN(cx)+' '+fgN(cy)+')"':'')+' fill="'+c+'"/>';}
function fgP(pts,c){return '<polygon points="'+pts+'" fill="'+c+'"/>';}
function fgL(x1,y1,x2,y2,c,w){return '<line x1="'+fgN(x1)+'" y1="'+fgN(y1)+'" x2="'+fgN(x2)+'" y2="'+fgN(y2)+'" stroke="'+c+'" stroke-width="'+fgN(w)+'"/>';}
function fgSP(cx,cy,r,n,rot,inner){
  var i,a,rr,pts=[],ri=r*(inner==null?0.47:inner);
  n=n||5;rot=((rot==null?-90:rot))*Math.PI/180;
  for(i=0;i<n*2;i++){a=rot+i*Math.PI/n;rr=(i%2===0)?r:ri;pts.push(fgN(cx+rr*Math.cos(a))+','+fgN(cy+rr*Math.sin(a)));}
  return pts.join(' ');
}
function fgST(cx,cy,r,c,n,rot,inner){return fgP(fgSP(cx,cy,r,n,rot,inner),c);}
function fgSTO(cx,cy,r,c,sw,n,rot,inner){return '<polygon points="'+fgSP(cx,cy,r,n,rot,inner)+'" fill="none" stroke="'+c+'" stroke-width="'+fgN(sw)+'" stroke-linejoin="round"/>';}
function fgT3O(cx,cy,r,c,sw,rot){
  var i,a,pts=[];rot=((rot==null?-90:rot))*Math.PI/180;
  for(i=0;i<3;i++){a=rot+i*2*Math.PI/3;pts.push(fgN(cx+r*Math.cos(a))+','+fgN(cy+r*Math.sin(a)));}
  return '<polygon points="'+pts.join(' ')+'" fill="none" stroke="'+c+'" stroke-width="'+fgN(sw)+'" stroke-linejoin="round"/>';
}
/* sun disc + chunky rays */
function fgSUN(cx,cy,r,c,n,len){n=n||12;len=(len==null)?r*0.62:len;return fgST(cx,cy,r+len,c,n,-90,r/(r+len))+fgC(cx,cy,r,c);}
/* crescent moon — pure path (no masks, no ids → safe to repeat on one page) */
function fgCRESC(cx,cy,r,c,rot,dxk,rk){
  rot=(rot==null)?0:rot;dxk=(dxk==null)?0.52:dxk;rk=(rk==null)?0.9:rk;
  var dx=r*dxk,r2=r*rk;
  var ix=(dx*dx+r*r-r2*r2)/(2*dx);
  var iy=Math.sqrt(Math.max(0.01,r*r-ix*ix));
  var psi=Math.acos(Math.min(1,Math.max(-1,(dx-ix)/r2)))*180/Math.PI;
  var big2=(2*psi>180)?1:0;
  var d='M'+fgN(cx+ix)+' '+fgN(cy-iy)+
        'A'+fgN(r)+' '+fgN(r)+' 0 1 0 '+fgN(cx+ix)+' '+fgN(cy+iy)+
        'A'+fgN(r2)+' '+fgN(r2)+' 0 '+big2+' 1 '+fgN(cx+ix)+' '+fgN(cy-iy)+'Z';
  var p='<path d="'+d+'" fill="'+c+'"/>';
  return rot?('<g transform="rotate('+fgN(rot)+' '+fgN(cx)+' '+fgN(cy)+')">'+p+'</g>'):p;
}
/* stripes — entries are colors or [color,weight] */
function fgBW(x){return (typeof x==='string')?[x,1]:x;}
function fgHS(bs){
  var i,tw=0,s='',y=0,e,h;
  for(i=0;i<bs.length;i++)tw+=fgBW(bs[i])[1];
  for(i=0;i<bs.length;i++){e=fgBW(bs[i]);h=26*e[1]/tw;s+=fgR(0,y,36,h+0.08,e[0]);y+=h;}
  return s;
}
function fgVS(bs){
  var i,tw=0,s='',x=0,e,w;
  for(i=0;i<bs.length;i++)tw+=fgBW(bs[i])[1];
  for(i=0;i<bs.length;i++){e=fgBW(bs[i]);w=36*e[1]/tw;s+=fgR(x,0,w+0.08,26,e[0]);x+=w;}
  return s;
}
function fgTRI(c,d){return fgP('0,0 '+fgN(d)+',13 0,26',c);}          /* hoist triangle */
function fgCROSSC(c,vw,hh){return fgR(18-vw/2,3.4,vw,19.2,c)+fgR(5.4,13-hh/2,25.2,hh,c);} /* centered cross */
function fgNORD(xc,fimb,c){
  var s='';
  if(fimb)s+=fgR(xc-5.7,0,11.4,26,fimb)+fgR(0,7.2,36,11.6,fimb);
  s+=fgR(xc-3.1,0,6.2,26,c)+fgR(0,9.8,36,6.4,c);
  return s;
}
/* chunky Union Jack (shared by GB and the ensign cantons) */
function fgUNION(x,y,w,h){
  return '<svg x="'+fgN(x)+'" y="'+fgN(y)+'" width="'+fgN(w)+'" height="'+fgN(h)+'" viewBox="0 0 36 26" preserveAspectRatio="none">'+
    fgR(0,0,36,26,NAVYF)+
    fgL(0,0,36,26,W,7.4)+fgL(36,0,0,26,W,7.4)+
    fgL(0,0,36,26,DRED,3.2)+fgL(36,0,0,26,DRED,3.2)+
    fgL(18,0,18,26,W,11)+fgL(0,13,36,13,W,11)+
    fgL(18,0,18,26,DRED,6.4)+fgL(0,13,36,13,DRED,6.4)+
  '</svg>';
}

/* ---------- country flag art (simplified flat-vector badges) ---------- */
var FLAGS={
XX:function(){ /* neutral WORLD badge */
  var s=fgR(0,0,36,26,SKY)+fgC(18,13,9.2,W);
  s+='<ellipse cx="18" cy="13" rx="4.3" ry="9.2" fill="none" stroke="#BFE3F8" stroke-width="1.2"/>';
  s+=fgL(8.8,13,27.2,13,'#BFE3F8',1.2)+fgL(10.6,8.4,25.4,8.4,'#BFE3F8',1)+fgL(10.6,17.6,25.4,17.6,'#BFE3F8',1);
  s+=fgE(14.4,10.2,2.7,2.2,GREEN)+fgE(21.4,15.6,2.5,2.8,GREEN)+fgE(16.2,17.4,1.5,1.2,GREEN);
  s+=fgST(5.6,4.6,1.7,GOLD)+fgST(30.6,21.2,1.7,GOLD);
  return s;
},
AF:function(){return fgVS([K,RED,GREEN])+fgRING(18,13,4.3,W,1)+fgC(18,11.2,1.4,W)+fgR(16.6,12.4,2.8,2.4,W,0.7);},
AX:function(){return fgR(0,0,36,26,'#1E64A5')+fgNORD(12.5,GOLD,RED);},
AL:function(){return fgR(0,0,36,26,RED)+fgE(18,13.4,4.2,5,K)+fgC(15.8,7.8,1.6,K)+fgC(20.2,7.8,1.6,K)+fgP('13.4,9 7.8,5.6 12,13.2',K)+fgP('22.6,9 28.2,5.6 24,13.2',K)+fgP('15.6,17.4 18,21.4 20.4,17.4',K);},
DZ:function(){return fgVS([GREEN,W])+fgCRESC(18.4,13,4.4,RED)+fgST(21.8,13,1.9,RED);},
AS:function(){return fgR(0,0,36,26,W)+fgP('36,0 36,26 7,13',BLUE)+fgP('36,2.2 36,23.8 10.4,13',W)+fgE(26,13,2.2,1.5,'#6B4A2E')+fgP('23.8,12.6 26,11.2 28.2,12.6 26,13.6',K);},
AD:function(){return fgVS([BLUE,GOLD,RED])+fgR(16.6,10.2,2.8,4.6,DRED,0.7)+fgC(18,9.6,1,GOLD);},
AO:function(){var s=fgHS([RED,K]);s+='<path d="M13.6 17.4 A 5.4 5.4 0 1 1 22.4 17.4" fill="none" stroke="'+GOLD+'" stroke-width="1.6" stroke-linecap="round"/>';return s+fgST(18,7.8,2.1,GOLD)+fgL(14.4,18.6,22.4,9.6,GOLD,1.2);},
AI:function(){return fgR(0,0,36,26,NAVYF)+fgUNION(0,0,17,12)+fgC(27,13.6,4.2,W)+fgE(25.4,13,1,1.6,ORANGE,-20)+fgE(27,12,1,1.6,ORANGE)+fgE(28.6,13,1,1.6,ORANGE,20)+fgL(24.4,16.2,29.6,16.2,SKY,1.2);},
AQ:function(){return fgR(0,0,36,26,'#EAF4FB')+fgP('8,13 12.5,9 18.5,10 24,8.4 28.5,12 25.5,16.5 19,17.6 12.5,16.4',SKY)+fgE(18,20,7.4,1.8,W)+fgC(30,5.4,1.6,GOLD);},
AG:function(){return fgR(0,0,36,26,RED)+fgP('7,0 29,0 18,25',K)+'<path d="M13 10.4 A 5 5 0 0 1 23 10.4 Z" fill="'+GOLD+'"/>'+fgP('12.6,10.4 23.4,10.4 18,20',BLUE)+fgP('14.8,14.6 21.2,14.6 18,20.4',W);},
AR:function(){return fgHS([LBLUE,W,LBLUE])+fgSUN(18,13,2.7,GOLD2,12,2);},
AM:function(){return fgHS([RED,BLUE,ORANGE]);},
AW:function(){return fgR(0,0,36,26,'#418FDE')+fgR(0,17.2,36,1.7,GOLD)+fgR(0,20.4,36,1.7,GOLD)+fgST(8.6,6.8,4,W,4,-90,0.24)+fgST(8.6,6.8,2.4,RED,4,-90,0.4);},
AU:function(){return fgR(0,0,36,26,NAVYF)+fgUNION(0,0,17,12)+fgST(8.4,19.4,3.4,W,7,-90,0.55)+fgST(28,5.6,1.5,W,7)+fgST(31.8,10.4,1.3,W,7)+fgST(28.2,15.4,1.4,W,7)+fgST(24.6,10.6,1.2,W,7)+fgST(29.8,10.6,0.8,W,7);},
AT:function(){return fgHS([RED,W,RED]);},
AZ:function(){return fgHS(['#37AEDD',RED,GREEN])+fgCRESC(17.8,13,3.3,W,-16)+fgST(21,13,1.5,W,8);},
BS:function(){return fgHS(['#00A3D1',GOLD,'#00A3D1'])+fgTRI(K,12);},
BH:function(){return fgR(0,0,36,26,W)+fgP('10,0 15.6,2.6 10,5.2 15.6,7.8 10,10.4 15.6,13 10,15.6 15.6,18.2 10,20.8 15.6,23.4 10,26 36,26 36,0',MAROON);},
BD:function(){return fgR(0,0,36,26,GREEN)+fgC(16,13,6.4,RED);},
BB:function(){return fgVS([BLUE,GOLD,BLUE])+fgR(17.3,6.4,1.4,12.4,K)+fgP('14.2,9 15.8,5 17.4,9 15.8,7.6',K)+fgP('18.6,9 20.2,5 21.8,9 20.2,7.6',K);},
BY:function(){var i,s=fgHS([[RED,2],[GREEN,1]])+fgR(0,0,5.4,26,W);for(i=0;i<4;i++)s+=fgP('2.7,'+(2+i*6)+' 4.6,'+(5+i*6)+' 2.7,'+(8+i*6)+' 0.8,'+(5+i*6),RED);return s;},
BE:function(){return fgVS([K,GOLD,RED]);},
BZ:function(){return fgR(0,0,36,26,'#49A5E2')+fgR(0,0,36,2.3,RED)+fgR(0,23.7,36,2.3,RED)+fgC(18,13,6.4,W)+fgP('18,8.4 21,13.4 15,13.4',GREEN)+fgR(17.4,13.4,1.2,3,BROWN)+fgL(14,17.4,22,17.4,SKY,1);},
BJ:function(){return fgR(0,0,13,26,GREEN)+fgR(13,0,23,13,GOLD)+fgR(13,13,23,13,RED);},
BM:function(){return fgR(0,0,36,26,RED)+fgUNION(0,0,17,12)+fgC(27,13,4.2,W)+fgE(27,12.6,2,1.6,RED)+fgL(24.6,16,29.4,16,SKY,1.1)+fgC(27,15,0.8,GOLD);},
BT:function(){return fgP('0,0 36,0 0,26',GOLD)+fgP('36,0 36,26 0,26',ORANGE)+fgL(6.5,21.5,29.5,4.5,W,3.2)+fgC(12.2,17.8,1.9,W)+fgC(18,13,1.9,W)+fgC(23.8,8.2,1.9,W)+fgC(28.4,5.2,2.2,W)+fgC(29,4.8,0.5,ORANGE);},
BO:function(){return fgHS([RED,GOLD,GREEN]);},
BA:function(){var i,s=fgR(0,0,36,26,'#22409B')+fgP('6.5,0 30,0 30,25.4',GOLD);for(i=0;i<7;i++){var t=(i+1)/8,x=6.5+23.5*t,y=25.4*t;s+=fgST(x-1.5,y+0.6,1.5,W);}return s+fgST(5.4,1.2,1.1,W)+fgST(31.6,24.4,1.1,W);},
BW:function(){return fgHS([['#75AADB',5],[W,1],[K,1.4],[W,1],['#75AADB',5]]);},
BV:function(){return fgR(0,0,36,26,RED)+fgNORD(12.5,W,BLUE);},
BR:function(){return fgR(0,0,36,26,GREEN)+fgP('18,2.8 33,13 18,23.2 3,13',GOLD)+fgC(18,13,5.4,'#31539E')+'<rect x="12.4" y="12.1" width="11.2" height="1.8" fill="#FFFFFF" transform="rotate(-14 18 13)"/>'+fgC(15.6,16.2,0.7,W)+fgC(19,16.8,0.7,W)+fgC(20.8,15,0.7,W);},
IO:function(){return fgR(0,0,36,26,W)+fgUNION(0,0,16,11)+fgL(2,19.4,14,19.4,SKY,1.6)+fgL(2,21.8,14,21.8,SKY,1.6)+fgL(2,24.2,14,24.2,SKY,1.6)+fgR(24.6,8,1.2,10,BROWN)+fgE(25.2,6.6,3,1.8,GREEN)+fgR(21.4,4.6,7.6,1.6,GOLD,0.6);},
BN:function(){return fgR(0,0,36,26,GOLD)+fgL(-2,7.6,38,20.6,W,4.8)+fgL(-2,12.8,38,25.8,K,4.8)+fgC(18,11.4,2.5,RED)+fgR(17.2,13.2,1.6,3.4,RED)+fgL(15,15,21,15,RED,1);},
BG:function(){return fgHS([W,GREEN,RED]);},
BF:function(){return fgHS([RED,GREEN])+fgST(18,13,3,GOLD);},
BI:function(){return fgR(0,0,36,26,GREEN)+fgP('0,0 36,0 18,13',RED)+fgP('0,26 36,26 18,13',RED)+fgL(0,0,36,26,W,4.6)+fgL(36,0,0,26,W,4.6)+fgC(18,13,4.8,W)+fgST(15.6,11.4,1.6,RED,6)+fgST(20.4,11.4,1.6,RED,6)+fgST(18,15.4,1.6,RED,6);},
KH:function(){return fgHS([BLUE,[RED,2],BLUE])+fgR(16.8,9.2,2.4,6,W,0.8)+fgR(13.4,11.2,2.2,4,W,0.7)+fgR(20.4,11.2,2.2,4,W,0.7)+fgR(12.2,15.2,11.6,1.5,W,0.5);},
CM:function(){return fgVS([GREEN,RED,GOLD])+fgST(18,13,2.8,GOLD);},
CA:function(){return fgHS([[RED,1],[W,2],[RED,1]])+fgP('18,4.8 19.5,8.2 22.4,6.9 21.5,10.2 25.2,9.9 23.2,12.8 26.4,14 22.1,15.4 22.9,18.3 19.4,16.8 18.8,20.4 18.7,21.8 17.3,21.8 17.2,20.4 16.6,16.8 13.1,18.3 13.9,15.4 9.6,14 12.8,12.8 10.8,9.9 14.5,10.2 13.6,6.9 16.5,8.2',RED);},
CV:function(){var i,a,s=fgR(0,0,36,26,'#2654A5')+fgR(0,16.6,36,1.1,W)+fgR(0,17.7,36,1.5,RED)+fgR(0,19.2,36,1.1,W);for(i=0;i<10;i++){a=(-122+i*26.8)*Math.PI/180;s+=fgST(12.4+6.6*Math.cos(a),11.6+6.6*Math.sin(a),1.15,GOLD);}return s;},
KY:function(){return fgR(0,0,36,26,NAVYF)+fgUNION(0,0,17,12)+fgC(27,13,4,W)+fgE(27,13.4,2,1.4,GREEN)+fgL(24.6,16,29.4,16,SKY,1)+fgST(27,10.2,1,GOLD);},
CF:function(){return fgHS([BLUE,W,GREEN,GOLD])+fgR(15.8,0,4.4,26,RED)+fgST(5.6,4.2,2,GOLD);},
TD:function(){return fgVS([BLUE,GOLD,RED]);},
CL:function(){return fgR(0,13,36,13,RED)+fgR(0,0,36,13,W)+fgR(0,0,13,13,BLUE)+fgST(6.5,6.5,3.3,W);},
CN:function(){return fgR(0,0,36,26,RED)+fgST(7.6,6.2,4.2,GOLD)+fgST(15.2,2.8,1.4,GOLD,5,-72)+fgST(18,5.4,1.4,GOLD,5,-40)+fgST(18,9.4,1.4,GOLD,5,-8)+fgST(15.4,12.2,1.4,GOLD,5,24);},
CO:function(){return fgHS([[GOLD,2],BLUE,RED]);},
KM:function(){return fgHS([GOLD,W,RED,BLUE])+fgTRI(GREEN,13)+fgCRESC(5.8,13,3.1,W)+fgST(8.6,8.6,0.95,W)+fgST(9.5,11.5,0.95,W)+fgST(9.5,14.5,0.95,W)+fgST(8.6,17.4,0.95,W);},
CG:function(){return fgR(0,0,36,26,GOLD)+fgP('0,0 29,0 0,19.4',GREEN)+fgP('36,26 36,6.4 7,26',RED);},
CD:function(){return fgR(0,0,36,26,'#33B5E5')+fgL(0,22.6,36,3.6,GOLD,6.4)+fgL(0,22.6,36,3.6,RED,3.8)+fgST(6.6,5.4,2.8,GOLD);},
CK:function(){var i,a,s=fgR(0,0,36,26,NAVYF)+fgUNION(0,0,17,12);for(i=0;i<15;i++){a=(-90+i*24)*Math.PI/180;s+=fgST(27+6.4*Math.cos(a),13+6.4*Math.sin(a),1.05,W);}return s;},
CR:function(){return fgHS([BLUE,W,[RED,2],W,BLUE]);},
CI:function(){return fgVS([ORANGE,W,GREEN]);},
HR:function(){var i,j,x,y,s=fgHS([RED,W,BLUE])+fgR(14.6,9,6.8,1.6,GOLD,0.4);for(i=0;i<3;i++)for(j=0;j<3;j++){x=15+j*2;y=10.8+i*2;if((i+j)%2===0)s+=fgR(x,y,2,2,'#D33');}return s+'<rect x="14.8" y="10.6" width="6.4" height="6.2" fill="none" stroke="'+W+'" stroke-width="0.7"/>';},
CU:function(){return fgHS([BLUE,W,BLUE,W,BLUE])+fgTRI(RED,13)+fgST(5.2,13,2.6,W);},
CW:function(){return fgR(0,0,36,26,'#0A44A6')+fgR(0,17.4,36,2.4,GOLD)+fgST(8.4,6.2,2.6,W)+fgST(14.6,10.6,1.7,W);},
CY:function(){return fgR(0,0,36,26,W)+fgP('10,9.6 14,7.8 18,8.8 22,7.8 25.4,9.6 27,12.2 24,14.8 19,14.2 14,15.2 10.5,13.2',BROWN)+'<path d="M9.6 19.8 A 11 11 0 0 0 26.4 19.8" fill="none" stroke="'+GREEN+'" stroke-width="1.7" stroke-linecap="round"/>';},
CZ:function(){return fgHS([W,RED])+fgTRI(BLUE,13);},
DK:function(){return fgR(0,0,36,26,'#C8102E')+fgNORD(12.5,null,W);},
DJ:function(){return fgHS(['#6EC1E4',GREEN])+fgTRI(W,15)+fgST(5.6,13,2.6,RED);},
DM:function(){return fgR(0,0,36,26,GREEN)+fgR(16,0,4,26,K)+fgR(16.9,0,2.2,26,W)+fgR(17.6,0,0.8,26,GOLD)+fgR(0,11,36,4,K)+fgR(0,11.9,36,2.2,W)+fgR(0,12.6,36,0.8,GOLD)+fgC(18,13,4,RED)+fgE(18,13,1.5,2.2,PURP)+fgC(18,10.6,0.9,GOLD);},
DO:function(){return fgR(0,0,36,26,W)+fgR(0,0,15.4,11,BLUE)+fgR(20.6,0,15.4,11,RED)+fgR(0,15,15.4,11,RED)+fgR(20.6,15,15.4,11,BLUE)+fgC(18,13,2.5,'#DCE9F5')+fgR(17.2,11.6,1.6,2.6,BLUE,0.4)+fgST(19.4,13.4,0.9,GOLD);},
EC:function(){return fgHS([[GOLD,2],BLUE,RED])+fgE(18,12.6,2.5,1.9,GOLD)+fgP('15.4,11.2 18,9.4 20.6,11.2 18,10.4',K)+fgR(16.6,14.4,2.8,1,GOLD2,0.4);},
EG:function(){return fgHS([RED,W,K])+fgE(18,13.2,1.9,2.3,GOLD)+fgC(19.6,10.6,1,GOLD)+fgP('16,12 13.2,10.4 15.8,14.4',GOLD)+fgP('20,12 22.8,10.4 20.2,14.4',GOLD)+fgR(16,15.6,4,0.9,GOLD,0.4);},
SV:function(){return fgHS([BLUE,W,BLUE])+fgP('16.4,14.4 18,10.8 19.6,14.4',GREEN)+fgRING(18,13,2.9,GOLD2,0.7);},
GQ:function(){return fgHS([GREEN,W,RED])+fgTRI(BLUE,10)+fgE(20.6,12.4,1.7,2.2,GREY)+fgC(20.6,10,1.1,GREEN);},
ER:function(){return fgR(0,0,36,13,GREEN)+fgR(0,13,36,13,RED)+fgP('0,0 20,13 0,26',AZURE)+fgRING(8.4,13,3.2,GOLD,1.2)+fgR(8,11.2,0.8,3.6,GOLD)+fgC(8.4,10.4,0.7,GOLD);},
EE:function(){return fgHS([BLUE,K,W]);},
SZ:function(){return fgHS([['#3E5EB9',3],[GOLD,1],[CRIM,4],[GOLD,1],['#3E5EB9',3]])+fgE(18,13,5.4,3,K)+fgE(18,13,2.2,3,W)+fgL(11,13,25,13,GOLD,0.9)+fgC(11.4,13,1,GOLD)+fgC(24.6,13,1,GOLD);},
ET:function(){return fgHS([GREEN,GOLD,RED])+fgC(18,13,4.4,'#2C7CC4')+fgSTO(18,13,2.9,GOLD,1,5,-90,0.5)+fgC(18,13,0.7,GOLD);},
FK:function(){return fgR(0,0,36,26,NAVYF)+fgUNION(0,0,17,12)+fgR(24.6,10,5,6.6,W,1.2)+fgL(24.8,14.4,29.4,14.4,BLUE,1.2)+fgE(27.1,12,1.2,1,K)+fgC(27.1,9.4,0.8,GOLD);},
FO:function(){return fgR(0,0,36,26,W)+fgNORD(12.5,BLUE,RED);},
FJ:function(){return fgR(0,0,36,26,'#66B8E3')+fgUNION(0,0,17,12)+fgR(24.6,10.4,5,6.2,W,1)+fgL(27.1,10.4,27.1,16.6,RED,1.1)+fgL(24.6,13.5,29.6,13.5,RED,1.1)+fgR(25.4,8.6,3.4,1.6,GOLD,0.5);},
FI:function(){return fgR(0,0,36,26,W)+fgNORD(12.5,null,'#1F5FA8');},
FR:function(){return fgVS(['#2B3A8F',W,RED]);},
GF:function(){return fgVS(['#2B3A8F',W,RED]);},
PF:function(){return fgHS([RED,[W,2],RED])+fgC(18,13,3.6,'#EAF4FB')+fgSUN(18,11.8,1.3,GOLD,8,1)+fgL(15.2,14.8,20.8,14.8,SKY,1.3)+fgL(15.8,16,20.2,16,SKY,1);},
TF:function(){return fgR(0,0,36,26,W)+fgR(0,0,14,11,BLUE)+fgST(4,3.4,1.1,W)+fgST(7,3.4,1.1,W)+fgST(10,3.4,1.1,W)+fgST(5.5,6.8,1.1,W)+fgST(8.5,6.8,1.1,W)+fgST(24,18,1.4,RED)+fgST(29,21,1.4,RED);},
GA:function(){return fgHS([GREEN,GOLD,BLUE]);},
GM:function(){return fgHS([RED,[W,0.55],[BLUE,3],[W,0.55],GREEN]);},
GE:function(){return fgR(0,0,36,26,W)+fgL(18,0,18,26,RED,6.6)+fgL(0,13,36,13,RED,6.6)+fgR(7.2,5.6,3.4,1.1,RED)+fgR(8.35,4.45,1.1,3.4,RED)+fgR(25.4,5.6,3.4,1.1,RED)+fgR(26.55,4.45,1.1,3.4,RED)+fgR(7.2,19.3,3.4,1.1,RED)+fgR(8.35,18.15,1.1,3.4,RED)+fgR(25.4,19.3,3.4,1.1,RED)+fgR(26.55,18.15,1.1,3.4,RED);},
DE:function(){return fgHS([K,RED,GOLD]);},
GH:function(){return fgHS([RED,GOLD,GREEN])+fgST(18,13,2.9,K);},
GI:function(){return fgHS([[W,2],[RED,1]])+fgR(13.4,7.6,3,6,RED)+fgR(19.6,7.6,3,6,RED)+fgR(15.8,5.8,4.4,7.8,RED)+fgR(13,6.8,3.8,0.9,RED)+fgR(19.2,6.8,3.8,0.9,RED)+fgR(15.4,5,5.2,0.9,RED)+fgR(17,10.4,2,3.2,W,0.8)+fgR(17.3,15,1.4,4.6,GOLD)+fgC(18,14.6,1.3,GOLD);},
GR:function(){var i,s='';for(i=0;i<9;i++)s+=fgR(0,i*(26/9),36,26/9+0.08,(i%2===0)?BLUE:W);return s+fgR(0,0,14.4,14.4,BLUE)+fgL(7.2,0,7.2,14.4,W,2.9)+fgL(0,7.2,14.4,7.2,W,2.9);},
GL:function(){return fgR(0,0,36,13,W)+fgR(0,13,36,13,RED)+fgC(12,13,6,RED)+'<path d="M6 13 A 6 6 0 0 1 18 13 Z" fill="#FFFFFF"/>';},
GD:function(){return fgR(0,0,36,26,RED)+fgP('4.4,4.2 31.6,4.2 18,12.6',GOLD)+fgP('4.4,21.8 31.6,21.8 18,13.4',GOLD)+fgP('4.4,4.4 4.4,21.6 13.6,13',GREEN)+fgP('31.6,4.4 31.6,21.6 22.4,13',GREEN)+fgC(18,13,3.4,RED)+fgST(18,13,2.1,GOLD)+fgST(11,2.1,1.15,GOLD)+fgST(18,2.1,1.15,GOLD)+fgST(25,2.1,1.15,GOLD)+fgST(11,23.9,1.15,GOLD)+fgST(18,23.9,1.15,GOLD)+fgST(25,23.9,1.15,GOLD)+fgC(6.6,13,1,ORANGE);},
GU:function(){return fgR(0,0,36,26,RED)+fgR(2.4,2.4,31.2,21.2,NAVYF)+fgE(18,13,3.8,5,BROWN)+fgE(18,13,3,4.2,SKY)+fgP('17,12.6 19.6,10.4 19,13.8',W)+fgL(15.6,15.4,20.4,15.4,'#8E5A2E',1)+fgL(15.6,16.6,20.4,16.6,SKY,0.9);},
GT:function(){return fgHS(['#5AA9E6',W,'#5AA9E6'])+fgC(18,13,2.7,TAN)+fgP('16.8,13.6 18,11 19.2,13.6',GREEN)+fgRING(18,13,3.2,GOLD2,0.6);},
GG:function(){return fgR(0,0,36,26,W)+fgL(18,0,18,26,RED,7.6)+fgL(0,13,36,13,RED,7.6)+fgL(18,0,18,26,GOLD,2.8)+fgL(0,13,36,13,GOLD,2.8);},
GN:function(){return fgVS([RED,GOLD,GREEN]);},
GW:function(){return fgR(0,0,12,26,RED)+fgR(12,0,24,13,GOLD)+fgR(12,13,24,13,GREEN)+fgST(6,13,2.9,K);},
GY:function(){return fgR(0,0,36,26,GREEN)+fgP('0,1.4 30.6,13 0,24.6',W)+fgP('0,3.4 26.4,13 0,22.6',GOLD)+fgP('0,6.8 15.6,13 0,19.2',K)+fgP('0,8.2 12.8,13 0,17.8',RED);},
HT:function(){return fgHS([BLUE,RED])+fgR(13.4,9.4,9.2,7.2,W,0.8)+fgP('18,10.8 19.4,14.2 16.6,14.2',GREEN)+fgR(16,14.2,4,1.2,GOLD,0.4)+fgST(18,10.2,0.7,GOLD);},
HM:function(){return FLAGS.AU();},
HN:function(){return fgHS([SKY,W,SKY])+fgST(18,13,1.4,'#2E92D1')+fgST(13.6,10.6,1.4,'#2E92D1')+fgST(22.4,10.6,1.4,'#2E92D1')+fgST(13.6,15.4,1.4,'#2E92D1')+fgST(22.4,15.4,1.4,'#2E92D1');},
HK:function(){var i,s=fgR(0,0,36,26,W);for(i=0;i<5;i++)s+='<ellipse cx="18" cy="8.4" rx="1.9" ry="4.3" fill="'+PINK+'" transform="rotate('+(i*72)+' 18 13)"/>';return s+fgC(18,13,1,RED);},
HU:function(){return fgHS([RED,W,GREEN]);},
IS:function(){return fgR(0,0,36,26,'#1F5FA8')+fgNORD(12.5,W,RED);},
IN:function(){var i,a,s=fgHS([OG,W,DGREEN])+fgRING(18,13,3.2,NAVY,0.85)+fgC(18,13,0.75,NAVY);for(i=0;i<8;i++){a=i*Math.PI/4;s+=fgL(18+1.2*Math.cos(a),13+1.2*Math.sin(a),18+3*Math.cos(a),13+3*Math.sin(a),NAVY,0.4);}return s;},
ID:function(){return fgHS([RED,W]);},
IR:function(){return fgHS([GREEN,W,RED])+fgR(17.3,10.2,1.4,5.2,RED)+fgC(18,9.8,1.4,RED)+fgE(15.9,11.8,0.85,2.1,RED)+fgE(20.1,11.8,0.85,2.1,RED);},
IQ:function(){return fgHS([RED,W,K])+fgR(11.2,12,3.4,1.7,DGREEN,0.85)+fgR(15.8,12,3.4,1.7,DGREEN,0.85)+fgR(20.4,12,3.4,1.7,DGREEN,0.85);},
IE:function(){return fgVS([GREEN,W,ORANGE]);},
IL:function(){return fgHS([[W,3],[BLUE,1.3],[W,7.4],[BLUE,1.3],[W,3]])+fgT3O(18,13,3.8,BLUE,1.3,-90)+fgT3O(18,13,3.8,BLUE,1.3,90);},
IT:function(){return fgVS([GREEN,W,RED]);},
JM:function(){return fgR(0,0,36,26,GREEN)+fgP('0,0 0,26 15.6,13',K)+fgP('36,0 36,26 20.4,13',K)+fgL(0,0,36,26,GOLD,5.8)+fgL(36,0,0,26,GOLD,5.8);},
JP:function(){return fgR(0,0,36,26,W)+fgC(18,13,6,RED);},
JE:function(){return fgR(0,0,36,26,W)+fgL(0,0,36,26,RED,5)+fgL(36,0,0,26,RED,5)+fgR(16.4,3.6,3.2,2.6,GOLD,0.5)+fgC(17.1,3.2,0.7,GOLD)+fgC(18,3,0.8,GOLD)+fgC(18.9,3.2,0.7,GOLD)+fgP('16.8,6.6 19.2,6.6 18,8.6',RED);},
JO:function(){return fgHS([K,W,GREEN])+fgTRI(RED,13)+fgST(5,13,1.9,W);},
KZ:function(){var i,s=fgR(0,0,36,26,SKY)+fgSUN(19,10.6,3.2,GOLD,16,2)+fgE(19,17.4,4.2,1.1,GOLD)+fgR(2.2,0,3,26,GOLD);for(i=0;i<5;i++)s+=fgP('3.7,'+(1.6+i*5)+' 5,'+(3.4+i*5)+' 3.7,'+(5.2+i*5)+' 2.4,'+(3.4+i*5),W);return s;},
KE:function(){return fgHS([[K,3],[W,0.55],[RED,3],[W,0.55],[GREEN,3]])+fgE(18,13,3,6.2,W)+fgR(17.2,7.6,1.6,10.8,RED)+fgL(13.8,6.8,22.2,19.2,'#DDE3EE',0.9)+fgL(22.2,6.8,13.8,19.2,K,0.9);},
KI:function(){var i,a,s=fgR(0,0,36,13.6,RED);
  for(i=0;i<3;i++)s+=fgR(0,13.6+i*4.2,36,2.1,W)+fgR(0,15.7+i*4.2,36,2.1,SKY);
  s+='<path d="M14.4 13.6 A 3.6 3.6 0 0 1 21.6 13.6 Z" fill="'+GOLD+'"/>';
  for(i=0;i<9;i++){a=Math.PI+(i+0.5)*(Math.PI/9);s+=fgL(18+4.3*Math.cos(a),13.6+4.3*Math.sin(a),18+6.6*Math.cos(a),13.6+6.6*Math.sin(a),GOLD,0.8);}
  return s+fgL(15.8,6.2,18,5,W,1.2)+fgL(18,5,20.2,6.2,W,1.2);
},
XK:function(){var i,s=fgR(0,0,36,26,'#244AA5')+fgP('16,8.4 19.8,8 21.6,11 20.4,15.2 17.6,18.6 15.2,16.2 15,12.2',GOLD);for(i=0;i<6;i++)s+=fgST(10+i*3.2,5.6-Math.sin(i*0.62)*1.5,1.15,W);return s;},
KW:function(){return fgHS([GREEN,W,RED])+fgP('0,0 10,8.6 10,17.4 0,26',K);},
KG:function(){return fgR(0,0,36,26,RED)+fgST(18,13,8.8,GOLD,20,-90,0.82)+fgC(18,13,4.2,RED)+fgRING(18,13,2.9,GOLD,0.8)+fgL(15.8,10.8,20.2,15.2,GOLD,0.8)+fgL(20.2,10.8,15.8,15.2,GOLD,0.8);},
LA:function(){return fgHS([RED,[BLUE,2],RED])+fgC(18,13,4,W);},
LV:function(){return fgHS([['#A32638',2],W,['#A32638',2]]);},
LB:function(){return fgHS([RED,[W,2],RED])+fgP('18,7 20.6,11.2 15.4,11.2',DGREEN)+fgP('18,9.4 22.2,14.8 13.8,14.8',DGREEN)+fgR(17.5,14.8,1,1.8,BROWN);},
LS:function(){return fgHS([BLUE,[W,1.35],GREEN])+fgP('18,8.6 21.4,15.4 14.6,15.4',K)+fgR(13.8,15.2,8.4,1.2,K,0.6)+fgC(18,8.4,0.8,K);},
LR:function(){var i,s='';for(i=0;i<11;i++)s+=fgR(0,i*(26/11),36,26/11+0.08,(i%2===0)?RED:W);return s+fgR(0,0,12,12,BLUE)+fgST(6,6,2.9,W);},
LY:function(){return fgHS([RED,[K,2],GREEN])+fgCRESC(17.4,13,2.9,W)+fgST(21.2,13,1.4,W);},
LI:function(){return fgHS([BLUE,RED])+fgR(4.6,5.4,5,2.2,GOLD,0.6)+fgC(4.9,4.8,0.8,GOLD)+fgC(7.1,4.3,0.95,GOLD)+fgC(9.3,4.8,0.8,GOLD)+fgR(5.8,6.2,2.6,0.8,RED,0.3);},
LT:function(){return fgHS([GOLD,GREEN,RED]);},
LU:function(){return fgHS([RED,W,LBLUE]);},
MO:function(){return fgR(0,0,36,26,GREEN)+fgE(18,11,1.4,3,W)+fgE(15.6,12,1.3,2.5,W,-32)+fgE(20.4,12,1.3,2.5,W,32)+fgL(12.4,16.8,23.6,16.8,W,0.9)+fgL(13.8,18.4,22.2,18.4,W,0.9)+fgST(12.4,5.4,1.2,GOLD)+fgST(18,4.2,1.2,GOLD)+fgST(23.6,5.4,1.2,GOLD);},
MG:function(){return fgR(0,0,12,26,W)+fgR(12,0,24,13,RED)+fgR(12,13,24,13,GREEN);},
MW:function(){var i,a,s=fgHS([K,RED,GREEN]);s+='<path d="M14.2 9.6 A 3.8 3.8 0 0 1 21.8 9.6 Z" fill="'+RED+'"/>';for(i=0;i<9;i++){a=Math.PI+i*(Math.PI/10)+0.17;s+=fgL(18+4.4*Math.cos(a),9.6+4.4*Math.sin(a),18+6.6*Math.cos(a),9.6+6.6*Math.sin(a),RED,0.8);}return s;},
MY:function(){var i,s='';for(i=0;i<14;i++)s+=fgR(0,i*(26/14),36,26/14+0.08,(i%2===0)?RED:W);return s+fgR(0,0,18,14.8,BLUE)+fgCRESC(7.2,7.4,3.5,GOLD)+fgST(12,7.4,2.7,GOLD,14,-90,0.66);},
MV:function(){return fgR(0,0,36,26,RED)+fgR(7.8,6.2,20.4,13.6,DGREEN)+fgCRESC(18,13,3.9,W);},
ML:function(){return fgVS([GREEN,GOLD,RED]);},
MT:function(){return fgVS([W,RED])+fgL(5.4,2,5.4,9,GREY,2.6)+fgL(1.9,5.5,8.9,5.5,GREY,2.6)+fgC(5.4,5.5,0.6,RED);},
MH:function(){return fgR(0,0,36,26,'#2654A5')+fgL(0,24.4,36,5.6,ORANGE,4.6)+fgL(0,22.6,36,3.8,W,2.6)+fgST(8.4,7.2,5.8,W,4,-90,0.09)+fgST(8.4,7.2,3.4,W,8,-90,0.34);},
MD:function(){return fgVS([BLUE,GOLD,RED])+fgE(18,13,1.7,2.3,'#8E6A2E')+fgP('16,12 12.8,10.2 15.4,14.6','#8E6A2E')+fgP('20,12 23.2,10.2 20.6,14.6','#8E6A2E')+fgC(18,10,1.1,GOLD)+fgR(17,12.4,2,2.4,BLUE,0.4);},
MC:function(){return fgHS([RED,W]);},
MN:function(){var s=fgVS([RED,SKY,RED])+fgC(6.8,5.6,1.1,GOLD)+fgP('4.4,7.2 5.6,5 6.2,6.6 6.8,4.2 7.4,6.6 8,5 9.2,7.2 6.8,8.4',GOLD);s+=fgR(4.8,9.2,0.9,8.4,GOLD)+fgR(8,9.2,0.9,8.4,GOLD)+fgR(5.4,10.6,3,0.7,GOLD)+fgR(5.4,15.4,3,0.7,GOLD)+fgC(6.8,13.4,1.3,GOLD);return s;},
ME:function(){return fgR(0,0,36,26,RED)+fgR(1.5,1.5,33,23,GOLD)+fgR(2.8,2.8,30.4,20.4,'#C8102E')+fgE(18,12.6,2.7,3,GOLD)+fgP('15.2,11.6 12,9.8 14.8,14','#C8A22B')+fgP('20.8,11.6 24,9.8 21.2,14','#C8A22B')+fgC(18,15,1.2,GREEN);},
MS:function(){return fgR(0,0,36,26,NAVYF)+fgUNION(0,0,17,12)+fgC(27,13,4,W)+fgP('27,10 28.8,14.4 25.2,14.4',GOLD)+fgL(25,15.6,29,15.6,BLUE,1);},
MA:function(){return fgR(0,0,36,26,'#C1272D')+fgSTO(18,13,5.2,DGREEN,1.7,5,-90,0.382);},
MZ:function(){return fgHS([GREEN,[W,0.5],[K,2.6],[W,0.5],RED])+fgP('0,0 19,13 0,26',K)+fgP('0,2 15.4,13 0,24',RED)+fgST(5.4,13,3,GOLD)+fgR(3.6,15.2,3.6,1.1,W,0.4);},
MM:function(){return fgHS([GOLD,GREEN,RED])+fgST(18,13,6,W,5,-90,0.42);},
NA:function(){return fgP('0,0 36,0 0,26',BLUE)+fgP('36,0 36,26 0,26',GREEN)+fgL(0,26,36,0,W,7.6)+fgL(0,26,36,0,RED,4.6)+fgSUN(7.6,7.4,2.3,GOLD,12,1.5);},
NR:function(){return fgR(0,0,36,26,NAVYF)+fgR(0,11.8,36,2.4,GOLD)+fgST(9,18.2,2.9,W,12,-90,0.55);},
NP:function(){return fgR(0,0,36,26,'#003893')+fgP('4,2 20,12 12,12 32,24 4,24',CRIM)+fgCRESC(9.8,7.6,2,W,-90)+fgSUN(11.4,18.2,2.4,W,8,1.3);},
NL:function(){return fgHS([RED,W,BLUE]);},
NC:function(){return fgVS(['#2B3A8F',W,RED]);},
NZ:function(){return fgR(0,0,36,26,NAVYF)+fgUNION(0,0,17,12)+fgC(27,5.6,2.5,W)+fgST(27,5.6,1.8,RED)+fgC(31.6,10.4,2.3,W)+fgST(31.6,10.4,1.6,RED)+fgC(27.4,15.8,2.4,W)+fgST(27.4,15.8,1.7,RED)+fgC(23.4,10.6,2.1,W)+fgST(23.4,10.6,1.4,RED);},
NI:function(){return fgHS([SKY,W,SKY])+fgC(18,13,2.8,TAN)+fgP('16.4,14 18,10.8 19.6,14',GREEN)+fgL(15.6,14.6,20.4,14.6,SKY,0.8);},
NE:function(){return fgHS([ORANGE,W,GREEN])+fgC(18,13,3.2,ORANGE);},
NG:function(){return fgVS([GREEN,W,GREEN]);},
NU:function(){return fgR(0,0,36,26,GOLD)+fgUNION(0,0,16,11)+fgC(8,5.5,2.6,GOLD)+fgST(8,5.5,1.4,BLUE)+fgST(3.4,2.4,0.9,RED)+fgST(12.6,2.4,0.9,RED)+fgST(3.4,8.6,0.9,RED)+fgST(12.6,8.6,0.9,RED);},
NF:function(){return fgVS([GREEN,W,GREEN])+fgP('18,7 20.2,11.6 15.8,11.6',DGREEN)+fgP('18,9.8 21.4,15.2 14.6,15.2',DGREEN)+fgR(17.5,15.2,1,2.6,BROWN);},
KP:function(){return fgHS([[BLUE,2.4],[W,1],[RED,7.2],[W,1],[BLUE,2.4]])+fgC(9,13,4.4,W)+fgST(9,13,3.5,RED);},
MK:function(){var i,a,s=fgR(0,0,36,26,'#D20000');for(i=0;i<8;i++){a=(-90+i*45)*Math.PI/180;var x2=18+22*Math.cos(a),y2=13+22*Math.sin(a),a1=(a-0.22),a2=(a+0.22);s+=fgP('18,13 '+fgN(18+22*Math.cos(a1))+','+fgN(13+22*Math.sin(a1))+' '+fgN(x2)+','+fgN(y2)+' '+fgN(18+22*Math.cos(a2))+','+fgN(13+22*Math.sin(a2)),GOLD);}return s+fgC(18,13,3.2,GOLD)+fgC(18,13,2.2,'#D20000');},
MP:function(){return fgR(0,0,36,26,NAVYF)+fgST(18,10.4,4,W)+fgR(16.6,14.6,2.8,5,TAN,0.7)+fgE(18,14.4,2.2,1.1,TAN)+fgRING(18,13,9.4,W,0.7);},
NO:function(){return fgR(0,0,36,26,'#BA0C2F')+fgNORD(12.5,W,BLUE);},
OM:function(){return fgR(9,0,27,8.7,W)+fgR(9,8.7,27,8.6,RED)+fgR(9,17.3,27,8.7,GREEN)+fgR(0,0,9,26,RED)+fgC(4.5,5.4,1.2,W)+'<path d="M3.2 7.4 Q 4.5 9.6 5.9 7.2" fill="none" stroke="'+W+'" stroke-width="1" stroke-linecap="round"/>';},
PK:function(){return fgVS([[W,1],[DGREEN,3]])+fgCRESC(20.8,13,4.5,W,-18)+fgST(24.6,10.2,1.8,W);},
PW:function(){return fgR(0,0,36,26,'#4AADD6')+fgC(15.6,13,6,GOLD);},
PS:function(){return fgHS([K,W,GREEN])+fgTRI(RED,13);},
PA:function(){return fgR(0,0,36,26,W)+fgR(18,13,18,13,RED)+fgST(9,6.5,2.7,BLUE)+fgST(27,19.5,2.7,RED);},
PG:function(){return fgP('0,0 0,26 36,26',K)+fgP('0,0 36,0 36,26',RED)+fgST(6.4,15.4,1.4,W)+fgST(10.6,19.6,1.2,W)+fgST(5.4,21,1.1,W)+fgST(11.8,15.2,1,W)+fgST(8.8,18,0.7,W)+fgP('21.4,9.4 24.6,6.8 27.8,8.4 29.6,7 29.2,9.4 31.4,10.2 28.2,11.2 26.2,13.2 24.2,11.4 22.2,12.2',GOLD);},
PY:function(){return fgHS([RED,W,BLUE])+fgRING(18,13,2.9,GOLD2,0.9)+fgST(18,13,1.7,GOLD);},
PE:function(){return fgVS([RED,W,RED]);},
PH:function(){return fgR(0,0,36,13,BLUE)+fgR(0,13,36,13,RED)+fgTRI(W,15)+fgSUN(8.4,13,2,GOLD,8,1.6)+fgST(2.4,3,1.2,GOLD)+fgST(2.4,23,1.2,GOLD)+fgST(13,13,1.2,GOLD);},
PN:function(){return fgR(0,0,36,26,NAVYF)+fgUNION(0,0,17,12)+fgR(24.8,9.8,4.8,6.6,SKY,1)+fgL(24.8,14.2,29.6,14.2,W,1.2)+fgRING(27.2,12,1.4,GOLD,0.8);},
PL:function(){return fgHS([W,RED]);},
PT:function(){return fgVS([[GREEN,2],[RED,3]])+fgRING(14.4,13,3.4,GOLD,1.2)+fgL(14.4,9.6,14.4,16.4,GOLD,0.7)+fgL(11,13,17.8,13,GOLD,0.7)+fgR(13.5,11.4,1.9,3,RED,0.5)+fgC(14.4,12.4,0.4,W);},
PR:function(){var i,s='';for(i=0;i<5;i++)s+=fgR(0,i*(26/5),36,26/5+0.08,(i%2===0)?RED:W);return s+fgTRI(BLUE,15)+fgST(5.6,13,3,W);},
QA:function(){return fgR(0,0,36,26,W)+fgP('10,0 15.2,2.9 10,5.8 15.2,8.7 10,11.6 15.2,14.5 10,17.4 15.2,20.3 10,23.2 15.2,26 36,26 36,0',MAROON);},
RE:function(){return fgVS(['#2B3A8F',W,RED]);},
RO:function(){return fgVS([BLUE,GOLD,RED]);},
RU:function(){return fgHS([W,BLUE,RED]);},
RW:function(){return fgHS([[SKY,3],[GOLD,1],[GREEN,2]])+fgSUN(30,5.2,1.8,GOLD,12,1.3);},
BL:function(){return fgVS(['#2B3A8F',W,RED]);},
SH:function(){return fgR(0,0,36,26,NAVYF)+fgUNION(0,0,17,12)+fgC(27,13,4,W)+fgL(24.6,15.4,29.4,15.4,SKY,1.2)+fgP('26,12.6 28,10.8 28.6,12.8 27,14',K)+fgC(28.2,10.4,0.7,ORANGE);},
KN:function(){return fgR(0,0,36,26,GREEN)+fgP('0,0 0,26 16.4,13',DRED)+fgP('36,0 36,26 19.6,13',DRED)+fgL(0,26,36,0,W,7.2)+fgL(0,26,36,0,K,4.4)+fgST(12.4,17.4,1.9,W)+fgST(23.6,8.6,1.9,W);},
LC:function(){return fgR(0,0,36,26,'#7CC5F0')+fgP('18,5 24.4,19.6 11.6,19.6',W)+fgP('18,7.2 22.2,19.6 13.8,19.6',K)+fgP('18,13.6 24,21.4 12,21.4',GOLD);},
MF:function(){return fgVS(['#2B3A8F',W,RED]);},
PM:function(){return fgVS(['#2B3A8F',W,RED]);},
VC:function(){return fgVS([[SKY,1],[GOLD,2],[GREEN,1]])+fgP('16.4,7.6 18,10 16.4,12.4 14.8,10',DGREEN)+fgP('19.6,7.6 21.2,10 19.6,12.4 18,10',DGREEN)+fgP('18,13.2 19.6,15.6 18,18 16.4,15.6',DGREEN);},
WS:function(){return fgR(0,0,36,26,'#C8102E')+fgR(0,0,17,13,NAVYF)+fgST(12.4,3.6,1.5,W)+fgST(8,6,1.3,W)+fgST(13,8.4,1.4,W)+fgST(6,10.4,1.2,W)+fgST(9.6,6.2,0.8,W);},
SM:function(){return fgHS([W,'#73C2FB'])+fgC(18,13,3.4,'#DCE9F5')+fgC(16.4,14.4,1.3,GREEN)+fgC(18,13.8,1.4,GREEN)+fgC(19.6,14.4,1.3,GREEN)+fgR(15.6,9.2,4.8,1.4,GOLD,0.5)+fgST(18,8.6,1,GOLD);},
ST:function(){return fgHS([GREEN,[GOLD,1.5],GREEN])+fgTRI(RED,11)+fgST(18,13,1.8,K)+fgST(25,13,1.8,K);},
SA:function(){return fgR(0,0,36,26,DGREEN)+fgR(8.4,9.2,6,1.5,W,0.75)+fgR(15.6,9.2,7.6,1.5,W,0.75)+fgR(11,12,9,1.4,W,0.7)+fgR(9,16.2,17.4,1,W,0.5)+fgC(8.2,16.7,1.1,W)+fgR(24.6,15,1.4,3.4,W,0.5);},
SN:function(){return fgVS([GREEN,GOLD,RED])+fgST(18,13,2.8,DGREEN);},
RS:function(){return fgHS([RED,BLUE,W])+fgP('7,9 14,9 14,14.4 10.5,17.4 7,14.4','#B03A3A')+fgL(10.5,10,10.5,15,W,1.3)+fgL(8.2,12.2,12.8,12.2,W,1.3)+fgC(8.6,10.6,0.55,W)+fgC(12.4,10.6,0.55,W)+fgC(8.6,14,0.55,W)+fgC(12.4,14,0.55,W)+fgR(8,7,5,1.6,GOLD,0.5)+fgC(8.6,6.4,0.6,GOLD)+fgC(10.5,6,0.7,GOLD)+fgC(12.4,6.4,0.6,GOLD);},
SC:function(){return fgP('0,26 0,0 13.5,0',BLUE)+fgP('0,26 13.5,0 24,0',GOLD)+fgP('0,26 24,0 36,0 36,7.5',RED)+fgP('0,26 36,7.5 36,15.5',W)+fgP('0,26 36,15.5 36,26',GREEN);},
SL:function(){return fgHS([GREEN,W,AZURE]);},
SG:function(){var i,a,s=fgHS([RED,W])+fgCRESC(8,6.4,3.2,W);for(i=0;i<5;i++){a=(-160+i*58)*Math.PI/180;s+=fgST(13.2+3.4*Math.cos(a),6.4+3.4*Math.sin(a),1.15,W);}return s;},
SX:function(){return fgHS([RED,W])+fgTRI(BLUE,13)+fgR(3.8,11,2.6,3.2,GOLD,0.6)+fgL(3.8,12.6,6.4,12.6,RED,0.7);},
SK:function(){return fgHS([W,BLUE,RED])+fgP('6.2,8.4 13.4,8.4 13.4,14.4 9.8,17.6 6.2,14.4',W)+fgP('6.9,9.1 12.7,9.1 12.7,14.1 9.8,16.8 6.9,14.1',RED)+fgL(9.8,9.8,9.8,14.4,W,1.1)+fgL(8.2,11,11.4,11,W,1.1)+fgL(8.4,12.6,11.2,12.6,W,1.1)+fgC(8.2,15,1.3,BLUE)+fgC(9.8,14.4,1.4,BLUE)+fgC(11.4,15,1.3,BLUE);},
SI:function(){return fgHS([W,BLUE,RED])+fgP('5.8,4.6 12,4.6 12,10 9,12.6 5.8,10','#2E6FD9')+fgP('7,9.2 9,6 11,9.2',W)+fgL(6.8,10.4,11.2,10.4,W,0.8)+fgL(6.8,11.4,11.2,11.4,W,0.8);},
SB:function(){return fgP('0,0 36,0 0,26',BLUE)+fgP('36,26 0,26 36,0',GREEN)+fgL(0,26,36,0,GOLD,3.6)+fgST(4.4,3.8,1.3,W)+fgST(8.2,3.2,1.3,W)+fgST(3.6,7.6,1.3,W)+fgST(7.6,7,1.3,W)+fgST(5.8,10.6,1.3,W);},
SO:function(){return fgR(0,0,36,26,'#4189DD')+fgST(18,13,4.8,W);},
ZA:function(){return fgR(0,0,36,13,RED)+fgR(0,13,36,13,BLUE)+fgP('0,3.4 17.4,13 0,22.6 0,18.4 12.4,13 0,7.6',W)+fgR(12.4,10.4,23.6,5.2,W)+fgP('0,6 14,13 0,20 0,16.8 10.4,13 0,9.2',DGREEN)+fgR(10.4,11.5,25.6,3,DGREEN)+fgP('0,8.4 8.6,13 0,17.6',GOLD)+fgP('0,10.2 5.6,13 0,15.8',K);},
GS:function(){return fgR(0,0,36,26,NAVYF)+fgUNION(0,0,17,12)+fgR(24.4,9.6,5.2,7,W,1.2)+fgL(24.6,14.4,29.4,14.4,SKY,1.1)+fgE(26,11.8,0.9,1.2,K)+fgE(28.2,11.8,0.9,1.2,TAN)+fgC(27,8.8,0.9,GOLD);},
SS:function(){return fgHS([[K,3],[W,0.5],[RED,3],[W,0.5],[GREEN,3]])+fgTRI(BLUE,14)+fgST(5,13,2.8,GOLD);},
ES:function(){return fgHS([RED,[GOLD,2],RED])+fgP('8.2,10 12.4,10 12.4,13.4 10.3,15.4 8.2,13.4',RED)+fgR(8.4,8.8,3.8,1.2,GOLD,0.4)+fgR(13.6,10.6,0.9,4.4,GREY,0.3)+fgR(6.2,10.6,0.9,4.4,GREY,0.3)+fgC(10.3,12,0.8,GOLD);},
LK:function(){return fgR(0,0,36,26,GOLD)+fgR(1.6,1.6,4.2,22.8,DGREEN)+fgR(5.8,1.6,4.2,22.8,ORANGE)+fgR(11.2,1.6,23.2,22.8,'#8D1E32')+fgC(13.2,3.6,0.9,GOLD)+fgC(32.4,3.6,0.9,GOLD)+fgC(13.2,22.4,0.9,GOLD)+fgC(32.4,22.4,0.9,GOLD)+fgE(22.4,13.4,3,3.2,GOLD)+fgC(24.8,9.8,1.5,GOLD)+fgR(25.8,8.4,0.8,6.6,GOLD,0.3)+'<path d="M19.4 12 Q 17 10 18.4 7.6" fill="none" stroke="'+GOLD+'" stroke-width="1.1" stroke-linecap="round"/>';},
SD:function(){return fgHS([RED,W,K])+fgTRI(GREEN,13);},
SR:function(){return fgHS([[GREEN,2],W,[RED,2],W,[GREEN,2]])+fgST(18,13,3.1,GOLD);},
SJ:function(){return fgR(0,0,36,26,'#BA0C2F')+fgNORD(12.5,W,BLUE);},
SE:function(){return fgR(0,0,36,26,'#1F6FB2')+fgNORD(12.5,null,GOLD);},
CH:function(){return fgR(0,0,36,26,'#DA291C')+fgR(15.6,6.4,4.8,13.2,W)+fgR(10.6,10.6,14.8,4.8,W);},
SY:function(){return fgHS([RED,W,K])+fgST(15,13,1.9,DGREEN)+fgST(21,13,1.9,DGREEN);},
TW:function(){return fgR(0,0,36,26,RED)+fgR(0,0,17,13,NAVYF)+fgSUN(8.5,6.5,2.2,W,12,1.4)+fgRING(8.5,6.5,3,W,0.6);},
TJ:function(){var i,a,s=fgHS([RED,[W,1.5],GREEN]);s+='<path d="M15.4 14.6 Q18 11.4 20.6 14.6 L19.8 15.8 H16.2 Z" fill="'+GOLD+'"/>';for(i=0;i<7;i++){a=(200+i*23.3)*Math.PI/180;s+=fgST(18+5.4*Math.cos(a),13.2+4.4*Math.sin(a),0.85,GOLD);}return s;},
TZ:function(){return fgP('0,0 36,0 0,26',GREEN)+fgP('36,0 36,26 0,26',AZURE)+fgL(0,26,36,0,GOLD,7)+fgL(0,26,36,0,K,4);},
TH:function(){return fgHS([RED,W,[NAVYF,2],W,RED]);},
TL:function(){return fgR(0,0,36,26,'#C8102E')+fgTRI(GOLD,15.5)+fgTRI(K,9)+fgST(4.8,13,2,W);},
TG:function(){return fgHS([GREEN,GOLD,GREEN,GOLD,GREEN])+fgR(0,0,14.4,10.4,RED)+fgST(7.2,5.2,2.5,W);},
TK:function(){return fgR(0,0,36,26,NAVYF)+fgP('19.4,5.6 26.4,16.4 13.4,16.4',GOLD)+fgP('20.4,8 24,15.4 16.4,15.4',W)+fgST(6,6,1.2,W)+fgST(9.6,9.4,1.2,W)+fgST(6.4,13.2,1.2,W)+fgST(10.4,17.2,1.2,W);},
TO:function(){return fgR(0,0,36,26,'#C8102E')+fgR(0,0,16,12,W)+fgR(6.8,2.2,2.4,7.6,RED)+fgR(4,4.8,8,2.4,RED);},
TT:function(){return fgR(0,0,36,26,'#C8102E')+fgL(1.4,0,34.6,26,W,7)+fgL(1.4,0,34.6,26,K,4);},
TN:function(){return fgR(0,0,36,26,'#C8102E')+fgC(18,13,6.4,W)+fgCRESC(17.2,13,3.8,RED)+fgST(20.8,13,1.7,RED);},
TR:function(){return fgR(0,0,36,26,'#C8102E')+fgCRESC(15.4,13,4.8,W)+fgST(22.4,13,2.4,W);},
TM:function(){var i,s=fgR(0,0,36,26,DGREEN)+fgR(3,0,5.4,26,DRED);for(i=0;i<5;i++){var y=3.4+i*4.8;s+=fgP('5.7,'+(y-1.9)+' 7.5,'+y+' 5.7,'+(y+1.9)+' 3.9,'+y,W)+fgP('5.7,'+(y-0.9)+' 6.6,'+y+' 5.7,'+(y+0.9)+' 4.8,'+y,RED);}return s+fgCRESC(19.6,6.8,2.9,W)+fgST(23.8,4.2,1.05,W)+fgST(25,6.6,1.05,W)+fgST(24.4,9.4,1.05,W)+fgST(22.4,11.6,1.05,W)+fgST(19.8,12.6,1.05,W);},
TC:function(){return fgR(0,0,36,26,NAVYF)+fgUNION(0,0,17,12)+fgC(27,13,4,W)+fgE(27,13,1.9,2.3,'#F0A58E')+fgC(27,11.4,0.8,PINK);},
TV:function(){return fgR(0,0,36,26,'#5B9BD5')+fgUNION(0,0,17,12)+fgST(25.4,5.4,1.2,GOLD)+fgST(29.4,7.4,1.2,GOLD)+fgST(26.4,10.2,1.2,GOLD)+fgST(30.6,12.4,1.2,GOLD)+fgST(25,15.2,1.2,GOLD)+fgST(29,17.2,1.2,GOLD)+fgST(26.4,20,1.2,GOLD);},
UG:function(){return fgHS([K,GOLD,RED,K,GOLD,RED])+fgC(18,13,3.8,W)+fgE(18,13.6,1.3,2,K)+fgC(18,10.8,0.85,K)+fgC(18,9.6,0.6,RED)+fgL(18,15.6,18,17,K,0.7);},
UA:function(){return fgHS([AZURE,GOLD]);},
AE:function(){return fgR(0,0,9,26,RED)+fgR(9,0,27,8.7,GREEN)+fgR(9,8.7,27,8.6,W)+fgR(9,17.3,27,8.7,K);},
GB:function(){return fgUNION(0,0,36,26);},
US:function(){var i,r,c,s='';for(i=0;i<13;i++)s+=fgR(0,i*2,36,2.08,(i%2===0)?RED:W);s+=fgR(0,0,15.4,14,NAVYF);for(r=0;r<3;r++)for(c=0;c<3;c++)s+=fgST(3.1+c*4.6,3.1+r*3.9,1.3,W);return s;},
UM:function(){return FLAGS.US();},
UY:function(){var i,s='';for(i=0;i<9;i++)s+=fgR(0,i*(26/9),36,26/9+0.08,(i%2===0)?W:'#2E6FD9');return s+fgR(0,0,14.4,14.4,W)+fgSUN(7.2,7.2,2.4,GOLD2,12,1.7);},
UZ:function(){var i,r,c,s=fgHS([SKY,[RED,0.3],W,[RED,0.3],GREEN]);s+=fgCRESC(5.2,4.4,2.2,W);for(r=0;r<3;r++)for(c=0;c<3+r;c++)s+=fgST(10.6+c*2.3-(r*1.15),2.8+r*2.2,0.75,W);return s;},
VU:function(){return fgR(0,0,36,13,RED)+fgR(0,13,36,13,GREEN)+fgP('0,0 17.5,13 0,26',GOLD)+fgP('0,1.8 14.6,13 0,24.2',K)+fgR(13,10.9,23,1,GOLD)+fgR(13,14.1,23,1,GOLD)+fgR(13,11.9,23,2.2,K)+fgRING(5.4,13,1.9,GOLD,0.9)+fgC(5.4,13,0.6,GOLD);},
VE:function(){var i,a,s=fgHS([GOLD,BLUE,RED]);for(i=0;i<8;i++){a=(200+i*20)*Math.PI/180;s+=fgST(18+6.4*Math.cos(a),14.6+5.4*Math.sin(a),0.9,W);}return s+fgR(4,3.4,2.4,1.8,GOLD,0.4);},
VN:function(){return fgR(0,0,36,26,'#DA251D')+fgST(18,13,5.4,GOLD);},
VG:function(){return fgR(0,0,36,26,NAVYF)+fgUNION(0,0,17,12)+fgC(27,13,4,W)+fgR(25.6,11.6,2.8,3,GOLD,0.5)+fgC(26.2,10.6,0.8,GREEN)+fgC(27.8,10.6,0.8,GREEN)+fgL(25,15.8,29,15.8,SKY,1);},
VI:function(){return fgR(0,0,36,26,'#F4F7FC')+fgC(18,13,6.4,TAN)+fgP('15.2,11.4 18,8.8 20.8,11.4 19.4,15.4 18,16.8 16.6,15.4',AZURE)+fgP('13.4,12.6 15.6,10.6 16.2,13.4',AZURE)+fgP('22.6,12.6 20.4,10.6 19.8,13.4',AZURE)+fgC(18,8,0.9,GOLD)+fgST(13.6,17.6,0.9,GREEN)+fgST(22.4,17.6,0.9,GREEN);},
WF:function(){return fgVS(['#2B3A8F',W,'#C8102E']);},
EH:function(){return fgHS([K,W,GREEN])+fgTRI(RED,13)+fgCRESC(5.4,13,1.9,W)+fgST(7.8,13,1,W);},
YE:function(){return fgHS([RED,W,K]);},
ZM:function(){return fgR(0,0,36,26,'#2E9E4E')+fgR(24.6,16.4,2.8,9.6,RED)+fgR(27.6,16.4,2.8,9.6,K)+fgR(30.6,16.4,2.8,9.6,ORANGE)+fgP('24.8,7.6 27.6,5.4 30.4,7.6 27.6,10',GOLD)+fgC(27.6,4.8,0.8,GOLD);},
ZW:function(){return fgHS([GREEN,GOLD,RED,K,RED,GOLD,GREEN])+fgP('0,0 19,13 0,26',K)+fgP('0,2 15.4,13 0,24',W)+fgST(6,13,3.2,RED)+fgP('5.2,12.2 6.8,10.6 6.4,13.4 7,14.6 5,14.6 5.6,13.4',GOLD);},
KR:function(){var s=fgR(0,0,36,26,W);
  s+='<path d="M18 8.6 A4.4 4.4 0 0 1 18 17.4 A2.2 2.2 0 0 1 18 13 A2.2 2.2 0 0 0 18 8.6 Z" fill="#C8102E"/>';
  s+='<path d="M18 17.4 A4.4 4.4 0 0 1 18 8.6 A2.2 2.2 0 0 1 18 13 A2.2 2.2 0 0 0 18 17.4 Z" fill="#2E55A8"/>';
  s+=fgL(5.6,7.2,9.6,4.4,K,1.1)+fgL(6.6,8.8,10.6,6,K,1.1)+fgL(7.6,10.4,11.6,7.6,K,1.1);
  s+=fgL(26.4,18.4,30.4,21.2,K,1.1)+fgL(27.4,16.8,31.4,19.6,K,1.1)+fgL(28.4,15.2,32.4,18,K,1.1);
  s+=fgL(26.8,4.8,30,8.4,K,1.1)+fgL(28,3.8,31.2,7.4,K,1.1)+fgL(29.2,2.8,32.4,6.4,K,1.1);
  s+=fgL(6,18,9.2,21.6,K,1.1)+fgL(7.2,17,10.4,20.6,K,1.1)+fgL(8.4,16,11.6,19.6,K,1.1);
  return s;},
VA:function(){return fgVS([GOLD,W])+fgL(24,10.6,29,15.8,GOLD2,1.3)+fgL(29,10.6,24,15.8,GREY,1.3)+fgE(26.5,9.4,1.9,1.4,W)+fgR(25,8,3,0.8,GOLD,0.3)+fgC(24.2,10.4,0.6,GOLD2)+fgC(28.8,15.8,0.6,GREY);},
BQ:function(){return fgR(0,0,36,26,W)+fgL(0,26,36,0,GOLD,7)+fgL(0,26,36,0,BLUE,4.2)+fgRING(7.6,6.6,2.4,K,0.9)+fgL(7.6,4.2,7.6,9,K,0.6)+fgL(5.2,6.6,10,6.6,K,0.6)+fgST(28.6,19.4,1.9,RED,6);},
CX:function(){return fgP('0,0 36,0 0,26',BLUE)+fgP('36,0 36,26 0,26',GREEN)+fgC(18,13,3.3,GOLD)+fgP('16.6,13.4 18.6,11.4 20.4,13 19,14.6 17,15',W)+fgST(5,4.6,1.1,W)+fgST(8.8,7.4,1.1,W)+fgST(4.2,9.4,1.1,W)+fgST(9.6,3.8,0.8,W);},
CC:function(){return fgR(0,0,36,26,DGREEN)+fgRING(8.4,7.6,4.4,GOLD,0.8)+fgR(8,7.6,0.9,4.4,BROWN)+fgE(6.2,6.4,1.6,0.8,GREEN,-30)+fgE(10.6,6.4,1.6,0.8,GREEN,30)+fgE(8.4,5.4,1.5,0.8,GREEN)+fgCRESC(13.4,7.6,1.6,GOLD,-40)+fgST(25,7,1.5,W)+fgST(29.4,11.4,1.5,W)+fgST(25.4,16.6,1.5,W)+fgST(21.2,11.8,1.2,W)+fgST(27,11.6,0.8,W);},
IM:function(){return fgR(0,0,36,26,'#C8102E')+fgC(18,13,2.2,GOLD)+'<g fill="'+W+'"><path d="M18 13 L25 9.6 Q27 12 24 13.8 L25.6 16.8 Q22 18.4 20.4 15.6 Z"/><path d="M18 13 L25 9.6 Q27 12 24 13.8 L25.6 16.8 Q22 18.4 20.4 15.6 Z" transform="rotate(120 18 13)"/><path d="M18 13 L25 9.6 Q27 12 24 13.8 L25.6 16.8 Q22 18.4 20.4 15.6 Z" transform="rotate(240 18 13)"/></g>';},
MR:function(){return fgHS([[RED,0.9],[GREEN,6],[RED,0.9]])+fgCRESC(18,12.8,3.4,GOLD,-90)+fgST(18,8.4,1.3,GOLD);},
MU:function(){return fgHS([RED,BLUE,GOLD,GREEN]);},
MX:function(){return fgVS([GREEN,W,RED])+fgE(18,12.2,1.7,1.5,BROWN)+fgP('16,11.6 13.6,10.2 15.8,13.4',BROWN)+fgP('20,11.6 22.4,10.2 20.2,13.4',BROWN)+fgC(19.4,10.6,0.8,BROWN)+'<path d="M15.4 15 Q18 17.4 20.6 15" fill="none" stroke="'+DGREEN+'" stroke-width="1.2" stroke-linecap="round"/>'+fgR(16,16.4,4,0.8,GOLD2,0.4);},
FM:function(){return fgR(0,0,36,26,'#5FA8E8')+fgST(18,6,2.4,W)+fgST(18,20,2.4,W)+fgST(9.8,13,2.4,W)+fgST(26.2,13,2.4,W);}
};
/* aliases for territories that fly a parent/national flag */
FLAGS.GP=FLAGS.FR;FLAGS.MQ=FLAGS.FR;FLAGS.YT=FLAGS.FR;
FLAGS.BV=FLAGS.NO;FLAGS.SJ=FLAGS.NO;

/* ---------- badge rendering ---------- */
function flagSVG(cc){
  var body;
  cc=String(cc||'').toUpperCase();
  try{body=(FLAGS[cc]&&FLAGS[cc]())||FLAGS.XX();}catch(e){body=FLAGS.XX();}
  return '<svg viewBox="0 0 36 26" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'+body+
    '<rect x="0" y="0" width="36" height="8.6" fill="#FFFFFF" opacity="0.12"/>'+
    '<rect x="0" y="21.6" width="36" height="4.4" fill="#1F2A52" opacity="0.10"/>'+
  '</svg>';
}
function flagBadgeHTML(cc,cls){return '<span class="flagbadge '+(cls||'sm')+'">'+flagSVG(cc)+'</span>';}
/* =========================================================
   PART 3 — PROFILE UI (create / edit + country picker)
   ========================================================= */

/* opponent profile data is UNTRUSTED — sanitize everything before display */
var MP_AVS_LOCAL=['brain','cube','robot','fox','penguin','bolt','owl','cat','dragon','astro','ninja'];
function mpParseOpp(o){
  o=(o&&typeof o==='object')?o:{};
  var nick=profCleanNick(o.nick!=null?String(o.nick):'');
  return {
    av:(typeof o.av==='string'&&MP_AVS_LOCAL.indexOf(o.av)>=0)?o.av:'robot',
    nick:nick||'RIVAL',
    cc:profValidCc(o.cc)
  };
}
/* display names, always escaped, always capped for layout safety */
function dispNick(n,fallback){
  n=profCleanNick(n);
  if(!n)n=(typeof fallback==='string'&&profCleanNick(fallback))||'RIVAL';
  return esc(cpSlice(n,16));
}
function shortNick(n,fallback){return esc(cpSlice(profCleanNick(n)||fallback||'RIVAL',7));}

/* the VS header used by OPPONENT FOUND and the FINAL RESULT panel */
function versusHTML(compact){
  var me={nick:MMP.nick()||'PLAYER',cc:MMP.cc()};
  var op=MP.opp||{nick:'RIVAL',cc:'XX'};
  var bcls=compact?'md':'lg';
  return '<div class="mp-vs '+(compact?'compact':'pop')+'">'+
    '<span class="mp-pl you"><span class="mp-av flag">'+flagBadgeHTML(me.cc,bcls)+'</span><b>'+dispNick(me.nick,'YOU')+'</b><small>YOU</small></span>'+
    '<span class="mp-x">VS</span>'+
    '<span class="mp-pl opp"><span class="mp-av flag">'+flagBadgeHTML(op.cc,bcls)+'</span><b>'+dispNick(op.nick,'RIVAL')+'</b><small>RIVAL</small></span>'+
  '</div>';
}
/* your profile chip shown on the FINDING OPPONENT panel (with EDIT) */
function mpYouChipHTML(){
  return '<div class="mp-youchip">'+
    flagBadgeHTML(MMP.cc(),'sm')+
    '<b>'+dispNick(MMP.nick(),'PLAYER')+'</b>'+
    '<button class="mp-edit" type="button" data-act="editprof" aria-label="Edit profile"><svg class="ic"><use href="#i-pencil"/></svg>Edit</button>'+
  '</div>';
}
function mpChipRefresh(){var c=$('mp-chip');if(c)c.innerHTML=mpYouChipHTML();}

/* ---------- country picker ---------- */
function ctyRow(cc,name,sel){
  return '<button class="cty-row'+(sel?' sel':'')+'" type="button" data-cc="'+esc(cc)+'">'+
    flagBadgeHTML(cc,'sm')+
    '<span class="cty-n">'+esc(name)+'</span>'+
    '<span class="cty-c">'+esc(cc)+'</span>'+
    '<svg class="ic cty-ok"><use href="#i-check"/></svg>'+
  '</button>';
}
function ctyRender(q){
  var list=$('cty-list');if(!list)return;
  q=String(q||'').trim().toLowerCase();
  var i,h='',n=0;
  if(!q||'world'.indexOf(q)===0||'xx'.indexOf(q)===0){
    h+=ctyRow('XX','World — play anonymously',PROFUI.selCc==='XX');n++;
  }
  for(i=0;i<CTY.length;i++){
    if(q&&CTY[i].n.toLowerCase().indexOf(q)<0&&CTY[i].c.toLowerCase().indexOf(q)!==0)continue;
    h+=ctyRow(CTY[i].c,CTY[i].n,PROFUI.selCc===CTY[i].c);
    n++;
  }
  list.innerHTML=n?h:'<div class="cty-empty">No country matches “'+esc(q)+'”</div>';
}

/* ---------- profile editor controller ---------- */
var PROFUI={
  mode:'create',        /* create | edit */
  onDone:null,
  selCc:'XX',
  open:function(mode,onDone){
    this.mode=(mode==='edit'&&MMP.has())?'edit':'create';
    this.onDone=onDone||null;
    MMP.load();
    this.selCc=MMP.has()?MMP.cc():'XX';
    var t=$('prof-title'),sub=$('prof-sub'),lbl=$('prof-continue-label'),can=$('prof-cancel');
    if(t)t.textContent=this.mode==='edit'?'Edit Player Profile':'Create Player Profile';
    if(sub)sub.textContent=this.mode==='edit'
      ?'Update what online rivals see'
      :'Shown to online rivals — no account needed';
    if(lbl)lbl.textContent=this.mode==='edit'?'Save Profile':'Continue';
    if(can)can.classList.toggle('hidden',this.mode!=='edit');
    var inp=$('prof-nick');
    if(inp)inp.value=MMP.has()?MMP.nick():'';
    this.hideErr();
    this.refresh();
    var cq=$('cty-q');if(cq)cq.value='';
    ctyRender('');
    ovOpen('ov-profile');
    if(inp)setTimeout(function(){try{inp.focus({preventScroll:true});}catch(e){try{inp.focus();}catch(e2){}}},260);
  },
  close:function(){
    ovClose('ov-profile');ovClose('ov-country');
    this.onDone=null;
  },
  /* live preview: big badge + nickname + counter + country button */
  refresh:function(){
    var inp=$('prof-nick');
    var raw=inp?inp.value:'';
    var soft=cpSlice(profStrip(raw),16);
    var pn=$('prof-prevnick');
    if(pn){pn.textContent=soft?soft.toUpperCase():'PLAYER';pn.classList.toggle('empty',!soft);}
    var fp=$('prof-flagprev');if(fp)fp.innerHTML=flagSVG(this.selCc);
    var cf=$('prof-cflag');if(cf)cf.innerHTML=flagSVG(this.selCc);
    var cn=$('prof-cname');
    if(cn){
      cn.textContent=ctyName(this.selCc);
      cn.classList.toggle('none',false);
    }
    var ct=$('prof-count');if(ct)ct.textContent=cpLen(soft)+'/16';
  },
  showErr:function(msg){
    var e=$('prof-err');if(!e)return;
    e.innerHTML='<svg class="ic"><use href="#i-warn"/></svg><span>'+esc(msg)+'</span>';
    e.classList.remove('hidden');
    e.classList.remove('shake');void e.offsetWidth;e.classList.add('shake');
  },
  hideErr:function(){var e=$('prof-err');if(e)e.classList.add('hidden');},
  openPicker:function(){
    ctyRender($('cty-q')?$('cty-q').value:'');
    ovOpen('ov-country');
    var q=$('cty-q');
    if(q)setTimeout(function(){try{q.focus({preventScroll:true});}catch(e){}},240);
  },
  closePicker:function(){ovClose('ov-country');},
  pick:function(cc){
    this.selCc=profValidCc(cc);
    this.refresh();
    ctyRender($('cty-q')?$('cty-q').value:'');
    this.closePicker();
    beep();
  },
  /* CONTINUE / SAVE — validate, store locally, notify, resume flow */
  commit:function(){
    var inp=$('prof-nick');
    var chk=profCheckNick(inp?inp.value:'');
    if(!chk.ok){this.showErr(chk.err);if(inp)inp.focus();return;}
    var changed=!MMP.has()||MMP.nick()!==chk.nick||MMP.cc()!==this.selCc;
    MMP.set(chk.nick,this.selCc);
    var wasMode=this.mode,cb=this.onDone;
    this.close();
    profRefreshSettingsRow();
    if(window.toast)toast('check','green',wasMode==='edit'?'Profile updated':'Profile created','You play online as '+esc(chk.nick));
    /* if a queue search is running, push the fresh display metadata along
       (purely additive — servers that ignore it change nothing) */
    if(changed&&MP.state==='queue-wait'&&MP.on)mpSend({t:'profile',nick:MMP.nick(),cc:MMP.cc()});
    if(MP.state==='finding'||MP.state==='queue-wait')mpChipRefresh();
    if(cb)cb();
  }
};

/* settings row summary (also shows identity before it exists) */
function profRefreshSettingsRow(){
  var el=$('set-profile-sub');if(!el)return;
  el.textContent=MMP.has()?(MMP.nick()+' · '+ctyName(MMP.cc())):'Create your online identity';
}
/* =========================================================
   PART 4 — ONLINE VERSUS: real 2-player online mode
   ---------------------------------------------------------
   Moved here from game.js so ALL online logic lives in one
   file. Player profiles (PART 1-3 above) travel with the
   queue message as display-only metadata {nick, cc}; every
   opponent profile string is sanitized before it is shown.
   Transport : WebSocket to a Cloudflare Worker + Durable Object
               (URL from window.MM_BACKEND in index.html, or the
               ?mm= query parameter for local testing).
   Fairness  : the server owns the match seed, the round plan and
               the clock. Both clients rebuild the IDENTICAL board
               from (spec, seed) with the game's own pattern code,
               and the server re-derives the same board to validate
               every tap — scores sent by clients are clamped.
   Isolation : R.mode='versus' while a match runs. No campaign,
               token, career or save data is written by this mode
               (only the dedicated S.mp record).
   No AI, no local second player — two real sessions talk through
   the backend or there is no match at all.
   ========================================================= */
var MP_AVS=['brain','cube','robot','fox','penguin','bolt','owl','cat','dragon','astro','ninja'];
var MP_URL=(function(){
  var u='';
  try{if(window.MM_BACKEND)u=String(window.MM_BACKEND);}catch(e){}
  try{
    var q=new URLSearchParams(location.search).get('mm');
    if(q){u=q;try{localStorage.setItem('mmx_mpsrv',q);}catch(e2){}}
  }catch(e3){}
  if(!u){try{u=localStorage.getItem('mmx_mpsrv')||'';}catch(e4){}}
  if(u){
    u=u.replace(/^http/,'ws');
    try{var u2=new URL(u.replace(/^ws/,'http'));if((u2.pathname===''||u2.pathname==='/')&&!/\/ws\/?$/i.test(u))u+='/ws';}catch(e5){}
  }
  return u;
})();
var MP={
  on:false,          /* a network flow exists (socket open / connecting) */
  active:false,      /* versus owns the board (R) right now */
  state:'idle',      /* idle finding queue-wait room-pick room-host room-guest remwait countdown playing roundwait roundend reconnecting ended */
  ws:null,mid:'',pid:'',seat:0,opp:null,rounds:5,round:0,
  tot:[0,0],roundLog:[],win:null,dl:0,raf:0,
  srvOff:0,          /* server-clock offset: serverNow - clientNow (latest sample) */
  nextAt:0,          /* authoritative SERVER timestamp for the next round/final result */
  nextT:0,           /* one-shot failsafe if the next round message never arrives */
  lastEnd:null,      /* latest authoritative ROUND_RESULT payload (for resume) */
  retr:0,findT:0,findT2:0,pingT:0,hbAt:0,cardT:0,endT:0,a:null,b:null,c:null,lastScore:0,
  lastReason:'',remT:0,roomCode:'',pendRoom:''
};
function mpLog(){ /* concise console diagnostics — networking errors only, never gameplay noise */
  try{console.warn.apply(console,['[MP]'].concat([].slice.call(arguments)));}catch(e){}
}
/* ---------- internal lifecycle debug (never shown in the game UI) ----------
   Enable with ?mmdebug=1 or localStorage.setItem('mmx_mpdebug','1').
   One flag (MPDBG) disables everything again. */
var MPDBG=false;
try{MPDBG=/[?&](mmdebug|mpdbg)=1/.test(location.search);}catch(e){}
if(!MPDBG){try{MPDBG=localStorage.getItem('mmx_mpdebug')==='1';}catch(e2){}}
function mpDbg(ev,data){
  if(!MPDBG)return;
  try{
    console.info('[MM] '+ev,
      'mid='+((MP.mid||'—').slice(0,8)),
      'round='+MP.round,
      'sockRS='+(MP.ws?MP.ws.readyState:'-'),
      'state='+MP.state,
      data==null?'':data);
  }catch(e){}
}
function mpAv(){var a=S.eq&&S.eq.avatars;return MP_AVS.indexOf(a)>=0?a:'brain';}
function mpSend(o){try{if(MP.ws&&MP.ws.readyState===1)MP.ws.send(JSON.stringify(o));}catch(e){mpLog('send failed',e&&e.message);}}
/* ---- seat-aware totals (server sends tot[] in SEAT order) ----
   MP.seat is THIS client's seat (0 or 1). Every total displayed as
   "mine" MUST index by seat — never hardcode [0]. */
function mpSeat(){return (MP.seat===1)?1:0;}
function mpMyTot(){var i=mpSeat();return (MP.tot&&MP.tot.length>i)?(MP.tot[i]||0):0;}
function mpOppTot(){var i=1-mpSeat();return (MP.tot&&MP.tot.length>i)?(MP.tot[i]||0):0;}
function mpPayMy(p){var i=mpSeat();return (p&&p.tot&&p.tot.length>i)?(p.tot[i]||0):0;}
function mpPayOpp(p){var i=1-mpSeat();return (p&&p.tot&&p.tot.length>i)?(p.tot[i]||0):0;}
function mpConnect(onOpen,onFail){
  if(!MP_URL){if(onFail)onFail();return;}
  /* SINGLE-SOCKET INVARIANT — a live, OPEN socket is reused and never
     duplicated for the same match. Only a dead/missing socket is
     replaced. This is what lets one connection live through
     matchmaking → R1 … R5 → final result. */
  if(MP.ws&&MP.ws.readyState===1&&MP.on){mpDbg('SOCKET_REUSE');if(onOpen)onOpen();return;}
  mpCloseSock();
  var ws;
  try{ws=new WebSocket(MP_URL);}catch(e){mpLog('open failed',e&&e.message);if(onFail)onFail();return;}
  MP.ws=ws;MP.hbAt=Date.now();
  var opened=false,closed=false;
  ws.onopen=function(){if(opened)return;opened=true;if(MP.ws!==ws)return;mpDbg('SOCKET_OPEN');mpStartPing();if(onOpen)onOpen();};
  ws.onmessage=function(ev){
    if(MP.ws!==ws)return;               /* stale socket events never touch current state */
    var m;try{m=JSON.parse(ev.data);}catch(e){return;}
    if(!m||typeof m.t!=='string')return;
    MP.hbAt=Date.now();
    mpMsg(m);
  };
  ws.onclose=function(ev){
    if(closed)return;closed=true;
    mpDbg('SOCKET_CLOSE','code='+(ev&&ev.code));
    mpStopPing();
    if(MP.ws!==ws)return;               /* an OLD socket closing must not kill the NEW one */
    MP.ws=null;
    mpConnLost();
  };
  ws.onerror=function(){mpDbg('SOCKET_ERROR');}; /* onclose always follows — handled there */
}
function mpCloseSock(){
  mpStopPing();
  if(MP.ws){try{MP.ws.onclose=null;MP.ws.onmessage=null;MP.ws.onerror=null;MP.ws.close();}catch(e){}MP.ws=null;}
}
function mpStartPing(){
  mpStopPing();                       /* never two heartbeat timers */
  MP.pingT=setInterval(function(){
    mpSend({t:'ping'});
    /* genuine heartbeat loss = nothing (not even a pong) for 25s.
       Gameplay inactivity, "waiting for rival" and round transitions
       are NEVER treated as connection loss — and neither is a hidden
       tab (timers + sockets stall in background; killing the match
       over that would be a false alarm). */
    if(document.hidden)return;
    if(Date.now()-MP.hbAt>25000&&MP.state!=='idle'&&MP.state!=='reconnecting'){mpLog('heartbeat lost');mpCloseSock();mpConnLost();}
  },10000);
}
function mpStopPing(){if(MP.pingT){clearInterval(MP.pingT);MP.pingT=0;}}
/* returning from a hidden tab: the heartbeat clock is stale by design
   (see above), so grant one fresh window + an immediate ping instead of
   condemning a socket that may be perfectly alive. If it is truly dead,
   the normal ticks will catch it within seconds. */
document.addEventListener('visibilitychange',function(){
  if(document.hidden||!MP.on||!MP.ws||MP.ws.readyState!==1)return;
  try{
    MP.hbAt=Date.now();
    mpSend({t:'ping'});
  }catch(e){}
});

/* ---------- entry point (PLAY ONLINE) ---------- */
function mpFind(){
  if(MP.state!=='idle')return;                 /* repeated taps while already searching are ignored */
  A.init();A.btn();
  if(!MP_URL){toast('warn','coral','Online not set up here','The multiplayer server is not configured on this host');A.warn();return;}
  if(R.active){clrT();R.active=false;R.over=true;}
  MP.on=true;
  mpViewChoice();
}
function mpFindRandom(){
  if(MP.state!=='idle')return;
  if(!MP_URL){toast('warn','coral','Online not set up here','The multiplayer server is not configured on this host');A.warn();return;}
  if(R.active){clrT();R.active=false;R.over=true;}
  MP.on=true;MP.state='finding';MP.retr=0;
  mpConnSet('warn','SEARCHING');
  mpViewFinding('Matching you with a real player…');
  mpConnect(function(){
    if(MP.state!=='finding')return;
    MP.state='queue-wait';
    mpSend({t:'queue',av:mpAv(),nick:MMP.nick(),cc:MMP.cc()});   /* display-only metadata */
    if(MP.findT)clearTimeout(MP.findT);
    if(MP.findT2)clearTimeout(MP.findT2);
    MP.findT2=setTimeout(function(){
      MP.findT2=0;
      if(MP.state!=='queue-wait')return;      /* a later search owns the screen now */
      var s=$('mp-sub');if(s)s.textContent='Still looking — the arena is busy today…';
    },30000);
    MP.findT=setTimeout(function(){            /* failsafe if the server never answers */
      MP.findT=0;
      if(MP.state==='queue-wait')mpQueueTimeout();
    },95000);
  },function(){
    if(MP.state!=='finding')return;
    MP.state='idle';MP.on=false;
    mpViewError('CONNECTION PROBLEM','Could not reach the arena. Check your connection and try again.','TRY AGAIN');
  });
}
function mpQueueTimeout(){
  MP.state='idle';MP.on=false;
  mpCloseSock();
  if(MP.findT){clearTimeout(MP.findT);MP.findT=0;}
  if(MP.findT2){clearTimeout(MP.findT2);MP.findT2=0;}
  mpViewError('NO OPPONENT RIGHT NOW','The arena is quiet at the moment. Try again in a bit!','TRY AGAIN');
}
function mpCancel(){
  A.btn();
  mpSend({t:'leave_queue'});
  mpLeave(true);
}

/* ---------- server → client ---------- */
function mpMsg(m){
  /* Every authoritative message carries the server clock (top-level or in
     the payload); keep the latest offset so nextRoundAt can be mapped onto
     this phone's clock. The client NEVER derives round timing from a local
     timer — only from server time. */
  var srvNow=(typeof m.now==='number')?m.now:((m.p&&typeof m.p.now==='number')?m.p.now:null);
  if(srvNow!=null)MP.srvOff=srvNow-Date.now();
  switch(m.t){
    case 'ready':if(m.pid)MP.pid=m.pid;break;
    case 'queued':case 'queue_left':break;
    case 'room_created':mpRoomCreated(m);break;
    case 'room_joined':mpRoomJoined(m);break;
    case 'room_mate':mpRoomMate(m);break;
    case 'room_left':mpRoomLeft(m);break;
    case 'room_gone':mpRoomGone(m);break;
    case 'room_full':mpRoomFull(m);break;
    case 'rematch_offer':mpRematchOffer();break;
    case 'rematch_dead':mpRematchDead();break;
    case 'matched':mpOnMatched(m);break;
    case 'count':mpCount(m.n);break;
    case 'round':mpRoundStart(m);break;
    case 'opp':mpOppLive(m);break;
    case 'fix':mpFix(m);break;
    case 'waiting':if(MP.state==='roundwait')mpOppStatus('RIVAL IS STILL PLAYING…',false);break;
    case 'round_end':mpRoundEnd(m);break;
    case 'match_end':mpMatchEnd(m);break;
    case 'opp_left':mpOppLeft(m);break;
    case 'opp_back':mpOppBack();break;
    case 'profile':case 'opp_profile':mpOppProfileMsg(m);break;
    case 'resume_ok':mpResumeOk(m);break;
    case 'resume_fail':mpResumeFail();break;
    case 'queue_timeout':if(MP.state==='queue-wait'||MP.state==='finding')mpQueueTimeout();break;
    case 'pong':break;
    case 'err':mpLog('server error',m.c);break;
  }
}
/* ---------- authoritative state persistence ----------
   Saved AFTER every ROUND_RESULT (and at match start / round start),
   under the same session key the resume flow already uses. It never
   touches campaign/local save data (S / mmx_ namespace). */
function mpSaveState(){
  try{
    if(!MP.mid||!MP.pid)return;
    sessionStorage.setItem('mmx_mpresume',JSON.stringify({
      m:MP.mid,pid:MP.pid,seat:MP.seat,round:MP.round,
      tot:MP.tot,lastEnd:MP.lastEnd,nextAt:MP.nextAt,
      opp:MP.opp,st:MP.state,ts:Date.now()
    }));
  }catch(e){}
}
/* Versus spec normalization shared by live rounds and resume. noRecent
   marks the board as pure (deterministic from size/count/seed) — the
   server derives the identical Set to validate taps. */
function mpNormSpec(r,spec,reveal,recall){
  var revDur=reveal||(spec&&(spec.reveal||spec.dur))||1680;
  var recDur=recall||(spec&&(spec.recall||spec.dur))||5600;
  spec=spec||{};
  return Object.assign({},spec,{
    tiles:spec.tiles!=null?spec.tiles:spec.count,
    count:spec.count!=null?spec.count:spec.tiles,
    dur:revDur,
    reveal:revDur,
    recall:recDur,
    round:r,
    noRecent:true
  });
}
function mpOnMatched(m){
  if(MP.remT){clearTimeout(MP.remT);MP.remT=0;}MP.lastReason='';MP.roomCode='';
  Plat.updateRoom(m.m,false);
  MP.mid=m.m;if(m.pid)MP.pid=m.pid;MP.seat=m.you;MP.opp=mpParseOpp(m.opp);MP.rounds=m.rounds||5; /* authoritative round count comes from the server */
  MP.tot=[0,0];MP.roundLog=[];MP.round=0;MP.lastScore=0;MP.lastEnd=null;MP.nextAt=0;MP.nextT=0;
  mpSaveState();           /* persist match id + player identity immediately */
  if(R.active){clrT();R.active=false;R.over=true;}      /* abort any stray single-player round */
  mmResetRecent();                                            /* pattern history restarts — parity with the server room */
  R.active=false;R.over=false;R.paused=false;R.mode='versus';
  R.score=0;setScore(0);
  showScreen('game');
  try{if(window.MU)MU.setScene('versus');}catch(e){}
  $('hud-lvl-lbl').textContent='Round';
  R.maxLives=3;R.lives=3;R.combo=0;R.bestCombo=0;R.round=1;R.level=1;
  mmResetHeartsShown();renderHearts();updateHUD();hideBossBar();
  objstrip.classList.add('hidden');renderPuBar();updatePuStates();
  $('btn-pause').style.visibility='hidden';
  var btnLeave=$('btn-mp-leave');
  if(btnLeave)btnLeave.classList.remove('hidden');
  var badge=$('mpo-round-badge');
  if(badge)badge.textContent='ROUND 1 / '+(MP.rounds||5);
  mpOppShow();
  mpPips();
  mpConnSet('ok','IN MATCH');
  MP.state='countdown';
  mpViewFound();
  A.ach();
}
function mpCount(n){
  if(MP.state!=='countdown'&&MP.state!=='playing')return;
  closeOv('ov-mp');
  if(MP.countT){clearInterval(MP.countT);MP.countT=0;}
  var cur=(typeof n==='number'&&n>0)?n:3;
  banner('lv','bolt',''+cur,700);
  A.show();
  MP.countT=setInterval(function(){
    cur--;
    if(cur>0){
      banner('lv','bolt',''+cur,700);
      A.show();
    }else{
      clearInterval(MP.countT);
      MP.countT=0;
      banner('warn','play','GO!',650);
      A.phase();
      MP.active=true;
    }
  },950);
}
function mpRoundStart(m){
  mpSyncHide();
  mpConnSet('ok','IN MATCH');
  /* ROUND_START validation — only the expected next round (or the very
     first round) starts gameplay, and only once. Duplicates and stale
     round messages are ignored without touching the connection. */
  var maxR=MP.rounds||5;
  if(m.r>maxR||MP.state==='ended'){mpDbg('ROUND_START_IGNORED','r='+m.r+' out of range');return;}
  if(m.r===MP.round&&(MP.state==='playing'||MP.state==='roundwait')){mpDbg('ROUND_START_DUP_IGNORED','r='+m.r);return;}
  if(MP.round&&m.r<MP.round){mpDbg('ROUND_START_STALE_IGNORED','r='+m.r+' current='+MP.round);return;}
  mpDbg('ROUND_START','r='+m.r);
  if(MP.countT){clearInterval(MP.countT);MP.countT=0;}
  if(MP.nextT){clearTimeout(MP.nextT);MP.nextT=0;}        /* the next round arrived — cancel the failsafe */
  if(MP.cardT){clearTimeout(MP.cardT);MP.cardT=0;}
  if(MP.a){clearTimeout(MP.a);MP.a=null;}                 /* no stale re-teach timer inside the new round */
  maxHideCard();
  MP.round=m.r;MP.lastEnd=null;MP.nextAt=0;
  MP.active=true;                                          /* versus controls live again — also after a transition-resume */
  var revDur=m.reveal||(m.spec&&(m.spec.reveal||m.spec.dur))||1680;
  var recDur=m.recall||(m.spec&&(m.spec.recall||m.spec.dur))||5600;
  MP.win={reveal:revDur,recall:recDur};
  MP.state='playing';MP.dl=performance.now()+revDur+recDur;
  R.mode='versus';R.active=true;R.over=false;R.paused=false;R.phase='idle';
  R.round=m.r;R.level=m.r;R.maxLives=3;R.lives=3;R.combo=0;R.bestCombo=0;
  R.misses=0;R.missThisLevel=0;R.hits=0;R.taps=0;R.decoysFound=0;R.noMiss=true;
  mmResetHeartsShown();renderHearts();updateHUD();
  var badge=$('mpo-round-badge');
  if(badge)badge.textContent='ROUND '+m.r+' / '+maxR;
  mpOppReset();
  var normSpec=mpNormSpec(m.r,m.spec,revDur,recDur);
  beginRound(normSpec,m.seed);                     /* identical board on both clients AND the server, built from seed */
  mpSaveState();                                   /* round/match state snapshot at every round start */
  setScore(R.score);
  if(MP.raf)cancelAnimationFrame(MP.raf);
  mpDeadline();
}
/* soft local mirror of the server's round clock — the server is the authority */
function mpDeadline(){
  if(MP.state!=='playing'){MP.raf=0;return;}
  var left=MP.dl-performance.now();
  if(left<=0){
    MP.raf=0;
    if(R.phase==='recall'||R.phase==='teach'){
      lockAll(true);setObj('Time!','bad');A.bad();
    }
    return;
  }
  if(R.phase==='recall'||R.phase==='teach')setProg(left/Math.max(1,MP.win.recall),true);
  MP.raf=requestAnimationFrame(mpDeadline);
}
/* ---------- tapping (mirrors the single-player feel, zero shared writes) ---------- */
function mpHandleTap(i){
  if(!MP.active||MP.state!=='playing')return;
  if(R.phase!=='recall'||R.paused||!R.active||R.over)return;
  if(R.sel[i]||R.decoySel[i])return;
  var t=performance.now(),p=tileCenter(i);
  R.taps++;
  var isReq=!!R.requiredMap[i],isDecoy=!!R.decoyMap[i];
  if(isReq&&R.spec.order){
    if(R.orderAll[R.ordQ]!==i){
      R.combo=0;updateHUD();A.bad();vib(30);
      var el=tileAt(i);
      if(el){el.classList.add('lockedTap');setTimeout(function(){if(el&&el.className.indexOf('ok')<0)el.classList.remove('lockedTap');},340);}
      FX.text(p.x,p.y-16,'ORDER!','#E04F4F',14);
      setObj('Wrong order — combo reset','warn');
      mpSend({t:'tap',r:MP.round,i:i,k:'order',s:R.score});
      return;
    }
  }
  if(isReq){
    var dt=t-R.lastTap;
    R.lastTap=t;R.tapTimes.push(dt);
    R.hits++;R.found++;R.ordQ++;R.sel[i]=1;
    var mult=multOf(R.combo+1);
    R.combo++;
    if(R.combo>R.bestCombo)R.bestCombo=R.combo;
    var tier=dt<=650?'PERFECT':(dt<=1150?'FAST':(dt<=1800?'GREAT':''));
    var sb=tier==='PERFECT'?45:(tier==='FAST'?25:(tier==='GREAT'?10:0));
    var roundTiles=(R.spec&&R.spec.tiles)||R.required;
    var base=9+R.level*1.5+roundTiles*1.5;
    var pts=Math.round(base*mult+sb*(1+mult*0.15));
    R.score+=pts;setScore(R.score);mpMyScore(R.score);
    setTile(i,'ok',true);
    A.good();vib(12);
    spawnTrail(p);
    FX.burst(p.x,p.y,{n:10,colors:pcols(),sp:3.4,shapes:pshapes()});
    FX.burst(p.x,p.y,{n:1,colors:['#FFFFFF'],sp:.5,g:0,size:6,shapes:['o']});
    tapRipple(p);
    refreshRecallCounter();
    R.lastHit={x:p.x,y:p.y};
    FX.text(p.x,p.y-18,'+'+pts,'#2FA24A',15);
    if(tier)FX.text(p.x+20,p.y-34,tier,tier==='PERFECT'?'#E0A31E':'#2E92D1',12);
    mpComboFx();
    updateHUD();
    setProg(R.found/Math.max(1,R.required),true);
    mpSend({t:'tap',r:MP.round,i:i,k:'ok',s:R.score});
    if(R.found>=R.required)mpRoundClear();
    return;
  }
  if(isDecoy){
    R.decoySel[i]=1;R.decoysFound++;R.found++;R.combo++;
    if(R.combo>R.bestCombo)R.bestCombo=R.combo;
    var pts2=Math.round(30+R.level*2);
    R.score+=pts2;setScore(R.score);mpMyScore(R.score);
    setTile(i,'decoy ok',true);
    A.good();vib(12);
    refreshRecallCounter();
    FX.burst(p.x,p.y,{n:9,colors:['#4CB9F2','#FFFFFF','#9FB0D0'],sp:3,shapes:['c','s']});
    FX.text(p.x,p.y-18,'DECOY +'+pts2,'#2E92D1',14);
    updateHUD();setProg(R.found/Math.max(1,R.required),true);
    mpSend({t:'tap',r:MP.round,i:i,k:'decoy',s:R.score});
    if(R.found>=R.required)mpRoundClear();
    return;
  }
  /* stray tap — costs a heart, exactly like solo */
  setTile(i,'no lock');
  mpMiss(p);
  mpSend({t:'tap',r:MP.round,i:i,k:'miss',s:R.score});
}
function mpMiss(p){
  board.classList.remove('shake');void board.offsetWidth;board.classList.add('shake');
  A.bad();vib([45,40,45]);missFlash();
  FX.burst(p.x,p.y,{n:10,colors:['#FF6B6B','#FF9E9E','#FFD1D1'],sp:3,shapes:['c','r']});
  FX.burst(p.x,p.y,{n:1,colors:['#FF6B6B'],sp:.4,g:0,size:7,shapes:['o']});
  R.combo=0;R.noMiss=false;R.misses++;R.lives--;
  renderHearts();updateHUD();
  if(R.lives===1)banner('warn','heart','Last heart!',1200);
  if(R.lives<=0){mpRoundDead();return;}
  var j,k,w,idx;
  for(j=0;j<R.waves.length;j++){
    w=R.waves[j];
    for(k=0;k<w.tiles.length;k++){idx=w.tiles[k];if(!R.sel[idx])setTile(idx,'warn lock');}
  }
  R.phase='teach';A.warn();
  setObj('So close! Watch again…','warn');
  if(MP.a)clearTimeout(MP.a);
  MP.a=setTimeout(function(){
    if(!MP.active||MP.state!=='playing')return;
    for(var j2=0;j2<R.waves.length;j2++){
      var w2=R.waves[j2];
      for(var k2=0;k2<w2.tiles.length;k2++){var idx2=w2.tiles[k2];if(!R.sel[idx2])setTile(idx2,'lock');}
    }
    R.phase='recall';lockAll(false);
    setObj('Keep going — find the rest!  '+R.found+' / '+R.required,'warn');
    R.lastTap=performance.now();
  },1250);
}
function mpComboFx(){
  var m=multOf(R.combo);
  elMult.classList.remove('pulse');void elMult.offsetWidth;elMult.classList.add('pulse');
  if(R.combo>=3){
    A.combo(R.combo);
    var bc=boardTopCenter();
    FX.burst(bc.x,bc.y+rnd(0,20),{n:Math.min(4+R.combo,14),colors:pcols(),ang:-Math.PI/2,spread:1.1,sp:3.6,up:1.4,shapes:pshapes()});
    FX.text(bc.x,bc.y-6,'+COMBO ×'+m,'#9A6E08',13);
  }
  var MS=[[5,'ON FIRE!','fire'],[10,'UNSTOPPABLE!','bolt'],[15,'MEMORY BEAST!','crown'],[20,'LEGENDARY FOCUS!','spark'],[25,'MATRIX MIND!','chip']];
  for(var i=0;i<MS.length;i++){
    if(R.combo===MS[i][0]){banner('warn',MS[i][2],MS[i][1]+'  ×'+R.combo,1300);A.won();break;}
  }
}
function mpRoundClear(){
  R.phase='clear';R.over=true;clrT();lockAll(true);
  if(MP.raf){cancelAnimationFrame(MP.raf);MP.raf=0;}
  A.clear();vib(25);
  flareTiles();
  var bc=boardCenter();
  FX.fountain(bc.x,bc.y,30,pcols());
  banner('','crown','ROUND CLEAR!',1000);
  setObj('Round done! Waiting for your rival…','go');
  MP.state='roundwait';
  mpOppStatus('RIVAL IS STILL PLAYING…',false);
  mpOppDone();
  mpConnSet('ok','WAITING');
  mpSend({t:'round_done',r:MP.round,reason:'clear',score:R.score,hits:R.hits,misses:R.misses,taps:R.taps});
}
function mpRoundDead(){
  R.phase='over';R.over=true;clrT();lockAll(true);
  if(MP.raf){cancelAnimationFrame(MP.raf);MP.raf=0;}
  A.over();
  setObj('Out of hearts!','bad');
  MP.state='roundwait';
  mpOppStatus('WAITING FOR YOUR RIVAL…',false);
  mpConnSet('ok','WAITING');
  mpSend({t:'round_done',r:MP.round,reason:'dead',score:R.score,hits:R.hits,misses:R.misses,taps:R.taps});
}
/* server correction for a rejected tap (should never happen in fair play) */
function mpFix(m){
  if(!MP.active||MP.state!=='playing')return;
  if(m&&m.i>=0&&!R.sel[m.i]&&!R.decoySel[m.i])setTile(m.i,'lock');
  mpLog('tap corrected by server');
}
/* ---------- round & match boundaries ---------- */
/* SINGLE authoritative ROUND_RESULT handler.
   The server computes scores/totals BEFORE the 5-second transition and
   sends this the instant both players are finished — so everything here
   happens IMMEDIATELY. The only thing paced by time is the visual
   transition countdown, driven by the server's nextRoundAt (never by a
   local score-calculation timer). */
function mpRoundEnd(m){
  if(MP.state!=='playing'&&MP.state!=='roundwait'&&MP.state!=='roundend'&&MP.state!=='reconnecting')return;
  var p=m.p;
  if(!p)return;
  /* STALE RESULT GUARD — a ROUND_RESULT for a round we already left
     behind (old socket replay, delayed duplicate) is ignored quietly.
     It must never rewind the current round or touch the connection. */
  if(MP.round&&p.r<MP.round){mpDbg('ROUND_RESULT_STALE_IGNORED','r='+p.r);return;}
  mpDbg('ROUND_RESULT','r='+p.r+' you='+((p.you&&p.you.score)||0)+' opp='+((p.opp&&p.opp.score)||0));
  if(MP.a){clearTimeout(MP.a);MP.a=null;}   /* a late round-1 re-teach timer must never fire inside round 2 */
  if(p.maxR)MP.rounds=p.maxR;
  /* 1. adopt authoritative scores/totals IMMEDIATELY */
  MP.tot=p.tot.slice();
  var ys=p.you?p.you.score:0;
  var os=p.opp?p.opp.score:0;
  /* idempotent replay guard (resume re-delivers the same round result) */
  var lg=MP.roundLog[MP.roundLog.length-1];
  if(lg&&lg.r===p.r){lg.y=ys;lg.o=os;}
  else MP.roundLog.push({r:p.r,y:ys,o:os,yb:0,ob:0,yt:0,ot:0});
  MP.lastEnd=p;
  /* 2. freeze the board + deadline mirror IMMEDIATELY */
  R.active=false;R.over=true;R.phase='clear';clrT();lockAll(true);
  if(MP.raf){cancelAnimationFrame(MP.raf);MP.raf=0;}
  /* 3. total/score HUD update IMMEDIATELY */
  R.score=mpPayMy(p);setScore(R.score);mpMyScore(mpMyTot());
  MP.lastScore=ys;
  MP.state='roundend';
  mpOppTotals();
  mpOppStatus('',false);            /* "WAITING FOR RIVAL" disappears THE INSTANT the server confirms the result */
  setObj('Round '+p.r+' of '+(MP.rounds||5)+' — result in!','go');
  /* 4. authoritative transition target (server time) */
  MP.nextAt=(typeof p.nextRoundAt==='number')?p.nextRoundAt:0;
  var nextAtLocal=MP.nextAt?(MP.nextAt-MP.srvOff):0;
  /* 5. persist the latest authoritative multiplayer state IMMEDIATELY
        (match id, round, identity, round scores, totals, result,
         match state, nextRoundAt) — never after the transition */
  mpSaveState();
  /* 6. result card NOW (both round scores + updated totals) */
  mpRoundCard(p);
  mpPips();
  /* 6b. sync animation for the transition gap (visual only) */
  (function(){
    var isFinal=(p.r>=(MP.rounds||5));
    mpSyncShow(isFinal,nextAtLocal);
  })();
  /* 7. after the FINAL round: no local winner math at all —
        the server's match_end at nextRoundAt is the only FINAL_RESULT */
  /* 8. NON-DESTRUCTIVE failsafe: if the next ROUND_START (or match_end)
        is genuinely missing, the FIRST response is a same-socket
        re-sync — the server re-sends the authoritative snapshot over the
        SAME live connection. The socket is NOT closed and no reconnect
        UI appears. Only if the socket is actually dead (or even the
        re-sync goes unanswered) do we enter the real recovery flow.
        One timer armed per round result — not a loop, not polling. */
  if(MP.nextT){clearTimeout(MP.nextT);MP.nextT=0;}
  mpDbg('ROUND_TRANSITION','nextAtLocal≈'+(nextAtLocal?Math.max(0,Math.round(nextAtLocal-Date.now()))+'ms':'?'));
  var grace=nextAtLocal?(nextAtLocal-Date.now()+4000):9000;
  MP.nextT=setTimeout(function(){
    MP.nextT=0;
    if(MP.state!=='roundend'||!MP.on)return;
    var sockOpen=MP.ws&&MP.ws.readyState===1;
    var hbFresh=Date.now()-MP.hbAt<15000;
    if(sockOpen&&hbFresh){
      /* the socket is OPEN and the server answered a heartbeat
         recently — the round message is merely missing. Re-sync over
         the SAME socket instead of tearing the connection down. */
      mpDbg('ROUND_LATE_SYNC','re-requesting authoritative state');
      mpSend({t:'resume',m:MP.mid,pid:MP.pid,nick:MMP.nick(),cc:MMP.cc()});
      /* final grace: if even the re-sync gets no answer, the
         connection is genuinely unhealthy → genuine recovery flow. */
      MP.nextT=setTimeout(function(){
        MP.nextT=0;
        if(MP.state==='roundend'&&MP.on){mpDbg('ROUND_SYNC_TIMEOUT');mpCloseSock();mpConnLost();}
      },8000);
    }else{
      /* socket actually closed or heartbeat silent → genuine loss */
      mpDbg('ROUND_LOST','socket not open — recovering');
      mpCloseSock();
      mpConnLost();
    }
  },clamp(grace,6000,15000));
}
function mpMatchEnd(m){
  if(MP.state==='ended')return;
  mpSyncHide();
  mpConnSet('ok','FINISHED');
  var p=m.p;
  if(!p)return;
  try{if(window.MU)MU.setScene('menu');}catch(e){}
  MP.tot=p.tot.slice();
  if(MP.nextT){clearTimeout(MP.nextT);MP.nextT=0;}
  if(MP.cardT){clearTimeout(MP.cardT);MP.cardT=0;}
  maxHideCard();
  R.active=false;R.over=true;R.phase='over';clrT();
  if(MP.raf){cancelAnimationFrame(MP.raf);MP.raf=0;}
  R.score=mpPayMy(p);setScore(R.score);mpMyScore(mpMyTot());
  MP.active=false;MP.state='ended';
  MP.lastReason=(p&&p.reason)||'completed';
  Plat.gameplayStop();
  Plat.leaveRoom();
  try{sessionStorage.removeItem('mmx_mpresume');}catch(e){}
  /* dedicated online record — single-player saves are untouched */
  S.mp=S.mp||{g:0,w:0,l:0,t:0,best:0};
  S.mp.g=(S.mp.g||0)+1;
  if(p.win==='you')S.mp.w=(S.mp.w||0)+1;
  else if(p.win==='opp')S.mp.l=(S.mp.l||0)+1;
  else S.mp.t=(S.mp.t||0)+1;
  var _myBest=mpPayMy(p);
  if((_myBest||0)>(S.mp.best||0))S.mp.best=_myBest;
  saveKey('mp');
  var win=p.win==='you',tie=p.win==='tie';
  if(win){A.won();Plat.happytime();FX.fountain(window.innerWidth/2,window.innerHeight*0.32,46);}
  else if(tie){A.ach();}
  else{A.over();}
  var title=win?'VICTORY!':(tie?'PERFECT DRAW':'SO CLOSE!');
  var sub=win?'You out-recalled your rival.':(tie?'Dead even — settle it with a rematch.':'Your rival edged this one. Get it back!');
  var rl='',i,rs=p.rounds||[];
  /* normalize the server's seat-ordered round log into the display shape
     ({y,o}) from THIS phone's perspective — falls back to the local log */
  if(!rs.length)rs=MP.roundLog;
  else rs=rs.map(function(en,i2){
    if(en&&en.score)return{y:(MP.seat===1?en.score[1]:en.score[0]),o:(MP.seat===1?en.score[0]:en.score[1]),yb:(MP.seat===1?((en.fb&&en.fb[1])||0):((en.fb&&en.fb[0])||0)),ob:(MP.seat===1?((en.fb&&en.fb[0])||0):((en.fb&&en.fb[1])||0))};
    return en;
  });
  for(i=0;i<rs.length;i++){
    var spdBadge=rs[i].yb?('<span class="ri-speed">+'+rs[i].yb+' SPD</span>'):'';
    rl+='<div class="rec-item'+(rs[i].y>rs[i].o?' won':(rs[i].y<rs[i].o?' lost':''))+'">'+
      '<span class="ri-ic"><svg class="ic"><use href="#i-'+(rs[i].y>rs[i].o?'check':(rs[i].y<rs[i].o?'x':'star'))+'"/></svg></span>'+
      '<span class="ri-t">Round '+(i+1)+' / '+(MP.rounds||5)+spdBadge+'</span><span class="ri-v">'+nf(rs[i].y)+' — '+nf(rs[i].o)+'</span></div>';
  }
  var reason=(p.reason==='forfeit'||p.reason==='opponent_left')?'Won by disconnect — your rival left the match.':'';
  mpPanel(
    '<div class="go-hero '+(win?'green':(tie?'yellow':'coral'))+'"><svg class="ic"><use href="#i-'+(win?'trophy':(tie?'star':'heart'))+'"/></svg></div>'+
    '<h2 style="font-family:var(--fd);font-weight:800;font-size:1.5rem;text-align:center">'+title+'</h2>'+
    '<p class="ov-sub">'+(reason||sub)+'</p>'+
    versusHTML(true)+
    '<div class="mp-duel">'+
      '<div class="plate"><span class="lbl">You</span><span class="val">'+nf(mpPayMy(p))+'</span></div>'+
      '<span class="mp-dash">&ndash;</span>'+
      '<div class="plate"><span class="lbl">Rival</span><span class="val">'+nf(mpPayOpp(p))+'</span></div>'+
    '</div>'+
    (rs.length?'<div class="rec-list mp-rounds">'+rl+'</div>':'')+
    '<div class="mp-recline"><svg class="ic"><use href="#i-globe"/></svg>Online record&nbsp; '+nf(S.mp.w)+'W &middot; '+nf(S.mp.l)+'L &middot; '+nf(S.mp.t)+'D</div>'+
    '<div class="ov-stack">'+
      '<button class="btn big wide" data-act="rematch"><svg class="ic"><use href="#i-retry"/></svg>Rematch</button>'+
      '<button class="btn white wide" data-act="home"><svg class="ic"><use href="#i-home"/></svg>Home</button>'+
    '</div>'
  );
  mpPips();
  if(win)setTimeout(function(){FX.fountain(window.innerWidth/2,window.innerHeight*0.4,30);},300);
}
function mpOppLeft(m){
  if(MP.state==='ended')return;   /* the match is over — a stale echo must not toast the final panel */
  toast('warn','coral','Opponent disconnected','Trying to reconnect for up to '+((m&&m.grace)||20)+'s…');
  mpOppStatus('RIVAL — RECONNECTING…',true);
}
function mpOppBack(){
  toast('check','green','Opponent is back','The match continues');
  mpOppStatus('',false);
}
/* ---------- reconnect & resume ----------
   Recovery is SINGLE-FLIGHT: a normal round transition, a result, the
   5-second gap or a "waiting for rival" period NEVER enters this flow.
   Only an actual socket close (or a 25s heartbeat silence) does, and it
   runs exactly one recovery flow at a time. */
function mpConnLost(){
  if(!MP.on)return;
  if(MP.state==='reconnecting')return;   /* one recovery flow at a time — never stacked retries */
  if(MP.state==='finding'||MP.state==='queue-wait'||MP.state==='room-pick'||MP.state==='room-host'||MP.state==='room-guest'||MP.state==='remwait'){
    if(MP.findT){clearTimeout(MP.findT);MP.findT=0;}
  if(MP.findT2){clearTimeout(MP.findT2);MP.findT2=0;}
    MP.state='idle';MP.on=false;
    mpViewError('CONNECTION PROBLEM','Lost the arena mid-search. Check your connection and try again.','TRY AGAIN');
    return;
  }
  if(MP.state==='ended'){mpLeave(false);return;}
  if(MP.state==='idle')return;
  MP.state='reconnecting';MP.retr=0;
  mpConnSet('bad','RECONNECTING');
  mpDbg('RECONNECT_START');
  mpViewReconnect();
  mpRetryConnect();
}
function mpRetryConnect(){
  if(MP.state!=='reconnecting')return;
  MP.retr++;
  if(MP.retr>4){
    mpDbg('RECONNECT_FAILURE');
    MP.state='idle';MP.on=false;
    try{sessionStorage.removeItem('mmx_mpresume');}catch(e){}
    mpViewError('CONNECTION LOST','The match could not be recovered. Jump back in with a new match!','NEW MATCH');
    return;
  }
  mpDbg('RECONNECT_TRY','attempt '+MP.retr);
  mpConnect(function(){
    if(MP.state!=='reconnecting')return;
    var rs=null;
    try{rs=JSON.parse(sessionStorage.getItem('mmx_mpresume')||'null');}catch(e){}
    if(!rs||!rs.m){mpResumeFail();return;}
    mpSend({t:'resume',m:rs.m,pid:rs.pid,nick:MMP.nick(),cc:MMP.cc()});
  },function(){setTimeout(mpRetryConnect,1200*MP.retr);});
}
function mpResumeOk(m){
  /* accepted from 'reconnecting' (real recovery) AND from 'roundend'
     (same-socket transition re-sync — the socket was never lost) */
  if(MP.state!=='reconnecting'&&MP.state!=='roundend')return;
  mpDbg('RECONNECT_SUCCESS','st='+m.st+' r='+m.r);
  mpConnSet('ok','IN MATCH');
  MP.seat=m.you;MP.opp=m.opp?mpParseOpp(m.opp):MP.opp;MP.rounds=m.rounds||5;MP.tot=(m.tot||[0,0]).slice();
  MP.nextAt=m.nextRoundAt||0;
  MP.lastEnd=null;
  if(m.st==='ended')return;                     /* the authoritative match_end is replayed right after */
  showScreen('game');
  $('hud-lvl-lbl').textContent='Round';
  $('btn-pause').style.visibility='hidden';
  var btnLeave=$('btn-mp-leave');
  if(btnLeave)btnLeave.classList.remove('hidden');
  mpOppShow();
  R.mode='versus';R.active=true;R.over=false;R.paused=false;
  R.maxLives=3;R.lives=3;mmResetHeartsShown();
  MP.active=true;
  if(m.st==='countdown'){
    MP.state='countdown';closeOv('ov-mp');
    renderHearts();updateHUD();mpOppReset();
    return;
  }
  if(m.st==='round'&&m.rs){
    var rs=m.rs,i;
    MP.round=rs.r;
    var revDur=rs.reveal||(rs.spec&&rs.spec.reveal)||1680;
    var recDur=rs.recall||(rs.spec&&rs.spec.recall)||5600;
    MP.win={reveal:revDur,recall:recDur};
    MP.state='playing';MP.dl=performance.now()+Math.max(2500,rs.deadlineLeft||2500);
    R.round=rs.r;R.level=rs.r;R.combo=0;R.bestCombo=0;R.misses=0;R.missThisLevel=0;
    beginRound(mpNormSpec(rs.r,rs.spec,revDur,recDur),rs.seed);     /* identical board — deterministic from seed */
    var f=rs.found||[],d=rs.decoy||[];
    for(i=0;i<f.length;i++){R.sel[f[i]]=1;R.found++;setTile(f[i],'ok',true);}
    for(i=0;i<d.length;i++){R.decoySel[d[i]]=1;R.decoysFound++;R.found++;setTile(d[i],'decoy ok',true);}
    R.ordQ=f.length;
    R.lives=rs.lives||3;renderHearts();
    R.score=mpMyTot()+(rs.score||0);setScore(R.score);mpMyScore(R.score);
    if(rs.yourDone){
      /* we had already finished this round before the drop — straight
         back to the roundwait state; the server result arrives soon */
      R.phase='clear';R.over=true;lockAll(true);
      MP.state='roundwait';
      setObj('Waiting for your rival…','go');
      mpOppStatus('RIVAL IS STILL PLAYING…',false);
      mpOppDone();
    }else{
      R.phase='recall';lockAll(false);
      setObj('Back in!  '+R.found+' / '+R.required,'go');
      R.lastTap=performance.now();
    }
    updateHUD();mpOppReset();
    closeOv('ov-mp');
    if(MP.raf)cancelAnimationFrame(MP.raf);
    if(MP.state==='playing')mpDeadline();
    mpSaveState();
    return;
  }
  if(m.st==='round_end'&&m.end){
    /* resume inside the 5-second transition: render the authoritative
       ROUND_RESULT immediately, then wait for the round at nextRoundAt */
    MP.active=false;
    R.active=false;R.over=true;R.phase='clear';
    R.score=mpMyTot();setScore(R.score);
    renderHearts();updateHUD();
    closeOv('ov-mp');
    mpRoundEnd({p:m.end});
    return;
  }
  /* unknown snapshot — fall back to the error panel */
  mpResumeFail();
}
function mpResumeFail(){
  try{sessionStorage.removeItem('mmx_mpresume');}catch(e){}
  MP.state='idle';MP.on=false;
  R.active=false;if(R.mode==='versus')R.over=true;
  mpViewError('CONNECTION LOST','The match could not be recovered. Jump back in with a new match!','NEW MATCH');
}
/* ---------- leaving / cleanup: every socket, timer and reference goes ---------- */
function mpLeave(toMenu){
  if(MP.active||(MP.state&&MP.state!=='idle')){
    mpSend({t:'leave'});
  }
  if(MP.a){clearTimeout(MP.a);MP.a=null;}
  if(MP.findT){clearTimeout(MP.findT);MP.findT=0;}
  if(MP.findT2){clearTimeout(MP.findT2);MP.findT2=0;}
  if(MP.cardT){clearTimeout(MP.cardT);MP.cardT=0;}
  if(MP.countT){clearInterval(MP.countT);MP.countT=0;}
  if(MP.endT){clearTimeout(MP.endT);MP.endT=0;}
  if(MP.nextT){clearTimeout(MP.nextT);MP.nextT=0;}
  if(MP.raf){cancelAnimationFrame(MP.raf);MP.raf=0;}
  if(MP.remT){clearTimeout(MP.remT);MP.remT=0;}
  MP.roomCode='';
  Plat.leaveRoom();
  mpCloseSock();
  mpSyncHide();
  try{sessionStorage.removeItem('mmx_mpresume');}catch(e){}
  if(R.mode==='versus'){R.active=false;R.over=true;R.phase='idle';clrT();lockAll(true);if(window.resetBoard)resetBoard();}
  MP.on=false;MP.active=false;MP.state='idle';
  MP.mid='';MP.pid='';MP.seat=0;MP.opp=null;MP.round=0;MP.tot=[0,0];MP.roundLog=[];MP.lastEnd=null;MP.nextAt=0;
  closeOv('ov-mp');
  closeOv('ov-mp-confirm');
  var btnLeave=$('btn-mp-leave');
  if(btnLeave)btnLeave.classList.add('hidden');
  var bar=$('mp-oppbar');
  if(bar)bar.classList.add('hidden');
  $('btn-pause').style.visibility='';
  Plat.gameplayStop();
  try{if(window.MU)MU.setScene('menu');}catch(e){}
  if(toMenu){showScreen('menu');refreshMenu();}
}
/* ---------- versus bar (you + rival, both with custom flag badges) ---------- */
function mpMyScore(v){var e=$('mpy-score');if(e)e.textContent=nf(v||0);}
function mpOppShow(){
  var bar=$('mp-oppbar');
  bar.classList.remove('hidden','dim','done');
  var op=MP.opp||{};
  $('mpy-flag').innerHTML=flagSVG(MMP.cc());
  $('mpy-name').textContent=MMP.nick()||'YOU';
  $('mpy-score').textContent='0';
  $('mpo-av').innerHTML=flagSVG(op.cc||'XX');
  $('mpo-name').textContent=op.nick||'RIVAL';
  $('mpo-score').textContent='0';
  mpOppReset();
}
function mpOppReset(){
  mpPips();
  var bar=$('mp-oppbar');
  bar.classList.remove('dim','done');
  var op=MP.opp||{};
  $('mpo-name').textContent=op.nick||'RIVAL';
  $('mpo-fill').style.width='0%';
  mpOppStatus('',false);
  var h='',i;
  for(i=0;i<3;i++)h+='<svg viewBox="0 0 24 24"><use href="#i-heart"/></svg>';
  $('mpo-hearts').innerHTML=h;
  if(MP.tot){$('mpo-score').textContent=nf(mpOppTot());$('mpy-score').textContent=nf(mpMyTot());}
}
function mpOppLive(m){
  if(!MP.active||m.r!==MP.round)return;
  mpOppLiveQueue(m);
}
function mpOppLivePaint(m){
  if(!MP.active||m.r!==MP.round)return;
  var bar=$('mp-oppbar');
  $('mpo-fill').style.width=(clamp(m.found/Math.max(1,m.req),0,1)*100)+'%';
  var h='',i;
  for(i=0;i<3;i++)h+='<svg class="'+(i<m.lives?'':'off')+'" viewBox="0 0 24 24"><use href="#i-heart"/></svg>';
  $('mpo-hearts').innerHTML=h;
  if(m.k==='miss'){bar.classList.remove('hit');void bar.offsetWidth;bar.classList.add('hit');}
}
function mpOppTotals(){if(MP.tot){$('mpo-score').textContent=nf(mpOppTot());$('mpy-score').textContent=nf(mpMyTot());}}
function mpOppDone(){var b=$('mp-oppbar');b.classList.add('done');$('mpo-fill').style.width='100%';}
/* status text lives in its own chip now — the rival nickname stays put */
function mpOppStatus(txt,dim){
  var bar=$('mp-oppbar'),st=$('mpo-status'),tr=bar?bar.querySelector('.mpo-row.opp .mpo-track'):null;
  bar.classList.toggle('dim',!!dim);
  if(txt){
    if(st){st.textContent=txt;st.classList.remove('hidden');}
    if(tr)tr.classList.add('hidden');
  }else{
    if(st)st.classList.add('hidden');
    if(tr)tr.classList.remove('hidden');
  }
}
/* fresh profile metadata relayed by the server — display-only refresh */
function mpOppProfileMsg(m){
  if(!m)return;
  MP.opp=MP.opp||{av:'robot',nick:'RIVAL',cc:'XX'};
  var nick=profCleanNick(m.nick!=null?String(m.nick):'');
  if(nick)MP.opp.nick=nick;
  if(m.cc!=null)MP.opp.cc=profValidCc(m.cc);
  if(MP.state==='idle')return;
  var av=$('mpo-av');if(av)av.innerHTML=flagSVG(MP.opp.cc);
  var nm=$('mpo-name');if(nm)nm.textContent=MP.opp.nick;
  if(MP.state==='countdown'&&$('ov-mp')&&$('ov-mp').classList.contains('on'))mpViewFound();
}
/* ---------- round-transition SYNC animation (visual only) ----------
   Shown between ROUND_RESULT and the next ROUND_START / FINAL_RESULT.
   Purely cosmetic: timing is derived from the server's nextRoundAt, and
   the failsafe logic below is untouched. */
var MP_SYNC={raf:0,t0:0,dur:5000};
function mpSyncShow(isFinal,nextAtLocal){
  var ov=$('mp-sync');if(!ov)return;
  var title=$('mp-sync-title'),sub=$('mp-sync-sub'),cnt=$('mp-sync-count');
  var now=Date.now();
  var dur=nextAtLocal?Math.max(1500,nextAtLocal-now):5000;
  if(isFinal){
    if(title)title.textContent='CALCULATING FINAL RESULT…';
    if(sub)sub.textContent='The server is deciding the winner';
  }else{
    if(title)title.textContent='SYNCING NEXT ROUND…';
    if(sub)sub.textContent='Both scores are in — building the next pattern';
  }
  MP_SYNC.t0=now;MP_SYNC.dur=Math.min(dur,12000);
  ov.classList.add('show');
  mpConnSet('warn',isFinal?'FINAL…':'SYNCING');
  if(MP_SYNC.raf)cancelAnimationFrame(MP_SYNC.raf);
  var step=function(){
    var fill=$('mp-sync-fill'),dots=$('mp-sync-dots');
    var k=Math.min(1,(Date.now()-MP_SYNC.t0)/MP_SYNC.dur);
    if(fill)fill.style.width=(k*100)+'%';
    if(dots){
      var ch=dots.children,n=Math.floor(k*ch.length+0.001),i;
      for(i=0;i<ch.length;i++)ch[i].className=(i<n?'on':'');
    }
    if(cnt)cnt.textContent=isFinal?'':'NEXT ROUND IN '+Math.max(1,Math.ceil((MP_SYNC.dur-(Date.now()-MP_SYNC.t0))/1000))+'s';
    if(k<1&&ov.classList.contains('show')){MP_SYNC.raf=requestAnimationFrame(step);}
    else MP_SYNC.raf=0;
  };
  MP_SYNC.raf=requestAnimationFrame(step);
}
function mpSyncHide(){
  var ov=$('mp-sync');
  if(ov)ov.classList.remove('show');
  if(MP_SYNC.raf){cancelAnimationFrame(MP_SYNC.raf);MP_SYNC.raf=0;}
}
/* ---------- connection status pill (in the versus bar) ---------- */
function mpConnSet(st,txt){
  var el=$('mpo-conn'),t=$('mpo-conn-txt');
  if(!el)return;
  el.classList.remove('ok','warn','bad');
  el.classList.add(st==='ok'?'ok':(st==='bad'?'bad':'warn'));
  if(t&&txt)t.textContent=txt;
}
/* ---------- round pips: per-round W/L/D from this client's view ---------- */
function mpPips(){
  var el=$('mpo-pips');if(!el)return;
  var maxR=MP.rounds||5,h='',i;
  for(i=0;i<maxR;i++){
    var cls='';
    if(MP.roundLog&&MP.roundLog[i]){
      var e=MP.roundLog[i];
      cls=(e.y>e.o)?'w':((e.y<e.o)?'l':'d');
    }
    h+='<i class="'+cls+'"></i>';
  }
  el.innerHTML=h;
}
/* ---------- smooth live rival updates: coalesce bursts via rAF ---------- */
var MP_OPPQ=null,MP_OPPRAF=0;
function mpOppLiveQueue(m){
  MP_OPPQ={r:m.r,found:m.found,req:m.req,lives:m.lives,k:m.k};
  if(MP_OPPRAF)return;
  MP_OPPRAF=requestAnimationFrame(function(){
    MP_OPPRAF=0;
    var q=MP_OPPQ;MP_OPPQ=null;
    if(q)mpOppLivePaint(q);
  });
}

/* ---------- panels ---------- */
function mpPanel(html){$('mp-panel').innerHTML=html;openOv('ov-mp');}
function mpViewFinding(sub){
  mpPanel(
    '<div class="go-hero sky"><svg class="ic"><use href="#i-globe"/></svg></div>'+
    '<h2 style="font-family:var(--fd);font-weight:800;font-size:1.4rem;text-align:center;letter-spacing:.04em">FINDING OPPONENT&hellip;</h2>'+
    '<div class="mp-dots"><span></span><span></span><span></span></div>'+
    '<div class="mp-tiles"><i class="lt lt1"></i><i class="lt lt2"></i><i class="lt lt3"></i><i class="lt lt4"></i></div>'+
    '<div id="mp-chip">'+mpYouChipHTML()+'</div>'+
    '<p class="ov-sub mp-subnote" id="mp-sub">'+esc(sub)+'</p>'+
    '<div class="ov-stack"><button class="btn white wide" data-act="cancel"><svg class="ic"><use href="#i-x"/></svg>Cancel</button></div>'
  );
}
function mpViewFound(){
  mpPanel(
    versusHTML(false)+
    '<h2 style="font-family:var(--fd);font-weight:800;font-size:1.5rem;text-align:center">OPPONENT FOUND!</h2>'+
    '<p class="ov-sub">'+MP.rounds+' rounds &middot; same pattern, same clock &mdash; highest total wins</p>'
  );
}
function mpViewError(title,sub,btn){
  mpPanel(
    '<div class="go-hero coral"><svg class="ic"><use href="#i-warn"/></svg></div>'+
    '<h2 style="font-family:var(--fd);font-weight:800;font-size:1.35rem;text-align:center">'+title+'</h2>'+
    '<p class="ov-sub">'+sub+'</p>'+
    '<div class="ov-stack">'+
      '<button class="btn big wide" data-act="retry"><svg class="ic"><use href="#i-retry"/></svg>'+btn+'</button>'+
      '<button class="btn white wide" data-act="home"><svg class="ic"><use href="#i-home"/></svg>Home</button>'+
    '</div>'
  );
}
function mpViewReconnect(){
  mpPanel(
    '<div class="go-hero sky"><svg class="ic"><use href="#i-globe"/></svg></div>'+
    '<h2 style="font-family:var(--fd);font-weight:800;font-size:1.35rem;text-align:center">CONNECTION HICCUP</h2>'+
    '<p class="ov-sub">Reconnecting to your match&hellip;</p>'+
    '<div class="mp-spin"></div>'+
    '<p class="ov-sub mp-subnote">Your match is safe for a few seconds</p>'
  );
}
/* =========================================================
   PART 4B — PRIVATE ROOMS + SAME-RIVAL REMATCH + CG INVITES
   ---------------------------------------------------------
   New MP.state values: room-pick (create/join panel), room-host
   (waiting for a friend), room-guest (join flight), remwait
   (rematch vote pending). Random matchmaking + all in-match code
   above is untouched; these flows only feed INTO mpOnMatched.
   Platform calls go through the guarded Plat bridge.
   ========================================================= */

/* ---------- online entry helper (tutorial gate + profile, then next) ---------- */
function mpEntryFlow(next){
  if(MP.state!=='idle')return;
  var go=function(){
    if(MP.state!=='idle')return;
    if(!MMP.has())PROFUI.open('create',function(){next();});
    else next();
  };
  if(window.mmGateTut)window.mmGateTut('online',go);
  else go();
}

/* ---------- Platform auto-entry (room invites) ---------- */
var MM_PLAT_READY=false,MM_MENU_UP=false;
function mmPlatReady(){
  MM_PLAT_READY=true;
  try{Plat.onJoinRoom(mmInviteJoin);}catch(e){}
  mmMaybeAuto();
}
function mmBootMenu(){
  MM_MENU_UP=true;
  mmMaybeAuto();
}
function mmMaybeAuto(){
  if(!MM_PLAT_READY||!MM_MENU_UP)return;
  if(MP.state!=='idle')return;
  /* invite link / notification accepted while loading → join that room */
  var ip=null;
  try{ip=Plat.inviteParams();}catch(e){}
  var code=ip&&(ip.room||ip.roomName||ip.code);
  if(code)MP.pendRoom=String(code).trim().toUpperCase();
  if(MP.pendRoom){mmJoinPending();return;}
  /* multiplayer landing page → straight into online (tutorial still
     gates first, but it is skippable per the CG requirements) */
  var inst=false;
  try{inst=Plat.isInstant();}catch(e2){}
  if(inst)mpEntryFlow(function(){mpFind();});
}
/* a friend invited / joined while the game is already running */
function mmInviteJoin(params){
  var code=params&&(params.room||params.roomName||params.code);
  if(!code)return;
  code=String(code).trim().toUpperCase();
  MP.pendRoom=code;
  if(!MM_MENU_UP)return;                       /* boot will pick it up */
  if(MP.state==='idle'&&!MP.on){mmJoinPending();return;}
  if(MP.state==='room-pick'){                 /* already on the room screen — fill the code, one tap to join */
    try{var _ri=$('mp-room-code');if(_ri)_ri.value=code;}catch(e){}
    toast('chip','sky','Invite code filled','Hit Join to play with your friend!');
    return;
  }
  toast('chip','sky','Room invite received','Finish up, then PLAY ONLINE to join '+code+'.');
}
function mmJoinPending(){
  var code=MP.pendRoom;
  if(!code||MP.state!=='idle')return;
  mpEntryFlow(function(){
    if(MP.state!=='idle')return;
    MP.pendRoom='';
    MP.on=true;MP.state='room-pick';
    mpConnSet('warn','PRIVATE ROOM');
    mpViewRoom();
    try{var inp=$('mp-room-code');if(inp)inp.value=code;}catch(e){}
    mpRoomJoin(code);
  });
}

/* ---------- private room flows ---------- */
function mpRoomPick(){
  if(MP.state!=='idle')return;
  MP.on=true;MP.state='room-pick';
  mpConnSet('warn','PRIVATE ROOM');
  mpViewRoom();
}
function mpRoomEnsureSocket(next){
  mpConnect(function(){if(next)next();},function(){
    MP.state='idle';MP.on=false;
    mpViewError('CONNECTION PROBLEM','Could not reach the arena. Check your connection and try again.','TRY AGAIN');
  });
}
function mpRoomCreate(){
  if(MP.state!=='room-pick')return;
  mpRoomEnsureSocket(function(){
    if(MP.state!=='room-pick')return;
    mpSend({t:'create_room',av:mpAv(),nick:MMP.nick(),cc:MMP.cc()});
  });
}
function mpRoomJoin(code){
  code=String(code||'').trim().toUpperCase();
  if(MP.state!=='room-pick')return;
  if(!code){toast('warn','coral','Enter the room code','Type the 6-letter code your friend is hosting.');return;}
  mpRoomEnsureSocket(function(){
    if(MP.state!=='room-pick')return;
    mpSend({t:'join_room',code:code,av:mpAv(),nick:MMP.nick(),cc:MMP.cc()});
    mpViewFinding('Joining room '+esc(code)+'…');
  });
}
function mpRoomCancel(){
  A.btn();
  mpSend({t:'leave_room'});
  Plat.leaveRoom();
  MP.roomCode='';
  MP.state='idle';                              /* socket stays warm for the next pick */
  mpViewChoice();
}
function mpRoomCreated(m){
  if(MP.state!=='room-pick'&&MP.state!=='room-host')return;
  MP.state='room-host';MP.roomCode=(m&&m.code)||'';
  Plat.updateRoom(MP.roomCode,true,{room:MP.roomCode});
  mpViewRoomHost(MP.roomCode);
}
function mpRoomJoined(m){
  if(MP.state!=='room-pick'&&MP.state!=='room-guest')return;
  MP.state='room-guest';MP.roomCode=(m&&m.code)||'';
  if(m&&m.mate)MP.opp=mpParseOpp(m.mate);
  Plat.updateRoom(MP.roomCode,false);
  mpViewFinding('Rival found — starting…');    /* `matched` follows immediately */
}
function mpRoomMate(m){
  if(MP.state!=='room-host')return;
  if(m&&m.mate)MP.opp=mpParseOpp(m.mate);
  Plat.updateRoom(MP.roomCode,false);
  toast('chip','sky','Friend joined!','Starting your match…');
  mpViewFound();
}
function mpRoomLeft(m){
  if(MP.state==='room-host'||MP.state==='room-guest'||MP.state==='room-pick'){
    Plat.leaveRoom();MP.roomCode='';MP.state='idle';mpViewChoice();
  }
}
function mpRoomGone(m){
  Plat.leaveRoom();MP.roomCode='';
  if(MP.state==='room-host'||MP.state==='room-guest'){
    MP.state='idle';
    toast('warn','coral','Room closed','Your friend left — pick another way to play.');
    mpViewChoice();
  }else if(MP.state==='room-pick'){
    MP.state='idle';
    mpViewError('ROOM NOT FOUND','That code is wrong or the room expired. Check it and try again!','TRY AGAIN');
  }
  /* any other state: stale echo — ignore */
}
function mpRoomFull(m){
  if(MP.state!=='room-pick'&&MP.state!=='room-guest')return;
  Plat.leaveRoom();MP.roomCode='';MP.state='idle';
  mpViewError('ROOM IS FULL','Someone else joined that room first. Create your own instead!','TRY AGAIN');
}

/* ---------- same-rival rematch ---------- */
function mpRematch(){
  if(MP.state!=='ended')return;
  /* walkover finals have no rival left to rematch — offer a fresh game */
  if(MP.lastReason&&MP.lastReason!=='completed'){mpRemToRandom();return;}
  if(!MP.ws||MP.ws.readyState!==1||!MP.mid){mpRemToRandom();return;}
  MP.state='remwait';
  mpSend({t:'rematch',m:MP.mid});
  if(MP.remT)clearTimeout(MP.remT);
  MP.remT=setTimeout(function(){MP.remT=0;mpRematchDead();},25000);
  mpViewRemWait();
}
function mpRemToRandom(){
  if(MP.remT){clearTimeout(MP.remT);MP.remT=0;}
  mpLeave(false);
  MP.state='idle';MP.on=false;
  mpFind();
}
function mpRematchDead(){
  if(MP.state!=='remwait')return;
  if(MP.remT){clearTimeout(MP.remT);MP.remT=0;}
  toast('warn','coral','Rival is gone','Pick a new way to play.');
  mpRemToRandom();
}
function mpRematchOffer(){
  if(MP.state!=='ended')return;                /* only meaningful on the final panel */
  toast('chip','sky','Rival wants a rematch!','Tap REMATCH to run it back.');
}

/* ---------- room / rematch panels ---------- */
function mpViewChoice(){
  mpPanel(
    '<div class="go-hero sky"><svg class="ic"><use href="#i-globe"/></svg></div>'+
    '<h2 style="font-family:var(--fd);font-weight:800;font-size:1.4rem;text-align:center;letter-spacing:.04em">PLAY ONLINE</h2>'+
    '<div class="mp-tiles"><i class="lt lt1"></i><i class="lt lt2"></i><i class="lt lt3"></i><i class="lt lt4"></i></div>'+
    '<div id="mp-chip">'+mpYouChipHTML()+'</div>'+
    '<p class="ov-sub mp-subnote">5 rounds &middot; same pattern, same clock &mdash; highest total wins</p>'+
    '<div class="ov-stack">'+
      '<button class="btn big wide" data-act="random"><svg class="ic"><use href="#i-globe"/></svg>Find a rival</button>'+
      '<button class="btn white wide" data-act="room"><svg class="ic"><use href="#i-users"/></svg>Private room</button>'+
      '<button class="btn white wide" data-act="cancel"><svg class="ic"><use href="#i-x"/></svg>Cancel</button>'+
    '</div>'
  );
}
function mpViewRoom(){
  var pre='';
  try{pre=MP.pendRoom?esc(MP.pendRoom):'';}catch(e){}
  mpPanel(
    '<div class="go-hero sky"><svg class="ic"><use href="#i-users"/></svg></div>'+
    '<h2 style="font-family:var(--fd);font-weight:800;font-size:1.4rem;text-align:center;letter-spacing:.04em">PRIVATE ROOM</h2>'+
    '<div id="mp-chip">'+mpYouChipHTML()+'</div>'+
    '<p class="ov-sub mp-subnote">Create a room and share the 6-letter code with a friend — the match starts as soon as they join.</p>'+
    '<div class="ov-stack">'+
      '<button class="btn big wide" data-act="room-create"><svg class="ic"><use href="#i-play"/></svg>Create room</button>'+
      '<div style="display:flex;gap:.5em;align-items:stretch">'+
        '<input id="mp-room-code" maxlength="6" placeholder="CODE" value="'+pre+'" autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false" style="flex:1;min-width:0;text-align:center;text-transform:uppercase;letter-spacing:.25em;font:inherit;font-weight:800;padding:.55em .3em;border-radius:.6em;border:2px solid var(--line,#dfe6f2);background:#fff;color:#233;">'+
        '<button class="btn" data-act="room-join" style="white-space:nowrap">Join</button>'+
      '</div>'+
      '<button class="btn white wide" data-act="pick-back"><svg class="ic"><use href="#i-home"/></svg>Back</button>'+
    '</div>'
  );
  /* Enter joins — no mouse needed; focus the code box for instant typing */
  try{
    var _ri=$('mp-room-code');
    if(_ri){
      _ri.addEventListener('keydown',function(ev){
        if(ev.key==='Enter'){ev.preventDefault();mpRoomJoin(_ri.value);}
      });
      setTimeout(function(){try{_ri.focus({preventScroll:true});}catch(e){try{_ri.focus();}catch(e2){}}},240);
    }
  }catch(e){}
}
function mpViewRoomHost(code){
  mpPanel(
    '<div class="go-hero sky"><svg class="ic"><use href="#i-users"/></svg></div>'+
    '<h2 style="font-family:var(--fd);font-weight:800;font-size:1.3rem;text-align:center;letter-spacing:.04em">WAITING FOR FRIEND</h2>'+
    '<div style="font-family:var(--fd);font-weight:800;font-size:2.6rem;text-align:center;letter-spacing:.3em;text-indent:.3em;margin:.15em 0">'+esc(code||'')+'</div>'+
    '<div class="mp-dots"><span></span><span></span><span></span></div>'+
    '<p class="ov-sub mp-subnote">Share the code — the match starts the moment your friend joins.</p>'+
    '<div class="ov-stack"><button class="btn sky wide" data-act="room-copy"><svg class="ic"><use href="#i-spark"/></svg>Copy code</button>'+
    '<button class="btn white wide" data-act="room-cancel"><svg class="ic"><use href="#i-x"/></svg>Cancel</button></div>'
  );
}
function mpRoomCopy(){
  var code=MP.roomCode||'';
  if(!code)return;
  A.btn();
  var done=function(ok){
    if(ok)toast('chip','sky','Code copied','Send '+code+' to your friend!');
    else toast('warn','coral','Copy failed','Your code is '+code+' — type it manually.');
  };
  try{
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(code).then(function(){done(true);},function(){done(false);});
    }else{
      var ta=document.createElement('textarea');
      ta.value=code;ta.style.position='fixed';ta.style.opacity='0';
      document.body.appendChild(ta);ta.select();
      var ok=false;try{ok=document.execCommand('copy');}catch(e){}
      document.body.removeChild(ta);done(ok);
    }
  }catch(e){done(false);}
}
function mpViewRemWait(){
  mpPanel(
    '<div class="go-hero sky"><svg class="ic"><use href="#i-retry"/></svg></div>'+
    '<h2 style="font-family:var(--fd);font-weight:800;font-size:1.35rem;text-align:center">REMATCH?</h2>'+
    '<div class="mp-dots"><span></span><span></span><span></span></div>'+
    '<p class="ov-sub mp-subnote">Waiting for your rival…</p>'+
    '<div class="ov-stack"><button class="btn white wide" data-act="rem-cancel"><svg class="ic"><use href="#i-globe"/></svg>Find new rival instead</button></div>'
  );
}

function maxHideCard(){var el=$('mp-round');if(el)el.classList.remove('show');}
function mpRoundCard(p){
  var el=$('mp-round');
  var lbl=function(r){return r==='clear'?'CLEARED':(r==='dead'?'OUT OF HEARTS':'TIME UP');};
  var yn=shortNick(MMP.nick(),'YOU'),on=shortNick(MP.opp?MP.opp.nick:'','RIVAL');
  var maxR=MP.rounds||5;
  var yb=(p.you&&p.you.finishBonus)?p.you.finishBonus:0;
  var ob=(p.opp&&p.opp.finishBonus)?p.opp.finishBonus:0;
  var yScore=(p.you?p.you.score:0)+yb;
  var oScore=(p.opp?p.opp.score:0)+ob;
  var ySub=lbl(p.you?p.you.reason:'')+(yb>0?' &middot; +'+yb+' spd':'');
  var oSub=lbl(p.opp?p.opp.reason:'')+(ob>0?' &middot; +'+ob+' spd':'');
  var verdict=(yScore>oScore)?'<div class="mpr-verdict w">YOU TAKE ROUND '+p.r+'!</div>':((yScore<oScore)?'<div class="mpr-verdict l">RIVAL TAKES ROUND '+p.r+'</div>':'<div class="mpr-verdict d">ROUND '+p.r+' DRAW!</div>');
  el.classList.remove('win','lose','draw');
  el.classList.add((yScore>oScore)?'win':((yScore<oScore)?'lose':'draw'));
  el.innerHTML='<div class="mpr-head">ROUND '+p.r+' / '+maxR+'</div>'+verdict+
    '<div class="mpr-who">'+
      flagBadgeHTML(MMP.cc(),'xs')+'<span class="mpr-n">'+yn+'</span>'+
      '<b>VS</b>'+
      '<span class="mpr-n opp">'+on+'</span>'+flagBadgeHTML(MP.opp?MP.opp.cc:'XX','xs')+
    '</div>'+
    '<div class="mpr-row">'+
      '<div class="plate"><span class="lbl">'+yn+' &middot; '+ySub+'</span><span class="val">+'+nf(yScore)+'</span></div>'+
      '<div class="plate"><span class="lbl">'+on+' &middot; '+oSub+'</span><span class="val">+'+nf(oScore)+'</span></div>'+
    '</div>'+
    '<div class="mpr-tot">You '+nf(mpPayMy(p))+' &mdash; '+nf(mpPayOpp(p))+' Rival</div>';
  el.classList.remove('show');void el.offsetWidth;el.classList.add('show');
  try{
    var myEl=$('mpy-score'),opEl=$('mpo-score');
    if(myEl){myEl.classList.remove('bump');void myEl.offsetWidth;}
    if(opEl){opEl.classList.remove('bump');void opEl.offsetWidth;}
  }catch(e0){}
  if(MP.cardT)clearTimeout(MP.cardT);
  MP.cardT=setTimeout(function(){el.classList.remove('show');},2350);
  if(yScore>oScore)A.star(2);else if(yScore<oScore)A.bad();else A.btn();
}

/* =========================================================
   PART 5 — WIRING & EXPORTS
   ---------------------------------------------------------
   DOM is ready (this file is loaded at the end of <body>,
   before game.js). Everything here only touches the DOM and
   this file's own functions; gameplay objects (A, R, S, FX…)
   are reached later, at click time, through the bridge that
   game.js publishes on window.
   ========================================================= */
(function(){
  MMP.load();

  /* the versus bar starts hidden */
  var bar=$('mp-oppbar');
  if(bar)bar.classList.add('hidden');

  /* overlay panel actions (matchmaking / countdown / result screens) */
  var ovm=$('ov-mp');
  if(ovm)ovm.addEventListener('click',function(e){
    var b=e.target.closest?e.target.closest('[data-act]'):null;
    if(!b)return;
    beep();
    var act=b.getAttribute('data-act');
    if(act==='cancel'){if(MP.state==='room-host'||MP.state==='room-guest')mpRoomCancel();else mpCancel();}
    else if(act==='retry'){MP.state='idle';MP.on=false;ovClose('ov-mp');mpFind();}
    else if(act==='home')mpLeave(true);
    else if(act==='rematch')mpRematch();
    else if(act==='random')mpFindRandom();
    else if(act==='room')mpRoomPick();
    else if(act==='pick-back'){MP.state='idle';mpViewChoice();}
    else if(act==='room-create')mpRoomCreate();
    else if(act==='room-join'){var _ci=$('mp-room-code');mpRoomJoin(_ci?_ci.value:'');}
    else if(act==='room-cancel')mpRoomCancel();
    else if(act==='room-copy')mpRoomCopy();
    else if(act==='rem-cancel')mpRemToRandom();
    else if(act==='editprof'){PROFUI.open('edit',function(){mpChipRefresh();});}
  });

  /* PLAY ONLINE — brand-new players get the interactive tutorial first,
     then create their profile, then queue (all gated, in order) */
  var bo=$('btn-online');
  if(bo)bo.addEventListener('click',function(){
    beep();
    mpEntryFlow(function(){mpFind();});
  });

  /* settings row — EDIT PROFILE any time later */
  var sp=$('set-profile');
  if(sp)sp.addEventListener('click',function(){
    beep();
    PROFUI.open(MMP.has()?'edit':'create',null);
  });

  /* profile form */
  var nick=$('prof-nick');
  if(nick){
    nick.addEventListener('input',function(){PROFUI.hideErr();PROFUI.refresh();});
    nick.addEventListener('keydown',function(e){
      if(e.key==='Enter'){e.preventDefault();PROFUI.commit();}
    });
  }
  var inwrap=$('prof-inwrap');
  if(inwrap&&nick){
    nick.addEventListener('focus',function(){inwrap.classList.add('focus');});
    nick.addEventListener('blur',function(){inwrap.classList.remove('focus');});
  }
  var pc=$('prof-country');
  if(pc)pc.addEventListener('click',function(){beep();PROFUI.openPicker();});
  var cont=$('prof-continue');
  if(cont)cont.addEventListener('click',function(){beep();PROFUI.commit();});
  var canc=$('prof-cancel');
  if(canc)canc.addEventListener('click',function(){beep();PROFUI.close();});
  var profOv=$('ov-profile');
  if(profOv)profOv.addEventListener('click',function(e){
    if(e.target===profOv&&PROFUI.mode==='edit')PROFUI.close();  /* creation is mandatory — no backdrop dismiss */
  });

  /* country picker */
  var cq=$('cty-q');
  if(cq)cq.addEventListener('input',function(){ctyRender(cq.value);});
  if(cq)cq.addEventListener('keydown',function(e){if(e.key==='Enter')e.preventDefault();});
  var cl=$('cty-list');
  if(cl)cl.addEventListener('click',function(e){
    var b=e.target.closest?e.target.closest('.cty-row'):null;
    if(!b)return;
    PROFUI.pick(b.getAttribute('data-cc'));
  });
  var cx=$('cty-x');
  if(cx)cx.addEventListener('click',function(){beep();PROFUI.closePicker();});
  var ctyOv=$('ov-country');
  if(ctyOv)ctyOv.addEventListener('click',function(e){if(e.target===ctyOv)PROFUI.closePicker();});

  /* desktop conveniences (mobile never sends these) */
  var confOv=$('ov-mp-confirm');
  document.addEventListener('keydown',function(e){
    if(e.key!=='Escape')return;
    if(confOv&&confOv.classList.contains('on')){closeOv('ov-mp-confirm');return;}
    if(ctyOv&&ctyOv.classList.contains('on')){PROFUI.closePicker();return;}
    if(profOv&&profOv.classList.contains('on')&&PROFUI.mode==='edit')PROFUI.close();
  });

  /* in-match leave button + confirmation modal */
  var btnMpLeave=$('btn-mp-leave');
  if(btnMpLeave){
    btnMpLeave.addEventListener('click',function(){
      beep();
      openOv('ov-mp-confirm');
    });
  }
  var btnMpStay=$('btn-mp-stay');
  if(btnMpStay){
    btnMpStay.addEventListener('click',function(){
      beep();
      closeOv('ov-mp-confirm');
    });
  }
  var btnMpLeaveConf=$('btn-mp-leave-confirm');
  if(btnMpLeaveConf){
    btnMpLeaveConf.addEventListener('click',function(){
      beep();
      closeOv('ov-mp-confirm');
      mpLeave(true);
    });
  }

  profRefreshSettingsRow();
})();

/* ---------- exports consumed by game.js (guarded call sites) ---------- */
window.MP=MP;
window.mpHandleTap=mpHandleTap;
window.mpLeave=mpLeave;
window.mpFind=mpFind;
window.mmBootMenu=mmBootMenu;
window.mmPlatReady=mmPlatReady;
window.mpRoomCopy=mpRoomCopy;
/* small public API — handy for debugging and future UI hooks */
window.MMOnline={
  seat:mpSeat,myTot:mpMyTot,oppTot:mpOppTot,
  profile:MMP,
  openProfile:function(mode,cb){PROFUI.open(mode||'edit',cb||null);},
  flagSVG:flagSVG,flagBadge:flagBadgeHTML,countryName:ctyName,
  sanitizeNick:profCleanNick,validCc:profValidCc,
  dispatch:mpMsg
};
})();
