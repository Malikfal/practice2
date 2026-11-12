import type {
  ApiMutationResponse,
  PasswordForm,
  ProfileForm,
  PermissionOption,
  RoleOption,
  User,
} from '../../types/app';

export function createProfileApi(
  request: <TResponse>(_path: string, _options?: RequestInit) => Promise<TResponse>,
) {
  return {
    getProfile: () => request<User>('/profile'),
    getRoleOptions: () => request<RoleOption[]>('/meta/roles'),
    getPermissionOptions: () => request<PermissionOption[]>('/meta/permissions'),

    updateProfile: (payload: ProfileForm) =>
      request<User>('/profile', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),

    changePassword: (payload: PasswordForm) =>
      request<ApiMutationResponse>('/profile/password', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
  };
}
