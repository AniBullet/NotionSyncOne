const assert = require('node:assert/strict');
const test = require('node:test');

require('ts-node/register/transpile-only');

const {
  describeBilibiliApiFailure
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
