import {readFileSync,writeFileSync,renameSync,mkdirSync,rmSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {emptyRecommendationSettings,migrateRecommendationSettings,updateRecommendationSettings} from './core/recommendation-settings.mjs';

// 独立公共默认文件：发布时随模块收集，不写入个人账号或生成的原始攻略。
export function createRecommendationStore(path,catalog){
  const read=()=>{try{return migrateRecommendationSettings(JSON.parse(readFileSync(path,'utf8')),catalog);}catch(error){if(error.code==='ENOENT')return emptyRecommendationSettings();throw error;}};
  return{
    read,
    restore(value){
      const next=migrateRecommendationSettings(value,catalog);
      mkdirSync(dirname(path),{recursive:true});const temporary=path+'.'+randomUUID()+'.tmp';
      try{writeFileSync(temporary,JSON.stringify(next,null,2)+'\n',{flag:'wx'});renameSync(temporary,path);}finally{rmSync(temporary,{force:true});}
      return next;
    },
    write(request){
      const next=updateRecommendationSettings(read(),request,catalog);
      mkdirSync(dirname(path),{recursive:true});const temporary=path+'.'+randomUUID()+'.tmp';
      try{writeFileSync(temporary,JSON.stringify(next,null,2)+'\n',{flag:'wx'});renameSync(temporary,path);}
      finally{rmSync(temporary,{force:true});}
      return next;
    }
  };
}
