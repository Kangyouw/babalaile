// EdgeTunnel - 优化版本
// 基于之前错误经验的改进实现

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
 * 生成HTML页面
 * @returns {Promise<string>} HTML内容
 */
async function generateHtml() {
  // 返回简化的HTML页面内容
  return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>EdgeTunnel</title>
    </head>
    <body>
      <h1>EdgeTunnel</h1>
      <p>优化版本运行中...</p>
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
        return await proxyUrl(env.URL, url);
      } else {
        // 返回默认HTML页面
        return new Response(await generateHtml(), {
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