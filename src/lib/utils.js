// ── HELPERS ───────────────────────────────────────────────────────────────────
export const pad2    = n => String(n).padStart(2,"0");
export const fmtTime = s => `${pad2(Math.floor(s/60))}:${pad2(s%60)}`;
// countWords: only count real words (3+ chars, has letters) — avoids single symbols triggering AI
export const countWords = t => t.trim().split(/\s+/).filter(w => w.length >= 3 && /[a-zA-Z]/.test(w)).length;

// ── OFFICIAL IELTS BAND SCORE TABLES ─────────────────────────────────────────
// Scores are scaled to /40 equivalent before lookup (supports custom-length tests)
// Source: official IELTS score conversion charts (Cambridge / British Council)

// ── LISTENING: Official IELTS band conversion ─────────────────────────────────
// 39-40=9.0 | 37-38=8.5 | 35-36=8.0 | 32-34=7.5 | 30-31=7.0 | 26-29=6.5
// 23-25=6.0 | 18-22=5.5 | 16-17=5.0 | 13-15=4.5 | 10-12=4.0 | 8-9=3.5 …
export function listeningBand(c, t) {
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
export function readingBand(c, t) {
  const s = t > 0 ? Math.round(c / t * 40) : 0;
  if(s>=39)return 9.0; if(s>=37)return 8.5; if(s>=35)return 8.0;
  if(s>=33)return 7.5; if(s>=30)return 7.0; if(s>=27)return 6.5;
  if(s>=23)return 6.0; if(s>=19)return 5.5; if(s>=15)return 5.0;
  if(s>=13)return 4.5; if(s>=10)return 4.0; if(s>=8) return 3.5;
  if(s>=6) return 3.0; if(s>=4) return 2.5; if(s>=2) return 2.0;
  if(s>=1) return 1.5; return 0.0;
}

// Overall band: average of all four skills, rounded to nearest 0.5
export const overallBand = bs => Math.round(bs.reduce((a,b)=>a+b,0)/bs.length*2)/2;

export const bandLabel = b => b>=8.5?"Expert User":b>=7.5?"Very Good User":b>=6.5?"Competent User":b>=5.5?"Modest User":b>=4?"Limited User":"Extremely Limited";
export const bandColor = b => {
  // Import C lazily to avoid circular dependency — we need these color values
  const teal  = "#0D9488";
  const brand = "#11CD87";
  const amber = "#D97706";
  const rose  = "#E11D48";
  return b>=7.5?teal:b>=6?brand:b>=5?amber:rose;
};
export const bandBg    = b => {
  const tealL  = "#CCFBF1";
  const brandL = "#E6FAF4";
  const amberL = "#FEF3C7";
  const roseL  = "#FFE4E6";
  return b>=7.5?tealL:b>=6?brandL:b>=5?amberL:roseL;
};
