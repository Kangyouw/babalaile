// 语法检查脚本 - 确保_worker.js文件语法正确
const fs = require('fs');
const path = require('path');

// 定义要检查的文件路径
const workerFilePath = path.join(__dirname, '_worker.js');

/**
 * 检查文件语法
 */
function checkFileSyntax() {
  try {
    console.log('开始检查_worker.js文件语法...');
    
    // 读取文件内容
    const content = fs.readFileSync(workerFilePath, 'utf8');
    console.log(`文件总行数: ${content.split('\n').length}`);
    
    // 检查引号匹配
    checkQuotes(content);
    
    // 检查括号匹配
    checkBrackets(content);
    
    // 检查export default结构
    checkExportDefault(content);
    
    // 尝试使用eval检查基本语法（注意：这不会执行代码）
    try {
      // 移除import语句，因为Node环境不支持Cloudflare的import语法
      const codeWithoutImports = content.replace(/^import.*$/gm, '');
      // 移除实际执行但在检查环境中会报错的代码
      const checkableCode = codeWithoutImports.replace(/export\s+default[\s\S]*$/, '');
      
      // 尝试解析代码
      new Function(checkableCode);
      console.log('✓ 基本语法检查通过');
    } catch (evalError) {
      console.error('✗ 基本语法检查失败:', evalError.message);
    }
    
    console.log('语法检查完成！');
    
  } catch (error) {
    console.error('文件读取或检查过程中发生错误:', error.message);
  }
}

/**
 * 检查引号匹配
 * @param {string} content - 文件内容
 */
function checkQuotes(content) {
  const singleQuoteCount = (content.match(/'/g) || []).length;
  const doubleQuoteCount = (content.match(/"/g) || []).length;
  const backtickCount = (content.match(/`/g) || []).length;
  
  console.log(`单引号数量: ${singleQuoteCount} (${singleQuoteCount % 2 === 0 ? '偶数 ✓' : '奇数 ✗'})`);
  console.log(`双引号数量: ${doubleQuoteCount} (${doubleQuoteCount % 2 === 0 ? '偶数 ✓' : '奇数 ✗'})`);
  console.log(`反引号数量: ${backtickCount} (${backtickCount % 2 === 0 ? '偶数 ✓' : '奇数 ✗'})`);
  
  // 检查是否有未闭合的引号
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktick = false;
  let escaped = false;
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    
    if (escaped) {
      escaped = false;
      continue;
    }
    
    if (char === '\\') {
      escaped = true;
      continue;
    }
    
    if (char === "'" && !inDoubleQuote && !inBacktick) {
      inSingleQuote = !inSingleQuote;
    } else if (char === '"' && !inSingleQuote && !inBacktick) {
      inDoubleQuote = !inDoubleQuote;
    } else if (char === '`' && !inSingleQuote && !inDoubleQuote) {
      inBacktick = !inBacktick;
    }
  }
  
  if (inSingleQuote) console.error('✗ 存在未闭合的单引号');
  if (inDoubleQuote) console.error('✗ 存在未闭合的双引号');
  if (inBacktick) console.error('✗ 存在未闭合的反引号');
}

/**
 * 检查括号匹配
 * @param {string} content - 文件内容
 */
function checkBrackets(content) {
  const brackets = {
    '(': ')',
    '[': ']',
    '{': '}'
  };
  
  const openBrackets = Object.keys(brackets);
  const closeBrackets = Object.values(brackets);
  const stack = [];
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    
    if (openBrackets.includes(char)) {
      stack.push(char);
    } else if (closeBrackets.includes(char)) {
      const lastOpen = stack.pop();
      if (!lastOpen || brackets[lastOpen] !== char) {
        console.error(`✗ 括号不匹配：位置 ${i + 1} 的 ${char}`);
      }
    }
  }
  
  if (stack.length > 0) {
    console.error(`✗ 存在未闭合的括号: ${stack.join(', ')}`);
  } else {
    console.log('✓ 所有括号匹配正确');
  }
  
  // 统计每种括号的数量
  const openParenthesisCount = (content.match(/\(/g) || []).length;
  const closeParenthesisCount = (content.match(/\)/g) || []).length;
  const openBracketCount = (content.match(/\[/g) || []).length;
  const closeBracketCount = (content.match(/\]/g) || []).length;
  const openCurlyCount = (content.match(/\{/g) || []).length;
  const closeCurlyCount = (content.match(/\}/g) || []).length;
  
  console.log(`小括号: (${openParenthesisCount}) - )${closeParenthesisCount} (${openParenthesisCount === closeParenthesisCount ? '匹配 ✓' : '不匹配 ✗'})`);
  console.log(`中括号: [${openBracketCount}] - ]${closeBracketCount} (${openBracketCount === closeBracketCount ? '匹配 ✓' : '不匹配 ✗'})`);
  console.log(`大括号: {${openCurlyCount}} - }${closeCurlyCount} (${openCurlyCount === closeCurlyCount ? '匹配 ✓' : '不匹配 ✗'})`);
}

/**
 * 检查export default结构
 * @param {string} content - 文件内容
 */
function checkExportDefault(content) {
  // 检查是否有export default
  const exportDefaultMatch = content.match(/export\s+default\s+/);
  if (!exportDefaultMatch) {
    console.error('✗ 未找到export default语句');
    return;
  }
  
  // 检查是否只有一个export default
  const exportDefaultCount = (content.match(/export\s+default\s+/g) || []).length;
  if (exportDefaultCount > 1) {
    console.error(`✗ 存在多个export default语句: ${exportDefaultCount}`);
  } else {
    console.log('✓ 只有一个export default语句');
  }
  
  // 检查export default结构
  const exportRegex = /export\s+default\s+\{[^}]*\}\s*;/;
  const isProperExport = exportRegex.test(content);
  
  if (isProperExport) {
    console.log('✓ export default结构正确');
  } else {
    console.warn('⚠ export default可能不是标准对象形式');
    
    // 检查是否以};结尾
    const endsWithProper = content.trim().endsWith('};');
    if (endsWithProper) {
      console.log('✓ 文件正确以};结尾');
    } else {
      console.error('✗ 文件不以};结尾');
    }
  }
}

// 运行检查
checkFileSyntax();