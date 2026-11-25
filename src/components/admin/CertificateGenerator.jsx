import { useState, useRef, useEffect } from "react";
import { Award, Download, Printer, RefreshCw, ChevronDown } from "lucide-react";

const AD = {
  blue:"#2D5DDC", blueLt:"#EBF0FF",
  bg:"#EEEFF1", surface:"#FCFCFC", border:"#E2E6EA",
  text:"#151313", sub:"#64748B", muted:"#94A3B8",
  red:"#EF4444", redLt:"#FEE2E2",
  green:"#10B981", greenLt:"#D1FAE5",
};

const CEFR_LEVELS = ["A1","A2","B1","B2","C1","C2"];
const CEFR_LABELS = {
  A1: "Beginner",
  A2: "Elementary",
  B1: "Intermediate",
  B2: "Upper Intermediate",
  C1: "Advanced",
  C2: "Mastery",
};
const CEFR_SKILLS = {
  A1: "basic listening, reading, writing, and speaking",
  A2: "elementary communication across listening, reading, writing, and speaking",
  B1: "independent use in listening, reading, writing, and speaking",
  B2: "advanced competence in reading, writing, listening, and speaking",
  C1: "proficient use across reading, writing, listening, and speaking",
  C2: "mastery-level fluency in reading, writing, listening, and speaking",
};

function genCertId() {
  return Math.floor(10000000 + Math.random() * 89999999).toString();
}

function buildCertHtml({ name, level, date, certId }) {
  const levelLabel = CEFR_LABELS[level] || level;
  const skills = CEFR_SKILLS[level] || "reading, writing, listening, speaking";
  const dateStr = date || new Date().toLocaleDateString("en-GB", { month:"long", year:"numeric" });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Certificate — ${name}</title>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:794px;height:1123px;overflow:hidden;background:#fff}
  body{font-family:'Montserrat',sans-serif;color:#151313;position:relative}

  .page{
    width:794px;height:1123px;
    background:#fff;
    position:relative;overflow:hidden;
  }

  /* ── Dot grids ─────────────────────────────────────────────────── */
  .dots-tr{position:absolute;top:28px;right:28px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
  .dots-bl{position:absolute;bottom:148px;left:34px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
  .dot{width:5px;height:5px;border-radius:50%;background:#151313;opacity:.18}

  /* ── Dark corner blobs ─────────────────────────────────────────── */
  .blob-tl{
    position:absolute;top:0;left:0;width:220px;height:220px;
    background:#151313;
    border-radius:0 0 55% 0;
    clip-path:ellipse(55% 55% at 0 0);
  }
  .blob-bottom{
    position:absolute;bottom:0;left:0;right:0;height:138px;
    background:#151313;
    border-radius:60% 80% 0 0 / 50% 60% 0 0;
  }

  /* ── Blue circles ──────────────────────────────────────────────── */
  .circle-mid{
    position:absolute;top:118px;left:52px;
    width:62px;height:62px;border-radius:50%;
    background:#2D5DDC;
  }
  .circle-sm{
    position:absolute;top:48px;left:28px;
    width:36px;height:36px;border-radius:50%;
    background:#2D5DDC;opacity:.7;
  }
  .circle-br{
    position:absolute;bottom:52px;right:40px;
    width:72px;height:72px;border-radius:50%;
    background:#2D5DDC;
  }

  /* ── Brand header ──────────────────────────────────────────────── */
  .brand{
    position:absolute;top:32px;left:50%;transform:translateX(-50%);
    text-align:center;
  }
  .brand-name{
    font-size:16px;font-weight:800;color:#151313;
    letter-spacing:.08em;text-transform:uppercase;
    border-bottom:2.5px solid #2D5DDC;padding-bottom:3px;
  }

  /* ── Main content ──────────────────────────────────────────────── */
  .content{
    position:absolute;
    top:140px;left:0;right:0;
    text-align:center;
    padding:0 60px;
  }
  .cert-word{
    font-size:88px;font-weight:900;color:#151313;
    letter-spacing:-.02em;line-height:1;
    text-transform:uppercase;
  }
  .cert-sub{
    font-size:16px;font-weight:700;color:#151313;
    letter-spacing:.18em;text-transform:uppercase;
    margin-top:6px;
  }
  .certify-label{
    font-size:12px;font-weight:500;color:#94A3B8;
    letter-spacing:.12em;text-transform:uppercase;
    margin-top:18px;
  }
  .student-name{
    font-size:38px;font-weight:900;color:#2D5DDC;
    text-transform:uppercase;letter-spacing:.04em;
    margin-top:14px;line-height:1.1;
  }
  .name-line{
    width:100%;height:2px;background:#151313;
    margin:16px 0 20px;
  }
  .body-text{
    font-size:14px;font-weight:500;color:#151313;
    line-height:1.75;max-width:520px;margin:0 auto;
  }
  .body-text strong{font-weight:800}

  /* ── Signature section ─────────────────────────────────────────── */
  .sig-section{
    position:absolute;bottom:158px;left:60px;
    display:flex;align-items:flex-end;gap:0;
  }
  .sig-block{}
  .sig-name{font-size:14px;font-weight:800;color:#151313}
  .sig-role{font-size:11px;color:#64748B;font-weight:500;margin-top:1px}
  .sig-line{
    width:150px;height:1.5px;background:#151313;
    margin-bottom:4px;margin-left:60px;
  }

  /* ── Bottom info ───────────────────────────────────────────────── */
  .bottom-info{
    position:absolute;bottom:36px;right:46px;
    text-align:right;
  }
  .bottom-info .info-row{
    font-size:13px;font-weight:600;color:#fff;
    line-height:1.6;
  }
  .bottom-info .info-row span{color:#2D5DDC;font-weight:800}

  /* ── Print button ──────────────────────────────────────────────── */
  .no-print{
    position:fixed;bottom:20px;left:50%;transform:translateX(-50%);
    background:#2D5DDC;color:#fff;border:none;border-radius:10px;
    padding:12px 32px;font-size:14px;font-weight:700;cursor:pointer;
    font-family:'Montserrat',sans-serif;
    box-shadow:0 4px 20px rgba(45,93,220,.4);
    z-index:999;
  }
  @media print{
    .no-print{display:none!important}
    html,body{width:210mm;height:297mm}
    .page{width:210mm;height:297mm}
  }
</style>
</head>
<body>
<div class="page">

  <!-- Dark blobs -->
  <div class="blob-tl"></div>
  <div class="blob-bottom"></div>

  <!-- Blue circles -->
  <div class="circle-sm"></div>
  <div class="circle-mid"></div>
  <div class="circle-br"></div>

  <!-- Dot grids -->
  <div class="dots-tr">
    ${Array(27).fill('<div class="dot"></div>').join("")}
  </div>
  <div class="dots-bl">
    ${Array(21).fill('<div class="dot"></div>').join("")}
  </div>

  <!-- Brand -->
  <div class="brand">
    <div class="brand-name">Lingvo Connect</div>
  </div>

  <!-- Main content -->
  <div class="content">
    <div class="cert-word">Certificate</div>
    <div class="cert-sub">of English Proficiency</div>
    <div class="certify-label">This is to certify that</div>
    <div class="student-name">${name || "Student Name"}</div>
    <div class="name-line"></div>
    <p class="body-text">
      Has been assessed by Lingvo Connect and is confirmed to have
      proficiency in the English language at the
      <strong>CEFR ${level} — ${levelLabel}</strong> level.
      This certification verifies ${levelLabel.toLowerCase()} competence in:<br/>
      <strong>${skills}.</strong>
    </p>
  </div>

  <!-- Signature -->
  <div class="sig-section">
    <div class="sig-block">
      <div class="sig-name">Sirush Vardazaryan</div>
      <div class="sig-role">Founder and CEO of Lingvo Connect</div>
    </div>
    <div class="sig-line"></div>
  </div>

  <!-- Bottom info -->
  <div class="bottom-info">
    <div class="info-row">Date: ${dateStr}</div>
    <div class="info-row">Certificate ID: <span>${certId}</span></div>
  </div>

</div>

<button class="no-print" onclick="window.print()">Save as PDF</button>
</body>
</html>`;
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function CertificateGenerator() {
  const [name,    setName]    = useState("");
  const [level,   setLevel]   = useState("B2");
  const [date,    setDate]    = useState(() => new Date().toLocaleDateString("en-GB",{month:"long",year:"numeric"}));
  const [certId,  setCertId]  = useState(() => genCertId());
  const [preview, setPreview] = useState(false);
  const iframeRef = useRef(null);

  const html = buildCertHtml({ name, level, date, certId });

  const handlePrint = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.print();
    }
  };

  const handleNewId = () => setCertId(genCertId());

  const card = { background:AD.surface, borderRadius:16, border:`1px solid ${AD.border}` };
  const inp  = { display:"block",width:"100%",boxSizing:"border-box",padding:"10px 13px",borderRadius:8,border:`1px solid ${AD.border}`,fontSize:13,color:AD.text,background:"#fff",outline:"none",fontFamily:"inherit" };
  const lbl  = { display:"block",fontSize:11,fontWeight:700,color:AD.sub,marginBottom:5,marginTop:14,textTransform:"uppercase",letterSpacing:"0.07em" };

  return (
    <div style={{ display:"flex", gap:24, alignItems:"flex-start", maxWidth:1200 }}>

      {/* ── Form panel ──────────────────────────────────────────────────────── */}
      <div style={{ width:300, flexShrink:0 }}>
        <div style={{ marginBottom:20 }}>
          <h1 style={{ fontSize:20,fontWeight:800,color:AD.text,margin:0,letterSpacing:"-.03em" }}>
            Certificate Generator
          </h1>
          <p style={{ fontSize:13,color:AD.muted,margin:"4px 0 0" }}>
            Fill in details and download a digital certificate.
          </p>
        </div>

        <div style={{ ...card, padding:"20px 22px" }}>

          <label style={lbl}>Student Name</label>
          <input
            style={inp}
            value={name}
            onChange={e=>setName(e.target.value)}
            placeholder="e.g. Mariam Khachatryan"
          />

          <label style={lbl}>CEFR Level</label>
          <div style={{ position:"relative" }}>
            <select
              style={{ ...inp, appearance:"none", paddingRight:36, cursor:"pointer" }}
              value={level}
              onChange={e=>setLevel(e.target.value)}
            >
              {CEFR_LEVELS.map(l=>(
                <option key={l} value={l}>{l} — {CEFR_LABELS[l]}</option>
              ))}
            </select>
            <ChevronDown size={14} color={AD.muted} style={{ position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",pointerEvents:"none" }}/>
          </div>

          <label style={lbl}>Date</label>
          <input
            style={inp}
            value={date}
            onChange={e=>setDate(e.target.value)}
            placeholder="e.g. November 2026"
          />

          <label style={lbl}>Certificate ID</label>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <input
              style={{ ...inp, flex:1 }}
              value={certId}
              onChange={e=>setCertId(e.target.value)}
            />
            <button
              onClick={handleNewId}
              title="Generate new ID"
              style={{ padding:"10px 11px",borderRadius:8,border:`1px solid ${AD.border}`,background:"#fff",cursor:"pointer",display:"flex",alignItems:"center",flexShrink:0 }}
            >
              <RefreshCw size={14} color={AD.sub}/>
            </button>
          </div>

          {/* Level badge */}
          <div style={{ marginTop:18, padding:"12px 14px", background:AD.blueLt, borderRadius:10, border:`1px solid ${AD.blue}22` }}>
            <div style={{ fontSize:11,fontWeight:700,color:AD.blue,letterSpacing:".06em",textTransform:"uppercase",marginBottom:4 }}>
              {level} — {CEFR_LABELS[level]}
            </div>
            <div style={{ fontSize:12,color:AD.sub,lineHeight:1.5 }}>
              {CEFR_SKILLS[level]}
            </div>
          </div>

          {/* Actions */}
          <div style={{ marginTop:20, display:"flex", flexDirection:"column", gap:10 }}>
            <button
              onClick={()=>setPreview(true)}
              disabled={!name.trim()}
              style={{
                display:"flex",alignItems:"center",justifyContent:"center",gap:8,
                padding:"11px 0",borderRadius:10,border:"none",
                background: name.trim() ? AD.blue : AD.border,
                color: name.trim() ? "#fff" : AD.muted,
                fontWeight:700,fontSize:14,cursor:name.trim()?"pointer":"not-allowed",
                fontFamily:"inherit",transition:"all .15s",
              }}
            >
              <Award size={16}/>
              Preview Certificate
            </button>

            {preview && (
              <button
                onClick={handlePrint}
                style={{
                  display:"flex",alignItems:"center",justifyContent:"center",gap:8,
                  padding:"11px 0",borderRadius:10,
                  border:`1px solid ${AD.blue}`,
                  background:"transparent",color:AD.blue,
                  fontWeight:700,fontSize:14,cursor:"pointer",
                  fontFamily:"inherit",
                }}
              >
                <Download size={16}/>
                Download PDF
              </button>
            )}
          </div>
        </div>

        {/* Help note */}
        <div style={{ marginTop:12,padding:"10px 14px",background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:10 }}>
          <p style={{ fontSize:12,color:"#92400E",lineHeight:1.6,margin:0 }}>
            <strong>Tip:</strong> Click "Download PDF", then in the print dialog choose <em>Save as PDF</em> to export.
          </p>
        </div>
      </div>

      {/* ── Certificate Preview ─────────────────────────────────────────────── */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{
          ...card,
          padding:24,
          display:"flex",flexDirection:"column",
          alignItems:"center",
          background:AD.bg,
          minHeight:600,
        }}>
          {!preview ? (
            <div style={{
              display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
              minHeight:500,gap:16,color:AD.muted,
            }}>
              <Award size={56} color={AD.border}/>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:16,fontWeight:700,color:AD.sub,marginBottom:4 }}>
                  Certificate Preview
                </div>
                <div style={{ fontSize:13 }}>
                  Fill in the student name and click Preview.
                </div>
              </div>
            </div>
          ) : (
            <>
              <div style={{
                display:"flex",alignItems:"center",justifyContent:"space-between",
                width:"100%",marginBottom:16,
              }}>
                <span style={{ fontSize:13,fontWeight:600,color:AD.sub }}>
                  Preview — {name}
                </span>
                <button
                  onClick={handlePrint}
                  style={{
                    display:"flex",alignItems:"center",gap:6,
                    padding:"7px 16px",borderRadius:8,border:"none",
                    background:AD.blue,color:"#fff",
                    fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit",
                  }}
                >
                  <Printer size={13}/> Print / Save PDF
                </button>
              </div>

              {/* Certificate iframe */}
              <div style={{
                width:"100%",
                boxShadow:"0 8px 40px rgba(0,0,0,.18)",
                borderRadius:4,overflow:"hidden",
              }}>
                <iframe
                  ref={iframeRef}
                  srcDoc={html}
                  style={{
                    width:"100%",
                    height: "calc((100vw - 380px) * 1.414)",
                    maxHeight:900,
                    border:"none",display:"block",
                  }}
                  title="Certificate Preview"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
