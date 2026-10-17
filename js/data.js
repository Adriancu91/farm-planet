// Farm Planet — game data (all prices, recipes, unlock levels)
export const SAVE_KEY = 'farmplanet_v1';

// ---------- crops (grown on plots) ----------
// st = model stages from crops.glb, lv = level needed
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

// ---------- animals (hatched from eggs) ----------
export const ANIMALS = {
  gaina:   {n:'Găină',    e:'🐔', w:28, f:'chicken', h:.5,  walk:'Walk', idle:'Idle', sp:.8, prod:{id:'oua',e:'🥚',n:'Ouă',v:4,t:30}},
  cocos:   {n:'Cocoș',    e:'🐓', w:18, f:'rooster', h:.62, walk:'Walking', idle:'Idle', sp:.8, prod:{id:'pene',e:'🪶',n:'Pene',v:5,t:35}},
  porc:    {n:'Purceluș', e:'🐷', w:15, f:'pig',   h:.8,  prod:{id:'trufe',e:'🍄',n:'Trufe',v:12,t:55}},
  oaie:    {n:'Oiță',     e:'🐑', w:14, f:'sheep', h:1.0, prod:{id:'lana',e:'🧶',n:'Lână',v:10,t:50}},
  catel:   {n:'Cățel',    e:'🐶', w:10, f:'pug',   h:.55, sp:1.3, prod:{id:'comori',e:'🦴',n:'Comori',v:14,t:60}},
  vaca:    {n:'Văcuță',   e:'🐄', w:10, f:'cow',   h:1.45, prod:{id:'lapte',e:'🥛',n:'Lapte',v:15,t:60}},
  cal:     {n:'Căluț',    e:'🐴', w:6,  f:'horse', h:1.65, prod:{id:'trifoi',e:'🍀',n:'Trifoi norocos',v:25,t:80}},
  lama:    {n:'Lamă',     e:'🦙', w:5,  f:'llama', h:1.75, prod:{id:'lanafina',e:'🎀',n:'Lână fină',v:30,t:80}},
  zebra:   {n:'Zebră',    e:'🦓', w:3,  f:'zebra', h:1.5,  prod:{id:'dungi',e:'🎨',n:'Dungi magice',v:45,t:90}},
  unicorn: {n:'Unicorn',  e:'🦄', w:1,  f:'horse', h:1.7, uni:true, prod:{id:'praf',e:'🌈',n:'Praf magic',v:100,t:120}},
};

// ---------- fruit trees (placeable, harvest again and again) ----------
export const TREES = {
  mar:     {n:'Măr',      e:'🍎', cost:60,  lv:3,  t:90,  v:8,  fruit:0xd83a2c},
  cires:   {n:'Cireș',    e:'🍒', cost:90,  lv:5,  t:110, v:11, fruit:0xb3122e},
  par:     {n:'Păr',      e:'🍐', cost:120, lv:7,  t:130, v:14, fruit:0xc7d24a},
  portocal:{n:'Portocal', e:'🍊', cost:160, lv:9,  t:150, v:18, fruit:0xff8c1a},
};

// ---------- fish ----------
export const FISH = [
  {id:'biban', e:'🐟', n:'Biban',       v:8,  w:50},
  {id:'caras', e:'🐠', n:'Caras',       v:12, w:30},
  {id:'somn',  e:'🐡', n:'Somn',        v:25, w:14},
  {id:'auriu', e:'✨', n:'Peștișor auriu', v:80, w:6},
];

// ---------- processed goods ----------
export const GOODS = {
  hrana:   {n:'Hrană pentru animale', e:'🥣', v:6},
  paine:   {n:'Pâine',      e:'🍞', v:22},
  biscuiti:{n:'Biscuiți',   e:'🍪', v:30},
  tort:    {n:'Tort',       e:'🎂', v:95},
  branza:  {n:'Brânză',     e:'🧀', v:45},
  unt:     {n:'Unt',        e:'🧈', v:40},
  zahar:   {n:'Zahăr',      e:'🍬', v:30},
  pulover: {n:'Pulover',    e:'🧥', v:60},
  fular:   {n:'Fular',      e:'🧣', v:85},
  placinta:{n:'Plăcintă',   e:'🥧', v:90},
  suc:     {n:'Suc de fructe', e:'🧃', v:50},
  gem:     {n:'Gem',        e:'🫙', v:55},
  salata_f:{n:'Salată de fructe', e:'🥗', v:70},
};

// ---------- factories (production buildings) ----------
export const FACTORIES = {
  furaje:  {n:'Fabrica de furaje', e:'🏭', cost:120, lv:3, w:5, d:5, rec:[
    {out:'hrana', q:2, need:{grau:1, porumb:1}, t:25}]},
  brutarie:{n:'Brutărie', e:'🥖', cost:220, lv:4, w:6, d:6, rec:[
    {out:'paine', q:1, need:{grau:3}, t:40},
    {out:'biscuiti', q:1, need:{porumb:2, oua:1}, t:60},
    {out:'tort', q:1, need:{grau:2, oua:2, zahar:1, lapte:1}, t:120}]},
  lactate: {n:'Lăptărie', e:'🧀', cost:300, lv:5, w:6, d:6, rec:[
    {out:'unt', q:1, need:{lapte:2}, t:50},
    {out:'branza', q:1, need:{lapte:2, trufe:1}, t:70}]},
  zahar:   {n:'Fabrica de zahăr', e:'🍬', cost:380, lv:6, w:5, d:5, rec:[
    {out:'zahar', q:1, need:{trestie:2}, t:40}]},
  tesatorie:{n:'Țesătorie', e:'🧵', cost:450, lv:8, w:6, d:6, rec:[
    {out:'pulover', q:1, need:{lana:2}, t:80},
    {out:'fular', q:1, need:{lanafina:1, pene:2}, t:100}]},
  cofetarie:{n:'Cofetărie', e:'🥧', cost:600, lv:9, w:6, d:6, rec:[
    {out:'placinta', q:1, need:{dovleac:1, zahar:1, grau:1}, t:100},
    {out:'gem', q:1, need:{mar:2, zahar:1}, t:80},
    {out:'suc', q:1, need:{pepene:1, cires:2}, t:70},
    {out:'salata_f', q:1, need:{mar:1, par:1, portocal:1}, t:90}]},
};

// ---------- simple buildings (bonuses) ----------
export const BUILD = {
  fantana: {n:'Fântână',       e:'⛲', cost:60,  lv:1, w:3, d:3, d2:'Legumele cresc cu 10% mai repede'},
  flori:   {n:'Grădină de flori', e:'🌷', cost:25, lv:1, w:9, d:2, d2:'Flori frumoase'},
  lampi:   {n:'Felinare',      e:'🏮', cost:40,  lv:2, w:2, d:8, d2:'Felinare drăguțe pe alee'},
  pusculita:{n:'Pușculiță',    e:'🐖', cost:80,  lv:2, w:3, d:3, d2:'Strânge monede singură, chiar și când nu joci'},
  comenzi: {n:'Panou de comenzi', e:'📋', cost:50, lv:2, w:3, d:2, d2:'Primești comenzi și câștigi mult'},
  siloz:   {n:'Siloz',         e:'🛢️', cost:120, lv:3, w:4, d:4, d2:'Șansă 25% de recoltă dublă'},
  hambar:  {n:'Hambar',        e:'🏚️', cost:150, lv:3, w:7, d:9, d2:'Strânge singur produsele animalelor'},
  moara:   {n:'Moară de vânt', e:'🌬️', cost:200, lv:4, w:5, d:5, d2:'Vinzi totul cu 20% mai scump'},
  sera:    {n:'Seră',          e:'🌱', cost:250, lv:5, w:7, d:9, d2:'Legumele cresc cu 30% mai repede'},
};

// ---------- decorations ----------
export const DECOR = {
  banca:   {n:'Bancă',          e:'🪑', cost:20,  lv:1, w:2, d:1},
  copac:   {n:'Copac mare',     e:'🌳', cost:30,  lv:1, w:3, d:3},
  tufis:   {n:'Tufiș cu flori', e:'💐', cost:15,  lv:1, w:2, d:2},
  ciuperci:{n:'Ciuperci',       e:'🍄', cost:10,  lv:1, w:1, d:1},
  piatra:  {n:'Piatră mare',    e:'🪨', cost:15,  lv:1, w:3, d:3},
  lazi:    {n:'Lăzi',           e:'📦', cost:12,  lv:1, w:2, d:2},
  caruta:  {n:'Căruță',         e:'🛒', cost:40,  lv:2, w:2, d:4},
  felinar: {n:'Felinar',        e:'🏮', cost:15,  lv:1, w:1, d:1},
  statuie: {n:'Ou de aur uriaș',e:'🥚', cost:300, lv:6, w:2, d:2},
};

export const TOOLS = {
  undita: {n:'Undiță',          e:'🎣', cost:50,  lv:2, d:'Pescuiește la lac'},
  cos:    {n:'Coș mare',        e:'🧺', cost:70,  lv:2, d:'Mai multe ouă în natură, le aduni de mai departe'},
  busola: {n:'Busola ouălor',   e:'🧭', cost:90,  lv:3, d:'Vezi ouăle pe hartă'},
  sapa:   {n:'Sapă de aur',     e:'⛏️', cost:150, lv:4, d:'Recoltă dublă la fiecare parcelă'},
};

// upgradable things: level -> cost / effect
export const UPGRADES = {
  hambarCap:  {n:'Hambar mai mare', e:'📦', max:10, cost:l=>80*l*l+60, d:l=>`Încap ${60+40*l} lucruri`},
  stropitoare:{n:'Stropitoare',     e:'🚿', max:4,  cost:l=>60*(l+1)*(l+1), d:l=>`Legumele cresc de ${(1+.25*l).toFixed(2).replace('.',',')}× mai repede`},
  pusculita:  {n:'Pușculiță',       e:'🐖', max:10, cost:l=>100*l*l+50, d:l=>`${pigRate(l)} 🪙 pe minut`},
  linii:      {n:'Linii de producție', e:'⚙️', max:3, cost:l=>300*(l+1), d:l=>`${l+1} produse odată în fiecare fabrică`},
  companion:  {n:'Hrană pentru companion', e:'🍖', max:5, cost:l=>120*(l+1), d:l=>`Companionul e mai iute (+${l*10}%)`},
};
export const pigRate = l => l<=0?0:Math.round(2*Math.pow(l,1.35));

export const FARM_LEVELS = [ // fence half size, cost, level needed, fields, pens
  {F:22, cost:0,    lv:1,  fields:1, pens:4},
  {F:32, cost:400,  lv:4,  fields:2, pens:6},
  {F:42, cost:1200, lv:7,  fields:3, pens:8},
  {F:52, cost:3000, lv:10, fields:4, pens:10},
];
export const PEN_COST = [0,80,150,250,400,550,700,900,1100,1400];
export const PLOTS_PER_FIELD = 16;
export const plotCostFor = i => i<4?0:Math.round(15+(i-4)*9+Math.pow(Math.max(0,i-16),1.4)*4);

export const VEH = {
  tractor:{n:'Tractor',       e:'🚜', cost:300, lv:4, d:'Mergi repede și lucrezi toate parcelele din jur', sp:10},
  safari: {n:'Mașină Safari', e:'🚙', cost:600, lv:6, d:'Cea mai rapidă! Arată ouăle pe hartă', sp:16},
};

// ---------- player look ----------
export const CHARS = {
  e:{n:'Lili', d:'Fermiera', cost:0}, d:{n:'Hana', d:'Eleva', cost:0},
  shino:{n:'Mei', d:'Eleva', cost:60}, sakurada:{n:'Kai', d:'Băiatul', cost:60},
  g:{n:'Roza', d:'Prințesa', cost:150}, f:{n:'Aqua', d:'Eroina', cost:250},
};
export const OUTFIT_COLORS = [ // hue shift targets for clothes; null = original
  {n:'Original', c:null, cost:0}, {n:'Roz', c:330, cost:20}, {n:'Mov', c:275, cost:20}, {n:'Albastru', c:212, cost:20},
  {n:'Turcoaz', c:175, cost:30}, {n:'Verde', c:115, cost:30}, {n:'Galben', c:48, cost:30}, {n:'Roșu', c:2, cost:30}, {n:'Negru', c:-1, cost:40},
];
export const HAIR_COLORS = [
  {n:'Natural', c:null}, {n:'Blond', c:0xf6d98e}, {n:'Șaten', c:0x8a5a3a}, {n:'Negru', c:0x2a2428}, {n:'Roșcat', c:0xe06a30},
  {n:'Roz', c:0xff92c9}, {n:'Mov', c:0xb48cff}, {n:'Albastru', c:0x72b8ff}, {n:'Alb', c:0xf4f4f8}, {n:'Mentă', c:0x8fe3c2},
];
export const ACCS = { // head slot
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
  {n:'Ana',   pe:'Ajut-o pe Ana',    farm:'Ferma Anei',      x:92,   z:95,   c:0xff7ab8, ch:'g',        acc:'flori',   wall:'Wall_Plaster_WoodGrid'},
  {n:'Luca',  pe:'Ajută-l pe Luca',  farm:'Ferma lui Luca',  x:30,   z:-140, c:0x3fa9f5, ch:'sakurada', acc:'cowboy',  wall:'Wall_UnevenBrick_Straight'},
  {n:'Sofia', pe:'Ajut-o pe Sofia',  farm:'Ferma Sofiei',    x:-140, z:-22,  c:0x8bc34a, ch:'shino',    acc:'caciula', wall:'Wall_Plaster_Straight'},
  {n:'Matei', pe:'Ajută-l pe Matei', farm:'Ferma lui Matei', x:135,  z:-55,  c:0xffa726, ch:'f',        acc:'sapca',   wall:'Wall_UnevenBrick_Straight'},
  {n:'Ioana', pe:'Ajut-o pe Ioana',  farm:'Ferma Ioanei',    x:-75,  z:135,  c:0xab47bc, ch:'d',        acc:'fundita', wall:'Wall_Plaster_WoodGrid'},
];

export const xpFor = L => Math.round(25*Math.pow(L,1.55)); // xp needed to go from L to L+1
