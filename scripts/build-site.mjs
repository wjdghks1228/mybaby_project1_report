import {readFile,readdir,mkdir,writeFile,copyFile} from 'node:fs/promises';
import {resolve,relative,extname} from 'node:path';
const root=resolve(import.meta.dirname,'..'),assets={};
const types={'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.html':'text/html; charset=utf-8','.png':'image/png','.json':'application/json; charset=utf-8'};
async function collect(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=resolve(dir,entry.name);if(entry.isDirectory())await collect(path);else if(entry.isFile()&&types[extname(path)])assets['/'+relative(resolve(root,'app'),path).replaceAll('\\','/')]={type:types[extname(path)],data:(await readFile(path)).toString('base64')};}}
await collect(resolve(root,'app'));
const model=(await readFile(resolve(root,'app/model.js'),'utf8')).replaceAll('export ','');
const prepCatalog=(await readFile(resolve(root,'app/preparation-catalog.js'),'utf8')).replaceAll('export ','');
const prepModel=(await readFile(resolve(root,'app/preparation-model.js'),'utf8')).replace("import {PREP_ITEMS} from './preparation-catalog.js';",'').replaceAll('export ','');
const worker=(await readFile(resolve(root,'cloud/worker.js'),'utf8')).replace("import {validate} from '../app/model.js';",'').replace("import {validatePreparation} from '../app/preparation-model.js';",'');
await mkdir(resolve(root,'dist/server'),{recursive:true});
await mkdir(resolve(root,'dist/.openai'),{recursive:true});
await writeFile(resolve(root,'dist/server/index.js'),`const STATIC_ASSETS=${JSON.stringify(assets)};\n${model}\n${prepCatalog}\n${prepModel}\n${worker}`);
await copyFile(resolve(root,'.openai/hosting.json'),resolve(root,'dist/.openai/hosting.json'));
console.log(`Sites Worker build: ${Object.keys(assets).length} assets embedded`);
