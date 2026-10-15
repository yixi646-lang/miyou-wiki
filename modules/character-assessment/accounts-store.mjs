import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {blankState,validateState} from './core/model.mjs';
import {scanPreview,scanState} from './core/import-sync.mjs';

export const ACCOUNT_BACKUP='WIKI_ASSESSMENT_ACCOUNTS';
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const nameOf=value=>{if(typeof value!=='string'||!value.trim()||value.trim().length>100)fail('账号名称须为 1–100 个字。');return value.trim();};
export function createAccountStore(storagePath){
  let db;
  function database(){
    if(db)return db;
    mkdirSync(dirname(storagePath),{recursive:true});db=new DatabaseSync(storagePath);
    db.exec(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS workspace(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS assessment_accounts(id TEXT PRIMARY KEY,name TEXT NOT NULL,locked INTEGER NOT NULL,revision INTEGER NOT NULL,value TEXT NOT NULL,original TEXT,source TEXT NOT NULL,imported_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS assessment_account_settings(id INTEGER PRIMARY KEY CHECK(id=1),active_id TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS assessment_scan_recovery(account_id TEXT PRIMARY KEY,previous_value TEXT NOT NULL,scan_value TEXT NOT NULL,source TEXT NOT NULL,imported_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS assessment_account_modes(account_id TEXT PRIMARY KEY,kind TEXT NOT NULL);`);
    if(!db.prepare('SELECT active_id FROM assessment_account_settings WHERE id=1').get()){
      const legacy=db.prepare('SELECT revision,value FROM workspace WHERE id=1').get(),state=legacy?JSON.parse(legacy.value):blankState(),now=new Date().toISOString();
      const id=randomUUID();
      db.exec('BEGIN IMMEDIATE');try{
        db.prepare('INSERT INTO assessment_accounts VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,legacy?'原有养成方案':'本地方案',0,legacy?.revision??0,JSON.stringify(state),null,'',null,now,state.updatedAt??now);
        db.prepare('INSERT INTO assessment_account_settings VALUES(1,?)').run(id);db.exec('COMMIT');
      }catch(error){db.exec('ROLLBACK');throw error;}
    }
    // 旧复制接口保留导入时间，复制创建时间更晚；据此补记既有副本类型。
    db.exec(`INSERT OR IGNORE INTO assessment_account_modes(account_id,kind)
      SELECT id,CASE WHEN original IS NULL THEN 'local'
        WHEN imported_at IS NOT NULL AND imported_at<created_at THEN 'copy' ELSE 'imported' END
      FROM assessment_accounts;`);
    return db;
  }
  const row=id=>{const d=database(),active=id??d.prepare('SELECT active_id FROM assessment_account_settings WHERE id=1').get().active_id;const r=d.prepare('SELECT * FROM assessment_accounts WHERE id=?').get(active);if(!r)fail('账号不存在，请重新载入。',404);return r;};
  const recovery=id=>{const r=database().prepare('SELECT * FROM assessment_scan_recovery WHERE account_id=?').get(id);return r?{previousState:JSON.parse(r.previous_value),scan:JSON.parse(r.scan_value),source:r.source,importedAt:r.imported_at}:null;};
  const saveRecovery=(id,value)=>{if(value)database().prepare('INSERT OR REPLACE INTO assessment_scan_recovery VALUES(?,?,?,?,?)').run(id,JSON.stringify(value.previousState),JSON.stringify(value.scan),value.source,value.importedAt);};
  const accountKind=r=>database().prepare('SELECT kind FROM assessment_account_modes WHERE account_id=?').get(r.id)?.kind??(r.original?'imported':'local');
  const metadata=r=>{const s=JSON.parse(r.value);return{id:r.id,name:r.name,kind:accountKind(r),locked:!!r.locked,revision:r.revision,source:r.source,importedAt:r.imported_at,createdAt:r.created_at,updatedAt:r.updated_at,hasOriginal:!!r.original,hasScanRecovery:!!database().prepare('SELECT 1 FROM assessment_scan_recovery WHERE account_id=?').get(r.id),customCounts:Object.fromEntries(['characters','weapons','artifacts'].map(k=>[k,s.customInventory?.[k]?.length??0])),counts:Object.fromEntries(['characters','weapons','artifacts'].map(k=>[k,(s.good[k]?.length??0)+(s.customInventory?.[k]?.filter(c=>k!=='characters'||!s.good.characters.some(a=>a.key===c.key)).length??0)]))};};
  const freshName=name=>{const names=new Set(database().prepare('SELECT name FROM assessment_accounts').all().map(r=>r.name));let result=name,n=2;while(names.has(result))result=name.slice(0,90)+` (${n++})`;return result;};
  function insert({name,state,original,source='',locked=false,importedAt,kind=original?'imported':'local'}){
    const now=new Date().toISOString(),id=randomUUID();
    database().prepare('INSERT INTO assessment_accounts VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,freshName(nameOf(name)),Number(locked),0,JSON.stringify(state),original?JSON.stringify(original):null,String(source).slice(0,240),original?(importedAt??now):null,now,now);
    database().prepare('INSERT INTO assessment_account_modes VALUES(?,?)').run(id,kind);return id;
  }
  function checkRevision(r,revision){if(revision!==r.revision)fail('养成资料已在另一个页面更新。请先导出本页备份，再重新载入。',409);}
  const checkUnlocked=r=>{if(r.locked)fail('账号已锁定，请先解锁再修改。',423);};
  return{
    database,
    close(){db?.close();db=null;},
    list(){const d=database();return{activeId:d.prepare('SELECT active_id FROM assessment_account_settings WHERE id=1').get().active_id,accounts:d.prepare('SELECT * FROM assessment_accounts ORDER BY created_at,id').all().map(metadata)};},
    read(id){const r=row(id);return{account:metadata(r),revision:r.revision,state:JSON.parse(r.value)};},
    write({accountId,revision,state},data){
      if(!accountId)fail('账号管理已升级，请刷新 Wiki 后再保存。',409);
      const r=row(accountId);checkRevision(r,revision);
      // 锁定只保护实际 GOOD；自定义资料在独立层保存，原始快照不能通过保存接口改写。
      if(r.locked&&!isDeepStrictEqual(state?.good,JSON.parse(r.value).good))checkUnlocked(r);
      const next=validateState(state,data),now=new Date().toISOString();next.updatedAt=now;
      if(r.locked){const previous=JSON.parse(r.value).customInventory?.unequippedSlots??[];if((next.customInventory?.unequippedSlots??[]).some(a=>!previous.some(b=>a.character===b.character&&a.kind===b.kind&&a.slot===b.slot)))checkUnlocked(r);}
      if(accountKind(r)==='imported'&&next.customInventory?.showMarkers===false)fail('导入账号的自定义标记须保留。');
      database().prepare('UPDATE assessment_accounts SET value=?,revision=revision+1,updated_at=? WHERE id=?').run(JSON.stringify(next),now,r.id);
      return{ok:true,...this.read(r.id),updatedAt:now};
    },
    action(payload,data){
      const d=database(),{action,accountId,revision}=payload;
      if(action==='create'){
        if(this.list().accounts.length>=50)fail('最多保存 50 个账号。');
        const imported=payload.state!==undefined,state=imported?validateState(payload.state,data):blankState();
        // 导入必定建立独立账号并锁定；原始快照由服务端保存，普通保存接口无法改写。
        const kind=imported&&['local','copy'].includes(state.accountKind)?state.accountKind:imported?'imported':'local';if(kind==='imported'&&state.customInventory)state.customInventory.showMarkers=true;
        const id=insert({name:payload.name,state,original:imported?state:null,source:payload.source,locked:imported,kind});
        d.prepare('UPDATE assessment_account_settings SET active_id=? WHERE id=1').run(id);return this.read(id);
      }
      const r=row(accountId);
      if(action==='switch'){d.prepare('UPDATE assessment_account_settings SET active_id=? WHERE id=1').run(r.id);return this.read(r.id);}
      checkRevision(r,revision);
      if(action==='preview-scan'||action==='import-scan'){
        const preview=scanPreview(JSON.parse(r.value),payload.good,data,{mode:payload.mode});
        const summary={changes:preview.changes,warnings:preview.warnings,counts:preview.counts,changed:preview.changed,mode:preview.mode};
        if(action==='preview-scan')return {...summary,accountId:r.id,revision:r.revision};
        checkUnlocked(r);
        if(preview.mode==='sync'&&payload.confirmReplace!==true)fail('请先确认完整扫描的装备替换范围。');
        if(!preview.changed)return {...this.read(r.id),...summary,unchanged:true};
        const now=new Date().toISOString(),next=preview.state;next.updatedAt=now;
        const scan=scanState(payload.good,data),source=String(payload.source??'').slice(0,240);
        d.exec('BEGIN IMMEDIATE');try{
          saveRecovery(r.id,{previousState:JSON.parse(r.value),scan:payload.good,source,importedAt:now});
          d.prepare('UPDATE assessment_accounts SET value=?,original=?,locked=1,revision=revision+1,source=?,imported_at=?,updated_at=? WHERE id=?').run(JSON.stringify(next),r.original??JSON.stringify(scan),source,now,now,r.id);
          d.exec('COMMIT');
        }catch(error){d.exec('ROLLBACK');throw error;}
        return {...this.read(r.id),...summary};
      }
      if(action==='copy'){
        if(this.list().accounts.length>=50)fail('最多保存 50 个账号。');
        let id;d.exec('BEGIN IMMEDIATE');try{
          id=insert({name:payload.name??r.name.slice(0,96)+'（副本）',state:JSON.parse(r.value),original:r.original?JSON.parse(r.original):null,source:r.source,importedAt:r.imported_at,locked:false,kind:'copy'});
          saveRecovery(id,recovery(r.id));
          d.prepare('UPDATE assessment_account_settings SET active_id=? WHERE id=1').run(id);d.exec('COMMIT');
        }catch(error){d.exec('ROLLBACK');throw error;}
        return this.read(id);
      }
      if(action==='lock'||action==='unlock'){
        d.prepare('UPDATE assessment_accounts SET locked=?,revision=revision+1 WHERE id=?').run(Number(action==='lock'),r.id);return this.read(r.id);
      }
      if(action==='rename'){d.prepare('UPDATE assessment_accounts SET name=?,revision=revision+1 WHERE id=?').run(nameOf(payload.name),r.id);return this.read(r.id);}
      checkUnlocked(r);
      if(action==='remove'){
        if(this.list().accounts.length<=1)fail('至少保留一个账号；可以新建账号后再移除。');
        d.exec('BEGIN IMMEDIATE');try{d.prepare('DELETE FROM assessment_scan_recovery WHERE account_id=?').run(r.id);d.prepare('DELETE FROM assessment_account_modes WHERE account_id=?').run(r.id);d.prepare('DELETE FROM assessment_accounts WHERE id=?').run(r.id);const active=d.prepare('SELECT active_id FROM assessment_account_settings WHERE id=1').get().active_id;if(active===r.id)d.prepare('UPDATE assessment_account_settings SET active_id=? WHERE id=1').run(d.prepare('SELECT id FROM assessment_accounts ORDER BY created_at,id LIMIT 1').get().id);d.exec('COMMIT');}catch(error){d.exec('ROLLBACK');throw error;}
        return this.read();
      }
      fail('不支持的账号操作。');
    },
    original(id){const r=row(id);if(!r.original)fail('这个账号没有导入快照。',404);return{account:metadata(r),state:JSON.parse(r.original)};},
    recovery(id){const r=row(id),value=recovery(r.id);if(!value)fail('这个账号没有扫描更新前的存档。',404);return{account:metadata(r),...value};},
    export(){const d=database();return{format:ACCOUNT_BACKUP,version:1,game:'genshin',exportedAt:new Date().toISOString(),activeId:this.list().activeId,accounts:d.prepare('SELECT * FROM assessment_accounts ORDER BY created_at,id').all().map(r=>({...metadata(r),state:JSON.parse(r.value),original:r.original?JSON.parse(r.original):null,scanRecovery:recovery(r.id)}))};},
    import(payload,data){
      const input=payload.backup;if(input?.format!==ACCOUNT_BACKUP||input.version!==1||input.game!=='genshin'||!Array.isArray(input.accounts)||!input.accounts.length||input.accounts.length+this.list().accounts.length>50)fail('多账号备份格式不正确或账号总数超过 50。');
      const validated=input.accounts.map(a=>{const kind=['local','copy','imported'].includes(a.kind)?a.kind:'imported',state=validateState(a.state,data);if(kind==='imported'&&state.customInventory)state.customInventory.showMarkers=true;return {name:nameOf(a.name),state,original:a.original?validateState(a.original,data):validateState(a.state,data),source:a.source||payload.source,kind,locked:true,oldId:a.id,scanRecovery:a.scanRecovery?{previousState:validateState(a.scanRecovery.previousState,data),scan:scanState(a.scanRecovery.scan,data).good,source:String(a.scanRecovery.source??'').slice(0,240),importedAt:String(a.scanRecovery.importedAt??'')}:null};});
      const d=database();let active;d.exec('BEGIN IMMEDIATE');try{for(const account of validated){const id=insert(account);saveRecovery(id,account.scanRecovery);if(!active||account.oldId===input.activeId)active=id;}d.prepare('UPDATE assessment_account_settings SET active_id=? WHERE id=1').run(active);d.exec('COMMIT');}catch(error){d.exec('ROLLBACK');throw error;}return this.read(active);
    }
  };
}
