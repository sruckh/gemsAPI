import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  isLoading?: boolean;
}

const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  isLoading, 
  className = '', 
  disabled, 
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center px-6 py-2 text-sm font-medium rounded-full focus:outline-none focus:ring-2 focus:ring-offset-1 dark:focus:ring-offset-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  
  // Google-like colors
  const variants = {
    primary: "bg-[#1a73e8] text-white hover:bg-[#1557b0] focus:ring-blue-500 shadow-sm", // Google Blue
    secondary: "bg-white dark:bg-transparent text-[#1a73e8] dark:text-blue-400 border border-[#dadce0] dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 focus:ring-blue-500",
    danger: "bg-[#d93025] text-white hover:bg-[#b31412] focus:ring-red-500", // Google Red
    ghost: "text-[#5f6368] dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-[#202124] dark:hover:text-gray-100",
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Processing...
        </>
      ) : children}
    </button>
  );
};

export default Button;