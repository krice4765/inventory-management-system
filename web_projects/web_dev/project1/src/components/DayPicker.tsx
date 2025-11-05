import { useState } from 'react';

interface DayPickerProps {
  value: number | null;
  onChange: (day: number) => void;
  error?: any;
}

/**
 * カレンダー風の日選択UIコンポーネント
 * 1〜31日と月末を選択できる
 */
export function DayPicker({ value, onChange, error }: DayPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  // 選択された日のラベルを取得
  const getLabel = () => {
    if (value === null || value === 0) return '月末';
    return `${value}日`;
  };

  // 日を選択
  const handleSelectDay = (day: number) => {
    onChange(day);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      {/* 選択ボタン */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 border rounded-md text-left flex items-center justify-between ${
          error
            ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
            : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
        }`}
      >
        <span className={value !== null ? 'text-gray-900' : 'text-gray-400'}>
          {value !== null ? getLabel() : '選択してください'}
        </span>
        <svg
          className="w-5 h-5 text-gray-400"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* カレンダー風のドロップダウン */}
      {isOpen && (
        <>
          {/* 背景オーバーレイ */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* カレンダーパネル */}
          <div className="absolute z-20 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-4">
            <div className="text-sm font-medium text-gray-700 mb-3">
              締日・支払日を選択
            </div>

            {/* 月末ボタン */}
            <button
              type="button"
              onClick={() => handleSelectDay(0)}
              className={`w-full mb-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                value === 0
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              月末
            </button>

            {/* 日付グリッド（カレンダー風） */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 31 }, (_, i) => {
                const day = i + 1;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleSelectDay(day)}
                    className={`
                      w-8 h-8 rounded-md text-sm font-medium transition-colors
                      ${
                        value === day
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-50 text-gray-700 hover:bg-gray-200'
                      }
                    `}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {/* 説明 */}
            <div className="mt-3 text-xs text-gray-500">
              毎月の繰り返し設定です
            </div>
          </div>
        </>
      )}
    </div>
  );
}
