-- ===================================================================
-- GIẢI PHÁP: CẬP NHẬT DỮ LIỆU CỬ TRI CHO KVBP 21
-- ===================================================================
-- Script này cung cấp nhiều phương án để xử lý vấn đề KVBP 21 không có cử tri
-- ===================================================================

-- PHƯƠNG ÁN 1: Kiểm tra xem có cử tri nào bị gán sai area_id không
-- (Ví dụ: Cử tri thuộc KVBP 21 nhưng bị gán vào kv20 hoặc kv22)

-- Xem danh sách cử tri trong các KVBP lân cận (unit_4)
SELECT 
    area_id,
    COUNT(*) as voter_count,
    STRING_AGG(DISTINCT group_name, ', ') as groups
FROM voters
WHERE unit_id = 'unit_4'
GROUP BY area_id
ORDER BY area_id;

-- PHƯƠNG ÁN 2: Nếu cử tri bị gán sai, cập nhật lại area_id
-- (Chỉ chạy nếu xác định được cử tri nào thuộc KVBP 21)
-- 
-- Ví dụ: Nếu phát hiện cử tri có group_name = 'Tổ 1', 'Tổ 2', 'Tổ 5', 'Tổ 6' 
-- trong unit_4 nhưng area_id không phải kv21, có thể cập nhật:
--
-- UPDATE voters
-- SET area_id = 'kv21'
-- WHERE unit_id = 'unit_4'
-- AND area_id != 'kv21'
-- AND group_name IN ('Tổ 1', 'Tổ 2', 'Tổ 5', 'Tổ 6')
-- AND neighborhood_id = 'kp_3';

-- PHƯƠNG ÁN 3: Tạo bản ghi area_stats mặc định cho KVBP 21
-- Điều này cho phép nhập liệu ngay cả khi chưa có cử tri
INSERT INTO area_stats (area_id, total_voters, issued_votes, received_votes, valid_votes, invalid_votes, is_locked)
VALUES ('kv21', 0, 0, 0, 0, 0, false)
ON CONFLICT (area_id) DO NOTHING;

-- PHƯƠNG ÁN 4: Kiểm tra lại sau khi áp dụng
SELECT 
    'After Fix - KVBP 21' as status,
    COALESCE((SELECT COUNT(*) FROM voters WHERE area_id = 'kv21'), 0) as voters_count,
    COALESCE((SELECT total_voters FROM area_stats WHERE area_id = 'kv21'), 0) as stats_count;

-- ===================================================================
-- HƯỚNG DẪN SỬ DỤNG:
-- ===================================================================
-- 1. Chạy Phương án 1 để xem phân bố cử tri trong unit_4
-- 2. Nếu phát hiện cử tri bị gán sai → Sửa câu UPDATE ở Phương án 2 và chạy
-- 3. Nếu thực sự không có dữ liệu → Chạy Phương án 3 để tạo record mặc định
-- 4. Chạy Phương án 4 để kiểm tra kết quả
-- 5. Refresh trang Data Entry và kiểm tra lại KVBP 21
-- ===================================================================
