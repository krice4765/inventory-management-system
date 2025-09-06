import { useQuery } from '@tanstack/react-query';
import * as api from '../api/system';
import type { SystemHealth } from '../api/system';

export function useSystemHealth() {
  return useQuery<SystemHealth, Error>({
    queryKey: ['system-health'],
    queryFn: api.getSystemHealth,
    staleTime: 5 * 60 * 1000, // 5分間キャッシュ
    refetchInterval: 10 * 60 * 1000, // 10分ごとに更新
  });
}