import {configured} from '../lib/_store.js';import {json} from '../lib/_security.js';
export default function handler(req,res){json(res,200,{ok:true,brand:'OnTop',storage:configured()?'ready':'pending',time:new Date().toISOString()});}
