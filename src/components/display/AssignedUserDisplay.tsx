import React from 'react';
import { User } from 'lucide-react';
import { useDarkMode } from '../../hooks/useDarkMode';
import { useAssignedUser, AssignedUserUtils } from '../../hooks/useAssignedUsers';

interface AssignedUserDisplayProps {
  userId?: string | null;
  showDepartment?: boolean;
  variant?: 'compact' | 'full';
}

export const AssignedUserDisplay: React.FC<AssignedUserDisplayProps> = ({
  userId,
  showDepartment = false,
  variant = 'compact',
}) => {
  const { isDark } = useDarkMode();
  const { user, isLoading } = useAssignedUser(userId);

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2">
        {variant === 'full' && <User className="h-4 w-4 text-gray-400" />}
        <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-4 w-20 rounded"></div>
      </div>
    );
  }

  if (!userId || !user) {
    return (
      <div className={`flex items-center space-x-2 ${
        isDark ? 'text-gray-400' : 'text-gray-500'
      }`}>
        {variant === 'full' && <User className="h-4 w-4" />}
        <span className="text-sm">未設定</span>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`text-sm ${
        isDark ? 'text-gray-300' : 'text-gray-900'
      }`}>
        <div className="font-medium">{user.full_name}</div>
        {showDepartment && user.department && (
          <div className={`text-xs ${
            isDark ? 'text-gray-400' : 'text-gray-500'
          }`}>
            {user.department}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      <User className={`h-4 w-4 ${
        isDark ? 'text-gray-400' : 'text-gray-500'
      }`} />
      <div>
        <div className={`text-sm font-medium ${
          isDark ? 'text-gray-300' : 'text-gray-900'
        }`}>
          {user.full_name}
        </div>
        {showDepartment && user.department && (
          <div className={`text-xs ${
            isDark ? 'text-gray-400' : 'text-gray-500'
          }`}>
            {user.department}
          </div>
        )}
        <div className={`text-xs ${
          isDark ? 'text-gray-400' : 'text-gray-500'
        }`}>
          {AssignedUserUtils.getPermissionDescription(user)}
        </div>
      </div>
    </div>
  );
};