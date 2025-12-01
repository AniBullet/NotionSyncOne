import React from 'react';
import { NotionPage } from '../../shared/types/notion';
import { WeChatArticle } from '../../shared/types/wechat';

interface ArticlePreviewProps {
  article: NotionPage;
}

const ArticlePreview: React.FC<ArticlePreviewProps> = ({ article }) => {
  const [weChatArticle, setWeChatArticle] = React.useState<WeChatArticle | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const loadContent = async () => {
      try {
        setLoading(true);
        setError(null);
        // 使用 preview-article 获取转换后的微信公众号格式
        const result = await window.electron.ipcRenderer.invoke('preview-article', article.id);
        setWeChatArticle(result);
      } catch (err) {
        console.error('加载文章预览失败:', err);
        setError(err instanceof Error ? err.message : '加载文章预览失败');
      } finally {
        setLoading(false);
      }
    };
    loadContent();
  }, [article.id]);

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h1 className="text-2xl font-bold mb-4">{article.title}</h1>
        <div className="text-red-500">加载失败: {error}</div>
      </div>
    );
  }

  if (!weChatArticle) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h1 className="text-2xl font-bold mb-4">{article.title}</h1>
        <div className="text-gray-500">文章内容为空</div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="mb-4 pb-4 border-b">
        <h1 className="text-2xl font-bold mb-2">{weChatArticle.title}</h1>
        {weChatArticle.author && (
          <p className="text-sm text-gray-500">作者: {weChatArticle.author}</p>
        )}
        {weChatArticle.digest && (
          <p className="text-sm text-gray-500 mt-1">摘要: {weChatArticle.digest}</p>
        )}
        <p className="text-xs text-gray-400 mt-2">预览：微信公众号草稿箱格式</p>
      </div>
      <div 
        className="prose max-w-none wechat-preview"
        dangerouslySetInnerHTML={{ __html: weChatArticle.content }}
        style={{
          fontSize: '16px',
          lineHeight: '1.8',
          color: '#333'
        }}
      />
    </div>
  );
};

export default ArticlePreview; 