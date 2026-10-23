import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DAY,buildEvents,catalogConfirmed,countdown,horizon,toICS,validRule} from '../shared/key-dates.mjs';

const config=JSON.parse(await readFile(new URL('../public/key-dates-data.json',import.meta.url),'utf8'));
const now=Date.parse('2026-10-21T12:00:00+08:00');
const entry=(id,name,extra={})=>({id,name,game:'genshin',category:'banners',releaseVersion:'7.2',fetchedAt:'2026-10-20T08:00:00Z',sources:[{name:'公告',url:'https://example.test/official'}],banner:{mode:'event',sourceType:'Character Event',start:'2026-11-25 18:00:00',end:'2026-12-15 14:59:00',timeZone:'开始 UTC+8 / 结束服务器时间',schedule:{key:'lower',derived:false}},...extra});

test('正式卡池合并同一节点，排除邦布、常驻和缺少明确时刻的记录',()=>{
  const official=catalogConfirmed([entry('a','角色池'),entry('b','装备池'),entry('permanent','常驻',{banner:{mode:'standard',end:'2026-11-02 14:59:00',timeZone:'服务器时间'}}),entry('bangboo','邦布',{game:'zenless',banner:{sourceType:'Bangboo Channel',end:'2026-11-02 14:59:00',timeZone:'服务器时间'}}),entry('unknown','未录入时刻',{banner:{end:'2026-11-02',timeZone:'服务器时间'}})]);
  assert.equal(official.length,1);assert.equal(official[0].kind,'phase');assert.deepEqual(official[0].names,['角色池','装备池']);assert.equal(official[0].sources.length,1);assert.equal(official[0].checkedAt,'2026-10-20');assert.equal(Date.parse(official[0].time),Date.parse('2026-11-25T18:00:00+08:00'));
});

test('年度预计、改期优先级和参数调整保持已公布日期不变',()=>{
  const data={...config,confirmed:catalogConfirmed([entry('a','角色池')])};
  const baseline=buildEvents(data,{},now),range=horizon(now);assert.ok(baseline.length>60);assert.ok(baseline.every(e=>e.at>now&&e.at<range.end&&e.kind!=='end'));assert.ok(baseline.some(e=>e.at>Date.parse('2027-10-01T00:00:00+08:00')));
  for(const game of config.games)for(const kind of ['update','live','phase'])assert.ok(baseline.some(e=>e.game===game.id&&e.kind===kind));
  assert.equal(baseline.filter(e=>e.game==='genshin'&&e.kind==='phase'&&e.version==='7.2').length,1);
  const g=config.games[0],rule={cycle:g.cycle,phase:g.phase,liveLead:g.liveLead,phaseTime:g.phaseTime,liveTime:g.liveTime,shift:7};assert.ok(validRule(rule));
  const shifted=buildEvents(data,{genshin:rule},now),next=events=>events.find(e=>e.game==='genshin'&&e.kind==='update');assert.equal(next(shifted).at-next(baseline).at,7*DAY);assert.equal(next(shifted).id,next(baseline).id);
  assert.deepEqual(shifted.filter(e=>e.status==='confirmed'),baseline.filter(e=>e.status==='confirmed'));
  assert.equal(shifted.filter(e=>e.game==='genshin'&&e.kind==='phase'&&e.version==='7.2').length,1);
  assert.equal(validRule({...rule,phase:42}),false);assert.equal(validRule({...rule,liveTime:'29:00'}),false);
});

test('明确公布的前瞻改期后，移除原预计节点',()=>{
  const official={id:'live',game:'genshin',version:'7.2',kind:'live',time:'2026-10-25T20:00:00+08:00',title:'7.2 前瞻直播',sources:[],basis:'明确公布'};
  const lives=buildEvents({...config,confirmed:[official]}, {},now).filter(e=>e.game==='genshin'&&e.version==='7.2'&&e.kind==='live');assert.equal(lives.length,1);assert.equal(lives[0].status,'confirmed');assert.equal(lives[0].at,Date.parse(official.time));
  assert.ok(buildEvents({...config,confirmed:[{...official,kind:'end'}]}, {},now).every(e=>e.kind!=='end'));
});

test('全年预计节点带版本号，跨大版本按配置顺推',()=>{
  const events=buildEvents(config,{},now);
  for(const game of config.games){
    const updates=events.filter(e=>e.game===game.id&&e.kind==='update');
    assert.equal(updates[0].version,game.nextVersion);
    const nextMajor=Number(game.nextVersion.split('.')[0])+1;
    const boundary=updates.findIndex(e=>e.version===`${nextMajor}.0`);
    assert.ok(boundary>0);assert.equal(updates[boundary-1].version,`${nextMajor-1}.${game.lastMinor}`);
    assert.ok(events.filter(e=>e.game===game.id).every(e=>/^\d+\.\d+$/.test(e.version)&&e.title.startsWith(e.version+' ')&&e.status==='estimated'));
  }
  const shortSeries={...config,games:[{...config.games[0],nextVersion:'7.7',lastMinor:7}]};
  assert.deepEqual(buildEvents(shortSeries,{},now).filter(e=>e.kind==='update').slice(0,3).map(e=>e.version),['7.7','8.0','8.1']);
});

test('倒计时与日历导出保留精确时间和预计标记',()=>{
  assert.equal(countdown(now+3599000,now).text,'还有 59 分 59 秒');assert.equal(countdown(now-1,now).text,'时间已到');
  const events=buildEvents(config,{},now).map(e=>({...e,gameName:config.games.find(g=>g.id===e.game).name})),ics=toICS(events);
  assert.equal((ics.match(/BEGIN:VEVENT/g)||[]).length,events.length);assert.ok(ics.includes('[预计]'));assert.ok(ics.includes('DTSTART:20261023T120000Z'));assert.ok(ics.split('\r\n').every(line=>Buffer.byteLength(line)<=75));assert.equal(new Set(events.map(e=>e.id)).size,events.length);
});
