// 主题样式定义
export interface ThemeStyles {
  // 主题名称
  name: string;
  
  // 基础文本样式
  base: {
    fontSize: string;
    lineHeight: string;
    color: string;
    backgroundColor?: string;
  };
  
  // 标题样式
  heading: {
    h1: {
      fontSize: string;
      color: string;
      borderColor?: string;
      fontWeight?: string;
    };
    h2: {
      fontSize: string;
      color: string;
      fontWeight?: string;
    };
    h3: {
      fontSize: string;
      color: string;
      fontWeight?: string;
    };
  };
  
  // 链接样式
  link: {
    color: string;
    borderColor?: string;
  };
  
  // 代码样式
  code: {
    inlineBackground: string;
    inlineColor: string;
    blockBackground: string;
    blockColor: string;
  };
  
  // 引用块样式
  quote: {
    background: string;
    borderColor: string;
    color: string;
  };
  
  // 其他元素
  notice: {
    background: string;
    borderColor: string;
    color: string;
  };
}

// 预定义主题
export const themes: { [key: string]: ThemeStyles } = {
  // 默认主题
  default: {
    name: '默认',
    base: {
      fontSize: '16px',
      lineHeight: '1.75',
      color: '#333',
    },
    heading: {
      h1: {
        fontSize: '1.6em',
        color: '#2c2c2c',
        borderColor: '#e8e8e8',
        fontWeight: '600',
      },
      h2: {
        fontSize: '1.3em',
        color: '#2c2c2c',
        fontWeight: '600',
      },
      h3: {
        fontSize: '1.15em',
        color: '#2c2c2c',
        fontWeight: '600',
      },
    },
    link: {
      color: '#1890ff',
      borderColor: '#1890ff',
    },
    code: {
      inlineBackground: '#f5f5f5',
      inlineColor: '#e83e8c',
      blockBackground: 'linear-gradient(to bottom, #2d2d2d 0%, #1e1e1e 100%)',
      blockColor: '#d4d4d4',
    },
    quote: {
      background: '#f8f9fa',
      borderColor: '#576b95',
      color: '#666',
    },
    notice: {
      background: '#f0f4ff',
      borderColor: '#576b95',
      color: '#576b95',
    },
  },
  
  // 微信主题（商务风格）
  wechat: {
    name: '微信',
    base: {
      fontSize: '16px',
      lineHeight: '1.75',
      color: '#3a3a3a',
    },
    heading: {
      h1: {
        fontSize: '1.6em',
        color: '#07c160',
        borderColor: '#07c160',
        fontWeight: '700',
      },
      h2: {
        fontSize: '1.3em',
        color: '#07c160',
        fontWeight: '600',
      },
      h3: {
        fontSize: '1.15em',
        color: '#07c160',
        fontWeight: '600',
      },
    },
    link: {
      color: '#576b95',
      borderColor: '#576b95',
    },
    code: {
      inlineBackground: '#eef9f0',
      inlineColor: '#07c160',
      blockBackground: 'linear-gradient(to bottom, #1e3a1e 0%, #0f250f 100%)',
      blockColor: '#a5d6a7',
    },
    quote: {
      background: '#eef9f0',
      borderColor: '#07c160',
      color: '#5a5a5a',
    },
    notice: {
      background: '#eef9f0',
      borderColor: '#07c160',
      color: '#07c160',
    },
  },
  
  // 红绯主题（热情洋溢）
  hongfei: {
    name: '红绯',
    base: {
      fontSize: '16px',
      lineHeight: '1.75',
      color: '#333',
    },
    heading: {
      h1: {
        fontSize: '1.6em',
        color: '#e63946',
        borderColor: '#e63946',
        fontWeight: '700',
      },
      h2: {
        fontSize: '1.3em',
        color: '#e63946',
        fontWeight: '600',
      },
      h3: {
        fontSize: '1.15em',
        color: '#e63946',
        fontWeight: '600',
      },
    },
    link: {
      color: '#e63946',
      borderColor: '#e63946',
    },
    code: {
      inlineBackground: '#ffe5e8',
      inlineColor: '#e63946',
      blockBackground: 'linear-gradient(to bottom, #3a1f1f 0%, #2a0f0f 100%)',
      blockColor: '#ffb3ba',
    },
    quote: {
      background: '#fff5f6',
      borderColor: '#e63946',
      color: '#666',
    },
    notice: {
      background: '#fff5f6',
      borderColor: '#e63946',
      color: '#e63946',
    },
  },
  
  // 简黑主题（酷炫个性）
  jianhei: {
    name: '简黑',
    base: {
      fontSize: '16px',
      lineHeight: '1.75',
      color: '#2c2c2c',
    },
    heading: {
      h1: {
        fontSize: '1.6em',
        color: '#000',
        borderColor: '#000',
        fontWeight: '700',
      },
      h2: {
        fontSize: '1.3em',
        color: '#000',
        fontWeight: '600',
      },
      h3: {
        fontSize: '1.15em',
        color: '#000',
        fontWeight: '600',
      },
    },
    link: {
      color: '#000',
      borderColor: '#000',
    },
    code: {
      inlineBackground: '#f0f0f0',
      inlineColor: '#000',
      blockBackground: 'linear-gradient(to bottom, #1a1a1a 0%, #000 100%)',
      blockColor: '#d4d4d4',
    },
    quote: {
      background: '#f5f5f5',
      borderColor: '#000',
      color: '#666',
    },
    notice: {
      background: '#f5f5f5',
      borderColor: '#000',
      color: '#000',
    },
  },
  
  // 山吹主题（温暖明亮）
  shanchui: {
    name: '山吹',
    base: {
      fontSize: '16px',
      lineHeight: '1.75',
      color: '#3a3a3a',
    },
    heading: {
      h1: {
        fontSize: '1.6em',
        color: '#ff9800',
        borderColor: '#ff9800',
        fontWeight: '700',
      },
      h2: {
        fontSize: '1.3em',
        color: '#ff9800',
        fontWeight: '600',
      },
      h3: {
        fontSize: '1.15em',
        color: '#ff9800',
        fontWeight: '600',
      },
    },
    link: {
      color: '#ff9800',
      borderColor: '#ff9800',
    },
    code: {
      inlineBackground: '#fff8e1',
      inlineColor: '#ff6f00',
      blockBackground: 'linear-gradient(to bottom, #3a2a0a 0%, #2a1a00 100%)',
      blockColor: '#ffd54f',
    },
    quote: {
      background: '#fffaf0',
      borderColor: '#ff9800',
      color: '#666',
    },
    notice: {
      background: '#fffaf0',
      borderColor: '#ff9800',
      color: '#ff9800',
    },
  },
  
  // 橙心主题（活力四射）
  chengxin: {
    name: '橙心',
    base: {
      fontSize: '16px',
      lineHeight: '1.75',
      color: '#333',
    },
    heading: {
      h1: {
        fontSize: '1.6em',
        color: '#ff5722',
        borderColor: '#ff5722',
        fontWeight: '700',
      },
      h2: {
        fontSize: '1.3em',
        color: '#ff5722',
        fontWeight: '600',
      },
      h3: {
        fontSize: '1.15em',
        color: '#ff5722',
        fontWeight: '600',
      },
    },
    link: {
      color: '#ff5722',
      borderColor: '#ff5722',
    },
    code: {
      inlineBackground: '#ffe8e1',
      inlineColor: '#ff5722',
      blockBackground: 'linear-gradient(to bottom, #3a1f0a 0%, #2a0f00 100%)',
      blockColor: '#ffccbc',
    },
    quote: {
      background: '#fff3e0',
      borderColor: '#ff5722',
      color: '#666',
    },
    notice: {
      background: '#fff3e0',
      borderColor: '#ff5722',
      color: '#ff5722',
    },
  },
};

