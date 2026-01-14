/**
 * 应用常量
 * 版本号自动从 package.json 读取
 */
import packageJson from '../../package.json';

export const APP_VERSION = packageJson.version;
export const GITHUB_REPO = 'https://github.com/AniBullet/NotionSyncOne';
