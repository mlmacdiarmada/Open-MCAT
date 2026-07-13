const assert=require('assert');
const Learner=require('../learner-core.js');

class MemoryStorage{
  constructor(seed={}){this.map=new Map(Object.entries(seed));}
  getItem(k){return this.map.has(k)?this.map.get(k):null;}
  setItem(k,v){this.map.set(k,String(v));}
  removeItem(k){this.map.delete(k);}
}

function sampleCtx(overrides={}){
  const quiz={id:'ps-demo',sectionCode:'P/S',category:'Sensory processing',idea:'Visual depth cues'};
  const item={tag:'Monocular vs. binocular',stem:'Which cue requires two eyes?',choices:['Interposition','Retinal disparity','Relative size','Motion parallax'],answer:1,why:['','','',''],rationale:'',takeaway:''};
  return Object.assign({quiz,item,selectedAnswer:1,correctAnswer:1,confidence:'confident',startedAt:1000,submittedAt:11000,originalSelectedAnswer:1,mode:'review'},overrides);
}

function testMigrationPreservesLegacySummary(){
  const legacy={'ps-demo':{best:3,total:4,attempts:2,ts:1234}};
  const storage=new MemoryStorage({omcat_prog_v2:JSON.stringify(legacy)});
  const state=Learner.loadState(storage);
  assert.strictEqual(state.schemaVersion,1);
  assert.strictEqual(state.questionReviews['ps-demo'].best,3);
  assert.strictEqual(JSON.parse(storage.getItem('omcat_prog_v2'))['ps-demo'].best,3);
  assert.ok(state.recoveryLog.some(x=>x.kind==='legacy-summary-imported'));
}

function testMalformedStateRecoversWithoutDeletingLegacy(){
  const storage=new MemoryStorage({omcat_learning_v1:'{bad json',omcat_prog_v2:JSON.stringify({'ps-demo':{best:1,total:4,attempts:1}})});
  const state=Learner.loadState(storage);
  assert.deepStrictEqual(state.attempts,[]);
  assert.strictEqual(state.questionReviews['ps-demo'].best,1);
  assert.ok(state.recoveryLog.some(x=>x.kind==='malformed-learning-state'));
}

function testAttemptSchemaCapturesConfidenceTimingAndChange(){
  const attempt=Learner.buildAttempt(sampleCtx({selectedAnswer:0,correctAnswer:1,confidence:'guess',submittedAt:31000,originalSelectedAnswer:1}));
  assert.strictEqual(attempt.questionId,'ps-demo::Monocular vs. binocular');
  assert.strictEqual(attempt.correct,false);
  assert.strictEqual(attempt.responseTimeMs,30000);
  assert.strictEqual(attempt.confidence,'guess');
  assert.strictEqual(attempt.changedAnswer,true);
  assert.strictEqual(attempt.originalSelectedAnswer,1);
  assert.strictEqual(attempt.dueReviewStatus,'due');
  assert.ok(attempt.errorClassification);
  assert.strictEqual(attempt.snapshot.selectedText,'Interposition');
  assert.strictEqual(attempt.snapshot.correctText,'Retinal disparity');
}

function testMasteryWeightsConfidenceAndMisconceptions(){
  const t=Date.now();
  const strong=[
    Learner.normalizeAttempt(Object.assign(Learner.buildAttempt(sampleCtx({submittedAt:t-7*86400000,startedAt:t-7*86400000-10000})),{timestamp:t-7*86400000})),
    Learner.normalizeAttempt(Object.assign(Learner.buildAttempt(sampleCtx({submittedAt:t,startedAt:t-10000})),{timestamp:t}))
  ];
  const guessed=[
    Learner.normalizeAttempt(Object.assign(Learner.buildAttempt(sampleCtx({confidence:'guess',submittedAt:t,startedAt:t-10000})),{timestamp:t}))
  ];
  const misconception=[
    Learner.normalizeAttempt(Object.assign(Learner.buildAttempt(sampleCtx({selectedAnswer:0,correctAnswer:1,confidence:'confident',submittedAt:t,startedAt:t-10000})),{timestamp:t}))
  ];
  const strongM=Learner.masteryFromAttempts(strong,t);
  const guessedM=Learner.masteryFromAttempts(guessed,t);
  const missM=Learner.masteryFromAttempts(misconception,t);
  assert.ok(strongM.pct>guessedM.pct, `${strongM.pct} should exceed ${guessedM.pct}`);
  assert.ok(missM.pct<guessedM.pct, `${missM.pct} should be below ${guessedM.pct}`);
  assert.strictEqual(missM.label,'Misconception risk');
}

function testImportExportRoundTrip(){
  const storage=new MemoryStorage();
  const attempt=Learner.buildAttempt(sampleCtx());
  Learner.recordAttempt(storage,attempt);
  const exported=Learner.exportState(storage);
  const next=new MemoryStorage();
  const result=Learner.importState(next,exported);
  assert.strictEqual(result.ok,true);
  assert.strictEqual(Learner.loadState(next).attempts.length,1);
  assert.strictEqual(Learner.importState(next,JSON.stringify({hello:'world'})).ok,false);
}

function testReviewQueueAndGrading(){
  const storage=new MemoryStorage();
  const now=Date.now();
  const miss=Learner.buildAttempt(sampleCtx({selectedAnswer:0,correctAnswer:1,confidence:'confident',startedAt:now-20000,submittedAt:now}));
  Learner.recordAttempt(storage,miss);
  const state=Learner.loadState(storage);
  const items=Learner.reviewItems(state,now+12*60*60*1000+1);
  assert.strictEqual(items.length,1);
  assert.strictEqual(items[0].status,'due');
  assert.strictEqual(items[0].review.reason,'High-confidence miss');
  const graded=Learner.gradeReview(storage,miss.questionId,'easy',now+13*60*60*1000);
  assert.strictEqual(graded.ok,true);
  assert.strictEqual(graded.review.state,'mastered');
  assert.ok(graded.review.dueAt>now);
}

testMigrationPreservesLegacySummary();
testMalformedStateRecoversWithoutDeletingLegacy();
testAttemptSchemaCapturesConfidenceTimingAndChange();
testMasteryWeightsConfidenceAndMisconceptions();
testImportExportRoundTrip();
testReviewQueueAndGrading();

console.log('learner-core tests passed');
