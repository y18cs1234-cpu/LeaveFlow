/*
  LeaveFlow demo frontend.
  1) Create a Supabase project.
  2) Paste your Project URL and anon/publishable key below.
  3) Run supabase-setup.sql in the Supabase SQL Editor.
  Never put a service_role key in browser code.
*/
const SUPABASE_URL = "YOUR_SUPABASE_PROJECT_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY";

let supabaseClient = null;
let currentUser = null;
let currentProfile = null;

const $ = (id) => document.getElementById(id);
const authView = $("auth-view");
const appView = $("app-view");

function configured() {
  return SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("YOUR_") &&
    SUPABASE_ANON_KEY.length > 20 && !SUPABASE_ANON_KEY.includes("YOUR_");
}
function showMessage(id, message, success=false) {
  const el = $(id); el.textContent = message; el.classList.toggle("success", success);
}
function showAuth() {
  authView.classList.remove("hidden"); appView.classList.add("hidden");
  $("user-area").classList.add("hidden");
}
function showApp() {
  authView.classList.add("hidden"); appView.classList.remove("hidden");
  $("user-area").classList.remove("hidden");
}
function dateLabel(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"});
}
function escapeHTML(value="") {
  return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function setRolePanels(role) {
  $("employee-panel").classList.toggle("hidden", role !== "employee");
  $("manager-panel").classList.toggle("hidden", role !== "manager");
  $("hr-panel").classList.toggle("hidden", role !== "hr_admin");
  $("role-label").textContent = role === "hr_admin" ? "HR ADMIN WORKSPACE" : `${role.toUpperCase()} WORKSPACE`;
}
async function loadProfile() {
  const {data,error} = await supabaseClient.from("profiles").select("id,full_name,role").eq("id",currentUser.id).single();
  if (error) throw error;
  currentProfile = data;
  $("user-label").textContent = `${data.full_name} · ${data.role.replace("_"," ")}`;
  $("welcome-title").textContent = `Hello, ${data.full_name.split(" ")[0]}`;
  $("today-chip").textContent = new Date().toLocaleDateString(undefined,{weekday:"short",day:"numeric",month:"short",year:"numeric"});
  setRolePanels(data.role);
}
async function fetchRequests() {
  const {data,error} = await supabaseClient.from("leave_requests")
    .select("id,employee_id,leave_type,start_date,end_date,reason,status,review_note,created_at,profiles:profiles!leave_requests_employee_id_fkey(full_name,email)")
    .order("created_at",{ascending:false});
  if (error) throw error;
  return data || [];
}
function renderRequest(item, options={}) {
  const node = $("request-template").content.firstElementChild.cloneNode(true);
  const person = item.profiles?.full_name || item.profiles?.email || "Employee";
  node.querySelector(".request-person").textContent = options.showPerson ? person : item.leave_type;
  const status = node.querySelector(".status");
  status.textContent = item.status;
  status.classList.add(item.status);
  const days = Math.max(1, Math.round((new Date(item.end_date+"T00:00:00")-new Date(item.start_date+"T00:00:00"))/86400000)+1);
  node.querySelector(".request-meta").textContent =
    `${options.showPerson ? item.leave_type+" · " : ""}${dateLabel(item.start_date)} – ${dateLabel(item.end_date)} · ${days} calendar day(s)`;
  node.querySelector(".request-reason").textContent = `Reason: ${item.reason}`;
  const note = node.querySelector(".request-review-note");
  if (item.review_note) { note.textContent = `Review note: ${item.review_note}`; note.classList.remove("hidden"); }
  if (options.actions && item.status === "pending") {
    const actions = node.querySelector(".request-actions"); actions.classList.remove("hidden");
    node.querySelector(".approve-btn").addEventListener("click",()=>reviewRequest(item.id,"approved"));
    node.querySelector(".reject-btn").addEventListener("click",()=>reviewRequest(item.id,"rejected"));
  }
  return node;
}
function putEmpty(target, text) {
  $(target).innerHTML = `<div class="empty-state">${escapeHTML(text)}</div>`;
}
async function loadEmployee() {
  const items = await fetchRequests();
  const mine = items.filter(x=>x.employee_id===currentUser.id);
  $("pending-count").textContent = mine.filter(x=>x.status==="pending").length;
  $("approved-count").textContent = mine.filter(x=>x.status==="approved").length;
  const target = $("my-requests"); target.innerHTML = "";
  if (!mine.length) return putEmpty("my-requests","No leave requests yet. Submit your first request.");
  mine.forEach(x=>target.appendChild(renderRequest(x)));
}
async function loadManager() {
  const items = await fetchRequests();
  $("manager-pending-count").textContent = items.filter(x=>x.status==="pending").length;
  $("manager-approved-count").textContent = items.filter(x=>x.status==="approved").length;
  $("manager-rejected-count").textContent = items.filter(x=>x.status==="rejected").length;
  const target = $("approval-queue"); target.innerHTML = "";
  if (!items.length) return putEmpty("approval-queue","There are no leave requests.");
  items.forEach(x=>target.appendChild(renderRequest(x,{showPerson:true,actions:true})));
}
async function loadHR() {
  const items = await fetchRequests();
  $("hr-total-count").textContent = items.length;
  $("hr-pending-count").textContent = items.filter(x=>x.status==="pending").length;
  $("hr-approved-count").textContent = items.filter(x=>x.status==="approved").length;
  const target = $("hr-requests"); target.innerHTML = "";
  if (!items.length) return putEmpty("hr-requests","There are no leave requests.");
  items.forEach(x=>target.appendChild(renderRequest(x,{showPerson:true})));
}
async function refreshWorkspace() {
  try {
    if (currentProfile.role==="employee") await loadEmployee();
    if (currentProfile.role==="manager") await loadManager();
    if (currentProfile.role==="hr_admin") await loadHR();
  } catch (e) { alert(`Could not load data: ${e.message}`); }
}
async function reviewRequest(id,status) {
  const note = prompt(`Optional note for this ${status} decision:`) || "";
  const {error} = await supabaseClient.from("leave_requests")
    .update({status,review_note:note,reviewed_by:currentUser.id,reviewed_at:new Date().toISOString()})
    .eq("id",id).eq("status","pending");
  if (error) return alert(`Could not update request: ${error.message}`);
  await refreshWorkspace();
}
async function startSession(session) {
  currentUser = session?.user || null;
  if (!currentUser) { currentProfile=null; showAuth(); return; }
  try {
    await loadProfile();
    showApp();
    await refreshWorkspace();
  } catch(e) {
    showAuth();
    showMessage("auth-message",`Your profile is not ready. Check the database setup: ${e.message}`);
  }
}

document.querySelectorAll("[data-auth-tab]").forEach(btn=>btn.addEventListener("click",()=>{
  document.querySelectorAll("[data-auth-tab]").forEach(x=>x.classList.toggle("active",x===btn));
  $("login-form").classList.toggle("hidden",btn.dataset.authTab!=="login");
  $("signup-form").classList.toggle("hidden",btn.dataset.authTab!=="signup");
  showMessage("auth-message","");
}));
$("login-form").addEventListener("submit",async e=>{
  e.preventDefault(); showMessage("auth-message","Signing in…");
  const {data,error}=await supabaseClient.auth.signInWithPassword({email:$("login-email").value.trim(),password:$("login-password").value});
  if(error) return showMessage("auth-message",error.message);
  await startSession(data.session);
});
$("signup-form").addEventListener("submit",async e=>{
  e.preventDefault(); showMessage("auth-message","Creating your account…");
  const name=$("signup-name").value.trim();
  const {data,error}=await supabaseClient.auth.signUp({
    email:$("signup-email").value.trim(),password:$("signup-password").value,
    options:{data:{full_name:name}}
  });
  if(error) return showMessage("auth-message",error.message);
  if(data.session) await startSession(data.session);
  else showMessage("auth-message","Account created. Check your email to confirm it, then sign in.",true);
});
$("logout-btn").addEventListener("click",async()=>{await supabaseClient.auth.signOut();});
$("leave-form").addEventListener("submit",async e=>{
  e.preventDefault(); showMessage("leave-message","Submitting request…");
  const start=$("start-date").value,end=$("end-date").value;
  if(end<start) return showMessage("leave-message","End date must be on or after the start date.");
  const {error}=await supabaseClient.from("leave_requests").insert({
    employee_id:currentUser.id,leave_type:$("leave-type").value,start_date:start,end_date:end,
    reason:$("leave-reason").value.trim()
  });
  if(error) return showMessage("leave-message",error.message);
  $("leave-form").reset(); showMessage("leave-message","Your leave request was submitted.",true);
  await refreshWorkspace();
});
$("refresh-employee").addEventListener("click",refreshWorkspace);
$("refresh-manager").addEventListener("click",refreshWorkspace);
$("refresh-hr").addEventListener("click",refreshWorkspace);

async function init() {
  if (!configured()) {
    $("setup-notice").classList.remove("hidden");
    $("setup-notice").textContent="Setup required: add your Supabase Project URL and anon/publishable key in app.js, then run supabase-setup.sql in your Supabase project. See README.md for step-by-step instructions.";
    $("auth-view").classList.remove("hidden");
    $("login-form").querySelector("button").disabled=true;
    $("signup-form").querySelector("button").disabled=true;
    return;
  }
  supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
  const {data:{session}}=await supabaseClient.auth.getSession();
  await startSession(session);
  supabaseClient.auth.onAuthStateChange((_event,session)=>{ setTimeout(()=>startSession(session),0); });
}
init();
