import test from 'node:test';
import assert from 'node:assert/strict';
import { createOwnerAlertTracker, createOwnerAlertSound, playOwnerAlertOnce } from '../src/lib/ownerLiveAlerts.js';
test('baseline, older pages and re-fetches do not alert; fresh unread arrivals do', () => {
 const receive=createOwnerAlertTracker();
 assert.deepEqual(receive(1,[{id:10}]),[]);
 assert.deepEqual(receive(1,[{id:12,read_at:'now'},{id:11},{id:10}]),[{id:11}]);
 assert.deepEqual(receive(1,[{id:11},{id:10}]),[]);
 assert.deepEqual(receive(1,[{id:9}]),[]);
 assert.deepEqual(receive(1,[{id:13,dismissed_at:'now'}]),[]);
 assert.deepEqual(receive(2,[{id:100}]),[]);
 assert.deepEqual(receive(2,[{id:101}]),[{id:101}]);
});
test('empty initial inbox still detects first arrival',()=>{const r=createOwnerAlertTracker();r(7,[]);assert.equal(r(7,[{id:1}]).length,1);});
test('audio requires activation and plays the four-note chime',async()=>{
 let state='suspended', resumed=0, tones=0, stopped=0;
 class AudioContext { get state(){return state} currentTime=0; destination={}; async resume(){resumed++;state='running'} async close(){state='closed'} createOscillator(){tones++;return {frequency:{},connect(){},start(){},stop(){stopped++},disconnect(){}}} createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}}} }
 const sound=createOwnerAlertSound({AudioContext});assert.equal(sound.play(),false);await sound.unlock();assert.equal(resumed,1);assert.equal(sound.play(),true);assert.equal(tones,4);assert.equal(stopped,4);sound.close();assert.equal(sound.play(),false);
});
test('cross-tab deduplication, separate owner and failed playback retry',async()=>{
 const data=new Map();const env={localStorage:{getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)},navigator:{locks:{request:async(k,fn)=>fn()}}};let plays=0;
 const play=()=>{plays++;return true};
 assert.equal(await playOwnerAlertOnce(1,10,()=>false,env),false);
 assert.equal(await playOwnerAlertOnce(1,10,play,env),true);
 assert.equal(await playOwnerAlertOnce(1,10,play,env),false);
 assert.equal(await playOwnerAlertOnce(1,9,play,env),false);
 assert.equal(await playOwnerAlertOnce(2,10,play,env),true);assert.equal(plays,2);
});
