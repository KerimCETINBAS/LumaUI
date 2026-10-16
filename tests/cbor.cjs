const assert=require('node:assert/strict');
function decodeCBOR(buffer) {
 let offset=0;
 function read() {
  const byte=buffer[offset++],major=byte>>5,info=byte&31;
  if(major===7){if(info===20)return false;if(info===21)return true;if(info===27){const value=buffer.readDoubleBE(offset);offset+=8;return value;}throw Error('Unsupported CBOR simple value');}
  let count=info;
  if(info>=24){const bytes={24:1,25:2,26:4}[info];assert.ok(bytes);count=buffer.readUIntBE(offset,bytes);offset+=bytes;}
  if(major===0)return count;if(major===1)return -1-count;
  if(major===3){const value=buffer.subarray(offset,offset+count).toString('utf8');offset+=count;return value;}
  if(major===4)return Array.from({length:count},read);
  if(major===5){const value={};for(let i=0;i<count;i++)value[read()]=read();return value;}
  throw Error('Unsupported CBOR major type');
 }
 const value=read();assert.equal(offset,buffer.length);return value;
}
module.exports={decodeCBOR};
