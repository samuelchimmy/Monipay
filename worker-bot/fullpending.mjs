import { createPublicClient, http } from 'viem';
import { celo, base, bsc } from 'viem/chains';
const inkChain={id:57073,name:'ink',nativeCurrency:{name:'ETH',symbol:'ETH',decimals:18},rpcUrls:{default:{http:['https://rpc-gel.inkonchain.com']}}};
const ABI=[{type:'function',name:'ious',stateMutability:'view',inputs:[{type:'uint256'}],outputs:[
 {name:'sender',type:'address'},{name:'g',type:'uint256'},{name:'n',type:'uint256'},{name:'rid',type:'bytes32'},{name:'expiry',type:'uint64'},{name:'claimed',type:'bool'},{name:'refunded',type:'bool'}]},
 {type:'function',name:'nextId',stateMutability:'view',inputs:[],outputs:[{type:'uint256'}]}];
const st=o=>o[5]?'claimed':(o[6]?'refunded':'pending');
const CH=[
 {chain:'celo',dec:6,sym:'USDT',A:createPublicClient({chain:celo,transport:http('https://forno.celo.org')}),B:createPublicClient({chain:celo,transport:http('https://rpc.ankr.com/celo')}),reg:'0x6bB3C64C382fcF8fB65b24234C455bB62b155742'},
 {chain:'base',dec:6,sym:'USDC',A:createPublicClient({chain:base,transport:http('https://base-rpc.publicnode.com')}),B:createPublicClient({chain:base,transport:http('https://mainnet.base.org')}),reg:'0x1945c633659Ae71991aE37eE2Bdfe64E00514650'},
 {chain:'bsc',dec:18,sym:'USDT',A:createPublicClient({chain:bsc,transport:http('https://bsc-dataseed.binance.org')}),B:createPublicClient({chain:bsc,transport:http('https://bsc-rpc.publicnode.com')}),reg:'0xF602b559eE5c51ED122F667d101be105d9eDf90d'},
 {chain:'ink',dec:6,sym:'USDT0',A:createPublicClient({chain:inkChain,transport:http('https://rpc-gel.inkonchain.com')}),B:createPublicClient({chain:inkChain,transport:http('https://rpc-qnd.inkonchain.com')}),reg:'0xD294Ecaa25f9122FD3e16014D2f4923fEf874a08'},
];
// sender wallet -> resolved identity (from Query1 profiles + wallet_profiles)
const SENDER={
 '0xd468e3c99b8045a985dc21bf313d0abb133fbc50':{tag:'jade',type:'profiles',id:'d438bb8e-5b38-4309-ba45-753d8a74f814'},
 '0x2325c3c1bfa18043c719c24d2f7ca060a76c5ccc':{tag:'utdkhare',type:'profiles',id:'63e2bf3a-2c7c-4249-9a27-4e7d71784b17'},
 '0xa7150dca798d7cc9cd5d03f6efa49b8e9648eef8':{tag:'hertfordharry',type:'wallet_profiles(MiniPay)',id:'(no profiles row)'},
 '0x851cea56de6edd1c9fa3f237a6399a8e6f883d17':{tag:'dave',type:'profiles',id:'85cac78a-eb8e-4c4b-8308-3b46c9e126ec'},
 '0xfa2b28112956e40b5d2b735cbd7db5ee4b93a0f2':{tag:'jap',type:'profiles',id:'4014574f-6430-4482-8c69-3c1f93511360'},
 '0x9bfc5f7186f91b14a76a75a8348a06ff1c9d29cd':{tag:'?',type:'unknown',id:''},
 '0x2325c3c1bfa18043c719c24d2f7ca060a76c5ccc':{tag:'utdkhare',type:'profiles',id:'63e2bf3a-2c7c-4249-9a27-4e7d71784b17'},
 '0x8eca78d51091f49f381b084d9494e16ab252638f':{tag:'?',type:'unknown',id:''},
 '0xd84951a671e49625ced17a85dcff2b990dae51cc':{tag:'?',type:'unknown',id:''},
};
// create-tx + created_at for the celo/ink orphans (from event-logs.json)
import { readFileSync, existsSync } from 'fs';
let EL={}; if(existsSync('event-logs.json')) EL=JSON.parse(readFileSync('event-logs.json','utf8'));
function meta(chain,id){ const r=EL?.[chain]?.[String(id)]; return r?{tx:r.tx_hash_create,at:r.created_at}:{}; }

const rows=[];
for(const c of CH){
  let count=0n; try{count=await c.A.readContract({address:c.reg,abi:ABI,functionName:'nextId'});}catch(e){count=BigInt(c.chain==='celo'?66:c.chain==='ink'?14:c.chain==='base'?3:2);}
  for(let i=0n;i<count;i++){
    const [a,b]=await Promise.all([c.A.readContract({address:c.reg,abi:ABI,functionName:'ious',args:[i]}),c.B.readContract({address:c.reg,abi:ABI,functionName:'ious',args:[i]})]);
    if(a[0]==='0x0000000000000000000000000000000000000000')continue;
    if(st(a)!=='pending')continue;
    const agree=st(a)===st(b);
    const s=SENDER[a[0].toLowerCase()]||{tag:'?',type:'unknown',id:''};
    const m=meta(c.chain,Number(i));
    rows.push({chain:c.chain,iou:Number(i),sym:c.sym,net:Number(a[2])/10**c.dec,gross:Number(a[1])/10**c.dec,
      rid:a[3],expiry:new Date(Number(a[4])*1000).toISOString().slice(0,10),
      sender:a[0],sender_tag:s.tag,sender_type:s.type,sender_id:s.id,create_tx:m.tx||'',created_at:m.at?m.at.slice(0,19).replace('T',' '):'',rpc:agree?'ok':'DISAGREE'});
  }
}
import { writeFileSync } from 'fs';
writeFileSync('full-pending.json',JSON.stringify(rows,null,2));
console.log('TOTAL PENDING:',rows.length);
for(const r of rows) console.log(`${r.chain} #${r.iou} | ${r.net} ${r.sym} | sender ${r.sender_tag} (${r.sender.slice(0,10)}) | exp ${r.expiry} | ${r.rpc}`);
const byChain={}; for(const r of rows){byChain[r.chain]=byChain[r.chain]||{n:0,v:0};byChain[r.chain].n++;byChain[r.chain].v+=r.net;}
console.log('\nby chain:',JSON.stringify(byChain));
