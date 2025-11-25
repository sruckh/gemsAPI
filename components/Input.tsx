import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

const Input: React.FC<InputProps> = ({ label, className = '', ...props }) => {
  return (
    <div className="flex flex-col gap-1.5 mb-4">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      <input
        className={`bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent block w-full p-2.5 placeholder-gray-400 dark:placeholder-gray-500 transition-colors ${className}`}
        {...props}
      />
    </div>
  );
};

export default Input;