import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-background border-t border-gray-200">
      <div className="text-foreground/70 container mx-auto px-6 py-4 text-center text-sm">
        © {new Date().getFullYear()} Derlist. All rights reserved.
      </div>
    </footer>
  );
};
