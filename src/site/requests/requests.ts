export {};

type GitHubLabel = { name?: string } | string;
type GitHubIssue = { number:number; title:string; state:"open"|"closed"; html_url:string; created_at:string; updated_at:string; user?:{login?:string}; labels:GitHubLabel[]; pull_request?:unknown };
type RequestStatus = "needs-triage"|"needs-info"|"intake-valid"|"authoring"|"patch-review"|"published"|"declined"|"closed";

const statusPriority:RequestStatus[]=["published","patch-review","authoring","intake-valid","needs-info","needs-triage","declined","closed"];
const statusCopy:Record<RequestStatus,string>={"needs-triage":"Needs triage","needs-info":"Needs information","intake-valid":"Accepted",authoring:"Authoring","patch-review":"Patch review",published:"Published",declined:"Declined",closed:"Closed"};
const grid=document.querySelector<HTMLElement>("#request-grid")!;
const empty=document.querySelector<HTMLElement>("#empty-state")!;
const errorState=document.querySelector<HTMLElement>("#error-state")!;
const filter=document.querySelector<HTMLSelectElement>("#status-filter")!;
const template=document.querySelector<HTMLTemplateElement>("#request-template")!;
const queueSummary=document.querySelector<HTMLElement>("#queue-summary")!;
let requests:GitHubIssue[]=[];

function labelNames(issue:GitHubIssue){return issue.labels.map((label)=>typeof label==="string"?label:label.name??"").filter(Boolean)}
function isSafePublicIssue(issue:GitHubIssue){if(!Number.isInteger(issue.number)||issue.number<1||typeof issue.title!=="string"||issue.title.length<1||issue.title.length>180||!Array.isArray(issue.labels)||!Number.isFinite(Date.parse(issue.updated_at)))return false;try{const url=new URL(issue.html_url);return url.protocol==="https:"&&url.hostname==="github.com"&&url.pathname===`/abbasaliii/patch-the-web/issues/${issue.number}`}catch{return false}}
function requestStatus(issue:GitHubIssue):RequestStatus{const labels=labelNames(issue);return statusPriority.find((status)=>labels.includes(status))??(issue.state==="closed"?"closed":"needs-triage")}
function relativeDate(value:string){const hours=Math.floor(Math.max(0,Date.now()-new Date(value).getTime())/3_600_000);if(hours<1)return"Updated recently";if(hours<24)return`Updated ${hours}h ago`;return`Updated ${Math.floor(hours/24)}d ago`}
function setText(root:ParentNode,selector:string,value:string){root.querySelector<HTMLElement>(selector)!.textContent=value}
function renderCard(issue:GitHubIssue){const fragment=template.content.cloneNode(true) as DocumentFragment;const status=requestStatus(issue);const statusElement=fragment.querySelector<HTMLElement>(".status")!;statusElement.textContent=statusCopy[status];statusElement.dataset.status=status;setText(fragment,".number",`#${issue.number}`);setText(fragment,"h3",issue.title.replace(/^\[Repair request\]\s*/i,""));setText(fragment,".meta",`Requested by ${issue.user?.login??"community member"}`);setText(fragment,".updated",relativeDate(issue.updated_at));const labels=fragment.querySelector<HTMLElement>(".labels")!;labelNames(issue).filter((label)=>label!=="repair-request").slice(0,4).forEach((label)=>{const chip=document.createElement("span");chip.textContent=label.replaceAll("-"," ");labels.append(chip)});const link=fragment.querySelector<HTMLAnchorElement>("a")!;link.href=issue.html_url;link.setAttribute("aria-label",`View public repair request ${issue.number}: ${issue.title}`);return fragment}
function render(){const selected=filter.value;const visible=requests.filter((issue)=>selected==="all"||requestStatus(issue)===selected);grid.replaceChildren(...visible.map(renderCard));grid.setAttribute("aria-busy","false");empty.hidden=visible.length>0;errorState.hidden=true}
function renderSummary(){const statuses=requests.map(requestStatus);document.querySelector<HTMLElement>("#open-count")!.textContent=String(requests.filter((request)=>request.state==="open").length);document.querySelector<HTMLElement>("#building-count")!.textContent=String(statuses.filter((status)=>status==="authoring"||status==="patch-review").length);document.querySelector<HTMLElement>("#published-count")!.textContent=String(statuses.filter((status)=>status==="published").length);queueSummary.setAttribute("aria-busy","false")}
async function load(){grid.setAttribute("aria-busy","true");errorState.hidden=true;try{const response=await fetch("https://api.github.com/repos/abbasaliii/patch-the-web/issues?state=all&labels=repair-request&per_page=100",{cache:"no-store"});if(!response.ok)throw new Error(`GitHub returned ${response.status}`);const result=await response.json() as unknown;if(!Array.isArray(result))throw new Error("Queue response was not a list");requests=(result as GitHubIssue[]).filter((issue)=>!issue.pull_request&&isSafePublicIssue(issue));renderSummary();render()}catch{grid.replaceChildren();grid.setAttribute("aria-busy","false");empty.hidden=true;errorState.hidden=false;queueSummary.setAttribute("aria-busy","false");["#open-count","#building-count","#published-count"].forEach((selector)=>{document.querySelector<HTMLElement>(selector)!.textContent="—"})}}
filter.addEventListener("change",render);document.querySelector("#retry")?.addEventListener("click",()=>void load());void load();
