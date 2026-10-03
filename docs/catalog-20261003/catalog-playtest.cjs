const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs');
(async () => {
 const browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=metal']});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 const page=await context.newPage();page.setDefaultTimeout(12000);page.setDefaultNavigationTimeout(12000);page.on('framenavigated',f=>{if(f===page.mainFrame())console.log('URL',f.url())});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const results=[];const check=async (name,fn)=>{await fn();results.push({name,passed:true});console.log("PASS",name);};
 try {
 await page.goto('http://127.0.0.1:4311/p/hou-baolin?view=book');
 await check('alias keyboard search locates Tian Lihe',async()=>{
 const search=page.getByRole('combobox',{name:'搜索人物'});await search.fill('田中敏');await search.press('ArrowDown');await search.press('Enter');await page.waitForURL('**/p/tian-lihe?view=book*');await page.getByRole('heading',{name:'田立禾',exact:true}).waitFor();});
 await page.getByRole('tab',{name:'师承',exact:true}).click();await page.getByRole('tabpanel').getByText('1953年由富寿岩介绍正式拜师',{exact:false}).waitFor();
 await check('verified mentor links and source scope shown',async()=>{await page.getByRole('tabpanel').getByRole('link',{name:'田立禾讲张寿臣艺术风格及师徒情谊'}).waitFor();});
 await page.screenshot({path:__dirname+'/01-tian-mentor-desktop.png',fullPage:true});
 console.log('mentor buttons',await page.getByRole('tabpanel').getByRole('button').allTextContents());await page.getByRole('tabpanel').getByRole('button',{name:/张寿臣/}).click();await page.waitForURL('**/p/zhang-shouchen?view=book*');
 await page.getByRole('button',{name:'← 返回田立禾',exact:true}).click();await page.waitForURL('**/p/tian-lihe?view=book*');results.push({name:'mentor navigation and return',passed:true});
 await page.goto('http://127.0.0.1:4311/p/yang-zhenhua?view=book');await page.getByRole('tab',{name:'师承',exact:true}).click();
 await check('Yang chain includes mentor and disciple',async()=>{await page.getByRole('tabpanel').getByRole('button',{name:'杨海荃',exact:true}).waitFor();await page.getByRole('tabpanel').getByRole('button',{name:'纪元',exact:true}).waitFor();});
 await page.goto('http://127.0.0.1:4311/p/yang-zhenhua?view=tree');await page.locator('.force-label-stats').waitFor();await page.waitForTimeout(600);await page.screenshot({path:__dirname+'/04-yang-tree-desktop.png'});await page.getByRole('button',{name:'人物书笺',exact:true}).click();await page.waitForURL('**/p/yang-zhenhua?view=book');await page.getByRole('heading',{name:'杨振华',exact:true}).waitFor();results.push({name:'new branch tree loads and view switch retains person',passed:true});
 await page.goto('http://127.0.0.1:4311/p/wu-zhaonan?view=book');await page.getByRole('tabpanel').getByText('出生年有异说',{exact:false}).waitFor();await page.screenshot({path:__dirname+'/02-wu-birth-conflict.png',fullPage:true});results.push({name:'birth conflict visible in biography',passed:true});
 await page.goto('http://127.0.0.1:4311/p/ma-zhiming?view=book');await page.getByRole('tab',{name:'师承',exact:true}).click();await page.getByRole('tabpanel').getByText('记录门内师承，不表示朱阔泉直接面授',{exact:false}).waitFor();results.push({name:'proxy ceremony distinct from direct teaching',passed:true});
 await context.close();const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});const mp=await mobile.newPage();mp.setDefaultTimeout(12000);mp.setDefaultNavigationTimeout(12000);mp.on('pageerror',e=>errors.push(e.message));
 await mp.goto('http://127.0.0.1:4311/p/ye-yijun?view=book');await mp.getByRole('tab',{name:'师承',exact:true}).tap();await mp.getByRole('tabpanel').getByText('已确认相声师承',{exact:false}).waitFor();await mp.getByRole('tab',{name:'出处',exact:true}).tap();await mp.getByRole('tabpanel').getByText('田连元属评书师承',{exact:false}).waitFor();await mp.screenshot({path:__dirname+'/03-ye-sources-mobile.png',fullPage:true});
 if(await mp.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('mobile horizontal overflow');results.push({name:'touch narrow screen and reduced motion source access',passed:true});
 await mobile.close();if(errors.length)throw Error(errors.join('\n'));fs.writeFileSync(__dirname+'/browser-verification.json',JSON.stringify({results,errors,desktop:[1440,1000],mobile:[390,844],touch:true,reducedMotion:true},null,2));console.log(JSON.stringify({results,errors}));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
