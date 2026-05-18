const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getNotionProperty,
  readPlainText,
  readSelectNames,
  readDateValue
} = require('../src/main/services/sync/notionFields.ts');

test('notion field helpers keep old defaults and allow custom field names', () => {
  const page = {
    properties: {
      LinkStart: { type: 'url', url: 'https://default.example' },
      SourceUrl: { type: 'rich_text', rich_text: [{ plain_text: 'https://custom.example' }] },
      MyTags: { type: 'multi_select', multi_select: [{ name: 'A' }, { name: 'B' }] },
      MyDate: { type: 'created_time', created_time: '2026-05-17T00:00:00.000Z' }
    }
  };

  assert.equal(readPlainText(getNotionProperty(page, undefined, 'linkStart')), 'https://default.example');
  assert.equal(readPlainText(getNotionProperty(page, { fieldMap: { linkStart: 'SourceUrl' } }, 'linkStart')), 'https://custom.example');
  assert.deepEqual(readSelectNames(getNotionProperty(page, { fieldMap: { featureTag: 'MyTags' } }, 'featureTag')), ['A', 'B']);
  assert.equal(readDateValue(getNotionProperty(page, { fieldMap: { addedTime: 'MyDate' } }, 'addedTime')), '2026-05-17T00:00:00.000Z');
});
