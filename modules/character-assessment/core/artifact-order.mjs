const versionParts=meta=>String(meta?.releaseVersion??'').match(/^(\d+)(?:\.(\d+))?/);
export function artifactMajorVersion(meta){return versionParts(meta)?.[1]??'unknown';}
export function artifactVersionChoices(entries){
 const versions=[...new Set(entries.map(([,meta])=>artifactMajorVersion(meta)))];
 return versions.sort((a,b)=>a==='unknown'?b==='unknown'?0:1:b==='unknown'?-1:Number(b)-Number(a)).map(v=>[v,v==='unknown'?'版本未记录':v+'.x']);
}
export function compareArtifactSets(a,b){
 const av=versionParts(a),bv=versionParts(b);
 for(const i of [1,2]){const x=av?Number(av[i]??0):-Infinity,y=bv?Number(bv[i]??0):-Infinity;if(x!==y)return x>y?-1:1;}
 const date=String(b?.releaseDate??'').localeCompare(String(a?.releaseDate??''));
 return date||String(b?.sourceId??b?.wikiId??'').localeCompare(String(a?.sourceId??a?.wikiId??''),'en',{numeric:true});
}
// 角色与套装共用首次登场排序；同版本按实装日期，缺失资料排最后。
export const compareCharacterRelease=compareArtifactSets;
export const artifactReleaseLabel=meta=>meta?.releaseVersion?'登场 '+meta.releaseVersion:'登场版本未记录';
