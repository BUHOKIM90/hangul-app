#!/bin/bash
# Usage: release_check.sh <repo>
cd "$1" || exit 1
fail=0
for f in sy_C774 sy_C6B0 sy_C73C; do
  a=$(git show 8503741:audio/$f.mp3 | sha256sum | cut -c1-16); b=$(sha256sum audio/$f.mp3 | cut -c1-16)
  [ "$a" = "$b" ] && echo "OK  $f byte-identical" || { echo "BAD $f changed"; fail=1; }
done
node -e "
const fs=require('fs');const sw=fs.readFileSync('sw.js','utf8');
const F=JSON.parse(sw.match(/const FILES = (\[.*?\]);/)[1]);const c=sw.match(/const CACHE = \"([^\"]+)\"/)[1];
const miss=F.filter(f=>f!=='./'&&!fs.existsSync(f));
console.log((miss.length?'BAD':'OK ')+' sw FILES '+F.length+' missing='+miss.length+' CACHE='+c);
if(miss.length){console.log(miss);process.exit(1)}"  || fail=1
grep -q 'user-scalable=no' index.html && echo "OK  kid viewport user-scalable=no" || { echo "BAD viewport"; fail=1; }
exit $fail
