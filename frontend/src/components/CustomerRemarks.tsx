import React from 'react';
import { MessageSquare } from 'lucide-react';

interface CustomerRemarkProps {
  remark: string;
}

export const CustomerRemark: React.FC<CustomerRemarkProps> = ({ remark }) => {
  if (!remark) {
    return null;
  }

  return (
    <div className="my-2 mx-4 p-4 bg-yellow-100 border-l-4 border-yellow-500 rounded-r-md shadow-inner">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <MessageSquare className="h-6 w-6 text-yellow-700 mt-0.5" />
        </div>
        <div className="ml-3">
          <h3 className="text-md font-bold text-yellow-900">Customer Feedback:</h3>
          <p className="mt-1 text-sm text-yellow-800 whitespace-pre-wrap">{remark}</p>
        </div>
      </div>
    </div>
  );
};