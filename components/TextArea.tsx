import React from 'react';

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
}

const TextArea: React.FC<TextAreaProps> = ({ label, className = '', ...props }) => {
  return (
    <div className="flex flex-col gap-1.5 mb-4 flex-1">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      <textarea
        className={`bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent block w-full p-2.5 placeholder-gray-400 dark:placeholder-gray-500 min-h-[120px] resize-none transition-colors ${className}`}
        {...props}
      />
    </div>
  );
};

export default TextArea;