export interface FeishuContactUserAvatar {
  avatar_72?: string;
  avatar_240?: string;
  avatar_640?: string;
  avatar_origin?: string;
}

export interface FeishuContactUserStatus {
  is_activated?: boolean;
  is_exited?: boolean;
  is_frozen?: boolean;
  is_resigned?: boolean;
  is_unjoin?: boolean;
}

export interface FeishuContactUser {
  avatar?: FeishuContactUserAvatar;
  city?: string;
  country?: string;
  department_ids?: string[];
  email?: string;
  en_name?: string;
  leader_user_id?: string;
  mobile?: string;
  name?: string;
  nickname?: string;
  open_id?: string;
  status?: FeishuContactUserStatus;
  union_id?: string;
  user_id?: string;
  [key: string]: unknown;
}
