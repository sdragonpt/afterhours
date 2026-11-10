// Generates the PWA icons (no dependencies). Run: node scripts/make-icons.mjs public
import zlib from 'node:zlib'; import fs from 'node:fs'
const crcT = Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0})
const crc=b=>{let c=~0;for(const x of b)c=crcT[(c^x)&255]^(c>>>8);return (~c)>>>0}
const chunk=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c])}
function seg(px,py,ax,ay,bx,by){const dx=bx-ax,dy=by-ay;const t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy)));return Math.hypot(px-ax-t*dx,py-ay-t*dy)}
function icon(S,pad){const raw=Buffer.alloc((S*3+1)*S);const s=S*(1-2*pad),o=S*pad;const w=s*0.042
 for(let y=0;y<S;y++){raw[y*(S*3+1)]=0;for(let x=0;x<S;x++){const t=(x+y)/(2*S)
  let r=11+(40-11)*t,g=12+(28-12)*t,b=16+(70-16)*t
  const u=(x-o)/s,v=(y-o)/s
  // letter A + accent dot
  const d=Math.min(seg(u,v,.30,.74,.47,.26),seg(u,v,.47,.26,.64,.74),seg(u,v,.37,.56,.57,.56))
  const dot=Math.hypot(u-.75,v-.71)
  if(d*s<w){r=242;g=243;b=248} else if(dot<.045){r=155;g=131;b=255}
  const i=y*(S*3+1)+1+x*3;raw[i]=r;raw[i+1]=g;raw[i+2]=b}}
 const ih=Buffer.alloc(13);ih.writeUInt32BE(S,0);ih.writeUInt32BE(S,4);ih[8]=8;ih[9]=2
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))])}
const out=process.argv[2] || 'public'
fs.writeFileSync(out+'/icon-192.png',icon(192,.08));fs.writeFileSync(out+'/icon-512.png',icon(512,.08))
fs.writeFileSync(out+'/icon-maskable-512.png',icon(512,.2));fs.writeFileSync(out+'/apple-touch-icon.png',icon(180,.08))
