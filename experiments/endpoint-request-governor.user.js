// ==UserScript==
// @name         Endpoint Request Governor — experiment
// @namespace    tab-network-governor
// @version      0.3.0-experimental
// @description  Experimental per-route background throttler.
// @match        http://*/*
// @match        https://*/*
// @run-at       document-start
// @grant        none
// ==/UserScript==
(()=>{'use strict';const RULES=[/* {name:'list',pattern:/\/api\/history(?:\?|$)/,gapMs:5000} */];if(!RULES.length)return;const originalFetch=window.fetch.bind(window),pending=new Map();let chain=Promise.resolve();const sleep=ms=>new Promise(r=>setTimeout(r,ms));function classify(input,init){const method=String(init?.method||(typeof input!=='string'?input?.method:null)||'GET').toUpperCase();if(method!=='GET'&&method!=='HEAD')return null;let url;try{url=new URL(typeof input==='string'?input:input.url,location.href)}catch{return null}const rule=RULES.find(r=>r.pattern.test(url.pathname+url.search));return rule?{rule,key:`${method} ${url.href}`}:null}window.fetch=function(input,init){const hit=classify(input,init);if(!hit||document.visibilityState==='visible')return originalFetch(input,init);if(pending.has(hit.key))return pending.get(hit.key).then(r=>r.clone());const task=chain.then(async()=>{await sleep(hit.rule.gapMs);return originalFetch(input,init)});chain=task.then(()=>undefined,()=>undefined);pending.set(hit.key,task);task.finally(()=>pending.delete(hit.key));return task.then(r=>r.clone())}})();
