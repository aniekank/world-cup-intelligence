#!/usr/bin/env python3
"""
Generate the World Cup Intelligence QA suite from qa/test-cases.json:

  TEST-PLAN.md       — canonical, version-controlled checklist (repo root)
  qa/test-runner.html — interactive runner: pass/fail/blocked + notes, saved to
                        your browser, with one-click export of failures as
                        ready-to-paste BUGS.md entries.

Re-run after editing qa/test-cases.json:  python3 qa/_generate_test_suite.py
"""
import json, os, html, datetime, collections

REPO = "/Users/tobismith/Documents/WorldCup App"
CASES = os.path.join(REPO, "qa", "test-cases.json")

PRIO = {"p0": "high", "p1": "medium", "p2": "low", "critical": "high",
        "high": "high", "medium": "medium", "low": "low"}
PRIO_RANK = {"high": 0, "medium": 1, "low": 2}

# logical tester walk order; unlisted areas appended alphabetically
AREA_ORDER = [
    "Navigation", "Tournament Switcher", "Home", "Live", "Matches",
    "Standings", "Groups", "Rankings", "Bracket", "Predictions",
    "Teams", "Players", "Compare", "Insights", "Storylines", "Discoveries",
    "History", "Analytics", "Betting Edge", "Search", "Ask (NLQ)", "Globe",
    "Settings", "Favorites", "Guide", "Cross-cutting",
]

cases = json.load(open(CASES, encoding="utf-8"))
for c in cases:
    c["priority"] = PRIO.get(str(c.get("priority", "medium")).lower(), "medium")

def area_key(a):
    return (AREA_ORDER.index(a) if a in AREA_ORDER else len(AREA_ORDER) + 1, a)

areas = sorted({c["area"] for c in cases}, key=area_key)
by_area = collections.OrderedDict()
for a in areas:
    rows = [c for c in cases if c["area"] == a]
    rows.sort(key=lambda c: (PRIO_RANK[c["priority"]], c["id"]))
    by_area[a] = rows

total = len(cases)
prio_counts = collections.Counter(c["priority"] for c in cases)
today = datetime.date.today().isoformat()

# ---------------------------------------------------------------- TEST-PLAN.md
md = []
md.append("# World Cup Intelligence — Master Test Plan\n")
md.append(f"*Generated {today} · {total} test cases across {len(areas)} areas. "
          "Companion to `BUGS.md`. Regenerate with `python3 qa/_generate_test_suite.py`.*\n")
md.append("""
## How to use this

This is a **behavior** test plan, not a smoke test. The app's defining problem is that
**bugs return HTTP 200** — a page that loads is not a page that's correct. So every test's
**Expected** asserts specific on-screen *content* (text, counts, states), and you pass a test
only when the content is right.

**Workflow**
1. Work an area top-to-bottom. Set the **Precondition** first (active tournament, data source).
2. For each case, do the **Steps**, compare to **Expected**, and tick the box.
3. On any failure, open a `BUGS.md` entry and put the **test id** (e.g. `BET-07`) in its *Steps*
   line so the bug and its test stay linked. Then keep going — log, don't fix mid-sweep.
4. The `Guards` field names the bug-class a test protects against (often a prior `WC-0xx`).

> Prefer the interactive runner — open **`qa/test-runner.html`** in a browser. It saves your
> pass/fail/notes as you go and exports failures as ready-to-paste `BUGS.md` blocks.

**Highest-leverage first:** run the **Cross-cutting** matrices (tournament switching, the
~60s live-load sweep, timezone, degradation) — historically that's where the worst bugs hide.

**Status legend:** ☐ untested · ✅ pass · ❌ fail (→ log to BUGS.md) · 🚧 blocked
""")

md.append("## Coverage\n")
md.append("| Area | Cases | high / med / low |")
md.append("|------|------:|:----------------|")
for a in areas:
    rows = by_area[a]
    pc = collections.Counter(r["priority"] for r in rows)
    md.append(f"| {a} | {len(rows)} | {pc['high']} / {pc['medium']} / {pc['low']} |")
md.append(f"| **Total** | **{total}** | **{prio_counts['high']} / {prio_counts['medium']} / {prio_counts['low']}** |\n")

for a in areas:
    md.append(f"\n---\n\n## {a}  ·  {len(by_area[a])} cases\n")
    for c in by_area[a]:
        md.append(f"- [ ] **{c['id']}** · `{c['priority']}` — {c['title']}")
        if c.get("precondition"):
            md.append(f"  - **Precondition:** {c['precondition']}")
        steps = c.get("steps", [])
        if steps:
            md.append("  - **Steps:**")
            for i, s in enumerate(steps, 1):
                md.append(f"    {i}. {s}")
        md.append(f"  - **Expected:** {c['expected']}")
        if c.get("guards"):
            md.append(f"  - **Guards:** {c['guards']}")
        md.append("  - **Result:** ☐ pass ☐ fail ☐ blocked — _notes:_\n")

with open(os.path.join(REPO, "TEST-PLAN.md"), "w", encoding="utf-8") as f:
    f.write("\n".join(md))

# ------------------------------------------------------------- test-runner.html
TPL = r"""<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>WC Intelligence — QA Test Runner</title>
<style>
:root{--bg:#0a0b10;--panel:#12141c;--panel2:#171a24;--border:#262a38;--text:#dfe3ee;--muted:#888fa3;--bright:#f3f5fa;
--teal:#1fe5c4;--amber:#ffb01e;--red:#ff5470;--green:#5fd07a;--violet:#9b8cff;--blue:#4aa8ff;
--mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;--sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font-family:var(--sans);line-height:1.55}
header{position:sticky;top:0;z-index:10;background:rgba(10,11,16,.93);backdrop-filter:blur(8px);border-bottom:1px solid var(--border);padding:16px 22px}
.brand{font-family:var(--mono);font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--teal)}
h1{font-size:21px;margin:2px 0 10px;color:var(--bright)}
.bar{height:10px;border-radius:6px;background:var(--panel2);overflow:hidden;display:flex;border:1px solid var(--border)}
.bar i{display:block;height:100%}
.bar .pass{background:var(--green)}.bar .fail{background:var(--red)}.bar .blocked{background:var(--amber)}
.counts{display:flex;gap:14px;flex-wrap:wrap;margin-top:8px;font-size:13px;font-family:var(--mono)}
.counts b{color:var(--bright)}
.c-pass{color:var(--green)}.c-fail{color:var(--red)}.c-blocked{color:var(--amber)}.c-untested{color:var(--muted)}
.controls{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;align-items:center}
.controls input,.controls select{background:var(--panel2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:7px 10px;font-size:13px;font-family:var(--mono)}
.controls input[type=text]{min-width:200px;flex:1}
button{cursor:pointer;font-family:var(--mono)}
.btn{background:var(--panel2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:7px 12px;font-size:12px}
.btn:hover{border-color:var(--teal);color:var(--teal)}
main{max-width:1040px;margin:0 auto;padding:22px}
.area{margin:30px 0 0}
.area h2{font-size:16px;color:var(--bright);display:flex;align-items:center;gap:10px;border-top:1px solid var(--border);padding-top:18px}
.area h2 .ap{font-family:var(--mono);font-size:12px;color:var(--muted);margin-left:auto}
.t{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin:12px 0;border-left:3px solid var(--lc,var(--border))}
.t[data-status=pass]{--lc:var(--green)}.t[data-status=fail]{--lc:var(--red)}.t[data-status=blocked]{--lc:var(--amber)}
.th{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.tid{font-family:var(--mono);font-size:12px;color:var(--teal);font-weight:600}
.prio{font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:.06em;border:1px solid var(--border);border-radius:5px;padding:1px 7px}
.prio.high{color:var(--red);border-color:rgba(255,84,112,.4)}.prio.medium{color:var(--amber);border-color:rgba(255,176,30,.4)}.prio.low{color:var(--muted)}
.ttitle{color:var(--bright);font-weight:600;font-size:15px}
.meta{font-size:13.5px;margin:8px 0 0;color:var(--text)}
.meta b,.exp b{color:var(--muted);font-family:var(--mono);font-size:11px;text-transform:uppercase;letter-spacing:.05em}
ol.steps{margin:6px 0;padding-left:22px}ol.steps li{margin:3px 0;font-size:13.5px}
.exp{margin-top:8px;font-size:13.5px}
.exp .v{color:var(--bright)}
.guards{margin-top:7px;font-size:12px;color:var(--amber);font-family:var(--mono)}
.actions{display:flex;gap:7px;margin-top:12px;flex-wrap:wrap}
.actions button{border:1px solid var(--border);background:var(--panel2);color:var(--muted);border-radius:7px;padding:6px 14px;font-size:12px}
.actions button.on[data-s=pass]{background:var(--green);color:#06210f;border-color:var(--green)}
.actions button.on[data-s=fail]{background:var(--red);color:#2a0710;border-color:var(--red)}
.actions button.on[data-s=blocked]{background:var(--amber);color:#241800;border-color:var(--amber)}
textarea{width:100%;margin-top:9px;background:#0c0e15;border:1px solid var(--border);color:var(--text);border-radius:8px;padding:8px 10px;font-size:13px;font-family:var(--sans);resize:vertical;min-height:38px}
.hidden{display:none!important}
.toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--teal);color:#06210f;padding:10px 18px;border-radius:10px;font-family:var(--mono);font-size:13px;opacity:0;transition:opacity .2s;pointer-events:none}
.toast.show{opacity:1}
::-webkit-scrollbar{width:11px;height:11px}::-webkit-scrollbar-thumb{background:#2a3040;border-radius:6px;border:2px solid var(--bg)}
</style></head><body>
<header>
  <div class="brand">TASK Enterprises · QA</div>
  <h1>World Cup Intelligence — Test Runner</h1>
  <div class="bar" id="bar"></div>
  <div class="counts" id="counts"></div>
  <div class="controls">
    <input type="text" id="q" placeholder="filter by id, title, area…">
    <select id="fArea"><option value="">all areas</option></select>
    <select id="fStatus"><option value="">all statuses</option><option value="untested">untested</option><option value="pass">pass</option><option value="fail">fail</option><option value="blocked">blocked</option></select>
    <select id="fPrio"><option value="">all priorities</option><option value="high">high</option><option value="medium">medium</option><option value="low">low</option></select>
    <button class="btn" id="exportFail">⤓ Copy failures as BUGS.md</button>
    <button class="btn" id="exportJson">⤓ Export results (JSON)</button>
    <button class="btn" id="reset">Reset</button>
  </div>
</header>
<main id="list"></main>
<div class="toast" id="toast"></div>
<script>
const TESTS = __TESTS_JSON__;
const LS = "wc-qa-results-v1";
let results = {};
try { results = JSON.parse(localStorage.getItem(LS) || "{}"); } catch(e){ results = {}; }
const esc = s => String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const save = () => localStorage.setItem(LS, JSON.stringify(results));
const st = id => (results[id]||{}).status || "untested";

// build area filter options
const areas = [...new Set(TESTS.map(t=>t.area))];
const fArea=document.getElementById("fArea");
areas.forEach(a=>{const o=document.createElement("option");o.value=a;o.textContent=a;fArea.appendChild(o);});

function render(){
  const list=document.getElementById("list"); list.innerHTML="";
  let cur=null,sec=null;
  TESTS.forEach(t=>{
    if(t.area!==cur){cur=t.area;
      sec=document.createElement("div");sec.className="area";
      const tot=TESTS.filter(x=>x.area===cur).length;
      const done=TESTS.filter(x=>x.area===cur&&st(x.id)!=="untested").length;
      sec.innerHTML=`<h2>${esc(cur)}<span class="ap">${done}/${tot} tested</span></h2>`;
      list.appendChild(sec);
    }
    const s=st(t.id); const notes=(results[t.id]||{}).notes||"";
    const el=document.createElement("div"); el.className="t"; el.dataset.id=t.id; el.dataset.status=s;
    el.dataset.area=t.area; el.dataset.prio=t.priority;
    el.dataset.text=(t.id+" "+t.title+" "+t.area+" "+t.expected).toLowerCase();
    el.innerHTML=`<div class="th"><span class="tid">${esc(t.id)}</span><span class="prio ${t.priority}">${t.priority}</span><span class="ttitle">${esc(t.title)}</span></div>
      ${t.precondition?`<div class="meta"><b>Precondition</b> · ${esc(t.precondition)}</div>`:""}
      <ol class="steps">${(t.steps||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ol>
      <div class="exp"><b>Expected</b> · <span class="v">${esc(t.expected)}</span></div>
      ${t.guards?`<div class="guards">⛨ ${esc(t.guards)}</div>`:""}
      <div class="actions">
        <button data-s="pass" class="${s==="pass"?"on":""}">✓ Pass</button>
        <button data-s="fail" class="${s==="fail"?"on":""}">✗ Fail</button>
        <button data-s="blocked" class="${s==="blocked"?"on":""}">🚧 Blocked</button>
        <button data-s="untested" class="${s==="untested"?"on":""}">clear</button>
      </div>
      <textarea placeholder="notes — what actually happened (failures export to BUGS.md)">${esc(notes)}</textarea>`;
    el.querySelectorAll(".actions button").forEach(b=>b.onclick=()=>{
      const v=b.dataset.s;
      if(v==="untested"){delete results[t.id];} else {results[t.id]={status:v,notes:(results[t.id]||{}).notes||""};}
      save(); el.dataset.status=st(t.id);
      el.querySelectorAll(".actions button").forEach(x=>x.classList.toggle("on",x.dataset.s===st(t.id)));
      updateBar(); refreshSectionCounts(); applyFilters();
    });
    el.querySelector("textarea").oninput=e=>{
      if(!results[t.id])results[t.id]={status:"untested"};
      results[t.id].notes=e.target.value; save();
    };
    sec.appendChild(el);
  });
  updateBar();
}
function refreshSectionCounts(){
  document.querySelectorAll(".area").forEach(sec=>{
    const cards=[...sec.querySelectorAll(".t")];
    if(!cards.length)return;
    const area=cards[0].dataset.area;
    const tot=TESTS.filter(x=>x.area===area).length;
    const done=TESTS.filter(x=>x.area===area&&st(x.id)!=="untested").length;
    const ap=sec.querySelector(".ap"); if(ap)ap.textContent=`${done}/${tot} tested`;
  });
}
function updateBar(){
  const n={pass:0,fail:0,blocked:0,untested:0};
  TESTS.forEach(t=>n[st(t.id)]++);
  const tot=TESTS.length;
  document.getElementById("bar").innerHTML=
    `<i class="pass" style="width:${100*n.pass/tot}%"></i><i class="fail" style="width:${100*n.fail/tot}%"></i><i class="blocked" style="width:${100*n.blocked/tot}%"></i>`;
  const tested=n.pass+n.fail+n.blocked;
  document.getElementById("counts").innerHTML=
    `<span>Progress <b>${tested}/${tot}</b> (${Math.round(100*tested/tot)}%)</span>
     <span class="c-pass">✓ ${n.pass} pass</span><span class="c-fail">✗ ${n.fail} fail</span>
     <span class="c-blocked">🚧 ${n.blocked} blocked</span><span class="c-untested">☐ ${n.untested} left</span>`;
}
function applyFilters(){
  const q=document.getElementById("q").value.toLowerCase().trim();
  const fa=fArea.value, fs=document.getElementById("fStatus").value, fp=document.getElementById("fPrio").value;
  document.querySelectorAll(".t").forEach(el=>{
    const ok=(!q||el.dataset.text.includes(q))&&(!fa||el.dataset.area===fa)&&(!fs||st(el.dataset.id)===fs)&&(!fp||el.dataset.prio===fp);
    el.classList.toggle("hidden",!ok);
  });
  document.querySelectorAll(".area").forEach(sec=>{
    const any=[...sec.querySelectorAll(".t")].some(el=>!el.classList.contains("hidden"));
    sec.classList.toggle("hidden",!any);
  });
}
["q","fArea","fStatus","fPrio"].forEach(id=>document.getElementById(id).addEventListener("input",applyFilters));
function toast(m){const t=document.getElementById("toast");t.textContent=m;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),1600);}
document.getElementById("reset").onclick=()=>{if(confirm("Clear all results & notes?")){results={};save();render();applyFilters();}};
document.getElementById("exportJson").onclick=()=>{
  const out=TESTS.map(t=>({id:t.id,area:t.area,status:st(t.id),notes:(results[t.id]||{}).notes||""}));
  const blob=new Blob([JSON.stringify(out,null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="qa-results.json";a.click();
};
document.getElementById("exportFail").onclick=()=>{
  const fails=TESTS.filter(t=>st(t.id)==="fail");
  if(!fails.length){toast("No failures logged 🎉");return;}
  const blocks=fails.map(t=>{
    const notes=(results[t.id]||{}).notes||"";
    return `### WC-XXX — ${t.title} (${t.id})
- **Area:** ${t.area}
- **Severity:** ${t.priority==="high"?"high":t.priority==="medium"?"medium":"low"}
- **Steps:** ${(t.steps||[]).join(" → ")}
- **Expected:** ${t.expected}
- **Actual:** ${notes||"<fill in what happened>"}
- **Test:** ${t.id}
- **Status:** Open`;
  });
  const text=blocks.join("\n\n");
  navigator.clipboard.writeText(text).then(()=>toast(fails.length+" failure(s) copied — paste into BUGS.md"),
    ()=>{const blob=new Blob([text],{type:"text/markdown"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="failures-for-BUGS.md";a.click();});
};
render(); applyFilters();
</script></body></html>"""

html_out = TPL.replace("__TESTS_JSON__", json.dumps(cases, ensure_ascii=False))
with open(os.path.join(REPO, "qa", "test-runner.html"), "w", encoding="utf-8") as f:
    f.write(html_out)

print(f"Wrote TEST-PLAN.md ({total} cases) and qa/test-runner.html")
print("areas:", ", ".join(f"{a}({len(by_area[a])})" for a in areas))
