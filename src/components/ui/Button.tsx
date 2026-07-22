import React from 'react';
import clsx from '@/utils/clsx';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary';
};

export const baseStyles =
  'rounded px-4 py-2 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

const variantStyles: Record<string, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
  secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
};

export const Button: React.FC<ButtonProps> = ({ variant = 'primary', className, ...props }) => {
  return <button className={clsx(baseStyles, variantStyles[variant], className)} {...props} />;
};
