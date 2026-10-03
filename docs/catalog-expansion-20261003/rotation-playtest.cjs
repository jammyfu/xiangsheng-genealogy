const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs');
const edges=JSON.parse(fs.readFileSync(__dirname+'/../../data/edges.json','utf8')).edges;
const discipleCount=edges.filter(e=>e.from==='guo-degang').length;
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=metal']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}); const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4311/p/guo-degang?view=tree');
 await page.waitForTimeout(2000);  await page.screenshot({path:'/tmp/xiangsheng-debug.png'}); await page.locator('.force-label-stats').waitFor({state:'attached',timeout:5000});await page.waitForTimeout(500);
 console.log(await page.locator('.force-label-stats').innerText());
 await page.getByRole('button',{name:/展开全谱 · \d+ 人/}).click();await page.waitForTimeout(2000);
 const evidence=__dirname+'/';
 await page.screenshot({path:evidence+'14-rotation-front.png'});
 const canvas=page.locator('.force-tree-canvas canvas'), rect=await canvas.boundingBox();
 const startUrl=page.url();const observations=[{name:'front',labels:await page.locator('.force-label-stats').innerText()}];
 for(const [name,dx,dy] of [['side',220,0],['tilt',0,145],['reverse',-350,-80]]){
 await page.mouse.move(rect.x+rect.width*.5,rect.y+rect.height*.5);await page.mouse.down();await page.mouse.move(rect.x+rect.width*.5+dx/2,rect.y+rect.height*.5+dy/2,{steps:10});await page.screenshot({path:evidence+'18-mid-drag-'+name+'.png'});await page.mouse.move(rect.x+rect.width*.5+dx,rect.y+rect.height*.5+dy,{steps:10});await page.mouse.up();await page.waitForTimeout(400);
 if(page.url()!==startUrl) throw Error('rotation selected a person');
 observations.push({name,labels:await page.locator('.force-label-stats').innerText()});await page.screenshot({path:evidence+'15-rotation-'+name+'.png'});
 }
 await page.mouse.wheel(0,350);await page.waitForTimeout(400);observations.push({name:'zoom-out',labels:await page.locator('.force-label-stats').innerText()});await page.screenshot({path:evidence+'19-rotation-zoom-out.png'});await page.mouse.wheel(0,-750);await page.waitForTimeout(500);observations.push({name:'zoom-in',labels:await page.locator('.force-label-stats').innerText()});await page.screenshot({path:evidence+'16-rotation-zoom.png'});
 await page.getByRole('button',{name:'返回当前人物并重置缩放'}).click();await page.waitForTimeout(1000);
 await page.locator('.force-tree-directory summary').click();await page.getByRole('button',{name:`弟子 · ${discipleCount}`,exact:true}).click();await page.getByRole('textbox',{name:'检索师承导航'}).fill('岳');await page.getByRole('button',{name:'岳云鹏，查看师承主线'}).press('Enter');await page.waitForURL('**/p/yue-yunpeng?view=tree');await page.waitForTimeout(350);
 await page.getByRole('button',{name:'人物书笺',exact:true}).click();await page.getByRole('heading',{name:'岳云鹏',exact:true}).waitFor();await page.getByRole('button',{name:'← 返回郭德纲',exact:true}).click();await page.waitForURL('**/p/guo-degang?view=tree');
 await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await page.locator('.force-label-stats').waitFor();await page.waitForTimeout(300);
 await page.locator('.force-tree-directory summary').click();await page.getByRole('button',{name:'师父 · 1',exact:true}).press('Escape');const close=await page.locator('.force-tree-directory').evaluate(el=>({open:el.open,focus:document.activeElement?.tagName}));if(close.open||close.focus!=='SUMMARY')throw Error('Escape failed');
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);await page.screenshot({path:evidence+'17-tree-mobile-final.png'});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(overflow)throw Error('mobile overflow');
 await page.emulateMedia({reducedMotion:'no-preference'});await page.setViewportSize({width:1440,height:1000});
 fs.writeFileSync(evidence+'rotation-verification.json',JSON.stringify({observations,errors,close,overflow,dragDidNotNavigate:true,reducedMotionRestored:true},null,2));console.log(JSON.stringify({observations,errors,close,overflow}));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
