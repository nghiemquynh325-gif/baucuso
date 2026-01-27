-- ===================================================================
-- KIỂM TRA VÀ PHÂN TÍCH DỮ LIỆU CỬ TRI CHO KVBP 21
-- ===================================================================

-- 1. Kiểm tra số lượng cử tri trong KVBP 21
SELECT 
    'KVBP 21 - Voter Count' as check_type,
    COUNT(*) as total_voters
FROM voters 
WHERE area_id = 'kv21';

-- 2. Kiểm tra tất cả các area_id có trong bảng voters
SELECT 
    area_id,
    COUNT(*) as voter_count
FROM voters
GROUP BY area_id
ORDER BY area_id;

-- 3. Kiểm tra xem có cử tri nào thuộc unit_4 (đơn vị chứa KVBP 21) không
SELECT 
    area_id,
    COUNT(*) as voter_count
FROM voters
WHERE unit_id = 'unit_4'
GROUP BY area_id
ORDER BY area_id;

-- 4. Kiểm tra xem có cử tri nào thuộc khu phố 3 (chứa KVBP 21) không
SELECT 
    area_id,
    COUNT(*) as voter_count
FROM voters
WHERE neighborhood_id = 'kp_3'
GROUP BY area_id
ORDER BY area_id;

-- 5. Xem mẫu dữ liệu cử tri từ các KVBP khác trong cùng đơn vị
SELECT 
    area_id,
    name,
    cccd,
    unit_id,
    neighborhood_id,
    group_name
FROM voters
WHERE unit_id = 'unit_4'
LIMIT 10;

-- ===================================================================
-- KẾT LUẬN DỰ KIẾN:
-- ===================================================================
-- Nếu Query 1 trả về 0: Không có cử tri nào được import cho KVBP 21
-- Nguyên nhân có thể:
--   - Dữ liệu import chưa có cử tri cho khu vực này
--   - Mapping area_id trong quá trình import bị sai
--   - Cử tri thuộc KVBP 21 bị gán nhầm sang area_id khác
-- 
-- GIẢI PHÁP:
--   1. Kiểm tra file Excel gốc xem có dữ liệu KVBP 21 không
--   2. Re-import dữ liệu với mapping đúng
--   3. Hoặc cập nhật area_id cho các cử tri bị gán sai
-- ===================================================================
