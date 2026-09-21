
import {cp,mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('extension'),out=path.resolve('dist/extension');
const manifest=JSON.parse(await readFile(path.join(root,'manifest.json'),'utf8'));
if(manifest.manifest_version!==3)throw Error('Manifest V3 required');
for(const key of ['permissions','host_permissions','optional_permissions','optional_host_permissions','externally_connectable','content_scripts','chrome_url_overrides'])
 if(manifest[key])throw Error('Unexpected permission/surface: '+key);
for(const name of await readdir(root)){
 const text=await readFile(path.join(root,name),'utf8');
 if(/<script[^>]+src=["']https?:|eval\s*\(|new Function\s*\(/i.test(text))throw Error('Remote or dynamic code in '+name);
}
await mkdir(out,{recursive:true});await cp(root,out,{recursive:true});
await writeFile('dist/INSTALL.txt','Chrome: chrome://extensions > Developer mode > Load unpacked > extension\n');
console.log('BUILD PASS: offline Manifest V3; 0 permissions; extension packaged at '+out);
