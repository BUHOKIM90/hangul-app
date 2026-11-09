import subprocess, numpy as np, json, os, sys
d=sys.argv[1]; out={}; KEEP=set(); dropped=[]  # v6.3.2: all clips are clean neural recordings; trim every one; dropped=[]
for f in sorted(os.listdir(d)):
    if not f.endswith('.mp3'): continue
    k=f[:-4]
    raw=subprocess.run(['ffmpeg','-v','quiet','-i',os.path.join(d,f),'-ac','1','-ar','22050','-f','s16le','-'],capture_output=True).stdout
    x=np.frombuffer(raw,dtype=np.int16).astype(np.float32)/32768; sr=22050; dur=len(x)/sr
    if k in KEEP: out[k]=[0,round(dur,3),round(dur,3)]; continue
    fl=int(sr*0.01); n=len(x)//fl
    db=20*np.log10(np.sqrt((x[:n*fl].reshape(n,fl)**2).mean(1)+1e-12))
    peak=db.max(); act=db>max(peak-35,-55)
    segs=[]; i=0
    while i<n:
        if act[i]:
            j=i
            while j<n and act[j]: j+=1
            if segs and i-segs[-1][1]<=12: segs[-1][1]=j
            else: segs.append([i,j])
            i=j
        else: i+=1
    loud=[s for s in segs if db[s[0]:s[1]].max()>peak-20 and s[1]-s[0]>=4]
    if not loud: loud=segs
    s0=loud[0][0]; s1=loud[-1][1]
    if segs[0][0]<s0 or segs[-1][1]>s1: dropped.append(k)
    st=max(0,s0*0.01-0.02); en=min(dur,s1*0.01+0.07)
    out[k]=[round(st,3),round(en,3),round(dur,3)]
json.dump(out,open(sys.argv[2],'w'),separators=(',',':'))
print(len(out),'noise-dropped',len(dropped),dropped[:30])
