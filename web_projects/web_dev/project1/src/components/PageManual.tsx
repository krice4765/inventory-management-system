import React, { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';

interface ManualSection {
  title: string;
  content: string[];
}

interface PageManualProps {
  pageTitle: string;
  sections: ManualSection[];
}

export default function PageManual({ pageTitle, sections }: PageManualProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* ヘルプアイコンボタン */}
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 text-white hover:bg-blue-700 rounded-lg transition-colors"
        title={`${pageTitle}の使い方`}
      >
        <HelpCircle className="w-6 h-6" />
      </button>

      {/* マニュアルモーダル */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* ヘッダー */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <HelpCircle className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-900">
                  {pageTitle} - 使い方マニュアル
                </h2>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* コンテンツ */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {sections.map((section, index) => (
                  <div key={index} className="space-y-3">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-sm font-bold">
                        {index + 1}
                      </span>
                      {section.title}
                    </h3>
                    <div className="ml-8 space-y-2">
                      {section.content.map((item, itemIndex) => (
                        <p key={itemIndex} className="text-gray-700 leading-relaxed">
                          {item}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* フッター */}
            <div className="flex items-center justify-end p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
