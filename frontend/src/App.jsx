import { useEffect, useMemo, useState } from "react";
import { getReports, createReport, uploadImage, detectPothole } from "./api";
import HazardMap from "./components/HazardMap";
import "./App.css";

const NAV = [
  ["overview", "◫", "Overview"],
  ["map", "⌖", "Live hazard map"],
  ["reports", "▤", "Reports center"],
  ["create", "+", "Report an issue"],
  ["analytics", "▥", "Analytics"],
];

const priorityClass = (value) => (value || "Medium").toLowerCase();
const statusClass = (value) => (value || "Reported").toLowerCase().replace(/\s+/g, "-");

function Pill({ children, kind = "" }) {
  return <span className={`pill ${kind}`}>{children}</span>;
}

function Stat({ label, value, note, icon, color = "mint" }) {
  return <article className={`stat-card ${color}`}>
    <div className="stat-head"><span>{label}</span><b>{icon}</b></div>
    <strong className="stat-value">{value}</strong>
    <small>{note}</small>
  </article>;
}

export default function App() {
  const [page, setPage] = useState("overview");
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dark, setDark] = useState(true);
  const [mobileNav, setMobileNav] = useState(false);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("All priorities");
  const [statusFilter, setStatusFilter] = useState("All statuses");

  const [issue, setIssue] = useState("Large pothole");
  const [location, setLocation] = useState("");
  const [priority, setPriority] = useState("High");
  const [coords, setCoords] = useState(null);
  const [gpsMessage, setGpsMessage] = useState("");
  const [file, setFile] = useState(null);
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detection, setDetection] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadReports() {
    setLoading(true);
    setError("");
    try {
      const data = await getReports();
      setReports(Array.isArray(data) ? data : (data?.reports || []));
    } catch (e) {
      setError(e.message || "Unable to connect to CivicLens API.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getReports();
        if (alive) setReports(Array.isArray(data) ? data : (data?.reports || []));
      } catch (e) {
        if (alive) setError(e.message || "Unable to connect to CivicLens API.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const high = reports.filter(r => r.priority === "High").length;
  const progress = reports.filter(r => r.status === "In progress").length;
  const resolved = reports.filter(r => r.status === "Resolved").length;
  const aiCount = reports.filter(r => Number(r.pothole_count) > 0).length;
  const filtered = useMemo(() => reports.filter(r => {
    const q = search.toLowerCase().trim();
    const matches = !q || [r.id, r.issue, r.location, r.status].some(v => String(v || "").toLowerCase().includes(q));
    return matches && (priorityFilter === "All priorities" || (r.priority || "Medium") === priorityFilter)
      && (statusFilter === "All statuses" || (r.status || "Reported") === statusFilter);
  }), [reports, search, priorityFilter, statusFilter]);

  function go(id) {
    setPage(id); setMobileNav(false); setError(""); setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function captureGPS() {
    if (!navigator.geolocation) { setGpsMessage("This browser does not support GPS."); return; }
    setGpsMessage("Getting your location…");
    navigator.geolocation.getCurrentPosition(({ coords: c }) => {
      setCoords({ latitude: c.latitude, longitude: c.longitude });
      setGpsMessage(`Captured · ${c.latitude.toFixed(5)}, ${c.longitude.toFixed(5)}`);
    }, e => setGpsMessage(e.code === 1 ? "Location permission denied. You can continue without GPS." : "Could not get location. Try again."),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  }

  async function chooseFile(nextFile) {
    setFile(nextFile || null); setUploadedUrl(""); setDetection(null); setNotice("");
    if (!nextFile) return;
    setUploading(true); setError("");
    try {
      const result = await uploadImage(nextFile);
      setUploadedUrl(result.url || "");
      setNotice("Road photo uploaded.");
    } catch (e) { setError(e.message || "Image upload failed."); }
    finally { setUploading(false); }
  }

  async function runDetection() {
    if (!file) { setError("Choose a road image first."); return; }
    setDetecting(true); setError(""); setNotice("");
    try { setDetection(await detectPothole(file)); setNotice("AI analysis complete. Review the prediction before submitting."); }
    catch (e) { setError(e.message || "AI detection failed."); }
    finally { setDetecting(false); }
  }

  async function submitReport(e) {
    e.preventDefault(); setError(""); setNotice("");
    if (file && !detection) { setError("Run AI detection on your selected image before submitting."); return; }
    setSubmitting(true);
    const potholeItems = (detection?.detections || []).filter(d => String(d.label).toLowerCase().includes("pothole"));
    const confidence = potholeItems.length ? Math.max(...potholeItems.map(d => Number(d.confidence) || 0)) : null;
    try {
      const created = await createReport({
        issue, location, priority,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        image_url: uploadedUrl || null,
        annotated_url: detection?.annotated_url || null,
        pothole_count: detection?.pothole_count ?? 0,
        confidence,
      });
      setReports(old => [created, ...old]);
      setNotice(`Report ${created.id || ""} submitted successfully.`);
      setIssue("Large pothole"); setLocation(""); setPriority("Medium");
      setCoords(null); setGpsMessage(""); setFile(null); setUploadedUrl(""); setDetection(null);
      go("reports");
    } catch (e2) { setError(e2.message || "Unable to submit report."); }
    finally { setSubmitting(false); }
  }

  const title = NAV.find(n => n[0] === page)?.[2] || "Overview";
  const recent = reports.slice(0, 5);

  return <div className={`civic-app ${dark ? "dark" : "light"}`}>
    {mobileNav && <button className="scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
    <aside className={`sidebar ${mobileNav ? "mobile-open" : ""}`}>
      <button className="brand" onClick={() => go("overview")}><span className="brand-mark">⌁</span><span><strong>CivicLens</strong><small>SMART CITY INTELLIGENCE</small></span></button>
      <p className="nav-caption">WORKSPACE</p>
      <nav>{NAV.map(([id, icon, label]) => <button key={id} onClick={() => go(id)} className={`nav-link ${page === id ? "active" : ""}`}><span className="nav-icon">{icon}</span>{label}{id === "reports" && <small>{reports.length}</small>}</button>)}</nav>
      <div className="sidebar-bottom">
        <div className="system"><i /> <span><b>Systems operational</b><small>API connection enabled</small></span></div>
        <div className="profile"><span className="avatar">CL</span><span><b>Citizen workspace</b><small>Local demo environment</small></span><button title="Toggle theme" onClick={() => setDark(v => !v)}>{dark ? "☼" : "☾"}</button></div>
      </div>
    </aside>

    <main className="main">
      <header className="topbar">
        <div className="crumbs"><button className="mobile-toggle" onClick={() => setMobileNav(true)}>☰</button><span>CivicLens</span><b>/</b><strong>{title}</strong></div>
        <div className="top-actions"><span className="live"><i /> Live local data</span><button className="top-avatar" onClick={() => setNotice("CivicLens local demo workspace")}>C</button></div>
      </header>

      <div className="content">
        {error && <div className="alert error"><b>!</b><span>{error}</span><button onClick={() => setError("")}>×</button></div>}
        {notice && <div className="alert success"><b>✓</b><span>{notice}</span><button onClick={() => setNotice("")}>×</button></div>}

        {page === "overview" && <>
          <section className="hero">
            <div className="hero-copy"><div className="eyebrow"><i /> CITY SAFETY OVERVIEW</div><h1>Safer streets<br /><em>start here.</em></h1><p>Turn road hazards into actionable insights. Detect, report, and track issues in one place.</p><div className="hero-buttons"><button className="btn primary" onClick={() => go("create")}>＋ Report an issue <span>↗</span></button><button className="btn outline" onClick={() => go("map")}>Explore hazard map →</button></div></div>
            <div className="hero-visual"><div className="orbit o1"/><div className="orbit o2"/><span className="pin pin1">!</span><span className="pin pin2">⌖</span><span className="pin pin3">⌁</span><div className="float-card"><i/><span><b>Hazard intelligence</b><small>AI-assisted road monitoring</small></span><strong>↗</strong></div><small className="coords-label">31°38' N · 74°52' E</small></div>
          </section>
          <div className="section-head"><div><span className="eyebrow">YOUR CITY AT A GLANCE</span><h2>Safety snapshot</h2></div><button className="text-link" onClick={loadReports}>↻ Refresh data</button></div>
          <section className="stats-grid">
            <Stat label="Total reports" value={loading ? "—" : reports.length} note="All recorded civic issues" icon="▤"/>
            <Stat label="High priority" value={loading ? "—" : high} note="Needs attention" icon="⚑" color="amber"/>
            <Stat label="AI flagged reports" value={loading ? "—" : aiCount} note="With detected potholes" icon="⌁" color="violet"/>
            <Stat label="Resolved issues" value={loading ? "—" : resolved} note={`${progress} currently in progress`} icon="✓" color="blue"/>
          </section>
          <section className="overview-grid">
            <article className="panel map-panel"><div className="panel-head"><div><span className="eyebrow">GEO-SPATIAL VIEW</span><h3>Live hazard map</h3><p>Explore reported road issues by location.</p></div><button className="circle-btn" onClick={() => go("map")}>↗</button></div><div className="map-box"><HazardMap reports={reports}/></div><div className="map-foot"><span><i className="dot high-dot"/> High priority</span><span><i className="dot medium-dot"/> Medium</span><button className="text-link" onClick={() => go("map")}>Open full map →</button></div></article>
            <article className="panel recent-panel"><div className="panel-head"><div><span className="eyebrow">LATEST ACTIVITY</span><h3>Recent reports</h3><p>Newly submitted civic issues.</p></div><button className="text-link" onClick={() => go("reports")}>View all →</button></div>
              {loading ? <div className="empty">Loading reports…</div> : recent.length ? <div className="recent-list">{recent.map(r => <button className="recent-row" key={r.id} onClick={() => go("reports")}><span className={`issue-avatar ${priorityClass(r.priority)}`}>{String(r.issue || "R").slice(0,1).toUpperCase()}</span><span className="recent-info"><b>{r.issue}</b><small>⌖ {r.location}</small></span><span className="recent-side"><Pill kind={`p-${priorityClass(r.priority)}`}>{r.priority || "Medium"}</Pill><small>{r.id}</small></span></button>)}</div> : <div className="empty"><b>No reports yet</b><small>Create your first road issue.</small><button className="btn secondary" onClick={() => go("create")}>Create report</button></div>}
            </article>
          </section>
        </>}

        {page === "map" && <section className="page-view"><div className="page-heading"><div><span className="eyebrow">GEO-SPATIAL INTELLIGENCE</span><h1>Live hazard map</h1><p>Locate civic issues and inspect reported hazards across your area.</p></div><button className="btn primary" onClick={() => go("create")}>＋ Add report</button></div><div className="map-legend"><span><i className="dot high-dot"/> High priority</span><span><i className="dot medium-dot"/> Medium priority</span><span><i className="dot low-dot"/> Low priority</span><b>{reports.filter(r => r.latitude != null && r.longitude != null).length} GPS-tagged reports</b></div><div className="big-map"><HazardMap reports={reports}/></div><p className="hint">ⓘ Only reports with saved GPS coordinates can be pinned to the map.</p></section>}

        {page === "reports" && <section className="page-view"><div className="page-heading"><div><span className="eyebrow">CIVIC OPERATIONS</span><h1>Reports center</h1><p>Search, filter, and review every submitted road issue.</p></div><button className="btn primary" onClick={() => go("create")}>＋ New report</button></div><div className="filters"><label className="search"><span>⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search issue, location or ID…"/></label><select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}><option>All priorities</option><option>High</option><option>Medium</option><option>Low</option></select><select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option>All statuses</option><option>Reported</option><option>In progress</option><option>Resolved</option></select><button className="btn secondary" onClick={loadReports}>↻ Refresh</button></div><article className="panel table-panel"><div className="table-top"><span>{filtered.length} reports found</span><span>Latest first</span></div>{loading ? <div className="empty">Loading reports…</div> : filtered.length ? <div className="table-scroll"><table><thead><tr><th>Report</th><th>Location</th><th>Priority</th><th>AI detection</th><th>Status</th><th>GPS</th></tr></thead><tbody>{filtered.map(r => <tr key={r.id}><td><div className="table-issue"><span className={`issue-avatar ${priorityClass(r.priority)}`}>{String(r.issue || "R").slice(0,1).toUpperCase()}</span><span><b>{r.issue}</b><small>{r.id}</small></span></div></td><td>{r.location}</td><td><Pill kind={`p-${priorityClass(r.priority)}`}>{r.priority || "Medium"}</Pill></td><td>{Number(r.pothole_count) > 0 ? <span className="ai-tag">⌁ {r.pothole_count} detected{r.confidence != null ? ` · ${(r.confidence*100).toFixed(0)}%` : ""}</span> : <small className="muted">Not analyzed</small>}</td><td><Pill kind={`s-${statusClass(r.status)}`}>{r.status || "Reported"}</Pill></td><td>{r.latitude != null && r.longitude != null ? <span className="gps-tag">● GPS</span> : "—"}</td></tr>)}</tbody></table></div> : <div className="empty"><b>No matching reports</b><small>Try changing your search or filters.</small><button className="text-link" onClick={() => {setSearch("");setPriorityFilter("All priorities");setStatusFilter("All statuses");}}>Clear filters</button></div>}</article></section>}

        {page === "create" && <section className="page-view"><div className="page-heading"><div><span className="eyebrow">COMMUNITY REPORTING</span><h1>Report a road issue</h1><p>Share a hazard with your community. AI can help identify potential potholes.</p></div><span className="ai-label">✳ AI-assisted reporting</span></div>
          <form className="create-grid" onSubmit={submitReport}><div className="create-main">
            <article className="panel form-panel"><div className="step-head"><span>01</span><div><h3>Issue details</h3><p>Tell us what needs attention.</p></div></div><div className="form-fields"><label>Issue type<select value={issue} onChange={e => setIssue(e.target.value)}><option>Large pothole</option><option>Damaged road surface</option><option>Open manhole</option><option>Road cracks</option><option>Waterlogging</option><option>Damaged footpath</option></select></label><label>Priority<select value={priority} onChange={e => setPriority(e.target.value)}><option>Low</option><option>Medium</option><option>High</option></select></label><label className="wide">Location or landmark<input value={location} onChange={e => setLocation(e.target.value)} minLength={2} maxLength={200} placeholder="e.g. Majitha Road, near the bus stop" required/></label></div><div className="gps-box"><span className="gps-icon">⌖</span><span><b>Pinpoint the location</b><small>{gpsMessage || "Capture GPS coordinates to show this report on the map."}</small></span><button type="button" className="btn secondary" onClick={captureGPS}>Use my GPS</button></div></article>
            <article className="panel form-panel"><div className="step-head"><span>02</span><div><h3>Road photo & AI analysis</h3><p>A clear photo helps the model identify possible hazards.</p></div></div><label className="drop-zone"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => chooseFile(e.target.files?.[0])}/>{file ? <><span className="upload-symbol">✓</span><b>{file.name}</b><small>{uploading ? "Uploading…" : uploadedUrl ? "Uploaded successfully" : "Selected"} · Click to replace</small></> : <><span className="upload-symbol">↑</span><b>Drop your road photo or <em>browse files</em></b><small>JPG, PNG or WEBP · Maximum 8 MB</small></>}</label>
              {uploadedUrl && <div className="uploaded-row"><img src={uploadedUrl} alt="Uploaded road issue"/><span><b>Photo uploaded</b><small>Ready for AI analysis</small></span><strong>✓</strong></div>}
              <button type="button" className="btn ai-button" disabled={!file || uploading || detecting} onClick={runDetection}>{detecting ? "◌ Analyzing image…" : "✳ Analyze with AI →"}</button>
              {detection && <div className="detection"><div className="detection-title"><span>✳</span><div><b>AI analysis complete</b><small>Roboflow hosted inference</small></div><Pill kind="s-Resolved">Complete</Pill></div><div className="detection-stats"><div><small>Potholes detected</small><b>{detection.pothole_count}</b></div><div><small>Objects detected</small><b>{detection.detection_count}</b></div><div><small>Max confidence</small><b>{(() => {const p=(detection.detections||[]).filter(d=>String(d.label).toLowerCase().includes("pothole"));return p.length?`${(Math.max(...p.map(d=>Number(d.confidence)||0))*100).toFixed(1)}%`:"—";})()}</b></div></div>{detection.annotated_url && <img className="annotated" src={detection.annotated_url} alt="AI annotated image"/>}<small className="disclaimer">AI predictions can be wrong. Review the image before submitting.</small></div>}
            </article>
          </div><aside className="create-side"><article className="panel submit-card"><span className="submit-symbol">↗</span><h3>Ready to submit?</h3><p>Review your details and send this report to CivicLens.</p><div className="review-line"><span>Issue type</span><b>{issue}</b></div><div className="review-line"><span>Priority</span><Pill kind={`p-${priorityClass(priority)}`}>{priority}</Pill></div><div className="review-line"><span>GPS location</span><b>{coords ? "Captured ✓" : "Not added"}</b></div><div className="review-line"><span>AI analysis</span><b>{detection ? "Complete ✓" : "Optional"}</b></div><button className="btn primary full" type="submit" disabled={submitting || uploading}>{submitting ? "Submitting…" : "Submit civic report →"}</button><small className="fineprint">Submit accurate information to help your community.</small></article><div className="tip"><b>✦ Make your report count</b><p>Capture the hazard clearly, include a nearby landmark, and add GPS for better location accuracy.</p></div></aside></form></section>}

        {page === "analytics" && <section className="page-view"><div className="page-heading"><div><span className="eyebrow">DATA & INSIGHTS</span><h1>Safety analytics</h1><p>Live statistics calculated from reports returned by your API.</p></div><button className="btn secondary" onClick={loadReports}>↻ Refresh data</button></div><section className="stats-grid"><Stat label="Total reports" value={reports.length} note="All recorded issues" icon="▤"/><Stat label="High priority" value={high} note="Needs attention" icon="⚑" color="amber"/><Stat label="AI flagged" value={aiCount} note="Saved AI findings" icon="⌁" color="violet"/><Stat label="Resolved" value={resolved} note="Marked resolved" icon="✓" color="blue"/></section><div className="analytics-grid"><article className="panel analytics-panel"><div className="panel-head"><div><span className="eyebrow">REPORT DISTRIBUTION</span><h3>Priority breakdown</h3><p>Reports by submitted priority.</p></div></div>{["High","Medium","Low"].map(level=>{const count=reports.filter(r=>(r.priority||"Medium")===level).length;const pct=reports.length?Math.round(count/reports.length*100):0;return <div className="bar-row" key={level}><div><span>{level}</span><b>{count}</b></div><div className="bar-track"><i className={`bar-${level.toLowerCase()}`} style={{width:`${pct}%`}}/></div><small>{pct}% of reports</small></div>})}</article><article className="panel analytics-panel"><div className="panel-head"><div><span className="eyebrow">WORKFLOW STATUS</span><h3>Resolution progress</h3><p>Current report status.</p></div></div>{[["Reported",reports.filter(r=>!r.status||r.status==="Reported").length],["In progress",progress],["Resolved",resolved]].map(([label,count])=><div className="workflow-row" key={label}><span className={`workflow-dot ${statusClass(label)}`}/><span>{label}</span><b>{count}</b><small>{reports.length?Math.round(count/reports.length*100):0}%</small></div>)}<p className="muted note">These numbers reflect live API data, not sample statistics.</p></article></div><article className="panel locations-panel"><div className="panel-head"><div><span className="eyebrow">LOCATION INSIGHTS</span><h3>Most reported locations</h3></div></div>{Object.entries(reports.reduce((acc,r)=>{const k=r.location||"Unknown";acc[k]=(acc[k]||0)+1;return acc;},{})).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,count],i)=><div className="location-row" key={name}><span>{String(i+1).padStart(2,"0")}</span><b>{name}</b><div className="location-track"><i style={{width:`${Math.max(8,count/Math.max(1,reports.length)*100)}%`}}/></div><strong>{count}</strong></div>)}</article></section>}

        <footer className="footer"><span>© 2026 CivicLens</span><span><i/> Civic safety intelligence · Prototype</span><button onClick={() => go("overview")}>Back to overview ↑</button></footer>
      </div>
    </main>
  </div>;
}