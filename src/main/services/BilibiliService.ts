import { spawn, execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import axios from 'axios';
import { app, BrowserWindow } from 'electron';
import {
  BilibiliConfig,
  BilibiliVideo,
  BilibiliMetadata,
  BilibiliUploadOptions,
  BilibiliUploadResult
} from '../../shared/types/bilibili';
import { ConfigService } from './ConfigService';
import { LogService } from './LogService';
import { logger } from '../utils/logger';

// B站视频大小限制（字节）
const MAX_VIDEO_SIZE = 8 * 1024 * 1024 * 1024; // 8GB
const MAX_VIDEO_SIZE_8K = 16 * 1024 * 1024 * 1024; // 16GB（8K视频）

// biliup 自动下载配置
const BILIUP_GITHUB_API = 'https://api.github.com/repos/biliup/biliup-rs/releases/latest';
const BILIUP_FALLBACK_URL = 'https://github.com/biliup/biliup-rs/releases/download/v0.2.4/biliupR-v0.2.4-x86_64-windows.zip';

export class BilibiliService {
  private configService: ConfigService;
  private tempDir: string;
  private toolsDir: string;
  private biliupPath: string = 'biliup';
  
  // 进度更新辅助方法
  private sendProgress(phase: string, progress: number, title: string, articleId?: string) {
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('bilibili-sync-progress', { phase, progress, title, articleId });
    });
  }

  constructor(configService: ConfigService) {
    this.configService = configService;
    this.tempDir = path.join(app.getPath('temp'), 'notionsyncone-bilibili');
    this.toolsDir = path.join(app.getPath('userData'), 'tools');
    this.ensureTempDir();
    const found = this.findBiliup();
    if (found) {
      this.biliupPath = found;
    }
  }

  /**
   * 确保临时目录存在
   */
  private ensureTempDir(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
      LogService.log(`创建临时目录: ${this.tempDir}`, 'BilibiliService');
    }
  }

  /**
   * 从环境变量获取代理配置
   * 支持 HTTP_PROXY, HTTPS_PROXY, http_proxy, https_proxy, ALL_PROXY
   */
  private getProxyConfig(targetUrl: string): false | { protocol?: string; host: string; port: number; auth?: { username: string; password: string } } {
    // 根据目标URL的协议选择代理环境变量
    const isHttps = targetUrl.startsWith('https://');
    
    // 按优先级查找代理环境变量
    const proxyEnvVars = isHttps 
      ? ['HTTPS_PROXY', 'https_proxy', 'ALL_PROXY', 'all_proxy', 'HTTP_PROXY', 'http_proxy']
      : ['HTTP_PROXY', 'http_proxy', 'ALL_PROXY', 'all_proxy'];
    
    let proxyUrl: string | undefined;
    for (const envVar of proxyEnvVars) {
      proxyUrl = process.env[envVar];
      if (proxyUrl) break;
    }

    // 检查是否在 NO_PROXY 列表中
    const noProxy = process.env.NO_PROXY || process.env.no_proxy;
    if (noProxy) {
      const noProxyList = noProxy.split(',').map(s => s.trim());
      const urlHostname = new URL(targetUrl).hostname;
      if (noProxyList.some(pattern => {
        if (pattern === '*') return true;
        if (pattern.startsWith('.')) return urlHostname.endsWith(pattern);
        return urlHostname === pattern;
      })) {
        return false; // 不使用代理
      }
    }

    if (!proxyUrl) {
      return false; // 没有代理配置
    }

    try {
      // 解析代理URL
      const url = new URL(proxyUrl);
      const config: any = {
        host: url.hostname,
        port: parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80)
      };

      // 如果代理URL包含协议，添加protocol字段
      if (url.protocol) {
        config.protocol = url.protocol.replace(':', '');
      }

      // 如果有用户名和密码
      if (url.username || url.password) {
        config.auth = {
          username: url.username || '',
          password: url.password || ''
        };
      }

      return config;
    } catch (error) {
      LogService.warn(`代理URL解析失败: ${proxyUrl}`, 'BilibiliService');
      return false;
    }
  }

  /**
   * 检查biliup是否已安装
   */
  async checkBiliupInstalled(): Promise<boolean> {
    return new Promise((resolve) => {
      execFile(this.biliupPath, ['--version'], (error) => {
        if (error) {
          LogService.error('biliup 未安装或不在PATH中', 'BilibiliService');
          resolve(false);
        } else {
          LogService.log('biliup 已安装', 'BilibiliService');
          resolve(true);
        }
      });
    });
  }

  /**
   * 检查FFmpeg是否已安装
   */
  async checkFFmpegInstalled(): Promise<boolean> {
    return new Promise((resolve) => {
      execFile('ffmpeg', ['-version'], (error) => {
        if (error) {
          LogService.warn('ffmpeg 未安装，将无法压缩视频', 'BilibiliService');
          resolve(false);
        } else {
          LogService.log('ffmpeg 已安装', 'BilibiliService');
          resolve(true);
        }
      });
    });
  }

  /**
   * 获取B站用户信息（安全：不记录敏感Cookie内容）
   */
  async getUserInfo(): Promise<{ name: string; mid: string } | null> {
    try {
      const config = this.configService.getBilibiliConfig();
      const cookieFile = config.cookieFile || path.join(this.tempDir, 'cookies.json');

      if (!fs.existsSync(cookieFile)) {
        LogService.log('Cookie 文件不存在', 'BilibiliService');
        return null;
      }

      // 读取Cookie文件
      const cookieData = JSON.parse(fs.readFileSync(cookieFile, 'utf-8'));
      
      // 适配新格式：从 token_info.mid 或 cookie_info.cookies 中获取
      let mid: string;
      
      if (cookieData.token_info && cookieData.token_info.mid) {
        // 新格式：从 token_info 获取
        mid = String(cookieData.token_info.mid);
      } else if (cookieData.cookie_info && cookieData.cookie_info.cookies) {
        // 新格式：从 cookies 数组中查找
        const dedeUserIdCookie = cookieData.cookie_info.cookies.find((c: any) => c.name === 'DedeUserID');
        mid = dedeUserIdCookie?.value;
      } else {
        // 旧格式：直接从顶层获取
        mid = cookieData.DedeUserID;
      }

      if (!mid) {
        LogService.warn('Cookie 中未找到用户 ID', 'BilibiliService');
        return null;
      }

      // 构建 cookie 字符串（适配新旧格式）
      let cookieString: string;
      
      if (cookieData.cookie_info && cookieData.cookie_info.cookies) {
        // 新格式：从 cookies 数组构建
        cookieString = cookieData.cookie_info.cookies
          .map((c: any) => `${c.name}=${c.value}`)
          .join('; ');
      } else {
        // 旧格式：直接从顶层键值对构建
        cookieString = Object.entries(cookieData)
          .filter(([k]) => !['token_info', 'sso', 'platform', 'cookie_info'].includes(k))
          .map(([k, v]) => `${k}=${v}`)
          .join('; ');
      }

      // 尝试多个 API 端点获取用户信息
      const apiEndpoints = [
        // 方法1: 用户空间信息 API（不需要登录）
        `https://api.bilibili.com/x/space/wbi/acc/info?mid=${mid}`,
        // 方法2: 个人信息 API（需要登录，更准确）
        `https://api.bilibili.com/x/member/web/account`,
        // 方法3: 基础信息 API
        `https://api.bilibili.com/x/space/acc/info?mid=${mid}`
      ];
      
      for (const apiUrl of apiEndpoints) {
        try {
          const response = await axios.get(apiUrl, {
            headers: {
              'Cookie': cookieString,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Referer': 'https://www.bilibili.com'
            },
            timeout: 8000
          });

          // 方法2返回的数据结构不同
          if (apiUrl.includes('/member/web/account')) {
            if (response.data?.code === 0 && response.data?.data?.uname) {
              const userInfo = {
                name: response.data.data.uname,
                mid: mid
              };
              LogService.log(`✅ 获取到用户信息: ${userInfo.name} (${userInfo.mid})`, 'BilibiliService');
              return userInfo;
            }
          } else {
            // 方法1和方法3
            if (response.data?.code === 0 && response.data?.data?.name) {
              const userInfo = {
                name: response.data.data.name,
                mid: mid
              };
              LogService.log(`✅ 获取到用户信息: ${userInfo.name} (${userInfo.mid})`, 'BilibiliService');
              return userInfo;
            }
          }
        } catch (apiError: any) {
          const errorCode = apiError?.response?.data?.code;
          LogService.warn(`API ${apiUrl} 失败 (code: ${errorCode})，尝试下一个`, 'BilibiliService');
          continue;
        }
      }

      // 所有 API 都失败，返回基本信息（至少显示 UID）
      LogService.warn('所有 API 均失败，显示默认信息', 'BilibiliService');
      return {
        name: `B站用户`,  // 简洁的默认显示
        mid: mid
      };
    } catch (error) {
      LogService.error('获取用户信息失败', 'BilibiliService', error);
      return null;
    }
  }

  /**
   * 登录B站 - 优雅的交互方式
   * 策略：直接打开浏览器进行网页扫码登录，然后提取Cookie
   */
  async login(method: 'qrcode' | 'sms' | 'password' = 'qrcode'): Promise<void> {
    try {
      const isReady = await this.ensureBiliupInstalled();
      if (!isReady) {
        throw new Error(
          'biliup 自动安装失败\n\n' +
          '请手动安装：\n' +
          '   - Windows: winget install -e --id ForgQi.biliup-rs\n' +
          '   - 或访问: https://github.com/biliup/biliup/releases\n' +
          '安装后请【完全关闭并重新打开】应用程序'
        );
      }

      const config = this.configService.getBilibiliConfig();
      const cookieFile = config.cookieFile || path.join(this.tempDir, 'cookies.json');

      // 登录前先删除旧的 cookie 文件（强制重新登录）
      if (fs.existsSync(cookieFile)) {
        try {
          fs.unlinkSync(cookieFile);
          LogService.log('已删除旧的 Cookie 文件', 'BilibiliService');
        } catch (err) {
          LogService.warn(`删除旧 Cookie 失败: ${err}`, 'BilibiliService');
        }
      }

      LogService.log(`biliup 路径: ${this.biliupPath}`, 'BilibiliService');
      LogService.log(`Cookie 文件: ${cookieFile}`, 'BilibiliService');
      LogService.log(`工作目录: ${this.tempDir}`, 'BilibiliService');
      LogService.log(`正在启动 biliup 登录窗口...`, 'BilibiliService');

      // 使用最简单的方式：cmd /k 保持窗口打开
      const { exec } = require('child_process');

      return new Promise((resolve, reject) => {
        // 创建一个标记文件，窗口关闭时删除
        const lockFile = path.join(this.tempDir, 'bili_login.lock');
        fs.writeFileSync(lockFile, 'login in progress', 'utf-8');
        
        // 构建命令（登录完成或关闭窗口时删除标记文件）
        const command = `start "B站登录" cmd /k "cd /d "${this.tempDir}" && echo ==== B站登录 ==== && echo. && echo 工作目录: ${this.tempDir} && echo biliup路径: ${this.biliupPath} && echo. && echo 正在启动登录... && echo. && "${this.biliupPath}" -u "${path.basename(cookieFile)}" login && echo. && echo 登录完成！按任意键关闭... && del "${lockFile}" && pause > nul || del "${lockFile}""`;
        
        LogService.log(`执行命令: ${command.substring(0, 100)}...`, 'BilibiliService');
        
        exec(command, (error) => {
          if (error) {
            LogService.error(`启动登录窗口失败: ${error.message}`, 'BilibiliService');
            fs.unlinkSync(lockFile);
            reject(error);
            return;
          }
          LogService.log('登录窗口已启动', 'BilibiliService');
        });

        // 轮询检查 cookie 文件是否生成
        let attempts = 0;
        const maxAttempts = 300; // 5分钟超时
        
        const checkCookie = setInterval(() => {
          attempts++;
          
          // 检查窗口是否已关闭（标记文件被删除）
          if (!fs.existsSync(lockFile)) {
            clearInterval(checkCookie);
            
            // 检查是否成功登录
            if (fs.existsSync(cookieFile)) {
              try {
                const content = fs.readFileSync(cookieFile, 'utf-8');
                const cookieData = JSON.parse(content);
                
                if (cookieData.cookie_info && cookieData.cookie_info.cookies && cookieData.cookie_info.cookies.length > 0) {
                  LogService.success('登录成功，Cookie 已生成（标准格式）', 'BilibiliService');
                  
                  this.configService.saveBilibiliConfig({
                    ...config,
                    cookieFile,
                    enabled: true
                  });
                  
                  resolve();
                  return;
                }
              } catch (err) {
                // Cookie 格式错误
              }
            }
            
            // 窗口关闭但没有生成有效 cookie
            reject(new Error('登录已取消或失败'));
            return;
          }
          
          // 正常检查 cookie
          if (fs.existsSync(cookieFile)) {
            try {
              const content = fs.readFileSync(cookieFile, 'utf-8');
              const cookieData = JSON.parse(content);
              
              if (cookieData.cookie_info && cookieData.cookie_info.cookies && cookieData.cookie_info.cookies.length > 0) {
                clearInterval(checkCookie);
                
                // 清理标记文件
                try {
                  if (fs.existsSync(lockFile)) {
                    fs.unlinkSync(lockFile);
                  }
                } catch (err) {
                  // 忽略
                }
                
                LogService.success('登录成功，Cookie 已生成（标准格式）', 'BilibiliService');
                
                this.configService.saveBilibiliConfig({
                  ...config,
                  cookieFile,
                  enabled: true
                });
                
                resolve();
              }
            } catch (err) {
              // Cookie 文件可能还在写入中，继续等待
            }
          }
          
          // 超时处理
          if (attempts >= maxAttempts) {
            clearInterval(checkCookie);
            
            // 清理标记文件
            try {
              if (fs.existsSync(lockFile)) {
                fs.unlinkSync(lockFile);
              }
            } catch (err) {
              // 忽略
            }
            
            reject(new Error('登录超时（5分钟），请重试'));
          }
        }, 1000);
      });
    } catch (error) {
      LogService.error('登录失败', 'BilibiliService');
      throw error;
    }
  }

  /**
   * 下载视频（从Notion或外部URL）
   * 支持：YouTube、Twitter、Vimeo、直接视频链接等
   * 带缓存功能：相同URL的视频不会重复下载
   */
  async downloadVideo(
    video: BilibiliVideo,
    abortSignal?: AbortSignal,
    articleId?: string
  ): Promise<string> {
    try {
      // 检查是否已取消
      if (abortSignal?.aborted) {
        throw new Error('下载已取消');
      }

      // 生成视频URL的哈希作为缓存文件名（包含 _hd 标识以区分旧的低清晰度缓存）
      const crypto = require('crypto');
      const urlHash = crypto.createHash('md5').update(video.url).digest('hex');
      const cachedFilename = `cached_${urlHash}_hd.mp4`;
      const cachedPath = path.join(this.tempDir, cachedFilename);

      // 检查缓存是否存在且有效
      if (fs.existsSync(cachedPath)) {
        const stats = fs.statSync(cachedPath);
        if (stats.size > 0) {
          LogService.log(`使用缓存的视频文件: ${(stats.size / 1024 / 1024).toFixed(2)} MB`, 'BilibiliService');
          
          // 发送缓存命中的进度通知（直接100%）
          if (articleId) {
            this.sendProgress('downloading', 100, '使用缓存', articleId);
          }
          
          video.fileSize = stats.size;
          video.localPath = cachedPath;
          video.needsCompression = stats.size > MAX_VIDEO_SIZE;
          return cachedPath;
        }
      }

      LogService.log(`开始下载视频: ${video.url}`, 'BilibiliService');

      // 检测是否为外部视频（YouTube、Twitter、Vimeo等）
      const isExternalVideo = this.isExternalVideoUrl(video.url);

      if (isExternalVideo) {
        // 使用 yt-dlp 下载外部视频
        LogService.log('检测到外部视频，使用 yt-dlp 下载...', 'BilibiliService');
        await this.downloadWithYtDlp(video.url, cachedPath, abortSignal, articleId);
      } else {
        // 直接视频文件，使用 axios 下载
        LogService.log('直接下载视频文件...', 'BilibiliService');
        await this.downloadDirectVideo(video.url, cachedPath, abortSignal);
      }

      // 检查文件是否存在
      if (!fs.existsSync(cachedPath)) {
        throw new Error('视频下载失败：文件不存在');
      }

      const stats = fs.statSync(cachedPath);
      video.fileSize = stats.size;
      video.localPath = cachedPath;
      
      LogService.success(`视频下载完成: ${(stats.size / 1024 / 1024).toFixed(2)} MB (已缓存)`, 'BilibiliService');
      
      // 检查是否需要压缩
      video.needsCompression = stats.size > MAX_VIDEO_SIZE;
      if (video.needsCompression) {
        LogService.warn(`视频大小超过8GB，需要压缩`, 'BilibiliService');
      }
      
      return cachedPath;
    } catch (error) {
      LogService.error('视频下载失败', 'BilibiliService', error);
      throw error;
    }
  }

  /**
   * 下载封面图片（用于B站上传）
   * 带缓存功能：相同URL的图片不会重复下载
   * 支持 V2Ray/SOCKS5 代理（使用 yt-dlp 下载）
   */
  async downloadCoverImage(
    imageUrl: string,
    abortSignal?: AbortSignal
  ): Promise<string> {
    try {
      // 检查是否已取消
      if (abortSignal?.aborted) {
        throw new Error('下载已取消');
      }

      // 生成图片URL的哈希作为缓存文件名
      const crypto = require('crypto');
      const urlHash = crypto.createHash('md5').update(imageUrl).digest('hex');
      // 尝试从URL中提取文件扩展名
      const urlExt = imageUrl.match(/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i);
      const ext = urlExt ? urlExt[1] : 'jpg';
      const cachedFilename = `cover_${urlHash}.${ext}`;
      const cachedPath = path.join(this.tempDir, cachedFilename);

      // 检查缓存是否存在且有效
      if (fs.existsSync(cachedPath)) {
        const stats = fs.statSync(cachedPath);
        // 封面图片至少应该有1KB，否则可能是损坏的缓存
        if (stats.size > 1024) {
          LogService.log(`✓ 使用缓存的封面图片: ${(stats.size / 1024).toFixed(2)} KB`, 'BilibiliService');
          return cachedPath;
        } else {
          LogService.warn(`缓存的封面图片可能已损坏（大小: ${stats.size} bytes），将重新下载`, 'BilibiliService');
          // 删除损坏的缓存文件
          try {
            fs.unlinkSync(cachedPath);
          } catch (err) {
            LogService.warn(`删除损坏的缓存文件失败: ${err}`, 'BilibiliService');
          }
        }
      }

      LogService.log(`开始下载封面图片（通过VPN代理）...`, 'BilibiliService');
      
      // 检查URL是否可访问（Notion临时URL检测）
      if (imageUrl.includes('secure.notion-static.com') || imageUrl.includes('s3.us-west')) {
        LogService.warn(`⚠️  检测到 Notion 临时 URL，此类URL有时效性（通常1小时）`, 'BilibiliService');
      }

      // 使用 yt-dlp 下载图片（自动支持 SOCKS5/V2Ray 代理）
      await this.downloadImageWithYtDlp(imageUrl, cachedPath, abortSignal);

      // 验证下载的文件
      if (!fs.existsSync(cachedPath)) {
        throw new Error('下载的封面文件不存在');
      }

      const stats = fs.statSync(cachedPath);
      if (stats.size < 1024) {
        throw new Error(`下载的封面图片太小（${stats.size} bytes）`);
      }

      LogService.success(`✓ 封面图片下载完成: ${(stats.size / 1024).toFixed(2)} KB (已缓存)`, 'BilibiliService');
      return cachedPath;

    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      LogService.error(`❌ 封面下载失败: ${errorMsg}`, 'BilibiliService');
      LogService.log(`💡 将使用B站默认封面（视频第一帧），上传后可在B站后台手动修改`, 'BilibiliService');
      throw new Error(`封面图片下载失败: ${errorMsg}`);
    }
  }

  /**
   * 使用 curl 下载图片（自动支持系统代理，包括 SOCKS5/V2Ray）
   */
  private async downloadImageWithYtDlp(
    imageUrl: string,
    outputPath: string,
    abortSignal?: AbortSignal
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Windows 10+ 内置 curl 命令
      const args = [
        '-L',              // 跟随重定向
        '-s',              // 静默模式
        '-S',              // 显示错误
        '--max-time', '30', // 30秒超时
        '-o', outputPath  // 输出文件
      ];

      // 检测并配置代理（支持 HTTP 和 SOCKS5）
      const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;
      const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
      const allProxy = process.env.ALL_PROXY || process.env.all_proxy;
      
      const isHttps = imageUrl.startsWith('https://');
      const proxyUrl = isHttps ? (httpsProxy || allProxy || httpProxy) : (httpProxy || allProxy);
      
      if (proxyUrl) {
        // curl 支持 socks5:// 协议前缀
        // 如果代理是 http://，curl会自动处理
        // 如果代理是 socks5://，curl也会正确处理
        args.push('--proxy', proxyUrl);
        LogService.log(`使用代理下载: ${proxyUrl.replace(/:\/\/.*@/, '://*****@')}`, 'BilibiliService');
      }

      args.push(imageUrl);

      const curlProcess = spawn('curl', args, {
        shell: true,
        windowsHide: true
      });

      let errorOutput = '';

      curlProcess.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      curlProcess.on('error', (error) => {
        reject(new Error(`curl 执行失败: ${error.message}（请确保系统已安装curl）`));
      });

      curlProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`curl 下载失败，退出码: ${code}${errorOutput ? `，错误: ${errorOutput}` : ''}`));
        }
      });

      // 监听取消信号
      if (abortSignal) {
        abortSignal.addEventListener('abort', () => {
          curlProcess.kill('SIGTERM');
          reject(new Error('下载已取消'));
        });
      }
    });
  }

  /**
   * 判断是否为外部视频URL（需要 yt-dlp 下载）
   */
  private isExternalVideoUrl(url: string): boolean {
    const externalPlatforms = [
      'youtube.com', 'youtu.be',
      'twitter.com', 'x.com',
      'vimeo.com',
      'tiktok.com',
      'instagram.com',
      'facebook.com',
      'twitch.tv',
      'dailymotion.com'
    ];
    
    return externalPlatforms.some(platform => url.includes(platform));
  }

  /**
   * 使用 yt-dlp 下载外部视频
   */
  private async downloadWithYtDlp(
    url: string,
    outputPath: string,
    abortSignal?: AbortSignal,
    articleId?: string
  ): Promise<void> {
    // 查找 yt-dlp 可执行文件
    const ytDlpPath = this.findYtDlp();
    if (!ytDlpPath) {
      throw new Error(
        'yt-dlp 未安装或不在 PATH 中\n\n' +
        '解决方案：\n' +
        '1. 手动安装：\n' +
        '   - Windows: winget install yt-dlp.yt-dlp\n' +
        '   - 或访问: https://github.com/yt-dlp/yt-dlp/releases\n' +
        '2. 安装后请【完全关闭并重新打开】应用程序\n\n' +
        '提示：Windows 系统需要完全重启应用才能识别新安装的工具'
      );
    }

    LogService.log(`使用 yt-dlp 下载视频: ${ytDlpPath}`, 'BilibiliService');

    return new Promise((resolve, reject) => {
      const args = [
        url,
        '-o', outputPath,
        '--no-playlist',              // 不下载播放列表
        '--format', 'bestvideo+bestaudio/best',  // 下载最高画质视频+最佳音频
        '--merge-output-format', 'mp4', // 合并为 mp4
        '--progress',                 // 显示进度
        '--newline',                  // 每行显示新进度
        '--extractor-args', 'youtube:player_client=android_vr'  // android_vr 客户端不需要 PO Token
      ];

      const process = spawn(ytDlpPath, args, {
        shell: true,
        windowsHide: true
      });

      let lastProgress = 0;

      process.stdout?.on('data', (data) => {
        const output = data.toString();
        
        // 解析下载进度
        const progressMatch = output.match(/(\d+\.\d+)%/);
        if (progressMatch) {
          const progress = parseFloat(progressMatch[1]);
          if (Math.floor(progress / 10) > Math.floor(lastProgress / 10)) {
            LogService.log(`yt-dlp 下载进度: ${progress.toFixed(1)}%`, 'BilibiliService');
            // 发送进度到前端
            this.sendProgress('downloading', progress, '正在下载视频', articleId);
            lastProgress = progress;
          }
        }
      });

      process.stderr?.on('data', (data) => {
        const error = data.toString();
        if (!error.includes('WARNING')) {
          LogService.warn(`yt-dlp: ${error}`, 'BilibiliService');
        }
      });

      process.on('error', (error) => {
        reject(new Error(`yt-dlp 执行失败: ${error.message}`));
      });

      process.on('close', (code) => {
        if (code === 0) {
          LogService.success('yt-dlp 下载完成', 'BilibiliService');
          resolve();
        } else {
          reject(new Error(`yt-dlp 下载失败，退出码: ${code}`));
        }
      });

      // 监听取消信号
      if (abortSignal) {
        abortSignal.addEventListener('abort', () => {
          process.kill();
          // 删除不完整的文件
          if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
          }
          reject(new Error('下载已取消'));
        });
      }
    });
  }

  /**
   * 查找 biliup 可执行文件路径（WinGet 安装、手动解压等）
   */
  private findBiliup(): string | null {
    const possiblePaths = [
      // app 内置 tools 目录（自动下载位置，最高优先级）
      path.join(this.toolsDir, 'biliup.exe'),
      // WinGet 安装位置
      path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages', 'ForgQi.biliup-rs_Microsoft.Winget.Source_8wekyb3d8bbwe', 'biliup.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links', 'biliup.exe'),
      // 用户本地安装
      path.join(process.env.USERPROFILE || '', '.local', 'bin', 'biliup.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'biliup', 'biliup.exe'),
      // 系统安装
      path.join(process.env.ProgramFiles || '', 'biliup', 'biliup.exe'),
      // PATH 中（最后尝试）
      'biliup'
    ];

    for (const p of possiblePaths) {
      try {
        if (p === 'biliup') {
          const { execSync } = require('child_process');
          try {
            execSync('biliup --version', { stdio: 'pipe', windowsHide: true });
            LogService.log('在 PATH 中找到 biliup', 'BilibiliService');
            return 'biliup';
          } catch {
            continue;
          }
        } else if (fs.existsSync(p)) {
          LogService.log(`找到 biliup: ${p}`, 'BilibiliService');
          return p;
        }
      } catch {
        continue;
      }
    }

    LogService.error('未找到 biliup，已检查以下位置:', 'BilibiliService');
    possiblePaths.forEach(p => LogService.error(`  - ${p}`, 'BilibiliService'));

    return null;
  }

  /**
   * 自动下载并安装 biliup 到 app 本地 tools 目录
   * 返回安装后的可执行文件路径，失败返回 null
   */
  async downloadAndInstallBiliup(): Promise<string | null> {
    const targetPath = path.join(this.toolsDir, 'biliup.exe');

    if (fs.existsSync(targetPath)) {
      LogService.log('biliup 已存在于 tools 目录', 'BilibiliService');
      this.biliupPath = targetPath;
      return targetPath;
    }

    if (!fs.existsSync(this.toolsDir)) {
      fs.mkdirSync(this.toolsDir, { recursive: true });
    }

    LogService.log('开始自动下载 biliup...', 'BilibiliService');

    let downloadUrl = BILIUP_FALLBACK_URL;

    // 尝试从 GitHub API 获取最新版本
    try {
      const resp = await axios.get(BILIUP_GITHUB_API, {
        timeout: 10000,
        headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'NotionSyncOne' }
      });
      const assets: any[] = resp.data?.assets || [];
      const winAsset = assets.find((a: any) =>
        a.name && a.name.includes('x86_64-windows') && a.name.endsWith('.zip')
      );
      if (winAsset?.browser_download_url) {
        downloadUrl = winAsset.browser_download_url;
        LogService.log(`获取到最新版本: ${resp.data.tag_name}`, 'BilibiliService');
      }
    } catch {
      LogService.warn('无法获取最新版本信息，使用备用下载地址', 'BilibiliService');
    }

    const zipPath = path.join(this.toolsDir, 'biliup-download.zip');

    try {
      // 下载 zip
      LogService.log(`下载地址: ${downloadUrl}`, 'BilibiliService');
      const response = await axios.get(downloadUrl, {
        responseType: 'arraybuffer',
        timeout: 120000,
        headers: { 'User-Agent': 'NotionSyncOne' },
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            if (pct % 20 === 0) {
              LogService.log(`biliup 下载进度: ${pct}%`, 'BilibiliService');
            }
          }
        }
      });

      fs.writeFileSync(zipPath, Buffer.from(response.data));
      LogService.log('下载完成，正在解压...', 'BilibiliService');

      // 使用 PowerShell 解压（Windows 10+ 自带）
      const extractDir = path.join(this.toolsDir, 'biliup-extract');
      if (fs.existsSync(extractDir)) {
        fs.rmSync(extractDir, { recursive: true, force: true });
      }

      const { execSync } = require('child_process');
      execSync(
        `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force"`,
        { stdio: 'pipe', windowsHide: true, timeout: 30000 }
      );

      // 在解压目录中递归查找 biliup.exe
      const found = this.findFileRecursive(extractDir, 'biliup.exe');
      if (!found) {
        throw new Error('解压后未找到 biliup.exe');
      }

      // 移动到 tools 目录
      fs.copyFileSync(found, targetPath);
      LogService.success(`biliup 安装成功: ${targetPath}`, 'BilibiliService');

      // 清理临时文件
      try {
        fs.unlinkSync(zipPath);
        fs.rmSync(extractDir, { recursive: true, force: true });
      } catch { /* 清理失败不影响功能 */ }

      this.biliupPath = targetPath;
      return targetPath;
    } catch (error) {
      LogService.error('自动下载 biliup 失败', 'BilibiliService', error);
      // 清理可能的残留文件
      try { if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath); } catch { /* ignore */ }
      return null;
    }
  }

  private findFileRecursive(dir: string, filename: string): string | null {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const result = this.findFileRecursive(fullPath, filename);
        if (result) return result;
      } else if (entry.name.toLowerCase() === filename.toLowerCase()) {
        return fullPath;
      }
    }
    return null;
  }

  /**
   * 确保 biliup 可用：先查找，找不到则自动下载
   */
  async ensureBiliupInstalled(): Promise<boolean> {
    if (await this.checkBiliupInstalled()) {
      return true;
    }

    LogService.log('biliup 未找到，尝试自动下载安装...', 'BilibiliService');
    const installed = await this.downloadAndInstallBiliup();
    return installed !== null;
  }

  /**
   * 查找 yt-dlp 可执行文件路径
   */
  private findYtDlp(): string | null {
    // Windows 常见安装位置
    const possiblePaths = [
      // WinGet 安装位置
      path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages', 'yt-dlp.yt-dlp_Microsoft.Winget.Source_8wekyb3d8bbwe', 'yt-dlp.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links', 'yt-dlp.exe'),
      // 用户本地安装
      path.join(process.env.USERPROFILE || '', '.local', 'bin', 'yt-dlp.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'yt-dlp', 'yt-dlp.exe'),
      // 系统安装
      path.join(process.env.ProgramFiles || '', 'yt-dlp', 'yt-dlp.exe'),
      // PATH 中的 yt-dlp（最后尝试）
      'yt-dlp'
    ];

    for (const ytdlpPath of possiblePaths) {
      try {
        if (ytdlpPath === 'yt-dlp') {
          // 尝试直接执行（在 PATH 中）
          const { execSync } = require('child_process');
          try {
            execSync('yt-dlp --version', { stdio: 'pipe', windowsHide: true });
            LogService.log('在 PATH 中找到 yt-dlp', 'BilibiliService');
            return 'yt-dlp';
          } catch {
            continue;
          }
        } else if (fs.existsSync(ytdlpPath)) {
          LogService.log(`找到 yt-dlp: ${ytdlpPath}`, 'BilibiliService');
          return ytdlpPath;
        }
      } catch {
        continue;
      }
    }

    // 如果都没找到，记录详细信息
    LogService.error('未找到 yt-dlp，已检查以下位置:', 'BilibiliService');
    possiblePaths.forEach(p => LogService.error(`  - ${p}`, 'BilibiliService'));
    
    return null;
  }

  /**
   * 直接下载视频文件（使用 axios）
   */
  private async downloadDirectVideo(
    url: string,
    localPath: string,
    abortSignal?: AbortSignal
  ): Promise<void> {
    const response = await axios.get(url, {
      responseType: 'stream',
      timeout: 300000, // 5分钟超时
      signal: abortSignal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'video/*,*/*;q=0.8',
      },
      onDownloadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          if (progress % 10 === 0) {
            LogService.log(`下载进度: ${progress}%`, 'BilibiliService');
          }
        }
      }
    });

    // 写入文件
    const writer = fs.createWriteStream(localPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        resolve();
      });

      writer.on('error', (error) => {
        reject(new Error(`文件写入失败: ${error.message}`));
      });

      // 监听取消信号
      if (abortSignal) {
        abortSignal.addEventListener('abort', () => {
          writer.destroy();
          // 删除不完整的文件
          if (fs.existsSync(localPath)) {
            fs.unlinkSync(localPath);
          }
          reject(new Error('下载已取消'));
        });
      }
    });
  }

  /**
   * 压缩视频（使用FFmpeg）
   */
  async compressVideo(
    inputPath: string,
    quality: number = 23,
    abortSignal?: AbortSignal
  ): Promise<string> {
    try {
      const hasFFmpeg = await this.checkFFmpegInstalled();
      if (!hasFFmpeg) {
        throw new Error('FFmpeg 未安装，无法压缩视频。请安装 FFmpeg 或手动压缩视频后上传。');
      }

      // 检查是否已取消
      if (abortSignal?.aborted) {
        throw new Error('压缩已取消');
      }

      LogService.log(`开始压缩视频，质量参数: CRF ${quality}`, 'BilibiliService');

      const outputPath = inputPath.replace(/(\.\w+)$/, '_compressed$1');

      return new Promise((resolve, reject) => {
        const ffmpegArgs = [
          '-i', inputPath,
          '-vcodec', 'libx264',
          '-crf', quality.toString(),
          '-preset', 'medium',
          '-acodec', 'aac',
          '-b:a', '128k',
          '-y', // 覆盖输出文件
          outputPath
        ];

        const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

        let stderr = '';

        ffmpegProcess.stderr?.on('data', (data) => {
          const message = data.toString();
          stderr += message;
          
          // 提取进度信息
          const timeMatch = message.match(/time=(\d+:\d+:\d+\.\d+)/);
          if (timeMatch) {
            LogService.log(`压缩进度: ${timeMatch[1]}`, 'BilibiliService');
          }
        });

        ffmpegProcess.on('close', (code) => {
          if (code === 0) {
            const originalSize = fs.statSync(inputPath).size;
            const compressedSize = fs.statSync(outputPath).size;
            const savedPercent = ((1 - compressedSize / originalSize) * 100).toFixed(1);
            
            LogService.success(
              `视频压缩完成: ${(originalSize / 1024 / 1024).toFixed(2)} MB → ${(compressedSize / 1024 / 1024).toFixed(2)} MB (节省 ${savedPercent}%)`,
              'BilibiliService'
            );
            
            // 删除原始文件
            fs.unlinkSync(inputPath);
            
            resolve(outputPath);
          } else {
            LogService.error(`FFmpeg错误输出: ${stderr}`, 'BilibiliService');
            reject(new Error(`视频压缩失败，退出码: ${code}`));
          }
        });

        ffmpegProcess.on('error', (error) => {
          reject(new Error(`FFmpeg进程错误: ${error.message}`));
        });

        // 监听取消信号
        if (abortSignal) {
          abortSignal.addEventListener('abort', () => {
            ffmpegProcess.kill();
            // 删除不完整的压缩文件
            if (fs.existsSync(outputPath)) {
              fs.unlinkSync(outputPath);
            }
            reject(new Error('压缩已取消'));
          });
        }
      });
    } catch (error) {
      LogService.error('视频压缩失败', 'BilibiliService');
      throw error;
    }
  }

  /**
   * 上传视频到B站
   */
  async uploadVideo(
    options: BilibiliUploadOptions,
    abortSignal?: AbortSignal
  ): Promise<BilibiliUploadResult> {
    try {
      const isReady = await this.ensureBiliupInstalled();
      if (!isReady) {
        throw new Error(
          'biliup 自动安装失败\n\n' +
          '请手动安装：\n' +
          '   - Windows: winget install -e --id ForgQi.biliup-rs\n' +
          '   - 或访问: https://github.com/biliup/biliup/releases\n' +
          '安装后请【完全关闭并重新打开】应用程序'
        );
      }

      // 检查是否已取消
      if (abortSignal?.aborted) {
        throw new Error('上传已取消');
      }

      const config = this.configService.getBilibiliConfig();
      
      // 调试日志：检查配置读取
      LogService.log(`读取到的 Bilibili 配置:`, 'BilibiliService');
      LogService.log(`  - defaultTid: ${config.defaultTid}`, 'BilibiliService');
      LogService.log(`  - defaultTags: [${(config.defaultTags || []).join(', ')}]`, 'BilibiliService');
      LogService.log(`  - defaultSeasonId: ${config.defaultSeasonId}`, 'BilibiliService');
      
      const cookieFile = config.cookieFile || path.join(this.tempDir, 'cookies.json');

      if (!fs.existsSync(cookieFile)) {
        throw new Error('未登录B站，请先在设置中点击"扫码登录"');
      }

      // 安全检查：确保Cookie文件权限正确（仅限当前用户读写）
      try {
        fs.chmodSync(cookieFile, 0o600); // rw------- (仅所有者可读写)
      } catch (err) {
        LogService.warn('无法设置Cookie文件权限（Windows系统可能不支持）', 'BilibiliService');
      }

      LogService.log('========== BilibiliService: 开始上传视频 ==========', 'BilibiliService');
      LogService.log(`发布模式: ${options.publishMode}`, 'BilibiliService');
      LogService.log(`视频标题: ${options.metadata.title}`, 'BilibiliService');
      LogService.log(`视频数量: ${options.videos.length}`, 'BilibiliService');

      // 准备视频文件路径
      const videoFiles: string[] = [];
      
      for (const video of options.videos) {
        if (!video.localPath) {
          throw new Error('视频尚未下载');
        }

        let finalPath = video.localPath;

        // 检查是否需要压缩
        if (options.autoCompress && video.needsCompression) {
          LogService.log(`视频需要压缩: ${finalPath}`, 'BilibiliService');
          finalPath = await this.compressVideo(
            video.localPath,
            options.compressionQuality || 23,
            abortSignal
          );
        }

        videoFiles.push(finalPath);
      }

      // 合并配置：使用传入的 metadata，未指定的字段从配置中获取默认值
      LogService.log(`传入的 metadata:`, 'BilibiliService');
      LogService.log(`  - tid: ${options.metadata.tid}`, 'BilibiliService');
      LogService.log(`  - tags: [${(options.metadata.tags || []).join(', ')}]`, 'BilibiliService');

      // 处理简介模板
      let finalDesc = options.metadata.desc;
      if (!finalDesc && config.descTemplate) {
        // 获取 Notion 属性
        const props = options.metadata.notionProps || {};
        
        // 格式化添加时间
        let formattedDate = new Date().toLocaleDateString('zh-CN');
        if (props.addedTime) {
          formattedDate = new Date(props.addedTime).toLocaleDateString('zh-CN', { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit' 
          });
        }
        
        // 格式化标签
        const tagsStr = props.tags && props.tags.length > 0 
          ? props.tags.join('、') 
          : '';
        
        // 格式化期望值
        const rateStr = props.expectationsRate !== undefined 
          ? `${props.expectationsRate}/10` 
          : '';
        
        // 使用模板生成简介，支持更多变量
        finalDesc = config.descTemplate
          .replace(/\{title\}/g, options.metadata.title)
          .replace(/\{url\}/g, options.metadata.source || props.linkStart || '')
          .replace(/\{date\}/g, formattedDate)
          .replace(/\{from\}/g, props.linkStart || '')  // from 直接使用 linkStart
          .replace(/\{author\}/g, props.author || '')
          .replace(/\{engine\}/g, props.engine || '')
          .replace(/\{rate\}/g, rateStr)
          .replace(/\{tags\}/g, tagsStr);
        
        LogService.log(`使用模板生成简介: ${finalDesc.substring(0, 100)}...`, 'BilibiliService');
      }

      const finalMetadata = {
        title: options.metadata.title || '未命名视频',
        tid: options.metadata.tid ?? config.defaultTid ?? 21,
        tags: options.metadata.tags?.length > 0 ? options.metadata.tags : (config.defaultTags || []),
        desc: finalDesc || '',
        source: options.metadata.source || '',  // 使用传入的 source（来自 Notion LinkStart）
        cover: options.metadata.cover,  // 使用传入的 cover（来自 Notion 封面）
        dynamic: options.metadata.dynamic,
        copyright: options.metadata.copyright ?? config.copyright ?? 1,
        noReprint: options.metadata.noReprint ?? config.noReprint ?? 0,
        openElec: options.metadata.openElec ?? config.openElec ?? 0,
        upCloseReply: options.metadata.upCloseReply ?? config.upCloseReply ?? false,
        upCloseDanmu: options.metadata.upCloseDanmu ?? config.upCloseDanmu ?? false
      };

      LogService.log(`合并后的最终元数据:`, 'BilibiliService');
      LogService.log(`  - tid: ${finalMetadata.tid}`, 'BilibiliService');
      LogService.log(`  - tags: [${finalMetadata.tags.join(', ')}]`, 'BilibiliService');
      LogService.log(`  - copyright: ${finalMetadata.copyright}`, 'BilibiliService');

      // 构建biliup命令参数
      const args = [
        '-u', cookieFile,
        'upload',
        '--title', finalMetadata.title,
        '--tid', finalMetadata.tid.toString(),
        '--copyright', finalMetadata.copyright.toString(),
        '--no-reprint', finalMetadata.noReprint.toString(),
        '--open-elec', finalMetadata.openElec.toString()
      ];

      // 标签（必须至少有一个）
      if (finalMetadata.tags.length > 0) {
        args.push('--tag', finalMetadata.tags.join(','));
      } else {
        args.push('--tag', '日常'); // 默认标签
      }

      // 可选参数
      if (finalMetadata.desc) {
        // 清理简介内容，避免命令行解析问题
        let cleanDesc = finalMetadata.desc.trim();
        // 避免以 - 开头（会被误认为命令行参数）
        cleanDesc = cleanDesc.replace(/^-+/gm, match => '·'.repeat(match.length));
        // 限制长度（B站简介最多2000字符）
        if (cleanDesc.length > 2000) {
          cleanDesc = cleanDesc.substring(0, 1997) + '...';
        }
        args.push('--desc', cleanDesc);
      }
      // 转载来源：只在版权类型为"转载"时传递（B站强制要求）
      // 否则用户可以在 descTemplate 中通过 {url} 变量自定义位置
      if (finalMetadata.source && finalMetadata.copyright === 2) {
        args.push('--source', finalMetadata.source);
      }
      // 封面图片：如果是 URL，先下载到本地
      if (finalMetadata.cover) {
        try {
          // 检查是否为 URL（以 http 开头）
          if (finalMetadata.cover.startsWith('http://') || finalMetadata.cover.startsWith('https://')) {
            LogService.log('封面图片是 URL，正在下载到本地...', 'BilibiliService');
            const localCoverPath = await this.downloadCoverImage(finalMetadata.cover, abortSignal);
            args.push('--cover', localCoverPath);
            LogService.log(`✓ 使用本地封面图片: ${localCoverPath}`, 'BilibiliService');
          } else {
            // 已经是本地路径，直接使用
            args.push('--cover', finalMetadata.cover);
            LogService.log(`✓ 使用本地封面图片: ${finalMetadata.cover}`, 'BilibiliService');
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          LogService.warn(`封面图片处理失败: ${errorMsg}`, 'BilibiliService');
          LogService.log('ℹ️  将使用B站默认封面（视频第一帧）', 'BilibiliService');
          // 不抛出错误，继续上传（没有封面图片）
        }
      }
      if (finalMetadata.dynamic) {
        args.push('--dynamic', finalMetadata.dynamic);
      }
      
      // 评论和弹幕设置（仅app接口支持）
      if (finalMetadata.upCloseReply) {
        args.push('--up-close-reply');
      }
      if (finalMetadata.upCloseDanmu) {
        args.push('--up-close-danmu');
      }
      
      // 注意：biliup-rs 不支持真正的草稿模式
      // 上传后会自动提交审核，无法保存为草稿
      args.push('--line', 'bda2'); // 使用 bda2 线路（百度云）

      if (options.publishMode === 'draft') {
        // B站不支持真正的草稿模式，但可以用延时发布来模拟
        // 延时发布限制：≥2小时 且 ≤15天
        LogService.warn('注意：B站不支持草稿模式，将使用"延时发布15天"来模拟', 'BilibiliService');
        LogService.warn('如需修改或取消，请在B站创作中心手动操作', 'BilibiliService');
        
        // 设置为14天后（保险起见，避免临界值问题）
        const futureTime = Math.floor(Date.now() / 1000) + (14 * 24 * 60 * 60);
        args.push('--dtime', futureTime.toString());
        LogService.log(`使用延时发布14天后模拟草稿模式`, 'BilibiliService');
      }

      // 添加视频文件
      args.push(...videoFiles);

      LogService.log(`执行命令: biliup ${args.join(' ')}`, 'BilibiliService');

      // 执行上传
      return new Promise((resolve, reject) => {
        const uploadProcess = spawn(this.biliupPath, args);

        let output = '';
        let errorOutput = '';
        let lastProgress = 0;

        uploadProcess.stdout?.on('data', (data) => {
          const message = data.toString();
          output += message;
          
          // 解析上传进度
          const progressMatch = message.match(/(\d+(?:\.\d+)?)\s*%/);
          if (progressMatch) {
            const progress = parseFloat(progressMatch[1]);
            if (Math.floor(progress / 10) > Math.floor(lastProgress / 10)) {
              LogService.log(`📤 上传进度: ${progress.toFixed(1)}%`, 'BilibiliService');
              this.sendProgress('uploading', progress, '正在上传视频', options.articleId);
              lastProgress = progress;
            }
          }
        });

        uploadProcess.stderr?.on('data', (data) => {
          const message = data.toString();
          errorOutput += message;
          
          // stderr 也可能包含进度信息
          const progressMatch = message.match(/(\d+(?:\.\d+)?)\s*%/);
          if (progressMatch) {
            const progress = parseFloat(progressMatch[1]);
            if (Math.floor(progress / 10) > Math.floor(lastProgress / 10)) {
              LogService.log(`📤 上传进度: ${progress.toFixed(1)}%`, 'BilibiliService');
              this.sendProgress('uploading', progress, '正在上传视频', options.articleId);
              lastProgress = progress;
            }
          }
        });

        uploadProcess.on('close', (code) => {
          // 清理临时文件（保留缓存文件）
          videoFiles.forEach(file => {
            // 只删除非缓存文件（video_xxx.mp4），保留缓存文件（cached_xxx.mp4）
            const filename = path.basename(file);
            if (fs.existsSync(file) && !filename.startsWith('cached_')) {
              fs.unlinkSync(file);
              LogService.log(`已删除临时文件: ${file}`, 'BilibiliService');
            }
          });

          if (code === 0) {
            // 尝试从输出中提取稿件信息
            const bvidMatch = output.match(/BV[a-zA-Z0-9]+/);
            const aidMatch = output.match(/aid[:\s]+(\d+)/i);

            const result: BilibiliUploadResult = {
              isDraft: options.publishMode === 'draft',
              bvid: bvidMatch?.[0],
              aid: aidMatch ? parseInt(aidMatch[1]) : undefined,
            };

            if (result.bvid) {
              result.link = `https://www.bilibili.com/video/${result.bvid}`;
            }

            LogService.success('========== 视频上传成功 ==========', 'BilibiliService');
            if (result.link) {
              LogService.log(`稿件链接: ${result.link}`, 'BilibiliService');
            }

            resolve(result);
          } else {
            reject(new Error(`上传失败，退出码: ${code}\n${errorOutput}`));
          }
        });

        uploadProcess.on('error', (error) => {
          // 清理临时文件（保留缓存文件）
          videoFiles.forEach(file => {
            const filename = path.basename(file);
            if (fs.existsSync(file) && !filename.startsWith('cached_')) {
              fs.unlinkSync(file);
            }
          });
          reject(new Error(`上传进程错误: ${error.message}`));
        });

        // 监听取消信号
        if (abortSignal) {
          abortSignal.addEventListener('abort', () => {
            uploadProcess.kill();
            // 清理临时文件（保留缓存文件）
            videoFiles.forEach(file => {
              const filename = path.basename(file);
              if (fs.existsSync(file) && !filename.startsWith('cached_')) {
                fs.unlinkSync(file);
              }
            });
            reject(new Error('上传已取消'));
          });
        }
      });
    } catch (error) {
      LogService.error('========== BilibiliService: 上传视频失败 ==========', 'BilibiliService');
      const errorMessage = error instanceof Error ? error.message : String(error);
      LogService.error(`错误: ${errorMessage}`, 'BilibiliService');
      throw error;
    }
  }

  /**
   * 清理临时目录
   */
  /**
   * 清理临时文件和敏感数据
   */
  cleanup(): void {
    try {
      if (fs.existsSync(this.tempDir)) {
        const files = fs.readdirSync(this.tempDir);
        // 只删除 video_ 开头的临时文件，保留 cached_ 缓存和 cookie
        files.forEach(file => {
          if (!file.includes('cookie') && !file.startsWith('cached_')) {
            const filePath = path.join(this.tempDir, file);
            if (file.startsWith('video_') && fs.statSync(filePath).isFile()) {
              fs.unlinkSync(filePath);
            }
          }
        });
        LogService.log('临时文件清理完成（已保留登录状态和缓存）', 'BilibiliService');
      }
    } catch (error) {
      LogService.warn(`清理临时文件失败: ${error}`, 'BilibiliService');
    }
  }

  /**
   * 退出登录（删除Cookie）
   * 安全功能：让用户可以主动删除登录凭证
   */
  async logout(): Promise<void> {
    try {
      const config = this.configService.getBilibiliConfig();
      const cookieFile = config.cookieFile || path.join(this.tempDir, 'cookies.json');
      
      if (fs.existsSync(cookieFile)) {
        // 安全删除：先覆盖再删除
        const fileSize = fs.statSync(cookieFile).size;
        const buffer = Buffer.alloc(fileSize, 0);
        fs.writeFileSync(cookieFile, buffer);
        fs.unlinkSync(cookieFile);
        LogService.success('已安全退出B站登录，Cookie已删除', 'BilibiliService');
      }
      
      // 更新配置
      this.configService.saveBilibiliConfig({
        enabled: false
      });
    } catch (error) {
      LogService.error('退出登录失败', 'BilibiliService', error);
      throw error;
    }
  }
}
