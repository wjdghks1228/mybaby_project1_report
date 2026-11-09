import {DatabaseSync} from 'node:sqlite';
export function database(schema){
 const raw=new DatabaseSync(':memory:');raw.exec('PRAGMA foreign_keys=ON;');raw.exec(schema);let tail=Promise.resolve();
 const DB={prepare(sql){return {bind(...values){return {first:async()=>raw.prepare(sql).get(...values)??null,all:async()=>({results:raw.prepare(sql).all(...values)}),run:async()=>({meta:{changes:Number(raw.prepare(sql).run(...values).changes)}})};}};},batch(statements){const job=tail.then(async()=>{raw.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());raw.exec('COMMIT');return results;}catch(e){raw.exec('ROLLBACK');throw e;}});tail=job.catch(()=>{});return job;}};
 return {DB,raw,close:()=>raw.close()};
}
