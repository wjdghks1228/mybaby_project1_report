export const WIDGET_ACTIONS=['sleep','feeding','temperature','diaper'];
export function createWidgetEntry({read,status,render,open,close,finish,main,setMode,setTimer=setTimeout}){
 let active=false,pending=null,completed=false,generation=0;
 function enter(action){if(!WIDGET_ACTIONS.includes(action))return false;generation++;active=true;pending=action;completed=false;close();setMode(true);render();return true;}
 function leave(){generation++;active=false;pending=null;completed=false;setMode(false);close();}
 function tryOpen(){const s=status();if(!active||!pending||!read().child||s.connected&&(!s.unlocked||s.busy))return;const action=pending;pending=null;open(action);}
 function cancel(){leave();finish();}
 function goMain(){leave();main();render();}
 async function saved(sync){if(!active)return;const ticket=generation;completed=true;render();await Promise.all([new Promise(resolve=>setTimer(resolve,1000)),Promise.resolve().then(()=>sync?.()).catch(()=>{})]);if(active&&generation===ticket){leave();finish();}}
 return {enter,tryOpen,cancel,goMain,saved,info:()=>({active,pending,completed})};
}
