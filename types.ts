
export type PageType = 'dashboard' | 'candidates' | 'voters' | 'voter-import' | 'data-entry' | 'calculation' | 'reports' | 'accounts' | 'logs' | 'design-system';

export type ResidenceStatus = 'thuong-tru' | 'tam-tru' | 'tam-vang' | 'lam-an-xa' | 'hoc-xa' | 'da-chuyen-di' | 'moi-chuyen-den' | 'khac';
export type VotingStatus = 'chua-bau' | 'da-bau' | 'khong-bau';

/**
 * LocationNode
 */
export interface LocationNode {
  id: string;
  name: string;
  parentId?: string;
  type: 'ward' | 'neighborhood' | 'unit' | 'area';
  locationDetail?: string;
  groups?: string; // e.g., "Tổ 1, 2, 3"
  neighborhoodId?: string;
}

/**
 * Voter Entity
 */
export interface Voter {
  id: string;
  name: string;
  dob: string;
  gender: 'Nam' | 'Nữ';
  cccd: string;
  voterCardNumber: string;
  address: string;
  group: string;
  neighborhoodId: string;
  unitId: string;
  areaId: string;
  residenceStatus: ResidenceStatus;
  permanentAddress?: string;
  temporaryAddress?: string;
  residenceNote?: string;
  votingStatus: VotingStatus;
  status: 'hop-le' | 'loi' | 'trung';
  ethnic?: string; // Thêm trường Dân tộc
  voteQH?: boolean;
  voteT?: boolean;
  voteP?: boolean;
}

export interface LogEntry {
  id: string;
  time: string;
  user: string;
  action: string;
  details: string;
  ip: string;
  status: 'success' | 'failure';
}

// DANH SÁCH KHU PHỐ
export const NEIGHBORHOODS = [
  { id: 'kp_1a', name: 'Khu phố 1A' },
  { id: 'kp_1b', name: 'Khu phố 1B' },
  { id: 'kp_2', name: 'Khu phố 2' },
  { id: 'kp_3', name: 'Khu phố 3' },
  { id: 'kp_4', name: 'Khu phố 4' },
  { id: 'kp_bpa', name: 'KP Bình Phước A' },
  { id: 'kp_bpb', name: 'KP Bình Phước B' },
];

// MASTER DATA ĐỊA DANH BẦU CỬ
export const AN_PHU_LOCATIONS: LocationNode[] = [
  { id: 'ap', name: 'Phường An Phú', type: 'ward' },
  { id: 'unit_1', name: 'Đơn vị số 1', parentId: 'ap', type: 'unit' },
  { id: 'unit_2', name: 'Đơn vị số 2', parentId: 'ap', type: 'unit' },
  { id: 'unit_3', name: 'Đơn vị số 3', parentId: 'ap', type: 'unit' },
  { id: 'unit_4', name: 'Đơn vị số 4', parentId: 'ap', type: 'unit' },
  { id: 'unit_5', name: 'Đơn vị số 5', parentId: 'ap', type: 'unit' },
  { id: 'unit_6', name: 'Đơn vị số 6', parentId: 'ap', type: 'unit' },
  { id: 'unit_7', name: 'Đơn vị số 7', parentId: 'ap', type: 'unit' },
  { id: 'unit_8', name: 'Đơn vị số 8', parentId: 'ap', type: 'unit' },
  { id: 'unit_9', name: 'Đơn vị số 9', parentId: 'ap', type: 'unit' },

  { id: 'kv01', name: 'KVBP số 01', parentId: 'unit_1', type: 'area', neighborhoodId: 'kp_1a', locationDetail: 'Trường Tiểu học An Phú 3', groups: 'Tổ 1, 2, 3' },
  { id: 'kv02', name: 'KVBP số 02', parentId: 'unit_1', type: 'area', neighborhoodId: 'kp_1a', locationDetail: 'Văn phòng khu phố 1A', groups: 'Tổ 4, 5, 6' },
  { id: 'kv03', name: 'KVBP số 03', parentId: 'unit_1', type: 'area', neighborhoodId: 'kp_1a', locationDetail: 'Trung tâm VHTT phường An Phú', groups: 'Tổ 7, 8' },
  { id: 'kv04', name: 'KVBP số 04', parentId: 'unit_1', type: 'area', neighborhoodId: 'kp_1a', locationDetail: 'Nhà ông Hồ Ngọc Chiến', groups: 'Tổ 9, 10, 11' },
  { id: 'kv05', name: 'KVBP số 05', parentId: 'unit_1', type: 'area', neighborhoodId: 'kp_1a', locationDetail: 'Chợ Tuy An', groups: 'Tổ 12, 13, 14' },
  { id: 'kv06', name: 'KVBP số 06', parentId: 'unit_1', type: 'area', neighborhoodId: 'kp_4', locationDetail: 'Trung tâm VH LĐ Bình Dương', groups: 'Tổ 1, 7, 13, 15 KP4' },

  { id: 'kv07', name: 'KVBP số 07', parentId: 'unit_2', type: 'area', neighborhoodId: 'kp_1b', locationDetail: 'Nhà hàng Hoa Hồng', groups: 'Tổ 1, 24' },
  { id: 'kv08', name: 'KVBP số 08', parentId: 'unit_2', type: 'area', neighborhoodId: 'kp_1b', locationDetail: 'Văn phòng khu phố 1B', groups: 'Tổ 2, 7' },
  { id: 'kv09', name: 'KVBP số 09', parentId: 'unit_2', type: 'area', neighborhoodId: 'kp_1b', locationDetail: 'Nhà ông Bồ Hữu Nam', groups: 'Tổ 5, 15' },
  { id: 'kv10', name: 'KVBP số 10', parentId: 'unit_2', type: 'area', neighborhoodId: 'kp_1b', locationDetail: 'Nhà ông Trần Văn Thơ', groups: 'Tổ 3, 9, 18' },
  { id: 'kv11', name: 'KVBP số 11', parentId: 'unit_2', type: 'area', neighborhoodId: 'kp_1b', locationDetail: 'Chợ Phú An', groups: 'Tổ 13, 16, 17, 19, 23' },

  { id: 'kv12', name: 'KVBP số 12', parentId: 'unit_3', type: 'area', neighborhoodId: 'kp_1b', locationDetail: 'Sân bóng Hải Đăng', groups: 'Tổ 6, 12, 22' },
  { id: 'kv13', name: 'KVBP số 13', parentId: 'unit_3', type: 'area', neighborhoodId: 'kp_1b', locationDetail: 'Chốt An ninh cơ sở KP 1B', groups: 'Tổ 4, 11, 14, 21' },
  { id: 'kv14', name: 'KVBP số 14', parentId: 'unit_3', type: 'area', neighborhoodId: 'kp_1b', locationDetail: 'Hồ bơi Bảo Vân', groups: 'Tổ 10, 20' },
  { id: 'kv15', name: 'KVBP số 15', parentId: 'unit_3', type: 'area', neighborhoodId: 'kp_1b', locationDetail: 'Trường MN Bình Minh', groups: 'Tổ 8, 25' },

  { id: 'kv16', name: 'KVBP số 16', parentId: 'unit_4', type: 'area', neighborhoodId: 'kp_2', locationDetail: 'Văn phòng khu phố 2', groups: 'Tổ 2, 8, 9, 11, 15' },
  { id: 'kv17', name: 'KVBP số 17', parentId: 'unit_4', type: 'area', neighborhoodId: 'kp_2', locationDetail: 'Nhà bà Nguyễn Thị Dung', groups: 'Tổ 1, 7, 10, 12, 13, 16, 17, 18' },
  { id: 'kv18', name: 'KVBP số 18', parentId: 'unit_4', type: 'area', neighborhoodId: 'kp_2', locationDetail: 'Nhà bà Nguyễn Thị Tám', groups: 'Tổ 3, 4, 5, 6, 14' },
  { id: 'kv19', name: 'KVBP số 19', parentId: 'unit_4', type: 'area', neighborhoodId: 'kp_3', locationDetail: 'Nhà bà Phạm Thị Yến', groups: 'Tổ 8, 9, 11, 14' },
  { id: 'kv20', name: 'KVBP số 20', parentId: 'unit_4', type: 'area', neighborhoodId: 'kp_3', locationDetail: 'Miếu bà Ngũ hành KP 3', groups: 'Tổ 7, 10, 12' },
  { id: 'kv21', name: 'KVBP số 21', parentId: 'unit_4', type: 'area', neighborhoodId: 'kp_3', locationDetail: 'Văn phòng khu phố 3', groups: 'Tổ 1, 2, 5, 6' },
  { id: 'kv22', name: 'KVBP số 22', parentId: 'unit_4', type: 'area', neighborhoodId: 'kp_3', locationDetail: 'Văn phòng ANTT+ Khu đội', groups: 'Tổ 3, 4, 13' },

  { id: 'kv23', name: 'KVBP số 23', parentId: 'unit_5', type: 'area', neighborhoodId: 'kp_4', locationDetail: 'Trường MN Lá Xanh 3', groups: 'Tổ 4, 21, 25, 33' },
  { id: 'kv24', name: 'KVBP số 24', parentId: 'unit_5', type: 'area', neighborhoodId: 'kp_4', locationDetail: 'Nhà ông Nguyễn Văn Cư', groups: 'Tổ 2, 5, 16, 22' },
  { id: 'kv25', name: 'KVBP số 25', parentId: 'unit_5', type: 'area', neighborhoodId: 'kp_4', locationDetail: 'Nhà bà Nguyễn Thị Tuyết Trinh', groups: 'Tổ 3' },
  { id: 'kv26', name: 'KVBP số 26', parentId: 'unit_5', type: 'area', neighborhoodId: 'kp_4', locationDetail: 'Trường MN Búp Sen Hồng', groups: 'Tổ 9, 11, 12, 26' },

  { id: 'kv27', name: 'KVBP số 27', parentId: 'unit_6', type: 'area', neighborhoodId: 'kp_4', locationDetail: 'Văn phòng khu phố 4', groups: 'Tổ 23, 24, 29, 30, 31' },
  { id: 'kv28', name: 'KVBP số 28', parentId: 'unit_6', type: 'area', neighborhoodId: 'kp_4', locationDetail: 'Trường MN Vàng Anh', groups: 'Tổ 10A, 17, 17A, 20' },
  { id: 'kv29', name: 'KVBP số 29', parentId: 'unit_6', type: 'area', neighborhoodId: 'kp_4', locationDetail: 'Nhà ông Phạm Văn Cảnh', groups: 'Tổ 6, 19, 27' },
  { id: 'kv30', name: 'KVBP số 30', parentId: 'unit_6', type: 'area', neighborhoodId: 'kp_4', locationDetail: 'Nhà sách Trí Thức', groups: 'Tổ 10, 14, 32' },
  { id: 'kv31', name: 'KVBP số 31', parentId: 'unit_6', type: 'area', neighborhoodId: 'kp_4', locationDetail: 'Nhà ông Nguyễn Duy Tiến', groups: 'Tổ 8, 18, 28' },

  { id: 'kv32', name: 'KVBP số 32', parentId: 'unit_7', type: 'area', neighborhoodId: 'kp_bpa', locationDetail: 'Văn phòng KP Bình Phước A', groups: 'Tổ 20, 23-26, 28' },
  { id: 'kv33', name: 'KVBP số 33', parentId: 'unit_7', type: 'area', neighborhoodId: 'kp_bpa', locationDetail: 'Trường MN Hoa Mai 5', groups: 'Tổ 4-14' },
  { id: 'kv34', name: 'KVBP số 34', parentId: 'unit_7', type: 'area', neighborhoodId: 'kp_bpa', locationDetail: 'Trường MN Hoa Mai 5 (2)', groups: 'Tổ 15, 18, 19, 21, 22' },
  { id: 'kv35', name: 'KVBP số 35', parentId: 'unit_7', type: 'area', neighborhoodId: 'kp_bpa', locationDetail: 'Trường MN Minh Thảo 2', groups: 'Tổ 16, 17, 27' },
  { id: 'kv36', name: 'KVBP số 36', parentId: 'unit_7', type: 'area', neighborhoodId: 'kp_bpa', locationDetail: 'Lớp MN Sao Minh', groups: 'Tổ 1, 2, 3' },

  { id: 'kv37', name: 'KVBP số 37', parentId: 'unit_8', type: 'area', neighborhoodId: 'kp_bpb', locationDetail: 'Trường MN Hoa Thiên Lý', groups: 'Tổ 15, 17, 18, 36-40' },
  { id: 'kv38', name: 'KVBP số 38', parentId: 'unit_8', type: 'area', neighborhoodId: 'kp_bpb', locationDetail: 'Trường MN Hoa Thiên Lý (2)', groups: 'Tổ 16, 41-48' },
  { id: 'kv39', name: 'KVBP số 39', parentId: 'unit_8', type: 'area', neighborhoodId: 'kp_bpb', locationDetail: 'Văn phòng KP Bình Phước B', groups: 'Tổ 2, 19, 49, 50' },
  { id: 'kv40', name: 'KVBP số 40', parentId: 'unit_8', type: 'area', neighborhoodId: 'kp_bpb', locationDetail: 'Nhà Bà Trần Thị Sông Hương', groups: 'Tổ 1, 3, 4' },

  { id: 'kv41', name: 'KVBP số 41', parentId: 'unit_9', type: 'area', neighborhoodId: 'kp_bpb', locationDetail: 'Trường TH Lê Thị Trung', groups: 'Tổ 5-7, 20, 31-35' },
  { id: 'kv42', name: 'KVBP số 42', parentId: 'unit_9', type: 'area', neighborhoodId: 'kp_bpb', locationDetail: 'Trường TH Lê Thị Trung (2)', groups: 'Tổ 8, 10, 11, 12' },
  { id: 'kv43', name: 'KVBP số 43', parentId: 'unit_9', type: 'area', neighborhoodId: 'kp_bpb', locationDetail: 'Nhà Trẻ Hoa Đỗ Quyên', groups: 'Tổ 13, 14, 23, 30' },
  { id: 'kv44', name: 'KVBP số 44', parentId: 'unit_9', type: 'area', neighborhoodId: 'kp_bpb', locationDetail: 'Trường MN Rạng Đông', groups: 'Tổ 24-29' },
  { id: 'kv45', name: 'KVBP số 45', parentId: 'unit_9', type: 'area', neighborhoodId: 'kp_bpb', locationDetail: 'Trường TH Lê Thị Trung (3)', groups: 'Tổ 9, 21, 22' },
];
