import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ── FONTS: Montserrat everywhere ──────────────────────────────────────────────
(() => {
  const l = document.createElement("link");
  l.href = "https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400&family=JetBrains+Mono:wght@400;600&display=swap";
  l.rel = "stylesheet"; document.head.appendChild(l);
})();

// ── PALETTE ───────────────────────────────────────────────────────────────────
const C = {
  brand:    "#11CD87",   // Lingvo green
  brandD:   "#0BA870",
  brandL:   "#E6FAF4",
  brandM:   "#3DDBA3",
  teal:     "#0D9488",
  tealL:    "#CCFBF1",
  amber:    "#D97706",
  amberL:   "#FEF3C7",
  rose:     "#E11D48",
  roseL:    "#FFE4E6",
  violet:   "#0BA870",
  bg:       "#F5FEFA",
  surface:  "#FFFFFF",
  s900:     "#0F172A",
  s800:     "#1E293B",
  s600:     "#475569",
  s400:     "#94A3B8",
  s200:     "#E2E8F0",
  s100:     "#F1F5F9",
  hlY:      "#FEF08A",
  hlB:      "#BAE6FD",
};

// ── GLOBAL CSS ────────────────────────────────────────────────────────────────
const gs = document.createElement("style");
gs.textContent = `
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%;background:${C.bg}}
  body{font-family:'Montserrat',sans-serif;font-size:14px;color:${C.s900};-webkit-font-smoothing:antialiased}
  ::-webkit-scrollbar{width:5px;height:5px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:${C.s200};border-radius:99px}
  input,textarea,select,button{font-family:'Montserrat',sans-serif}
  textarea:focus,input:focus,select:focus{outline:2px solid ${C.brand};outline-offset:0;border-color:${C.brand}!important}
  .hl-y{background:${C.hlY};border-radius:3px;padding:0 2px}
  .hl-b{background:${C.hlB};border-radius:3px;padding:0 2px}
  @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes glow{0%,100%{box-shadow:0 0 0 0 rgba(17,205,135,.35)}50%{box-shadow:0 0 0 8px rgba(17,205,135,0)}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.7}}
  .fu{animation:fadeUp .3s ease both}
  .spin{animation:spin 1s linear infinite}
`;
document.head.appendChild(gs);

// ── SUPABASE + STORAGE ────────────────────────────────────────────────────────
const _SURL = import.meta.env.VITE_SUPABASE_URL  || "";
const _SKEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = _SURL && _SKEY ? createClient(_SURL, _SKEY) : null;

const DB_KEY   = "lv_ielts_v2";
const _emptyDB = () => ({participants:[],bookings:[],tests:[],testSuites:[],assignments:[],speakingSlots:[]});
let   _db      = _emptyDB();
let   _flushTmr = null;

// ── Config store (admin data: tests, suites, assignments, slots) ──────────────
const _flushConfig = async db => {
  if(!supabase) return false;
  try {
    const cfg = {tests:db.tests||[],testSuites:db.testSuites||[],assignments:db.assignments||[],speakingSlots:db.speakingSlots||[],bookings:db.bookings||[],scoreOverrides:db.scoreOverrides||{}};
    const {error} = await supabase.from("ielts_store").upsert({id:"main",data:cfg,updated_at:new Date().toISOString()});
    if(error){ console.warn("[DB] config write error:",error.message); return false; }
    return true;
  } catch(e){ console.warn("[DB] config write failed:",e); return false; }
};
const _flush    = db => { clearTimeout(_flushTmr); _flushTmr = setTimeout(()=>_flushConfig(db),300); };
const _flushNow = db => _flushConfig(db);

// ── Participants table — one row per student, no concurrent conflicts ──────────
const _insertParticipant = async item => {
  if(!supabase) return false;
  try {
    const email = ((item.candidate?.email||item.email)||"").toLowerCase().trim();
    const type  = item.listeningBand!=null ? "attempt" : "registration";
    const {error} = await supabase.from("participants").insert({id:item.id, email, type, data:item});
    if(error){ console.warn("[DB] participant insert error:",error.message); return false; }
    return true;
  } catch(e){ console.warn("[DB] participant insert failed:",e); return false; }
};
const _loadParticipants = async () => {
  if(!supabase) return null;
  try {
    const {data,error} = await supabase.from("participants").select("data").order("created_at",{ascending:false});
    if(error||!data) return null;
    return data.map(r=>r.data);
  } catch{ return null; }
};

const loadDB  = () => _db;
const saveDB  = db => { _db=db; try{localStorage.setItem(DB_KEY,JSON.stringify(db));}catch{} _flush(db); };
const saveDBNow = async db => { _db=db; try{localStorage.setItem(DB_KEY,JSON.stringify(db));}catch{} await _flushNow(db); };

// dbPush for participants → individual row insert (concurrent-safe)
// dbPush for anything else → full config upsert
const dbPush    = (col,item) => { _db[col]=[item,...(_db[col]||[])]; saveDB(_db); };
const dbPushNow = async (col,item) => {
  _db[col]=[item,...(_db[col]||[])];
  try{localStorage.setItem(DB_KEY,JSON.stringify(_db));}catch{}
  if(col==="participants") { await _insertParticipant(item); }
  else { await _flushNow(_db); }
};
const dbSave    = (col,items) => { _db[col]=items; saveDB(_db); };
const dbSaveNow = async (col,items) => { _db[col]=items; await saveDBNow(_db); };

// Force re-fetch from both Supabase sources
export async function reloadDB() {
  if(supabase){
    try{
      // Load config (admin data)
      const {data:cfg} = await supabase.from("ielts_store").select("data").eq("id","main").single();
      const base = cfg?.data || {};
      // Load participants (student data)
      const pts = await _loadParticipants();
      // Merge: participants table rows + any legacy rows still in ielts_store, deduplicate by id
      const merged = [...(pts||[]), ...(base.participants||[])];
      const seen = new Set();
      const deduped = merged.filter(p=>{ const k=p.id||p.email||JSON.stringify(p); if(seen.has(k)) return false; seen.add(k); return true; });
      // Apply scoreOverrides (written by Recalculate All Bands) on top of participant data
      const overrides = base.scoreOverrides||{};
      const withOverrides = deduped.map(p=> overrides[p.id] ? {...p,...overrides[p.id]} : p);
      _db = {..._emptyDB(), ...base, participants: withOverrides};
      localStorage.setItem(DB_KEY,JSON.stringify(_db));
      return;
    }catch{}
  }
  try{ _db=JSON.parse(localStorage.getItem(DB_KEY))||_emptyDB(); }catch{ _db=_emptyDB(); }
}

export async function initDB() {
  if(supabase){
    try{
      const {data:cfg} = await supabase.from("ielts_store").select("data").eq("id","main").single();
      const base = cfg?.data || {};
      const pts  = await _loadParticipants();
      if(cfg?.data || pts){
        const merged = [...(pts||[]), ...(base.participants||[])];
        const seen = new Set();
        const deduped = merged.filter(p=>{ const k=p.id||p.email||JSON.stringify(p); if(seen.has(k)) return false; seen.add(k); return true; });
        _db = {..._emptyDB(), ...base, participants: deduped};
        localStorage.setItem(DB_KEY,JSON.stringify(_db));
        return;
      }
      // First run — seed from localStorage
      try{ _db=JSON.parse(localStorage.getItem(DB_KEY))||_emptyDB(); }catch{ _db=_emptyDB(); }
      await _flushConfig(_db);
    }catch{
      try{ _db=JSON.parse(localStorage.getItem(DB_KEY))||_emptyDB(); }catch{ _db=_emptyDB(); }
    }
  } else {
    try{ _db=JSON.parse(localStorage.getItem(DB_KEY))||_emptyDB(); }catch{ _db=_emptyDB(); }
  }
}
const genId   = p => `${p}-${Date.now().toString(36).toUpperCase()}`;

// ── HELPERS ───────────────────────────────────────────────────────────────────
const pad2    = n => String(n).padStart(2,"0");
const fmtTime = s => `${pad2(Math.floor(s/60))}:${pad2(s%60)}`;
// countWords: only count real words (3+ chars, has letters) — avoids single symbols triggering AI
const countWords = t => t.trim().split(/\s+/).filter(w => w.length >= 3 && /[a-zA-Z]/.test(w)).length;

// ── OFFICIAL IELTS BAND SCORE TABLES ─────────────────────────────────────────
// Scores are scaled to /40 equivalent before lookup (supports custom-length tests)
// Source: official IELTS score conversion charts (Cambridge / British Council)

// ── LISTENING: Official IELTS band conversion ─────────────────────────────────
// 39-40=9.0 | 37-38=8.5 | 35-36=8.0 | 32-34=7.5 | 30-31=7.0 | 26-29=6.5
// 23-25=6.0 | 18-22=5.5 | 16-17=5.0 | 13-15=4.5 | 10-12=4.0 | 8-9=3.5 …
function listeningBand(c, t) {
  const s = t > 0 ? Math.round(c / t * 40) : 0;
  if(s>=39)return 9.0; if(s>=37)return 8.5; if(s>=35)return 8.0;
  if(s>=32)return 7.5; if(s>=30)return 7.0; if(s>=26)return 6.5;
  if(s>=23)return 6.0; if(s>=18)return 5.5; if(s>=16)return 5.0;
  if(s>=13)return 4.5; if(s>=10)return 4.0; if(s>=8) return 3.5;
  if(s>=6) return 3.0; if(s>=4) return 2.5; if(s>=2) return 2.0;
  if(s>=1) return 1.5; return 0.0;
}

// ── READING (Academic): Official IELTS band conversion ───────────────────────
// 39-40=9.0 | 37-38=8.5 | 35-36=8.0 | 33-34=7.5 | 30-32=7.0 | 27-29=6.5
// 23-26=6.0 | 19-22=5.5 | 15-18=5.0 | 13-14=4.5 | 10-12=4.0 | 8-9=3.5 …
function readingBand(c, t) {
  const s = t > 0 ? Math.round(c / t * 40) : 0;
  if(s>=39)return 9.0; if(s>=37)return 8.5; if(s>=35)return 8.0;
  if(s>=33)return 7.5; if(s>=30)return 7.0; if(s>=27)return 6.5;
  if(s>=23)return 6.0; if(s>=19)return 5.5; if(s>=15)return 5.0;
  if(s>=13)return 4.5; if(s>=10)return 4.0; if(s>=8) return 3.5;
  if(s>=6) return 3.0; if(s>=4) return 2.5; if(s>=2) return 2.0;
  if(s>=1) return 1.5; return 0.0;
}

// Overall band: average of all four skills, rounded to nearest 0.5
const overallBand = bs => Math.round(bs.reduce((a,b)=>a+b,0)/bs.length*2)/2;

const bandLabel = b => b>=8.5?"Expert User":b>=7.5?"Very Good User":b>=6.5?"Competent User":b>=5.5?"Modest User":b>=4?"Limited User":"Extremely Limited";
const bandColor = b => b>=7.5?C.teal:b>=6?C.brand:b>=5?C.amber:C.rose;
const bandBg    = b => b>=7.5?C.tealL:b>=6?C.brandL:b>=5?C.amberL:C.roseL;

// ── MICRO UI HELPERS ──────────────────────────────────────────────────────────
const cardStyle = (extra={}) => ({
  background: C.surface,
  border: `1px solid ${C.s200}`,
  borderRadius: 16,
  boxShadow: "0 2px 8px rgba(17,205,135,.06), 0 1px 3px rgba(0,0,0,.04)",
  ...extra,
});

const btnStyle = (variant="primary", disabled=false) => {
  const map = {
    primary:   {background: disabled?C.s200:C.brand,    color: disabled?C.s400:"#fff", border:"none",                           boxShadow: disabled?"none":"0 2px 8px rgba(17,205,135,.3)"},
    secondary: {background: "#fff",                      color: C.brand,                border: `1.5px solid ${C.brand}`},
    ghost:     {background: "transparent",               color: C.s600,                 border: "none"},
    teal:      {background: disabled?C.s200:C.teal,      color: "#fff",                 border: "none",                          boxShadow: disabled?"none":"0 2px 8px rgba(13,148,136,.25)"},
    danger:    {background: C.rose,                      color: "#fff",                 border: "none"},
    violet:    {background: disabled?C.s200:"#11CD87",   color: disabled?C.s400:"#fff", border: "none",                          boxShadow: disabled?"none":"0 2px 8px rgba(17,205,135,.3)"},
  };
  return {
    ...(map[variant]||map.primary),
    padding: "10px 22px", borderRadius: 10, fontSize: 13, fontWeight: 700,
    cursor: disabled?"not-allowed":"pointer", transition: "all .15s",
    letterSpacing: "0.02em", whiteSpace:"nowrap",
  };
};

const labelStyle = {
  display:"block", fontSize:11, fontWeight:700, color:C.s600,
  letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:6,
};
const inputStyle = {
  background:"#fff", border:`1.5px solid ${C.s200}`, borderRadius:10,
  padding:"10px 14px", fontSize:14, color:C.s900, width:"100%",
  transition:"border-color .15s",
};
const tagStyle = (color=C.brand) => ({
  display:"inline-block", background:color+"18", color,
  fontSize:10, fontWeight:700, letterSpacing:"0.1em",
  padding:"3px 10px", borderRadius:99, textTransform:"uppercase",
});

// ── LISTENING DATA ────────────────────────────────────────────────────────────
const LISTENING_SECTIONS = [
  {
    label:"Section 1",
    instructions:"Your administrator will assign listening content for this test.",
    questions:[]
  }
];

// ── READING DATA ──────────────────────────────────────────────────────────────
const PASSAGES_UNUSED = {
  thames:{
    title:"Cleaning up the Thames",
    text:`The River Thames, which was biologically "dead" as recently as the 1960s, is now the cleanest metropolitan river in the world, according to the Thames Water Company. The company says that thanks to major investment in better sewage treatment in London and the Thames Valley, the river that flows through the United Kingdom capital and the Thames Estuary into the North Sea is cleaner now than it has been for 130 years. The Fisheries Department has reported that the river has again become the home to 115 species of fish including sea bass, flounder, salmon, smelt, and shad, many of which had been missing for decades. Recently, a porpoise was spotted cavorting in the river near central London.

But things were not always so rosy. In the 1950s, sewer outflows and industrial effluent had killed the river. It was starved of oxygen and could no longer support aquatic life. Until the early 1970s, if you fell into the Thames you would have had to be rushed to hospital to get your stomach pumped. A clean-up operation began in the 1960s. Several Parliamentary Committees and Royal Commissions were set up, and, over time, legislation has been introduced that puts the onus on polluters to dispose of waste responsibly. In 1964 the Greater London Council (GLC) began work on much enlarged sewage works, which were completed in 1974.

The Thames clean-up is not over though. It involves many disparate arms of government and a wide range of non-government stakeholder groups. Each of the urban and non-urban London boroughs that flanks the river has its own reasons to keep the river clean. The 2000 Local Government Act requires each local borough to "prepare a community strategy for promoting or improving the economic, social and environmental well-being of their area". And if your area includes a stretch of river, that means a sustainable river development strategy.

Further laws aimed at improving and sustaining the river's viability have been proposed. Transport for London — the agency responsible for transport in the capital — plays a role in regulating river use and river users. It is now responsible for controlling the effluents and rubbish coming from craft using the Thames. This is carried out by officers on official vessels regularly inspecting craft and doing spot checks.

Thames Water (TW) has now been charged to reduce the amount of litter that finds its way into the tidal river and its tributaries. Thousands of tons of rubbish end up in the river each year, from badly stored waste, people throwing litter off boats, and rubbish in the street being blown or washed into the river. The Port of London already collects up to 3,000 tons of solid waste from the tideway every year.

Thames Water now plans to introduce a new device — a huge cage that sits in the flow of water and gathers the passing rubbish. Moored just offshore in front of the Royal Naval College at Greenwich, the device is expected to capture up to 20 tons of floating litter each year. This machine, known as the "Rubbish Muncher", is hoped to be the first of many, as TW is now looking for sponsors to pay for more cages elsewhere along the Thames.

Monitoring of the cleanliness of the River Thames in the past was the responsibility of a welter of agencies — British Waterways, Port of London Authority, the Environment Agency, the Health and Safety Commission, Thames Water — as well as academic departments and national and local environment groups. There is now a central department in the Environment Agency, which has the remit of monitoring the Thames. This centralisation of accountability will, it is hoped, lead to more efficient control and enforcement.`
  },
  smell:{
    title:"Persuasion and Smell",
    text:`The link between smell and memory is well established; most people have experienced the phenomenon of unexpectedly encountering a smell, perhaps the scent of a particular flower or a specific cooking odour, which brings back a flood of long-forgotten memories. The fact that smell can conjure up feelings, whether enjoyable or unpleasant, is also undeniable; the perfume industry is built upon the premise that certain scents make us feel good about ourselves and, hopefully, also make us more attractive to others. But can smell do more than just evoke feelings and memories? Can it in fact alter people's behaviour and decisions?

A tip offered by property magazines and estate agents to people trying to sell their house is to bake a batch of bread or cakes shortly before a prospective buyer arrives. The smell of freshly-baked produce is said to evoke feelings of comfort and happiness that the purchaser will associate with the house, thus making him or her more likely to buy it. Research into smell and how it is processed by the brain has come up with some interesting answers.

The olfactory system is the oldest sensory system in mammals and can process about 10,000 different odours. When people smell something, its scent enters the nose and is transmitted to the olfactory bulb, which forms part of the limbic system. Briefly put, the limbic system is a set of structures in the brain that govern emotional responses and memories, as well as regulating autonomic functions such as breathing and heart rate. Thus the sensory input from odours that enter the limbic system can trigger memories or involuntary emotional reactions, and these responses can be exploited by advertisers to influence potential customers.

However, that is not the entire picture. The olfactory system also sends information to other parts of the brain that are responsible for more complex functions like language, abstract thought, judgement and creativity. In other words, smells not only provoke automatic emotional reactions, but also hold messages that may help people to generate mental models, form attitudes and make decisions.

A number of behavioural studies validate this hypothesis. Research conducted in France used scents like coffee, cinnamon and perfume to influence people's reactions. When the area was scented with one of the three scents, passers-by were more likely to pick up and return a dropped wallet than when the area was not scented.

A commercial experiment was undertaken with footwear. Two identical pairs of branded running shoes were placed in two different rooms, one of which contained scent previously shown to create positive feelings. Eighty-four per cent of participants reported back that they were more likely to buy the running shoes in the room with the scent. An interesting additional finding was that participants estimated that the running shoes in the scented room were $10 more expensive.

Scent research also indicated a direct influence on improving sociability. A recent study in the US showed that when environments were sprayed with scents linked with hygiene, such as citrus, individuals reported a desire to connect with those who were in the vicinity of the scent. The respondents also indicated that they were more willing to give money to charity and to help others.

These findings may raise worries as they suggest that advertisers have greater power to influence consumers' choices than was previously thought. However, these fears are probably exaggerated. One of the other sections of the brain that processes input from odours is the prefrontal cortex. This structure is the reasoning centre of the brain and it enables people to think analytically before making choices. The majority of people are unlikely to be guided solely by odours when making significant choices; a persuasive argument or strategy would need to be added in order to influence their choices.

Furthermore, scenting an area does not mean people snap into a certain mode of action that would normally be wholly uncharacteristic for them. Odours in certain environments can affect emotions, thoughts and behaviour, but the influence is contextual; the effects are immediate and dissipate once the surroundings have changed.`
  },
  deer:{
    title:"Deer Farming in Australia",
    text:`Deer are not indigenous to Australia. They were introduced into the country during the nineteenth century under the acclimatisation programmes governing the introduction of exotic species of animals and birds into Australia. Six species of deer were released at various locations. Commercial deer farming in Australia commenced in Victoria in 1971 with the authorised capture of rusa deer from the Royal National Park, NSW. Until 1985, only four species of deer, two from temperate climates (red, fallow) and two tropical species (rusa, chital) were confined for commercial farming. Late in 2005, pressure from industry to increase herd numbers saw the development of import protocols. This resulted in the introduction of large numbers of red deer hybrids from New Zealand, and North American elk directly from Canada. The national farmed deer herd is now distributed throughout all states, although most are in New South Wales and Victoria.

The number of animals processed annually has continued to increase, despite the downward trend in venison prices since 2007. Of concern is the apparent increase in the number of female animals processed and the number of whole herds committed for processing. With more than 40,000 animals processed in 2011/12 and 60,000 in 2012/13, there is justified concern that future years may see a dramatic drop in production. At least 85 per cent of all venison produced in Australia is exported, principally to Europe, with the remainder being consumed domestically. At least 90 per cent of all velvet antler produced is exported in an unprocessed state to Asia.

From the formation of the Australian Deer Breeders Federation in 1979, the industry representative body has evolved through the Deer Farmers Federation of Australia to the Deer Industry Association of Australia Ltd (DIAA), which was registered in 1995. The industry has established two product development and marketing companies, the Australian Deer Horn and Co-Products Pty Ltd (ADH) and the Deer Industry Projects and Development Pty Ltd, which trades as the Deer Industry Company (DIC). ADH collects and markets Australian deer horn and co-products on behalf of Australian deer farmers.

One problem that the Australian deer farming industry has faced recently is that of Johne's disease, a chronic wasting disease that can be found in cattle, sheep, goats, deer and camelids. The bacteria that cause Johne's disease live in animals' intestines and cause thickening of the bowel wall, which interferes with normal absorption of food. The prevalence of Johne's disease varies in different regions of Australia, but it is most commonly found in deer farms in southeast Australia. Symptoms include progressive weight loss and emaciation in older animals despite good appetite. Diarrhoea and bottle jaw are also common signs of the disease.

Deer farmers should develop and implement a farm bio-security plan and only purchase deer stock with an animal health statement. In areas where Johne's disease is common, a vaccination programme can be implemented, but this can be quite expensive and not 100 per cent effective. Once the disease has taken hold in a deer herd, the effects can be catastrophic as culling is usually the only answer. Johne's disease can cause long-term supply difficulties in various products, particularly venison; one case of this arose as a result of the 2009 slaughter of a significant number of young breeding females.

Industry programmes are funded by statutory levies on sales of animals for venison, velvet antler sales and the sale of live animals to export markets. The industry had a recent 5-year plan including animal nutrition, pasture quality, carcass quality, antler harvesting, promotional material and technical bulletins. Major projects funded by levy funds include the Venison Market Project from 2010 to 2015. This initiative has resulted in a dramatic increase in international demand for Australian venison and an increase in domestic consumption.`
  }
};

const PASSAGES = {};

const READING_SECTIONS = [
  {id:"p1",passageKey:"p1",label:"Passage 1",questions:[]}
];

const WRITING_TASKS = [
  {task:"Task 1",minWords:150,prompt:"The chart below shows the percentage of households with internet access in three countries between 2005 and 2020.\n\nSummarise the information by selecting and reporting the main features, and make comparisons where relevant.\n\nWrite at least 150 words."},
  {task:"Task 2",minWords:250,prompt:"Some people believe that the best way to improve public health is to increase the number of sports facilities. Others, however, think that this approach would have little effect on public health and that other measures are required.\n\nDiscuss both views and give your own opinion.\n\nWrite at least 250 words."},
];

// ── SHARED COMPONENTS ─────────────────────────────────────────────────────────

function Logo({ size=18, dark=false }) {
  return (
    <img src="/logo.png" alt="LingvoConnect" style={{ height: size*2.2, width:"auto", display:"block", filter: dark?"brightness(0) invert(1)":"none" }}/>
  );
}
// Demo Link Component

function DemoShareLink() {
  const demoUrl = 'https://genuine-manatee-15b7f6.netlify.app'; // Public demo URL
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(demoUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ margin: '20px 0', padding: '10px', border: '1px solid #eee', borderRadius: '8px', background: '#fafafa' }}>
      <span style={{ fontWeight: 'bold', marginRight: '10px' }}>Demo Version:</span>
      <a href={demoUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#0077cc', marginRight: '10px' }}>{demoUrl}</a>
      <button onClick={handleCopy} style={{ padding: '5px 10px', borderRadius: '4px', border: 'none', background: '#0077cc', color: '#fff', cursor: 'pointer' }}>
        {copied ? 'Copied!' : 'Copy Link'}
      </button>
    </div>
  );
}

function TopBar({ onAdmin }) {
  return (
    <div style={{
      background: "#fff",
      borderBottom: `1px solid ${C.s200}`,
      padding: "0 32px",
      display: "flex", alignItems:"center", justifyContent:"space-between",
      height: 64,
      boxShadow: "0 1px 0 rgba(0,0,0,.05)",
      position:"sticky", top:0, zIndex:100,
    }}>
      <Logo />
      <button onClick={onAdmin} style={{
        ...btnStyle("ghost"),
        color: C.s600, fontSize:13, border:`1px solid ${C.s200}`,
        borderRadius:8, padding:"7px 16px",
      }}>
        Admin Portal →
      </button>
    </div>
  );
}

function StepNav({ step, steps }) {
  // Filter out the "Lobby" step from the visible nav — it's an internal transition
  const visible = steps.map((s,i)=>({s,i})).filter(({s})=>s!=="Lobby");
  return (
    <div style={{ background:"#fff", borderBottom:`1px solid ${C.s200}`, padding:"0 32px", overflowX:"auto" }}>
      <div style={{ display:"flex", gap:0, minWidth:"fit-content" }}>
        {visible.map(({s,i}, vi) => {
          const done=i<step, active=i===step;
          return (
            <div key={s} style={{
              display:"flex", alignItems:"center", gap:10,
              padding:"14px 20px", fontSize:12, fontWeight:active?700:500,
              color: active?C.brand:done?C.teal:C.s400,
              borderBottom:`2px solid ${active?C.brand:done?C.teal:"transparent"}`,
              transition:"all .2s", whiteSpace:"nowrap",
            }}>
              <div style={{
                width:22, height:22, borderRadius:"50%", fontSize:11, fontWeight:800,
                display:"flex", alignItems:"center", justifyContent:"center",
                background: done?C.tealL:active?C.brandL:C.s100,
                color: done?C.teal:active?C.brand:C.s400,
                flexShrink:0,
              }}>{done?"✓":vi+1}</div>
              {s}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Helper: request / exit fullscreen
const enterFullscreen = () => {
  const el = document.documentElement;
  (el.requestFullscreen||el.webkitRequestFullscreen||el.mozRequestFullScreen||el.msRequestFullscreen)?.call(el).catch(()=>{});
};
const exitFullscreen = () => {
  (document.exitFullscreen||document.webkitExitFullscreen||document.mozCancelFullScreen||document.msExitFullscreen)?.call(document).catch(()=>{});
};

// Pre-test countdown screen — shown 60 s before each section starts
// ── 10-MINUTE BREAK SCREEN between sections ───────────────────────────────────
function BreakScreen({ nextSection, onContinue }) {
  const [left, setLeft] = useState(10 * 60);
  useEffect(()=>{
    if(left<=0){ onContinue(); return; }
    const t = setTimeout(()=>setLeft(l=>l-1), 1000);
    return ()=>clearTimeout(t);
  },[left]);
  const mins = Math.floor(left/60);
  const secs = left%60;
  const pct  = left/(10*60);
  const urgent = left < 60;
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      height:"calc(100vh - 130px)",background:"#0F172A",gap:32,padding:32}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:13,color:"rgba(255,255,255,.5)",fontWeight:700,letterSpacing:"0.15em",
          textTransform:"uppercase",marginBottom:8}}>Section Complete</div>
        <div style={{fontSize:28,fontWeight:800,color:"#fff",marginBottom:4}}>Break Time ☕</div>
        <div style={{fontSize:14,color:"rgba(255,255,255,.4)",maxWidth:360,lineHeight:1.6}}>
          Next up: <strong style={{color:"#11CD87"}}>{nextSection}</strong>.<br/>
          The break will end automatically. You may leave your seat.
        </div>
      </div>
      {/* Circular countdown */}
      <div style={{position:"relative",width:180,height:180}}>
        <svg width="180" height="180" style={{transform:"rotate(-90deg)"}}>
          <circle cx="90" cy="90" r="80" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="10"/>
          <circle cx="90" cy="90" r="80" fill="none"
            stroke={urgent?"#E11D48":"#11CD87"} strokeWidth="10"
            strokeDasharray={`${2*Math.PI*80}`}
            strokeDashoffset={`${2*Math.PI*80*(1-pct)}`}
            strokeLinecap="round" style={{transition:"stroke-dashoffset 1s linear"}}/>
        </svg>
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",
          alignItems:"center",justifyContent:"center"}}>
          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:36,fontWeight:900,
            color:urgent?"#E11D48":"#11CD87",lineHeight:1}}>
            {String(mins).padStart(2,"0")}:{String(secs).padStart(2,"0")}
          </div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.4)",marginTop:4}}>remaining</div>
        </div>
      </div>
      <button onClick={onContinue} style={{background:"#11CD87",color:"#064E3B",border:"none",
        borderRadius:12,padding:"12px 36px",fontSize:14,fontWeight:800,cursor:"pointer"}}>
        Skip Break — Start {nextSection} Now →
      </button>
    </div>
  );
}

function PreTestScreen({ icon, label, color="#11CD87", onStart }) {
  const [left, setLeft] = useState(60);
  const doStart = () => { onStart(); };
  useEffect(()=>{
    if(left<=0){doStart();return;}
    const t=setTimeout(()=>setLeft(l=>l-1),1000);
    return()=>clearTimeout(t);
  },[left]);
  const pct = left/60;
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      height:"calc(100vh - 130px)",background:"#0F172A",gap:32,padding:32}}>
      <div style={{fontSize:56}}>{icon}</div>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:13,color:"rgba(255,255,255,.5)",fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:8}}>
          Upcoming Section
        </div>
        <div style={{fontSize:28,fontWeight:800,color:"#fff",marginBottom:4}}>{label}</div>
        <div style={{fontSize:13,color:"rgba(255,255,255,.4)"}}>Please prepare. The test will begin shortly.</div>
      </div>
      {/* Circular countdown */}
      <div style={{position:"relative",width:160,height:160}}>
        <svg width="160" height="160" style={{transform:"rotate(-90deg)"}}>
          <circle cx="80" cy="80" r="70" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="8"/>
          <circle cx="80" cy="80" r="70" fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={`${2*Math.PI*70}`}
            strokeDashoffset={`${2*Math.PI*70*(1-pct)}`}
            strokeLinecap="round" style={{transition:"stroke-dashoffset 1s linear"}}/>
        </svg>
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:42,fontWeight:900,color,lineHeight:1}}>{left}</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.4)",marginTop:4}}>seconds</div>
        </div>
      </div>
      <button onClick={doStart} style={{background:color,color:"#064E3B",border:"none",borderRadius:12,
        padding:"12px 32px",fontSize:14,fontWeight:800,cursor:"pointer",letterSpacing:"0.03em"}}>
        Start Now →
      </button>
    </div>
  );
}

function Countdown({ seconds, onExpire }) {
  const [left, setLeft] = useState(seconds);
  useEffect(()=>{
    if(left<=0){onExpire?.();return;}
    const t=setTimeout(()=>setLeft(l=>l-1),1000);
    return()=>clearTimeout(t);
  },[left]);
  const urgent  = left < 300;   // last 5 min → red
  const warning = left < 600;   // last 10 min → amber
  const col = urgent ? "#FF4D6D" : warning ? "#FFB703" : "#4ADE80";
  const bg  = urgent ? "rgba(255,30,60,.15)" : warning ? "rgba(255,183,3,.1)" : "rgba(0,0,0,.18)";
  const bdr = urgent ? "rgba(255,30,60,.5)"  : warning ? "rgba(255,183,3,.4)"  : "rgba(255,255,255,.15)";
  return (
    <div style={{
      display:"flex", alignItems:"center", gap:10,
      background: bg,
      border: `1.5px solid ${bdr}`,
      borderRadius: 10,
      padding: "7px 14px",
      animation: urgent ? "pulse 0.8s ease-in-out infinite" : "none",
    }}>
      {/* Time display */}
      <span style={{fontSize:13,opacity:.6}}>{urgent?"🔴":warning?"🟡":"⏱"}</span>
      <div>
        <div style={{fontSize:9,color:"rgba(255,255,255,.45)",fontWeight:700,letterSpacing:"0.1em",
          textTransform:"uppercase",lineHeight:1,marginBottom:2}}>Time Left</div>
        <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:22,fontWeight:800,
          color:col,lineHeight:1,letterSpacing:"-0.01em"}}>
          {fmtTime(left)}
        </div>
        {urgent && (
          <div style={{fontSize:9,color:col,fontWeight:700,marginTop:2,letterSpacing:"0.04em"}}>
            ⚠ under 5 min
          </div>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ icon, label, title, right, onExit, candidateInfo }) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
      borderBottom: "1px solid rgba(255,255,255,.08)",
    }}>
      {/* Candidate identification bar */}
      {candidateInfo&&(
        <div style={{
          background:"rgba(17,205,135,.08)",
          borderBottom:"1px solid rgba(17,205,135,.15)",
          padding:"6px 32px",
          display:"flex",alignItems:"center",gap:16,
        }}>
          <span style={{fontSize:11,color:"rgba(17,205,135,.7)",fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase"}}>
            👤 Candidate
          </span>
          <span style={{fontSize:13,color:"#fff",fontWeight:700}}>
            {candidateInfo.name||"—"}
          </span>
          {candidateInfo.id&&(
            <span style={{fontSize:11,color:"rgba(255,255,255,.35)",fontFamily:"'JetBrains Mono',monospace",marginLeft:4}}>
              ID: {candidateInfo.id}
            </span>
          )}
          {candidateInfo.email&&(
            <span style={{fontSize:11,color:"rgba(255,255,255,.3)",marginLeft:4}}>
              {candidateInfo.email}
            </span>
          )}
        </div>
      )}
      {/* Section title row */}
      <div style={{padding:"14px 32px", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <div>
          <div style={{ color:"rgba(255,255,255,.45)", fontSize:11, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:4 }}>
            {icon} {label}
          </div>
          <h2 style={{ color:"#fff", fontSize:20, fontWeight:800, letterSpacing:"-0.02em" }}>{title}</h2>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {right}
          {onExit&&(
            <button onClick={onExit} style={{
              background:"rgba(225,29,72,.85)",color:"#fff",border:"none",
              borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer",
              display:"flex",alignItems:"center",gap:5,letterSpacing:"0.02em",
              boxShadow:"0 2px 8px rgba(225,29,72,.35)",
            }}>🚪 Exit</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── REGISTRATION ──────────────────────────────────────────────────────────────
function Registration({ onNext }) {
  const [form, setForm] = useState({name:"",email:"",phone:"",dob:"",nationality:"",testType:"Academic"});
  const [errors, setErrors] = useState({});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const validate=()=>{
    const e={};
    if(!form.name.trim())e.name="Required";
    if(!/\S+@\S+\.\S+/.test(form.email))e.email="Valid email required";
    if(!form.phone.trim())e.phone="Required";
    if(!form.dob)e.dob="Required";
    setErrors(e); return !Object.keys(e).length;
  };
  return (
    <div style={{maxWidth:580,margin:"48px auto",padding:"0 24px"}}>
      <div style={{textAlign:"center",marginBottom:36}}>
        <div style={{...tagStyle(),marginBottom:12}}>Candidate Registration</div>
        <h2 style={{fontSize:28,fontWeight:800,color:C.s900,letterSpacing:"-0.03em",marginBottom:8}}>Begin Your IELTS Test</h2>
        <p style={{color:C.s400,fontSize:14}}>Please complete your details accurately before starting</p>
      </div>
      <div style={{...cardStyle(),padding:32}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
          {[["Full Name","name","text","John Smith",true],["Email","email","email","you@example.com",true],["Phone","phone","tel","+1 234 567 8900",true],["Date of Birth","dob","date","",true],["Nationality","nationality","text","e.g. Armenian",false]].map(([lbl,key,type,ph,req])=>(
            <div key={key} style={key==="nationality"?{gridColumn:"1/-1"}:{}}>
              <label style={labelStyle}>{lbl}{req&&<span style={{color:C.rose}}> *</span>}</label>
              <input type={type} value={form[key]} onChange={e=>set(key,e.target.value)} placeholder={ph}
                style={{...inputStyle,borderColor:errors[key]?C.rose:C.s200}}/>
              {errors[key]&&<div style={{color:C.rose,fontSize:11,marginTop:4}}>{errors[key]}</div>}
            </div>
          ))}
        </div>
        <div style={{marginBottom:24}}>
          <label style={labelStyle}>Test Type</label>
          <div style={{display:"flex",gap:10}}>
            {["Academic","General Training"].map(t=>(
              <button key={t} onClick={()=>set("testType",t)} style={{
                flex:1,padding:"11px",borderRadius:10,fontWeight:700,fontSize:14,cursor:"pointer",transition:"all .15s",
                background:form.testType===t?C.brand:"#fff",
                border:`1.5px solid ${form.testType===t?C.brand:C.s200}`,
                color:form.testType===t?"#fff":C.s600,
                boxShadow:form.testType===t?"0 2px 8px rgba(17,205,135,.3)":"none",
              }}>{t}</button>
            ))}
          </div>
        </div>
        <div style={{background:C.brandL,borderRadius:10,padding:"12px 16px",fontSize:12,color:C.brand,marginBottom:24}}>
          ℹ️ Your details will be stored securely and visible in the admin dashboard.
        </div>
        <button onClick={()=>validate()&&onNext({...form,id:genId("CAND")})}
          style={{...btnStyle("primary"),width:"100%",padding:"13px",fontSize:15,borderRadius:12}}>
          Start Test →
        </button>
      </div>
    </div>
  );
}

// ── LISTENING TEST ────────────────────────────────────────────────────────────
function ListeningTest({ onComplete, testData, onExit, candidateInfo }) {
  const [ready, setReady]           = useState(false); // pre-test countdown
  const [phase, setPhase]           = useState("main"); // "main" | "checking"
  const [answers, setAnswers]       = useState({});
  const [submitted, setSubmitted]   = useState(false);
  const [secIdx, setSecIdx]         = useState(0);
  const audioRef                    = useRef(null);
  const lastTimeRef                 = useRef(0);
  const testActiveRef               = useRef(false);

  // Keep ref in sync so beforeunload always reads current state
  useEffect(()=>{ testActiveRef.current = ready && !submitted; }, [ready, submitted]);

  // Attach beforeunload ONCE — uses ref to check if test is active
  useEffect(()=>{
    const handler = e => {
      if(!testActiveRef.current) return;
      e.preventDefault();
      e.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // Reset audio seek tracker when section changes
  useEffect(()=>{ lastTimeRef.current = 0; }, [secIdx]);

  if(!ready) return <PreTestScreen icon="🎧" label="Listening Test" onStart={()=>setReady(true)}/>;
  // Build sections — supports new multi-section format, old flat questions array, or built-in
  let sections;
  if(testData?.sections?.length>0) {
    let qOffset=0;
    sections=testData.sections.map((s,i)=>{
      const qs=(s.questions||[]).map((q,j)=>({...q,id:qOffset+j+1}));
      qOffset+=qs.length;
      return {label:s.title||`Section ${i+1}`,instructions:s.instructions||"Answer the following questions.",questions:qs,audioUrl:s.audioUrl||null};
    });
  } else if(testData?.questions?.length>0) {
    sections=[{label:testData.title||"Section 1",instructions:"Answer the following questions.",questions:testData.questions.map((q,i)=>({...q,id:i+1}))}];
  } else {
    sections=LISTENING_SECTIONS;
  }

  const allQ   = sections.flatMap(s=>s.questions);
  const answered = Object.keys(answers).length;

  // MCQ answers are stored as {text, idx} objects; other types are plain strings
  const answerText = raw => (raw && typeof raw==="object") ? raw.text : (raw||"");

  const scoreAnswer = (q, raw) => {
    const a = answerText(raw).trim().toLowerCase();
    const c = (q.correct||"").trim().toLowerCase();
    if(!a||!c) return false;
    if(q.type==="yesno"||q.type==="truefalse") return a===c;
    if(TEXT_INPUT_TYPES.has(q.type)||q.type==="short"||q.type==="fillblank")
      return a===c || a.includes(c) || c.includes(a);
    // option-based (mcq, matching)
    if(raw && typeof raw==="object" && typeof q.correctIdx==="number") return raw.idx===q.correctIdx;
    if(a===c) return true;
    const al=a.replace(/[^a-h]/g,"")[0], cl=c.replace(/[^a-h]/g,"")[0];
    return !!(al&&cl&&al===cl);
  };

  const handleSubmit = () => {
    if(submitted) return;
    setSubmitted(true);
    let correct=0;
    allQ.forEach(q=>{ if(scoreAnswer(q,answers[q.id])) correct++; });
    setTimeout(()=>onComplete({correct,total:allQ.length,answers,allQuestions:allQ}),600);
  };

  const handleMainExpire = () => { if(!submitted) setPhase("checking"); };

  // 10-min checking phase overlay
  if(phase==="checking" && !submitted) return (
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 130px)"}}>
      <SectionHeader icon="🎧" label="Listening Test" title="Checking Time"
        right={<Countdown seconds={10*60} onExpire={handleSubmit}/>} onExit={onExit} candidateInfo={candidateInfo}/>
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
        background:"#0F172A",gap:24,padding:32}}>
        <div style={{fontSize:48}}>🔍</div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:24,fontWeight:800,color:"#fff",marginBottom:8}}>Checking Time</div>
          <div style={{fontSize:14,color:"rgba(255,255,255,.5)",maxWidth:420,lineHeight:1.6}}>
            The listening section has ended. You have <strong style={{color:"#11CD87"}}>10 minutes</strong> to review and check your answers before they are submitted automatically.
          </div>
        </div>
        <button onClick={handleSubmit}
          style={{background:"#11CD87",color:"#064E3B",border:"none",borderRadius:12,padding:"12px 32px",fontSize:14,fontWeight:800,cursor:"pointer"}}>
          Submit Answers Now
        </button>
      </div>
    </div>
  );

  const sec = sections[secIdx];

  return (
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 130px)"}}>
      <SectionHeader icon="🎧" label="Listening Test" title="IELTS Academic Listening"
        right={<Countdown seconds={40*60} onExpire={handleMainExpire}/>} onExit={onExit} candidateInfo={candidateInfo}/>

      <div style={{display:"grid",gridTemplateColumns:"300px 1fr",flex:1,overflow:"hidden"}}>
        {/* Sidebar */}
        <div style={{background:C.s900,display:"flex",flexDirection:"column",overflow:"auto"}}>
          {/* Audio player */}
          <div style={{padding:20,borderBottom:"1px solid rgba(255,255,255,.08)"}}>
            <div style={{color:"rgba(255,255,255,.4)",fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10}}>
              Audio Recording
            </div>
            {sec.audioUrl?(
              <div>
                <div style={{background:"rgba(255,255,255,.05)",borderRadius:12,padding:14,border:"1px solid rgba(255,255,255,.1)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                    <span style={{fontSize:16}}>🎵</span>
                    <span style={{color:"rgba(255,255,255,.7)",fontSize:12,fontWeight:600}}>{sec.label}</span>
                  </div>
                  <audio ref={audioRef} controls autoPlay src={sec.audioUrl} style={{width:"100%",height:36}}
                    controlsList="nodownload noplaybackrate" preload="auto"
                    onTimeUpdate={e=>{ lastTimeRef.current = e.target.currentTime; }}
                    onSeeking={e=>{ e.target.currentTime = lastTimeRef.current; }}
                    onPause={e=>{ if(!submitted && phase==="main") e.target.play().catch(()=>{}); }}
                    onEnded={()=>{ if(secIdx < sections.length-1) setTimeout(()=>setSecIdx(i=>i+1), 800); }}/>
                </div>
                <div style={{marginTop:8,padding:"6px 10px",background:"rgba(13,148,136,.12)",border:"1px solid rgba(13,148,136,.25)",borderRadius:7}}>
                  <p style={{color:"rgba(100,255,220,.8)",fontSize:11,lineHeight:1.5}}>▶ Press play to start. Audio changes with each section.</p>
                </div>
              </div>
            ):(
              <div style={{background:"rgba(255,255,255,.05)",borderRadius:12,padding:"20px 14px",border:"1px solid rgba(255,255,255,.1)",textAlign:"center"}}>
                <div style={{fontSize:28,marginBottom:8}}>🎵</div>
                <div style={{color:"rgba(255,255,255,.5)",fontSize:12}}>No audio uploaded for this section.</div>
                <div style={{color:"rgba(255,255,255,.3)",fontSize:11,marginTop:4}}>Admin can upload audio in the Section Builder.</div>
              </div>
            )}
          </div>

          {/* Section nav */}
          <div style={{padding:16,flex:1}}>
            <div style={{color:"rgba(255,255,255,.3)",fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10}}>Sections</div>
            {sections.map((s,i)=>{
              const n=s.questions.filter(q=>answers[q.id]).length;
              const active=secIdx===i;
              return (
                <button key={i} onClick={()=>setSecIdx(i)} style={{
                  display:"flex",alignItems:"center",justifyContent:"space-between",
                  width:"100%",padding:"10px 14px",marginBottom:4,borderRadius:10,border:"none",cursor:"pointer",textAlign:"left",
                  background:active?"rgba(17,205,135,.25)":"rgba(255,255,255,.04)",
                  borderLeft:`3px solid ${active?C.brandM:"transparent"}`,
                }}>
                  <span style={{color:active?"#fff":"rgba(255,255,255,.5)",fontSize:12,fontWeight:active?700:400}}>{s.label}</span>
                  <span style={{fontSize:11,color:n===s.questions.length?C.teal:"rgba(255,255,255,.3)",fontWeight:700}}>{n}/{s.questions.length}</span>
                </button>
              );
            })}
          </div>

          {/* Overall progress */}
          <div style={{padding:"14px 16px",borderTop:"1px solid rgba(255,255,255,.08)"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <span style={{color:"rgba(255,255,255,.4)",fontSize:11}}>Progress</span>
              <span style={{color:"#fff",fontSize:11,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{answered}/{allQ.length}</span>
            </div>
            <div style={{height:4,background:"rgba(255,255,255,.08)",borderRadius:99}}>
              <div style={{width:`${answered/allQ.length*100}%`,height:"100%",background:"linear-gradient(90deg,#11CD87,#0BA870)",borderRadius:99,transition:"width .3s"}}/>
            </div>
          </div>
        </div>

        {/* Questions panel */}
        <div style={{overflow:"auto",padding:28,background:C.bg}}>
          <div className="fu">
            <div style={{...cardStyle(),padding:"14px 18px",marginBottom:20,borderLeft:`4px solid ${C.brand}`}}>
              <p style={{fontWeight:700,color:C.s900,marginBottom:4,fontSize:14}}>{sec.label}</p>
              {sec.instructions.split("\n").map((line,i)=>(
                <p key={i} style={{color:C.s400,fontSize:13,lineHeight:1.6}}>{line}</p>
              ))}
            </div>

            {(()=>{
              // Group consecutive 'matching' questions; render all others individually
              const rendered=[];
              let i=0;
              while(i<sec.questions.length){
                const q=sec.questions[i];
                if(q.type==="matching"){
                  const grp=[];
                  while(i<sec.questions.length&&sec.questions[i].type==="matching"){grp.push(sec.questions[i]);i++;}
                  rendered.push(<MatchingGroup key={grp[0].id} questions={grp} answers={answers} submitted={submitted}
                    scoreQ={scoreAnswer} onChange={(id,v)=>setAnswers(a=>({...a,[id]:v}))}/>);
                } else {
                  rendered.push(<ListeningQ key={q.id} q={q} answer={answers[q.id]} submitted={submitted}
                    correct={submitted?scoreAnswer(q,answers[q.id]):null}
                    onChange={v=>setAnswers(a=>({...a,[q.id]:v}))}/>);
                  i++;
                }
              }
              return rendered;
            })()}

            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:24,paddingTop:20,borderTop:`1px solid ${C.s200}`}}>
              {secIdx>0&&<button onClick={()=>setSecIdx(i=>i-1)} style={{...btnStyle("ghost"),color:C.brand}}>← Previous</button>}
              <div style={{marginLeft:"auto",display:"flex",gap:10}}>
                {secIdx<sections.length-1?(
                  <button onClick={()=>setSecIdx(i=>i+1)} style={btnStyle("secondary")}>Next Section →</button>
                ):(
                  <button onClick={handleSubmit} disabled={submitted} style={btnStyle("primary",submitted)}>
                    {submitted?"✓ Submitted…":"Submit Listening"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskInstructionBlock({ instructions }) {
  if(!instructions) return null;
  return (
    <div style={{background:"#FFFBF0",border:"1px solid #FDE68A",borderRadius:8,padding:"10px 14px",marginBottom:10}}>
      {instructions.split("\n").map((line,i)=>(
        <div key={i} style={{fontSize:13,color:C.s800,lineHeight:1.6,fontWeight:i===0?700:400}}>{line}</div>
      ))}
    </div>
  );
}

function ListeningQ({ q, answer, submitted, correct, onChange }) {
  const borderCol = submitted?(correct===true?C.teal:correct===false?C.rose:C.s200):C.s200;
  const isOptionType = OPTION_TYPES.has(q.type);
  const isTextInput  = TEXT_INPUT_TYPES.has(q.type)||q.type==="short";
  const isTF = q.type==="truefalse";
  const isYN = q.type==="yesno";
  const fixedChoices = isTF?["TRUE","FALSE","NOT GIVEN"]:isYN?["YES","NO","NOT GIVEN"]:null;
  const inputHint = q.hint || (isTextInput?"Write your answer":"");
  return (
    <>
    {q.instructions&&<TaskInstructionBlock instructions={q.instructions}/>}
    {q.diagramImage&&(
      <div style={{marginBottom:8,borderRadius:10,overflow:"hidden",border:`2px solid ${C.brand}`,background:C.s100,cursor:"pointer"}}
        onClick={()=>{ const w=window.open(); w.document.write(`<img src="${q.diagramImage}" style="max-width:100%;height:auto;display:block;margin:auto;">`); }}>
        <img src={q.diagramImage} alt="Diagram / Map" style={{width:"100%",maxHeight:340,objectFit:"contain",display:"block",background:"#fff"}}/>
        <div style={{background:"linear-gradient(transparent,rgba(15,23,42,.6))",padding:"10px",textAlign:"center"}}>
          <span style={{color:"#fff",fontSize:11,fontWeight:700}}>🔍 Click to open full size</span>
        </div>
      </div>
    )}

    <div style={{...cardStyle({borderLeft:`4px solid ${borderCol}`,marginBottom:10,padding:16})}}>
      <div style={{display:"flex",gap:10,marginBottom:10}}>
        <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:700,color:C.brand,background:C.brandL,borderRadius:6,padding:"2px 7px",flexShrink:0,marginTop:2}}>{q.id}</span>
        <p style={{color:C.s900,fontSize:13,lineHeight:1.5,flex:1,fontWeight:500}}>{q.text}</p>
      </div>

      {isOptionType&&(
        <div style={{display:"flex",flexDirection:"column",gap:5,marginLeft:40}}>
          {(q.options||[]).map((opt,oi)=>{
            const sel = answer && (typeof answer==="object" ? answer.idx===oi : answer===opt);
            const correctLetter = (q.correct||"").trim().toUpperCase()[0];
            const optLetter     = opt.trim().toUpperCase()[0];
            const isAns = submitted && (
              q.correct.trim()===opt.trim() ||
              (correctLetter && optLetter && correctLetter===optLetter && /^[A-H]/.test(correctLetter))
            );
            const isWrong = submitted && sel && !isAns;
            return (
              <button key={oi} onClick={()=>!submitted&&onChange({text:opt,idx:oi})} style={{
                textAlign:"left",padding:"7px 12px",borderRadius:8,fontSize:12,transition:"all .1s",
                border:`1.5px solid ${isAns?C.teal:isWrong?C.rose:sel?C.brand:C.s200}`,
                background:isAns?C.tealL:isWrong?C.roseL:sel?C.brandL:"#fff",
                color:C.s900,cursor:submitted?"default":"pointer",fontWeight:sel||isAns?600:400,
              }}>
                <span style={{fontWeight:800,marginRight:8,color:C.s400}}>{String.fromCharCode(65+oi)}.</span>{opt}
              </button>
            );
          })}
        </div>
      )}

      {fixedChoices&&(
        <div style={{display:"flex",gap:8,marginLeft:40,flexWrap:"wrap"}}>
          {fixedChoices.map(choice=>{
            const sel = answer===choice;
            const isAns = submitted && (q.correct||"").trim().toUpperCase()===choice;
            const isWrong = submitted && sel && !isAns;
            return (
              <button key={choice} onClick={()=>!submitted&&onChange(choice)} style={{
                padding:"7px 16px",borderRadius:8,fontSize:12,fontWeight:sel||isAns?700:400,
                border:`1.5px solid ${isAns?C.teal:isWrong?C.rose:sel?C.brand:C.s200}`,
                background:isAns?C.tealL:isWrong?C.roseL:sel?C.brandL:"#fff",
                color:C.s900,cursor:submitted?"default":"pointer",transition:"all .1s",
              }}>
                {choice}
              </button>
            );
          })}
          {submitted&&<div style={{width:"100%",color:correct?C.teal:C.rose,fontSize:12,marginTop:4,fontWeight:600}}>
            {correct?"✓ Correct":(q.correct?`✗ Correct: ${q.correct}`:"⚠ No answer key set")}
          </div>}
        </div>
      )}

      {isTextInput&&(
        <div style={{marginLeft:40}}>
          <input value={answer||""} onChange={e=>!submitted&&onChange(e.target.value)}
            placeholder={inputHint||"Your answer…"} disabled={submitted}
            style={{...inputStyle,borderRadius:8,borderColor:submitted?(correct?C.teal:answer?C.rose:C.s200):C.s200}}/>
          {submitted&&answer&&<div style={{color:correct?C.teal:C.rose,fontSize:12,marginTop:5,fontWeight:600}}>
            {correct?"✓ Correct":(q.correct?`✗ Answer: "${q.correct}"`:"⚠ No answer key set")}
          </div>}
        </div>
      )}
    </div>
    </>
  );
}

// ── READING TEST ──────────────────────────────────────────────────────────────
function ReadingTest({ onComplete, testData, onExit, candidateInfo }) {
  const [ready, setReady]         = useState(false);
  const [pIdx, setPIdx]           = useState(0);
  const [answers, setAnswers]     = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore]         = useState(null);
  const [highlights, setHl]       = useState([]);
  const [hlColor, setHlColor]     = useState("y");
  const passRef = useRef(null);

  const testActiveRef2 = useRef(false);
  useEffect(()=>{ testActiveRef2.current = ready && !submitted; }, [ready, submitted]);
  useEffect(()=>{
    const handler = e => { if(!testActiveRef2.current) return; e.preventDefault(); e.returnValue = ""; return ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  if(!ready) return <PreTestScreen icon="📖" label="Reading Test" onStart={()=>setReady(true)}/>;
  // Build sections & passage map — supports new multi-passage format, old single-passage, or built-in
  let extraPassages = {};
  let sections;
  if(testData?.passages?.length>0) {
    let qOffset=0;
    sections = testData.passages.map((p,i)=>{
      const key=`_cp_${i}`;
      extraPassages[key]={title:p.title||`Passage ${i+1}`,text:p.text||""};
      const qs=(p.questions||[]).map((q,j)=>({...q,id:qOffset+j+1}));
      qOffset+=qs.length;
      return {id:key,passageKey:key,label:`Passage ${i+1}${p.title?` — ${p.title}`:""}`,questions:qs};
    });
  } else if(testData?.questions?.length>0) {
    extraPassages["_custom"]={title:testData.title||"Reading Passage",text:testData.passage||""};
    sections=[{id:"_custom",passageKey:"_custom",label:testData.title||"Passage 1",questions:testData.questions.map((q,i)=>({...q,id:i+1}))}];
  } else {
    sections=READING_SECTIONS;
  }
  const allPassages={...PASSAGES,...extraPassages};

  const sec = sections[pIdx];
  const passage = allPassages[sec.passageKey];
  const allQ = sections.flatMap(s=>s.questions);
  const answered = Object.keys(answers).length;

  const onMouseUp = () => {
    const sel = window.getSelection();
    if(!sel||sel.isCollapsed) return;
    const text = sel.toString().trim();
    if(text.length<3) return;
    if(!passRef.current?.contains(sel.getRangeAt(0).commonAncestorContainer)) return;
    setHl(h=>[...h,{id:Date.now(),passageKey:sec.passageKey,text,color:hlColor}]);
    sel.removeAllRanges();
  };

  const renderPassage = (raw, key) => {
    let out = raw.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    highlights.filter(h=>h.passageKey===key).forEach(h=>{
      const escaped = h.text.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
      out = out.replace(new RegExp(escaped,"g"), `<mark class="hl-${h.color}">${h.text}</mark>`);
    });
    return out.replace(/\n\n/g,"</p><p style='margin-bottom:16px'>").replace(/\n/g,"<br/>");
  };

  // Extract plain text from MCQ {text,idx} object or plain string
  const rawText = v => (v && typeof v==="object") ? v.text : (v||"");

  const scoreQ = (q,a) => {
    if(!a) return false;
    const av = rawText(a).trim().toLowerCase();
    const cv = (q.correct||"").trim().toLowerCase();
    if(!cv) return false;
    if(q.type==="yesno"||q.type==="truefalse") return av===cv;
    if(TEXT_INPUT_TYPES.has(q.type)||q.type==="fillblank"||q.type==="short_answer")
      return av===cv || av.includes(cv) || cv.includes(av);
    // option-based: full text match first, then letter prefix
    if(av===cv) return true;
    const al=av.replace(/[^a-h]/g,"")[0], cl=cv.replace(/[^a-h]/g,"")[0];
    return !!(al&&cl&&al===cl);
  };

  const handleSubmit = () => {
    if(submitted) return;
    setSubmitted(true);
    let correct=0;
    allQ.forEach(q=>{ if(scoreQ(q,answers[q.id])) correct++; });
    setScore({correct, total:allQ.length});
  };
  const handleContinue = () => onComplete({correct:score.correct, total:score.total, answers, allQuestions:allQ});

  return (
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 130px)"}}>
      <SectionHeader icon="📖" label="Reading Test" title="IELTS Academic Reading"
        right={<Countdown seconds={60*60} onExpire={handleSubmit}/>} onExit={onExit} candidateInfo={candidateInfo}/>

      {/* Tab bar + highlight tools */}
      <div style={{background:"#fff",borderBottom:`1px solid ${C.s200}`,padding:"0 24px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}>
        <div style={{display:"flex"}}>
          {sections.map((s,i)=>{
            const done=s.questions.filter(q=>answers[q.id]).length;
            const active=pIdx===i;
            return (
              <button key={s.id||i} onClick={()=>setPIdx(i)} style={{
                padding:"12px 18px",border:"none",cursor:"pointer",fontSize:13,fontWeight:active?700:500,
                borderBottom:`2px solid ${active?C.brand:"transparent"}`,
                background:"transparent",color:active?C.brand:C.s400,transition:"all .15s",
              }}>
                {s.label.split("—")[0].trim()}
                <span style={{marginLeft:6,fontSize:11,color:done===s.questions.length?C.teal:C.s400}}>({done}/{s.questions.length})</span>
              </button>
            );
          })}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0"}}>
          <span style={{fontSize:11,color:C.s400,fontWeight:600}}>HIGHLIGHT:</span>
          {[["y",C.hlY,"Yellow"],["b",C.hlB,"Blue"]].map(([val,bg,name])=>(
            <button key={val} onClick={()=>setHlColor(val)} title={`${name} highlight`} style={{
              width:22,height:22,borderRadius:5,cursor:"pointer",background:bg,
              border:`2px solid ${hlColor===val?C.s900:"transparent"}`,
            }}/>
          ))}
          <button onClick={()=>setHl(h=>h.filter(hi=>hi.passageKey!==sec.passageKey))} style={{
            ...btnStyle("ghost"),fontSize:11,padding:"4px 10px",color:C.rose,fontWeight:700,
          }}>✕ Clear</button>
          <span style={{fontSize:11,color:C.s400}}>Select text to highlight</span>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",flex:1,overflow:"hidden"}}>
        {/* Passage */}
        <div style={{overflow:"auto",padding:28,borderRight:`1px solid ${C.s200}`,background:"#fff"}} ref={passRef} onMouseUp={onMouseUp}>
          <h3 style={{fontSize:18,fontWeight:800,color:C.s900,marginBottom:20,letterSpacing:"-0.02em"}}>{passage.title}</h3>
          <div style={{fontSize:14,lineHeight:1.95,color:C.s800}}
            dangerouslySetInnerHTML={{__html:`<p style='margin-bottom:16px'>${renderPassage(passage.text,sec.passageKey)}</p>`}}/>
        </div>

        {/* Questions */}
        <div style={{overflow:"auto",padding:28,background:C.bg}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <h3 style={{fontSize:16,fontWeight:700,color:C.s900}}>{sec.label}</h3>
            <span style={{fontSize:12,color:C.s400,fontWeight:600}}>{answered}/{allQ.length} answered</span>
          </div>
          {(()=>{
            // Group consecutive same-type matching questions; render all others individually
            const HEADING_TYPES = new Set(["matching_headings"]);
            const GROUP_TYPES   = new Set(["matching_info","matching_features","matching_endings"]);
            const rendered=[];
            let i=0;
            while(i<sec.questions.length){
              const q=sec.questions[i];
              if(HEADING_TYPES.has(q.type)){
                const grp=[];
                while(i<sec.questions.length&&sec.questions[i].type===q.type){grp.push(sec.questions[i]);i++;}
                rendered.push(<MatchingHeadingsGroup key={grp[0].id} questions={grp} answers={answers} submitted={submitted} scoreQ={scoreQ} onChange={(id,v)=>setAnswers(a=>({...a,[id]:v}))}/>);
              } else if(GROUP_TYPES.has(q.type)){
                const grp=[];
                while(i<sec.questions.length&&sec.questions[i].type===q.type){grp.push(sec.questions[i]);i++;}
                rendered.push(<MatchingGroup key={grp[0].id} questions={grp} answers={answers} submitted={submitted} scoreQ={scoreQ} onChange={(id,v)=>setAnswers(a=>({...a,[id]:v}))}/>);
              } else {
                rendered.push(<ReadingQ key={q.id} q={q} answer={answers[q.id]} submitted={submitted}
                  correct={submitted?scoreQ(q,answers[q.id]):null} onChange={v=>setAnswers(a=>({...a,[q.id]:v}))}/>);
                i++;
              }
            }
            return rendered;
          })()}

          <div style={{marginTop:20,paddingTop:16,borderTop:`1px solid ${C.s200}`}}>
            {score?(
              <div>
                <div style={{...cardStyle({padding:20,marginBottom:14,borderLeft:`4px solid ${bandColor(readingBand(score.correct,score.total))}`}),background:bandBg(readingBand(score.correct,score.total))}}>
                  <div style={{fontSize:11,color:C.s400,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>📊 Reading Completed</div>
                  <div style={{display:"flex",alignItems:"baseline",gap:12,marginBottom:10}}>
                    <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:40,fontWeight:900,color:bandColor(readingBand(score.correct,score.total)),lineHeight:1}}>{score.correct}/{score.total}</span>
                    <div>
                      <div style={{fontSize:16,fontWeight:800,color:bandColor(readingBand(score.correct,score.total))}}>Band {readingBand(score.correct,score.total)}</div>
                      <div style={{fontSize:12,color:C.s600}}>{Math.round(score.correct/score.total*100)}% correct · {bandLabel(readingBand(score.correct,score.total))}</div>
                    </div>
                  </div>
                  <div style={{height:6,background:"rgba(0,0,0,.08)",borderRadius:99,marginBottom:8,overflow:"hidden"}}>
                    <div style={{width:`${score.correct/score.total*100}%`,height:"100%",background:bandColor(readingBand(score.correct,score.total)),borderRadius:99,transition:"width .8s ease"}}/>
                  </div>
                  <p style={{fontSize:12,color:C.s600,margin:0}}>✓ = correct &nbsp;✗ = wrong — review highlighted answers above, then continue.</p>
                </div>
                <button onClick={handleContinue} style={{...btnStyle("primary"),width:"100%",padding:13,fontSize:14,borderRadius:12}}>
                  Continue to Writing →
                </button>
              </div>
            ):pIdx<sections.length-1?(
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <span style={{fontSize:12,color:C.s400,alignSelf:"center"}}>Complete all passages before submitting</span>
                <button onClick={()=>setPIdx(i=>i+1)} style={btnStyle("secondary")}>Next Passage →</button>
              </div>
            ):(
              <button onClick={handleSubmit} style={{...btnStyle("primary"),width:"100%",padding:13,fontSize:14,borderRadius:12}}>
                Submit Reading & See Score
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Roman numeral helper for Matching Headings
const toRoman = n => {
  const t=[["x",10],["ix",9],["viii",8],["vii",7],["vi",6],["v",5],["iv",4],["iii",3],["ii",2],["i",1]];
  let o=""; for(const[s,v]of t)while(n>=v){o+=s;n-=v;} return o;
};

// Matching Headings group — shows shared headings list once (roman numerals), then paragraph rows
function MatchingHeadingsGroup({ questions, answers, submitted, scoreQ, onChange }) {
  const headings = questions[0]?.options || [];
  const taskInstructions = questions[0]?.instructions || "";
  // Track which headings are already used by other paragraphs
  const usedMap = {};
  questions.forEach(q=>{
    const a = answers[q.id];
    const t = a && typeof a==="object" ? a.text : (a||"");
    if(t) usedMap[t] = q.id;
  });
  return (
    <div style={{...cardStyle({marginBottom:14,overflow:"hidden",border:`1px solid ${C.s200}`})}}>
      {taskInstructions&&(
        <div style={{padding:"12px 18px",borderBottom:`1px solid ${C.s200}`,background:"#FFFBF0"}}>
          {taskInstructions.split("\n").map((line,i)=>(
            <div key={i} style={{fontSize:13,color:C.s800,lineHeight:1.6,fontWeight:i===0?700:400}}>{line}</div>
          ))}
        </div>
      )}
      <div style={{background:C.s100,padding:"14px 18px",borderBottom:`1px solid ${C.s200}`}}>
        <div style={{fontSize:10,fontWeight:800,color:C.s500,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6}}>List of Headings</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px 16px"}}>
          {headings.map((h,i)=>{
            const isUsed = !submitted && usedMap[h] !== undefined;
            return (
              <div key={i} style={{display:"flex",gap:8,fontSize:12,padding:"3px 0",alignItems:"baseline"}}>
                <span style={{fontWeight:800,color:C.brand,fontFamily:"'JetBrains Mono',monospace",minWidth:32,flexShrink:0}}>{toRoman(i+1)}.</span>
                <span style={{color:isUsed?C.s400:C.s800,lineHeight:1.4,textDecoration:isUsed?"line-through":"none"}}>{h}</span>
                {isUsed&&<span style={{fontSize:9,color:C.brand,fontWeight:700,background:"#fff",borderRadius:3,padding:"1px 5px",flexShrink:0}}>USED</span>}
              </div>
            );
          })}
        </div>
      </div>
      <div style={{padding:"10px 18px"}}>
        <div style={{fontSize:10,fontWeight:700,color:C.s400,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>
          Choose the correct heading for each paragraph — each heading can only be used once:
        </div>
        {questions.map(q=>{
          const ans = answers[q.id];
          const ansText = ans && typeof ans==="object" ? ans.text : (ans||"");
          const correct = submitted ? scoreQ(q,ans) : null;
          const borderCol = submitted?(correct===true?C.teal:correct===false?C.rose:C.s200):ansText?C.brand:C.s200;
          return (
            <div key={q.id} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 10px",marginBottom:6,borderRadius:8,
              border:`1.5px solid ${borderCol}`,background:submitted?(correct?C.tealL:ansText?C.roseL:"#fff"):ansText?"#F0FDF8":"#fff"}}>
              <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:700,color:C.brand,background:C.brandL,borderRadius:4,padding:"2px 7px",flexShrink:0}}>Q{q.id}</span>
              <span style={{fontSize:13,fontWeight:600,color:C.s900,flex:1}}>{q.text}</span>
              <select
                value={ansText}
                disabled={submitted}
                onChange={e=>{
                  const idx=headings.indexOf(e.target.value);
                  onChange(q.id,{text:e.target.value,idx});
                }}
                style={{...inputStyle,width:240,fontSize:12,padding:"6px 10px",
                  borderColor:submitted?(correct?C.teal:ansText?C.rose:C.s200):ansText?C.brand:C.s200,
                  background:submitted?(correct?C.tealL:ansText?C.roseL:"#fff"):"#fff"}}>
                <option value="">— Select heading —</option>
                {headings.map((h,i)=>{
                  const usedByOther = !submitted && usedMap[h] !== undefined && usedMap[h] !== q.id;
                  return (
                    <option key={i} value={h}>
                      {toRoman(i+1)}. {h}{usedByOther?" (already used)":""}
                    </option>
                  );
                })}
              </select>
              {submitted&&ansText&&correct&&(
                <span style={{fontSize:16,color:C.teal,flexShrink:0}}>✓</span>
              )}
              {submitted&&ansText&&!correct&&(
                <span style={{fontSize:11,color:C.teal,fontWeight:700,flexShrink:0,whiteSpace:"nowrap"}}>
                  ✓ {toRoman(headings.indexOf(q.correct)+1)}.
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Generic Matching group — shared options box (lettered A, B, C...), then per-question rows with dropdowns
// Used for: matching_info, matching_features, matching_endings (Reading) and matching (Listening)
const MATCH_GROUP_LABELS = {
  matching_info:     { box:"List of Paragraphs / Sections", row:"Match each statement to the correct paragraph — options may be used more than once:" },
  matching_features: { box:"List of Features / People / Places", row:"Match each item to the correct feature — options may be used more than once:" },
  matching_endings:  { box:"List of Sentence Endings", row:"Select the correct ending for each sentence — each ending can only be used once:" },
  matching:          { box:"List of Options", row:"Match each item to the correct option:" },
};
function MatchingGroup({ questions, answers, submitted, scoreQ, onChange }) {
  const options = questions[0]?.options || [];
  const type = questions[0]?.type || "matching";
  const labels = MATCH_GROUP_LABELS[type] || MATCH_GROUP_LABELS.matching;
  const taskInstructions = questions[0]?.instructions || "";
  // For sentence endings — each option used once; for others — reuse allowed
  const oneUseOnly = type==="matching_endings";
  const usedMap = {};
  if(oneUseOnly){
    questions.forEach(q=>{
      const a = answers[q.id];
      const t = a && typeof a==="object" ? a.text : (a||"");
      if(t) usedMap[t] = q.id;
    });
  }
  return (
    <div style={{...cardStyle({marginBottom:14,overflow:"hidden",border:`1px solid ${C.s200}`})}}>
      {taskInstructions&&(
        <div style={{padding:"12px 18px",borderBottom:`1px solid ${C.s200}`,background:"#FFFBF0"}}>
          {taskInstructions.split("\n").map((line,i)=>(
            <div key={i} style={{fontSize:13,color:C.s800,lineHeight:1.6,fontWeight:i===0?700:400}}>{line}</div>
          ))}
        </div>
      )}
      {/* Shared options box */}
      <div style={{background:C.s100,padding:"14px 18px",borderBottom:`1px solid ${C.s200}`}}>
        <div style={{fontSize:10,fontWeight:800,color:C.s500,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6}}>{labels.box}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px 16px"}}>
          {options.map((opt,i)=>{
            const isUsed = oneUseOnly && !submitted && usedMap[opt] !== undefined;
            return (
              <div key={i} style={{display:"flex",gap:8,fontSize:12,padding:"3px 0",alignItems:"baseline"}}>
                <span style={{fontWeight:800,color:C.brand,fontFamily:"'JetBrains Mono',monospace",minWidth:24,flexShrink:0}}>{String.fromCharCode(65+i)}.</span>
                <span style={{color:isUsed?C.s400:C.s800,lineHeight:1.4,textDecoration:isUsed?"line-through":"none"}}>{opt}</span>
                {isUsed&&<span style={{fontSize:9,color:C.brand,fontWeight:700,background:"#fff",borderRadius:3,padding:"1px 5px",flexShrink:0}}>USED</span>}
              </div>
            );
          })}
        </div>
      </div>
      {/* Per-question rows */}
      <div style={{padding:"10px 18px"}}>
        <div style={{fontSize:10,fontWeight:700,color:C.s400,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>
          {labels.row}
        </div>
        {questions.map(q=>{
          const ans = answers[q.id];
          const ansText = ans && typeof ans==="object" ? ans.text : (ans||"");
          const correct = submitted ? scoreQ(q,ans) : null;
          const borderCol = submitted?(correct===true?C.teal:correct===false?C.rose:C.s200):ansText?C.brand:C.s200;
          // Derive correct label for feedback
          const correctIdx = options.findIndex(o=>o.trim().toLowerCase()===(q.correct||"").trim().toLowerCase());
          const correctLabel = correctIdx>=0 ? `${String.fromCharCode(65+correctIdx)}. ${options[correctIdx]}` : q.correct;
          return (
            <div key={q.id} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 10px",marginBottom:6,borderRadius:8,
              border:`1.5px solid ${borderCol}`,background:submitted?(correct?C.tealL:ansText?C.roseL:"#fff"):ansText?"#F0FDF8":"#fff"}}>
              <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:700,color:C.brand,background:C.brandL,borderRadius:4,padding:"2px 7px",flexShrink:0}}>Q{q.id}</span>
              <span style={{fontSize:13,fontWeight:600,color:C.s900,flex:1}}>{q.text}</span>
              <select
                value={ansText}
                disabled={submitted}
                onChange={e=>{
                  const idx=options.indexOf(e.target.value);
                  onChange(q.id,{text:e.target.value,idx});
                }}
                style={{...inputStyle,width:240,fontSize:12,padding:"6px 10px",
                  borderColor:submitted?(correct?C.teal:ansText?C.rose:C.s200):ansText?C.brand:C.s200,
                  background:submitted?(correct?C.tealL:ansText?C.roseL:"#fff"):"#fff"}}>
                <option value="">— Select —</option>
                {options.map((opt,i)=>{
                  const usedByOther = oneUseOnly && !submitted && usedMap[opt] !== undefined && usedMap[opt] !== q.id;
                  return (
                    <option key={i} value={opt}>
                      {String.fromCharCode(65+i)}. {opt}{usedByOther?" (already used)":""}
                    </option>
                  );
                })}
              </select>
              {submitted&&ansText&&correct&&<span style={{fontSize:16,color:C.teal,flexShrink:0}}>✓</span>}
              {submitted&&ansText&&!correct&&(
                <span style={{fontSize:11,color:C.teal,fontWeight:700,flexShrink:0,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>✓ {correctLabel}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReadingQ({ q, answer, submitted, correct, onChange }) {
  const borderCol = submitted?(correct===true?C.teal:correct===false?C.rose:C.s200):C.s200;
  const isOptionType = OPTION_TYPES.has(q.type);
  const isTextInput  = TEXT_INPUT_TYPES.has(q.type);
  const isTF  = q.type==="truefalse";
  const isYN  = q.type==="yesno";
  const fixedChoices = isTF?["TRUE","FALSE","NOT GIVEN"]:isYN?["YES","NO","NOT GIVEN"]:null;
  const inputHint = q.hint || (isTextInput?"Write your answer":"");

  return (
    <>
    {q.instructions&&<TaskInstructionBlock instructions={q.instructions}/>}
    <div style={{...cardStyle({borderLeft:`4px solid ${borderCol}`,marginBottom:10,padding:16})}}>
      <div style={{display:"flex",gap:10,marginBottom:10}}>
        <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:700,color:C.brand,background:C.brandL,borderRadius:6,padding:"2px 7px",flexShrink:0,marginTop:1}}>Q{q.id}</span>
        <p style={{color:C.s900,fontSize:13,lineHeight:1.5,flex:1,fontWeight:500}}>{q.text}</p>
      </div>

      {/* Options list (MCQ, Matching variants) */}
      {isOptionType&&(
        <div style={{display:"flex",flexDirection:"column",gap:5,marginLeft:40}}>
          {(q.options||[]).map((opt,oi)=>{
            const sel = answer && (typeof answer==="object" ? answer.idx===oi : answer===opt);
            const correctLetter = (q.correct||"").trim().toUpperCase()[0];
            const optLetter     = opt.trim().toUpperCase()[0];
            const isAns = submitted && (
              q.correct.trim()===opt.trim() ||
              (correctLetter && optLetter && correctLetter===optLetter && /^[A-H]/.test(correctLetter))
            );
            const isWrong = submitted && sel && !isAns;
            return (
              <button key={oi} onClick={()=>!submitted&&onChange({text:opt,idx:oi})} style={{
                textAlign:"left",padding:"7px 12px",borderRadius:8,fontSize:12,transition:"all .1s",
                border:`1.5px solid ${isAns?C.teal:isWrong?C.rose:sel?C.brand:C.s200}`,
                background:isAns?C.tealL:isWrong?C.roseL:sel?C.brandL:"#fff",
                color:C.s900,cursor:submitted?"default":"pointer",fontWeight:sel||isAns?600:400,
              }}>
                <span style={{fontWeight:800,marginRight:8,color:C.s400}}>{String.fromCharCode(65+oi)}.</span>{opt}
              </button>
            );
          })}
        </div>
      )}

      {/* YES/NO/NG or TRUE/FALSE/NG */}
      {fixedChoices&&(
        <div style={{display:"flex",gap:8,marginLeft:40,flexWrap:"wrap"}}>
          {fixedChoices.map(opt=>{
            const sel=answer===opt;
            const isAns=submitted&&opt===q.correct;
            const isWrong=submitted&&sel&&opt!==q.correct;
            return (
              <button key={opt} onClick={()=>!submitted&&onChange(opt)} style={{
                padding:"7px 14px",borderRadius:8,fontWeight:700,fontSize:11,cursor:submitted?"default":"pointer",transition:"all .1s",
                background:isAns?C.tealL:isWrong?C.roseL:sel?C.brandL:"#fff",
                border:`1.5px solid ${isAns?C.teal:isWrong?C.rose:sel?C.brand:C.s200}`,
                color:isAns?C.teal:isWrong?C.rose:sel?C.brand:C.s600,
              }}>{opt}</button>
            );
          })}
        </div>
      )}

      {/* Text input (completion / short answer types) */}
      {isTextInput&&(
        <div style={{marginLeft:40}}>
          <input value={answer||""} onChange={e=>!submitted&&onChange(e.target.value)}
            placeholder={inputHint||"Your answer…"} disabled={submitted}
            style={{...inputStyle,borderRadius:8,borderColor:submitted?(correct?C.teal:answer?C.rose:C.s200):C.s200}}/>
          {submitted&&answer&&<div style={{color:correct?C.teal:C.rose,fontSize:12,marginTop:5,fontWeight:600}}>
            {correct?"✓ Correct":`✗ Answer: "${q.correct}"`}
          </div>}
        </div>
      )}
    </div>
    </>
  );
}

// ── WRITING TEST (no AI — AI runs after speaking) ─────────────────────────────
function WritingTest({ onComplete, testData, onExit, candidateInfo }) {
  const [ready, setReady]         = useState(false);
  const [tIdx, setTIdx]           = useState(0);
  const [imgZoom, setImgZoom]     = useState(false);
  const [texts, setTexts]         = useState({0:"",1:""});
  const [submitted, setSubmitted] = useState(false);
  const [dbCustomTasks, setDbCustomTasks] = useState(null);

  useEffect(()=>{
    if(!testData) {
      const db = loadDB();
      const wTests = (db.tests||[]).filter(t=>t.type==="Writing");
      if(wTests.length>0) setDbCustomTasks(wTests[wTests.length-1]);
    }
  },[testData]);

  const testActiveRef3 = useRef(false);
  useEffect(()=>{ testActiveRef3.current = ready && !submitted; }, [ready, submitted]);
  useEffect(()=>{
    const handler = e => { if(!testActiveRef3.current) return; e.preventDefault(); e.returnValue = ""; return ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  if(!ready) return <PreTestScreen icon="✍️" label="Writing Test" onStart={()=>setReady(true)}/>;

  const customTasks = testData || dbCustomTasks;
  const builtinTask = WRITING_TASKS[tIdx];
  const task = tIdx===0 && customTasks?.task1Prompt
    ? {...builtinTask, prompt: customTasks.task1Prompt, image: customTasks.task1Image||null}
    : tIdx===1 && customTasks?.task2Prompt
    ? {...builtinTask, prompt: customTasks.task2Prompt, image: null}
    : {...builtinTask, image: null};

  const wc       = countWords(texts[tIdx]||"");
  const meetsMin = wc >= task.minWords;
  const bothDone = countWords(texts[0])>=30 && countWords(texts[1])>=30;

  const handleSubmit = () => {
    setSubmitted(true);
    setTimeout(()=>onComplete({texts, taskData: customTasks}), 300);
  };

  return (
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 130px)"}}>
      <SectionHeader icon="✍️" label="Writing Test" title="IELTS Academic Writing"
        right={
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            {/* Task switcher */}
            <div style={{display:"flex",gap:4}}>
              {WRITING_TASKS.map((t,i)=>{
                const done = countWords(texts[i]||"")>=30;
                return (
                  <button key={i} onClick={()=>!submitted&&setTIdx(i)} style={{
                    padding:"6px 14px",borderRadius:8,fontSize:12,fontWeight:700,border:"none",cursor:submitted?"default":"pointer",transition:"all .15s",
                    background:tIdx===i?"rgba(255,255,255,.22)":"rgba(255,255,255,.07)",
                    color:tIdx===i?"#fff":"rgba(255,255,255,.4)",
                  }}>
                    {t.task} {done&&<span style={{color:"#6EE7B7"}}>✓</span>}
                  </button>
                );
              })}
            </div>
            <Countdown seconds={60*60} onExpire={handleSubmit}/>
          </div>
        } onExit={onExit} candidateInfo={candidateInfo}/>

      {/* Split: prompt left, writing right */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",flex:1,overflow:"hidden"}}>

        {/* LEFT — Task prompt */}
        <div style={{overflow:"auto",padding:28,borderRight:`1px solid ${C.s200}`,background:"#fff",display:"flex",flexDirection:"column",gap:16}}>
          <div style={{...cardStyle({borderLeft:`4px solid ${C.brand}`,padding:20})}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <div style={{...tagStyle(C.brand)}}>{task.task}</div>
              <div style={{fontSize:11,color:C.s400,fontWeight:600}}>Min {task.minWords} words</div>
            </div>
            <p style={{color:C.s800,fontSize:14,lineHeight:1.9,whiteSpace:"pre-wrap",margin:0}}>{task.prompt}</p>
            {task.image&&(
              <>
                {imgZoom&&(
                  <div onClick={()=>setImgZoom(false)} style={{position:"fixed",inset:0,background:"rgba(15,23,42,.85)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:24,cursor:"zoom-out"}}>
                    <div style={{position:"relative",maxWidth:"90vw",maxHeight:"90vh",borderRadius:16,overflow:"hidden",boxShadow:"0 32px 80px rgba(0,0,0,.6)"}}>
                      <img src={task.image} alt="Task" style={{display:"block",maxWidth:"90vw",maxHeight:"88vh",objectFit:"contain",background:"#fff"}}/>
                      <div style={{position:"absolute",top:12,right:12,background:"rgba(0,0,0,.55)",borderRadius:8,padding:"4px 10px",color:"#fff",fontSize:12,fontWeight:600}}>✕ Click anywhere to close</div>
                    </div>
                  </div>
                )}
                <div onClick={()=>setImgZoom(true)} style={{marginTop:14,borderRadius:10,overflow:"hidden",border:`2px solid ${C.brand}`,background:C.s100,cursor:"zoom-in",position:"relative",boxShadow:"0 4px 12px rgba(17,205,135,.15)"}}>
                  <img src={task.image} alt="Task" style={{width:"100%",maxHeight:320,objectFit:"contain",display:"block",background:"#fff"}}/>
                  <div style={{position:"absolute",bottom:0,left:0,right:0,background:"linear-gradient(transparent,rgba(15,23,42,.7))",padding:"16px 14px 10px",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                    <span style={{fontSize:13}}>🔍</span><span style={{color:"#fff",fontSize:12,fontWeight:700}}>Click to enlarge</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Navigation hint */}
          <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
            {[0,1].map(i=>{
              const wci = countWords(texts[i]||"");
              const mini = WRITING_TASKS[i].minWords;
              const met  = wci>=mini;
              return (
                <div key={i} onClick={()=>!submitted&&setTIdx(i)} style={{
                  flex:1,padding:"10px 14px",borderRadius:10,border:`2px solid ${tIdx===i?(met?C.teal:C.brand):C.s200}`,
                  background:tIdx===i?(met?C.tealL:C.brandL):"#fff",cursor:submitted?"default":"pointer",transition:"all .15s"
                }}>
                  <div style={{fontSize:11,fontWeight:700,color:tIdx===i?(met?C.teal:C.brand):C.s400,textTransform:"uppercase",letterSpacing:"0.07em"}}>{WRITING_TASKS[i].task}</div>
                  <div style={{fontSize:12,fontWeight:700,color:met?C.teal:C.s600,marginTop:2}}>{wci} / {mini} words {met?"✓":""}</div>
                  <div style={{height:3,background:C.s200,borderRadius:99,marginTop:6}}>
                    <div style={{width:`${Math.min(wci/mini*100,100)}%`,height:"100%",background:met?C.teal:C.brand,borderRadius:99,transition:"width .3s"}}/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT — Writing area */}
        <div style={{overflow:"auto",padding:28,background:C.bg,display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{fontSize:13,fontWeight:700,color:C.s900}}>{task.task} — Your Response</div>
            <span style={{fontSize:12,fontWeight:700,color:meetsMin?C.teal:C.s400}}>
              {wc} words {meetsMin?`✓`:`/ ${task.minWords} required`}
            </span>
          </div>

          <textarea
            value={texts[tIdx]}
            onChange={e=>!submitted&&setTexts(t=>({...t,[tIdx]:e.target.value}))}
            disabled={submitted}
            placeholder={`Write your ${task.task} response here…`}
            style={{...inputStyle,flex:1,minHeight:"calc(100vh - 440px)",resize:"none",lineHeight:1.9,fontSize:14,borderRadius:12,
              borderColor:meetsMin?C.teal:C.s200,background:submitted?"#F9FAFB":"#fff"}}
          />

          {/* Word count bar */}
          <div style={{height:4,background:C.s200,borderRadius:99,overflow:"hidden"}}>
            <div style={{width:`${Math.min(wc/task.minWords*100,100)}%`,height:"100%",background:meetsMin?C.teal:C.brand,borderRadius:99,transition:"width .3s"}}/>
          </div>

          {/* Task nav + submit */}
          {!submitted&&(
            <div style={{display:"flex",gap:10}}>
              {tIdx===0&&(
                <button onClick={()=>setTIdx(1)}
                  style={{...btnStyle("secondary"),padding:"12px 20px",fontSize:14,flex:1}}>
                  Next: Task 2 →
                </button>
              )}
              {tIdx===1&&(
                <button onClick={()=>setTIdx(0)}
                  style={{...btnStyle("secondary"),padding:"12px 20px",fontSize:13}}>
                  ← Task 1
                </button>
              )}
              <button onClick={handleSubmit} disabled={!bothDone}
                style={{...btnStyle("primary",!bothDone),padding:"12px 20px",fontSize:14,flex:1}}>
                Submit Writing ✓
              </button>
            </div>
          )}
          {!bothDone&&!submitted&&(
            <p style={{color:C.s400,fontSize:12,textAlign:"center",margin:0}}>Write at least 30 words in both tasks to submit</p>
          )}
          {submitted&&(
            <div style={{background:C.tealL,border:`1px solid ${C.teal}40`,borderRadius:12,padding:16,textAlign:"center"}}>
              <div style={{fontSize:20,marginBottom:6}}>✅</div>
              <div style={{fontSize:14,fontWeight:700,color:C.teal}}>Writing Submitted</div>
              <div style={{fontSize:12,color:C.s600,marginTop:4}}>Your responses have been saved. Proceeding to Speaking booking…</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── AI SPEAKING EXAMINER ──────────────────────────────────────────────────────
const DEFAULT_SPEAKING_QUESTIONS = {
  part1: ["Tell me about yourself and where you are from.","What do you do — are you a student or do you work?","What are your hobbies and interests?","Do you prefer spending time indoors or outdoors? Why?"],
  part2: {cue:"Describe a memorable trip or journey you have taken.\n\nYou should say:\n• where you went\n• who you went with\n• what you did there\nand explain why it was memorable for you.\n\nYou have 1 minute to prepare, then speak for 1-2 minutes."},
  part3: ["Do you think travel is important for personal development?","How has tourism changed in your country over the past decade?","What are the advantages and disadvantages of living abroad?","Do you think everyone will be able to travel freely in the future?"]
};

async function runSpeakingCheck(transcript, questionContext, part) {
  const OPENAI_KEY = import.meta.env.VITE_OPENAI_API_KEY || "";
  if(!OPENAI_KEY) return {band:null,fluency:{band:null,comment:""},lexical:{band:null,comment:""},grammar:{band:null,comment:""},pronunciation:{band:null,comment:""},summary:"AI evaluation unavailable.",strengths:[],improvements:[],_error:"No API key"};
  try {
    const controller = new AbortController();
    const tid = setTimeout(()=>controller.abort(),40000);
    const res = await fetch("https://api.openai.com/v1/chat/completions",{
      signal:controller.signal,
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":`Bearer ${OPENAI_KEY}`},
      body:JSON.stringify({
        model:"gpt-4o", max_tokens:1200,
        messages:[
          {role:"system",content:`You are Nova, LingvoConnect's AI IELTS Speaking Examiner. Evaluate the candidate's spoken response based on the 4 official IELTS Speaking criteria. Be professional, supportive, and realistic. Return ONLY valid JSON in this exact shape:
{"band":7.0,"fluency":{"band":7.0,"comment":"..."},"lexical":{"band":7.0,"comment":"..."},"grammar":{"band":7.0,"comment":"..."},"pronunciation":{"band":7.0,"comment":"..."},"summary":"...","strengths":["..."],"improvements":["..."]}
Criteria: Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy, Pronunciation. Use 0.5 increments 1-9. Be honest and IELTS-accurate.`},
          {role:"user",content:`IELTS Speaking ${part}\n\nQuestion context:\n${questionContext}\n\nCandidate's transcribed response:\n${transcript}`}
        ]
      })
    });
    clearTimeout(tid);
    const data = await res.json();
    if(!res.ok||data.error) throw new Error(data.error?.message||"API error");
    const raw = (data.choices?.[0]?.message?.content||"").replace(/```json|```/g,"").trim();
    return JSON.parse(raw);
  } catch(e) {
    return {band:null,fluency:{band:null,comment:""},lexical:{band:null,comment:""},grammar:{band:null,comment:""},pronunciation:{band:null,comment:""},summary:"Evaluation unavailable: "+e.message,strengths:[],improvements:[],_error:e.message};
  }
}

function SpeakingExam({ candidateInfo, onComplete, onSkip }) {
  const [part, setPart]             = useState(1);        // 1, 2, 3
  const [qIdx, setQIdx]             = useState(0);
  const [answers, setAnswers]       = useState({p1:{},p2:"",p3:{}});
  const [listening, setListening]   = useState(false);
  const [transcript, setTranscript] = useState("");
  const [prepTimer, setPrepTimer]   = useState(60);       // Part 2 prep
  const [prepDone, setPrepDone]     = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [results, setResults]       = useState(null);
  const [msgIdx, setMsgIdx]         = useState(0);
  const recognitionRef              = useRef(null);
  const prepRef                     = useRef(null);

  // Load admin-configured questions or use defaults
  const db = loadDB();
  const adminQ = db.speakingQuestions||DEFAULT_SPEAKING_QUESTIONS;
  const q1 = adminQ.part1||DEFAULT_SPEAKING_QUESTIONS.part1;
  const q2 = adminQ.part2||DEFAULT_SPEAKING_QUESTIONS.part2;
  const q3 = adminQ.part3||DEFAULT_SPEAKING_QUESTIONS.part3;

  const EVAL_MSGS = [
    "Nova is listening to your performance…",
    "Analysing your fluency and coherence…",
    "Evaluating your lexical resource…",
    "Checking grammatical range…",
    "Almost done — finalising your speaking score…"
  ];
  useEffect(()=>{if(evaluating){const t=setInterval(()=>setMsgIdx(i=>(i+1)%EVAL_MSGS.length),3000);return()=>clearInterval(t);}}, [evaluating]);

  // Prep timer for Part 2
  useEffect(()=>{
    if(part===2&&!prepDone&&prepTimer>0){
      prepRef.current=setTimeout(()=>setPrepTimer(t=>t-1),1000);
    } else if(part===2&&prepTimer===0) { setPrepDone(true); }
    return()=>clearTimeout(prepRef.current);
  },[part,prepTimer,prepDone]);

  const startListening = () => {
    const SR = window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){alert("Speech recognition not supported in this browser. Please type your answer instead.");return;}
    const rec = new SR();
    rec.continuous=true; rec.interimResults=true; rec.lang="en-US";
    rec.onresult = e=>{
      let t="";
      for(let i=0;i<e.results.length;i++) t+=e.results[i][0].transcript+" ";
      setTranscript(t.trim());
    };
    rec.onerror = ()=>setListening(false);
    rec.onend   = ()=>setListening(false);
    recognitionRef.current=rec;
    rec.start();
    setListening(true);
    setTranscript("");
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const saveAnswer = () => {
    const ans = transcript.trim();
    if(part===1) setAnswers(a=>({...a,p1:{...a.p1,[qIdx]:ans}}));
    if(part===2) setAnswers(a=>({...a,p2:ans}));
    if(part===3) setAnswers(a=>({...a,p3:{...a.p3,[qIdx]:ans}}));
    setTranscript("");
    stopListening();
  };

  const nextQ = () => {
    saveAnswer();
    if(part===1) {
      if(qIdx<q1.length-1) { setQIdx(i=>i+1); }
      else { setPart(2); setQIdx(0); setPrepTimer(60); setPrepDone(false); }
    } else if(part===2) { setPart(3); setQIdx(0); }
    else if(part===3) {
      if(qIdx<q3.length-1) { setQIdx(i=>i+1); }
      else { finishExam(); }
    }
  };

  const finishExam = async () => {
    saveAnswer();
    setEvaluating(true);
    // Build transcripts
    const p1text = q1.map((q,i)=>`Q: ${q}\nA: ${answers.p1[i]||"[No answer]"}`).join("\n\n");
    const p2text = `Cue: ${typeof q2==="object"?q2.cue:q2}\nA: ${answers.p2||"[No answer]"}`;
    const p3text = q3.map((q,i)=>`Q: ${q}\nA: ${answers.p3[i]||"[No answer]"}`).join("\n\n");
    // Evaluate all parts together
    const combined = `PART 1:\n${p1text}\n\nPART 2:\n${p2text}\n\nPART 3:\n${p3text}`;
    const fb = await runSpeakingCheck(combined, "Full IELTS Speaking Test (Parts 1, 2 & 3)", "Parts 1–3");
    setResults(fb);
    setEvaluating(false);
  };

  // ── Evaluating screen ──
  if(evaluating) return (
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#0F172A 0%,#1a2e25 60%,#162620 100%)",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{maxWidth:480,width:"100%",textAlign:"center"}}>
        <div style={{width:100,height:100,borderRadius:28,overflow:"hidden",margin:"0 auto 28px",boxShadow:"0 0 0 10px rgba(17,205,135,.12)",background:"#1a2e25",animation:"pulse 2s ease infinite"}}>
          <img src="/nova.png" alt="Nova" style={{width:"100%",height:"100%",objectFit:"contain"}}/>
        </div>
        <div style={{fontSize:10,fontWeight:700,color:"rgba(17,205,135,.7)",letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:8}}>AI Examiner</div>
        <h2 style={{fontSize:28,fontWeight:900,color:"#fff",marginBottom:8}}>Nova</h2>
        <p style={{color:"rgba(255,255,255,.55)",fontSize:14,lineHeight:1.75,minHeight:40}}>{EVAL_MSGS[msgIdx]}</p>
      </div>
    </div>
  );

  // ── Results screen ──
  if(results) {
    const band = results.band;
    const CRITERIA = [["fluency","Fluency & Coherence","🗣️"],["lexical","Lexical Resource","📚"],["grammar","Grammatical Range","⚙️"],["pronunciation","Pronunciation","🎵"]];
    return (
      <div style={{maxWidth:700,margin:"0 auto",padding:"40px 24px"}}>
        <div style={{background:"linear-gradient(135deg,#064E3B 0%,#0BA870 100%)",borderRadius:20,padding:"40px 36px",textAlign:"center",marginBottom:24}}>
          <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,.5)",letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:6}}>Speaking Band Score</div>
          <div style={{fontSize:96,fontWeight:900,color:band?bandColor(band):"#fff",lineHeight:1,fontFamily:"'JetBrains Mono',monospace"}}>{band?.toFixed(1)||"—"}</div>
          <div style={{fontSize:18,color:"rgba(255,255,255,.8)",fontWeight:700,marginTop:8}}>{band?bandLabel(band):"Evaluation unavailable"}</div>
        </div>
        {results.summary&&<div style={{...cardStyle({padding:20,marginBottom:20,borderLeft:`4px solid ${C.brand}`})}}>
          <div style={{fontSize:11,fontWeight:700,color:C.brand,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Nova's Overall Assessment</div>
          <p style={{fontSize:13,color:C.s800,lineHeight:1.8,margin:0}}>{results.summary}</p>
        </div>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
          {CRITERIA.map(([k,lbl,icon])=>{const c=results[k]||{};const b=c.band;return b!=null?(
            <div key={k} style={{...cardStyle({padding:16})}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                <div style={{fontSize:11,fontWeight:700,color:C.s400,textTransform:"uppercase"}}>{icon} {lbl}</div>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:22,fontWeight:900,color:bandColor(b)}}>{b}</div>
              </div>
              <div style={{height:4,background:C.s200,borderRadius:99,marginBottom:8}}><div style={{width:`${(b-1)/8*100}%`,height:"100%",background:bandColor(b),borderRadius:99}}/></div>
              {c.comment&&<p style={{fontSize:12,color:C.s600,lineHeight:1.65,margin:0}}>{c.comment}</p>}
            </div>
          ):null;})}
        </div>
        {(results.strengths?.length>0||results.improvements?.length>0)&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
            {results.strengths?.length>0&&<div style={{background:"#F0FDF4",border:"1.5px solid #BBF7D0",borderRadius:12,padding:"14px 16px"}}>
              <div style={{fontSize:11,fontWeight:700,color:"#16A34A",textTransform:"uppercase",marginBottom:10}}>✓ Strengths</div>
              {results.strengths.map((s,i)=><div key={i} style={{fontSize:12,color:"#166534",marginBottom:5}}>• {s}</div>)}
            </div>}
            {results.improvements?.length>0&&<div style={{background:"#FFFBEB",border:"1.5px solid #FDE68A",borderRadius:12,padding:"14px 16px"}}>
              <div style={{fontSize:11,fontWeight:700,color:"#B45309",textTransform:"uppercase",marginBottom:10}}>📈 Areas to Improve</div>
              {results.improvements.map((s,i)=><div key={i} style={{fontSize:12,color:"#92400E",marginBottom:5}}>• {s}</div>)}
            </div>}
          </div>
        )}
        <button onClick={()=>onComplete({speakingBand:band, speakingFeedback:results})} style={{...btnStyle("primary"),width:"100%",padding:"14px",fontSize:15,fontWeight:700}}>
          Continue to Speaking Booking →
        </button>
      </div>
    );
  }

  // ── Exam screen ──
  const currentQ = part===1?q1[qIdx]:part===2?(typeof q2==="object"?q2.cue:q2):q3[qIdx];
  const partLabel = part===1?"Part 1 — Interview":part===2?"Part 2 — Long Turn":"Part 3 — Discussion";
  const totalQ    = part===1?q1.length:part===2?1:q3.length;
  const progress  = part===1?(qIdx/q1.length*33):part===2?33:33+(qIdx/q3.length*34);

  return (
    <div style={{maxWidth:680,margin:"0 auto",padding:"32px 24px"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:24}}>
        <div style={{width:48,height:48,borderRadius:14,overflow:"hidden",background:"#1a2e25",flexShrink:0}}>
          <img src="/nova.png" alt="Nova" style={{width:"100%",height:"100%",objectFit:"contain"}}/>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:10,fontWeight:700,color:C.brand,textTransform:"uppercase",letterSpacing:"0.15em"}}>Nova — AI Speaking Examiner</div>
          <div style={{fontSize:16,fontWeight:800,color:C.s900}}>{partLabel}</div>
        </div>
        <button onClick={onSkip} style={{...btnStyle("ghost"),fontSize:12,color:C.s400,border:`1px solid ${C.s200}`,borderRadius:8,padding:"6px 14px"}}>Skip exam →</button>
      </div>

      {/* Progress */}
      <div style={{height:4,background:C.s200,borderRadius:99,marginBottom:24,overflow:"hidden"}}>
        <div style={{width:`${progress}%`,height:"100%",background:`linear-gradient(90deg,${C.brand},${C.teal})`,borderRadius:99,transition:"width .5s ease"}}/>
      </div>

      {/* Part 2 prep timer */}
      {part===2&&!prepDone&&(
        <div style={{...cardStyle({padding:20,marginBottom:20,borderLeft:`4px solid ${C.amber}`,background:C.amberL})}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontWeight:700,color:C.amber}}>⏱ Preparation Time</div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:32,fontWeight:900,color:C.amber}}>{prepTimer}s</div>
          </div>
          <button onClick={()=>setPrepDone(true)} style={{...btnStyle("primary"),marginTop:12,width:"100%"}}>I'm ready — Start speaking</button>
        </div>
      )}

      {/* Question card */}
      <div style={{...cardStyle({padding:24,marginBottom:20,borderLeft:`4px solid ${C.brand}`})}}>
        <div style={{fontSize:11,fontWeight:700,color:C.brand,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>
          {part===2?"Cue Card":part===1?`Question ${qIdx+1} of ${totalQ}`:`Question ${qIdx+1} of ${totalQ}`}
        </div>
        <p style={{fontSize:15,color:C.s900,lineHeight:1.75,margin:0,whiteSpace:"pre-line"}}>{currentQ}</p>
      </div>

      {/* Voice / text input */}
      {(part!==2||prepDone)&&(
        <div style={{...cardStyle({padding:20,marginBottom:16})}}>
          <div style={{fontSize:12,fontWeight:700,color:C.s600,marginBottom:10}}>Your Answer</div>
          <textarea
            value={transcript}
            onChange={e=>setTranscript(e.target.value)}
            placeholder={listening?"Listening… speak now":"Click 🎤 to speak, or type your answer here…"}
            style={{...inputStyle,width:"100%",minHeight:100,resize:"vertical",fontSize:13,lineHeight:1.7,borderColor:listening?C.brand:C.s200}}
          />
          <div style={{display:"flex",gap:10,marginTop:10}}>
            {!listening
              ? <button onClick={startListening} style={{...btnStyle("secondary"),display:"flex",alignItems:"center",gap:6,padding:"9px 16px"}}>🎤 Speak</button>
              : <button onClick={stopListening} style={{background:"#FEE2E2",color:"#DC2626",border:"none",borderRadius:8,padding:"9px 16px",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}><span style={{animation:"pulse 1s infinite"}}>⏹</span> Stop</button>
            }
          </div>
        </div>
      )}

      {/* Navigation */}
      {(part!==2||prepDone)&&(
        <div style={{display:"flex",gap:12}}>
          <button onClick={nextQ} style={{...btnStyle("primary"),flex:1,padding:"13px",fontSize:14,fontWeight:700}}>
            {part===3&&qIdx===q3.length-1?"Finish & Get Score →":"Next Question →"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── SPEAKING BOOKING ──────────────────────────────────────────────────────────
function SpeakingBooking({ candidateInfo, onComplete }) {
  const [selDate, setSelDate]       = useState(null);
  const [selSlot, setSelSlot]       = useState(null); // the full slot object
  const [mode, setMode]             = useState("online");
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmed, setConfirmed]   = useState(false);

  const todayStr = new Date().toISOString().slice(0,10);
  // Load only future unbooked slots from DB
  const dbSlots  = (loadDB().speakingSlots||[]).filter(s=>!s.booked && s.date>=todayStr)
                    .sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time));
  const hasSlots = dbSlots.length > 0;

  // Dates that have at least one slot
  const availDates = [...new Set(dbSlots.map(s=>s.date))];

  // Slots for selected date
  const dateSlots = selDate ? dbSlots.filter(s=>s.date===selDate) : [];

  const fmtDate = dateStr => new Date(dateStr+"T00:00:00").toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",year:"numeric"});
  const fmtDateObj = d => d.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",year:"numeric"});

  const doConfirm = () => {
    // Mark the DB slot as booked
    const db = loadDB();
    db.speakingSlots = (db.speakingSlots||[]).map(s=>
      s.id===selSlot.id ? {...s, booked:true, bookedBy:candidateInfo?.email||candidateInfo?.name||"unknown"} : s
    );
    const bk={candidate:candidateInfo,date:selDate,dateFormatted:fmtDate(selDate),slot:selSlot.time,slotId:selSlot.id,mode,id:genId("SPK")};
    db.bookings=[bk,...(db.bookings||[])];
    saveDB(db);
    setConfirmed(true);
    setTimeout(()=>onComplete(bk),2200);
  };

  if(confirmed) return (
    <div style={{maxWidth:500,margin:"80px auto",textAlign:"center",padding:"0 24px"}}>
      <div style={{width:80,height:80,borderRadius:20,background:C.tealL,border:`2px solid ${C.teal}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,margin:"0 auto 20px"}}>✓</div>
      <h2 style={{fontSize:26,fontWeight:800,color:C.s900,letterSpacing:"-0.03em",marginBottom:8}}>Speaking Test Booked!</h2>
      <p style={{color:C.s600,fontSize:14,marginBottom:6}}>{fmtDate(selDate)} at {selSlot?.time}</p>
      <p style={{color:C.s400,fontSize:13}}>{mode==="online"?"🎥 Online video call — secure link sent 24hrs before":"🏛️ In-person at test centre"}</p>
      <p style={{color:C.brand,fontSize:12,fontWeight:600,marginTop:12}}>Loading your results…</p>
    </div>
  );

  // ── Confirmation modal overlay ──
  if(showConfirm) return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999,padding:24}}>
      <div style={{...cardStyle({padding:32,maxWidth:460,width:"100%"}),animation:"fadeUp .2s ease both"}}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{width:60,height:60,borderRadius:16,background:C.tealL,border:`2px solid ${C.teal}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,margin:"0 auto 16px"}}>🗓️</div>
          <h3 style={{fontSize:20,fontWeight:800,color:C.s900,letterSpacing:"-0.02em",marginBottom:6}}>Confirm Your Booking</h3>
          <p style={{fontSize:13,color:C.s400}}>Please review the details below before confirming</p>
        </div>

        <div style={{background:C.s100,borderRadius:12,padding:18,marginBottom:20}}>
          {[
            ["Candidate", candidateInfo?.name||"—"],
            ["Date",      fmtDate(selDate)],
            ["Time",      selSlot?.time],
            ["Format",    mode==="online"?"🎥 Online Video Call":"🏛️ In-Person at Centre"],
          ].map(([k,v])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.s200}`,fontSize:13}}>
              <span style={{color:C.s400,fontWeight:600}}>{k}</span>
              <span style={{color:C.s900,fontWeight:700}}>{v}</span>
            </div>
          ))}
        </div>

        <div style={{background:C.brandL,borderRadius:8,padding:"10px 14px",fontSize:12,color:C.brand,marginBottom:20}}>
          ℹ️ Once confirmed, your booking will be visible in the admin dashboard. Contact us to reschedule.
        </div>

        <div style={{display:"flex",gap:12}}>
          <button onClick={()=>setShowConfirm(false)} style={{...btnStyle("secondary"),flex:1}}>← Edit Selection</button>
          <button onClick={doConfirm} style={{...btnStyle("teal"),flex:1}}>✓ Confirm Booking</button>
        </div>
      </div>
    </div>
  );

  // No slots available at all
  if(!hasSlots) return (
    <div style={{maxWidth:520,margin:"80px auto",textAlign:"center",padding:"0 24px"}}>
      <div style={{fontSize:48,marginBottom:16}}>📅</div>
      <h2 style={{fontSize:22,fontWeight:800,color:C.s900,letterSpacing:"-0.03em",marginBottom:10}}>No Speaking Slots Available</h2>
      <p style={{color:C.s400,fontSize:14,marginBottom:20}}>The administrator hasn't opened any speaking slots yet. Please check back later or contact your test centre.</p>
      <button onClick={()=>onComplete(null)} style={btnStyle("secondary")}>Skip for now →</button>
    </div>
  );

  return (
    <div style={{maxWidth:760,margin:"0 auto",padding:"32px 24px"}}>
      <div style={{textAlign:"center",marginBottom:28}}>
        <div style={{...tagStyle(C.teal),marginBottom:12}}>Speaking Test</div>
        <h2 style={{fontSize:26,fontWeight:800,color:C.s900,letterSpacing:"-0.03em",marginBottom:8}}>Book Your Speaking Appointment</h2>
        <p style={{color:C.s400,fontSize:14}}>Choose an available slot below — conducted with a certified IELTS examiner</p>
      </div>

      {/* Available dates */}
      <div style={{...cardStyle({padding:24,marginBottom:16})}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div style={{fontWeight:700,fontSize:14,color:C.s900}}>Select Date</div>
          <div style={{fontSize:12,color:C.teal,fontWeight:600}}>{availDates.length} date{availDates.length!==1?"s":""} available</div>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {availDates.map(dateStr=>{
            const count = dbSlots.filter(s=>s.date===dateStr).length;
            const sel   = selDate===dateStr;
            const d     = new Date(dateStr+"T00:00:00");
            return (
              <button key={dateStr} onClick={()=>{setSelDate(dateStr);setSelSlot(null);}} style={{
                padding:"10px 16px",borderRadius:10,cursor:"pointer",textAlign:"center",transition:"all .15s",
                border:`1.5px solid ${sel?C.brand:C.teal}`,minWidth:90,
                background:sel?"linear-gradient(135deg,#0BA870,#11CD87)":C.tealL,
                color:sel?"#fff":C.teal,
                boxShadow:sel?"0 2px 8px rgba(17,205,135,.3)":"none",
              }}>
                <div style={{fontWeight:800,fontSize:13}}>{d.toLocaleDateString("en-GB",{day:"numeric",month:"short"})}</div>
                <div style={{fontSize:10,opacity:.85}}>{d.toLocaleDateString("en-GB",{weekday:"short"})}</div>
                <div style={{fontSize:10,marginTop:2,fontWeight:600}}>{count} slot{count!==1?"s":""}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Time slots for selected date */}
      {selDate&&(
        <div style={{...cardStyle({padding:24,marginBottom:16})}}>
          <div style={{fontWeight:700,fontSize:14,color:C.s900,marginBottom:14}}>
            Available Times — {fmtDate(selDate)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10}}>
            {dateSlots.map(slot=>{
              const sel = selSlot?.id===slot.id;
              const supportsOnline   = slot.mode==="online"||slot.mode==="both";
              const supportsInperson = slot.mode==="inperson"||slot.mode==="both";
              return (
                <button key={slot.id} onClick={()=>{
                  setSelSlot(slot);
                  // Auto-set mode if slot only supports one type
                  if(slot.mode==="online") setMode("online");
                  else if(slot.mode==="inperson") setMode("inperson");
                }} style={{
                  padding:"14px 10px",borderRadius:12,textAlign:"center",transition:"all .15s",cursor:"pointer",
                  background:sel?"linear-gradient(135deg,#0BA870,#11CD87)":C.surface,
                  border:`1.5px solid ${sel?C.brand:C.s200}`,
                  color:sel?"#fff":C.s900,
                  boxShadow:sel?"0 4px 12px rgba(17,205,135,.3)":"none",
                }}>
                  <div style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:900,fontSize:18}}>{slot.time}</div>
                  <div style={{fontSize:10,marginTop:4,opacity:.8}}>
                    {slot.mode==="both"?"🎥+🏛️":slot.mode==="online"?"🎥 Online":"🏛️ In-Person"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Mode selector — only shown if selected slot supports both */}
      {selSlot&&selSlot.mode==="both"&&(
        <div style={{...cardStyle({padding:20,marginBottom:16})}}>
          <div style={{fontWeight:700,fontSize:13,color:C.s900,marginBottom:12}}>Select Format</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            {[["online","🎥","Online Video Call","Secure link sent 24hrs before"],["inperson","🏛️","In-Person","Visit our test centre location"]].map(([m,icon,title,desc])=>(
              <button key={m} onClick={()=>setMode(m)} style={{
                ...cardStyle({cursor:"pointer",textAlign:"left",padding:16,transition:"all .15s",
                  border:`2px solid ${mode===m?C.brand:C.s200}`,
                  background:mode===m?C.brandL:"#fff",
                }),
              }}>
                <div style={{fontSize:22,marginBottom:6}}>{icon}</div>
                <div style={{fontWeight:700,fontSize:13,color:C.s900,marginBottom:2}}>{title}</div>
                <div style={{fontSize:11,color:C.s400}}>{desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Confirm trigger */}
      {selDate&&selSlot&&(
        <div style={{...cardStyle({padding:20,display:"flex",justifyContent:"space-between",alignItems:"center",borderLeft:`4px solid ${C.teal}`})}}>
          <div>
            <div style={{fontSize:11,color:C.s400,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>Selected Booking</div>
            <div style={{fontWeight:700,fontSize:15,color:C.s900}}>
              {mode==="online"?"🎥 Online":"🏛️ In-Person"} · {fmtDate(selDate)} · {selSlot.time}
            </div>
          </div>
          <button onClick={()=>setShowConfirm(true)} style={btnStyle("teal")}>Review & Confirm →</button>
        </div>
      )}
    </div>
  );
}

// ── AI WRITING CHECK — calls server-side proxy /api/ai-check ─────────────────
// Proxy avoids browser-level firewall / CORS blocks on api.openai.com
async function runAICheck(text, taskMeta) {
  const errFb = msg => ({
    band:null, taskAchievement:{band:null,comment:""}, coherenceCohesion:{band:null,comment:""},
    lexicalResource:{band:null,comment:""}, grammaticalRange:{band:null,comment:""},
    summary:msg, strengths:[], improvements:[], keyTip:"", corrections:[], _error:msg
  });
  if(!text?.trim()) return errFb("No writing text provided.");
  try {
    const controller = new AbortController();
    const timeoutId  = setTimeout(()=>controller.abort(), 60000); // 60s for server round-trip
    const res = await fetch("/api/ai-check", {
      signal: controller.signal,
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({text, taskMeta}),
    });
    clearTimeout(timeoutId);
    const data = await res.json();
    if(!res.ok || data._error) return errFb(data._error || `Server error HTTP ${res.status}`);
    return data;
  } catch(e) {
    if(e?.name==="AbortError") return errFb("Evaluation timed out (60s). Please try again.");
    return errFb(`Connection error: ${e?.message||"Could not reach the evaluation server."}`);
  }
}

const NOVA_LOADING_MSGS = [
  "LingvoConnect's AI Examiner Nova is now checking your writing…",
  "Analyzing your response based on official IELTS criteria…",
  "Evaluating Task Achievement and Coherence…",
  "Assessing your Lexical Resource and Grammatical Range…",
  "Almost done! Finalizing your band score…",
  "Just a moment… great results take a few seconds.",
];

function ResultsLoading({ writingTexts, writingTaskData, onComplete }) {
  const [status,   setStatus]   = useState({0:"pending",1:"pending"});
  const [aiFb,     setAiFb]     = useState({});
  const [msgIdx,   setMsgIdx]   = useState(0);
  const [elapsed,  setElapsed]  = useState(0);   // seconds since mount
  const ran      = useRef(false);
  const aiFbRef  = useRef({});                   // mirror for use in timeout
  const statusRef= useRef({0:"pending",1:"pending"});

  const customTasks = writingTaskData;
  const getTask = idx => {
    const base = WRITING_TASKS[idx];
    if(idx===0 && customTasks?.task1Prompt) return {...base, prompt:customTasks.task1Prompt};
    if(idx===1 && customTasks?.task2Prompt) return {...base, prompt:customTasks.task2Prompt};
    return base;
  };

  // Rotate loading messages
  useEffect(()=>{
    const t = setInterval(()=>setMsgIdx(i=>(i+1)%NOVA_LOADING_MSGS.length), 3500);
    return ()=>clearInterval(t);
  },[]);

  // Elapsed timer — used to show fallback button after 60s
  useEffect(()=>{
    const t = setInterval(()=>setElapsed(s=>s+1), 1000);
    return ()=>clearInterval(t);
  },[]);

  useEffect(()=>{
    if(ran.current) return;
    ran.current = true;
    (async ()=>{
      const results = {};
      for(const idx of [0,1]) {
        const text = writingTexts?.[idx]||"";
        if(countWords(text)<10) {
          results[idx]={band:null,_error:"No text submitted for this task."};
          statusRef.current={...statusRef.current,[idx]:"error"};
          setStatus(s=>({...s,[idx]:"error"})); setAiFb(f=>{const n={...f,[idx]:results[idx]};aiFbRef.current=n;return n;}); continue;
        }
        statusRef.current={...statusRef.current,[idx]:"checking"};
        setStatus(s=>({...s,[idx]:"checking"}));
        const fb = await runAICheck(text, getTask(idx));
        results[idx] = fb;
        const st = fb._error?"error":"done";
        statusRef.current={...statusRef.current,[idx]:st};
        setStatus(s=>({...s,[idx]:st}));
        setAiFb(f=>{const n={...f,[idx]:fb};aiFbRef.current=n;return n;});
      }
      const b0=results[0]?.band??null, b1=results[1]?.band??null;
      let band=null;
      if(b0!=null&&b1!=null) band=Math.round((b0*.34+b1*.66)*2)/2;
      else if(b1!=null) band=b1;
      else if(b0!=null) band=b0;
      setTimeout(()=>onComplete({band, aiFeedback:results, aiDetection:{task1:results[0]?.aiDetection, task2:results[1]?.aiDetection}}), 800);
    })();
  },[]);

  // Helper to build result from whatever we have so far (for manual skip)
  const skipToResults = () => {
    const r = aiFbRef.current||{};
    const b0=r[0]?.band??null, b1=r[1]?.band??null;
    let band=null;
    if(b0!=null&&b1!=null) band=Math.round((b0*.34+b1*.66)*2)/2;
    else if(b1!=null) band=b1;
    else if(b0!=null) band=b0;
    onComplete({band, aiFeedback:r, aiDetection:{task1:r[0]?.aiDetection, task2:r[1]?.aiDetection}});
  };

  const allDone = [0,1].every(i=>status[i]!=="pending"&&status[i]!=="checking");
  const doneCount = [status[0],status[1]].filter(s=>s==="done"||s==="error").length;
  const pct = doneCount/2*100;
  const showSkip = elapsed >= 60 && !allDone; // show fallback after 60s

  const taskLabel = (i,s) => {
    if(s==="pending")  return "Waiting for Nova…";
    if(s==="checking") return "Nova is reviewing this task…";
    if(s==="done")     return "Evaluation complete.";
    return "Evaluation unavailable — will show partial results.";
  };

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#f0fdf8 0%,#e8faf3 50%,#f0f9ff 100%)",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{maxWidth:520,width:"100%",textAlign:"center"}}>

        {/* Nova avatar */}
        <div style={{position:"relative",display:"inline-block",marginBottom:32}}>
          <div style={{
            width:120,height:120,borderRadius:32,overflow:"hidden",
            boxShadow:"0 0 0 12px rgba(17,205,135,.15), 0 8px 40px rgba(17,205,135,.2)",
            animation:allDone?"none":"pulse 2.4s ease infinite",
            background:"#e8faf3",
          }}>
            <img src="/nova.png" alt="Nova" style={{width:"100%",height:"100%",objectFit:"contain",display:"block"}}/>
          </div>
          {!allDone&&(
            <div style={{position:"absolute",bottom:-6,right:-6,width:28,height:28,borderRadius:"50%",background:"#FFB703",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,boxShadow:"0 2px 8px rgba(0,0,0,.15)"}}>⚡</div>
          )}
          {allDone&&(
            <div style={{position:"absolute",bottom:-6,right:-6,width:28,height:28,borderRadius:"50%",background:C.teal,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,boxShadow:"0 2px 8px rgba(0,0,0,.15)"}}>✓</div>
          )}
        </div>

        {/* Nova identity */}
        <div style={{fontSize:11,fontWeight:700,color:C.teal,letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:8}}>
          LingvoConnect's AI Examiner
        </div>
        <h2 style={{fontSize:32,fontWeight:900,color:C.s900,letterSpacing:"-0.03em",marginBottom:4,lineHeight:1.1}}>
          {allDone ? "Nova has finished reviewing your tasks." : "Nova"}
        </h2>

        {/* Dynamic status message */}
        <p style={{color:C.s400,fontSize:14,lineHeight:1.75,marginBottom:36,minHeight:48,transition:"opacity .4s"}}>
          {allDone
            ? "Evaluation complete. Here's your IELTS Writing score."
            : NOVA_LOADING_MSGS[msgIdx]}
        </p>

        {/* Task cards */}
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:28}}>
          {[0,1].map(i=>{
            const s  = status[i];
            const fb = aiFb[i];
            const isChecking = s==="checking";
            const isDone = s==="done";
            const isErr  = s==="error";
            const borderCol = isDone?C.teal:isErr?C.rose:isChecking?"#F59E0B":C.s200;
            const bgCol     = isDone?C.tealL:isErr?C.roseL:isChecking?"#FFFBEB":"#fff";
            return (
              <div key={i} style={{background:bgCol,border:`1.5px solid ${borderCol}`,borderRadius:16,padding:"18px 22px",display:"flex",alignItems:"center",gap:16,textAlign:"left",transition:"all .4s"}}>
                <div style={{width:44,height:44,borderRadius:12,background:isDone?C.tealL:isErr?C.roseL:isChecking?"#FEF3C7":C.s100,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  {isChecking
                    ? <div style={{width:22,height:22,borderRadius:"50%",border:`2.5px solid #FDE68A`,borderTop:"2.5px solid #F59E0B",animation:"spin 0.9s linear infinite"}}/>
                    : <span style={{fontSize:20}}>{isDone?"✅":isErr?"⚠️":"⏳"}</span>}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,color:C.s900,fontSize:14,marginBottom:3}}>{WRITING_TASKS[i].task}</div>
                  <div style={{fontSize:12,color:isDone?C.teal:isErr?C.rose:isChecking?"#D97706":C.s400,fontWeight:500}}>{taskLabel(i,s)}</div>
                </div>
                {isDone&&fb?.band&&(
                  <div style={{textAlign:"center",background:C.tealL,borderRadius:12,padding:"8px 16px",border:`1px solid ${C.teal}40`,flexShrink:0}}>
                    <div style={{fontSize:26,fontWeight:900,color:C.teal,lineHeight:1,fontFamily:"'JetBrains Mono',monospace"}}>{fb.band}</div>
                    <div style={{fontSize:9,color:C.s400,fontWeight:700,letterSpacing:"0.1em",marginTop:2}}>BAND</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div style={{height:5,background:C.s200,borderRadius:99,overflow:"hidden",marginBottom:10}}>
          <div style={{height:"100%",borderRadius:99,background:`linear-gradient(90deg,${C.teal},#0BA870)`,transition:"width 1.2s ease",width:`${pct}%`}}/>
        </div>
        <div style={{color:C.s400,fontSize:11,fontWeight:600,letterSpacing:"0.06em"}}>
          {doneCount} OF 2 TASKS EVALUATED
        </div>

        {/* Fallback: show "Proceed to Results" if stuck >60s */}
        {showSkip&&(
          <div style={{marginTop:28,padding:"18px 24px",background:"#fff",border:`1px solid ${C.s200}`,borderRadius:14,textAlign:"center"}}>
            <div style={{fontSize:12,color:C.s400,marginBottom:12}}>
              Taking longer than expected? You can proceed with partial results.
            </div>
            <button onClick={skipToResults} style={{
              background:`linear-gradient(135deg,#0BA870,${C.teal})`,color:"#fff",border:"none",
              borderRadius:10,padding:"11px 28px",fontSize:13,fontWeight:700,cursor:"pointer",
              boxShadow:"0 4px 16px rgba(17,205,135,.25)",letterSpacing:"0.02em",
            }}>
              Proceed to Results →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── PDF EXPORT ────────────────────────────────────────────────────────────────
function exportResultsPDF({ candidateInfo, lBand, rBand, wBand, overall, L, R, W, suiteName, booking }) {
  const doc = new jsPDF({ unit:"pt", format:"a4" });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const info = candidateInfo || { name:"Candidate", email:"", id:"" };
  const dateStr = new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"});
  const TEAL   = [17, 205, 135];
  const DARK   = [15, 23, 42];
  const GREY   = [100, 116, 139];
  const LGREY  = [241, 245, 249];
  const WHITE  = [255, 255, 255];
  const AMBER  = [217, 119, 6];

  const bandCol = b => {
    if(!b) return [148,163,184];
    if(b>=8) return [16,185,129];
    if(b>=6.5) return [59,130,246];
    if(b>=5) return [245,158,11];
    return [239,68,68];
  };
  const bandLabel = b => {
    if(!b) return "N/A";
    if(b>=9) return "Expert";
    if(b>=8) return "Very Good";
    if(b>=7) return "Good";
    if(b>=6) return "Competent";
    if(b>=5) return "Modest";
    if(b>=4) return "Limited";
    return "Extremely Limited";
  };

  let y = 0;

  // ── HEADER BANNER ──
  doc.setFillColor(...DARK);
  doc.rect(0, 0, PW, 100, "F");
  // Teal accent line
  doc.setFillColor(...TEAL);
  doc.rect(0, 96, PW, 4, "F");

  // Logo text
  doc.setFont("helvetica","bold");
  doc.setFontSize(22);
  doc.setTextColor(...TEAL);
  doc.text("LingvoConnect", 40, 42);
  doc.setFontSize(10);
  doc.setTextColor(255,255,255);
  doc.setFont("helvetica","normal");
  doc.text("IELTS Practice Test · Official Score Report", 40, 58);
  doc.setFontSize(9);
  doc.setTextColor(...GREY);
  doc.text(dateStr, 40, 74);

  // Report title right side
  doc.setFont("helvetica","bold");
  doc.setFontSize(13);
  doc.setTextColor(...WHITE);
  doc.text("SCORE REPORT", PW - 40, 42, { align:"right" });
  doc.setFont("helvetica","normal");
  doc.setFontSize(9);
  doc.setTextColor(...GREY);
  doc.text("Practice Assessment", PW - 40, 58, { align:"right" });

  y = 120;

  // ── CANDIDATE INFO BLOCK ──
  doc.setFillColor(...LGREY);
  doc.roundedRect(30, y, PW - 60, 72, 8, 8, "F");
  doc.setFont("helvetica","bold");
  doc.setFontSize(10);
  doc.setTextColor(...GREY);
  doc.text("CANDIDATE", 48, y + 18);
  doc.setFontSize(16);
  doc.setTextColor(...DARK);
  doc.text(info.name || "—", 48, y + 38);
  doc.setFontSize(9);
  doc.setFont("helvetica","normal");
  doc.setTextColor(...GREY);
  const subLine = [info.email, info.id ? `ID: ${info.id}` : null, suiteName ? `Test: ${suiteName}` : null].filter(Boolean).join("   ·   ");
  doc.text(subLine, 48, y + 54);
  // Booking info right
  if(booking) {
    doc.setFont("helvetica","bold");
    doc.setFontSize(9);
    doc.setTextColor(...TEAL);
    doc.text("SPEAKING APPOINTMENT", PW - 48, y + 18, { align:"right" });
    doc.setFont("helvetica","normal");
    doc.setTextColor(...DARK);
    doc.text(`${booking.dateFormatted || booking.date}  ·  ${booking.slot}`, PW - 48, y + 34, { align:"right" });
  }

  y += 90;

  // ── OVERALL BAND SCORE ──
  doc.setFillColor(...TEAL);
  doc.roundedRect(30, y, PW - 60, 88, 10, 10, "F");
  doc.setFont("helvetica","bold");
  doc.setFontSize(9);
  doc.setTextColor(200, 255, 235);
  doc.text("OVERALL BAND SCORE", PW/2, y + 20, { align:"center" });
  doc.setFontSize(60);
  doc.setTextColor(...WHITE);
  const overallText = (overall != null && overall > 0) ? Number(overall).toFixed(1) : "N/A";
  doc.text(overallText, PW/2, y + 68, { align:"center" });
  doc.setFontSize(12);
  doc.setFont("helvetica","normal");
  doc.setTextColor(220, 255, 240);
  doc.text(bandLabel(overall), PW/2, y + 83, { align:"center" });

  y += 106;

  // ── SCORES TABLE — no emoji (jsPDF built-in fonts don't support emoji glyphs) ──
  const sections = [
    ["Listening", lBand ? Number(lBand).toFixed(1) : "N/A", `${L.correct}/${L.total} correct`, bandLabel(lBand), lBand],
    ["Reading",   rBand ? Number(rBand).toFixed(1) : "N/A", `${R.correct}/${R.total} correct`, bandLabel(rBand), rBand],
    ["Writing",   wBand ? Number(wBand).toFixed(1) : "N/A", wBand ? "AI evaluated" : "Not checked", bandLabel(wBand), wBand],
    ["Speaking",  "—",                                        booking ? "Scheduled" : "Pending", "Booked", null],
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: 30, right: 30 },
    head: [["Section","Band","Score","Level"]],
    body: sections.map(([s,b,score,lvl,bv]) => [s, b, score, lvl]),
    styles: { font:"helvetica", fontSize:10, cellPadding:10, textColor:DARK },
    headStyles: { fillColor:DARK, textColor:WHITE, fontStyle:"bold", fontSize:9, cellPadding:8 },
    columnStyles: {
      0: { fontStyle:"bold", cellWidth:160 },
      1: { cellWidth:70, halign:"center", fontStyle:"bold", fontSize:14 },
      2: { cellWidth:110, halign:"center" },
      3: { halign:"center" },
    },
    didDrawCell: (data) => {
      if(data.section==="body" && data.column.index===1) {
        const bv = sections[data.row.index][4];
        if(bv) {
          const col = bandCol(bv);
          doc.setTextColor(...col);
        }
      }
    },
    alternateRowStyles: { fillColor:[248, 250, 252] },
    theme: "grid",
  });

  y = doc.lastAutoTable.finalY + 24;

  // ── WRITING FEEDBACK ──
  const aiChecked = wBand != null;
  const hasFeedback = W.aiFeedback && Object.keys(W.aiFeedback).length > 0;

  if(hasFeedback) {
    // Section title
    doc.setFont("helvetica","bold");
    doc.setFontSize(13);
    doc.setTextColor(...DARK);
    doc.text("Nova's Writing Evaluation", 30, y);
    doc.setFont("helvetica","normal");
    doc.setFontSize(9);
    doc.setTextColor(...GREY);
    doc.text("AI feedback assessed against official IELTS band criteria", 30, y + 14);
    y += 28;

    const CRITERIA = [
      ["taskAchievement","Task Response"],
      ["coherenceCohesion","Coherence & Cohesion"],
      ["lexicalResource","Lexical Resource"],
      ["grammaticalRange","Grammatical Range & Accuracy"],
    ];
    const TASK_LABELS = ["Writing Task 1", "Writing Task 2"];

    [0, 1].forEach(tIdx => {
      const fb = W.aiFeedback[tIdx];
      if(!fb || fb._error) return;

      // Check if we need a new page
      if(y > PH - 200) { doc.addPage(); y = 40; }

      // Task header
      doc.setFillColor(...DARK);
      doc.roundedRect(30, y, PW - 60, 34, 6, 6, "F");
      doc.setFont("helvetica","bold");
      doc.setFontSize(11);
      doc.setTextColor(...WHITE);
      doc.text(TASK_LABELS[tIdx], 48, y + 14);
      if(fb.band) {
        doc.setFontSize(9);
        doc.setTextColor(...TEAL);
        doc.text(`Band ${fb.band}`, PW - 48, y + 14, { align:"right" });
      }
      doc.setFont("helvetica","normal");
      doc.setFontSize(9);
      doc.setTextColor(200, 230, 220);
      const taskTitle = W.taskData?.tasks?.[tIdx]?.task || TASK_LABELS[tIdx];
      doc.text(typeof taskTitle === "string" ? taskTitle.slice(0, 80) : TASK_LABELS[tIdx], 48, y + 26);
      y += 44;

      // Summary
      if(fb.summary) {
        if(y > PH - 100) { doc.addPage(); y = 40; }
        doc.setFillColor(240, 253, 244);
        doc.roundedRect(30, y, PW - 60, 14 + Math.ceil(doc.splitTextToSize(fb.summary, PW - 100).length * 13), 5, 5, "F");
        doc.setFillColor(...TEAL);
        doc.rect(30, y, 3, 14 + Math.ceil(doc.splitTextToSize(fb.summary, PW - 100).length * 13), "F");
        doc.setFont("helvetica","bold");
        doc.setFontSize(8);
        doc.setTextColor(...TEAL);
        doc.text("OVERALL ASSESSMENT", 42, y + 11);
        doc.setFont("helvetica","normal");
        doc.setFontSize(9);
        doc.setTextColor(22, 101, 52);
        const sumLines = doc.splitTextToSize(fb.summary, PW - 100);
        doc.text(sumLines, 42, y + 23);
        y += 18 + sumLines.length * 13;
      }

      // Criteria breakdown table
      const critRows = CRITERIA.map(([k, lbl]) => {
        const c = fb[k] || {};
        const b = typeof c === "object" ? c.band : null;
        const comment = typeof c === "object" ? (c.comment || "") : "";
        return [lbl, b ? String(b) : "N/A", comment];
      }).filter(r => r[1] !== "N/A");

      if(critRows.length > 0) {
        if(y > PH - 150) { doc.addPage(); y = 40; }
        doc.setFont("helvetica","bold");
        doc.setFontSize(9);
        doc.setTextColor(...GREY);
        doc.text("CRITERIA BREAKDOWN", 30, y + 4);
        y += 12;
        autoTable(doc, {
          startY: y,
          margin: { left: 30, right: 30 },
          head: [["Criterion","Band","Comment"]],
          body: critRows,
          styles: { font:"helvetica", fontSize:9, cellPadding:7, textColor:DARK },
          headStyles: { fillColor:[30, 41, 59], textColor:WHITE, fontStyle:"bold", fontSize:8 },
          columnStyles: {
            0: { cellWidth:140, fontStyle:"bold" },
            1: { cellWidth:50, halign:"center", fontStyle:"bold", fontSize:12 },
            2: { },
          },
          didDrawCell: (data) => {
            if(data.section==="body" && data.column.index===1) {
              const bv = parseFloat(critRows[data.row.index]?.[1]);
              if(!isNaN(bv)) { doc.setTextColor(...bandCol(bv)); }
            }
          },
          alternateRowStyles: { fillColor:[248, 250, 252] },
          theme: "grid",
        });
        y = doc.lastAutoTable.finalY + 10;
      }

      // Strengths & Improvements
      const hasStr = fb.strengths?.length > 0;
      const hasImp = fb.improvements?.length > 0;
      if(hasStr || hasImp) {
        if(y > PH - 120) { doc.addPage(); y = 40; }
        const colW = (PW - 70) / 2;
        let leftY = y, rightY = y;

        if(hasStr) {
          doc.setFillColor(240, 253, 244);
          const strLines = fb.strengths.flatMap(s => doc.splitTextToSize(`• ${s}`, colW - 24));
          const strH = 22 + strLines.length * 12 + 10;
          doc.roundedRect(30, y, colW, strH, 5, 5, "F");
          doc.setFont("helvetica","bold");
          doc.setFontSize(8);
          doc.setTextColor(22, 163, 74);
          doc.text("POSITIVE FEEDBACK", 40, y + 13);
          doc.setFont("helvetica","normal");
          doc.setFontSize(9);
          doc.setTextColor(22, 101, 52);
          doc.text(strLines, 40, y + 25);
          leftY = y + strH + 6;
        }
        if(hasImp) {
          doc.setFillColor(255, 251, 235);
          const impLines = fb.improvements.flatMap(s => doc.splitTextToSize(`• ${s}`, colW - 24));
          const impH = 22 + impLines.length * 12 + 10;
          doc.roundedRect(35 + colW, y, colW, impH, 5, 5, "F");
          doc.setFont("helvetica","bold");
          doc.setFontSize(8);
          doc.setTextColor(...AMBER);
          doc.text("AREAS FOR IMPROVEMENT", 45 + colW, y + 13);
          doc.setFont("helvetica","normal");
          doc.setFontSize(9);
          doc.setTextColor(146, 64, 14);
          doc.text(impLines, 45 + colW, y + 25);
          rightY = y + impH + 6;
        }
        y = Math.max(leftY, rightY) + 6;
      }

      // Nova's Tip
      if(fb.keyTip) {
        if(y > PH - 80) { doc.addPage(); y = 40; }
        const tipLines = doc.splitTextToSize(fb.keyTip, PW - 120);
        const tipH = 28 + tipLines.length * 13;
        doc.setFillColor(6, 78, 59);
        doc.roundedRect(30, y, PW - 60, tipH, 6, 6, "F");
        doc.setFont("helvetica","bold");
        doc.setFontSize(8);
        doc.setTextColor(...TEAL);
        doc.text("💡  NOVA'S TIP", 48, y + 14);
        doc.setFont("helvetica","normal");
        doc.setFontSize(9);
        doc.setTextColor(220, 252, 231);
        doc.text(tipLines, 48, y + 26);
        y += tipH + 14;
      }

      y += 10;
    });
  }

  // ── FOOTER on every page ──
  const totalPages = doc.getNumberOfPages();
  for(let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(...DARK);
    doc.rect(0, PH - 28, PW, 28, "F");
    doc.setFillColor(...TEAL);
    doc.rect(0, PH - 28, PW, 2, "F");
    doc.setFont("helvetica","normal");
    doc.setFontSize(8);
    doc.setTextColor(...GREY);
    doc.text("This is a practice test report by LingvoConnect. Official IELTS results are issued through authorised test centres only.", PW/2, PH - 12, { align:"center" });
    doc.text(`Page ${i} of ${totalPages}`, PW - 36, PH - 12, { align:"right" });
  }

  const safeName = (info.name || "Candidate").replace(/[^a-zA-Z0-9]/g,"_");
  doc.save(`IELTS_Report_${safeName}_${new Date().toLocaleDateString("en-GB").replace(/\//g,"-")}.pdf`);
}

// ── RESULTS ───────────────────────────────────────────────────────────────────
function Results({ scores, candidateInfo, booking, suiteName, suiteId }) {
  // Null-safe score access in case of partial data
  const L = scores.listening||{correct:0,total:40,answers:{},allQuestions:[]};
  const R = scores.reading  ||{correct:0,total:40,answers:{},allQuestions:[]};
  const W = scores.writing  ||{texts:{},taskData:null,band:null,aiFeedback:null,aiDetection:null};
  const lBand = listeningBand(L.correct, L.total);
  const rBand = readingBand(R.correct,   R.total);
  const wBand = W.band ?? null;  // null if AI didn't check
  const aiChecked = wBand != null;
  const overall = aiChecked ? overallBand([lBand, rBand, wBand]) : overallBand([lBand, rBand]);
  const bc = bandColor(overall);
  const info = candidateInfo||{name:"Candidate",email:""};

  useEffect(()=>{
    dbPushNow("participants",{
      id:genId("IELTS"), candidate:info,
      date:new Date().toLocaleDateString("en-GB"),
      timestamp:Date.now(),
      suiteId: suiteId||null,
      listeningScore:`${L.correct}/${L.total}`,
      readingScore:`${R.correct}/${R.total}`,
      listeningBand:lBand, readingBand:rBand, writingBand:wBand, overall,
      writingTexts:W.texts,
      writingFeedback:W.aiFeedback,
      writingAiDetection:W.aiDetection,
      speakingBooking:booking,
      listeningAnswers:L.answers,
      readingAnswers:R.answers,
      allListeningQuestions:L.allQuestions||[],
      allReadingQuestions:R.allQuestions||[],
    });
  },[]);

  const sections=[
    {name:"Listening",band:lBand,icon:"🎧",detail:`${L.correct}/${L.total} correct`},
    {name:"Reading",band:rBand,icon:"📖",detail:`${R.correct}/${R.total} correct`},
    {name:"Writing",band:wBand,icon:"✍️",detail:aiChecked?"AI evaluated":"Task not checked"},
    {name:"Speaking",band:null,icon:"🗣️",detail:booking?`${booking.dateFormatted||booking.date} · ${booking.slot}`:"Booking pending"},
  ];

  return (
    <div style={{maxWidth:820,margin:"0 auto",padding:"40px 24px"}}>
      {/* Hero */}
      <div style={{background:"linear-gradient(135deg,#064E3B 0%,#065F46 40%,#0BA870 100%)",borderRadius:20,padding:"52px 48px",textAlign:"center",marginBottom:28,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-40,right:-40,width:180,height:180,borderRadius:"50%",background:bc,opacity:.1}}/>
        <div style={{position:"absolute",bottom:-60,left:-30,width:220,height:220,borderRadius:"50%",background:"rgba(255,255,255,.03)"}}/>
        <div style={{color:"rgba(255,255,255,.5)",fontSize:11,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:8}}>
          Overall Band Score{!aiChecked&&<span style={{color:"#FFB703",marginLeft:8,fontSize:10}}>⚠ Writing not included</span>}
        </div>
        <div style={{fontSize:108,fontWeight:900,color:bc,lineHeight:1,letterSpacing:"-0.05em"}}>{overall.toFixed(1)}</div>
        <div style={{fontSize:20,color:"rgba(255,255,255,.85)",fontWeight:700,marginBottom:12,letterSpacing:"-0.02em"}}>{bandLabel(overall)}</div>
        <div style={{color:"rgba(255,255,255,.4)",fontSize:14}}>{info.name} · {new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}</div>
        {suiteName&&<div style={{display:"inline-block",background:"rgba(255,255,255,.08)",borderRadius:8,padding:"5px 14px",marginTop:8,fontSize:12,color:"rgba(255,255,255,.55)"}}>🧪 {suiteName}</div>}
        {booking&&(
          <div style={{display:"inline-block",background:"rgba(255,255,255,.1)",borderRadius:10,padding:"8px 20px",marginTop:14,fontSize:13,color:"rgba(255,255,255,.7)"}}>
            🗓 Speaking: {booking.dateFormatted||booking.date} at {booking.slot}
          </div>
        )}
      </div>

      {/* Sections */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:24}}>
        {sections.map(({name,band,icon,detail})=>{
          const col=band?bandColor(band):C.s400;
          return (
            <div key={name} style={{...cardStyle({padding:20,textAlign:"center"})}}>
              <div style={{fontSize:26,marginBottom:10}}>{icon}</div>
              <div style={{fontSize:11,color:C.s400,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>{name}</div>
              {band!=null?(
                <>
                  <div style={{fontSize:44,fontWeight:900,color:col,lineHeight:1,letterSpacing:"-0.04em"}}>{band.toFixed(1)}</div>
                  <div style={{height:3,background:C.s200,borderRadius:99,margin:"10px 0 6px"}}>
                    <div style={{width:`${(band-1)/8*100}%`,height:"100%",background:col,borderRadius:99}}/>
                  </div>
                </>
              ):(
                <div style={{fontSize:12,color:name==="Writing"?C.amber:C.teal,fontWeight:700,margin:"12px 0 6px"}}>
                  {name==="Writing"?"Not checked":"Scheduled"}
                </div>
              )}
              <div style={{fontSize:11,color:C.s400}}>{detail}</div>
            </div>
          );
        })}
      </div>

      {/* Band table */}
      <div style={{...cardStyle({padding:24,marginBottom:20})}}>
        <div style={{fontWeight:800,color:C.s900,marginBottom:16,fontSize:15}}>IELTS Band Descriptors</div>
        {[[9,"Expert User"],[8,"Very Good User"],[7,"Good User"],[6,"Competent User"],[5,"Modest User"],[4,"Limited User"]].map(([b,desc])=>{
          const active=Math.floor(overall)===b;
          return (
            <div key={b} style={{display:"flex",alignItems:"center",gap:16,padding:"9px 12px",borderRadius:8,background:active?bandBg(b):"transparent",marginBottom:2}}>
              <div style={{fontFamily:"'JetBrains Mono',monospace",color:bandColor(b),fontWeight:800,fontSize:17,width:24,textAlign:"center"}}>{b}</div>
              <div style={{fontSize:14,color:C.s800,fontWeight:active?700:400}}>{desc}</div>
              {active&&<div style={{marginLeft:"auto",fontSize:12,color:bandColor(b),fontWeight:700}}>◀ Your result</div>}
            </div>
          );
        })}
      </div>

      {/* Nova Writing Feedback */}
      {W.aiFeedback && Object.keys(W.aiFeedback).length>0 && (
        <div style={{marginBottom:20}}>
          {/* Nova header */}
          <div style={{background:"linear-gradient(135deg,#0F172A 0%,#064E3B 100%)",borderRadius:20,padding:"28px 32px",marginBottom:16,display:"flex",alignItems:"center",gap:20}}>
            <div style={{width:64,height:64,borderRadius:16,overflow:"hidden",flexShrink:0,boxShadow:"0 4px 20px rgba(17,205,135,.35)",background:"#1a2e25"}}>
              <img src="/nova.png" alt="Nova" style={{width:"100%",height:"100%",objectFit:"contain",display:"block"}}/>
            </div>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:"rgba(17,205,135,.7)",letterSpacing:"0.18em",textTransform:"uppercase",marginBottom:4}}>LingvoConnect's AI Examiner</div>
              <div style={{fontSize:20,fontWeight:800,color:"#fff",letterSpacing:"-0.02em"}}>Nova's Writing Evaluation</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.45)",marginTop:3}}>Assessed against official IELTS band criteria</div>
            </div>
          </div>

          {[0,1].map(tIdx=>{
            const fb = W.aiFeedback[tIdx];
            if(!fb||fb._error) return null;
            const CRITERIA = [
              ["taskAchievement","Task Response","📋"],
              ["coherenceCohesion","Coherence & Cohesion","🔗"],
              ["lexicalResource","Lexical Resource","📚"],
              ["grammaticalRange","Grammatical Range & Accuracy","⚙️"],
            ];
            return (
              <div key={tIdx} style={{...cardStyle({padding:28,marginBottom:16})}}>
                {/* Task header */}
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24,paddingBottom:20,borderBottom:`1px solid ${C.s200}`}}>
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:C.brand,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>Writing {WRITING_TASKS[tIdx].task}</div>
                    <div style={{fontSize:16,fontWeight:800,color:C.s900}}>Evaluation complete. Here's your IELTS Writing score.</div>
                  </div>
                  {fb.band&&(
                    <div style={{textAlign:"center",background:bandBg(fb.band),borderRadius:14,padding:"12px 22px",border:`2px solid ${bandColor(fb.band)}30`,flexShrink:0}}>
                      <div style={{fontSize:40,fontWeight:900,color:bandColor(fb.band),lineHeight:1,fontFamily:"'JetBrains Mono',monospace"}}>{fb.band}</div>
                      <div style={{fontSize:10,fontWeight:700,color:bandColor(fb.band),letterSpacing:"0.1em",marginTop:2}}>BAND SCORE</div>
                    </div>
                  )}
                </div>

                {/* Summary */}
                {fb.summary&&(
                  <div style={{background:C.s100,borderRadius:12,padding:"14px 18px",marginBottom:20,borderLeft:`4px solid ${C.brand}`}}>
                    <div style={{fontSize:11,fontWeight:700,color:C.brand,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>Overall Assessment</div>
                    <p style={{fontSize:13,color:C.s800,lineHeight:1.8,margin:0}}>{fb.summary}</p>
                  </div>
                )}

                {/* 4 Criteria */}
                <div style={{fontSize:13,fontWeight:700,color:C.s900,marginBottom:12}}>Criteria Breakdown</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
                  {CRITERIA.map(([k,lbl,icon])=>{
                    const crit = fb[k]||{};
                    const b = typeof crit==="object"?crit.band:null;
                    const comment = typeof crit==="object"?crit.comment:"";
                    if(!b) return null;
                    return (
                      <div key={k} style={{background:"#fff",border:`1.5px solid ${bandColor(b)}25`,borderRadius:12,padding:"14px 16px",boxShadow:"0 1px 4px rgba(0,0,0,.04)"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                          <div style={{fontSize:11,fontWeight:700,color:C.s400,textTransform:"uppercase",letterSpacing:"0.06em"}}>{icon} {lbl}</div>
                          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:20,fontWeight:900,color:bandColor(b)}}>{b}</div>
                        </div>
                        <div style={{height:4,background:C.s200,borderRadius:99,marginBottom:8}}>
                          <div style={{width:`${(b-1)/8*100}%`,height:"100%",background:bandColor(b),borderRadius:99,transition:"width .6s ease"}}/>
                        </div>
                        {comment&&<p style={{fontSize:12,color:C.s600,lineHeight:1.7,margin:0}}>{comment}</p>}
                      </div>
                    );
                  })}
                </div>

                {/* Strengths & Improvements */}
                {(fb.strengths?.length>0||fb.improvements?.length>0)&&(
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
                    {fb.strengths?.length>0&&(
                      <div style={{background:"#F0FDF4",border:"1.5px solid #BBF7D0",borderRadius:12,padding:"14px 16px"}}>
                        <div style={{fontSize:11,fontWeight:700,color:"#16A34A",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>✓ Positive Feedback</div>
                        {fb.strengths.map((s,i)=>(
                          <div key={i} style={{display:"flex",gap:8,marginBottom:6,fontSize:12,color:"#166534",lineHeight:1.6}}>
                            <span style={{color:"#16A34A",flexShrink:0}}>•</span><span>{s}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {fb.improvements?.length>0&&(
                      <div style={{background:"#FFFBEB",border:"1.5px solid #FDE68A",borderRadius:12,padding:"14px 16px"}}>
                        <div style={{fontSize:11,fontWeight:700,color:"#D97706",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>↑ Areas for Improvement</div>
                        {fb.improvements.map((s,i)=>(
                          <div key={i} style={{display:"flex",gap:8,marginBottom:6,fontSize:12,color:"#92400E",lineHeight:1.6}}>
                            <span style={{color:"#D97706",flexShrink:0}}>•</span><span>{s}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* How to improve */}
                {fb.suggestions?.length>0&&(
                  <div style={{background:"#F8F7FF",border:"1.5px solid #DDD6FE",borderRadius:12,padding:"14px 16px",marginBottom:16}}>
                    <div style={{fontSize:11,fontWeight:700,color:C.violet,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>📈 How to Improve Your Score</div>
                    {fb.suggestions.map((s,i)=>(
                      <div key={i} style={{display:"flex",gap:8,marginBottom:6,fontSize:12,color:"#4C1D95",lineHeight:1.6}}>
                        <span style={{color:C.violet,flexShrink:0}}>→</span><span>{s}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Nova's Tip */}
                {fb.keyTip&&(
                  <div style={{background:"linear-gradient(135deg,#064E3B,#065F46)",borderRadius:12,padding:"16px 20px",display:"flex",gap:14,alignItems:"flex-start",marginBottom:12}}>
                    <div style={{width:36,height:36,borderRadius:10,background:"rgba(17,205,135,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>💡</div>
                    <div>
                      <div style={{fontSize:11,fontWeight:700,color:"rgba(17,205,135,.8)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>Nova's Tip</div>
                      <p style={{fontSize:13,color:"rgba(255,255,255,.85)",lineHeight:1.75,margin:0}}>{fb.keyTip}</p>
                    </div>
                  </div>
                )}

                {/* AI / Human text detection */}
                {fb.aiDetection&&(()=>{
                  const d = fb.aiDetection;
                  const humanPct = 100 - d.risk;
                  const riskColor = d.risk<=25?"#16A34A":d.risk<=55?"#D97706":d.risk<=80?"#EA580C":"#DC2626";
                  const riskBg   = d.risk<=25?"#F0FDF4":d.risk<=55?"#FFFBEB":d.risk<=80?"#FFF7ED":"#FEF2F2";
                  const verdict  = d.verdict||"Human";
                  return (
                    <div style={{borderRadius:12,border:`2px solid ${riskColor}30`,background:riskBg,padding:"16px 20px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                        <div>
                          <div style={{fontSize:11,fontWeight:800,color:riskColor,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:2}}>🤖 Text Authenticity Check</div>
                          <div style={{fontSize:11,color:"#64748B"}}>Analysed by Nova · GPT-4o</div>
                        </div>
                        <div style={{display:"flex",gap:10,alignItems:"center"}}>
                          <div style={{textAlign:"center",background:"#fff",borderRadius:10,padding:"8px 14px",border:`1.5px solid #16A34A`}}>
                            <div style={{fontSize:22,fontWeight:900,color:"#16A34A",lineHeight:1,fontFamily:"'JetBrains Mono',monospace"}}>{humanPct}%</div>
                            <div style={{fontSize:9,fontWeight:700,color:"#16A34A",marginTop:2}}>HUMAN</div>
                          </div>
                          <div style={{textAlign:"center",background:"#fff",borderRadius:10,padding:"8px 14px",border:`1.5px solid ${riskColor}`}}>
                            <div style={{fontSize:22,fontWeight:900,color:riskColor,lineHeight:1,fontFamily:"'JetBrains Mono',monospace"}}>{d.risk}%</div>
                            <div style={{fontSize:9,fontWeight:700,color:riskColor,marginTop:2}}>AI RISK</div>
                          </div>
                        </div>
                      </div>
                      {/* Dual bar */}
                      <div style={{height:8,background:"#e5e7eb",borderRadius:99,marginBottom:10,overflow:"hidden",display:"flex"}}>
                        <div style={{width:`${humanPct}%`,height:"100%",background:"#16A34A",borderRadius:"99px 0 0 99px",transition:"width .8s ease"}}/>
                        <div style={{width:`${d.risk}%`,height:"100%",background:riskColor,borderRadius:"0 99px 99px 0",transition:"width .8s ease"}}/>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,fontWeight:600,marginBottom:d.explanation?10:0}}>
                        <span style={{color:"#16A34A"}}>✓ Human: {humanPct}%</span>
                        <span style={{color:riskColor,fontWeight:700}}>Verdict: {verdict}</span>
                        <span style={{color:riskColor}}>AI Risk: {d.risk}%</span>
                      </div>
                      {d.explanation&&<p style={{fontSize:12,color:"#374151",lineHeight:1.65,margin:0,marginTop:8,paddingTop:10,borderTop:"1px solid rgba(0,0,0,.07)"}}>{d.explanation}</p>}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}

      {/* Export PDF button */}
      <div style={{textAlign:"center",marginBottom:20}}>
        <button
          onClick={()=>exportResultsPDF({candidateInfo:info, lBand, rBand, wBand, overall, L, R, W, suiteName, booking})}
          style={{
            display:"inline-flex",alignItems:"center",gap:10,
            background:"linear-gradient(135deg,#064E3B 0%,#059669 100%)",
            color:"#fff",border:"none",borderRadius:14,padding:"14px 32px",
            fontSize:15,fontWeight:800,cursor:"pointer",letterSpacing:"-0.01em",
            boxShadow:"0 4px 20px rgba(17,205,135,.35)",transition:"transform .15s,box-shadow .15s",
          }}
          onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 8px 28px rgba(17,205,135,.45)";}}
          onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="0 4px 20px rgba(17,205,135,.35)";}}
        >
          <span style={{fontSize:20}}>📄</span>
          Export Score Report (PDF)
        </button>
        <div style={{fontSize:11,color:C.s400,marginTop:8}}>Includes scores, band breakdown & writing feedback</div>
      </div>

      <div style={{background:C.brandL,borderRadius:12,padding:"14px 20px",textAlign:"center",color:C.brand,fontSize:13,fontWeight:500}}>
        This is a practice test by LingvoConnect. Official IELTS results are issued through authorised test centres only.
        Your results have been saved and are viewable in the Admin Portal.
      </div>
    </div>
  );
}

// ── AI SPEAKING MANAGER ───────────────────────────────────────────────────────
function AISpeakingManager({ onRefresh }) {
  const db0 = loadDB();
  const [enabled, setEnabled]   = useState(!!(db0.aiSpeakingEnabled));
  const [q1, setQ1]             = useState((db0.speakingQuestions?.part1||DEFAULT_SPEAKING_QUESTIONS.part1).join("\n"));
  const [cue, setCue]           = useState(db0.speakingQuestions?.part2?.cue||DEFAULT_SPEAKING_QUESTIONS.part2.cue);
  const [q3, setQ3]             = useState((db0.speakingQuestions?.part3||DEFAULT_SPEAKING_QUESTIONS.part3).join("\n"));
  const [saved, setSaved]       = useState(false);

  const save = () => {
    const db = loadDB();
    db.aiSpeakingEnabled = enabled;
    db.speakingQuestions = {
      part1: q1.split("\n").map(s=>s.trim()).filter(Boolean),
      part2: { cue: cue.trim() },
      part3: q3.split("\n").map(s=>s.trim()).filter(Boolean),
    };
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    _flushConfig(db);
    setSaved(true);
    setTimeout(()=>setSaved(false), 2500);
    onRefresh?.();
  };

  const taStyle = { ...inputStyle, width:"100%", minHeight:120, fontFamily:"inherit", resize:"vertical", fontSize:12, lineHeight:1.7 };

  return (
    <div style={{maxWidth:760}}>
      <div style={{fontWeight:800,fontSize:18,color:C.s900,marginBottom:4}}>AI Speaking Examiner</div>
      <p style={{fontSize:13,color:C.s500,marginBottom:24}}>
        Enable or disable the in-test AI speaking exam. When disabled, candidates skip straight to the speaking booking page.
        You can customise the questions for each part below.
      </p>

      {/* Enable / Disable toggle */}
      <div style={{...cardStyle({padding:20,marginBottom:24}),display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div style={{fontWeight:700,fontSize:15,color:C.s900,marginBottom:3}}>AI Speaking Exam</div>
          <div style={{fontSize:12,color:C.s400}}>
            {enabled ? "Candidates will complete the AI speaking exam before booking." : "Candidates will go directly to the speaking booking page."}
          </div>
        </div>
        <button onClick={()=>setEnabled(e=>!e)} style={{
          width:56,height:30,borderRadius:99,border:"none",cursor:"pointer",position:"relative",
          background:enabled?C.teal:C.s300,transition:"background .2s",flexShrink:0,
        }}>
          <span style={{
            position:"absolute",top:3,left:enabled?28:4,width:24,height:24,borderRadius:"50%",
            background:"#fff",transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,.25)",
          }}/>
        </button>
      </div>

      {/* Questions editor — shown whether enabled or not so admin can always edit */}
      <div style={{display:"flex",flexDirection:"column",gap:20}}>

        {/* Part 1 */}
        <div style={cardStyle({padding:22})}>
          <div style={{fontWeight:700,fontSize:14,color:C.s900,marginBottom:4}}>Part 1 — Introduction & Interview</div>
          <div style={{fontSize:12,color:C.s400,marginBottom:10}}>One question per line. The examiner will ask these in order.</div>
          <textarea value={q1} onChange={e=>setQ1(e.target.value)} style={taStyle} spellCheck={false}/>
          <div style={{fontSize:11,color:C.s400,marginTop:6}}>{q1.split("\n").filter(Boolean).length} question{q1.split("\n").filter(Boolean).length!==1?"s":""}</div>
        </div>

        {/* Part 2 */}
        <div style={cardStyle({padding:22})}>
          <div style={{fontWeight:700,fontSize:14,color:C.s900,marginBottom:4}}>Part 2 — Individual Long Turn (Cue Card)</div>
          <div style={{fontSize:12,color:C.s400,marginBottom:10}}>Write the full cue card text. Use bullet points with "•" for the talking points.</div>
          <textarea value={cue} onChange={e=>setCue(e.target.value)} style={{...taStyle,minHeight:160}} spellCheck={false}/>
        </div>

        {/* Part 3 */}
        <div style={cardStyle({padding:22})}>
          <div style={{fontWeight:700,fontSize:14,color:C.s900,marginBottom:4}}>Part 3 — Two-Way Discussion</div>
          <div style={{fontSize:12,color:C.s400,marginBottom:10}}>One question per line.</div>
          <textarea value={q3} onChange={e=>setQ3(e.target.value)} style={taStyle} spellCheck={false}/>
          <div style={{fontSize:11,color:C.s400,marginTop:6}}>{q3.split("\n").filter(Boolean).length} question{q3.split("\n").filter(Boolean).length!==1?"s":""}</div>
        </div>

        {/* Reset to defaults */}
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <button onClick={save} style={{...btnStyle("primary"),padding:"11px 28px",fontSize:14,fontWeight:800}}>
            {saved ? "✓ Saved!" : "Save Settings"}
          </button>
          <button onClick={()=>{
            setQ1(DEFAULT_SPEAKING_QUESTIONS.part1.join("\n"));
            setCue(DEFAULT_SPEAKING_QUESTIONS.part2.cue);
            setQ3(DEFAULT_SPEAKING_QUESTIONS.part3.join("\n"));
          }} style={{...btnStyle("ghost"),padding:"11px 20px",fontSize:13}}>
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ADMIN DASHBOARD ───────────────────────────────────────────────────────────
function AdminDashboard({ onExit }) {
  const [auth, setAuth]       = useState(false);
  const [pw, setPw]           = useState("");
  const [tab, setTab]         = useState("overview");
  const [db, setDb]           = useState(loadDB());
  const [selected, setSelected] = useState(null);

  const [refreshing, setRefreshing] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [recalcMsg, setRecalcMsg] = useState("");
  const [candidateSearch, setCandidateSearch] = useState("");
  const refresh = async () => {
    setRefreshing(true);
    await reloadDB();
    setDb({...loadDB()});
    setRefreshing(false);
  };
  useEffect(()=>{const t=setInterval(refresh,15000);return()=>clearInterval(t);},[]);

  const recalculateAllBands = async () => {
    setRecalculating(true);

    // Build answer key maps from ALL current tests (always fresh in _db.tests)
    const keyByText={}, keyById={};
    (_db.tests||[]).forEach(t=>{
      let off=0;
      const addQ=(q,idx)=>{
        const c=(q.correct||"").trim(); if(!c) return;
        const txt=(q.text||"").trim().toLowerCase().slice(0,120);
        if(txt) keyByText[txt]=c;
        keyById[idx]=c;
      };
      if(t.sections?.length>0){
        t.sections.forEach(s=>{(s.questions||[]).forEach((q,j)=>addQ(q,off+j+1));off+=s.questions?.length||0;});
      } else if(t.passages?.length>0){
        t.passages.forEach(p=>{(p.questions||[]).forEach((q,j)=>addQ(q,off+j+1));off+=p.questions?.length||0;});
      } else if(t.questions?.length>0){
        t.questions.forEach((q,i)=>addQ(q,i+1));
      }
    });

    const getKey=q=>{
      const txt=(q.text||"").trim().toLowerCase().slice(0,120);
      if(txt&&keyByText[txt]) return keyByText[txt];
      if(q.id&&keyById[q.id]) return keyById[q.id];
      return q.correct||"";
    };

    const scoreAll=(qs,ans)=>{
      let n=0;
      qs.forEach(q=>{
        const raw=ans[q.id];
        const a=(raw&&typeof raw==="object"?raw.text:(raw||"")).trim().toLowerCase();
        const c=(q.correct||"").trim().toLowerCase();
        if(!a||!c) return;
        if(q.type==="yesno"||q.type==="truefalse"){if(a===c)n++;return;}
        if(TEXT_INPUT_TYPES.has(q.type)||q.type==="short"||q.type==="fillblank"){if(a===c||a.includes(c)||c.includes(a)){n++;return;}}
        if(raw&&typeof raw==="object"&&typeof q.correctIdx==="number"){if(raw.idx===q.correctIdx){n++;return;}}
        if(a===c){n++;return;}
        const al=a.replace(/[^a-h]/g,"")[0],cl=c.replace(/[^a-h]/g,"")[0];
        if(al&&cl&&al===cl)n++;
      });
      return n;
    };

    // Load fresh participants from Supabase, fall back to local
    const freshPts=supabase?(await _loadParticipants()||[]):[];
    const allPtsMap={};
    [...(_db.participants||[]),...freshPts].forEach(p=>{if(p.id)allPtsMap[p.id]=p;});
    const participants=Object.values(allPtsMap);

    let count=0;
    const scoreOverrides={}; // saved to ielts_store — survives refreshes
    const updatedPts=participants.map(p=>{
      if(!p.listeningScore&&!p.readingScore) return p;
      const [,lt]=(p.listeningScore||"0/40").split("/").map(Number);
      const [,rt]=(p.readingScore||"0/40").split("/").map(Number);
      let lc=Number((p.listeningScore||"0/40").split("/")[0])||0;
      let rc=Number((p.readingScore||"0/40").split("/")[0])||0;

      let newLQs=(p.allListeningQuestions||[]).map(q=>({...q,correct:getKey(q)}));
      if(newLQs.length&&p.listeningAnswers&&Object.keys(p.listeningAnswers).length)
        lc=scoreAll(newLQs,p.listeningAnswers);

      let newRQs=(p.allReadingQuestions||[]).map(q=>({...q,correct:getKey(q)}));
      if(newRQs.length&&p.readingAnswers&&Object.keys(p.readingAnswers).length)
        rc=scoreAll(newRQs,p.readingAnswers);

      const newLB=listeningBand(lc,lt||40);
      const newRB=readingBand(rc,rt||40);
      const wBand=p.writingBand??null;
      const newOverall=overallBand(wBand!=null?[newLB,newRB,wBand]:[newLB,newRB]);
      count++;
      const patch={
        listeningScore:`${lc}/${lt||40}`,readingScore:`${rc}/${rt||40}`,
        listeningBand:newLB,readingBand:newRB,overall:newOverall,
        allListeningQuestions:newLQs,allReadingQuestions:newRQs,
      };
      if(p.id) scoreOverrides[p.id]=patch; // persist via ielts_store
      return {...p,...patch};
    });

    // Save overrides to ielts_store (reliable — same table as tests/suites)
    _db={..._db,participants:updatedPts,scoreOverrides};
    try{localStorage.setItem(DB_KEY,JSON.stringify(_db));}catch{}
    await _flushConfig(_db); // writes scoreOverrides to Supabase ielts_store
    setDb({..._db}); // update UI immediately

    setRecalculating(false);
    setRecalcMsg(`✓ Recalculated ${count} student records`);
    setTimeout(()=>setRecalcMsg(""),5000);
  };

  if(!auth) return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#0F172A,#064E3B)",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{...cardStyle({padding:40,width:380})}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <Logo/>
          <div style={{marginTop:16,fontSize:13,color:C.s400}}>Admin Portal — Sign In</div>
        </div>
        <label style={labelStyle}>Password</label>
        <input type="password" value={pw} onChange={e=>setPw(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&(pw==="Lingvo.2025!"?setAuth(true):alert("Incorrect password"))}
          placeholder="Enter password" style={inputStyle} autoFocus/>
        <button onClick={()=>pw==="Lingvo.2025!"?setAuth(true):alert("Incorrect password")}
          style={{...btnStyle("primary"),width:"100%",marginTop:14,padding:"12px",borderRadius:10,fontSize:15}}>
          Sign In →
        </button>
      </div>
    </div>
  );

  const pts=db.participants||[], bks=db.bookings||[];
  const avg=arr=>arr.length?(arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1):"—";
  const navItems=[["overview","📊","Overview"],["participants","👥","Test Takers"],["bookings","🗓️","Bookings"],["slots","🕐","Speaking Slots"],["analytics","📈","Analytics"],["suites","🧪","Test Suites"],["assign","📋","Assignments"],["speaking","🗣️","AI Speaking"],["addtest","➕","Section Builder"]];

  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",fontFamily:"'Montserrat',sans-serif"}}>
      {/* Admin topbar */}
      <div style={{background:"#0F172A",borderBottom:"2px solid #11CD87",padding:"0 28px",height:64,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:200}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <Logo size={16} dark/>
          <div style={{width:1,height:24,background:"rgba(255,255,255,.12)"}}/>
          <span style={{background:"#11CD87",color:"#064E3B",fontSize:10,fontWeight:800,padding:"3px 10px",borderRadius:20,letterSpacing:"0.1em"}}>ADMIN PORTAL</span>
          {selected&&<span style={{color:"rgba(255,255,255,.3)",fontSize:12}}>/ {selected.candidate?.name||selected.email||"Profile"}</span>}
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={refresh} disabled={refreshing} style={{display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,.06)",color:"rgba(255,255,255,.7)",border:"1px solid rgba(255,255,255,.12)",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:12,fontWeight:600,opacity:refreshing?.6:1}}>
            <span style={{display:"inline-block",animation:refreshing?"spin 0.6s linear infinite":"none"}}>↻</span>
            {refreshing?"Syncing…":"Refresh"}
          </button>
          <button onClick={onExit} style={{display:"flex",alignItems:"center",gap:6,background:"rgba(225,29,72,.12)",color:"#FDA4AF",border:"1px solid rgba(225,29,72,.25)",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:12,fontWeight:600}}>← Exit Admin</button>
        </div>
      </div>

      <div style={{display:"flex",flex:1}}>
        {/* Sidebar */}
        <div style={{width:220,background:"#fff",borderRight:`1px solid ${C.s200}`,paddingTop:16}}>
          {navItems.map(([t,icon,lbl])=>(
            <button key={t} onClick={()=>{setTab(t);setSelected(null);}} style={{
              display:"flex",alignItems:"center",gap:12,width:"100%",padding:"11px 20px",
              border:"none",cursor:"pointer",textAlign:"left",fontSize:13,transition:"all .15s",
              background:tab===t?C.brandL:"transparent",
              color:tab===t?C.brand:C.s600,fontWeight:tab===t?700:500,
              borderLeft:`3px solid ${tab===t?C.brand:"transparent"}`,
            }}>{icon} {lbl}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{flex:1,overflow:"auto",padding:32}}>

          {tab==="overview"&&(
            <div>
              <h2 style={{fontSize:22,fontWeight:800,color:C.s900,letterSpacing:"-0.03em",marginBottom:24}}>Dashboard Overview</h2>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:28}}>
                {[["Total Candidates",pts.length,C.brand,"👥"],["Avg Band",avg(pts.map(p=>p.overall||0)),C.teal,"🏆"],["Speaking Booked",bks.length,C.violet,"🗓️"],["This Week",pts.filter(p=>Date.now()-p.timestamp<7*864e5).length,C.amber,"📅"]].map(([lbl,val,col,icon])=>(
                  <div key={lbl} style={{...cardStyle({padding:20})}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <div>
                        <div style={{fontSize:11,color:C.s400,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>{lbl}</div>
                        <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:32,fontWeight:800,color:col}}>{val}</div>
                      </div>
                      <span style={{fontSize:26}}>{icon}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24,padding:"14px 20px",background:C.brandL,borderRadius:12,border:`1px solid ${C.brand}30`}}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:13,color:C.s900}}>Recalculate Band Scores</div>
                  <div style={{fontSize:12,color:C.s600}}>Updates all stored band scores using the corrected official IELTS conversion tables.</div>
                </div>
                {recalcMsg&&<span style={{fontSize:12,color:C.teal,fontWeight:700}}>{recalcMsg}</span>}
                <button onClick={recalculateAllBands} disabled={recalculating} style={{...btnStyle("primary"),padding:"9px 20px",fontSize:13,opacity:recalculating?.6:1}}>
                  {recalculating?"Recalculating…":"↻ Recalculate All Bands"}
                </button>
              </div>
              <h3 style={{fontSize:11,color:C.s400,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:12}}>Recent Candidates</h3>
              {(()=>{
                const byEmail={};
                pts.forEach(p=>{const cand=p.candidate||p;const key=(cand?.email||p.email||p.id||"").toLowerCase();if(!byEmail[key])byEmail[key]={email:key,candidate:cand,attempts:[]};byEmail[key].attempts.push(p);});
                const recentProfiles=Object.values(byEmail).map(g=>({...g,attempts:g.attempts.sort((a,b)=>(b.timestamp||0)-(a.timestamp||0))})).sort((a,b)=>(b.attempts[0]?.timestamp||0)-(a.attempts[0]?.timestamp||0)).slice(0,8);
                return <ParticipantTable profiles={recentProfiles} onSelect={profile=>{setSelected(profile);setTab("participants");}}/>;
              })()}
            </div>
          )}

          {tab==="participants"&&!selected&&(
            <div>
              {(() => {
                // Group all attempts by email → one profile per candidate
                const byEmail = {};
                pts.forEach(p => {
                  const cand = p.candidate || p;
                  const key = (cand?.email || p.email || p.id || "").toLowerCase();
                  if(!byEmail[key]) byEmail[key] = {email:key, candidate:cand, attempts:[]};
                  byEmail[key].attempts.push(p);
                });
                const profiles = Object.values(byEmail)
                  .map(g=>({...g, attempts:g.attempts.sort((a,b)=>(b.timestamp||0)-(a.timestamp||0))}))
                  .sort((a,b)=>(b.attempts[0]?.timestamp||0)-(a.attempts[0]?.timestamp||0));
                return (
                  <div>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10}}>
                      <h2 style={{fontSize:22,fontWeight:800,color:C.s900,letterSpacing:"-0.03em",margin:0}}>
                        All Candidates ({profiles.length})
                        <span style={{fontSize:13,color:C.s400,fontWeight:400,marginLeft:10}}>{pts.length} total test{pts.length!==1?"s":""}</span>
                      </h2>
                      <input
                        placeholder="🔍  Search by name or email…"
                        value={candidateSearch}
                        onChange={e=>setCandidateSearch(e.target.value)}
                        style={{...inputStyle,width:260,fontSize:13}}
                      />
                    </div>
                    {profiles.length===0?<EmptyState icon="👥" text="No candidates yet."/>:
                      <ParticipantTable profiles={profiles.filter(p=>{
                        const q=candidateSearch.trim().toLowerCase();
                        if(!q) return true;
                        return (p.candidate?.name||"").toLowerCase().includes(q)||(p.email||"").toLowerCase().includes(q);
                      })} onSelect={setSelected}/>}
                  </div>
                );
              })()}
            </div>
          )}
          {tab==="participants"&&selected&&<ParticipantDetail profile={selected} onBack={()=>setSelected(null)} onUpdateProfile={setSelected}/>}

          {tab==="bookings"&&(
            <div>
              <h2 style={{fontSize:22,fontWeight:800,color:C.s900,letterSpacing:"-0.03em",marginBottom:20}}>Speaking Bookings ({bks.length})</h2>
              {bks.length===0?<EmptyState icon="🗓️" text="No bookings yet."/>:(
                <div style={{...cardStyle({overflow:"hidden"})}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead>
                      <tr style={{background:C.s900}}>
                        {["Booking ID","Candidate","Date","Time","Mode"].map(h=>(
                          <th key={h} style={{padding:"11px 16px",textAlign:"left",color:"rgba(255,255,255,.6)",fontSize:11,fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase"}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bks.map((b,i)=>(
                        <tr key={i} style={{borderTop:`1px solid ${C.s200}`}}>
                          <td style={{padding:"11px 16px",fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:C.s400}}>{b.id}</td>
                          <td style={{padding:"11px 16px"}}>
                            <div style={{fontWeight:700,fontSize:14}}>{b.candidate?.name}</div>
                            <div style={{fontSize:12,color:C.s400}}>{b.candidate?.email}</div>
                          </td>
                          <td style={{padding:"11px 16px",fontSize:13}}>{b.dateFormatted||b.date}</td>
                          <td style={{padding:"11px 16px",fontWeight:700,color:C.brand,fontSize:14}}>{b.slot}</td>
                          <td style={{padding:"11px 16px"}}>
                            <span style={{...tagStyle(b.mode==="online"?C.brand:C.amber)}}>{b.mode==="online"?"🎥 Online":"🏛️ In-Person"}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab==="slots"&&<SlotsManager onRefresh={refresh}/>}

          {tab==="analytics"&&(
            <div>
              <h2 style={{fontSize:22,fontWeight:800,color:C.s900,letterSpacing:"-0.03em",marginBottom:20}}>Analytics</h2>
              {pts.length===0?<EmptyState icon="📈" text="No data yet."/>:(
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
                  <div style={{...cardStyle({padding:24})}}>
                    <div style={{fontWeight:700,color:C.s900,marginBottom:16}}>Overall Band Distribution</div>
                    {[9,8,7,6,5,4].map(b=>{
                      const cnt=pts.filter(p=>Math.floor(p.overall||0)===b).length;
                      const pct=pts.length?cnt/pts.length*100:0;
                      return (
                        <div key={b} style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                          <div style={{fontFamily:"'JetBrains Mono',monospace",color:bandColor(b),fontWeight:800,width:20,textAlign:"center"}}>{b}</div>
                          <div style={{flex:1,height:20,background:C.s100,borderRadius:8,overflow:"hidden"}}>
                            <div style={{width:`${pct}%`,height:"100%",background:bandColor(b),borderRadius:8,display:"flex",alignItems:"center",paddingLeft:8,transition:"width .5s"}}>
                              {cnt>0&&<span style={{color:"#fff",fontSize:11,fontWeight:700}}>{cnt}</span>}
                            </div>
                          </div>
                          <div style={{color:C.s400,fontSize:12,width:32,textAlign:"right"}}>{pct.toFixed(0)}%</div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{...cardStyle({padding:24})}}>
                    <div style={{fontWeight:700,color:C.s900,marginBottom:16}}>Section Averages</div>
                    {[["Listening",avg(pts.map(p=>p.listeningBand||0))],["Reading",avg(pts.map(p=>p.readingBand||0))],["Writing",avg(pts.map(p=>p.writingBand||0))],["Overall",avg(pts.map(p=>p.overall||0))]].map(([name,val])=>(
                      <div key={name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${C.s200}`}}>
                        <span style={{fontSize:14,color:C.s800}}>{name}</span>
                        <span style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:800,color:bandColor(parseFloat(val)||5),fontSize:22}}>{val}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{...cardStyle({padding:24})}}>
                    <div style={{fontWeight:700,color:C.s900,marginBottom:16}}>Nationalities</div>
                    {Object.entries(pts.reduce((acc,p)=>{const n=p.candidate?.nationality||"Unknown";acc[n]=(acc[n]||0)+1;return acc;},{})).map(([nat,cnt])=>(
                      <div key={nat} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${C.s200}`}}>
                        <span style={{fontSize:14}}>{nat}</span>
                        <span style={{fontWeight:700,color:C.brand}}>{cnt}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{...cardStyle({padding:24})}}>
                    <div style={{fontWeight:700,color:C.s900,marginBottom:16}}>Test Types</div>
                    {Object.entries(pts.reduce((acc,p)=>{const t=p.candidate?.testType||"Academic";acc[t]=(acc[t]||0)+1;return acc;},{})).map(([t,cnt])=>(
                      <div key={t} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${C.s200}`}}>
                        <span style={{fontSize:14}}>{t}</span>
                        <span style={{fontWeight:700,color:C.brand}}>{cnt}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab==="suites"&&<TestSuiteManager/>}
          {tab==="assign"&&<AssignManager/>}
          {tab==="speaking"&&<AISpeakingManager onRefresh={refresh}/>}
          {tab==="addtest"&&<AddTestManager/>}
        </div>
      </div>
    </div>
  );
}

function EmptyState({icon,text}){
  return <div style={{...cardStyle({padding:60,textAlign:"center"})}}>
    <div style={{fontSize:40,marginBottom:12}}>{icon}</div>
    <div style={{color:C.s400,fontSize:14}}>{text}</div>
  </div>;
}

function BandBadge({val,large,pending}){
  if(pending)return<span style={{background:C.amberL,color:C.amber,fontWeight:700,fontSize:large?13:11,padding:"3px 9px",borderRadius:6,border:`1px solid ${C.amber}40`}}>Not checked</span>;
  if(!val&&val!==0)return<span style={{color:C.s400}}>—</span>;
  return<span style={{background:bandBg(val),color:bandColor(val),fontWeight:800,fontSize:large?16:13,padding:"3px 10px",borderRadius:6,fontFamily:"'JetBrains Mono',monospace"}}>{typeof val==="number"?val.toFixed(1):val}</span>;
}

function ParticipantTable({ profiles, onSelect }) {
  return (
    <div style={{...cardStyle({overflow:"hidden"})}}>
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead>
          <tr style={{background:C.s900}}>
            {["Candidate","Tests","Latest Date","Listening","Reading","Writing","Speaking","Overall",""].map(h=>(
              <th key={h} style={{padding:"10px 14px",textAlign:"left",color:"rgba(255,255,255,.6)",fontSize:11,fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase"}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {profiles.map((profile,i)=>{
            const latest = profile.attempts[0]||{};
            return (
              <tr key={i} style={{borderTop:`1px solid ${C.s200}`,transition:"background .1s",cursor:"pointer"}}
                onMouseEnter={e=>e.currentTarget.style.background=C.brandL}
                onMouseLeave={e=>e.currentTarget.style.background=""}>
                <td style={{padding:"11px 14px"}}>
                  <div style={{fontWeight:700,fontSize:14}}>{profile.candidate?.name||"—"}</div>
                  <div style={{fontSize:11,color:C.s400}}>{profile.email}</div>
                </td>
                <td style={{padding:"11px 14px"}}>
                  <span style={{...tagStyle(C.brand),fontSize:12}}>{profile.attempts.length}</span>
                </td>
                <td style={{padding:"11px 14px",fontSize:12,color:C.s400}}>{latest.date||"—"}</td>
                <td style={{padding:"11px 14px"}}><BandBadge val={latest.listeningBand}/></td>
                <td style={{padding:"11px 14px"}}><BandBadge val={latest.readingBand}/></td>
                <td style={{padding:"11px 14px"}}><BandBadge val={latest.writingBand} pending={latest.writingBand==null&&latest.writingTexts!=null}/></td>
                <td style={{padding:"11px 14px"}}><BandBadge val={latest.speakingBand}/></td>
                <td style={{padding:"11px 14px"}}><BandBadge val={latest.overall} large/></td>
                <td style={{padding:"11px 14px"}}>
                  <button onClick={()=>onSelect(profile)} style={{...btnStyle("secondary"),padding:"5px 12px",fontSize:12}}>Open Profile →</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ParticipantDetail({ profile, onBack, onUpdateProfile }) {
  const [wTab, setWTab]       = useState(0);
  const [mainTab, setMainTab] = useState("overview");
  const [assignSuiteId, setAssignSuiteId] = useState("");
  const [assignMsg, setAssignMsg] = useState("");
  const [expandedAttempt, setExpandedAttempt] = useState(null);
  const [speakingInputs, setSpeakingInputs] = useState({});  // {attemptKey: bandValue}
  const [recheckStates, setRecheckStates]   = useState({});  // {attemptKey: {loading, taskLoading, msg, error}}

  // Re-check a single attempt's writing with AI
  const handleRecheckWriting = async (a) => {
    const key = a.id||a.timestamp;
    const atx = a.writingTexts||{};
    if(!atx[0]&&!atx[1]){ setRecheckStates(s=>({...s,[key]:{msg:"No writing text found for this attempt.",error:true}})); return; }
    setRecheckStates(s=>({...s,[key]:{loading:true,taskLoading:{0:!!atx[0],1:!!atx[1]},msg:"",error:false}}));

    // Try to find task prompts from the assigned test suite
    const db0   = loadDB();
    const suite = (db0.testSuites||[]).find(s=>s.id===a.suiteId);
    const wTest1 = suite ? (db0.tests||[]).find(t=>t.id===suite.writingTask1Id) : null;
    const wTest2 = suite ? (db0.tests||[]).find(t=>t.id===suite.writingTask2Id) : null;
    const getTaskMeta = (ti) => ({
      task:`Task ${ti+1}`,
      prompt: ti===0
        ? (wTest1?.passages?.[0]?.text||wTest1?.prompt||wTest1?.title||"IELTS Writing Task 1")
        : (wTest2?.passages?.[0]?.text||wTest2?.prompt||wTest2?.title||"IELTS Writing Task 2"),
    });

    const newFb  = {...(a.writingFeedback||{})};
    const newDet = {...(a.writingAiDetection||{})};
    const errors = [];

    for(const ti of [0,1]){
      const txt = atx[ti];
      if(!txt) continue;
      const fb = await runAICheck(txt, getTaskMeta(ti));
      if(fb._error) errors.push(`Task ${ti+1}: ${fb._error}`);
      newFb[ti]  = fb;
      if(fb.aiDetection) newDet[`task${ti+1}`] = fb.aiDetection;
      setRecheckStates(s=>({...s,[key]:{...s[key],taskLoading:{...s[key]?.taskLoading,[ti]:false}}}));
    }
    const hasError = errors.length > 0;

    // Compute new writing band (average of task bands)
    const bands = [newFb[0]?.band, newFb[1]?.band].filter(b=>b!=null&&!isNaN(b));
    const newWBand = bands.length ? Math.round(bands.reduce((x,b)=>x+b,0)/bands.length*2)/2 : a.writingBand;

    // Recalculate overall
    const lB = a.listeningBand??null, rB = a.readingBand??null, sB = a.speakingBand??null;
    const newOverall = overallBand([lB,rB,newWBand,sB].filter(b=>b!=null));

    // Persist to _db + scoreOverrides
    const patch = {writingFeedback:newFb,writingAiDetection:newDet,writingBand:newWBand,overall:newOverall};
    const updatedPts = (_db.participants||[]).map(p=>
      (p.id&&p.id===a.id)||(p.timestamp&&p.timestamp===a.timestamp) ? {...p,...patch} : p
    );
    const overrides = {...(_db.scoreOverrides||{})};
    overrides[key] = {...(overrides[key]||{}),...patch};
    _db = {..._db,participants:updatedPts,scoreOverrides:overrides};
    try{localStorage.setItem(DB_KEY,JSON.stringify(_db));}catch{}
    await _flushConfig(_db);

    // Propagate to parent so UI updates immediately
    const updatedAttempts = (profile.attempts||[]).map(att=>
      (att===a||att.timestamp===a.timestamp) ? {...att,...patch} : att
    );
    onUpdateProfile?.({...profile,attempts:updatedAttempts});

    setRecheckStates(s=>({...s,[key]:{
      loading:false,taskLoading:{0:false,1:false},
      msg: hasError ? `⚠ ${errors.join(" | ")}` : "✓ Writing re-evaluated and saved!",
      error: hasError,
    }}));
    if(!hasError) setTimeout(()=>setRecheckStates(s=>({...s,[key]:{...s[key],msg:""}})),5000);
  };

  const candidateEmail = profile.email||"";
  const allAttempts    = profile.attempts||[];
  const latest         = allAttempts[0]||{};
  const p              = latest; // compat alias for overview tab
  const fb             = latest.writingFeedback||{};
  const texts          = latest.writingTexts||{};

  const publishedSuites = (loadDB().testSuites||[]).filter(s=>s.status==="published");

  // All assignments (past + pending) for this candidate
  const db0 = loadDB();
  const allMyAssignments = (db0.assignments||[])
    .filter(a=>a.email===candidateEmail)
    .sort((a,b)=>b.assignedAt-a.assignedAt);
  const suiteName = id => (db0.testSuites||[]).find(s=>s.id===id)?.name||"(deleted suite)";

  const doAssign = () => {
    if(!assignSuiteId) return;
    const a = {id:genId("ASGN"),email:candidateEmail,suiteId:assignSuiteId,assignedAt:Date.now(),used:false};
    const db = loadDB();
    dbSave("assignments",[a,...(db.assignments||[])]);
    setAssignMsg("✓ Test assigned! They'll receive it on next registration.");
    setTimeout(()=>setAssignMsg(""),3000);
  };

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,gap:12,flexWrap:"wrap"}}>
        <button onClick={onBack} style={{display:"flex",alignItems:"center",gap:8,background:C.brandL,color:C.brand,border:`1.5px solid ${C.brand}30`,borderRadius:9,padding:"8px 18px",cursor:"pointer",fontSize:13,fontWeight:700}}>← Back to All Candidates</button>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          {/* Export latest attempt PDF */}
          {allAttempts.length>0&&(
            <button onClick={()=>{
              const a = latest;
              const parseScore = s => { const [c,t]=(s||"0/0").split("/").map(Number); return {correct:isNaN(c)?0:c, total:isNaN(t)?40:t}; };
              const L2 = parseScore(a.listeningScore);
              const R2 = parseScore(a.readingScore);
              exportResultsPDF({
                candidateInfo: profile.candidate||{name:profile.email,email:profile.email,id:""},
                lBand: a.listeningBand, rBand: a.readingBand, wBand: a.writingBand,
                overall: a.overall,
                L: L2, R: R2,
                W: { aiFeedback: a.writingFeedback||{}, aiDetection: a.writingAiDetection||null, texts: a.writingTexts||{} },
                suiteName: a.suiteName||null,
                booking: a.speakingBooking||null,
              });
            }} style={{display:"flex",alignItems:"center",gap:7,background:"linear-gradient(135deg,#064E3B,#059669)",color:"#fff",border:"none",borderRadius:9,padding:"8px 18px",cursor:"pointer",fontSize:13,fontWeight:700,boxShadow:"0 2px 10px rgba(17,205,135,.3)"}}>
              📄 Export PDF
            </button>
          )}
          <div style={{display:"flex",gap:0,borderBottom:`2px solid ${C.s200}`}}>
            {[["overview","📊 Overview"],["history","🕑 History"],["assign","📋 Assign Test"]].map(([t,lbl])=>(
              <button key={t} onClick={()=>setMainTab(t)} style={{
                padding:"8px 18px",border:"none",cursor:"pointer",fontSize:12,fontWeight:mainTab===t?700:500,
                color:mainTab===t?C.brand:C.s400,borderBottom:`2px solid ${mainTab===t?C.brand:"transparent"}`,
                background:"transparent",marginBottom:-2,
              }}>{lbl}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── ASSIGN TAB ── */}
      {mainTab==="assign"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24,alignItems:"start"}}>
          {/* Left: assign new */}
          <div style={{...cardStyle({padding:24})}}>
            <div style={{fontWeight:800,fontSize:15,color:C.s900,marginBottom:4}}>Assign New Test</div>
            <p style={{fontSize:12,color:C.s400,marginBottom:18}}>The suite will be queued for <strong>{candidateEmail}</strong> on their next registration.</p>
            {publishedSuites.length===0?(
              <div style={{background:C.amberL,borderRadius:8,padding:"12px 16px",fontSize:12,color:C.amber,fontWeight:600}}>
                ⚠ No published test suites. Publish one in Test Suites first.
              </div>
            ):(
              <div>
                <label style={labelStyle}>Test Suite</label>
                <select value={assignSuiteId} onChange={e=>setAssignSuiteId(e.target.value)} style={{...inputStyle,marginBottom:14,cursor:"pointer"}}>
                  <option value="">— select suite —</option>
                  {publishedSuites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button onClick={doAssign} disabled={!assignSuiteId} style={{...btnStyle("primary",!assignSuiteId),width:"100%"}}>Assign Test →</button>
                {assignMsg&&<div style={{marginTop:10,color:C.teal,fontWeight:700,fontSize:13}}>{assignMsg}</div>}
              </div>
            )}
          </div>

          {/* Right: assignment history for this candidate */}
          <div>
            <div style={{fontSize:13,fontWeight:800,color:C.s900,marginBottom:12}}>
              Assignment History
              <span style={{marginLeft:8,fontSize:11,color:C.s400,fontWeight:500}}>({allMyAssignments.length} total)</span>
            </div>
            {allMyAssignments.length===0?(
              <div style={{...cardStyle({padding:20,textAlign:"center"})}}>
                <div style={{fontSize:24,marginBottom:8}}>📋</div>
                <div style={{color:C.s400,fontSize:13}}>No assignments yet for this candidate.</div>
              </div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {allMyAssignments.map((a,i)=>(
                  <div key={a.id||i} style={{...cardStyle({padding:"14px 18px",borderLeft:`4px solid ${a.used?C.s400:C.teal}`}),
                    background:a.used?"#fff":C.tealL+"66"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:700,fontSize:13,color:C.s900,marginBottom:3}}>{suiteName(a.suiteId)}</div>
                        <div style={{fontSize:11,color:C.s400}}>
                          Assigned {new Date(a.assignedAt).toLocaleDateString("en-GB")} · {new Date(a.assignedAt).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}
                        </div>
                      </div>
                      <span style={{...tagStyle(a.used?C.s400:C.teal),fontSize:11,flexShrink:0}}>
                        {a.used?"✓ Used":"⏳ Pending"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {mainTab==="history"&&(
        <div>
          <h3 style={{fontSize:15,fontWeight:800,color:C.s900,marginBottom:14}}>
            Test History — {allAttempts.length} attempt{allAttempts.length!==1?"s":""}
          </h3>
          {allAttempts.length===0?<EmptyState icon="📄" text="No attempts yet."/>:(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {allAttempts.map((a,i)=>{
                const isOpen   = expandedAttempt===i;
                const afb      = a.writingFeedback||{};
                const atx      = a.writingTexts||{};
                const rKey     = a.id||a.timestamp;
                const rs       = recheckStates[rKey]||{};
                const hasText  = !!(atx[0]||atx[1]);
                return (
                  <div key={a.id||i} style={{...cardStyle({overflow:"hidden",border:`1px solid ${isOpen?C.brand:C.s200}`})}}>
                    {/* Row header — always visible */}
                    {(()=>{
                      // AI detection badge for row
                      const det = a.writingAiDetection;
                      const maxRisk = det ? Math.max(det.task1?.risk||0, det.task2?.risk||0) : null;
                      const riskColor = maxRisk===null?null:maxRisk<=25?"#16A34A":maxRisk<=55?"#D97706":maxRisk<=80?"#EA580C":"#DC2626";
                      const riskBg    = maxRisk===null?null:maxRisk<=25?"#F0FDF4":maxRisk<=55?"#FFFBEB":maxRisk<=80?"#FFF7ED":"#FEF2F2";
                      return (
                        <div onClick={()=>setExpandedAttempt(isOpen?null:i)}
                          style={{display:"grid",gridTemplateColumns:"140px 1fr 1fr 1fr 1fr auto",gap:12,padding:"13px 16px",alignItems:"center",cursor:"pointer",background:isOpen?C.brandL:"",transition:"background .15s"}}>
                          <div>
                            <div style={{fontSize:13,fontWeight:700,color:C.s900}}>{a.date||"—"}</div>
                            <div style={{fontSize:10,color:C.s400,marginTop:2}}>
                              {a.listeningScore&&`L:${a.listeningScore} `}{a.readingScore&&`R:${a.readingScore}`}
                            </div>
                            {maxRisk!==null&&(
                              <div style={{marginTop:4,display:"inline-flex",alignItems:"center",gap:4,background:riskBg,border:`1px solid ${riskColor}`,borderRadius:5,padding:"2px 6px"}}>
                                <span style={{fontSize:9,fontWeight:800,color:riskColor}}>🤖 AI Risk: {maxRisk}%</span>
                              </div>
                            )}
                          </div>
                          <div style={{textAlign:"center"}}><div style={{fontSize:9,color:C.s400,marginBottom:3,textTransform:"uppercase",letterSpacing:"0.07em"}}>Listening</div><BandBadge val={a.listeningBand}/></div>
                          <div style={{textAlign:"center"}}><div style={{fontSize:9,color:C.s400,marginBottom:3,textTransform:"uppercase",letterSpacing:"0.07em"}}>Reading</div><BandBadge val={a.readingBand}/></div>
                          <div style={{textAlign:"center"}}><div style={{fontSize:9,color:C.s400,marginBottom:3,textTransform:"uppercase",letterSpacing:"0.07em"}}>Writing</div><BandBadge val={a.writingBand} pending={a.writingBand==null&&a.writingTexts!=null}/></div>
                          <div style={{textAlign:"center"}}><div style={{fontSize:9,color:C.s400,marginBottom:3,textTransform:"uppercase",letterSpacing:"0.07em"}}>Overall</div><BandBadge val={a.overall} large/></div>
                          <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"center"}}>
                            <button onClick={e=>{ e.stopPropagation(); const parseScore=s=>{const[c,t]=(s||"0/0").split("/").map(Number);return{correct:isNaN(c)?0:c,total:isNaN(t)?40:t};};exportResultsPDF({candidateInfo:profile.candidate||{name:profile.email,email:profile.email,id:""},lBand:a.listeningBand,rBand:a.readingBand,wBand:a.writingBand,overall:a.overall,L:parseScore(a.listeningScore),R:parseScore(a.readingScore),W:{aiFeedback:a.writingFeedback||{},aiDetection:a.writingAiDetection||null,texts:a.writingTexts||{}},suiteName:a.suiteName||null,booking:a.speakingBooking||null}); }} style={{background:"linear-gradient(135deg,#064E3B,#059669)",color:"#fff",border:"none",borderRadius:7,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>📄 PDF</button>
                            <div style={{fontSize:18,color:C.brand,transition:"transform .2s",transform:isOpen?"rotate(90deg)":""}}>›</div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Expanded full-test detail */}
                    {isOpen&&(()=>{
                      const [histTab, setHistTab] = [a._histTab||"listening", v => { a._histTab=v; setExpandedAttempt(null); setTimeout(()=>setExpandedAttempt(i),0); }];
                      const lAns = a.listeningAnswers||{};
                      const rAns = a.readingAnswers||{};
                      const rawTxt = v => (v&&typeof v==="object")?v.text:(v||"");

                      // Build live answer key from current tests (text-match first, ID fallback)
                      // This means history ALWAYS shows the latest answer keys even without recalculate
                      const liveKeyByText={}, liveKeyById={};
                      (_db.tests||[]).forEach(t=>{
                        let off=0;
                        const addQ=(q,idx)=>{
                          const c=(q.correct||"").trim(); if(!c) return;
                          const txt=(q.text||"").trim().toLowerCase().slice(0,120);
                          if(txt) liveKeyByText[txt]=c;
                          liveKeyById[idx]=c;
                        };
                        if(t.sections?.length>0){t.sections.forEach(s=>{(s.questions||[]).forEach((q,j)=>addQ(q,off+j+1));off+=s.questions?.length||0;});}
                        else if(t.passages?.length>0){t.passages.forEach(p=>{(p.questions||[]).forEach((q,j)=>addQ(q,off+j+1));off+=p.questions?.length||0;});}
                        else if(t.questions?.length>0){t.questions.forEach((q,i)=>addQ(q,i+1));}
                      });
                      const liveKey=q=>{
                        const txt=(q.text||"").trim().toLowerCase().slice(0,120);
                        if(txt&&liveKeyByText[txt]) return liveKeyByText[txt];
                        if(q.id&&liveKeyById[q.id]) return liveKeyById[q.id];
                        return q.correct||"";
                      };

                      // Enrich stored questions with live answer keys
                      const lQs = (a.allListeningQuestions||[]).map(q=>({...q,correct:liveKey(q)}));
                      const rQs = (a.allReadingQuestions||[]).map(q=>({...q,correct:liveKey(q)}));
                      const tabs = [["listening","🎧","Listening"],["reading","📖","Reading"],["writing","✍️","Writing"],["speaking","🗣️","Speaking"]];
                      return (
                        <div style={{borderTop:`1px solid ${C.s200}`}}>
                          {/* Section tab bar */}
                          <div style={{display:"flex",gap:2,padding:"12px 16px 0",background:C.s100}}>
                            {tabs.map(([k,icon,lbl])=>(
                              <button key={k} onClick={()=>setHistTab(k)} style={{
                                padding:"7px 16px",borderRadius:"8px 8px 0 0",border:"none",cursor:"pointer",fontSize:12,fontWeight:histTab===k?700:500,
                                background:histTab===k?"#fff":C.s100,color:histTab===k?C.brand:C.s400,
                                borderBottom:histTab===k?`2px solid ${C.brand}`:"2px solid transparent",
                              }}>{icon} {lbl}</button>
                            ))}
                          </div>

                          <div style={{padding:20,background:"#fff"}}>

                            {/* LISTENING */}
                            {histTab==="listening"&&(
                              <div>
                                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
                                  <BandBadge val={a.listeningBand} large/>
                                  <div>
                                    <div style={{fontWeight:700,fontSize:13,color:C.s900}}>Listening Score</div>
                                    <div style={{fontSize:12,color:C.s400}}>{a.listeningScore||"—"} correct</div>
                                  </div>
                                </div>
                                {lQs.length>0?(
                                  <div>
                                    {lQs.map((q,qi)=>{
                                      const ans = lAns[q.id];
                                      const ansText = rawTxt(ans);
                                      const cv = (q.correct||"").trim().toLowerCase();
                                      const av = ansText.trim().toLowerCase();
                                      const correct = av&&cv&&(av===cv||av.includes(cv)||cv.includes(av)||av.replace(/[^a-h]/g,"")[0]===cv.replace(/[^a-h]/g,"")[0]);
                                      const noKey = !cv;
                                      return (
                                        <div key={qi} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"8px 0",borderBottom:`1px solid ${C.s200}`}}>
                                          <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,fontWeight:700,color:C.brand,background:C.brandL,borderRadius:4,padding:"2px 6px",flexShrink:0,marginTop:2}}>{q.id}</span>
                                          <div style={{flex:1}}>
                                            <div style={{fontSize:12,color:C.s800,marginBottom:3}}>{q.text}</div>
                                            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                                              <span style={{fontSize:11,fontWeight:600,color:ansText?(noKey?C.s400:correct?C.teal:C.rose):C.s400}}>
                                                {ansText?`Your answer: "${ansText}"`:"Not answered"}
                                              </span>
                                              {noKey&&ansText&&<span style={{fontSize:11,color:"#d97706",fontWeight:600}}>⚠ No answer key set</span>}
                                              {!noKey&&ansText&&!correct&&<span style={{fontSize:11,color:C.teal,fontWeight:600}}>✓ Correct: "{q.correct}"</span>}
                                              {!noKey&&ansText&&correct&&<span style={{fontSize:11,color:C.teal}}>✓</span>}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ):<div style={{color:C.s400,fontSize:12,fontStyle:"italic",padding:"12px 0"}}>Detailed question data not available for this attempt.</div>}
                              </div>
                            )}

                            {/* READING */}
                            {histTab==="reading"&&(
                              <div>
                                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
                                  <BandBadge val={a.readingBand} large/>
                                  <div>
                                    <div style={{fontWeight:700,fontSize:13,color:C.s900}}>Reading Score</div>
                                    <div style={{fontSize:12,color:C.s400}}>{a.readingScore||"—"} correct</div>
                                  </div>
                                </div>
                                {rQs.length>0?(
                                  <div>
                                    {rQs.map((q,qi)=>{
                                      const ans = rAns[q.id];
                                      const ansText = rawTxt(ans);
                                      const cv = (q.correct||"").trim().toLowerCase();
                                      const av = ansText.trim().toLowerCase();
                                      const correct = av&&cv&&(av===cv||av.includes(cv)||cv.includes(av)||av.replace(/[^a-h]/g,"")[0]===cv.replace(/[^a-h]/g,"")[0]);
                                      const noKey = !cv;
                                      return (
                                        <div key={qi} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"8px 0",borderBottom:`1px solid ${C.s200}`}}>
                                          <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,fontWeight:700,color:C.brand,background:C.brandL,borderRadius:4,padding:"2px 6px",flexShrink:0,marginTop:2}}>Q{q.id}</span>
                                          <div style={{flex:1}}>
                                            <div style={{fontSize:12,color:C.s800,marginBottom:3}}>{q.text}</div>
                                            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                                              <span style={{fontSize:11,fontWeight:600,color:ansText?(noKey?C.s400:correct?C.teal:C.rose):C.s400}}>
                                                {ansText?`Your answer: "${ansText}"`:"Not answered"}
                                              </span>
                                              {noKey&&ansText&&<span style={{fontSize:11,color:"#d97706",fontWeight:600}}>⚠ No answer key set</span>}
                                              {!noKey&&ansText&&!correct&&<span style={{fontSize:11,color:C.teal,fontWeight:600}}>✓ Correct: "{q.correct}"</span>}
                                              {!noKey&&ansText&&correct&&<span style={{fontSize:11,color:C.teal}}>✓</span>}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ):<div style={{color:C.s400,fontSize:12,fontStyle:"italic",padding:"12px 0"}}>Detailed question data not available for this attempt.</div>}
                              </div>
                            )}

                            {/* WRITING */}
                            {histTab==="writing"&&(
                              <div>
                                {/* Header row: band + recheck button */}
                                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:16,flexWrap:"wrap"}}>
                                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                                    <BandBadge val={a.writingBand} large pending={a.writingBand==null&&a.writingTexts!=null}/>
                                    <div>
                                      <div style={{fontWeight:700,fontSize:13,color:C.s900}}>Writing Score</div>
                                      {a.writingBand==null&&hasText&&<div style={{fontSize:11,color:"#D97706",fontWeight:600,marginTop:2}}>⚠ Not yet evaluated</div>}
                                    </div>
                                  </div>
                                  {hasText&&(
                                    <button
                                      onClick={()=>handleRecheckWriting(a)}
                                      disabled={rs.loading}
                                      style={{display:"flex",alignItems:"center",gap:7,padding:"9px 18px",borderRadius:9,border:"none",
                                        background:rs.loading?"#94A3B8":C.brand,color:"#fff",fontSize:12,fontWeight:700,cursor:rs.loading?"not-allowed":"pointer",
                                        boxShadow:rs.loading?"none":`0 2px 8px ${C.brand}40`,transition:"all .15s"}}>
                                      {rs.loading?(
                                        <><span style={{width:12,height:12,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",display:"inline-block",animation:"spin .7s linear infinite"}}/>Evaluating…</>
                                      ):"🔄 Re-check with AI"}
                                    </button>
                                  )}
                                </div>

                                {/* Status message */}
                                {rs.msg&&(
                                  <div style={{marginBottom:14,padding:"10px 14px",borderRadius:9,fontSize:12,fontWeight:600,
                                    background:rs.error?"#FEF2F2":"#F0FDF4",color:rs.error?"#DC2626":"#16A34A",
                                    border:`1.5px solid ${rs.error?"#FCA5A5":"#86EFAC"}`}}>
                                    {rs.msg}
                                  </div>
                                )}

                                {/* No text submitted at all */}
                                {!hasText&&(
                                  <div style={{padding:"20px",background:C.s100,borderRadius:10,textAlign:"center",color:C.s400,fontSize:13}}>
                                    No writing responses submitted for this attempt.
                                  </div>
                                )}
                                {[0,1].map(ti=>{
                                  const det = (a.writingAiDetection||{})[`task${ti+1}`];
                                  const riskColor = !det?null:det.risk<=25?"#16A34A":det.risk<=55?"#D97706":det.risk<=80?"#EA580C":"#DC2626";
                                  const riskBg    = !det?null:det.risk<=25?"#F0FDF4":det.risk<=55?"#FFFBEB":det.risk<=80?"#FFF7ED":"#FEF2F2";
                                  const taskLoading = rs.taskLoading?.[ti];
                                  return (
                                    <div key={ti} style={{marginBottom:24,position:"relative",borderRadius:10,
                                      border:`1.5px solid ${taskLoading?C.brand:C.s200}`,padding:14,
                                      background:taskLoading?"rgba(17,205,135,.03)":"#fff",transition:"all .2s"}}>
                                      {/* Task loading overlay */}
                                      {taskLoading&&(
                                        <div style={{position:"absolute",inset:0,background:"rgba(255,255,255,.75)",borderRadius:10,
                                          display:"flex",alignItems:"center",justifyContent:"center",gap:10,zIndex:2,backdropFilter:"blur(2px)"}}>
                                          <span style={{width:18,height:18,border:"3px solid rgba(17,205,135,.2)",borderTopColor:C.brand,borderRadius:"50%",display:"inline-block",animation:"spin .7s linear infinite"}}/>
                                          <span style={{fontSize:12,fontWeight:700,color:C.brand}}>AI evaluating Task {ti+1}…</span>
                                        </div>
                                      )}
                                      <div style={{display:"flex",alignItems:"center",gap:8,fontWeight:700,fontSize:13,color:C.s900,marginBottom:8}}>
                                        <span style={{background:C.brand,color:"#fff",borderRadius:6,padding:"2px 9px",fontSize:11,fontWeight:800}}>Task {ti+1}</span>
                                        {afb[ti]?.band!=null&&<BandBadge val={afb[ti].band}/>}
                                      </div>
                                      {atx[ti]?(
                                        <div style={{background:C.s100,borderRadius:8,padding:12,marginBottom:10,maxHeight:180,overflow:"auto"}}>
                                          <div style={{fontSize:10,color:C.s400,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:6}}>Response ({countWords(atx[ti]||"")} words)</div>
                                          <p style={{fontSize:12,lineHeight:1.8,color:C.s900,whiteSpace:"pre-wrap",margin:0}}>{atx[ti]}</p>
                                        </div>
                                      ):<div style={{color:C.s400,fontSize:12,marginBottom:10,fontStyle:"italic"}}>No response submitted</div>}
                                      {(()=>{const fb=a.writingFeedback?.[ti]; return fb&&(
                                        <div>
                                          {/* 5-criteria band grid */}
                                          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6,marginBottom:10}}>
                                            {[["Overall",fb.band],["Task",(fb.taskAchievement?.band??fb.tr)],["Cohesion",(fb.coherenceCohesion?.band??fb.cc)],["Lexical",(fb.lexicalResource?.band??fb.lr)],["Grammar",(fb.grammaticalRange?.band??fb.gra)]].map(([lbl,val])=>(
                                              <div key={lbl} style={{background:bandBg(val||5),borderRadius:6,padding:"7px 6px",textAlign:"center"}}>
                                                <div style={{fontSize:8,color:C.s400,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em"}}>{lbl}</div>
                                                <div style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:800,fontSize:16,color:bandColor(val||5)}}>{val!=null?val:"—"}</div>
                                              </div>
                                            ))}
                                          </div>
                                          {/* Summary */}
                                          {fb.summary&&<p style={{fontSize:12,lineHeight:1.7,color:C.s800,background:C.s100,padding:10,borderRadius:8,margin:"0 0 8px"}}>{fb.summary}</p>}
                                          {/* Strengths */}
                                          {fb.strengths?.length>0&&(
                                            <div style={{marginBottom:8}}>
                                              <div style={{fontSize:10,fontWeight:800,color:"#16A34A",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:5}}>✅ Strengths</div>
                                              <ul style={{margin:0,paddingLeft:16}}>
                                                {fb.strengths.map((s,si)=><li key={si} style={{fontSize:11,color:C.s800,lineHeight:1.6,marginBottom:2}}>{s}</li>)}
                                              </ul>
                                            </div>
                                          )}
                                          {/* Improvements */}
                                          {fb.improvements?.length>0&&(
                                            <div style={{marginBottom:8}}>
                                              <div style={{fontSize:10,fontWeight:800,color:"#D97706",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:5}}>⚠ Areas to Improve</div>
                                              <ul style={{margin:0,paddingLeft:16}}>
                                                {fb.improvements.map((s,si)=><li key={si} style={{fontSize:11,color:C.s800,lineHeight:1.6,marginBottom:2}}>{s}</li>)}
                                              </ul>
                                            </div>
                                          )}
                                          {/* Key tip */}
                                          {fb.keyTip&&<div style={{background:C.brandL,borderRadius:7,padding:"8px 12px",fontSize:11,color:C.brand,fontWeight:500,marginBottom:6}}>💡 {fb.keyTip}</div>}
                                        </div>
                                      );})()}
                                      {/* AI Detection for this task */}
                                      {det&&(
                                        <div style={{borderRadius:10,border:`2px solid ${riskColor}`,background:riskBg,padding:14}}>
                                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                                            <div style={{fontSize:11,fontWeight:800,color:riskColor,textTransform:"uppercase",letterSpacing:"0.07em"}}>🤖 AI Content Detection — Task {ti+1}</div>
                                            <div style={{textAlign:"center",background:"#fff",borderRadius:8,padding:"6px 14px",border:`1.5px solid ${riskColor}`}}>
                                              <div style={{fontSize:20,fontWeight:900,color:riskColor,fontFamily:"'JetBrains Mono',monospace",lineHeight:1}}>{det.risk}%</div>
                                              <div style={{fontSize:9,fontWeight:700,color:riskColor,marginTop:1}}>{det.verdict}</div>
                                            </div>
                                          </div>
                                          <div style={{height:6,background:"rgba(0,0,0,.08)",borderRadius:99,marginBottom:8,overflow:"hidden"}}>
                                            <div style={{width:`${det.risk}%`,height:"100%",background:`linear-gradient(90deg,#16A34A,${riskColor})`,borderRadius:99}}/>
                                          </div>
                                          {det.explanation&&<p style={{fontSize:11,color:"#374151",lineHeight:1.6,margin:"0 0 8px"}}>{det.explanation}</p>}
                                          {det.signals?.length>0&&(
                                            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                                              {det.signals.map((s,si)=><span key={si} style={{fontSize:10,background:"rgba(0,0,0,.06)",color:"#374151",padding:"2px 7px",borderRadius:5}}>{s}</span>)}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* SPEAKING */}
                            {histTab==="speaking"&&(()=>{
                              const sBands=[0,1,1.5,2,2.5,3,3.5,4,4.5,5,5.5,6,6.5,7,7.5,8,8.5,9];
                              const curBand = a.speakingBand??null;
                              const inputVal = speakingInputs[a.id]??( curBand!=null ? String(curBand) : "");
                              const saveSpeaking = async () => {
                                const val = parseFloat(inputVal);
                                if(isNaN(val)||val<0||val>9) return;
                                const lBand = a.listeningBand??0;
                                const rBand = a.readingBand??0;
                                const wBand = a.writingBand??null;
                                const newOverall = overallBand(wBand!=null?[lBand,rBand,wBand,val]:[lBand,rBand,val]);
                                // Update _db in memory
                                const updatedPts = (_db.participants||[]).map(p=>
                                  (p.id&&p.id===a.id)||(p.timestamp&&p.timestamp===a.timestamp)
                                    ? {...p,speakingBand:val,overall:newOverall} : p
                                );
                                const overrides = {...(_db.scoreOverrides||{})};
                                const key = a.id||a.timestamp;
                                overrides[key]={...( overrides[key]||{}),speakingBand:val,overall:newOverall};
                                _db={..._db,participants:updatedPts,scoreOverrides:overrides};
                                try{localStorage.setItem(DB_KEY,JSON.stringify(_db));}catch{}
                                await _flushConfig(_db);
                                // Update profile so UI reflects new score immediately
                                const updatedAttempts=(profile.attempts||[]).map(att=>
                                  att===a||att.timestamp===a.timestamp?{...att,speakingBand:val,overall:newOverall}:att
                                );
                                onUpdateProfile?.({...profile,attempts:updatedAttempts});
                                setSpeakingInputs(s=>({...s,[key]:""}));
                              };
                              return (
                                <div>
                                  {/* Score entry */}
                                  <div style={{...cardStyle({padding:20,marginBottom:16,borderLeft:`4px solid ${C.brand}`})}}>
                                    <div style={{fontSize:12,fontWeight:700,color:C.s900,marginBottom:12}}>🗣️ Speaking Band Score</div>
                                    <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                                      <select value={inputVal} onChange={e=>setSpeakingInputs(s=>({...s,[a.id]:e.target.value}))}
                                        style={{...inputStyle,width:120,fontSize:14,fontWeight:700,cursor:"pointer"}}>
                                        <option value="">— select —</option>
                                        {sBands.map(b=><option key={b} value={b}>{b}</option>)}
                                      </select>
                                      <button onClick={saveSpeaking} disabled={!inputVal}
                                        style={{...btnStyle("primary"),padding:"9px 20px",fontSize:13,opacity:inputVal?1:.5}}>
                                        Save Score
                                      </button>
                                      {curBand!=null&&(
                                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                                          <span style={{fontSize:12,color:C.s400}}>Current:</span>
                                          <BandBadge val={curBand} large/>
                                        </div>
                                      )}
                                    </div>
                                    {curBand!=null&&(
                                      <div style={{marginTop:12,padding:"10px 14px",background:C.brandL,borderRadius:8,fontSize:12,color:C.brand,fontWeight:600}}>
                                        New overall with Speaking {curBand}: <strong>{a.overall}</strong>
                                        &nbsp;(L:{a.listeningBand} + R:{a.readingBand}{a.writingBand!=null?` + W:${a.writingBand}`:""} + S:{curBand})
                                      </div>
                                    )}
                                  </div>
                                  {/* Booking info */}
                                  {a.speakingBooking?(
                                    <div style={{...cardStyle({padding:16})}}>
                                      <div style={{fontSize:11,fontWeight:700,color:C.s400,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Booking Details</div>
                                      {[["Date",a.speakingBooking.dateFormatted||a.speakingBooking.date],["Time",a.speakingBooking.slot],["Mode",a.speakingBooking.mode],["Booking ID",a.speakingBooking.id]].map(([k,v])=>(
                                        <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${C.s200}`,fontSize:12}}>
                                          <span style={{color:C.s400,fontWeight:600}}>{k}</span>
                                          <span style={{color:C.s900,fontWeight:600}}>{v||"—"}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ):<div style={{color:C.s400,fontSize:12,fontStyle:"italic",padding:"8px 0"}}>No speaking session booked.</div>}
                                </div>
                              );
                            })()}

                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── OVERVIEW TAB ── */}
      {mainTab==="overview"&&(
      <div style={{display:"grid",gridTemplateColumns:"280px 1fr",gap:24}}>
        <div>
          <div style={{...cardStyle({padding:24,marginBottom:16})}}>
            <div style={{width:52,height:52,borderRadius:14,background:C.brandL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,marginBottom:14}}>👤</div>
            <h3 style={{fontSize:17,fontWeight:800,color:C.s900,marginBottom:4,letterSpacing:"-0.02em"}}>{profile.candidate?.name||"—"}</h3>
            <div style={{fontSize:11,color:C.s400,marginBottom:14}}>{allAttempts.length} test{allAttempts.length!==1?"s":""} on record</div>
            {[["Email",profile.candidate?.email||candidateEmail],["Phone",profile.candidate?.phone],["Nationality",profile.candidate?.nationality],["Test Type",profile.candidate?.testType],["DOB",profile.candidate?.dob],["Latest Test",latest.date],["ID",profile.candidate?.id]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${C.s200}`,fontSize:12}}>
                <span style={{color:C.s400,fontWeight:600}}>{k}</span>
                <span style={{color:C.s900,fontWeight:500,maxWidth:140,textAlign:"right",wordBreak:"break-all"}}>{v||"—"}</span>
              </div>
            ))}
          </div>
          {p.speakingBooking&&(
            <div style={{...cardStyle({padding:20,borderLeft:`3px solid ${C.teal}`})}}>
              <div style={{fontSize:11,color:C.teal,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Speaking Booking</div>
              {[["Date",p.speakingBooking.dateFormatted||p.speakingBooking.date],["Time",p.speakingBooking.slot],["Mode",p.speakingBooking.mode],["ID",p.speakingBooking.id]].map(([k,v])=>(
                <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${C.s200}`,fontSize:12}}>
                  <span style={{color:C.s400}}>{k}</span>
                  <span style={{color:C.s900,fontWeight:600}}>{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div style={{...cardStyle({padding:24})}}>
            <div style={{fontSize:11,color:C.s400,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:16}}>Latest Test Scores</div>
            {[["Listening",p.listeningBand,p.listeningScore],["Reading",p.readingBand,p.readingScore],["Writing",p.writingBand,null],["Overall",p.overall,null]].map(([k,b,s])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${C.s200}`}}>
                <span style={{fontSize:14,color:C.s800}}>{k}</span>
                <div style={{textAlign:"right"}}>
                  <BandBadge val={b} large={k==="Overall"}/>
                  {s&&<div style={{fontSize:10,color:C.s400,marginTop:2}}>{s}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

// ── TEST SUITE MANAGER ────────────────────────────────────────────────────────
function TestSuiteManager() {
  const [suites, setSuites]   = useState(loadDB().testSuites||[]);
  const [allSections, setAllSections] = useState(loadDB().tests||[]);
  const [creating, setCreating] = useState(false);
  const [editId, setEditId]   = useState(null);
  const [name, setName]       = useState("");
  const [rId,  setRId]  = useState("");
  const [w1Id, setW1Id] = useState("");
  const [w2Id, setW2Id] = useState("");
  const [lId,  setLId]  = useState("");

  const refresh = () => { const db=loadDB(); setSuites(db.testSuites||[]); setAllSections(db.tests||[]); };
  useEffect(()=>{ refresh(); },[]);

  const rSecs  = allSections.filter(s=>s.type==="Reading");
  const w1Secs = allSections.filter(s=>s.type==="Writing"&&(s.taskType==="task1"||(!s.taskType&&s.task1Prompt)));
  const w2Secs = allSections.filter(s=>s.type==="Writing"&&(s.taskType==="task2"||(!s.taskType&&s.task2Prompt)));
  const lSecs  = allSections.filter(s=>s.type==="Listening");

  const openCreate = () => { setName(""); setRId(""); setW1Id(""); setW2Id(""); setLId(""); setEditId(null); setCreating(true); };
  const openEdit   = (s) => {
    setName(s.name); setRId(s.readingId||"");
    setW1Id(s.writing1Id||s.writingId||""); // backward compat
    setW2Id(s.writing2Id||"");
    setLId(s.listeningId||""); setEditId(s.id); setCreating(true);
  };

  const saveSuite = () => {
    if(!name.trim()) return;
    let updated;
    if(editId) {
      updated = suites.map(s=>s.id===editId?{...s,name:name.trim(),readingId:rId||null,writing1Id:w1Id||null,writing2Id:w2Id||null,listeningId:lId||null}:s);
    } else {
      const ns = {id:genId("SUITE"),name:name.trim(),status:"draft",readingId:rId||null,writing1Id:w1Id||null,writing2Id:w2Id||null,listeningId:lId||null,createdAt:new Date().toLocaleDateString("en-GB")};
      updated = [...suites, ns];
    }
    setSuites(updated); dbSave("testSuites",updated);
    setCreating(false); setEditId(null);
  };

  const togglePublish = id => {
    const updated = suites.map(s=>s.id===id?{...s,status:s.status==="published"?"draft":"published"}:s);
    setSuites(updated); dbSave("testSuites",updated);
  };
  const deleteSuite = id => { const u=suites.filter(s=>s.id!==id); setSuites(u); dbSave("testSuites",u); };
  const secName = id => id ? (allSections.find(s=>s.id===id)?.title||"—") : "Built-in";
  const pubCount = suites.filter(s=>s.status==="published").length;

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
        <div>
          <h2 style={{fontSize:22,fontWeight:800,color:C.s900,letterSpacing:"-0.03em",marginBottom:6}}>Test Suites</h2>
          <p style={{color:C.s400,fontSize:14}}>
            Bundle sections into named tests then publish. <strong style={{color:pubCount>0?C.teal:C.amber}}>{pubCount} published</strong> — system randomly assigns these to candidates.
          </p>
        </div>
        <button onClick={openCreate} style={btnStyle("primary")}>+ New Suite</button>
      </div>

      {creating&&(
        <div style={{...cardStyle({padding:24,marginBottom:24,borderLeft:`4px solid ${C.brand}`})}}>
          <div style={{fontWeight:800,color:C.s900,fontSize:15,marginBottom:16}}>{editId?"Edit Suite":"New Test Suite"}</div>
          <div style={{marginBottom:14}}>
            <label style={labelStyle}>Suite Name *</label>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. IELTS Academic Practice Test 3" style={inputStyle} autoFocus/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
            {[
              ["📖 Reading",rSecs,rId,setRId,"built-in"],
              ["✍️ Writing Task 1",w1Secs,w1Id,setW1Id,"built-in"],
              ["✍️ Writing Task 2",w2Secs,w2Id,setW2Id,"built-in"],
              ["🎧 Listening",lSecs,lId,setLId,"built-in"],
            ].map(([lbl,opts,val,set,ph])=>(
              <div key={lbl}>
                <label style={labelStyle}>{lbl}</label>
                <select value={val} onChange={e=>set(e.target.value)} style={{...inputStyle,cursor:"pointer"}}>
                  <option value="">— use {ph} —</option>
                  {opts.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div style={{background:C.brandL,borderRadius:8,padding:"9px 14px",fontSize:12,color:C.s600,marginBottom:16}}>
            💡 Sections set to "built-in" use the default practice questions included with the platform.
          </div>
          <div style={{display:"flex",gap:10}}>
            <button onClick={saveSuite} disabled={!name.trim()} style={btnStyle("primary",!name.trim())}>{editId?"Save Changes":"Save as Draft"}</button>
            <button onClick={()=>setCreating(false)} style={btnStyle("ghost")}>Cancel</button>
          </div>
        </div>
      )}

      {suites.length===0 ? <EmptyState icon="🧪" text="No test suites yet. Create one above."/> : (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {suites.map(s=>(
            <div key={s.id} style={{...cardStyle({padding:20})}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,flexWrap:"wrap"}}>
                    <span style={{...tagStyle(s.status==="published"?C.teal:C.s400)}}>{s.status==="published"?"● Published":"○ Draft"}</span>
                    <span style={{fontWeight:800,fontSize:15,color:C.s900}}>{s.name}</span>
                  </div>
                  <div style={{display:"flex",gap:20,fontSize:12,color:C.s600,flexWrap:"wrap"}}>
                    <span>📖 {secName(s.readingId)}</span>
                    <span>✍️ T1: {secName(s.writing1Id||s.writingId)}</span>
                    <span>✍️ T2: {secName(s.writing2Id)}</span>
                    <span>🎧 {secName(s.listeningId)}</span>
                    <span style={{color:C.s400}}>Created {s.createdAt}</span>
                  </div>
                </div>
                <div style={{display:"flex",gap:8,flexShrink:0,marginLeft:16}}>
                  <button onClick={()=>openEdit(s)} style={{...btnStyle("secondary"),padding:"6px 12px",fontSize:12}}>Edit</button>
                  <button onClick={()=>togglePublish(s.id)} style={{...btnStyle(s.status==="published"?"ghost":"teal"),padding:"6px 12px",fontSize:12,border:s.status==="published"?`1px solid ${C.s200}`:"none"}}>
                    {s.status==="published"?"Unpublish":"Publish ✓"}
                  </button>
                  <button onClick={()=>deleteSuite(s.id)} style={{background:C.roseL,color:C.rose,border:"none",borderRadius:8,padding:"6px 10px",fontSize:12,cursor:"pointer",fontWeight:700}}>✕</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ASSIGN MANAGER ────────────────────────────────────────────────────────────
// ── SPEAKING SLOTS MANAGER ────────────────────────────────────────────────────
function SlotsManager({ onRefresh }) {
  const [slots, setSlots]       = useState(()=>(loadDB().speakingSlots||[]).sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time)));
  const [newDate, setNewDate]   = useState("");
  const [newTime, setNewTime]   = useState("09:00");
  const [newMode, setNewMode]   = useState("both");
  // Bulk add
  const [bulkFrom, setBulkFrom] = useState("");
  const [bulkTo,   setBulkTo]   = useState("");
  const [bulkTimes, setBulkTimes] = useState(["09:00","10:00","11:00","14:00","15:00"]);
  const [bulkMode, setBulkMode] = useState("both");
  const [saved, setSaved]       = useState("");

  const reload = () => {
    const s = (loadDB().speakingSlots||[]).sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time));
    setSlots(s); onRefresh?.();
  };

  const flash = msg => { setSaved(msg); setTimeout(()=>setSaved(""),2500); };

  const addSlot = () => {
    if(!newDate||!newTime) return;
    const slot = {id:genId("SLT"),date:newDate,time:newTime,mode:newMode,booked:false,createdAt:Date.now()};
    const db = loadDB(); db.speakingSlots=[slot,...(db.speakingSlots||[])]; saveDB(db);
    setNewDate(""); reload(); flash("✓ Slot added!");
  };

  const addBulk = () => {
    if(!bulkFrom||!bulkTo||!bulkTimes.length) return;
    const from = new Date(bulkFrom), to = new Date(bulkTo);
    if(from>to) return;
    const db = loadDB(); const existing = db.speakingSlots||[];
    const newSlots = [];
    for(let d=new Date(from);d<=to;d.setDate(d.getDate()+1)) {
      if(d.getDay()===0||d.getDay()===6) continue; // skip weekends
      const dateStr = d.toISOString().slice(0,10);
      bulkTimes.forEach(t=>{
        const dup = existing.some(s=>s.date===dateStr&&s.time===t);
        if(!dup) newSlots.push({id:genId("SLT"),date:dateStr,time:t,mode:bulkMode,booked:false,createdAt:Date.now()});
      });
    }
    db.speakingSlots=[...newSlots,...existing]; saveDB(db);
    reload(); flash(`✓ Added ${newSlots.length} slots!`);
  };

  const removeSlot = id => {
    const db = loadDB(); db.speakingSlots=(db.speakingSlots||[]).filter(s=>s.id!==id); saveDB(db); reload();
  };

  const toggleTime = t => setBulkTimes(prev=>prev.includes(t)?prev.filter(x=>x!==t):[...prev,t].sort());

  const ALL_TIMES = ["08:00","09:00","10:00","11:00","13:00","14:00","15:00","16:00","17:00"];
  const today = new Date().toISOString().slice(0,10);

  const future = slots.filter(s=>s.date>=today);
  const past   = slots.filter(s=>s.date<today);
  const freeCount   = future.filter(s=>!s.booked).length;
  const bookedCount = future.filter(s=>s.booked).length;

  const fmtSlotDate = d => new Date(d+"T00:00:00").toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",year:"numeric"});
  const modeLabel   = m => m==="online"?"🎥 Online":m==="inperson"?"🏛️ In-Person":"🎥+🏛️ Both";

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6,flexWrap:"wrap",gap:12}}>
        <div>
          <h2 style={{fontSize:22,fontWeight:800,color:C.s900,letterSpacing:"-0.03em",marginBottom:4}}>Speaking Slots</h2>
          <p style={{color:C.s400,fontSize:14}}>Manage available speaking test slots. Candidates only see future, unbooked slots.</p>
        </div>
        <div style={{display:"flex",gap:10}}>
          <div style={{...cardStyle({padding:"10px 16px"}),textAlign:"center"}}>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:22,fontWeight:900,color:C.teal}}>{freeCount}</div>
            <div style={{fontSize:10,color:C.s400,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em"}}>Available</div>
          </div>
          <div style={{...cardStyle({padding:"10px 16px"}),textAlign:"center"}}>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:22,fontWeight:900,color:C.brand}}>{bookedCount}</div>
            <div style={{fontSize:10,color:C.s400,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em"}}>Booked</div>
          </div>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:28}}>
        {/* Single slot */}
        <div style={{...cardStyle({padding:22})}}>
          <div style={{fontWeight:800,fontSize:14,color:C.s900,marginBottom:14}}>➕ Add Single Slot</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div>
              <label style={labelStyle}>Date</label>
              <input type="date" value={newDate} min={today} onChange={e=>setNewDate(e.target.value)} style={inputStyle}/>
            </div>
            <div>
              <label style={labelStyle}>Time</label>
              <select value={newTime} onChange={e=>setNewTime(e.target.value)} style={{...inputStyle,cursor:"pointer"}}>
                {ALL_TIMES.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div style={{marginBottom:14}}>
            <label style={labelStyle}>Mode</label>
            <div style={{display:"flex",gap:8}}>
              {[["online","🎥 Online"],["inperson","🏛️ In-Person"],["both","Both"]].map(([v,l])=>(
                <button key={v} onClick={()=>setNewMode(v)} style={{
                  flex:1,padding:"8px 4px",borderRadius:8,fontSize:12,cursor:"pointer",fontWeight:newMode===v?700:400,
                  background:newMode===v?C.brand:"#fff",color:newMode===v?"#fff":C.s600,
                  border:`1.5px solid ${newMode===v?C.brand:C.s200}`,
                }}>{l}</button>
              ))}
            </div>
          </div>
          <button onClick={addSlot} disabled={!newDate} style={{...btnStyle("primary",!newDate),width:"100%"}}>Add Slot →</button>
        </div>

        {/* Bulk add */}
        <div style={{...cardStyle({padding:22})}}>
          <div style={{fontWeight:800,fontSize:14,color:C.s900,marginBottom:14}}>📅 Bulk Add (Weekdays)</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div>
              <label style={labelStyle}>From Date</label>
              <input type="date" value={bulkFrom} min={today} onChange={e=>setBulkFrom(e.target.value)} style={inputStyle}/>
            </div>
            <div>
              <label style={labelStyle}>To Date</label>
              <input type="date" value={bulkTo} min={bulkFrom||today} onChange={e=>setBulkTo(e.target.value)} style={inputStyle}/>
            </div>
          </div>
          <div style={{marginBottom:12}}>
            <label style={labelStyle}>Times</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {ALL_TIMES.map(t=>(
                <button key={t} onClick={()=>toggleTime(t)} style={{
                  padding:"5px 10px",borderRadius:7,fontSize:12,cursor:"pointer",fontWeight:bulkTimes.includes(t)?700:400,
                  background:bulkTimes.includes(t)?C.brand:"#fff",color:bulkTimes.includes(t)?"#fff":C.s600,
                  border:`1.5px solid ${bulkTimes.includes(t)?C.brand:C.s200}`,
                }}>{t}</button>
              ))}
            </div>
          </div>
          <div style={{marginBottom:14}}>
            <label style={labelStyle}>Mode</label>
            <select value={bulkMode} onChange={e=>setBulkMode(e.target.value)} style={{...inputStyle,cursor:"pointer"}}>
              <option value="both">Both (Online + In-Person)</option>
              <option value="online">Online only</option>
              <option value="inperson">In-Person only</option>
            </select>
          </div>
          <button onClick={addBulk} disabled={!bulkFrom||!bulkTo||!bulkTimes.length} style={{...btnStyle("teal",!bulkFrom||!bulkTo||!bulkTimes.length),width:"100%"}}>
            Add All Weekday Slots →
          </button>
        </div>
      </div>

      {saved&&<div style={{marginBottom:14,padding:"8px 16px",background:C.tealL,borderRadius:8,fontSize:13,color:C.teal,fontWeight:700}}>{saved}</div>}

      {/* Slots table */}
      {future.length===0&&past.length===0 ? <EmptyState icon="🕐" text="No slots yet. Add some above."/> : (
        <div>
          {/* Future slots */}
          {future.length>0&&(
            <div style={{marginBottom:20}}>
              <div style={{fontSize:11,color:C.s400,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>
                Upcoming Slots ({future.length})
              </div>
              <div style={{...cardStyle({overflow:"hidden"})}}>
                <div style={{background:C.s900,display:"grid",gridTemplateColumns:"140px 80px 120px 100px 1fr 40px",gap:12,padding:"10px 16px"}}>
                  {["Date","Time","Mode","Status","Booked By",""].map(h=>(
                    <div key={h} style={{color:"rgba(255,255,255,.6)",fontSize:11,fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase"}}>{h}</div>
                  ))}
                </div>
                {future.map(s=>(
                  <div key={s.id} style={{display:"grid",gridTemplateColumns:"140px 80px 120px 100px 1fr 40px",gap:12,padding:"11px 16px",
                    borderTop:`1px solid ${C.s200}`,alignItems:"center",
                    background:s.booked?"#fff":C.tealL+"44"}}>
                    <div style={{fontSize:12,fontWeight:600,color:C.s900}}>{fmtSlotDate(s.date)}</div>
                    <div style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:700,color:C.brand,fontSize:13}}>{s.time}</div>
                    <div style={{fontSize:12,color:C.s600}}>{modeLabel(s.mode)}</div>
                    <div>
                      <span style={{...tagStyle(s.booked?C.rose:C.teal),fontSize:11}}>
                        {s.booked?"✓ Booked":"● Open"}
                      </span>
                    </div>
                    <div style={{fontSize:12,color:s.bookedBy?C.s900:C.s400}}>{s.bookedBy||"—"}</div>
                    <button onClick={()=>removeSlot(s.id)} disabled={s.booked}
                      style={{background:"none",border:"none",color:s.booked?C.s200:C.rose,cursor:s.booked?"default":"pointer",fontWeight:700,fontSize:14}}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Past slots (collapsed by default) */}
          {past.length>0&&(
            <details style={{marginTop:8}}>
              <summary style={{cursor:"pointer",fontSize:12,color:C.s400,fontWeight:700,padding:"8px 0"}}>
                Past Slots ({past.length}) — click to expand
              </summary>
              <div style={{...cardStyle({overflow:"hidden",marginTop:8})}}>
                {past.map(s=>(
                  <div key={s.id} style={{display:"grid",gridTemplateColumns:"140px 80px 120px 100px 1fr 40px",gap:12,padding:"9px 16px",
                    borderTop:`1px solid ${C.s200}`,alignItems:"center",opacity:.6}}>
                    <div style={{fontSize:12,color:C.s600}}>{fmtSlotDate(s.date)}</div>
                    <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:13,color:C.s400}}>{s.time}</div>
                    <div style={{fontSize:12,color:C.s400}}>{modeLabel(s.mode)}</div>
                    <div><span style={{...tagStyle(s.booked?C.s400:C.s200),fontSize:11}}>{s.booked?"Used":"Missed"}</span></div>
                    <div style={{fontSize:12,color:C.s400}}>{s.bookedBy||"—"}</div>
                    <button onClick={()=>removeSlot(s.id)} style={{background:"none",border:"none",color:C.rose,cursor:"pointer",fontWeight:700,fontSize:14}}>✕</button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function AssignManager() {
  const [assignments, setAssignments] = useState(loadDB().assignments||[]);
  const [publishedSuites, setPublishedSuites] = useState((loadDB().testSuites||[]).filter(s=>s.status==="published"));
  const [email, setEmail]         = useState("");
  const [suiteId, setSuiteId]     = useState("");
  const [saved, setSaved]         = useState(false);
  const [searchEmail, setSearchEmail] = useState("");

  const refresh = () => {
    setAssignments(loadDB().assignments||[]);
    setPublishedSuites((loadDB().testSuites||[]).filter(s=>s.status==="published"));
  };

  const assign = async () => {
    if(!email.trim()||!suiteId) return;
    const a = {id:genId("ASGN"),email:email.trim().toLowerCase(),suiteId,assignedAt:Date.now(),used:false};
    const updated = [a,...assignments];
    setAssignments(updated); await dbSaveNow("assignments",updated);
    setEmail(""); setSuiteId("");
    setSaved(true); setTimeout(()=>setSaved(false),2500);
  };

  const remove = async id => { const u=assignments.filter(a=>a.id!==id); setAssignments(u); await dbSaveNow("assignments",u); };
  const suiteName = id => (loadDB().testSuites||[]).find(s=>s.id===id)?.name||"(deleted suite)";

  const filtered = searchEmail.trim()
    ? assignments.filter(a=>a.email.includes(searchEmail.trim().toLowerCase()))
    : assignments;

  // unique emails for quick-pick
  const knownEmails = [...new Set(assignments.map(a=>a.email))];

  return (
    <div>
      <h2 style={{fontSize:22,fontWeight:800,color:C.s900,letterSpacing:"-0.03em",marginBottom:6}}>Test Assignments</h2>
      <p style={{color:C.s400,fontSize:14,marginBottom:24}}>Assign a specific test to a student. They'll receive it automatically on their next registration.</p>

      {/* Assign form */}
      <div style={{...cardStyle({padding:24,marginBottom:28})}}>
        <div style={{fontWeight:700,color:C.s900,fontSize:15,marginBottom:16}}>Assign Test to Student</div>
        {publishedSuites.length===0&&(
          <div style={{background:C.amberL,borderRadius:8,padding:"10px 14px",fontSize:12,color:C.amber,fontWeight:600,marginBottom:14}}>
            ⚠ No published suites. Go to Test Suites and publish at least one first.
          </div>
        )}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:14,alignItems:"flex-end"}}>
          <div>
            <label style={labelStyle}>Student Email *</label>
            <input value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&assign()}
              placeholder="student@example.com" style={inputStyle} list="known-emails"/>
            <datalist id="known-emails">{knownEmails.map(e=><option key={e} value={e}/>)}</datalist>
          </div>
          <div>
            <label style={labelStyle}>Test Suite *</label>
            <select value={suiteId} onChange={e=>setSuiteId(e.target.value)} style={{...inputStyle,cursor:"pointer"}}>
              <option value="">— select suite —</option>
              {publishedSuites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <button onClick={assign} disabled={!email.trim()||!suiteId||!publishedSuites.length}
            style={btnStyle("primary",!email.trim()||!suiteId||!publishedSuites.length)}>
            Assign →
          </button>
        </div>
        {saved&&<div style={{marginTop:10,color:C.teal,fontWeight:700,fontSize:13}}>✓ Assignment saved!</div>}
      </div>

      {/* Search by email */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
        <div style={{flex:1,position:"relative"}}>
          <input value={searchEmail} onChange={e=>setSearchEmail(e.target.value)}
            placeholder="🔍  Filter by student email…" style={{...inputStyle,paddingLeft:14}}/>
        </div>
        {searchEmail&&(
          <button onClick={()=>setSearchEmail("")} style={{...btnStyle("ghost"),color:C.rose,fontWeight:700,fontSize:12}}>✕ Clear</button>
        )}
        <button onClick={refresh} style={{...btnStyle("secondary"),padding:"9px 16px",fontSize:12}}>↺ Refresh</button>
      </div>

      {/* Results header */}
      {searchEmail.trim()&&(
        <div style={{marginBottom:10,padding:"8px 14px",background:C.brandL,borderRadius:8,fontSize:12,color:C.brand,fontWeight:700}}>
          Showing {filtered.length} assignment{filtered.length!==1?"s":""} for "{searchEmail.trim()}"
        </div>
      )}

      {filtered.length===0 ? (
        <EmptyState icon="📋" text={searchEmail?"No assignments found for this email.":"No assignments yet."}/>
      ) : (
        <div style={{...cardStyle({overflow:"hidden"})}}>
          <div style={{padding:"12px 16px",background:C.s900,display:"grid",gridTemplateColumns:"2fr 2fr 90px 110px 40px",gap:12}}>
            {["Student Email","Suite","Status","Assigned",""].map(h=>(
              <div key={h} style={{color:"rgba(255,255,255,.6)",fontSize:11,fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase"}}>{h}</div>
            ))}
          </div>
          {filtered.map(a=>(
            <div key={a.id} style={{padding:"11px 16px",borderTop:`1px solid ${C.s200}`,display:"grid",gridTemplateColumns:"2fr 2fr 90px 110px 40px",gap:12,alignItems:"center",
              background:a.used?"#fff":C.tealL+"55"}}>
              <div style={{fontSize:13,fontWeight:600,wordBreak:"break-all",color:C.s900}}>
                <button onClick={()=>setSearchEmail(a.email)} style={{background:"none",border:"none",cursor:"pointer",color:C.brand,fontWeight:700,fontSize:13,padding:0,textDecoration:"underline"}}>
                  {a.email}
                </button>
              </div>
              <div style={{fontSize:13,color:C.s800,fontWeight:500}}>{suiteName(a.suiteId)}</div>
              <div>
                <span style={{...tagStyle(a.used?C.s400:C.teal),fontSize:11}}>
                  {a.used?"✓ Used":"⏳ Pending"}
                </span>
              </div>
              <div style={{fontSize:12,color:C.s400}}>{new Date(a.assignedAt).toLocaleDateString("en-GB")}</div>
              <button onClick={()=>remove(a.id)} style={{background:"none",border:"none",color:C.rose,cursor:"pointer",fontWeight:700,fontSize:14}}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── QUESTION BUILDER HELPERS (top-level so QuestionBuilder is never remounted) ─
const READING_Q_TYPES = [
  ["mcq","Multiple Choice"],["truefalse","True / False / Not Given"],["yesno","Yes / No / Not Given"],
  ["matching_headings","Matching Headings"],["matching_info","Matching Information"],
  ["matching_features","Matching Features"],["matching_endings","Matching Sentence Endings"],
  ["sentence_completion","Sentence Completion"],["summary_completion","Summary Completion"],
  ["note_completion","Note Completion"],["table_completion","Table Completion"],
  ["flowchart_completion","Flow-chart Completion"],["diagram_label","Diagram Label Completion"],
  ["short_answer","Short Answer Questions"],
];
const LISTENING_Q_TYPES = [
  ["mcq","Multiple Choice"],["matching","Matching"],
  ["truefalse","True / False / Not Given"],["yesno","Yes / No / Not Given"],
  ["diagram_label","Plan / Map / Diagram Labeling"],["form_completion","Form Completion"],
  ["note_completion","Note Completion"],["table_completion","Table Completion"],
  ["flowchart_completion","Flow-chart Completion"],["summary_completion","Summary Completion"],
  ["sentence_completion","Sentence Completion"],["short_answer","Short Answer Questions"],
];
const OPTION_TYPES = new Set(["mcq","matching","matching_headings","matching_info","matching_features","matching_endings"]);
const TEXT_INPUT_TYPES = new Set(["sentence_completion","summary_completion","note_completion","table_completion","flowchart_completion","diagram_label","short_answer","form_completion","fillblank"]);
// Types that use a shared options list (group leader owns it; followers inherit)
const GROUP_MATCH_TYPES = new Set(["matching_headings","matching_info","matching_features","matching_endings","matching"]);
const defaultOptions = t => t==="matching_headings"?["","","","","","","","",""]:(OPTION_TYPES.has(t)?["","","",""]:[]);
const qbEmptyQ = (mode="reading") => ({id:Date.now()+Math.random(), type:"mcq", text:"", options:["","","",""], correct:"", hint:"", mode});
const qbAddQ    = (setter,mode) => setter(qs=>[...qs, qbEmptyQ(mode)]);
const qbRemoveQ = (setter,id) => setter(qs=>qs.filter(q=>q.id!==id));
const qbUpdateQ = (setter,id,key,val) => setter(qs=>qs.map(q=>q.id===id?{...q,[key]:val}:q));
const qbUpdateOpt = (setter,id,oi,val) => setter(qs=>qs.map(q=>q.id===id?{...q,options:q.options.map((o,i)=>i===oi?val:o)}:q));
const qbAddOpt  = (setter,id) => setter(qs=>qs.map(q=>q.id===id?{...q,options:[...q.options,""]}:q));
const qbRemOpt  = (setter,id,oi) => setter(qs=>qs.map(q=>q.id===id?{...q,options:q.options.filter((_,i)=>i!==oi)}:q));

// Sync followers: when leader options change, push updated options to all consecutive followers
const qbSyncFollowers = (setter,leaderIdx) => setter(qs=>{
  const leader=qs[leaderIdx];
  if(!leader||!GROUP_MATCH_TYPES.has(leader.type)) return qs;
  const out=[...qs];
  for(let i=leaderIdx+1;i<out.length&&out[i].type===leader.type;i++){
    out[i]={...out[i],options:[...leader.options]};
  }
  return out;
});

function QuestionBuilder({questions, setQuestions, mode="reading", qStart=1}) {
  const qTypes = mode==="listening" ? LISTENING_Q_TYPES : READING_Q_TYPES;
  return (
    <div>
      {questions.map((q,qi)=>{
        const isGroupMatch  = GROUP_MATCH_TYPES.has(q.type);
        const isGroupLeader = isGroupMatch && (qi===0 || questions[qi-1].type!==q.type);
        const isGroupFollow = isGroupMatch && !isGroupLeader;
        // Find the actual group leader (first Q in the consecutive same-type chain)
        const leaderIdx = isGroupFollow ? (()=>{
          let idx = qi - 1;
          while(idx > 0 && questions[idx-1]?.type === q.type) idx--;
          return idx;
        })() : -1;
        const leaderQ       = leaderIdx>=0 ? questions[leaderIdx] : null;
        const sharedOptions = isGroupMatch ? (isGroupLeader ? q.options : (leaderQ?.options||[])) : [];
        const isOptionType  = OPTION_TYPES.has(q.type) && !isGroupMatch; // only MCQ
        const isTextInput   = TEXT_INPUT_TYPES.has(q.type);
        const isTF  = q.type==="truefalse";
        const isYN  = q.type==="yesno";
        const fixedChoices  = isTF?["TRUE","FALSE","NOT GIVEN"]:isYN?["YES","NO","NOT GIVEN"]:null;
        const isHeadings    = q.type==="matching_headings";

        return (
          <div key={q.id} style={{...cardStyle({padding:16,marginBottom:10,
            borderLeft:`3px solid ${isGroupFollow?C.s300:C.brand}`,
            background:isGroupFollow?"#FAFAFA":"#fff"})}}>
            {/* Header row */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:700,color:C.brand,background:C.brandL,borderRadius:6,padding:"2px 8px"}}>Q{qStart+qi}</span>
                {isGroupLeader&&(
                  <span style={{fontSize:10,color:C.brand,fontWeight:700,background:C.brandL,borderRadius:4,padding:"2px 8px"}}>
                    ★ Group Leader — defines shared options list
                  </span>
                )}
                {isGroupFollow&&(
                  <span style={{fontSize:10,color:C.s500,fontWeight:600,background:"#F1F5F9",borderRadius:4,padding:"2px 8px"}}>
                    ↳ Uses shared options from Q{qStart+leaderIdx}
                  </span>
                )}
              </div>
              <button onClick={()=>qbRemoveQ(setQuestions,q.id)} style={{background:C.roseL,color:C.rose,border:"none",borderRadius:6,padding:"3px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>✕ Remove</button>
            </div>

            {/* Type + Question Text */}
            <div style={{display:"grid",gridTemplateColumns:"200px 1fr",gap:10,marginBottom:10}}>
              <div>
                <label style={labelStyle}>Type</label>
                <select value={q.type} onChange={e=>{
                  const newType=e.target.value;
                  qbUpdateQ(setQuestions,q.id,"type",newType);
                  qbUpdateQ(setQuestions,q.id,"options",defaultOptions(newType));
                  qbUpdateQ(setQuestions,q.id,"correct","");
                }} style={{...inputStyle,cursor:"pointer",fontSize:12}}>
                  {qTypes.map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>
                  {isGroupMatch ? (isHeadings?"Paragraph / Item Label":"Statement / Item") : "Question / Stem Text"}
                </label>
                <input value={q.text} onChange={e=>qbUpdateQ(setQuestions,q.id,"text",e.target.value)}
                  placeholder={isGroupMatch?(isHeadings?"e.g. Paragraph A":"e.g. Paragraph A discusses…"):"Enter question or stem…"}
                  style={inputStyle}/>
              </div>
            </div>

            {/* Task Instructions — shown on every question, optional */}
            {(!isGroupFollow)&&(
              <div style={{marginBottom:10}}>
                <label style={labelStyle}>
                  Task Instructions <span style={{color:C.s400,fontWeight:400}}>(optional — shown above this question in the test; leave blank if continuing same block)</span>
                </label>
                <textarea
                  value={q.instructions||""}
                  onChange={e=>qbUpdateQ(setQuestions,q.id,"instructions",e.target.value)}
                  placeholder={`e.g. Questions ${qStart+qi}–${qStart+qi+3}\nChoose the correct letter, A, B, C or D.\nWrite the correct letter in boxes on your answer sheet.`}
                  rows={3}
                  style={{...inputStyle,resize:"vertical",fontFamily:"inherit",lineHeight:1.5,fontSize:13}}/>
              </div>
            )}

            {/* Shared Options List — only on Group Leader */}
            {isGroupLeader&&(
              <div style={{marginBottom:10,background:C.brandL,borderRadius:10,padding:"12px 14px",border:`1px dashed ${C.brand}60`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <div>
                    <label style={{...labelStyle,color:C.brand}}>
                      {isHeadings?"List of Headings":"List of Options"}
                    </label>
                    <p style={{fontSize:10,color:C.s500,marginTop:2}}>
                      {isHeadings
                        ? "Add all headings (tip: add more than there are paragraphs, e.g. 9 for 4 paragraphs)"
                        : "Add all options — they will be labeled A, B, C… and shared with all following same-type questions"}
                    </p>
                  </div>
                  <button onClick={()=>{
                    qbAddOpt(setQuestions,q.id);
                    // sync after adding
                    setTimeout(()=>qbSyncFollowers(setQuestions,qi),0);
                  }} style={{background:"#fff",color:C.brand,border:`1px solid ${C.brand}`,borderRadius:5,padding:"3px 12px",fontSize:11,fontWeight:700,cursor:"pointer",flexShrink:0}}>
                    + Add Option
                  </button>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {q.options.map((opt,oi)=>(
                    <div key={oi} style={{display:"flex",gap:6,alignItems:"center"}}>
                      <span style={{fontSize:12,fontWeight:800,color:C.brand,width:28,flexShrink:0,fontFamily:"'JetBrains Mono',monospace"}}>
                        {isHeadings?`${toRoman(oi+1)}.`:`${String.fromCharCode(65+oi)}.`}
                      </span>
                      <input value={opt} onChange={e=>{
                        qbUpdateOpt(setQuestions,q.id,oi,e.target.value);
                        setTimeout(()=>qbSyncFollowers(setQuestions,qi),0);
                      }}
                        placeholder={isHeadings?`Heading ${toRoman(oi+1)}`:`Option ${String.fromCharCode(65+oi)}`}
                        style={{...inputStyle,fontSize:12,flex:1,padding:"7px 10px",background:"#fff"}}/>
                      {q.options.length>2&&<button onClick={()=>{
                        qbRemOpt(setQuestions,q.id,oi);
                        setTimeout(()=>qbSyncFollowers(setQuestions,qi),0);
                      }} style={{background:C.roseL,color:C.rose,border:"none",borderRadius:5,padding:"3px 8px",fontSize:10,cursor:"pointer",flexShrink:0}}>✕</button>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Regular MCQ options */}
            {isOptionType&&(
              <div style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <label style={labelStyle}>Options</label>
                  <button onClick={()=>qbAddOpt(setQuestions,q.id)} style={{background:C.brandL,color:C.brand,border:"none",borderRadius:5,padding:"2px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>+ Add Option</button>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {q.options.map((opt,oi)=>(
                    <div key={oi} style={{display:"flex",gap:6,alignItems:"center"}}>
                      <span style={{fontSize:12,fontWeight:700,color:C.s400,width:20,flexShrink:0}}>{String.fromCharCode(65+oi)}.</span>
                      <input value={opt} onChange={e=>qbUpdateOpt(setQuestions,q.id,oi,e.target.value)}
                        placeholder={`Option ${String.fromCharCode(65+oi)}`} style={{...inputStyle,fontSize:12,flex:1,padding:"7px 10px"}}/>
                      {q.options.length>2&&<button onClick={()=>qbRemOpt(setQuestions,q.id,oi)} style={{background:C.roseL,color:C.rose,border:"none",borderRadius:5,padding:"3px 8px",fontSize:10,cursor:"pointer",flexShrink:0}}>✕</button>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Correct answer */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div>
                <label style={labelStyle}>Correct Answer</label>
                {fixedChoices?(
                  <select value={q.correct} onChange={e=>qbUpdateQ(setQuestions,q.id,"correct",e.target.value)}
                    style={{...inputStyle,cursor:"pointer",color:q.correct?"":C.s400,borderColor:q.correct?C.s300:"#f97316"}}>
                    <option value="">— select answer —</option>
                    {fixedChoices.map(o=><option key={o} value={o}>{o}</option>)}
                  </select>
                ):isGroupMatch?(
                  /* Dropdown from shared options list */
                  <select value={q.correct} onChange={e=>qbUpdateQ(setQuestions,q.id,"correct",e.target.value)}
                    style={{...inputStyle,cursor:"pointer",fontSize:12}}>
                    <option value="">— Select correct option —</option>
                    {sharedOptions.filter(o=>o.trim()).map((o,i)=>(
                      <option key={i} value={o}>
                        {isHeadings?`${toRoman(i+1)}. ${o}`:`${String.fromCharCode(65+i)}. ${o}`}
                      </option>
                    ))}
                  </select>
                ):isOptionType?(
                  <input value={q.correct} onChange={e=>qbUpdateQ(setQuestions,q.id,"correct",e.target.value)}
                    placeholder="e.g. A or exact option text" style={inputStyle}/>
                ):(
                  <input value={q.correct} onChange={e=>qbUpdateQ(setQuestions,q.id,"correct",e.target.value)}
                    placeholder="Exact answer (e.g. three words)" style={inputStyle}/>
                )}
              </div>
              <div>
                <label style={labelStyle}>Hint <span style={{color:C.s400,fontWeight:400}}>(shown to candidate)</span></label>
                <input value={q.hint||""} onChange={e=>qbUpdateQ(setQuestions,q.id,"hint",e.target.value)}
                  placeholder={isGroupMatch?(isHeadings?"e.g. Choose ONE heading":"e.g. Choose ONE letter"):"e.g. NO MORE THAN THREE WORDS"}
                  style={inputStyle}/>
              </div>
            </div>

            {/* Map / Diagram image upload — for diagram_label questions */}
            {q.type==="diagram_label"&&(
              <div style={{marginTop:10}}>
                <label style={labelStyle}>Map / Plan / Diagram Image <span style={{color:C.s400,fontWeight:400}}>(shown above this question in the test)</span></label>
                {q.diagramImage?(
                  <div style={{position:"relative",borderRadius:10,overflow:"hidden",border:`2px solid ${C.brand}`,background:C.s100,marginTop:4}}>
                    <img src={q.diagramImage} alt="Diagram" style={{width:"100%",maxHeight:300,objectFit:"contain",display:"block",background:"#fff"}}/>
                    <button onClick={()=>qbUpdateQ(setQuestions,q.id,"diagramImage",null)}
                      style={{position:"absolute",top:8,right:8,background:"rgba(225,29,72,.85)",color:"#fff",border:"none",borderRadius:7,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                      ✕ Remove
                    </button>
                  </div>
                ):(
                  <label style={{display:"block",marginTop:4,border:`2px dashed ${C.brand}40`,borderRadius:10,padding:"20px",textAlign:"center",cursor:"pointer",background:C.brandL}}>
                    <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{
                      const file=e.target.files?.[0]; if(!file) return;
                      const reader=new FileReader();
                      reader.onload=ev=>qbUpdateQ(setQuestions,q.id,"diagramImage",ev.target.result);
                      reader.readAsDataURL(file);
                    }}/>
                    <div style={{fontSize:24,marginBottom:8}}>🗺️</div>
                    <div style={{fontSize:13,fontWeight:600,color:C.brand}}>Click to upload map / plan / diagram</div>
                    <div style={{fontSize:11,color:C.s400,marginTop:4}}>PNG, JPG, GIF — shown to students during the test</div>
                  </label>
                )}
              </div>
            )}
          </div>
        );
      })}
      <button onClick={()=>qbAddQ(setQuestions,mode)} style={{...btnStyle("secondary"),fontSize:12,padding:"8px 18px"}}>+ Add Question</button>
    </div>
  );
}

// ── PASSAGE CARD (top-level to avoid remount / focus loss) ───────────────────
function PassageCard({ passage, idx, total, onUpdate, onDelete, setQuestions, qStart=1 }) {
  const borderCol = idx===0?C.teal:idx===1?C.brand:C.violet;
  const bgCol     = idx===0?C.tealL:idx===1?C.brandL:"#E6FAF4";
  return (
    <div style={{border:`1.5px solid ${borderCol}30`,borderRadius:14,marginBottom:14,overflow:"hidden"}}>
      <div style={{padding:"10px 16px",background:bgCol,display:"flex",gap:10,alignItems:"center"}}>
        <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:800,color:borderCol,background:"#fff",borderRadius:6,padding:"3px 10px",flexShrink:0}}>
          Passage {idx+1}
        </span>
        <input value={passage.title} onChange={e=>onUpdate("title",e.target.value)}
          placeholder={`Passage ${idx+1} title — e.g. Cambridge 18 Test 1 · Passage ${idx+1}`}
          style={{...inputStyle,flex:1,background:"#fff",padding:"7px 12px",fontSize:13}}/>
        <button onClick={()=>onUpdate("collapsed",!passage.collapsed)}
          style={{background:"#fff",border:`1px solid ${borderCol}40`,borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:12,color:borderCol,fontWeight:700,flexShrink:0}}>
          {passage.collapsed?"▼ Show":"▲ Hide"}
        </button>
        {total>1&&<button onClick={onDelete}
          style={{background:C.roseL,color:C.rose,border:"none",borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:12,fontWeight:700,flexShrink:0}}>✕</button>}
      </div>
      {!passage.collapsed&&(
        <div style={{padding:18}}>
          <div style={{marginBottom:14}}>
            <label style={labelStyle}>Passage Text *</label>
            <textarea value={passage.text} onChange={e=>onUpdate("text",e.target.value)}
              placeholder="Paste the full reading passage here…" rows={7}
              style={{...inputStyle,resize:"vertical",lineHeight:1.8,borderRadius:10}}/>
          </div>
          <div>
            <label style={labelStyle}>Questions for this passage</label>
            <p style={{fontSize:12,color:C.s400,marginBottom:10}}>Questions are auto-scored when the candidate submits.</p>
            <QuestionBuilder questions={passage.questions} setQuestions={setQuestions} mode="reading" qStart={qStart}/>
          </div>
        </div>
      )}
    </div>
  );
}

// ── AUDIO UPLOADER ────────────────────────────────────────────────────────────
// Uploads audio to Supabase Storage and returns a permanent public URL.
// Falls back to a URL-paste field if Supabase Storage is unavailable.
function AudioUploader({ onUrl }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState("");
  const [urlInput, setUrlInput]   = useState("");
  const [mode, setMode]           = useState("upload"); // "upload" | "url"

  const handleFile = async e => {
    const file = e.target.files?.[0]; if(!file) return;
    setError(""); setUploading(true);
    if(supabase) {
      try {
        const ext  = file.name.split(".").pop();
        const path = `audio/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("ielts-audio").upload(path, file, { upsert: true });
        if(upErr) throw upErr;
        const { data } = supabase.storage.from("ielts-audio").getPublicUrl(path);
        onUrl(data.publicUrl);
        setUploading(false); return;
      } catch(err) {
        console.warn("[Audio upload]", err.message||err);
        setError(`Supabase Storage error: ${err.message||err}. Please create a public bucket named "ielts-audio" in Supabase, or use the URL option below.`);
        setUploading(false); return;
      }
    }
    setError("Supabase not configured. Please paste a direct audio URL below.");
    setMode("url"); setUploading(false);
  };

  return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:10}}>
        {["upload","url"].map(m=>(
          <button key={m} onClick={()=>setMode(m)} style={{
            padding:"5px 14px",borderRadius:7,border:`1.5px solid ${mode===m?C.brand:C.s200}`,
            background:mode===m?C.brandL:"#fff",color:mode===m?C.brand:C.s600,
            fontSize:12,fontWeight:700,cursor:"pointer"
          }}>{m==="upload"?"📤 Upload File":"🔗 Paste URL"}</button>
        ))}
      </div>

      {mode==="upload"&&(
        <label style={{display:"flex",alignItems:"center",gap:12,cursor:uploading?"default":"pointer",
          border:`1.5px dashed ${error?C.rose:C.s200}`,borderRadius:10,padding:"14px 18px",
          background:uploading?"#F8FAFC":C.s100,transition:"background .15s",opacity:uploading?.6:1}}>
          <span style={{fontSize:24}}>{uploading?"⏳":"🎵"}</span>
          <div>
            <div style={{fontWeight:700,fontSize:13,color:C.s900}}>{uploading?"Uploading to Supabase Storage…":"Upload Audio File"}</div>
            <div style={{fontSize:11,color:C.s400,marginTop:2}}>MP3 · WAV · M4A · OGG — uploaded to cloud, no size limit</div>
          </div>
          <input type="file" accept="audio/*" onChange={handleFile} style={{display:"none"}} disabled={uploading}/>
        </label>
      )}

      {mode==="url"&&(
        <div style={{display:"flex",gap:8}}>
          <input value={urlInput} onChange={e=>setUrlInput(e.target.value)}
            placeholder="https://… direct link to MP3/WAV/OGG file"
            style={{...inputStyle,flex:1}}/>
          <button onClick={()=>{ if(urlInput.trim()) onUrl(urlInput.trim()); }}
            disabled={!urlInput.trim()}
            style={{...btnStyle("teal",!urlInput.trim()),padding:"0 16px",flexShrink:0,whiteSpace:"nowrap"}}>
            Use URL
          </button>
        </div>
      )}

      {error&&<div style={{marginTop:8,fontSize:11,color:C.rose,lineHeight:1.5,background:C.roseL,borderRadius:7,padding:"8px 12px"}}>{error}</div>}

      {mode==="upload"&&!error&&(
        <div style={{marginTop:6,fontSize:11,color:C.s400,lineHeight:1.5}}>
          ℹ️ Requires a <strong>public Supabase Storage bucket</strong> named <code style={{background:C.s100,padding:"1px 5px",borderRadius:4}}>ielts-audio</code>.
          {" "}<button onClick={()=>setMode("url")} style={{background:"none",border:"none",color:C.brand,cursor:"pointer",fontSize:11,fontWeight:700,padding:0}}>Or paste a URL instead →</button>
        </div>
      )}
    </div>
  );
}

// ── SECTION CARD (top-level to avoid remount / focus loss) ───────────────────
function SectionCard({ section, idx, total, onUpdate, onDelete, setQuestions, qStart=1 }) {
  const colors = [C.brand, C.teal, C.violet, C.amber];
  const bgs    = [C.brandL, C.tealL, "#E6FAF4", C.amberL];
  const col = colors[idx]||C.brand, bg = bgs[idx]||C.brandL;
  return (
    <div style={{border:`1.5px solid ${col}30`,borderRadius:14,marginBottom:14,overflow:"hidden"}}>
      <div style={{padding:"10px 16px",background:bg,display:"flex",gap:10,alignItems:"center"}}>
        <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:800,color:col,background:"#fff",borderRadius:6,padding:"3px 10px",flexShrink:0}}>
          Section {idx+1}
        </span>
        <input value={section.title} onChange={e=>onUpdate("title",e.target.value)}
          placeholder={`Section ${idx+1} title — e.g. Hotel Reservation`}
          style={{...inputStyle,flex:1,background:"#fff",padding:"7px 12px",fontSize:13}}/>
        <button onClick={()=>onUpdate("collapsed",!section.collapsed)}
          style={{background:"#fff",border:`1px solid ${col}40`,borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:12,color:col,fontWeight:700,flexShrink:0}}>
          {section.collapsed?"▼ Show":"▲ Hide"}
        </button>
        {total>1&&<button onClick={onDelete}
          style={{background:C.roseL,color:C.rose,border:"none",borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:12,fontWeight:700,flexShrink:0}}>✕</button>}
      </div>
      {!section.collapsed&&(
        <div style={{padding:18}}>
          <div style={{marginBottom:12}}>
            <label style={labelStyle}>Instructions (shown to candidates)</label>
            <input value={section.instructions} onChange={e=>onUpdate("instructions",e.target.value)}
              placeholder={`e.g. Questions ${idx*10+1}–${(idx+1)*10}: Complete notes using NO MORE THAN THREE WORDS`}
              style={inputStyle}/>
          </div>
          <div style={{marginBottom:14}}>
            <label style={labelStyle}>Audio File <span style={{color:C.s400,fontWeight:400}}>(played during test)</span></label>
            {section.audioUrl?(
              <div>
                <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:C.tealL,border:`1.5px solid ${C.teal}40`,borderRadius:10,marginBottom:6}}>
                  <span style={{fontSize:18}}>🎵</span>
                  <audio controls src={section.audioUrl} style={{flex:1,height:32,minWidth:0}}/>
                  <button onClick={()=>onUpdate("audioUrl",null)} style={{background:C.roseL,color:C.rose,border:"none",borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:11,fontWeight:700,flexShrink:0}}>✕ Remove</button>
                </div>
              </div>
            ):(
              <AudioUploader onUrl={url=>onUpdate("audioUrl",url)}/>
            )}
          </div>
          <div style={{marginBottom:14}}>
            <label style={labelStyle}>Audio Script <span style={{color:C.s400,fontWeight:400}}>(admin reference — not shown to candidates)</span></label>
            <textarea value={section.script} onChange={e=>onUpdate("script",e.target.value)}
              placeholder="Paste audio transcript or notes here — not shown to candidates…" rows={5}
              style={{...inputStyle,resize:"vertical",lineHeight:1.75,borderRadius:10}}/>
          </div>
          <div>
            <label style={labelStyle}>Questions</label>
            <QuestionBuilder questions={section.questions} setQuestions={setQuestions} mode="listening" qStart={qStart}/>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ADD TEST MANAGER ──────────────────────────────────────────────────────────
const newPassage = (idx) => ({id:Date.now()+Math.random(), title:"", text:"", questions:[], collapsed:idx>0});
const newSection = (idx) => ({id:Date.now()+Math.random(), title:"", instructions:"", script:"", audioUrl:null, questions:[], collapsed:idx>0});

function AddTestManager() {
  const [tests, setTests]         = useState((loadDB().tests)||[]);
  const [activeType, setActiveType] = useState("Reading");
  const [saved, setSaved]         = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Reading: multi-passage
  const [rTitle, setRTitle]       = useState("");
  const [rPassages, setRPassages] = useState([newPassage(0)]);

  // Writing state — Task 1 and Task 2 stored separately
  const [wT1Title,  setWT1Title]  = useState("");
  const [wT1Prompt, setWT1Prompt] = useState("");
  const [wT1Image,  setWT1Image]  = useState(null);
  const [wT1Saved,  setWT1Saved]  = useState(false);
  const [wT2Title,  setWT2Title]  = useState("");
  const [wT2Prompt, setWT2Prompt] = useState("");
  const [wT2Saved,  setWT2Saved]  = useState(false);

  // Listening: multi-section + audio upload
  const [lTitle, setLTitle]             = useState("");
  const [lSections, setLSections]       = useState([newSection(0)]);
  const [lAudioUrl, setLAudioUrl]       = useState(()=>loadDB().listeningAudioUrl||"");
  const [lAudioUploading, setLAudioUploading] = useState(false);

  const handleImageUpload = e => {
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => setWTask1Image(ev.target.result);
    reader.readAsDataURL(file);
  };

  // Passage helpers
  const updatePassage  = (id,k,v) => setRPassages(ps=>ps.map(p=>p.id===id?{...p,[k]:v}:p));
  const deletePassage  = (id)     => setRPassages(ps=>ps.filter(p=>p.id!==id));
  const setPassageQ    = (id)     => upd => setRPassages(ps=>ps.map(p=>p.id===id?{...p,questions:typeof upd==="function"?upd(p.questions):upd}:p));
  const addPassage     = ()       => { if(rPassages.length<3) setRPassages(ps=>[...ps,newPassage(ps.length)]); };

  // Section helpers
  const updateSection  = (id,k,v) => setLSections(ss=>ss.map(s=>s.id===id?{...s,[k]:v}:s));
  const deleteSection  = (id)     => setLSections(ss=>ss.filter(s=>s.id!==id));
  const setSectionQ    = (id)     => upd => setLSections(ss=>ss.map(s=>s.id===id?{...s,questions:typeof upd==="function"?upd(s.questions):upd}:s));
  const addSection     = ()       => { if(lSections.length<4) setLSections(ss=>[...ss,newSection(ss.length)]); };

  const doSave = t => {
    let updated;
    if(editingId) {
      updated = tests.map(x => x.id===editingId ? {...t, id:editingId, createdAt:x.createdAt} : x);
      setEditingId(null);
    } else {
      updated = [...tests, t];
    }
    setTests(updated); dbSave("tests", updated);
    setSaved(true); setTimeout(()=>setSaved(false),2500);
  };

  const loadForEdit = t => {
    setEditingId(t.id);
    setActiveType(t.type);
    if(t.type==="Reading") {
      setRTitle(t.title||"");
      setRPassages(t.passages?.length ? t.passages : [newPassage(0)]);
    } else if(t.type==="Writing") {
      setWTitle(t.title||"");
      setWTask1Prompt(t.task1Prompt||"");
      setWTask1Image(t.task1Image||null);
      setWTask2Prompt(t.task2Prompt||"");
    } else if(t.type==="Listening") {
      setLTitle(t.title||"");
      setLSections(t.sections?.length ? t.sections : [newSection(0)]);
    }
    // Scroll to top of builder
    window.scrollTo({top:0,behavior:"smooth"});
  };

  const saveReading = () => {
    if(!rTitle.trim()) return;
    const validPassages = rPassages.filter(p=>p.text.trim());
    if(!validPassages.length) return;
    doSave({id:genId("TEST"),type:"Reading",title:rTitle,passages:rPassages.map(p=>({...p})),createdAt:new Date().toLocaleDateString("en-GB")});
    setRTitle(""); setRPassages([newPassage(0)]);
  };
  const saveWritingTask1 = () => {
    if(!wT1Prompt.trim()) return;
    doSave({id:genId("TEST"),type:"Writing",taskType:"task1",title:wT1Title||"Writing Task 1",task1Prompt:wT1Prompt,task1Image:wT1Image,createdAt:new Date().toLocaleDateString("en-GB")});
    setWT1Title(""); setWT1Prompt(""); setWT1Image(null);
    setWT1Saved(true); setTimeout(()=>setWT1Saved(false),2500);
  };
  const saveWritingTask2 = () => {
    if(!wT2Prompt.trim()) return;
    doSave({id:genId("TEST"),type:"Writing",taskType:"task2",title:wT2Title||"Writing Task 2",task2Prompt:wT2Prompt,createdAt:new Date().toLocaleDateString("en-GB")});
    setWT2Title(""); setWT2Prompt("");
    setWT2Saved(true); setTimeout(()=>setWT2Saved(false),2500);
  };
  const uploadListeningAudio = async e => {
    const file = e.target.files[0]; if(!file) return;
    setLAudioUploading(true);
    try {
      if(supabase) {
        const ext = file.name.split(".").pop();
        const path = `listening/${Date.now()}.${ext}`;
        const {error:upErr} = await supabase.storage.from("ielts-audio").upload(path,file,{upsert:true});
        if(upErr) throw upErr;
        const {data} = supabase.storage.from("ielts-audio").getPublicUrl(path);
        const db = loadDB(); db.listeningAudioUrl = data.publicUrl; saveDB(db);
        setLAudioUrl(data.publicUrl);
      } else {
        const reader = new FileReader();
        reader.onload = ev => {
          const db = loadDB(); db.listeningAudioUrl = ev.target.result; saveDB(db);
          setLAudioUrl(ev.target.result);
        };
        reader.readAsDataURL(file);
      }
    } catch(e){ alert("Audio upload failed: "+e.message); }
    setLAudioUploading(false);
  };
  const removeListeningAudio = () => {
    const db = loadDB(); delete db.listeningAudioUrl; saveDB(db); setLAudioUrl("");
  };

  const saveListening = () => {
    if(!lTitle.trim()) return;
    // Save audio URL to global config
    const db = loadDB(); if(lAudioUrl) db.listeningAudioUrl = lAudioUrl; saveDB(db);
    doSave({id:genId("TEST"),type:"Listening",title:lTitle,sections:lSections.map(s=>({...s})),audioUrl:lAudioUrl||null,createdAt:new Date().toLocaleDateString("en-GB")});
    setLTitle(""); setLSections([newSection(0)]);
  };
  const deleteTest = id => { const u=tests.filter(t=>t.id!==id); setTests(u); dbSave("tests",u); };
  const typeColor  = t  => t==="Reading"?C.teal:t==="Writing"?C.violet:C.amber;

  return (
    <div>
      <h2 style={{fontSize:22,fontWeight:800,color:C.s900,letterSpacing:"-0.03em",marginBottom:6}}>Section Builder</h2>
      <p style={{color:C.s400,fontSize:14,marginBottom:24}}>Build reading passages, listening sections, and writing prompts — then combine them into named Test Suites.</p>
      {editingId&&(
        <div style={{background:"#FEF3C7",border:"1px solid #FDE68A",borderRadius:10,padding:"10px 16px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:13,fontWeight:700,color:"#92400E"}}>✏ Editing existing section — save to update</span>
          <button onClick={()=>{setEditingId(null);setRTitle("");setRPassages([newPassage(0)]);setWTitle("");setWTask1Prompt("");setWTask1Image(null);setWTask2Prompt("");setLTitle("");setLSections([newSection(0)]);}} style={{background:"#FDE68A",color:"#92400E",border:"none",borderRadius:6,padding:"4px 12px",fontSize:11,cursor:"pointer",fontWeight:700}}>✕ Cancel Edit</button>
        </div>
      )}

      {/* Saved sections list */}
      {tests.length>0&&(
        <div style={{marginBottom:28}}>
          <div style={{fontSize:11,color:C.s400,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:10}}>Saved Sections ({tests.length})</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {tests.map(t=>(
              <div key={t.id} style={{...cardStyle({padding:"12px 18px",display:"flex",justifyContent:"space-between",alignItems:"center"})}}>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:3}}>
                    <span style={{...tagStyle(typeColor(t.type))}}>{t.type}</span>
                    <span style={{fontWeight:700,fontSize:14,color:C.s900}}>{t.title}</span>
                  </div>
                  <div style={{fontSize:11,color:C.s400}}>
                    Added {t.createdAt}
                    {t.passages?.length>0&&` · ${t.passages.length} passage${t.passages.length>1?"s":""} · ${t.passages.reduce((n,p)=>n+(p.questions?.length||0),0)} questions`}
                    {t.sections?.length>0&&` · ${t.sections.length} section${t.sections.length>1?"s":""} · ${t.sections.reduce((n,s)=>n+(s.questions?.length||0),0)} questions`}
                    {t.questions?.length>0&&` · ${t.questions.length} questions`}
                    {t.task1Image&&" · 📷 image"}
                  </div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>loadForEdit(t)} style={{background:C.brandL,color:C.brand,border:"none",borderRadius:8,padding:"5px 14px",fontSize:12,cursor:"pointer",fontWeight:700}}>✏ Edit</button>
                  <button onClick={()=>deleteTest(t.id)} style={{background:C.roseL,color:C.rose,border:"none",borderRadius:8,padding:"5px 14px",fontSize:12,cursor:"pointer",fontWeight:700}}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Type tabs */}
      <div style={{display:"flex",gap:0,borderBottom:`2px solid ${C.s200}`,marginBottom:24}}>
        {["Reading","Writing","Listening"].map(t=>(
          <button key={t} onClick={()=>setActiveType(t)} style={{
            padding:"10px 24px",border:"none",cursor:"pointer",fontSize:13,fontWeight:activeType===t?700:500,
            color:activeType===t?typeColor(t):C.s400,
            borderBottom:`2px solid ${activeType===t?typeColor(t):"transparent"}`,
            background:"transparent",marginBottom:-2,transition:"all .15s",
          }}>{t==="Reading"?"📖 Reading":t==="Writing"?"✍️ Writing":"🎧 Listening"}</button>
        ))}
      </div>

      {/* ── READING ── */}
      {activeType==="Reading"&&(
        <div>
          <div style={{...cardStyle({padding:"16px 20px",marginBottom:20,display:"flex",gap:14,alignItems:"center"})}}>
            <div style={{flex:1}}>
              <label style={labelStyle}>Test Name *</label>
              <input value={rTitle} onChange={e=>setRTitle(e.target.value)}
                placeholder="e.g. Cambridge 18 Test 1 Reading" style={inputStyle} autoFocus/>
            </div>
            <div style={{paddingTop:22}}>
              <span style={{fontSize:12,color:C.s400}}>{rPassages.length}/3 passages</span>
            </div>
          </div>

          {rPassages.map((p,i)=>{
            const qStart=rPassages.slice(0,i).reduce((s,pp)=>s+(pp.questions||[]).length,0)+1;
            return <PassageCard key={p.id} passage={p} idx={i} total={rPassages.length}
              onUpdate={(k,v)=>updatePassage(p.id,k,v)}
              onDelete={()=>deletePassage(p.id)}
              setQuestions={setPassageQ(p.id)}
              qStart={qStart}/>;
          })}

          <div style={{display:"flex",gap:12,alignItems:"center",marginTop:8,marginBottom:8}}>
            {rPassages.length<3&&(
              <button onClick={addPassage} style={{...btnStyle("secondary"),fontSize:13,padding:"9px 20px"}}>
                + Add Passage {rPassages.length+1}
              </button>
            )}
          </div>

          <div style={{display:"flex",gap:14,alignItems:"center",marginTop:16,paddingTop:16,borderTop:`1px solid ${C.s200}`}}>
            <button onClick={saveReading} disabled={!rTitle.trim()||!rPassages.some(p=>p.text.trim())}
              style={btnStyle("primary",!rTitle.trim()||!rPassages.some(p=>p.text.trim()))}>
              💾 Save Reading Section
            </button>
            {saved&&<span style={{color:C.teal,fontWeight:700,fontSize:14}}>✓ Saved!</span>}
          </div>
        </div>
      )}

      {/* ── WRITING ── */}
      {activeType==="Writing"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>

          {/* ── Task 1 Panel ── */}
          <div style={{...cardStyle({padding:24,borderTop:`4px solid ${C.brand}`})}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
              <span style={{...tagStyle(),fontSize:12}}>Task 1</span>
              <span style={{fontSize:14,fontWeight:800,color:C.s900}}>Academic Writing Task 1</span>
            </div>
            <p style={{fontSize:12,color:C.s400,marginBottom:18,lineHeight:1.6}}>
              Describe a chart, graph, map or diagram. Min 150 words.<br/>
              Each Task 1 is saved separately and can be mixed with any Task 2.
            </p>

            <div style={{marginBottom:14}}>
              <label style={labelStyle}>Task 1 Name</label>
              <input value={wT1Title} onChange={e=>setWT1Title(e.target.value)}
                placeholder="e.g. Cambridge 18 T1 – Bar Chart" style={inputStyle}/>
            </div>

            <div style={{marginBottom:14}}>
              <label style={labelStyle}>Prompt *</label>
              <textarea value={wT1Prompt} onChange={e=>setWT1Prompt(e.target.value)}
                placeholder="The chart below shows… Summarise the information by selecting and reporting the main features and make comparisons where relevant. Write at least 150 words."
                rows={5} style={{...inputStyle,resize:"vertical",lineHeight:1.75,borderRadius:10}}/>
            </div>

            <div style={{marginBottom:18}}>
              <label style={labelStyle}>Chart / Graph / Diagram Image</label>
              {wT1Image?(
                <div style={{position:"relative",display:"inline-block",maxWidth:"100%"}}>
                  <img src={wT1Image} alt="Task 1" style={{maxWidth:"100%",maxHeight:200,borderRadius:10,border:`1px solid ${C.s200}`,display:"block"}}/>
                  <button onClick={()=>setWT1Image(null)} style={{position:"absolute",top:8,right:8,background:"rgba(0,0,0,.65)",color:"#fff",border:"none",borderRadius:6,padding:"4px 10px",fontSize:12,cursor:"pointer",fontWeight:700}}>✕</button>
                </div>
              ):(
                <label style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,border:`2px dashed ${C.brand}40`,borderRadius:12,padding:"22px 16px",cursor:"pointer",background:C.brandL}}>
                  <span style={{fontSize:28}}>🖼️</span>
                  <span style={{fontSize:12,color:C.s600,fontWeight:600}}>Upload chart / graph / diagram</span>
                  <span style={{fontSize:11,color:C.s400}}>PNG · JPG · GIF</span>
                  <input type="file" accept="image/*" onChange={e=>{
                    const f=e.target.files?.[0]; if(!f) return;
                    const r=new FileReader(); r.onload=ev=>setWT1Image(ev.target.result); r.readAsDataURL(f);
                  }} style={{display:"none"}}/>
                </label>
              )}
            </div>

            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <button onClick={saveWritingTask1} disabled={!wT1Prompt.trim()} style={btnStyle("primary",!wT1Prompt.trim())}>
                💾 Save Task 1
              </button>
              {wT1Saved&&<span style={{color:C.teal,fontWeight:700,fontSize:13}}>✓ Saved!</span>}
            </div>
          </div>

          {/* ── Task 2 Panel ── */}
          <div style={{...cardStyle({padding:24,borderTop:`4px solid ${C.violet}`})}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
              <span style={{...tagStyle(C.violet),fontSize:12}}>Task 2</span>
              <span style={{fontSize:14,fontWeight:800,color:C.s900}}>Academic Writing Task 2</span>
            </div>
            <p style={{fontSize:12,color:C.s400,marginBottom:18,lineHeight:1.6}}>
              Essay / discussion / argument question. Min 250 words.<br/>
              Each Task 2 is saved separately and can be mixed with any Task 1.
            </p>

            <div style={{marginBottom:14}}>
              <label style={labelStyle}>Task 2 Name</label>
              <input value={wT2Title} onChange={e=>setWT2Title(e.target.value)}
                placeholder="e.g. Cambridge 18 T2 – Education Essay" style={inputStyle}/>
            </div>

            <div style={{marginBottom:18}}>
              <label style={labelStyle}>Prompt *</label>
              <textarea value={wT2Prompt} onChange={e=>setWT2Prompt(e.target.value)}
                placeholder="Some people believe that… Others, however, think that…&#10;&#10;Discuss both views and give your own opinion.&#10;Write at least 250 words."
                rows={8} style={{...inputStyle,resize:"vertical",lineHeight:1.75,borderRadius:10}}/>
            </div>

            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <button onClick={saveWritingTask2} disabled={!wT2Prompt.trim()} style={btnStyle("secondary",!wT2Prompt.trim())}>
                💾 Save Task 2
              </button>
              {wT2Saved&&<span style={{color:C.teal,fontWeight:700,fontSize:13}}>✓ Saved!</span>}
            </div>
          </div>

        </div>
      )}

      {/* ── LISTENING ── */}
      {activeType==="Listening"&&(
        <div>
          <div style={{...cardStyle({padding:"16px 20px",marginBottom:20,display:"flex",gap:14,alignItems:"center"})}}>
            <div style={{flex:1}}>
              <label style={labelStyle}>Test Name *</label>
              <input value={lTitle} onChange={e=>setLTitle(e.target.value)}
                placeholder="e.g. Cambridge 18 Test 1 Listening" style={inputStyle} autoFocus/>
            </div>
            <div style={{paddingTop:22}}>
              <span style={{fontSize:12,color:C.s400}}>{lSections.length}/4 sections</span>
            </div>
          </div>

          {/* Listening Audio Upload */}
          <div style={{...cardStyle({padding:16,marginBottom:16,borderLeft:`4px solid ${C.amber}`})}}>
            <div style={{fontWeight:700,fontSize:13,color:C.s900,marginBottom:3}}>🎧 Listening Audio File</div>
            <div style={{fontSize:11,color:C.s400,marginBottom:10}}>Upload one MP3/WAV recording that plays for all candidates during this test. Shared across all sessions.</div>
            {lAudioUrl?(
              <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                <audio controls src={lAudioUrl} style={{flex:1,minWidth:200,height:34}}/>
                <button onClick={removeListeningAudio} style={{background:C.roseL,color:C.rose,border:"none",borderRadius:8,padding:"5px 12px",fontSize:11,cursor:"pointer",fontWeight:700}}>✕ Remove</button>
              </div>
            ):(
              <label style={{display:"inline-flex",alignItems:"center",gap:8,background:C.s100,border:`1.5px dashed ${C.s200}`,borderRadius:10,padding:"9px 18px",cursor:"pointer",fontSize:12,color:C.s600,fontWeight:600}}>
                {lAudioUploading?"Uploading…":"⬆ Upload Audio (MP3/WAV/M4A)"}
                <input type="file" accept="audio/*" onChange={uploadListeningAudio} style={{display:"none"}} disabled={lAudioUploading}/>
              </label>
            )}
          </div>

          {lSections.map((s,i)=>{
            const qStart=lSections.slice(0,i).reduce((sum,ss)=>sum+(ss.questions||[]).length,0)+1;
            return <SectionCard key={s.id} section={s} idx={i} total={lSections.length}
              onUpdate={(k,v)=>updateSection(s.id,k,v)}
              onDelete={()=>deleteSection(s.id)}
              setQuestions={setSectionQ(s.id)}
              qStart={qStart}/>;
          })}

          <div style={{display:"flex",gap:12,alignItems:"center",marginTop:8,marginBottom:8}}>
            {lSections.length<4&&(
              <button onClick={addSection} style={{...btnStyle("secondary"),fontSize:13,padding:"9px 20px"}}>
                + Add Section {lSections.length+1}
              </button>
            )}
          </div>

          <div style={{display:"flex",gap:14,alignItems:"center",marginTop:16,paddingTop:16,borderTop:`1px solid ${C.s200}`}}>
            <button onClick={saveListening} disabled={!lTitle.trim()} style={btnStyle("primary",!lTitle.trim())}>
              💾 Save Listening Section
            </button>
            {saved&&<span style={{color:C.teal,fontWeight:700,fontSize:14}}>✓ Saved!</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── HOME PAGE ─────────────────────────────────────────────────────────────────
function Home({ onStart, onAdmin }) {
  return (
    <div style={{minHeight:"calc(100vh - 64px)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 24px"}}>
      <div style={{maxWidth:680,width:"100%",textAlign:"center"}}>
        <div style={{...tagStyle(),marginBottom:20}}>Official IELTS Practice Format</div>
        <h1 style={{fontSize:52,fontWeight:900,color:C.s900,letterSpacing:"-0.04em",lineHeight:1.1,marginBottom:16}}>
          IELTS Academic<br/>
          <span style={{background:"linear-gradient(135deg,#0BA870,#11CD87,#0BA870)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
            Practice Test
          </span>
        </h1>
        <p style={{color:C.s400,fontSize:16,lineHeight:1.8,maxWidth:480,margin:"0 auto 44px",fontWeight:500}}>
          Real IELTS questions. AI-powered writing feedback. Instant band scores. Speaking test booking.
        </p>

        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:14,maxWidth:560,margin:"0 auto 40px",textAlign:"left"}}>
          {[
            ["🎧","Listening","40 Questions"],
            ["📖","Reading","40 Questions"],
            ["✍️","Writing","2 Tasks · AI Evaluated"],
            ["🗓️","Speaking","Book with Examiner"],
          ].map(([icon,title,sub])=>(
            <div key={title} style={{...cardStyle({padding:20,transition:"all .2s",cursor:"default"})}}>
              <div style={{fontSize:26,marginBottom:10}}>{icon}</div>
              <div style={{fontWeight:800,color:C.s900,marginBottom:4,fontSize:14}}>{title}</div>
              <div style={{color:C.brand,fontSize:12,fontWeight:700}}>{sub}</div>
            </div>
          ))}
        </div>

        <button onClick={onStart} style={{
          ...btnStyle("primary"),
          padding:"15px 56px",fontSize:16,borderRadius:14,
          background:"linear-gradient(135deg,#0BA870,#11CD87)",
          boxShadow:"0 8px 24px rgba(17,205,135,.4)",
        }}>
          Begin Test →
        </button>
      </div>
    </div>
  );
}

// ── APP ROOT ──────────────────────────────────────────────────────────────────
const STEPS = ["Registration","Lobby","Listening","Reading","Writing","Speaking","Preparing","Results"];

// Peek at assignment status — only explicit admin assignments unlock the test
// (no side effects, no mark-used)
function peekAssignment(email) {
  const db = loadDB();
  const assignment = (db.assignments||[]).find(a=>a.email===email.trim().toLowerCase()&&!a.used);
  if(assignment) {
    const suite = (db.testSuites||[]).find(s=>s.id===assignment.suiteId);
    if(suite) return {status:"assigned", suiteName:suite.name};
  }
  return {status:"waiting"};
}

// Resolve and consume the suite assignment
function resolveTestSuite(email) {
  const db = loadDB();
  const assignment = (db.assignments||[]).find(a => a.email === email.trim().toLowerCase() && !a.used);
  if(assignment) {
    const suite = (db.testSuites||[]).find(s=>s.id===assignment.suiteId);
    if(suite) {
      dbSave("assignments", db.assignments.map(a=>a.id===assignment.id?{...a,used:true}:a));
      return buildSuiteData(suite, db);
    }
  }
  const published = (db.testSuites||[]).filter(s=>s.status==="published");
  if(published.length>0) {
    return buildSuiteData(published[Math.floor(Math.random()*published.length)], db);
  }
  return null;
}

function buildSuiteData(suite, db) {
  const tests = db.tests||[];
  // Merge Task 1 + Task 2 into a single writingData object for WritingTest
  const task1 = suite.writing1Id ? tests.find(t=>t.id===suite.writing1Id)||null : null;
  const task2 = suite.writing2Id ? tests.find(t=>t.id===suite.writing2Id)||null : null;
  // Backward compat: old suites with writingId that has both prompts in one object
  const legacyW = suite.writingId  ? tests.find(t=>t.id===suite.writingId)||null  : null;
  let writingData = null;
  if(task1||task2) {
    writingData = {
      id: (task1?.id||"")+"+"+(task2?.id||""),
      type:"Writing",
      title: [task1?.title,task2?.title].filter(Boolean).join(" · ") || "Writing",
      task1Prompt: task1?.task1Prompt||null,
      task1Image:  task1?.task1Image||null,
      task2Prompt: task2?.task2Prompt||null,
    };
  } else if(legacyW) {
    writingData = legacyW;
  }
  return {
    ...suite,
    readingData:   suite.readingId   ? tests.find(t=>t.id===suite.readingId)||null   : null,
    writingData,
    listeningData: suite.listeningId ? tests.find(t=>t.id===suite.listeningId)||null : null,
  };
}

// ── TEST LOBBY ────────────────────────────────────────────────────────────────
function TestLobby({ candidate, onStart }) {
  const [info, setInfo] = useState(()=>peekAssignment(candidate.email));
  const [lastChecked, setLastChecked] = useState(new Date());
  const [pulse, setPulse] = useState(false);

  const recheck = async () => {
    await reloadDB();
    const res = peekAssignment(candidate.email);
    setInfo(res);
    setLastChecked(new Date());
    setPulse(true);
    setTimeout(()=>setPulse(false), 600);
  };

  useEffect(()=>{
    if(info.status==="waiting") {
      const t = setInterval(recheck, 10000);
      return ()=>clearInterval(t);
    }
  }, [info.status]);

  const ready = info.status==="assigned"||info.status==="available";
  const statusColor = ready ? C.teal : C.amber;
  const statusBg    = ready ? C.tealL : C.amberL;

  return (
    <div style={{maxWidth:540,margin:"48px auto",padding:"0 24px"}}>
      <div style={{textAlign:"center",marginBottom:32}}>
        <div style={{width:64,height:64,borderRadius:20,background:C.brandL,margin:"0 auto 16px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28}}>
          👤
        </div>
        <h2 style={{fontSize:26,fontWeight:800,color:C.s900,letterSpacing:"-0.03em",marginBottom:6}}>
          Welcome, {candidate.name.split(" ")[0]}!
        </h2>
        <p style={{color:C.s400,fontSize:14}}>Registration complete · Checking test assignment…</p>
      </div>

      {/* Candidate info card */}
      <div style={{...cardStyle({padding:20,marginBottom:16})}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          {[["Name",candidate.name],["Email",candidate.email],["Phone",candidate.phone],["Test Type",candidate.testType]].map(([k,v])=>(
            <div key={k}>
              <div style={{fontSize:10,fontWeight:700,color:C.s400,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:3}}>{k}</div>
              <div style={{fontSize:13,fontWeight:600,color:C.s900}}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Status card */}
      <div style={{...cardStyle({padding:20,marginBottom:20,borderLeft:`4px solid ${statusColor}`}),background:statusBg}}>
        {ready ? (
          <div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
              <span style={{fontSize:20}}>✅</span>
              <span style={{fontWeight:800,fontSize:15,color:statusColor}}>
                {info.status==="assigned" ? `Test assigned: "${info.suiteName}"` : `${info.count} test${info.count>1?"s":""} available — one will be assigned randomly`}
              </span>
            </div>
            <p style={{fontSize:12,color:C.s600,margin:0}}>Your test is ready. Click <strong>Begin Test</strong> when you are prepared — the timer starts immediately.</p>
          </div>
        ) : (
          <div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
              <span style={{fontSize:20,animation:pulse?"":"none"}}>⏳</span>
              <span style={{fontWeight:800,fontSize:15,color:C.amber}}>Waiting for test assignment</span>
            </div>
            <p style={{fontSize:12,color:C.s600,margin:0}}>
              Your administrator has not yet assigned a test to <strong>{candidate.email}</strong>.<br/>
              This page auto-checks every 10 seconds. You can also use the button below.
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {ready ? (
          <button onClick={onStart} style={{
            ...btnStyle("primary"),width:"100%",padding:"15px",fontSize:15,borderRadius:12,
            background:"linear-gradient(135deg,#0BA870,#11CD87)",
            boxShadow:"0 8px 24px rgba(17,205,135,.4)",animation:"glow 2s ease-in-out infinite",
          }}>
            🚀 Begin Test →
          </button>
        ) : (
          <>
            <button onClick={recheck} style={{
              ...btnStyle("secondary"),width:"100%",padding:"13px",fontSize:14,borderRadius:12,
              borderColor: pulse?C.teal:C.brand, color: pulse?C.teal:C.brand,
            }}>
              {pulse?"✓ Checked!":"🔄 Check Again"}
            </button>
            <div style={{textAlign:"center",fontSize:11,color:C.s400}}>
              Last checked: {lastChecked.toLocaleTimeString()} · Auto-refreshes every 10s
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [dbReady, setDbReady]       = useState(false);
  const [view, setView]             = useState("home");
  const [step, setStep]             = useState(0);
  const [candidate, setCand]        = useState(null);
  const [activeSuite, setActiveSuite] = useState(null);
  const [scores, setScores]         = useState({});
  const [booking, setBooking]       = useState(null);
  const [exitConfirm, setExitConfirm] = useState(false);
  const [exitReason, setExitReason]   = useState("manual"); // "manual" | "fullscreen"
  const [breakNext, setBreakNext]     = useState(null); // {label, step} — shown between sections
  const [speakingExamDone, setSpeakingExamDone] = useState(false);
  const [speakingBand, setSpeakingBand] = useState(null);

  // Track whether we are programmatically exiting fullscreen (normal flow) vs user pressing Escape
  const programmaticExitRef = useRef(false);

  useEffect(()=>{ initDB().then(()=>setDbReady(true)); },[]);

  // Exit fullscreen when results screen is shown — must be before any conditional returns
  useEffect(()=>{
    if(step===7){ programmaticExitRef.current=true; exitFullscreen(); }
  },[step]);

  // Detect when user manually exits fullscreen during an active exam → show interrupt modal
  useEffect(()=>{
    const handler = () => {
      if(document.fullscreenElement) return; // still in fullscreen — ignore
      if(programmaticExitRef.current){ programmaticExitRef.current=false; return; } // we triggered it
      // Check if exam is active (steps 2–5, not on results or lobby)
      setStep(s=>{
        if(s>=2&&s<=5){ setExitReason("fullscreen"); setExitConfirm(true); }
        return s;
      });
    };
    document.addEventListener("fullscreenchange", handler);
    document.addEventListener("webkitfullscreenchange", handler);
    return ()=>{
      document.removeEventListener("fullscreenchange", handler);
      document.removeEventListener("webkitfullscreenchange", handler);
    };
  },[]);

  if(!dbReady) return (
    <div style={{minHeight:"100vh",background:"#0F172A",display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"center",gap:20}}>
      <div style={{width:48,height:48,border:"4px solid rgba(17,205,135,.2)",borderTopColor:"#11CD87",
        borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      <div style={{color:"rgba(255,255,255,.5)",fontSize:14,fontWeight:600}}>Loading platform…</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // After registration form → go to lobby (step 1)
  const handleRegComplete = async (info) => {
    await dbPushNow("participants", {
      id: genId("REG"),
      candidate: info,
      status: "registered",
      registeredAt: new Date().toISOString(),
      timestamp: Date.now(),
      date: new Date().toLocaleDateString("en-GB"),
    });
    setCand(info);
    setStep(1);
  };

  // From lobby "Begin Test" → enter fullscreen ONCE for the whole exam → advance to listening
  const handleStartTest = () => {
    const suite = resolveTestSuite(candidate.email);
    setActiveSuite(suite);
    enterFullscreen();
    setStep(2);
  };

  // Confirm exit exam — exits fullscreen and resets everything
  const handleExitExam = () => {
    programmaticExitRef.current = true;
    exitFullscreen();
    setExitConfirm(false);
    setView("home");
    setStep(0);
    setCand(null);
    setActiveSuite(null);
    setScores({});
    setBooking(null);
    setBreakNext(null);
    setSpeakingExamDone(false);
    setSpeakingBand(null);
  };

  if(view==="admin") return <AdminDashboard onExit={()=>setView("home")}/>;

  // Is the exam actively running (steps 2–5 = Listening/Reading/Writing/Speaking, or on break)
  const examActive = view==="test" && (step>=2 && step<=5 || breakNext!==null);

  return (
    <div style={{minHeight:"100vh",background:C.bg}}>
      <TopBar onAdmin={()=>setView("admin")}/>

      {/* Exit Exam button is now inline in each SectionHeader */}

      {/* Exit confirmation modal */}
      {exitConfirm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.85)",zIndex:9999,
          display:"flex",alignItems:"center",justifyContent:"center",padding:24,backdropFilter:"blur(6px)"}}>
          <div style={{background:"#fff",borderRadius:20,padding:36,maxWidth:440,width:"100%",
            textAlign:"center",boxShadow:"0 24px 80px rgba(0,0,0,.5)",animation:"fadeUp .2s ease both"}}>
            {exitReason==="fullscreen"?(
              <>
                <div style={{fontSize:52,marginBottom:12}}>🚫</div>
                <h2 style={{fontSize:22,fontWeight:800,color:C.s900,marginBottom:10,letterSpacing:"-0.02em"}}>
                  Test Interrupted
                </h2>
                <p style={{fontSize:14,color:C.s600,lineHeight:1.7,marginBottom:24}}>
                  You exited full-screen mode.<br/>
                  <strong style={{color:C.rose}}>The exam must be taken in full-screen.</strong><br/>
                  Return to full-screen to continue, or exit the exam.
                </p>
              </>
            ):(
              <>
                <div style={{fontSize:48,marginBottom:16}}>⚠️</div>
                <h2 style={{fontSize:22,fontWeight:800,color:C.s900,marginBottom:10,letterSpacing:"-0.02em"}}>
                  Exit Exam?
                </h2>
                <p style={{fontSize:14,color:C.s600,lineHeight:1.7,marginBottom:28}}>
                  Are you sure you want to close the exam?<br/>
                  <strong style={{color:C.rose}}>Your progress will be lost</strong> and you will return to the home screen.
                </p>
              </>
            )}
            <div style={{display:"flex",gap:12}}>
              <button onClick={()=>{ setExitConfirm(false); if(exitReason==="fullscreen") enterFullscreen(); }} style={{
                flex:1,padding:"13px",borderRadius:12,border:`2px solid ${C.s200}`,
                background:"#fff",color:C.s800,fontSize:14,fontWeight:700,cursor:"pointer",
              }}>
                {exitReason==="fullscreen"?"↩ Return to Full-Screen":"← Continue Exam"}
              </button>
              <button onClick={handleExitExam} style={{
                flex:1,padding:"13px",borderRadius:12,border:"none",
                background:C.rose,color:"#fff",fontSize:14,fontWeight:800,cursor:"pointer",
              }}>
                Yes, Exit Exam
              </button>
            </div>
          </div>
        </div>
      )}

      {view==="home"&&<Home onStart={()=>setView("test")} onAdmin={()=>setView("admin")}/>}
      {view==="test"&&(
        <>
          <StepNav step={step} steps={STEPS}/>
          {step===0&&<Registration onNext={handleRegComplete}/>}
          {step===1&&candidate&&<TestLobby candidate={candidate} onStart={handleStartTest}/>}
          {/* Break screen between sections */}
          {breakNext&&(
            <BreakScreen nextSection={breakNext.label} onContinue={()=>{ setStep(breakNext.step); setBreakNext(null); }}/>
          )}
          {!breakNext&&step===2&&<ListeningTest testData={activeSuite?.listeningData} candidateInfo={candidate} onExit={()=>{setExitReason("manual");setExitConfirm(true);}} onComplete={r=>{setScores(s=>({...s,listening:r}));setBreakNext({label:"Reading Test",step:3});}}/>}
          {!breakNext&&step===3&&<ReadingTest   testData={activeSuite?.readingData}   candidateInfo={candidate} onExit={()=>{setExitReason("manual");setExitConfirm(true);}} onComplete={r=>{setScores(s=>({...s,reading:r})); setBreakNext({label:"Writing Test",step:4});}}/>}
          {!breakNext&&step===4&&<WritingTest   testData={activeSuite?.writingData}   candidateInfo={candidate} onExit={()=>{setExitReason("manual");setExitConfirm(true);}} onComplete={w=>{setScores(s=>({...s,writing:w}));  setStep(5);}}/>}
          {!breakNext&&step===5&&!speakingExamDone&&(()=>{
            const aiSpeakingOn = !!(loadDB().aiSpeakingEnabled);
            if(!aiSpeakingOn) { setTimeout(()=>setSpeakingExamDone(true),0); return null; }
            return (
              <SpeakingExam
                candidateInfo={candidate}
                onComplete={r=>{setSpeakingBand(r.speakingBand); setSpeakingExamDone(true);}}
                onSkip={()=>setSpeakingExamDone(true)}
              />
            );
          })()}
          {!breakNext&&step===5&&speakingExamDone&&(
            <SpeakingBooking candidateInfo={candidate} onComplete={b=>{setBooking(b);setStep(6);}}/>
          )}
          {/* Step 6: AI checks writing in background — "results on the way" screen */}
          {step===6&&scores.writing&&(
            <ResultsLoading
              writingTexts={scores.writing?.texts}
              writingTaskData={scores.writing?.taskData||activeSuite?.writingData}
              onComplete={aiResult=>{
                setScores(s=>({...s, writing:{...s.writing, band:aiResult.band, aiFeedback:aiResult.aiFeedback, aiDetection:aiResult.aiDetection}}));
                setStep(7);
              }}
            />
          )}
          {/* Step 7: Final results — always attempt to render if step===7 */}
          {step===7&&(
            <Results
              scores={{
                listening: scores.listening||{correct:0,total:40,answers:{},allQuestions:[]},
                reading:   scores.reading  ||{correct:0,total:40,answers:{},allQuestions:[]},
                writing:   scores.writing  ||{texts:{},taskData:null,band:null,aiFeedback:null,aiDetection:null},
              }}
              candidateInfo={candidate||{name:"Candidate",email:""}}
              booking={booking}
              suiteName={activeSuite?.name}
              suiteId={activeSuite?.id}
            />
          )}
        </>
      )}
    </div>
  );
}
