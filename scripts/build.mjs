import fs from 'node:fs';
fs.rmSync('dist',{recursive:true,force:true});fs.mkdirSync('dist');
const extensions=['.html','.css','.js','.svg','.png','.webmanifest'];
for(const f of fs.readdirSync('.'))if(fs.statSync(f).isFile()&&extensions.some(x=>f.endsWith(x)))fs.copyFileSync(f,'dist/'+f);
fs.copyFileSync('course-data.json','dist/course-data.json');fs.cpSync('assets','dist/assets',{recursive:true});
console.log('Static output prepared; server content excluded.');
