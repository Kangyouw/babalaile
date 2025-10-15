// 爸爸来啦 - 优化版本
// 基于EdgeTunnel的改进实现

import { connect } from 'cloudflare:sockets';

// 配置参数默认值
const DEFAULT_CONFIG = {
  VALID_TIME: 60 * 60 * 24, // 默认有效期 24 小时
  UPDATE_TIME: 60 * 60 * 12, // 默认更新时间 12 小时
  USER_ID: null,
  PROXY_IP: null,
  PROXY_IPS: [],
  SOCKS5_ADDRESS: null,
  ENABLE_HTTP: false,
  REQUEST_CF_PROXY: 'false',
  DLS: 0,
  REMARK_INDEX: 0,
  BOT_TOKEN: '',
  CHAT_ID: '',
  FILE_NAME: 'clash',
  SUB_EMOJI: '🚀',
  SCV: '',
  LINK: [],
  ADDRESSES: [],
  ADDRESSES_API: [],
  ADDRESSES_NOTLS: [],
  ADDRESSES_NOTLS_API: [],
  ADDRESSES_CSV: [],
  SUB_CONVERTER: 'api.v1.mk/sub',
  SUB_PROTOCOL: 'https',
  SUB_CONFIG: 'https://raw.githubusercontent.com/mahdibland/ShadowsocksConfig/main/configs/clash.yaml',
  BAN_HOSTS: [],
  GO2_SOCKS5S: [],
  HTTPS_PORTS: []
};

/**
 * 验证UUID格式
 * @param {string} uuid - 要验证的UUID字符串
 * @returns {boolean} 是否为有效UUID
 */
function isValidUUID(uuid) {
  if (!uuid || typeof uuid !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * 处理字符串数组整理
 * @param {string} input - 输入字符串
 * @returns {string[]} 整理后的数组
 */
async function formatArray(input) {
  if (!input) return [];
  try {
    // 分割并过滤空字符串
    const result = input.split(',').map(item => item.trim()).filter(Boolean);
    return result;
  } catch (error) {
    console.error('数组整理错误:', error);
    return [];
  }
}

/**
 * 解析Socks5地址
 * @param {string} address - Socks5地址字符串
 * @returns {object} 解析后的地址对象
 */
function socks5AddressParser(address) {
  if (!address) throw new Error('地址不能为空');
  
  try {
    // 解析IP:端口格式
    const parts = address.split(':');
    if (parts.length < 2) throw new Error('无效的地址格式');
    
    const port = parseInt(parts[parts.length - 1], 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      throw new Error('无效的端口号');
    }
    
    const ip = parts.slice(0, -1).join(':');
    
    return { ip, port };
  } catch (error) {
    console.error('解析Socks5地址错误:', error);
    throw error;
  }
}

/**
 * 生成双重哈希值
 * @param {string} input - 输入字符串
 * @returns {Promise<string>} 哈希结果
 */
async function doubleHash(input) {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    
    // 进行双重哈希计算
    let hash = await crypto.subtle.digest('MD5', data);
    const hashArray = Array.from(new Uint8Array(hash));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex;
  } catch (error) {
    console.error('哈希计算错误:', error);
    throw error;
  }
}

/**
 * 生成动态UUID
 * @param {string} key - 生成密钥
 * @returns {Promise<[string, string]>} UUID和低版本UUID
 */
async function generateDynamicUUID(key) {
  try {
    // 生成基于时间戳的动态UUID
    const timestamp = Date.now();
    const combined = `${key}${timestamp}`;
    
    const md5Hash = await doubleHash(combined);
    
    // 构建标准UUID格式
    const userID = [
      md5Hash.slice(0, 8),
      md5Hash.slice(8, 12),
      md5Hash.slice(12, 16),
      md5Hash.slice(16, 20),
      md5Hash.slice(20)
    ].join('-');
    
    const userIDLow = md5Hash;
    
    return [userID, userIDLow];
  } catch (error) {
    console.error('生成动态UUID错误:', error);
    throw error;
  }
}

/**
 * 代理URL请求
 * @param {string} targetUrl - 目标URL
 * @param {URL} originalUrl - 原始请求URL
 * @returns {Promise<Response>} 代理响应
 */
async function proxyUrl(targetUrl, originalUrl) {
  try {
    const url = new URL(targetUrl);
    
    // 构建代理请求
    const proxyRequest = new Request(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const response = await fetch(proxyRequest);
    
    // 创建响应副本，确保正确处理响应头
    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  } catch (error) {
    console.error('URL代理错误:', error);
    return new Response('代理请求失败', {
      status: 500,
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      }
    });
  }
}

/**
 * 测速函数 - 测量给定地址的响应时间
 * @param {string} address - 要测试的地址
 * @returns {Promise<{address: string, latency: number, success: boolean}>} 测速结果
 */
async function testLatency(address) {
  try {
    const startTime = Date.now();
    const response = await fetch(`https://${address}/cdn-cgi/trace`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: AbortSignal.timeout(3000) // 3秒超时
    });
    
    if (response.ok) {
      const latency = Date.now() - startTime;
      return { address, latency, success: true };
    }
    
    return { address, latency: 9999, success: false };
  } catch (error) {
    console.error(`测速失败 ${address}:`, error);
    return { address, latency: 9999, success: false };
  }
}

/**
 * 批量测速并排序
 * @param {string[]} addresses - 地址数组
 * @returns {Promise<string[]>} 排序后的地址数组
 */
async function testAndSortAddresses(addresses) {
  try {
    // 并发测速
    const promises = addresses.map(address => testLatency(address));
    const results = await Promise.all(promises);
    
    // 过滤成功的结果并按延迟排序
    const sorted = results
      .filter(result => result.success)
      .sort((a, b) => a.latency - b.latency)
      .map(result => result.address);
    
    // 添加未成功的地址到末尾
    const failed = results
      .filter(result => !result.success)
      .map(result => result.address);
    
    return [...sorted, ...failed];
  } catch (error) {
    console.error('批量测速错误:', error);
    return addresses; // 出错时返回原始数组
  }
}

/**
 * 生成HTML页面
 * @param {object} config - 当前配置对象
 * @returns {Promise<string>} HTML内容
 */
async function generateHtml(config) {
  // 生成可视化配置页面
  return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>爸爸来啦 - 配置中心</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f5f5f5;
          color: #333;
        }
        h1 {
          color: #2c3e50;
          text-align: center;
          margin-bottom: 30px;
        }
        .container {
          background-color: white;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        .status {
          background-color: #e8f5e9;
          padding: 15px;
          border-radius: 5px;
          margin-bottom: 20px;
          text-align: center;
          color: #2e7d32;
        }
        .tab-container {
          display: flex;
          margin-bottom: 20px;
          border-bottom: 1px solid #e0e0e0;
        }
        .tab {
          padding: 10px 20px;
          cursor: pointer;
          border: none;
          background: none;
          font-size: 16px;
          color: #757575;
          border-bottom: 2px solid transparent;
          transition: all 0.3s;
        }
        .tab.active {
          color: #2196f3;
          border-bottom-color: #2196f3;
        }
        .tab-content {
          display: none;
        }
        .tab-content.active {
          display: block;
        }
        .form-group {
          margin-bottom: 20px;
        }
        label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
          color: #555;
        }
        input[type="text"], input[type="number"], input[type="checkbox"], select {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          transition: border-color 0.3s;
        }
        input[type="checkbox"] {
          width: auto;
          margin-right: 5px;
        }
        .checkbox-group {
          display: flex;
          align-items: center;
        }
        button {
          background-color: #2196f3;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 4px;
          font-size: 16px;
          cursor: pointer;
          transition: background-color 0.3s;
        }
        button:hover {
          background-color: #1976d2;
        }
        button[type="button"] {
          background-color: #757575;
        }
        button[type="button"]:hover {
          background-color: #616161;
        }
        .buttons-container {
          display: flex;
          gap: 10px;
          margin-top: 20px;
        }
        .code-block {
          background-color: #f5f5f5;
          padding: 15px;
          border-radius: 4px;
          overflow-x: auto;
          font-family: 'Courier New', monospace;
          font-size: 14px;
          margin-top: 10px;
        }
        .note {
          background-color: #fff8e1;
          padding: 10px;
          border-radius: 4px;
          margin-top: 5px;
          font-size: 14px;
          color: #ff6f00;
        }
        .test-result {
          margin-top: 20px;
          max-height: 300px;
          overflow-y: auto;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
          padding: 10px;
        }
        .result-item {
          padding: 8px;
          border-bottom: 1px solid #f0f0f0;
        }
        .result-item:last-child {
          border-bottom: none;
        }
        .result-item.success {
          background-color: #e8f5e9;
        }
        .result-item.failed {
          background-color: #ffebee;
        }
      </style>
    </head>
    <body>
      <h1>爸爸来啦 - 配置中心</h1>
      <div class="container">
        <div class="status">
          服务运行正常 - 优化版本
        </div>
        
        <div class="tab-container">
          <button class="tab active" onclick="switchTab('config', event)">基础配置</button>
          <button class="tab" onclick="switchTab('advanced', event)">高级配置</button>
          <button class="tab" onclick="switchTab('speedtest', event)">测速优选</button>
          <button class="tab" onclick="switchTab('export', event)">环境变量导出</button>
        </div>
        
        <div id="config" class="tab-content active">
          <h2>基础配置参数</h2>
          <div class="form-group">
            <label for="uuid">UUID (用户标识)</label>
            <input type="text" id="uuid" placeholder="请输入UUID或使用动态密钥" value="${config.USER_ID || ''}">
            <div class="note">留空将生成随机UUID</div>
          </div>
          
          <div class="form-group">
            <label for="proxyIp">代理IP</label>
            <input type="text" id="proxyIp" placeholder="多个IP用逗号分隔" value="${config.PROXY_IP ? config.PROXY_IPS.join(',') : ''}">
          </div>
          
          <div class="form-group">
            <label for="socks5">Socks5/HTTP地址</label>
            <input type="text" id="socks5" placeholder="格式: IP:端口" value="${config.SOCKS5_ADDRESS || ''}">
          </div>
          
          <div class="form-group">
            <label for="validTime">有效期 (秒)</label>
            <input type="number" id="validTime" value="${config.VALID_TIME || 86400}">
            <div class="note">默认24小时 (86400秒)</div>
          </div>
          
          <div class="form-group">
            <label class="checkbox-group">
              <input type="checkbox" id="enableHttp" ${config.ENABLE_HTTP ? 'checked' : ''}>
              启用HTTP代理
            </label>
          </div>
        </div>
        
        <div id="advanced" class="tab-content">
          <h2>高级配置参数</h2>
          <div class="form-group">
            <label for="botToken">Telegram Bot Token</label>
            <input type="text" id="botToken" placeholder="用于通知功能" value="${config.BOT_TOKEN || ''}">
          </div>
          
          <div class="form-group">
            <label for="chatId">Telegram Chat ID</label>
            <input type="text" id="chatId" placeholder="接收通知的用户ID" value="${config.CHAT_ID || ''}">
          </div>
          
          <div class="form-group">
            <label for="subName">订阅文件名</label>
            <input type="text" id="subName" value="${config.FILE_NAME || 'clash'}">
          </div>
          
          <div class="form-group">
            <label for="subEmoji">订阅前缀表情</label>
            <input type="text" id="subEmoji" value="${config.SUB_EMOJI || '🚀'}">
          </div>
        </div>
        
        <div id="speedtest" class="tab-content">
          <h2>测速与优选</h2>
          <div class="form-group">
            <label for="testAddresses">要测试的地址</label>
            <input type="text" id="testAddresses" placeholder="多个地址用逗号分隔" value="${config.ADDRESSES_CSV.join(',') || 'example.com,test.com,demo.com'}">
            <div class="note">输入要测试的域名或IP地址，系统将自动测试并排序</div>
          </div>
          
          <button id="startTest" onclick="startSpeedTest()">开始测速</button>
          <div id="testResult" class="test-result"></div>
        </div>
        
        <div id="export" class="tab-content">
          <h2>环境变量配置</h2>
          <p>根据您的配置自动生成环境变量，可直接复制到Cloudflare Workers或Pages设置中：</p>
          <div id="envVars" class="code-block"></div>
          <button onclick="copyEnvVars()">复制环境变量</button>
        </div>
      </div>
      
      <script>
        // 确保在全局作用域中定义函数
        window.switchTab = function(tabId, event) {
          try {
            // 隐藏所有内容
            document.querySelectorAll('.tab-content').forEach(content => {
              content.classList.remove('active');
            });
            
            // 移除所有标签的活跃状态
            document.querySelectorAll('.tab').forEach(tab => {
              tab.classList.remove('active');
            });
            
            // 激活选中的标签和内容
            const tabElement = document.getElementById(tabId);
            if (tabElement) {
              tabElement.classList.add('active');
            }
            
            // 安全地处理事件目标
            if (event && event.target) {
              event.target.classList.add('active');
            }
            
            // 如果切换到导出标签，更新环境变量
            if (tabId === 'export') {
              updateEnvVars();
            }
          } catch (err) {
            console.error('切换标签错误:', err);
          }
        };
        
        window.updateEnvVars = function() {
          try {
            const uuid = document.getElementById('uuid')?.value || '';
            const proxyIp = document.getElementById('proxyIp')?.value || '';
            const socks5 = document.getElementById('socks5')?.value || '';
            const validTime = document.getElementById('validTime')?.value || 86400;
            const enableHttp = document.getElementById('enableHttp')?.checked || false;
            const botToken = document.getElementById('botToken')?.value || '';
            const chatId = document.getElementById('chatId')?.value || '';
            const subName = document.getElementById('subName')?.value || 'clash';
            const subEmoji = document.getElementById('subEmoji')?.value || '🚀';
            
            let envVars = '';
            if (uuid) envVars += 'UUID=' + uuid + '\n';
            if (proxyIp) envVars += 'PROXYIP=' + proxyIp + '\n';
            if (socks5) envVars += 'SOCKS5=' + socks5 + '\n';
            if (enableHttp) envVars += 'HTTP=' + socks5 + '\n';
            envVars += 'TIME=' + validTime + '\n';
            if (botToken) envVars += 'TGTOKEN=' + botToken + '\n';
            if (chatId) envVars += 'TGID=' + chatId + '\n';
            if (subName) envVars += 'SUBNAME=' + subName + '\n';
            if (subEmoji) envVars += 'SUBEMOJI=' + subEmoji + '\n';
            
            const envVarsElement = document.getElementById('envVars');
            if (envVarsElement) {
              envVarsElement.textContent = envVars;
            }
          } catch (err) {
            console.error('更新环境变量错误:', err);
          }
        };
        
        window.copyEnvVars = function() {
          try {
            const envVarsElement = document.getElementById('envVars');
            if (envVarsElement) {
              const envVars = envVarsElement.textContent;
              navigator.clipboard.writeText(envVars)
                .then(() => alert('环境变量已复制到剪贴板'))
                .catch(err => {
                  console.error('复制失败:', err);
                  alert('复制失败，请手动复制');
                });
            }
          } catch (err) {
            console.error('复制环境变量错误:', err);
            alert('复制失败，请手动复制');
          }
        };
        
        window.startSpeedTest = async function() {
          try {
            const addressesInput = document.getElementById('testAddresses')?.value || '';
            const addresses = addressesInput.split(',').map(addr => addr.trim()).filter(Boolean);
            const resultDiv = document.getElementById('testResult');
            
            if (addresses.length === 0) {
              alert('请输入至少一个要测试的地址');
              return;
            }
            
            if (resultDiv) {
              resultDiv.innerHTML = '<p>正在测速，请稍候...</p>';
            }
            
            // 创建测速API调用
            const response = await fetch('/api/speedtest', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ addresses })
            });
            
            const results = await response.json();
            
            // 显示结果
            if (resultDiv) {
              resultDiv.innerHTML = '';
              if (results.length > 0) {
                results.forEach(result => {
                  const item = document.createElement('div');
                  item.className = 'result-item ' + (result.success ? 'success' : 'failed');
                  
                  let content = '<strong>' + result.address + '</strong>: ';
                  if (result.success) {
                    content += '响应时间 ' + result.latency + 'ms';
                  } else {
                    content += '测速失败';
                  }
                  
                  item.innerHTML = content;
                  resultDiv.appendChild(item);
                });
                
                // 更新环境变量中的ADDCSV
                const successAddresses = results
                  .filter(result => result.success)
                  .sort((a, b) => a.latency - b.latency)
                  .map(result => result.address);
                
                if (successAddresses.length > 0) {
                  const testAddressesElement = document.getElementById('testAddresses');
                  if (testAddressesElement) {
                    testAddressesElement.value = successAddresses.join(',');
                  }
                  alert('测速完成！已自动排序最优地址');
                }
              }
            }
          } catch (error) {
            console.error('测速错误:', error);
            const resultDiv = document.getElementById('testResult');
            if (resultDiv) {
              resultDiv.innerHTML = '<p>测速失败，请稍后重试</p>';
            }
          }
        };
        
        // 页面加载时初始化
        window.onload = function() {
          try {
            window.updateEnvVars();
          } catch (err) {
            console.error('初始化错误:', err);
          }
        };
      </script>
    </body>
    </html>
  `;
}

/**
 * 处理WebSocket连接
 * @param {Request} request - 客户端请求
 * @param {object} env - Cloudflare环境变量
 * @param {object} context - 执行上下文
 * @returns {Promise<Response>} WebSocket响应
 */
async function handleWebSocket(request, env, context) {
  const [client, server] = Object.values(new WebSocketPair());
  
  // 处理WebSocket连接的逻辑将在这里实现
  server.accept();
  
  // 模拟WebSocket处理（实际实现将根据需要扩展）
  server.addEventListener('message', (event) => {
    try {
      // 处理收到的消息
      server.send('收到消息：' + event.data);
    } catch (error) {
      console.error('WebSocket消息处理错误:', error);
      server.close(1011, '内部错误');
    }
  });
  
  server.addEventListener('close', () => {
    // 连接关闭处理
    console.log('WebSocket连接已关闭');
  });
  
  return new Response(null, {
    status: 101,
    webSocket: client
  });
}

/**
 * 处理HTTP请求
 * @param {Request} request - 客户端请求
 * @param {object} env - Cloudflare环境变量
 * @returns {Promise<Response>} HTTP响应
 */
async function handleRequest(request, env) {
  try {
    let config = { ...DEFAULT_CONFIG };
    
    // 解析请求信息
    const url = new URL(request.url);
    const upgradeHeader = request.headers.get('Upgrade');
    const userAgent = request.headers.get('User-Agent')?.toLowerCase() || 'null';
    
    // 配置处理 - 从环境变量和URL参数加载配置
    config.USER_ID = env.UUID || env.uuid || env.PASSWORD || env.pswd || null;
    
    // 处理动态UUID
    if (env.KEY || env.TOKEN || (config.USER_ID && !isValidUUID(config.USER_ID))) {
      const dynamicKey = env.KEY || env.TOKEN || config.USER_ID;
      config.VALID_TIME = Number(env.TIME) || config.VALID_TIME;
      config.UPDATE_TIME = Number(env.UPTIME) || config.UPDATE_TIME;
      
      try {
        const [userID, userIDLow] = await generateDynamicUUID(dynamicKey);
        config.USER_ID = userID;
        // 存储低版本UUID供需要时使用
      } catch (error) {
        console.error('动态UUID生成错误:', error);
        return new Response('动态ID生成失败', {
          status: 500,
          headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
      }
    }
    
    // 验证用户ID
    if (!config.USER_ID) {
      return new Response('请设置UUID变量', {
        status: 401,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      });
    }
    
    // 生成fakeUserID用于某些功能
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    const timestamp = Math.ceil(currentDate.getTime() / 1000);
    const fakeUserIDMD5 = await doubleHash(`${config.USER_ID}${timestamp}`);
    const fakeUserID = [
      fakeUserIDMD5.slice(0, 8),
      fakeUserIDMD5.slice(8, 12),
      fakeUserIDMD5.slice(12, 16),
      fakeUserIDMD5.slice(16, 20),
      fakeUserIDMD5.slice(20)
    ].join('-');
    
    // 加载代理配置
    config.PROXY_IP = env.PROXYIP || env.proxyip || null;
    if (config.PROXY_IP) {
      config.PROXY_IPS = await formatArray(config.PROXY_IP);
      // 随机选择一个代理IP
      config.PROXY_IP = config.PROXY_IPS[Math.floor(Math.random() * config.PROXY_IPS.length)];
    }
    
    // 设置默认代理IP
    if (!config.PROXY_IP) {
      // 使用Cloudflare colo作为默认代理标识
      config.PROXY_IP = request.cf?.colo || 'unknown';
    }
    
    // 处理WebSocket连接
    if (upgradeHeader === 'websocket') {
      return handleWebSocket(request, env, context);
    }
    
    // 处理HTTP请求 - 加载各种配置参数
    config.SOCKS5_ADDRESS = env.HTTP || env.SOCKS5 || null;
    if (config.SOCKS5_ADDRESS) {
      const socks5s = await formatArray(config.SOCKS5_ADDRESS);
      config.SOCKS5_ADDRESS = socks5s[Math.floor(Math.random() * socks5s.length)];
      
      config.ENABLE_HTTP = env.HTTP ? true : 
        config.SOCKS5_ADDRESS.toLowerCase().includes('http://');
        
      // 清理地址字符串
      config.SOCKS5_ADDRESS = config.SOCKS5_ADDRESS.split('//')[1] || config.SOCKS5_ADDRESS;
    }
    
    // 处理测速API请求
    if (url.pathname === '/api/speedtest' && request.method === 'POST') {
      try {
        const data = await request.json();
        if (!data.addresses || !Array.isArray(data.addresses)) {
          return new Response(JSON.stringify({ error: '无效的地址数组' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // 批量测速
        const promises = data.addresses.map(address => testLatency(address));
        const results = await Promise.all(promises);
        
        return new Response(JSON.stringify(results), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('测速API错误:', error);
        return new Response(JSON.stringify({ error: '测速处理失败' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // 自动测速并优化ADDCSV参数
    if (config.ADDRESSES_CSV.length > 0) {
      // 当ADDCSV包含测速地址时，自动进行测速排序
      config.ADDRESSES_CSV = await testAndSortAddresses(config.ADDRESSES_CSV);
    }
    
    // 加载其他配置参数
    if (env.GO2SOCKS5) config.GO2_SOCKS5S = await formatArray(env.GO2SOCKS5);
    if (env.CFPORTS) config.HTTPS_PORTS = await formatArray(env.CFPORTS);
    if (env.BAN) config.BAN_HOSTS = await formatArray(env.BAN);
    if (env.ADD) config.ADDRESSES = await formatArray(env.ADD);
    if (env.ADDAPI) config.ADDRESSES_API = await formatArray(env.ADDAPI);
    if (env.ADDNOTLS) config.ADDRESSES_NOTLS = await formatArray(env.ADDNOTLS);
    if (env.ADDNOTLSAPI) config.ADDRESSES_NOTLS_API = await formatArray(env.ADDNOTLSAPI);
    if (env.ADDCSV) config.ADDRESSES_CSV = await formatArray(env.ADDCSV);
    if (env.LINK) config.LINK = await formatArray(env.LINK);
    
    // 设置其他参数
    config.DLS = Number(env.DLS) || config.DLS;
    config.REMARK_INDEX = Number(env.CSVREMARK) || config.REMARK_INDEX;
    config.BOT_TOKEN = env.TGTOKEN || config.BOT_TOKEN;
    config.CHAT_ID = env.TGID || config.CHAT_ID;
    config.FILE_NAME = env.SUBNAME || config.FILE_NAME;
    config.SUB_EMOJI = env.SUBEMOJI || env.EMOJI || config.SUB_EMOJI;
    config.SUB_CONVERTER = env.SUBAPI || config.SUB_CONVERTER;
    config.SUB_CONFIG = env.SUBCONFIG || config.SUB_CONFIG;
    config.SCV = env.SCV || config.SCV;
    
    // 处理URL参数
    if (url.searchParams.has('notls')) {
      // 处理非TLS模式
    }
    
    // 处理代理IP参数
    if (url.searchParams.has('proxyip')) {
      config.PROXY_IP = url.searchParams.get('proxyip');
      config.REQUEST_CF_PROXY = 'false';
    }
    
    // 处理socks5/http参数
    if (url.searchParams.has('socks5') || url.searchParams.has('socks') || url.searchParams.has('http')) {
      config.REQUEST_CF_PROXY = 'false';
    }
    
    // 处理SCV参数
    if (!config.SCV || config.SCV === '0' || config.SCV === 'false') {
      // 不安全模式配置
    } else {
      config.SCV = 'true';
    }
    
    // 处理根路径请求
    const path = url.pathname.toLowerCase();
    if (path === '/') {
      // 处理URL重定向
      if (env.URL302) {
        return Response.redirect(env.URL302, 302);
      } else if (env.URL) {
        // 隐藏原始链接，替换为示例文本展示
        const proxyResponse = await proxyUrl(env.URL, url);
        // 这里可以添加处理，例如替换响应中的链接为示例文本
        // 但由于这是代理请求，我们保持原样并在返回时添加安全头
        const headers = new Headers(proxyResponse.headers);
        headers.set('X-Content-Type-Options', 'nosniff');
        headers.set('X-Frame-Options', 'DENY');
        
        return new Response(proxyResponse.body, {
          status: proxyResponse.status,
          statusText: proxyResponse.statusText,
          headers
        });
      } else {
        // 返回可视化配置页面
        return new Response(await generateHtml(config), {
          headers: {
            'Content-Type': 'text/html;charset=utf-8'
          }
        });
      }
    }
    
    // 默认响应
    return new Response('Not Found', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      }
    });
    
  } catch (error) {
    console.error('请求处理错误:', error);
    return new Response('内部服务器错误', {
      status: 500,
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      }
    });
  }
}

// 主处理函数
export default {
  async fetch(request, env, context) {
    return await handleRequest(request, env, context);
  }
};
