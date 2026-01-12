// 删除不需要的语言包，只保留中文和英文
const fs = require('fs');
const path = require('path');

exports.default = async function(context) {
  const localesPath = path.join(context.appOutDir, 'locales');
  
  if (!fs.existsSync(localesPath)) {
    console.log('locales 目录不存在，跳过');
    return;
  }
  
  // 保留的语言：只保留中文和英文（美国）
  const keepLocales = ['zh-CN.pak', 'en-US.pak'];
  
  const files = fs.readdirSync(localesPath);
  let removed = 0;
  let savedMB = 0;
  
  for (const file of files) {
    if (!keepLocales.includes(file)) {
      const filePath = path.join(localesPath, file);
      const stats = fs.statSync(filePath);
      savedMB += stats.size / 1024 / 1024;
      fs.unlinkSync(filePath);
      removed++;
    }
  }
  
  console.log(`✓ 清理语言包: 删除 ${removed} 个文件, 节省 ${savedMB.toFixed(1)} MB`);
};

