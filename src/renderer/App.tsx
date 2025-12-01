import React from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import MainLayout from './components/MainLayout';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <MainLayout />
    </ThemeProvider>
  );
}; 