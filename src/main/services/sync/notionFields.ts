import type { NotionConfig, NotionFieldKey, NotionPage } from '../../../shared/types/notion';

export const DEFAULT_NOTION_FIELD_MAP: Record<NotionFieldKey, string> = {
  linkStart: 'LinkStart',
  from: 'From',
  author: 'Author',
  featureTag: 'FeatureTag',
  expectationsRate: 'ExpectationsRate',
  engine: 'Engine',
  addedTime: 'AddedTime'
};

export const getNotionFieldMap = (config?: Pick<NotionConfig, 'fieldMap'>): Record<NotionFieldKey, string> => ({
  ...DEFAULT_NOTION_FIELD_MAP,
  ...(config?.fieldMap || {})
});

export const getNotionProperty = (
  page: Pick<NotionPage, 'properties'>,
  config: Pick<NotionConfig, 'fieldMap'> | undefined,
  key: NotionFieldKey
) => page.properties[getNotionFieldMap(config)[key]];

export const readPlainText = (property: NotionPage['properties'][string] | undefined): string => (
  property?.url
  || property?.rich_text?.[0]?.plain_text
  || property?.title?.[0]?.plain_text
  || ''
);

export const readSelectNames = (property: NotionPage['properties'][string] | undefined): string[] => {
  if (!property) return [];
  if (property.select?.name) return [property.select.name];
  if (property.multi_select?.length) return property.multi_select.map(item => item.name);
  return [];
};

export const readDateValue = (property: NotionPage['properties'][string] | undefined): string => {
  if (!property) return '';
  if (property.date?.start) return property.date.start;
  if (property.created_time) return property.created_time;
  return '';
};
