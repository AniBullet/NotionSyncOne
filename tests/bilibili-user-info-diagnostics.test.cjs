const assert = require('node:assert/strict');
const test = require('node:test');

require('ts-node/register/transpile-only');

const {
  describeBilibiliApiFailure,
  getBilibiliFallbackUserInfo,
  getBilibiliUserInfoApiEndpoints
} = require('../src/main/services/BilibiliService.ts');

test('bilibili user info diagnostics include http status and api message', () => {
  const detail = describeBilibiliApiFailure({
    isAxiosError: true,
    message: 'Request failed with status code 412',
    response: {
      status: 412,
      data: {
        code: -352,
        message: '账号状态异常'
      }
    }
  });

  assert.equal(detail, 'HTTP 412, code -352, message: 账号状态异常');
});

test('bilibili user info diagnostics include network error message', () => {
  const detail = describeBilibiliApiFailure({
    isAxiosError: true,
    code: 'ECONNABORTED',
    message: 'timeout of 8000ms exceeded'
  });

  assert.equal(detail, 'network ECONNABORTED, timeout of 8000ms exceeded');
});

test('bilibili fallback user info treats cookie uid as logged in', () => {
  assert.deepEqual(getBilibiliFallbackUserInfo('2031113'), {
    name: '已登录，昵称暂不可用',
    mid: '2031113',
    verifiedByCookie: true
  });
});

test('bilibili nickname lookup avoids unsigned space APIs that return noisy 400s', () => {
  const endpoints = getBilibiliUserInfoApiEndpoints('2031113');
  assert.deepEqual(endpoints, ['https://api.bilibili.com/x/member/web/account']);
});
