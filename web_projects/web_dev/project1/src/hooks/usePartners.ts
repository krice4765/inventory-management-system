import { useQuery } from '@tanstack/react-query';
import * as api from '../api/partners';

export function useSuppliers() {
  return useQuery<api.Partner[], Error>({
    queryKey: ['suppliers'],
    queryFn: api.getSuppliers,
  });
}

export function useCustomers() {
  return useQuery<api.Partner[], Error>({
    queryKey: ['customers'],
    queryFn: api.getCustomers,
  });
}

export function usePartners(type?: api.PartnerType) {
  return useQuery<api.Partner[], Error>({
    queryKey: ['partners', type],
    queryFn: () => api.getPartners(type),
  });
}
