(function(root){
  const SCHEMA_VERSION=1;
  const STORAGE_KEY='omcat_learning_v1';
  const LEGACY_PROGRESS_KEY='omcat_prog_v2';
  const LEGACY_STATS_KEY='omcat_stats';
  const CONFIDENCE_LEVELS=['confident','somewhat','guess','no-idea'];
  const ERROR_CATEGORIES=['content-gap','misapplied-concept','passage-interpretation','missed-evidence','misread-question','fell-for-distractor','calculation-error','unit-dimensional-analysis','timing-rushing','changed-from-correct','other'];
  const MS_DAY=86400000;

  function now(){return Date.now();}
  function uid(prefix){
    const rand=Math.random().toString(36).slice(2,10);
    return `${prefix}-${now().toString(36)}-${rand}`;
  }
  function clone(value){
    if(value==null)return value;
    return JSON.parse(JSON.stringify(value));
  }
  function createEmptyState(){
    return {schemaVersion:SCHEMA_VERSION,createdAt:now(),updatedAt:now(),attempts:[],questionReviews:{},recoveryLog:[]};
  }
  function safeRead(storage,key){
    try{
      const raw=storage.getItem(key);
      if(!raw)return null;
      return JSON.parse(raw);
    }catch(err){
      return {__invalid:true,message:err&&err.message?err.message:String(err)};
    }
  }
  function safeWrite(storage,key,value){
    storage.setItem(key,JSON.stringify(value));
  }
  function validateState(value){
    if(!value||typeof value!=='object'||value.__invalid)return false;
    if(value.schemaVersion!==SCHEMA_VERSION)return false;
    if(!Array.isArray(value.attempts))return false;
    if(!value.questionReviews||typeof value.questionReviews!=='object')return false;
    return true;
  }
  function normalizeState(value){
    const state=createEmptyState();
    if(value&&typeof value==='object'){
      state.createdAt=Number(value.createdAt)||state.createdAt;
      state.updatedAt=Number(value.updatedAt)||state.updatedAt;
      state.attempts=Array.isArray(value.attempts)?value.attempts.filter(validateAttempt).map(normalizeAttempt):[];
      state.questionReviews=value.questionReviews&&typeof value.questionReviews==='object'?value.questionReviews:{};
      state.recoveryLog=Array.isArray(value.recoveryLog)?value.recoveryLog.slice(-20):[];
    }
    state.schemaVersion=SCHEMA_VERSION;
    return state;
  }
  function migrateState(value,legacyProgress){
    if(validateState(value))return normalizeState(value);
    const state=createEmptyState();
    if(value&&value.__invalid)state.recoveryLog.push({ts:now(),kind:'malformed-learning-state',message:value.message||'Could not parse learner state.'});
    if(legacyProgress&&typeof legacyProgress==='object'&&!legacyProgress.__invalid){
      Object.keys(legacyProgress).forEach(id=>{
        const p=legacyProgress[id]||{};
        if(!id||typeof p!=='object')return;
        state.questionReviews[id]={legacy:true,best:Number(p.best)||0,total:Number(p.total)||0,attempts:Number(p.attempts)||0,last:Number(p.ts)||Number(p.first)||null};
      });
      state.recoveryLog.push({ts:now(),kind:'legacy-summary-imported',message:'Imported existing quiz-level progress summaries without deleting the original data.'});
    }
    return state;
  }
  function loadState(storage){
    const current=safeRead(storage,STORAGE_KEY);
    const legacy=safeRead(storage,LEGACY_PROGRESS_KEY);
    const state=migrateState(current,legacy);
    if(!validateState(current))safeWrite(storage,STORAGE_KEY,state);
    return state;
  }
  function saveState(storage,state){
    const next=normalizeState(state);
    next.updatedAt=now();
    safeWrite(storage,STORAGE_KEY,next);
    return next;
  }
  function resetState(storage){
    const prior=loadState(storage);
    const next=createEmptyState();
    next.recoveryLog=(prior.recoveryLog||[]).concat({ts:now(),kind:'reset',message:'Learning events reset by user confirmation.'}).slice(-20);
    safeWrite(storage,STORAGE_KEY,next);
    return next;
  }
  function exportState(storage){
    return JSON.stringify(loadState(storage),null,2);
  }
  function importState(storage,json){
    let parsed;
    try{parsed=JSON.parse(json);}catch(err){return {ok:false,error:'Import file is not valid JSON.'};}
    if(!parsed||typeof parsed!=='object'||(parsed.schemaVersion!==SCHEMA_VERSION&&!Array.isArray(parsed.attempts)&&!parsed.questionReviews)){
      return {ok:false,error:'Import file does not match the Open-MCAT learner schema.'};
    }
    const normalized=normalizeState(parsed);
    if(!validateState(normalized))return {ok:false,error:'Import file does not match the Open-MCAT learner schema.'};
    saveState(storage,normalized);
    return {ok:true,state:normalized};
  }
  function validateAttempt(a){
    return !!a&&typeof a==='object'&&typeof a.attemptId==='string'&&typeof a.questionId==='string'&&Number.isFinite(a.timestamp);
  }
  function normalizeAttempt(a){
    return {
      attemptId:String(a.attemptId),
      questionId:String(a.questionId),
      timestamp:Number(a.timestamp)||now(),
      selectedAnswer:Number.isInteger(a.selectedAnswer)?a.selectedAnswer:null,
      correctAnswer:Number.isInteger(a.correctAnswer)?a.correctAnswer:null,
      correct:!!a.correct,
      responseTimeMs:Math.max(0,Number(a.responseTimeMs)||0),
      confidence:CONFIDENCE_LEVELS.includes(a.confidence)?a.confidence:'somewhat',
      changedAnswer:!!a.changedAnswer,
      originalSelectedAnswer:Number.isInteger(a.originalSelectedAnswer)?a.originalSelectedAnswer:null,
      mode:a.mode==='timed'?'timed':'review',
      section:a.section||'',
      contentCategory:a.contentCategory||'',
      testableIdea:a.testableIdea||'',
      conceptTags:Array.isArray(a.conceptTags)?a.conceptTags.map(String):[],
      prerequisiteConceptTags:Array.isArray(a.prerequisiteConceptTags)?a.prerequisiteConceptTags.map(String):[],
      difficulty:a.difficulty||'medium',
      errorClassification:ERROR_CATEGORIES.includes(a.errorClassification)?a.errorClassification:null,
      errorClassificationSuggested:!!a.errorClassificationSuggested,
      dueReviewStatus:a.dueReviewStatus||'none',
      questionVersion:a.questionVersion||1,
      snapshot:a.snapshot&&typeof a.snapshot==='object'?{
        tag:a.snapshot.tag||'',
        stem:a.snapshot.stem||'',
        choices:Array.isArray(a.snapshot.choices)?a.snapshot.choices.map(String):[],
        correctText:a.snapshot.correctText||'',
        selectedText:a.snapshot.selectedText||'',
        rationale:a.snapshot.rationale||'',
        why:Array.isArray(a.snapshot.why)?a.snapshot.why.map(String):[],
        takeaway:a.snapshot.takeaway||''
      }:null
    };
  }
  function questionIdentity(quiz,item){
    const ideaId=quiz&&quiz.mixed?item._id:quiz.id;
    return `${ideaId}::${item.tag}`;
  }
  function splitTags(value){
    if(Array.isArray(value))return value.map(String).filter(Boolean);
    if(!value)return [];
    return String(value).split(/[;,]/).map(x=>x.trim()).filter(Boolean);
  }
  function inferConceptTags(quiz,item){
    const tags=[];
    const push=x=>{if(x&&!tags.includes(x))tags.push(x);};
    push(item.primaryConcept);
    splitTags(item.conceptTags).forEach(push);
    push(item.tag);
    push(quiz&&quiz.mixed?item._idea:quiz.idea);
    return tags;
  }
  function suggestErrorClassification(ctx){
    if(ctx.changedAnswer&&ctx.originalSelectedAnswer===ctx.correctAnswer&&!ctx.correct)return 'changed-from-correct';
    if(ctx.responseTimeMs&&ctx.responseTimeMs<15000&&!ctx.correct)return 'timing-rushing';
    if(ctx.item&&(ctx.item.calculationType||/calculation|calculate|unit|molarity|force|voltage|pressure|energy/i.test(`${ctx.item.tag||''} ${ctx.item.stem||''}`))){
      if(!ctx.correct)return /unit|dimensional/i.test(`${ctx.item.tag||''} ${ctx.item.stem||''}`)?'unit-dimensional-analysis':'calculation-error';
    }
    if(!ctx.correct&&ctx.confidence==='confident')return 'misapplied-concept';
    if(!ctx.correct&&ctx.confidence==='no-idea')return 'content-gap';
    if(!ctx.correct&&ctx.confidence==='guess')return 'content-gap';
    if(!ctx.correct)return 'fell-for-distractor';
    return null;
  }
  function buildAttempt(ctx){
    const item=ctx.item, quiz=ctx.quiz;
    const correct=ctx.selectedAnswer===ctx.correctAnswer;
    const responseTimeMs=Math.max(0,Number(ctx.submittedAt||now())-Number(ctx.startedAt||now()));
    const changedAnswer=ctx.originalSelectedAnswer!=null&&ctx.originalSelectedAnswer!==ctx.selectedAnswer;
    const attempt=normalizeAttempt({
      attemptId:uid('att'),
      questionId:questionIdentity(quiz,item),
      timestamp:ctx.submittedAt||now(),
      selectedAnswer:ctx.selectedAnswer,
      correctAnswer:ctx.correctAnswer,
      correct,
      responseTimeMs,
      confidence:ctx.confidence||'somewhat',
      changedAnswer,
      originalSelectedAnswer:changedAnswer?ctx.originalSelectedAnswer:null,
      mode:ctx.mode||'review',
      section:quiz&&quiz.mixed?item._sec:quiz.sectionCode,
      contentCategory:quiz&&quiz.mixed?item._cat:quiz.category,
      testableIdea:quiz&&quiz.mixed?item._idea:quiz.idea,
      conceptTags:inferConceptTags(quiz,item),
      prerequisiteConceptTags:splitTags(item.prerequisiteConcepts),
      difficulty:item.difficulty||'medium',
      dueReviewStatus:correct?'none':'due',
      questionVersion:item.version||1,
      snapshot:{
        tag:item.tag||'',
        stem:item.stem||'',
        choices:Array.isArray(item.choices)?item.choices.slice():[],
        correctText:Array.isArray(item.choices)?item.choices[ctx.correctAnswer]||'':'',
        selectedText:Array.isArray(item.choices)?item.choices[ctx.selectedAnswer]||'':'',
        rationale:item.rationale||'',
        why:Array.isArray(item.why)?item.why.slice():[],
        takeaway:item.takeaway||''
      }
    });
    attempt.errorClassification=ctx.errorClassification||suggestErrorClassification({...attempt,item});
    attempt.errorClassificationSuggested=!!attempt.errorClassification&&!ctx.errorClassification;
    return attempt;
  }
  function reviewReasonForAttempt(a){
    if(!a.correct&&a.confidence==='confident')return 'High-confidence miss';
    if(!a.correct)return 'Missed question';
    if(a.correct&&(a.confidence==='guess'||a.confidence==='no-idea'))return 'Correct guess';
    if(a.changedAnswer&&a.originalSelectedAnswer===a.correctAnswer&&!a.correct)return 'Changed from correct';
    return '';
  }
  function reviewDelay(outcome,a){
    const highRisk=a&&!a.correct&&a.confidence==='confident';
    const map={again:highRisk?MS_DAY/2:MS_DAY,hard:highRisk?MS_DAY:2*MS_DAY,good:4*MS_DAY,easy:10*MS_DAY};
    return map[outcome]||map.good;
  }
  function shouldEnterReview(a){
    return !!a&&(!a.correct||a.confidence==='guess'||a.confidence==='no-idea'||(a.changedAnswer&&a.originalSelectedAnswer===a.correctAnswer&&!a.correct));
  }
  function scheduleReviewFromAttempt(state,attempt,asOf){
    if(!shouldEnterReview(attempt))return state;
    const ts=asOf||attempt.timestamp||now();
    const prior=(state.questionReviews&&state.questionReviews[attempt.questionId])||{};
    const sooner=attempt.correct?3*MS_DAY:(attempt.confidence==='confident'?MS_DAY/2:MS_DAY);
    state.questionReviews=state.questionReviews||{};
    state.questionReviews[attempt.questionId]=Object.assign({},prior,{
      questionId:attempt.questionId,
      dueAt:ts+sooner,
      lastAttemptAt:attempt.timestamp,
      lastAttemptId:attempt.attemptId,
      reason:reviewReasonForAttempt(attempt),
      state:'learning',
      outcome:prior.outcome||null,
      updatedAt:ts
    });
    return state;
  }
  function recordAttempt(storage,attempt){
    if(!validateAttempt(attempt))return {ok:false,error:'Invalid attempt.'};
    const state=loadState(storage);
    const normalized=normalizeAttempt(attempt);
    state.attempts.push(normalized);
    scheduleReviewFromAttempt(state,normalized);
    saveState(storage,state);
    return {ok:true,state,attempt:normalized};
  }
  function updateAttempt(storage,attemptId,patch){
    const state=loadState(storage);
    const idx=state.attempts.findIndex(a=>a.attemptId===attemptId);
    if(idx<0)return {ok:false,error:'Attempt not found.'};
    state.attempts[idx]=normalizeAttempt(Object.assign({},state.attempts[idx],patch));
    saveState(storage,state);
    return {ok:true,attempt:state.attempts[idx],state};
  }
  function gradeReview(storage,questionId,outcome,asOf){
    if(!['again','hard','good','easy'].includes(outcome))return {ok:false,error:'Unsupported review outcome.'};
    const state=loadState(storage);
    const latest=(state.attempts||[]).filter(a=>a.questionId===questionId).sort((a,b)=>b.timestamp-a.timestamp)[0]||null;
    const ts=asOf||now();
    state.questionReviews=state.questionReviews||{};
    const prior=state.questionReviews[questionId]||{questionId};
    const dueAt=ts+reviewDelay(outcome,latest);
    state.questionReviews[questionId]=Object.assign({},prior,{questionId,outcome,dueAt,lastReviewedAt:ts,state:outcome==='easy'?'mastered':'learning',updatedAt:ts,reason:prior.reason||reviewReasonForAttempt(latest)});
    saveState(storage,state);
    return {ok:true,review:state.questionReviews[questionId],state};
  }
  function reviewItems(state,asOf){
    const ts=asOf||now();
    const byQ={};
    (state.attempts||[]).map(normalizeAttempt).forEach(a=>{
      if(!byQ[a.questionId]||a.timestamp>byQ[a.questionId].timestamp)byQ[a.questionId]=a;
    });
    Object.values(byQ).forEach(a=>{
      if(shouldEnterReview(a)&&!(state.questionReviews||{})[a.questionId]){
        const fake={questionId:a.questionId,dueAt:a.timestamp+(a.correct?3*MS_DAY:MS_DAY),lastAttemptAt:a.timestamp,lastAttemptId:a.attemptId,reason:reviewReasonForAttempt(a),state:'learning',updatedAt:a.timestamp};
        byQ[a.questionId]._review=fake;
      }
    });
    const ids=new Set([].concat(Object.keys(state.questionReviews||{}),Object.keys(byQ)));
    return [...ids].map(id=>{
      const latest=byQ[id]||null;
      const review=(state.questionReviews&&state.questionReviews[id])||(latest&&latest._review)||null;
      if(!review)return null;
      const dueAt=Number(review.dueAt)||0;
      const status=dueAt<=ts?'due':(dueAt<=ts+MS_DAY?'today':'upcoming');
      return {questionId:id,dueAt,status,overdueMs:Math.max(0,ts-dueAt),review,latest};
    }).filter(Boolean).sort((a,b)=>{
      if(a.status!==b.status)return a.status==='due'?-1:b.status==='due'?1:a.status==='today'?-1:1;
      return a.dueAt-b.dueAt;
    });
  }
  function confidenceWeight(confidence){
    return ({'confident':1,'somewhat':0.7,'guess':0.25,'no-idea':0}[confidence]??0.5);
  }
  function difficultyWeight(difficulty){
    return ({easy:0.85,medium:1,hard:1.15}[difficulty]??1);
  }
  function recencyWeight(ts,asOf){
    const ageDays=Math.max(0,((asOf||now())-(Number(ts)||0))/MS_DAY);
    return Math.max(0.35,Math.exp(-ageDays/45));
  }
  function evidenceForAttempt(a,asOf){
    const rec=recencyWeight(a.timestamp,asOf), diff=difficultyWeight(a.difficulty), conf=confidenceWeight(a.confidence);
    const timed=a.mode==='timed'?1.08:1;
    if(a.correct){
      const base=a.confidence==='guess'||a.confidence==='no-idea'?0.18:0.52+0.36*conf;
      return base*rec*diff*timed;
    }
    const misconception=a.confidence==='confident'?1.15:0;
    const penalty=(0.46+0.34*conf+misconception)*rec*diff;
    return -penalty;
  }
  function spacedSuccessBonus(attempts,asOf){
    const correct=attempts.filter(a=>a.correct).sort((a,b)=>a.timestamp-b.timestamp);
    if(correct.length<2)return 0;
    let bonus=0;
    for(let i=1;i<correct.length;i++){
      const gap=(correct[i].timestamp-correct[i-1].timestamp)/MS_DAY;
      if(gap>=2)bonus+=Math.min(0.18,gap/90);
    }
    return Math.min(0.45,bonus)*recencyWeight(correct[correct.length-1].timestamp,asOf);
  }
  function masteryFromAttempts(attempts,asOf){
    const list=(attempts||[]).filter(validateAttempt).map(normalizeAttempt);
    if(!list.length)return {pct:0,label:'Unseen',attempts:0,evidence:0,reason:'No attempts yet.'};
    const sorted=list.slice().sort((a,b)=>a.timestamp-b.timestamp);
    const evidence=sorted.reduce((sum,a)=>sum+evidenceForAttempt(a,asOf),0)+spacedSuccessBonus(sorted,asOf);
    const pct=Math.max(0,Math.min(100,Math.round(50+evidence*18)));
    const last=sorted[sorted.length-1];
    let label=pct>=85?'Strong':pct>=68?'Developing':pct>=45?'Learning':'Fragile';
    if(sorted.some(a=>!a.correct&&a.confidence==='confident'))label='Misconception risk';
    if(last&&last.correct&&['guess','no-idea'].includes(last.confidence)&&pct>70)label='Developing';
    const highConfMisses=sorted.filter(a=>!a.correct&&a.confidence==='confident').length;
    const guessesRight=sorted.filter(a=>a.correct&&['guess','no-idea'].includes(a.confidence)).length;
    let reason=last.correct?'Recent answer was correct.':'Recent answer was incorrect.';
    if(highConfMisses)reason='Mastery is lower because of high-confidence incorrect attempts.';
    else if(guessesRight)reason='Correct guesses count as weak positive evidence and stay reviewable.';
    else if(sorted.filter(a=>a.correct).length>=2)reason='Repeated success over time increases the estimate.';
    return {pct,label,attempts:sorted.length,evidence:+evidence.toFixed(3),reason,timedPct:masteryForMode(sorted,'timed',asOf),learningPct:masteryForMode(sorted,'review',asOf)};
  }
  function masteryForMode(attempts,mode,asOf){
    const list=attempts.filter(a=>a.mode===mode);
    if(!list.length)return null;
    const evidence=list.reduce((sum,a)=>sum+evidenceForAttempt(a,asOf),0)+spacedSuccessBonus(list,asOf);
    return Math.max(0,Math.min(100,Math.round(50+evidence*18)));
  }
  function attemptsForIdea(state,ideaId){
    const prefix=`${ideaId}::`;
    return (state.attempts||[]).filter(a=>a.questionId&&a.questionId.startsWith(prefix));
  }
  function legacyProgressFromAttempts(state,bank){
    const progress={};
    (bank||[]).forEach(idea=>{
      const attempts=attemptsForIdea(state,idea.id);
      if(!attempts.length)return;
      const byAttemptTime={};
      attempts.forEach(a=>{byAttemptTime[a.timestamp]=byAttemptTime[a.timestamp]||[];byAttemptTime[a.timestamp].push(a);});
      const latest=attempts.slice().sort((a,b)=>b.timestamp-a.timestamp)[0];
      const best=Math.max(...Object.values(byAttemptTime).map(group=>group.filter(a=>a.correct).length));
      progress[idea.id]={best,total:idea.questions.length,attempts:Object.keys(byAttemptTime).length,last:latest.correct?1:0,ts:latest.timestamp,perQ:null,bestPerQ:null,first:Math.min(...attempts.map(a=>a.timestamp))};
    });
    Object.keys(state.questionReviews||{}).forEach(id=>{
      if(progress[id])return;
      const x=state.questionReviews[id];
      progress[id]={best:x.best||0,total:x.total||0,attempts:x.attempts||0,last:x.last||0,ts:x.last||null,perQ:null,bestPerQ:null,first:null};
    });
    return progress;
  }
  function summarizeStats(state){
    const attempts=state.attempts||[];
    return {answered:attempts.length,correct:attempts.filter(a=>a.correct).length};
  }
  const api={SCHEMA_VERSION,STORAGE_KEY,LEGACY_PROGRESS_KEY,LEGACY_STATS_KEY,CONFIDENCE_LEVELS,ERROR_CATEGORIES,createEmptyState,loadState,saveState,resetState,exportState,importState,validateAttempt,normalizeAttempt,buildAttempt,recordAttempt,updateAttempt,gradeReview,reviewItems,reviewReasonForAttempt,shouldEnterReview,masteryFromAttempts,attemptsForIdea,legacyProgressFromAttempts,summarizeStats,suggestErrorClassification,questionIdentity};
  root.OpenMcatLearner=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
