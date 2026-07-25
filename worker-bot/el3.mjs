import { createPublicClient, http, parseAbiItem } from 'viem';
import { celo } from 'viem/chains';
import { writeFileSync, appendFileSync } from 'fs';
const log=(...a)=>{ appendFileSync('el.log', a.join(' ')+'\n'); };
writeFileSync('el.log','start '+new Date().toISOString()+'\n');
const inkChain={id:57073,name:'ink',nativeCurrency:{name:'ETH',symbol:'ETH',decimals:18},rpcUrls:{default:{http:['https://rpc-gel.inkonchain.com']}}};
const EVC=parseAbiItem('event IOUCreated(uint256 indexed iouId, address indexed sender, bytes32 indexed recipientId, uint256 grossAmount, uint256 netAmount, uint256 fee, uint64 expiry)');
const IOUS=[{type:'function',name:'ious',stateMutability:'view',inputs:[{type:'uint256'}],outputs:[
 {name:'sender',type:'address'},{name:'g',type:'uint256'},{name:'n',type:'uint256'},{name:'rid',type:'bytes32'},{name:'expiry',type:'uint64'},{name:'claimed',type:'bool'},{name:'refunded',type:'bool'}]}];
async function blockAtTime(cl,targetTs){ let lo=1n,hi=await cl.getBlockNumber();
  while(lo<hi){const mid=(lo+hi)/2n;const b=await cl.getBlock({blockNumber:mid});
    if(Number(b.timestamp)<targetTs)lo=mid+1n;else hi=mid;} return lo; }
const JOBS=[
 {chain:'celo',reg:'0x6bB3C64C382fcF8fB65b24234C455bB62b155742',cl:createPublicClient({chain:celo,transport:http('https://forno.celo.org')}),ids:[41,47,50,51,52,53,54,55,59]},
 {chain:'ink',reg:'0xD294Ecaa25f9122FD3e16014D2f4923fEf874a08',cl:createPublicClient({chain:inkChain,transport:http('https://rpc-gel.inkonchain.com')}),ids:[6,13]},
];
const results={};
for(const J of JOBS){ results[J.chain]={};
  for(const id of J.ids){ try{
    const o=await J.cl.readContract({address:J.reg,abi:IOUS,functionName:'ious',args:[BigInt(id)]});
    const expiryTs=Number(o[4]); const anchor=expiryTs-180*86400;
    const b=await blockAtTime(J.cl,anchor); log(`${J.chain} #${id} anchor=${b}`);
    let created=null;
    for(const [f,t] of [[b-2500n,b+2499n],[b-7500n,b-2501n],[b+2500n,b+7499n],[b-15000n,b-7501n]]){
      const lg=await J.cl.getLogs({address:J.reg,event:EVC,args:{iouId:BigInt(id)},fromBlock:f<1n?1n:f,toBlock:t});
      if(lg.length){const blk=await J.cl.getBlock({blockNumber:lg[0].blockNumber});created={log:lg[0],ts:Number(blk.timestamp)};break;}
    }
    results[J.chain][id]={id,state:o[5]?'claimed':(o[6]?'refunded':'pending'),sender:o[0],rid:o[3],gross:Number(o[1])/1e6,net:Number(o[2])/1e6,expiry:new Date(expiryTs*1000).toISOString(),
      tx_hash_create:created?created.log.transactionHash:null,created_at:created?new Date(created.ts*1000).toISOString():null,block:created?Number(created.log.blockNumber):null};
    log(`   ${J.chain} #${id} tx=${results[J.chain][id].tx_hash_create||'NF'} at=${results[J.chain][id].created_at||'?'}`);
    writeFileSync('event-logs.json', JSON.stringify(results,null,2));
  }catch(e){ log(`${J.chain} #${id} ERR ${(e.shortMessage||e.message||'').slice(0,160)}`);} }
}
log('DONE');
