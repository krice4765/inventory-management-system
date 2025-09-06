import React from 'react'

interface InstallmentProgressProps {
  orderTotal: number
  allocatedAmount: number
  className?: string
}

export const InstallmentProgress: React.FC<InstallmentProgressProps> = ({
  orderTotal,
  allocatedAmount,
  className = ''
}) => {
  const progressRate = orderTotal > 0 ? (allocatedAmount / orderTotal) * 100 : 0
  const remainingAmount = Math.max(0, orderTotal - allocatedAmount)
  const isComplete = progressRate >= 100
  const isOverAllocated = progressRate > 100

  const getProgressColor = () => {
    if (isOverAllocated) return 'bg-red-500'
    if (isComplete) return 'bg-green-500'
    if (progressRate >= 80) return 'bg-yellow-500'
    if (progressRate >= 50) return 'bg-blue-500'
    return 'bg-gray-400'
  }

  const getStatusText = () => {
    if (isOverAllocated) return '🔴 超過配分'
    if (isComplete) return '✅ 完全配分'
    if (progressRate >= 80) return '⚠️ 配分間近'
    return '📋 配分中'
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* 進捗バー */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className={`h-2 rounded-full transition-all duration-300 ${getProgressColor()}`}
          style={{ width: `${Math.min(100, progressRate)}%` }}
        />
      </div>
      
      {/* 詳細情報 */}
      <div className="flex justify-between items-center text-xs">
        <div className="flex items-center space-x-2">
          <span className="font-medium">{getStatusText()}</span>
          <span className="text-gray-600">
            {progressRate.toFixed(1)}%
          </span>
        </div>
        
        <div className="text-right">
          <div className="text-gray-600">
            ¥{allocatedAmount.toLocaleString()} / ¥{orderTotal.toLocaleString()}
          </div>
          {remainingAmount > 0 && (
            <div className="text-blue-600 font-medium">
              残額: ¥{remainingAmount.toLocaleString()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}