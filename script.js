(() => {
  const STORAGE_KEY = "studysprint-v1";
  const $ = (id) => document.getElementById(id);
  const todayISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0,10); };
  const parseDate = (s) => { if (!s) return null; const [y,m,d] = s.split("-").map(Number); return new Date(y,m-1,d); };
  const dayDiff = (date) => { const a=parseDate(todayISO()), b=parseDate(date); return Math.round((b-a)/86400000); };
  const fmtDate = (date, opts={month:"short",day:"numeric",year:"numeric"}) => date ? parseDate(date).toLocaleDateString("en-US",opts) : "No date";
  const escapeHTML = (v="") => String(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const defaults = () => ({exams:[],tasks:[],theme:"light"});
  let state = loadState(), currentFilter = "all", toastTimer;
  function loadState(){try{const s=JSON.parse(localStorage.getItem(STORAGE_KEY));return s&&Array.isArray(s.exams)&&Array.isArray(s.tasks)?{...defaults(),...s}:defaults()}catch{return defaults()}}
  function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));render()}
  function notify(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove("show"),2500)}
  function daysLabel(n){if(n<0)return `${Math.abs(n)} day${Math.abs(n)===1?"":"s"} ago`;if(n===0)return "Today";if(n===1)return "Tomorrow";return `In ${n} days`}
  function examForSubject(subject){return state.exams.filter(e=>e.subject===subject&&dayDiff(e.date)>=0).sort((a,b)=>a.date.localeCompare(b.date))[0]}
  function taskPriorityScore(t){return ({high:3,medium:2,low:1}[t.priority]||1)}
  function smartScore(t){const ex=examForSubject(t.subject);const days=ex?Math.max(0,dayDiff(ex.date)):30;return taskPriorityScore(t)*3+(ex?Math.max(0,14-days)/2:0)+(t.date<=todayISO()?3:0)+(t.done?-100:0)}
  function render(){
    document.body.classList.toggle("dark",state.theme==="dark");
    $("datePill").textContent=new Date().toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
    $("todayLabel").textContent=new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"}).toUpperCase();
    $("year").textContent=new Date().getFullYear();
    const upcoming=state.exams.filter(e=>dayDiff(e.date)>=0).sort((a,b)=>a.date.localeCompare(b.date));
    const pending=state.tasks.filter(t=>!t.done), done=state.tasks.filter(t=>t.done), today=state.tasks.filter(t=>t.date===todayISO()&&!t.done);
    const pct=state.tasks.length?Math.round(done.length/state.tasks.length*100):0;
    $("statExams").textContent=upcoming.length;$("statTasks").textContent=pending.length;$("statDone").textContent=pct+"%";$("overallProgress").style.width=pct+"%";$("statToday").textContent=today.length;
    renderUpcoming(upcoming);renderToday(today);renderExams();renderTasks();renderPlanner();
    populateSubjectOptions();
  }
  function renderUpcoming(exams){
    const el=$("upcomingExams");
    if(!exams.length){el.innerHTML=`<div class="empty-mini"><p style="color:var(--muted);font-size:12px">No exams added yet. Add an exam to start your countdown.</p><button class="btn btn-primary" id="quickAddExam">＋ Add exam</button></div>`;$("quickAddExam").onclick=()=>openExam();return}
    el.innerHTML=exams.slice(0,4).map(e=>{const d=parseDate(e.date);return `<div class="exam-row"><div class="date-box"><b>${d.getDate()}</b><span>${d.toLocaleDateString("en-US",{month:"short"})}</span></div><div class="exam-info"><b>${escapeHTML(e.subject)}</b><small>${escapeHTML(e.note||"Exam")} · ${escapeHTML(e.time||"Time not set")}</small></div><div class="countdown">${escapeHTML(daysLabel(dayDiff(e.date)))}</div></div>`}).join("");
  }
  function renderToday(tasks){
    const el=$("todayTasks");
    if(!tasks.length){el.innerHTML=`<div style="padding:12px 0 20px;color:var(--muted);font-size:12px">Your day is open. Add a revision task to get started.</div>`;$("focusFooterText").textContent="A focused 25 minutes is a great start.";return}
    el.innerHTML=tasks.slice(0,4).map(t=>`<div class="task-mini"><button class="task-check" data-toggle="${t.id}" aria-label="Mark complete"></button><div class="task-mini-info"><b>${escapeHTML(t.title)}</b><small>${escapeHTML(t.subject)} · ${t.duration} min</small></div><span class="priority-dot ${t.priority}"></span></div>`).join("");
    $("focusFooterText").textContent=`${tasks.reduce((s,t)=>s+Number(t.duration||0),0)} minutes of planned focus today.`;
    el.querySelectorAll("[data-toggle]").forEach(b=>b.onclick=()=>toggleTask(b.dataset.toggle));
  }
  function renderExams(){
    const sorted=[...state.exams].sort((a,b)=>a.date.localeCompare(b.date)), el=$("allExams");
    $("noExams").classList.toggle("hidden",sorted.length>0);el.classList.toggle("hidden",!sorted.length);
    el.innerHTML=sorted.map(e=>{const d=dayDiff(e.date), past=d<0;const level={low:"Needs revision",medium:"In progress",high:"Prepared"}[e.level]||"In progress";const count=past?`${Math.abs(d)} days ago`:d===0?"Today":`${d} days left`;return `<article class="exam-card"><div class="exam-card-head"><div><h3>${escapeHTML(e.subject)}</h3><p>${escapeHTML(e.note||"Exam date set")} · ${escapeHTML(e.time||"09:00")}</p></div><div class="icon-actions"><button class="icon-btn" data-edit-exam="${e.id}" aria-label="Edit exam">✎</button><button class="icon-btn" data-delete-exam="${e.id}" aria-label="Delete exam">×</button></div></div><div class="exam-countdown"><strong>${past?"—":d}</strong><span>${past?count:(d===1?"day left":d===0?"exam day":"days until exam")}</span></div><div class="exam-meta"><span>${fmtDate(e.date,{weekday:"short",month:"short",day:"numeric",year:"numeric"})}</span><span class="level-badge ${e.level}">${level}</span></div></article>`}).join("");
    el.querySelectorAll("[data-edit-exam]").forEach(b=>b.onclick=()=>openExam(b.dataset.editExam));
    el.querySelectorAll("[data-delete-exam]").forEach(b=>b.onclick=()=>deleteExam(b.dataset.deleteExam));
  }
  function renderTasks(){
    let tasks=[...state.tasks];const sort=$("taskSort").value;
    if(currentFilter==="pending")tasks=tasks.filter(t=>!t.done);if(currentFilter==="done")tasks=tasks.filter(t=>t.done);
    tasks.sort((a,b)=>sort==="priority"?taskPriorityScore(b)-taskPriorityScore(a):sort==="subject"?a.subject.localeCompare(b.subject):a.date.localeCompare(b.date));
    const el=$("allTasks");$("noTasks").classList.toggle("hidden",tasks.length>0);el.classList.toggle("hidden",!tasks.length);
    el.innerHTML=tasks.map(t=>`<article class="task-card ${t.done?"completed":""}"><button class="task-check ${t.done?"checked":""}" data-toggle="${t.id}" aria-label="Toggle completion">${t.done?"✓":""}</button><div class="task-card-main"><div class="task-card-title">${escapeHTML(t.title)}</div><div class="task-card-meta"><span>${escapeHTML(t.subject)}</span><span>·</span><span>${fmtDate(t.date,{month:"short",day:"numeric"})}</span><span>·</span><span>${t.duration} min</span><span class="type-badge">${escapeHTML(t.type)}</span><span class="priority-badge ${t.priority}">${escapeHTML(t.priority)} priority</span></div></div><div class="task-card-actions"><button class="icon-btn" data-edit-task="${t.id}" aria-label="Edit task">✎</button><button class="icon-btn" data-delete-task="${t.id}" aria-label="Delete task">×</button></div></article>`).join("");
    el.querySelectorAll("[data-toggle]").forEach(b=>b.onclick=()=>toggleTask(b.dataset.toggle));
    el.querySelectorAll("[data-edit-task]").forEach(b=>b.onclick=()=>openTask(b.dataset.editTask));
    el.querySelectorAll("[data-delete-task]").forEach(b=>b.onclick=()=>deleteTask(b.dataset.deleteTask));
  }
  function renderPlanner(){
    const pending=state.tasks.filter(t=>!t.done).sort((a,b)=>smartScore(b)-smartScore(a));
    const next=[...state.exams].filter(e=>dayDiff(e.date)>=0).sort((a,b)=>a.date.localeCompare(b.date))[0];
    $("plannerSummary").textContent=next?`Your next exam is ${next.subject} ${daysLabel(dayDiff(next.date)).toLowerCase()}. Focus on high-priority unfinished topics first.`:"Add exam dates to make your revision recommendations more accurate.";
    const el=$("smartPlan");
    if(!pending.length){el.innerHTML=`<div class="empty-state"><span>✧</span><h3>Your smart plan is waiting</h3><p>Add unfinished revision tasks, then generate a prioritized plan.</p><button class="btn btn-primary" id="planAddTask">＋ Add revision task</button></div>`;$("planAddTask").onclick=()=>openTask();return}
    el.innerHTML=pending.map((t,i)=>{const ex=examForSubject(t.subject);const why=ex?`${daysLabel(dayDiff(ex.date))} until ${ex.subject} · ${t.priority} priority`:`${t.priority} priority · scheduled ${fmtDate(t.date,{month:"short",day:"numeric"})}`;return `<div class="plan-item"><div class="plan-rank">${String(i+1).padStart(2,"0")}</div><div class="plan-main"><b>${escapeHTML(t.title)}</b><p>${escapeHTML(t.subject)} · ${escapeHTML(why)}</p></div><div class="plan-side"><b>${t.duration} min</b><small>${escapeHTML(t.type)}</small></div><button class="btn btn-primary" data-plan-done="${t.id}">Start ✓</button></div>`}).join("");
    el.querySelectorAll("[data-plan-done]").forEach(b=>b.onclick=()=>{const t=state.tasks.find(x=>x.id===b.dataset.planDone);if(t){t.done=true;save();notify("Nice work — task completed!")}})
  }
  function populateSubjectOptions(){
    const current=$("taskSubject").value, subjects=[...new Set(state.exams.map(e=>e.subject))].sort();
    $("taskSubject").innerHTML='<option value="">Choose a subject</option>'+subjects.map(s=>`<option value="${escapeHTML(s)}">${escapeHTML(s)}</option>`).join("");
    if(current&&subjects.includes(current))$("taskSubject").value=current;
  }
  function openExam(id){
    $("examForm").reset();$("examId").value="";$("examModalTitle").textContent="Add an exam";$("examDate").min=todayISO();
    if(id){const e=state.exams.find(x=>x.id===id);if(!e)return;$("examId").value=e.id;$("examSubject").value=e.subject;$("examDate").value=e.date;$("examTime").value=e.time||"09:00";$("examNote").value=e.note||"";$("examLevel").value=e.level||"medium";$("examModalTitle").textContent="Edit exam"}
    $("examDialog").showModal();
  }
  function openTask(id){
    populateSubjectOptions();$("taskForm").reset();$("taskId").value="";$("taskDate").value=todayISO();$("taskModalTitle").textContent="Add revision task";$("taskDone").checked=false;
    if(id){const t=state.tasks.find(x=>x.id===id);if(!t)return;$("taskId").value=t.id;$("taskTitle").value=t.title;$("taskSubject").value=t.subject;$("taskDate").value=t.date;$("taskDuration").value=t.duration;$("taskPriority").value=t.priority;$("taskType").value=t.type;$("taskDone").checked=t.done;$("taskModalTitle").textContent="Edit revision task"}
    $("taskDialog").showModal();
  }
  function deleteExam(id){const e=state.exams.find(x=>x.id===id);if(!e||!confirm(`Delete the exam "${e.subject}"? Tasks linked to this subject will remain.`))return;state.exams=state.exams.filter(x=>x.id!==id);save();notify("Exam deleted.")}
  function deleteTask(id){const t=state.tasks.find(x=>x.id===id);if(!t||!confirm(`Delete "${t.title}"?`))return;state.tasks=state.tasks.filter(x=>x.id!==id);save();notify("Task deleted.")}
  function toggleTask(id){const t=state.tasks.find(x=>x.id===id);if(!t)return;t.done=!t.done;save();notify(t.done?"Task completed — great job!":"Task marked as to do.")}
  function setView(view){document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===`view-${view}`));document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===view));$("pageTitle").textContent=({dashboard:"Dashboard",exams:"My Exams",tasks:"Revision Tasks",planner:"Smart Planner"})[view]||"Dashboard";window.scrollTo({top:0,behavior:"smooth"})}
  document.querySelectorAll(".nav-item").forEach(b=>b.onclick=()=>setView(b.dataset.view));
  document.querySelectorAll("[data-goto]").forEach(b=>b.onclick=()=>setView(b.dataset.goto));
  $("themeToggle").onclick=()=>{state.theme=state.theme==="dark"?"light":"dark";localStorage.setItem(STORAGE_KEY,JSON.stringify(state));render()};
  $("addExamBtn").onclick=$("emptyAddExam").onclick=()=>openExam();
  $("addTaskBtn").onclick=$("heroAddTask").onclick=$("emptyAddTask").onclick=()=>openTask();
  $("generatePlan").onclick=()=>{renderPlanner();notify("Your revision priorities are updated.")};
  $("taskSort").onchange=renderTasks;
  document.querySelectorAll(".filter-tab").forEach(b=>b.onclick=()=>{currentFilter=b.dataset.filter;document.querySelectorAll(".filter-tab").forEach(x=>x.classList.toggle("active",x===b));renderTasks()});
  document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>$(b.dataset.close).close());
  $("examForm").onsubmit=e=>{e.preventDefault();const id=$("examId").value,exam={id:id||uid(),subject:$("examSubject").value.trim(),date:$("examDate").value,time:$("examTime").value,note:$("examNote").value.trim(),level:$("examLevel").value};if(!exam.subject||!exam.date)return;if(id)state.exams=state.exams.map(x=>x.id===id?exam:x);else state.exams.push(exam);$("examDialog").close();save();notify(id?"Exam updated.":"Exam added to your countdown.");};
  $("taskForm").onsubmit=e=>{e.preventDefault();const id=$("taskId").value,task={id:id||uid(),title:$("taskTitle").value.trim(),subject:$("taskSubject").value,date:$("taskDate").value,duration:Number($("taskDuration").value),priority:$("taskPriority").value,type:$("taskType").value,done:$("taskDone").checked};if(!task.title||!task.subject||!task.date)return;if(id)state.tasks=state.tasks.map(x=>x.id===id?task:x);else state.tasks.push(task);$("taskDialog").close();save();notify(id?"Task updated.":"Revision task added.");};
  $("resetData").onclick=()=>{if(!confirm("Reset all exams and revision tasks saved in this browser? This cannot be undone. Export or note your data first if you need it."))return;state=defaults();localStorage.removeItem(STORAGE_KEY);save();setView("dashboard");notify("All StudySprint data has been reset.")};
  // Seed a welcoming empty state; users add their own real exam data.
  render();
})();