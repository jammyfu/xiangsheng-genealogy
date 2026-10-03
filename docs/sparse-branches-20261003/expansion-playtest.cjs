const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs');
const catalogCount=fs.readdirSync(__dirname+'/../../data/people').filter(f=>f.endsWith('.json')).length;
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=metal']});
 const errors=[],checks=[];const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();page.setDefaultTimeout(12000);page.setDefaultNavigationTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
 const check=async(name,fn)=>{await fn();checks.push({name,passed:true});console.log('PASS',name)};
 try{
 await check('old duplicate URL preserves tree mode on canonical person',async()=>{await page.goto('http://127.0.0.1:4311/p/zhu-yunfeng?view=tree');await page.waitForURL('**/p/shao-bing?view=tree');await page.locator('.force-label-stats').waitFor()});
 await page.goto('http://127.0.0.1:4311/p/liu-zengkai?view=book');
 await check('traditional name search finds single canonical Liu',async()=>{const search=page.getByRole('combobox',{name:'搜索人物'});await search.fill('劉增鍇');await search.press('ArrowDown');await search.press('Enter');await page.waitForURL('**/p/liu-zengkai?view=book');await page.getByRole('heading',{name:'刘增锴',exact:true}).waitFor()});
 await page.getByRole('tab',{name:'师承',exact:true}).click();
 await check('new Taiwan branch has mentor and four verified disciples',async()=>{for(const name of ['吴兆南','姬天语','艾天意','乔天蓝','施天天'])await page.getByRole('tabpanel').getByRole('button',{name,exact:true}).waitFor()});
 await page.screenshot({path:__dirname+'/01-liu-lineage-desktop.png',fullPage:true});
 await page.getByRole('tabpanel').getByRole('button',{name:'姬天语',exact:true}).click();await page.waitForURL('**/p/ji-tianyu?view=book');await page.getByRole('button',{name:'← 返回刘增锴',exact:true}).click();await page.waitForURL('**/p/liu-zengkai?view=book');checks.push({name:'new disciple navigation and contextual return',passed:true});
 await page.goto('http://127.0.0.1:4311/p/wu-zhaonan?view=tree');await page.locator('.force-label-stats').waitFor();
 await check(`${catalogCount}-person catalog can fully expand`,async()=>{await page.getByRole('button',{name:`展开全谱 · ${catalogCount} 人`,exact:true}).click();await page.waitForTimeout(1200);await page.locator('.force-label-stats').waitFor()});
 await page.screenshot({path:__dirname+'/02-full-catalog-desktop.png'});
 await page.getByRole('button',{name:'人物书笺',exact:true}).click();await page.waitForURL('**/p/wu-zhaonan?view=book');checks.push({name:'view switch retains selected Wu',passed:true});
 await page.goto('http://127.0.0.1:4311/p/yao-xinguang?view=book');await page.getByRole('tab',{name:'师承',exact:true}).click();
 await check('Yao overseas branch shows corroborated ceremony and both disciples',async()=>{await page.getByRole('tabpanel').getByText('1990年5月15日',{exact:false}).waitFor();for(const name of ['苏维胜','纪庆荣'])await page.getByRole('tabpanel').getByRole('button',{name,exact:true}).waitFor()});
 await page.screenshot({path:__dirname+'/03-yao-overseas-desktop.png',fullPage:true});
 await page.goto('http://127.0.0.1:4311/p/shao-bing?view=book');
 await check('merged alias search yields only one actor',async()=>{const search=page.getByRole('combobox',{name:'搜索人物'});await search.fill('朱云峰');await page.getByRole('listbox').waitFor();if(await page.getByRole('option').count()!==1)throw Error('duplicate alias results');await search.press('ArrowDown');await search.press('Enter');await page.waitForURL('**/p/shao-bing?view=book')});
 await context.close();const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});const mp=await mobile.newPage();mp.setDefaultTimeout(12000);mp.on('pageerror',e=>errors.push(e.message));
 await mp.goto('http://127.0.0.1:4311/p/duan-yanxi?view=book');
 await check('ambiguous mixed-art ceremony remains visible without false mentor',async()=>{await mp.getByRole('tab',{name:'师承',exact:true}).tap();await mp.getByRole('tabpanel').getByText('暂不转换为相声本师连线',{exact:false}).waitFor();await mp.getByRole('tab',{name:'师承',exact:true}).tap();if(await mp.getByRole('tabpanel').getByRole('button',{name:'叶怡均',exact:true}).count())throw Error('false mentor');await mp.getByRole('tab',{name:'出处',exact:true}).tap()});
 await mp.screenshot({path:__dirname+'/04-ambiguity-mobile.png',fullPage:true});
 await mp.goto('http://127.0.0.1:4311/p/xu-huimin?view=book');await mp.getByRole('tab',{name:'师承',exact:true}).tap();await mp.getByRole('tabpanel').getByText('仪式年份有异说',{exact:false}).waitFor();await mp.getByRole('tabpanel').getByRole('button',{name:'李耀光',exact:true}).tap();await mp.waitForURL('**/p/li-yaoguang?view=book');await mp.getByRole('button',{name:'← 返回徐惠民',exact:true}).tap();await mp.waitForURL('**/p/xu-huimin?view=book');await mp.getByRole('heading',{name:'徐惠民',exact:true}).waitFor();await mp.getByRole('tab',{name:'师承',exact:true}).tap();await mp.getByRole('tab',{name:'师承',exact:true}).tap();await mp.getByRole('tabpanel').getByText('仪式年份有异说',{exact:false}).waitFor();
 await mp.screenshot({path:__dirname+'/05-xu-mobile.png',fullPage:true});if(await mp.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('mobile horizontal overflow');checks.push({name:'touch return, narrow screen, reduced-motion and year conflict',passed:true});
 if(errors.length)throw Error(errors.join('\n'));fs.writeFileSync(__dirname+'/browser-verification.json',JSON.stringify({checks,errors,desktop:[1440,1000],mobile:[390,844],touch:true,reducedMotion:true},null,2));console.log(JSON.stringify({checks,errors}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
