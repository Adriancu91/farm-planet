// Farm Planet — game data (all prices, recipes, unlock levels). Edit numbers here to rebalance the game.
export const SAVE_KEY = 'farmplanet_v1';

// ---------- crops (grown on plots) ----------
export const CROPS = {
  morcov:  {n:'Morcov',  e:'🥕', cost:2,  t:20,  v:3,  lv:1, st:['crops_leafsStageA','crop_carrot'], sc:1.5},
  grau:    {n:'Grâu',    e:'🌾', cost:3,  t:28,  v:4,  lv:1, st:['crops_wheatStageA','crops_wheatStageB'], sc:1.7},
  salata:  {n:'Salată',  e:'🥬', cost:4,  t:35,  v:6,  lv:2, st:['crops_leafsStageA','crops_leafsStageB'], sc:1.4},
  nap:     {n:'Nap',     e:'🧅', cost:5,  t:40,  v:7,  lv:3, st:['crops_leafsStageA','crop_turnip'], sc:1.5},
  porumb:  {n:'Porumb',  e:'🌽', cost:6,  t:50,  v:10, lv:3, st:['crops_cornStageA','crops_cornStageB','crops_cornStageC','crops_cornStageD'], sc:1.5},
  trestie: {n:'Trestie de zahăr', e:'🎋', cost:7, t:55, v:11, lv:6, st:['crops_bambooStageA','crops_bambooStageB'], sc:1.6},
  pepene:  {n:'Pepene',  e:'🍉', cost:8,  t:65,  v:15, lv:5, st:['crops_leafsStageA','crop_melon'], sc:1.8},
  dovleac: {n:'Dovleac', e:'🎃', cost:10, t:80,  v:20, lv:7, st:['crops_leafsStageA','crop_pumpkin'], sc:1.9},
};

// ---------- greenhouse (seră) exotic crops ----------
export const EXOTIC = {
  capsuni: {n:'Căpșuni',   e:'🍓', cost:8,  t:60,  v:18, lv:5, col:0xe8304a},
  rosii:   {n:'Roșii',     e:'🍅', cost:9,  t:70,  v:20, lv:5, col:0xd8402e},
  ardei:   {n:'Ardei',     e:'🫑', cost:10, t:80,  v:24, lv:6, col:0x3fa63a},
  struguri:{n:'Struguri',  e:'🍇', cost:14, t:110, v:34, lv:8, col:0x7b3fa0},
  trandafiri:{n:'Trandafiri', e:'🌹', cost:16, t:120, v:40, lv:9, col:0xe02050},
  cacao:   {n:'Cacao',     e:'🍫', cost:22, t:160, v:60, lv:11, col:0x7a4a2a},
};

// ---------- animals ----------
// species: base model + production. Each species has 4 rarities (variants) for the collection catalog.
export const RARITY = [
  {id:0, n:'Comun',     c:'#8d8d8d', w:68, mult:1,   sell:1},
  {id:1, n:'Rar',       c:'#3fa9f5', w:22, mult:1.6, sell:3},
  {id:2, n:'Epic',      c:'#b06cff', w:8,  mult:2.6, sell:8},
  {id:3, n:'Legendar',  c:'#ffb300', w:2,  mult:5,   sell:25},
];
export const ANIMALS = {
  gaina:   {n:'Găină',    e:'🐔', w:26, f:'chicken', h:.5,  walk:'Walk', idle:'Idle', sp:.8, price:25, prod:{id:'oua',e:'🥚',n:'Ouă',v:4,t:30},
            var:['Găină','Găină neagră','Găină de zăpadă','Găină de aur'], tint:[null,0x2a2a2e,0xf4f6ff,0xffcc33]},
  cocos:   {n:'Cocoș',    e:'🐓', w:16, f:'rooster', h:.62, walk:'Walking', idle:'Idle', sp:.8, price:30, prod:{id:'pene',e:'🪶',n:'Pene',v:5,t:35},
            var:['Cocoș','Cocoș albastru','Cocoș curcubeu','Cocoș de foc'], tint:[null,0x3f7fe8,0xb06cff,0xff5a1f]},
  porc:    {n:'Purceluș', e:'🐷', w:14, f:'pig',   h:.8,  price:60, prod:{id:'trufe',e:'🍄',n:'Trufe',v:12,t:55},
            var:['Purceluș','Purceluș pătat','Purceluș mov','Purceluș de aur'], tint:[null,0x8a6a5a,0xc49cff,0xffcc33]},
  oaie:    {n:'Oiță',     e:'🐑', w:13, f:'sheep', h:1.0, price:55, prod:{id:'lana',e:'🧶',n:'Lână',v:10,t:50},
            var:['Oiță','Oiță neagră','Oiță roz','Oiță de nor'], tint:[null,0x3a3a3e,0xffa6d0,0xbfe8ff]},
  catel:   {n:'Cățel',    e:'🐶', w:9,  f:'pug',   h:.55, sp:1.3, price:70, prod:{id:'comori',e:'🦴',n:'Comori',v:14,t:60},
            var:['Cățel','Cățel ciocolată','Cățel alb','Cățel de aur'], tint:[null,0x6b4226,0xf6f2ea,0xffcc33]},
  vaca:    {n:'Văcuță',   e:'🐄', w:9,  f:'cow',   h:1.45, price:90, prod:{id:'lapte',e:'🥛',n:'Lapte',v:15,t:60},
            var:['Văcuță','Văcuță de ciocolată','Văcuță cu căpșuni','Văcuță galactică'], tint:[null,0x7a4a2a,0xff9ec4,0x5a4fd8]},
  cal:     {n:'Căluț',    e:'🐴', w:6,  f:'horse', h:1.65, price:150, prod:{id:'trifoi',e:'🍀',n:'Trifoi norocos',v:25,t:80},
            var:['Căluț','Căluț alb','Căluț negru','Cal de foc'], tint:[null,0xf2efe8,0x26262a,0xff5a1f]},
  lama:    {n:'Lamă',     e:'🦙', w:5,  f:'llama', h:1.75, price:180, prod:{id:'lanafina',e:'🎀',n:'Lână fină',v:30,t:80},
            var:['Lamă','Lamă albastră','Lamă turcoaz','Lamă de aur'], tint:[null,0x72b8ff,0x40d0c0,0xffcc33]},
  zebra:   {n:'Zebră',    e:'🦓', w:3,  f:'zebra', h:1.5,  price:260, prod:{id:'dungi',e:'🎨',n:'Dungi magice',v:45,t:90},
            var:['Zebră','Zebră roz','Zebră de gheață','Zebră curcubeu'], tint:[null,0xff9ec4,0x9fe0ff,0xb06cff]},
  unicorn: {n:'Unicorn',  e:'🦄', w:1,  f:'horse', h:1.7, uni:true, price:600, prod:{id:'praf',e:'🌈',n:'Praf magic',v:100,t:120},
            var:['Unicorn','Unicorn roz','Unicorn de noapte','Unicorn ceresc'], tint:[null,0xffb6dd,0x3a2f7a,0xffe680]},
  slime:   {n:'Slime',    e:'🟢', w:2,  f:'slime', h:.7, mythic:true, walk:'Walk', idle:'Idle', price:400, prod:{id:'gelatina',e:'🫧',n:'Gelatină magică',v:70,t:100},
            var:['Slime verde','Slime albastru','Slime roz','Slime de aur'], tint:[null,0x4f9cff,0xff7ac0,0xffcc33]},
  dragon:  {n:'Pui de dragon', e:'🐉', w:.6, f:'dragon', h:.95, mythic:true, fly:true, walk:'Flying', idle:'Flying', price:1500, prod:{id:'solzi',e:'💎',n:'Solzi de dragon',v:220,t:150},
            var:['Dragon roșu','Dragon verde','Dragon albastru','Dragon de aur'], tint:[0xd8402e,0x3fbf5a,0x3f8fe8,0xffcc33]},
};

// ---------- fruit trees ----------
export const TREES = {
  mar:     {n:'Măr',      pl:'Mere',      e:'🍎', cost:60,  lv:3,  t:90,  v:8,  fruit:0xd83a2c},
  cires:   {n:'Cireș',    pl:'Cireșe',    e:'🍒', cost:90,  lv:5,  t:110, v:11, fruit:0xb3122e},
  par:     {n:'Păr',      pl:'Pere',      e:'🍐', cost:120, lv:7,  t:130, v:14, fruit:0xc7d24a},
  portocal:{n:'Portocal', pl:'Portocale', e:'🍊', cost:160, lv:9,  t:150, v:18, fruit:0xff8c1a},
  piersic: {n:'Piersic',  pl:'Piersici',  e:'🍑', cost:200, lv:11, t:170, v:22, fruit:0xffa070},
};

// ---------- wild resources (activities in the world) ----------
export const FISH = [
  {id:'biban', e:'🐟', n:'Biban',          v:8,  w:50},
  {id:'caras', e:'🐠', n:'Caras',          v:12, w:30},
  {id:'somn',  e:'🐡', n:'Somn',           v:25, w:14},
  {id:'auriu', e:'✨', n:'Peștișor auriu', v:80, w:6},
];
export const FORAGE = [
  {id:'mure',    e:'🫐', n:'Mure',          v:6,  w:40},
  {id:'zmeura',  e:'🍓', n:'Zmeură',        v:7,  w:30},
  {id:'hribi',   e:'🍄', n:'Hribi',         v:10, w:22},
  {id:'trufaalba',e:'🤍', n:'Trufă albă',   v:40, w:8},
];
export const ORES = [
  {id:'carbune', e:'⚫', n:'Cărbune',  v:6,  w:45},
  {id:'fier',    e:'🔩', n:'Fier',     v:10, w:30},
  {id:'cristal', e:'🔮', n:'Cristal',  v:30, w:18},
  {id:'diamant', e:'💎', n:'Diamant',  v:120, w:7},
];

// ---------- processed goods ----------
export const GOODS = {
  hrana:   {n:'Hrană pentru animale', e:'🥣', v:6},
  paine:   {n:'Pâine',      e:'🍞', v:22},
  biscuiti:{n:'Biscuiți',   e:'🍪', v:30},
  tort:    {n:'Tort',       e:'🎂', v:95},
  branza:  {n:'Brânză',     e:'🧀', v:45},
  unt:     {n:'Unt',        e:'🧈', v:40},
  inghetata:{n:'Înghețată', e:'🍦', v:70},
  zahar:   {n:'Zahăr',      e:'🍬', v:30},
  pulover: {n:'Pulover',    e:'🧥', v:60},
  fular:   {n:'Fular',      e:'🧣', v:85},
  placinta:{n:'Plăcintă',   e:'🥧', v:90},
  suc:     {n:'Suc de fructe', e:'🧃', v:50},
  gem:     {n:'Gem',        e:'🫙', v:55},
  salata_f:{n:'Salată de fructe', e:'🥗', v:70},
  ketchup: {n:'Ketchup',    e:'🥫', v:60},
  pizza:   {n:'Pizza',      e:'🍕', v:120},
  buchet:  {n:'Buchet de flori', e:'💐', v:110},
  ciocolata:{n:'Ciocolată', e:'🍫', v:150},
  miere:   {n:'Miere',      e:'🍯', v:28},
  bijuterie:{n:'Bijuterie', e:'💍', v:260},
  potiune: {n:'Poțiune magică', e:'🧪', v:300},
  sushi:   {n:'Sushi',      e:'🍣', v:95},
};

// ---------- factories ----------
export const FACTORIES = {
  furaje:  {n:'Fabrica de furaje', e:'🏭', cost:120, lv:3, w:5, d:5, rec:[
    {out:'hrana', q:2, need:{grau:1, porumb:1}, t:25}]},
  brutarie:{n:'Brutărie', e:'🥖', cost:220, lv:4, w:6, d:6, rec:[
    {out:'paine', q:1, need:{grau:3}, t:40},
    {out:'biscuiti', q:1, need:{porumb:2, oua:1}, t:60},
    {out:'tort', q:1, need:{grau:2, oua:2, zahar:1, lapte:1}, t:120},
    {out:'pizza', q:1, need:{grau:2, rosii:2, branza:1}, t:140}]},
  lactate: {n:'Lăptărie', e:'🧀', cost:300, lv:5, w:6, d:6, rec:[
    {out:'unt', q:1, need:{lapte:2}, t:50},
    {out:'branza', q:1, need:{lapte:2, trufe:1}, t:70},
    {out:'inghetata', q:1, need:{lapte:2, capsuni:1, zahar:1}, t:90}]},
  zahar:   {n:'Fabrica de zahăr', e:'🍬', cost:380, lv:6, w:5, d:5, rec:[
    {out:'zahar', q:1, need:{trestie:2}, t:40},
    {out:'ketchup', q:1, need:{rosii:3, zahar:1}, t:70}]},
  tesatorie:{n:'Țesătorie', e:'🧵', cost:450, lv:8, w:6, d:6, rec:[
    {out:'pulover', q:1, need:{lana:2}, t:80},
    {out:'fular', q:1, need:{lanafina:1, pene:2}, t:100},
    {out:'buchet', q:1, need:{trandafiri:3, pene:1}, t:90}]},
  cofetarie:{n:'Cofetărie', e:'🥧', cost:600, lv:9, w:6, d:6, rec:[
    {out:'placinta', q:1, need:{dovleac:1, zahar:1, grau:1}, t:100},
    {out:'gem', q:1, need:{mar:2, zahar:1}, t:80},
    {out:'suc', q:1, need:{pepene:1, cires:2}, t:70},
    {out:'salata_f', q:1, need:{mar:1, par:1, portocal:1}, t:90},
    {out:'ciocolata', q:1, need:{cacao:2, lapte:1, zahar:1}, t:150}]},
  bucatarie:{n:'Bucătăria de pește', e:'🍣', cost:500, lv:7, w:5, d:5, rec:[
    {out:'sushi', q:1, need:{biban:2, caras:1}, t:80}]},
  atelier: {n:'Atelier de bijuterii', e:'💍', cost:900, lv:10, w:6, d:6, rec:[
    {out:'bijuterie', q:1, need:{cristal:2, fier:1}, t:150},
    {out:'potiune', q:1, need:{praf:1, gelatina:1, cristal:1}, t:180}]},
};

// ---------- buildings ----------
// pass = passive income per minute at level 1 (upgrade multiplies)
export const BUILD = {
  fantana: {n:'Fântână',        e:'⛲', cost:60,  lv:1, w:3, d:3, d2:'Legumele cresc cu 10% mai repede'},
  flori:   {n:'Grădină de flori', e:'🌷', cost:25, lv:1, w:9, d:2, d2:'Flori frumoase'},
  lampi:   {n:'Felinare',       e:'🏮', cost:40,  lv:2, w:2, d:8, d2:'Felinare drăguțe pe alee'},
  pusculita:{n:'Pușculiță',     e:'🐖', cost:80,  lv:2, w:3, d:3, d2:'Strânge monede singură, chiar și când nu joci'},
  comenzi: {n:'Panou de comenzi', e:'📋', cost:50, lv:2, w:3, d:2, d2:'Primești comenzi și câștigi mult'},
  siloz:   {n:'Siloz',          e:'🛢️', cost:120, lv:3, w:4, d:4, d2:'Șansă 25% de recoltă dublă'},
  hambar:  {n:'Hambar',         e:'🏚️', cost:150, lv:3, w:7, d:9, d2:'Strânge singur produsele animalelor'},
  stupi:   {n:'Stupi de albine', e:'🐝', cost:180, lv:4, w:4, d:3, d2:'Albinele fac miere singure'},
  moara:   {n:'Moară de vânt',  e:'🌬️', cost:200, lv:4, w:5, d:5, d2:'Vinzi totul cu 20% mai scump'},
  sera:    {n:'Seră',           e:'🌱', cost:250, lv:5, w:7, d:9, d2:'Crești fructe și flori exotice (căpșuni, roșii, trandafiri…)'},
  limonada:{n:'Stand cu limonadă', e:'🍋', cost:300, lv:5, w:3, d:3, d2:'Trecătorii cumpără limonadă — bani pasivi'},
  pensiune:{n:'Pensiune',       e:'🏨', cost:900, lv:8, w:8, d:8, d2:'Turiștii plătesc cazare — mulți bani pasivi'},
  turn:    {n:'Turnul magic',   e:'🗼', cost:2500,lv:12,w:5, d:5, d2:'Atrage ouă rare: mai multe ouă de aur'},
};
export const PASSIVE = {pusculita:{rate:l=>l<=0?0:Math.round(2*Math.pow(l,1.35)),cap:180}, limonada:{rate:l=>l<=0?0:Math.round(5*Math.pow(l,1.3)),cap:120}, pensiune:{rate:l=>l<=0?0:Math.round(14*Math.pow(l,1.3)),cap:180}};

// ---------- decorations ----------
export const DECOR = {
  banca:   {n:'Bancă',          e:'🪑', cost:20,  lv:1, w:2, d:1},
  copac:   {n:'Copac mare',     e:'🌳', cost:30,  lv:1, w:3, d:3},
  pin:     {n:'Brad',           e:'🌲', cost:30,  lv:1, w:3, d:3},
  tufis:   {n:'Tufiș cu flori', e:'💐', cost:15,  lv:1, w:2, d:2},
  ciuperci:{n:'Ciuperci',       e:'🍄', cost:10,  lv:1, w:1, d:1},
  piatra:  {n:'Piatră mare',    e:'🪨', cost:15,  lv:1, w:3, d:3},
  lazi:    {n:'Lăzi',           e:'📦', cost:12,  lv:1, w:2, d:2},
  caruta:  {n:'Căruță',         e:'🛒', cost:40,  lv:2, w:2, d:4},
  felinar: {n:'Felinar',        e:'🏮', cost:15,  lv:1, w:1, d:1},
  sperietoare:{n:'Sperietoare', e:'🎃', cost:35,  lv:2, w:1, d:1},
  statuie: {n:'Ou de aur uriaș',e:'🥚', cost:300, lv:6, w:2, d:2},
};

export const TOOLS = {
  undita:  {n:'Undiță',          e:'🎣', cost:50,  lv:2, d:'Pescuiește la lacuri'},
  cos:     {n:'Coș mare',        e:'🧺', cost:70,  lv:2, d:'Mai multe ouă în natură, le aduni de mai departe'},
  tarnacop:{n:'Târnăcop',        e:'⛏️', cost:120, lv:4, d:'Spargi pietrele cu cristale de la munte'},
  busola:  {n:'Busola ouălor',   e:'🧭', cost:90,  lv:3, d:'Vezi ouăle pe hartă'},
  sapa:    {n:'Sapă de aur',     e:'🪏', cost:150, lv:4, d:'Recoltă dublă la fiecare parcelă'},
};

// upgradable things: level -> cost / effect
export const UPGRADES = {
  hambarCap:  {n:'Hambar mai mare', e:'📦', max:15, cost:l=>80*l*l+60, d:l=>`Încap ${60+40*l} lucruri`},
  stropitoare:{n:'Stropitoare',     e:'🚿', max:5,  cost:l=>60*(l+1)*(l+1), d:l=>`Legumele cresc de ${(1+.25*l).toFixed(2).replace('.',',')}× mai repede`},
  tarcCap:    {n:'Țarcuri mai mari', e:'🐾', max:2, cost:l=>500*(l+1)*(l+1), d:l=>`${4+2*l} animale în fiecare țarc`},
  pusculita:  {n:'Pușculiță',       e:'🐖', max:12, cost:l=>100*l*l+50, need:'pusculita', d:l=>`${PASSIVE.pusculita.rate(l)} 🪙 pe minut`},
  limonada:   {n:'Stand cu limonadă', e:'🍋', max:10, cost:l=>180*l*l+100, need:'limonada', d:l=>`${PASSIVE.limonada.rate(l)} 🪙 pe minut`},
  pensiune:   {n:'Pensiune',        e:'🏨', max:10, cost:l=>500*l*l+300, need:'pensiune', d:l=>`${PASSIVE.pensiune.rate(l)} 🪙 pe minut`},
  stupi:      {n:'Stupi',           e:'🐝', max:8,  cost:l=>150*l*l+80, need:'stupi', d:l=>`${l} 🍯 miere la fiecare ${Math.max(20,90-8*l)}s`},
  sera:       {n:'Seră mai mare',   e:'🌱', max:3,  cost:l=>400*l*l+200, need:'sera', d:l=>`${4+2*l} locuri în seră`},
  linii:      {n:'Linii de producție', e:'⚙️', max:3, cost:l=>300*(l+1), d:l=>`${l+1} produse odată în fiecare fabrică`},
  companion:  {n:'Hrană pentru companion', e:'🍖', max:5, cost:l=>120*(l+1), d:l=>`Companionul e mai iute (+${l*10}%)`},
};

export const FARM_LEVELS = [ // fence half size, cost, level needed, fields, pens
  {F:24, cost:0,     lv:1,  fields:1, pens:4},
  {F:34, cost:400,   lv:4,  fields:2, pens:6},
  {F:44, cost:1200,  lv:7,  fields:3, pens:9},
  {F:56, cost:3000,  lv:10, fields:4, pens:12},
  {F:68, cost:7000,  lv:13, fields:5, pens:14},
  {F:80, cost:15000, lv:16, fields:6, pens:16},
];
export const PEN_COST = [0,80,150,250,400,550,700,900,1100,1400,1700,2000,2400,2800,3300,3800];
export const PLOTS_PER_FIELD = 16;
export const plotCostFor = i => i<4?0:Math.round(15+(i-4)*9+Math.pow(Math.max(0,i-16),1.4)*4);

export const VEH = {
  tractor:{n:'Tractor',       e:'🚜', cost:300, lv:4, d:'Mergi repede și lucrezi toate parcelele din jur', sp:11},
  safari: {n:'Mașină Safari', e:'🚙', cost:600, lv:6, d:'Cea mai rapidă! Arată ouăle pe hartă', sp:17},
};

// ---------- worker bots ----------
// wage = coins per minute while working (expense)
export const WORKERS = {
  culegator:{n:'Bot Culegător', e:'🧑‍🌾', col:0x43b047, cost:250, lv:4, wage:3, d:'Recoltează legumele coapte și plantează din nou aceeași sămânță'},
  ingrijitor:{n:'Bot Îngrijitor', e:'🧑‍🍼', col:0xff8a3d, cost:300, lv:5, wage:3, d:'Strânge produsele animalelor și le hrănește'},
  vanzator:{n:'Bot Vânzător', e:'🧑‍💼', col:0x3fa9f5, cost:350, lv:5, wage:4, d:'Duce marfa la piață și o vinde singur (păstrează ce trebuie la comenzi)'},
  fabricant:{n:'Bot Fabricant', e:'🧑‍🏭', col:0xb06cff, cost:450, lv:7, wage:5, d:'Pornește din nou ultima rețetă în fiecare fabrică și strânge produsele'},
  gradinar:{n:'Bot Grădinar', e:'🧑‍🔬', col:0xff6fa8, cost:400, lv:6, wage:4, d:'Culege pomii și sera și le replantează'},
};

// ---------- player look ----------
export const CHARS = {
  e:{n:'Lili', d:'Fermiera', cost:0}, d:{n:'Hana', d:'Eleva', cost:0},
  shino:{n:'Mei', d:'Eleva', cost:60}, sakurada:{n:'Kai', d:'Băiatul', cost:60},
  g:{n:'Roza', d:'Prințesa', cost:150}, f:{n:'Aqua', d:'Eroina', cost:250},
};
export const OUTFIT_COLORS = [
  {n:'Original', c:null, cost:0}, {n:'Roz', c:330, cost:20}, {n:'Mov', c:275, cost:20}, {n:'Albastru', c:212, cost:20},
  {n:'Turcoaz', c:175, cost:30}, {n:'Verde', c:115, cost:30}, {n:'Galben', c:48, cost:30}, {n:'Roșu', c:2, cost:30}, {n:'Negru', c:-1, cost:40},
];
export const HAIR_COLORS = [
  {n:'Natural', c:null}, {n:'Blond', c:0xf6d98e}, {n:'Șaten', c:0x8a5a3a}, {n:'Negru', c:0x2a2428}, {n:'Roșcat', c:0xe06a30},
  {n:'Roz', c:0xff92c9}, {n:'Mov', c:0xb48cff}, {n:'Albastru', c:0x72b8ff}, {n:'Alb', c:0xf4f4f8}, {n:'Mentă', c:0x8fe3c2},
];
export const ACCS = {
  none:{n:'Fără',e:'🙂',cost:0}, paie:{n:'Pălărie de paie',e:'👒',cost:0}, flori:{n:'Coroniță de flori',e:'🌸',cost:30},
  fundita:{n:'Fundiță mare',e:'🎀',cost:30}, cowboy:{n:'Pălărie de cowboy',e:'🤠',cost:40}, pisica:{n:'Urechi de pisică',e:'🐱',cost:50},
  iepure:{n:'Urechi de iepuraș',e:'🐰',cost:50}, caciula:{n:'Căciulă de iarnă',e:'🧶',cost:50}, sapca:{n:'Șapcă',e:'🧢',cost:40},
  tiara:{n:'Tiară',e:'👑',cost:80}, coarne:{n:'Corn de unicorn',e:'🦄',cost:120},
};
export const FACES = {none:{n:'Fără',e:'🙂',cost:0}, ochelari:{n:'Ochelari rotunzi',e:'👓',cost:30}, soare:{n:'Ochelari de soare',e:'🕶️',cost:40}, inimioare:{n:'Ochelari inimioare',e:'😍',cost:60}};
export const BACKS = {none:{n:'Fără',e:'🙂',cost:0}, rucsac:{n:'Rucsac',e:'🎒',cost:40}, aripi:{n:'Aripi de zână',e:'🧚',cost:120}, mantie:{n:'Mantie de erou',e:'🦸',cost:90}, fluture:{n:'Aripi de fluture',e:'🦋',cost:100}, dragon:{n:'Aripi de dragon',e:'🐉',cost:200}};

// ---------- companions ----------
export const PETS = {
  catel:   {n:'Cățel',        e:'🐶', f:'pug',    cost:150, lv:2, h:.55, fly:false, bonus:'Găsește monede din când în când'},
  slime:   {n:'Slimy',        e:'🟢', f:'slime',  cost:200, lv:3, h:.6,  fly:false, bonus:'Legumele cresc cu 15% mai repede'},
  liliac:  {n:'Liliac',       e:'🦇', f:'bat',    cost:250, lv:4, h:.7,  fly:true,  bonus:'Mai multe ouă apar în natură'},
  dragon:  {n:'Dragon roșu',  e:'🐉', f:'dragon', cost:400, lv:5, h:.95, fly:true,  tint:0xd8402e, bonus:'Atrage ouăle de departe'},
  dragonv: {n:'Dragon verde', e:'🐲', f:'dragon', cost:500, lv:6, h:.95, fly:true,  tint:0x3fbf5a, bonus:'Atrage ouăle de departe'},
  dragona: {n:'Dragon albastru', e:'🐉', f:'dragon', cost:600, lv:7, h:.95, fly:true, tint:0x3f8fe8, bonus:'Atrage ouăle de departe'},
  dragonr: {n:'Dragon roz',   e:'🐉', f:'dragon', cost:700, lv:8, h:.95, fly:true,  tint:0xff7ac0, bonus:'Atrage ouăle de departe'},
  dragonaur:{n:'Dragon de aur', e:'✨', f:'dragon', cost:2000, lv:10, h:1.05, fly:true, tint:0xffcc33, gold:true, bonus:'Toate puterile + monede'},
};

export const FRIENDS = [
  {n:'Ana',   pe:'Ajut-o pe Ana',    farm:'Ferma Anei',      x:120,  z:125,  c:0xff7ab8, ch:'g',        acc:'flori',   wall:'Wall_Plaster_WoodGrid'},
  {n:'Luca',  pe:'Ajută-l pe Luca',  farm:'Ferma lui Luca',  x:40,   z:-185, c:0x3fa9f5, ch:'sakurada', acc:'cowboy',  wall:'Wall_UnevenBrick_Straight'},
  {n:'Sofia', pe:'Ajut-o pe Sofia',  farm:'Ferma Sofiei',    x:-185, z:-30,  c:0x8bc34a, ch:'shino',    acc:'caciula', wall:'Wall_Plaster_Straight'},
  {n:'Matei', pe:'Ajută-l pe Matei', farm:'Ferma lui Matei', x:178,  z:-72,  c:0xffa726, ch:'f',        acc:'sapca',   wall:'Wall_UnevenBrick_Straight'},
  {n:'Ioana', pe:'Ajut-o pe Ioana',  farm:'Ferma Ioanei',    x:-100, z:178,  c:0xab47bc, ch:'d',        acc:'fundita', wall:'Wall_Plaster_WoodGrid'},
  {n:'Radu',  pe:'Ajută-l pe Radu',  farm:'Ferma lui Radu',  x:-150, z:-150, c:0x26a69a, ch:'sakurada', acc:'paie',    wall:'Wall_Plaster_Straight'},
  {n:'Elena', pe:'Ajut-o pe Elena',  farm:'Ferma Elenei',    x:190,  z:40,   c:0xef5350, ch:'e',        acc:'tiara',   wall:'Wall_Plaster_WoodGrid'},
];

// ---------- missions ----------
// daily missions are generated from these templates; achievements are a fixed ladder
export const DAILY = [
  {k:'harv',  n:'Recoltează {q} parcele',    q:[6,10,16], r:[40,70,110]},
  {k:'sold',  n:'Vinde marfă de {q} 🪙',      q:[100,250,500], r:[40,80,140], money:true},
  {k:'eggs',  n:'Găsește {q} ouă în natură',  q:[2,4,6], r:[50,90,140]},
  {k:'made',  n:'Fă {q} produse în fabrici',  q:[2,5,8], r:[60,110,170]},
  {k:'orders',n:'Livrează {q} comenzi',       q:[1,3,5], r:[60,120,200]},
  {k:'fish',  n:'Prinde {q} pești',           q:[2,4,7], r:[50,90,150]},
  {k:'forage',n:'Culege {q} fructe de pădure',q:[3,6,10], r:[40,70,110]},
  {k:'prod',  n:'Strânge {q} produse de la animale', q:[4,8,14], r:[50,90,150]},
  {k:'help',  n:'Ajută prietenii de {q} ori', q:[2,4,6], r:[40,80,120]},
  {k:'mine',  n:'Sparge {q} pietre cu cristale', q:[2,4,6], r:[60,100,160]},
];
export const ACHIEVE = [
  ['harv',   'Fermier harnic',    [10,50,200,800,2000]],
  ['sold',   'Negustor',          [500,3000,15000,60000,200000]],
  ['eggs',   'Vânător de ouă',    [5,25,80,200,500]],
  ['hatch',  'Cuibul magic',      [5,25,80,200,500]],
  ['made',   'Meșter',            [5,30,120,400,1000]],
  ['orders', 'Livrator',          [3,20,80,250,600]],
  ['fish',   'Pescar',            [5,30,100,300,800]],
  ['forage', 'Culegător',         [10,50,150,400,1000]],
  ['mine',   'Miner',             [5,30,100,300,800]],
  ['help',   'Prieten bun',       [5,25,80,200,500]],
  ['rare',   'Colecționar',       [3,10,20,32,44]],
];
export const ACH_REWARD = [{c:50,e:1},{c:150,e:2},{c:400,g:1},{c:1000,g:2},{c:3000,g:4}];

export const xpFor = L => Math.round(25*Math.pow(L,1.55));
