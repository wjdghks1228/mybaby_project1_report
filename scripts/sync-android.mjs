import {cp,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
await mkdir(resolve(root,'android/app/src/main/assets'),{recursive:true});
await cp(resolve(root,'app'),resolve(root,'android/app/src/main/assets'),{recursive:true});
console.log('Android 앱 자산 동기화 완료');
