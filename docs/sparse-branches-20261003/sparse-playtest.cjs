const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const fs=require('fs');
const root=__dirname+'/verification/';
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=metal']});
 const errors=[],checks=[];
 const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));
 const open=async(id,name,p=page)=>{await p.goto(`http://127.0.0.1:4311/p/${id}?view=book`,{waitUntil:'domcontentloaded',timeout:30000});await p.getByRole('heading',{name,exact:true}).waitFor();await p.getByRole('tab',{name:'师承',exact:true}).click();};
 for(const [id,name,names] of [
  ['tang-jiezhong','唐杰忠',['朱琦','崔喜跃','刘全刚']],['shi-shengjie','师胜杰',['刘彤','常远','刘伟（师胜杰弟子）']],
  ['su-wenmao','苏文茂',['武福星','苏世杰','郭新']],['yin-xiaosheng','尹笑声',['刘晖','张乃林']],
  ['tian-lihe','田立禾',['耿伯扬','肖栋']],['chang-baofeng','常宝丰',['张颂阳','马小川']],
  ['wei-wenliang','魏文亮',['张文斌','武魁海','罗峰','寇艺']],['yang-haiquan','杨海荃',['金炳昶','傅兰英']],
  ['yang-zhenhua','杨振华',['戴向','刘金贵']],['li-shouzeng','李寿增',['孙少林']],
  ['wang-shichen','王世臣',['李文山','谢金']],['zhang-yongxi','张永熙',['吕少明','马克']]]){
  await open(id,name);for(const n of names)await page.getByRole('tabpanel').getByRole('button',{name:n,exact:true}).waitFor();checks.push(name+' branch');
  if(['tang-jiezhong','shi-shengjie','wei-wenliang'].includes(id))await page.screenshot({path:root+id+'-desktop.png',fullPage:true});
 }
 await open('tang-jiezhong','唐杰忠');const evidence=page.getByRole('tabpanel').locator('details');if(await evidence.getAttribute('open')!==null)throw Error('large branch evidence should start collapsed');await evidence.locator('summary').press('Enter');if(await evidence.getAttribute('open')===null)throw Error('keyboard evidence expansion failed');await evidence.locator('summary').press('Enter');checks.push('large branch evidence keyboard expand/close');await page.getByRole('tabpanel').getByRole('button',{name:'崔喜跃',exact:true}).click();await page.getByRole('heading',{name:'崔喜跃',exact:true}).waitFor();await page.getByRole('tab',{name:'师承',exact:true}).click();await page.getByRole('tabpanel').getByRole('button',{name:'马菁原',exact:true}).click();await page.getByRole('heading',{name:'马菁原',exact:true}).waitFor();await page.getByRole('button',{name:'← 返回崔喜跃',exact:true}).click();await page.getByRole('heading',{name:'崔喜跃',exact:true}).waitFor();checks.push('two-level disciple drilldown and return');
 await open('huang-junying','黄俊英');await page.getByRole('tab',{name:'出处',exact:true}).click();await page.screenshot({path:root+'canton-desktop.png',fullPage:true});checks.push('Canton actor has institutional source');
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});const mp=await mobile.newPage();mp.on('pageerror',e=>errors.push(e.message));await open('chang-baofeng','常宝丰',mp);await mp.getByRole('tabpanel').getByRole('button',{name:'张颂阳',exact:true}).tap();await mp.getByRole('heading',{name:'张颂阳',exact:true}).waitFor();await mp.getByRole('tab',{name:'师承',exact:true}).tap();await mp.getByRole('tabpanel').getByRole('button',{name:'崔鸣晧',exact:true}).tap();await mp.getByRole('heading',{name:'崔鸣晧',exact:true}).waitFor();await mp.getByRole('button',{name:'← 返回张颂阳',exact:true}).tap();await mp.getByRole('heading',{name:'张颂阳',exact:true}).waitFor();await mp.getByRole('tab',{name:'师承',exact:true}).tap();await mp.screenshot({path:root+'chang-next-generation-mobile.png',fullPage:true});if(await mp.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('overflow');checks.push('mobile touch next generation return and reduced motion');
 await mp.getByRole('combobox',{name:'搜索人物'}).fill('盛京小媄');await mp.getByRole('combobox',{name:'搜索人物'}).press('ArrowDown');await mp.getByRole('combobox',{name:'搜索人物'}).press('Enter');await mp.getByRole('heading',{name:'戴向',exact:true}).waitFor();checks.push('alias keyboard search');
 if(errors.length)throw Error(errors.join('\n'));fs.writeFileSync(root+'sparse-browser-results.json',JSON.stringify({checks,errors,desktop:[1440,1000],mobile:[390,844],touch:true,reducedMotion:true},null,2));console.log(JSON.stringify({checks,errors}));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
