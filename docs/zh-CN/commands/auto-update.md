---
description: 拉取最新的 ECC 仓库变更,并重新安装当前受管的目标。
locale: zh-CN
source_hash: ff05c3e0416541168480346e9bce6e18088e090df915a5cfe3fd5e77dda8e094
translated_at: 2026-10-31T06:03:12Z
translation_model: glm-5.3-flash
---

# 自动更新

从上游仓库更新 ECC,并使用原始的安装状态(install-state)请求重新生成当前上下文的受管安装。

## 用法

```bash
# Preview the update without mutating anything
ECC_ROOT="$(node -e "var r=(function(){var p=require('path'),f=require('fs'),o=require('os');var e=process.env.CLAUDE_PLUGIN_ROOT;if(e&&e.trim())return e.trim();var d=(process.env.CLAUDE_CONFIG_DIR||'').trim()||p.join(o.homedir(),'.claude');if(d==='~')d=o.homedir();else if(d.charAt(0)==='~'&&(d.charAt(1)==='/'||d.charCodeAt(1)===92))d=p.join(o.homedir(),d.slice(2));try{if(o.platform()==='linux'){var v=f.readFileSync('/proc/version','utf8').toLowerCase();if(v.includes('microsoft')){var m=d.match(/^([A-Za-z]):[\\\\/]/);if(m){var dl=m[1].toLowerCase();d='/mnt/'+dl+d.slice(2).replace(/\\\\/g,'/')}}}}catch(_){}d=p.resolve(d);function L(x){try{return require(p.join(x,'scripts','lib','resolve-ecc-root')).resolveEccRoot({probe:p.join('scripts','auto-update.js')})}catch(_){return null}}var r=L(d);if(r)return r;var s=['ecc','ecc@ecc','marketplaces/ecc','everything-claude-code','everything-claude-code@everything-claude-code','marketplaces/everything-claude-code'];for(var i=0;i<s.length;i++){r=L(p.join(d,'plugins',s[i]));if(r)return r}function D(x){try{return f.readdirSync(x,{withFileTypes:true}).filter(function(z){return z.isDirectory()}).map(function(z){return z.name})}catch(e){if(e.code==='ENOENT')return [];throw e}}var g=['ecc','everything-claude-code'];for(var j=0;j<g.length;j++){var c=p.join(d,'plugins','cache',g[j]);var O=D(c);for(var k=0;k<O.length;k++){var q=p.join(c,O[k]);var V=D(q);for(var m=0;m<V.length;m++){r=L(p.join(q,V[m]));if(r)return r}}}return d})();console.log(r)")" &&
node "$ECC_ROOT/scripts/auto-update.js" --dry-run

# Update only Cursor-managed files in the current project
node "$ECC_ROOT/scripts/auto-update.js" --target cursor

# Override the ECC repo root explicitly
node "$ECC_ROOT/scripts/auto-update.js" --repo-root /path/to/ECC
```

## 说明

- 此命令使用已记录的安装状态请求,并在拉取最新的仓库变更后重新运行 `install-apply.js`。
- 重新安装是有意为之:它用于处理上游的重命名和删除操作,而仅凭过时的操作记录,`repair.js` 无法安全地重建这些变更。
- 如果你想在做出任何更改之前查看重建出的重新安装计划,请先使用 `--dry-run`。