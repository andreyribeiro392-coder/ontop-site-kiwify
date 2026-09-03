import {cors} from '../lib/_security.js';

export default async function handler(req,res){
  cors(req,res);
  if(req.method==='OPTIONS'){res.status(204).end();return;}
  if(req.method!=='GET'){res.status(405).json({error:'Método não permitido.'});return;}
  try{
    const raw=String(req.query?.url||'');
    const target=new URL(raw);
    if(target.protocol!=='https:'||target.hostname!=='images.pexels.com')return res.status(400).json({error:'URL de mídia não permitida.'});
    const upstream=await fetch(target,{signal:AbortSignal.timeout(12000),headers:{Accept:'image/avif,image/webp,image/jpeg,image/*;q=0.8'}});
    if(!upstream.ok)return res.status(502).json({error:'Prévia indisponível.'});
    const contentType=upstream.headers.get('content-type')||'image/jpeg';
    const bytes=Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type',contentType);
    res.setHeader('Cache-Control','public, max-age=86400, stale-while-revalidate=604800');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.status(200).send(bytes);
  }catch{
    res.status(502).json({error:'Prévia indisponível.'});
  }
}
